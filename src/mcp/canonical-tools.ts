/**
 * Canonical MCP Tools for Allura Memory
 * 
 * Implements the 5 canonical memory operations defined in canonical-contracts.ts.
 * This is the ONLY interface exposed to AI agents via MCP.
 * 
 * Reference: docs/allura/BLUEPRINT.md
 * 
 * Operations:
 * 1. memory_add - Add a memory (episodic → score → promote/queue)
 * 2. memory_search - Search memories (federated: Postgres + Neo4j)
 * 3. memory_get - Get a single memory by ID
 * 4. memory_list - List all memories for a user
 * 5. memory_delete - Soft-delete a memory
 */

import type {
  MemoryAddRequest,
  MemoryAddResponse,
  MemorySearchRequest,
  MemorySearchResponse,
  MemoryGetRequest,
  MemoryGetResponse,
  MemoryListRequest,
  MemoryListResponse,
  MemoryDeleteRequest,
  MemoryDeleteResponse,
  GroupId,
  MemoryId,
  MemoryProvenance,
  MemoryResponseMeta,
} from "@/lib/memory/canonical-contracts";

import { Pool } from "pg";
import neo4j, { Driver } from "neo4j-driver";
import { randomUUID } from "crypto";
import { config } from "dotenv";
import {
  DatabaseUnavailableError,
  DatabaseQueryError,
  classifyPostgresError,
} from "@/lib/errors/database-errors";
import { curatorScore } from "@/lib/curator/score";

config();

// ── Connection Management ─────────────────────────────────────────────────

let pgPool: Pool | null = null;
let neo4jDriver: Driver | null = null;

async function getConnections(): Promise<{ pg: Pool; neo4j: Driver }> {
  if (!pgPool) {
    pgPool = new Pool({
      host: process.env.POSTGRES_HOST || "localhost",
      port: parseInt(process.env.POSTGRES_PORT || "5432"),
      database: process.env.POSTGRES_DB || "memory",
      user: process.env.POSTGRES_USER || "ronin4life",
      password: process.env.POSTGRES_PASSWORD,
      connectionTimeoutMillis: 10000,
      max: 10,
    });
  }

  if (!neo4jDriver) {
    neo4jDriver = neo4j.driver(
      process.env.NEO4J_URI || "bolt://localhost:7687",
      neo4j.auth.basic(
        process.env.NEO4J_USER || "neo4j",
        process.env.NEO4J_PASSWORD || "password"
      ),
      { maxConnectionPoolSize: 50 }
    );
  }

  return { pg: pgPool, neo4j: neo4jDriver };
}

/**
 * Reset cached connections. Used in tests to force reconnection
 * after changing environment variables.
 */
export function resetConnections(): void {
  if (pgPool) {
    pgPool.end().catch(() => {});
    pgPool = null;
  }
  if (neo4jDriver) {
    neo4jDriver.close().catch(() => {});
    neo4jDriver = null;
  }
}

interface EpisodicMemoryRow {
  id: string;
  content: string;
  provenance: string | null;
  user_id: string | null;
  created_at: string;
}

function toMemoryId(value: string): MemoryId {
  return value as MemoryId;
}

function toProvenance(value: string | null | undefined): MemoryProvenance {
  return value === "manual" ? "manual" : "conversation";
}

function baseMeta(storesUsed: Array<"postgres" | "neo4j">, degraded: boolean = false): MemoryResponseMeta {
  return {
    contract_version: "v1",
    degraded,
    stores_used: storesUsed,
    stores_attempted: ["postgres", "neo4j"],
    warnings: degraded ? ["semantic layer unavailable; returned episodic results only"] : [],
  };
}

function degradedMeta(storesUsed: Array<"postgres" | "neo4j">): MemoryResponseMeta {
  return {
    ...baseMeta(storesUsed, true),
    degraded_reason: "neo4j_unavailable",
  };
}

// ── Configuration ─────────────────────────────────────────────────────────

function getPromotionMode(): "auto" | "soc2" {
  return (process.env.PROMOTION_MODE || "soc2") as "auto" | "soc2";
}

function getAutoApprovalThreshold(): number {
  return parseFloat(process.env.AUTO_APPROVAL_THRESHOLD || "0.85");
}

const DUPLICATE_THRESHOLD = parseFloat(process.env.DUPLICATE_THRESHOLD || "0.95");
const RECOVERY_WINDOW_DAYS = parseInt(process.env.RECOVERY_WINDOW_DAYS || "30");

// ── Validation ─────────────────────────────────────────────────────────────

function validateGroupId(groupId: string): GroupId {
  const pattern = /^allura-[a-z0-9-]+$/;
  if (!pattern.test(groupId)) {
    throw new Error(
      `Invalid group_id: "${groupId}". Must match pattern: allura-* (e.g., allura-myproject)`
    );
  }
  return groupId as GroupId;
}

function generateMemoryId(): MemoryId {
  return randomUUID() as MemoryId;
}

// ── Deduplication ─────────────────────────────────────────────────────────

/**
 * Check for duplicate memories in Neo4j.
 * Returns existing memory ID if duplicate found, null otherwise.
 */
async function checkDuplicate(
  neo4j: Driver,
  groupId: GroupId,
  userId: string,
  content: string
): Promise<MemoryId | null> {
  const session = neo4j.session();
  
  try {
    // Exact match check
    const result = await session.run(
      `
      MATCH (m:Memory)
      WHERE m.group_id = $groupId
        AND m.user_id = $userId
        AND m.content = $content
        AND NOT (m)<-[:SUPERSEDES]-()
      RETURN m.id AS id
      LIMIT 1
      `,
      { groupId, userId, content }
    );
    
    if (result.records.length > 0) {
      return result.records[0].get("id") as MemoryId;
    }
    
    // TODO: Semantic similarity check (requires embeddings)
    
    return null;
  } finally {
    await session.close();
  }
}

// ── Canonical Operations ───────────────────────────────────────────────────

/**
 * 1. memory_add
 * 
 * Add a memory for a user.
 * 
 * Flow:
 * 1. Validate group_id and content
 * 2. Write to PostgreSQL (events table, append-only)
 * 3. Score content
 * 4. If score >= threshold:
 *    - auto mode: Promote to Neo4j immediately
 *    - soc2 mode: Queue in proposals table
 * 5. Return memory ID and storage location
 */
export async function memory_add(request: MemoryAddRequest): Promise<MemoryAddResponse> {
  const PROMOTION_MODE = getPromotionMode();
  const AUTO_APPROVAL_THRESHOLD = getAutoApprovalThreshold();
  
  console.log(`[DEBUG memory_add] PROMOTION_MODE=${PROMOTION_MODE}, AUTO_APPROVAL_THRESHOLD=${AUTO_APPROVAL_THRESHOLD}`);
  
  // 1. Validate
  const groupId = validateGroupId(request.group_id);
  const memoryId = generateMemoryId();
  const createdAt = new Date().toISOString();
  
  try {
    const { pg, neo4j } = await getConnections();
  
  // 2. Write to PostgreSQL (episodic)
  const groupId = validateGroupId(request.group_id);
  const memoryId = generateMemoryId();
  const createdAt = new Date().toISOString();
  
  // 2. Write to PostgreSQL (episodic)
  const eventResult = await pg.query(
    `INSERT INTO events (
      group_id, event_type, agent_id, status, metadata, created_at
    ) VALUES ($1, $2, $3, $4, $5, $6)
    RETURNING id`,
    [
      groupId,
      "memory_add",
      request.metadata?.agent_id || "api",
      "completed",
      JSON.stringify({
        memory_id: memoryId,
        user_id: request.user_id,
        content: request.content,
        source: request.metadata?.source || "conversation",
        conversation_id: request.metadata?.conversation_id,
      }),
      createdAt,
    ]
  );
  
  const eventId = eventResult.rows[0].id;
  
  // 3. Score content
  // Map MemoryProvenance ('conversation'|'manual') to curatorScore source ('conversation'|'manually_added')
  const scoreSource: "conversation" | "manually_added" =
    request.metadata?.source === "manual" ? "manually_added" : "conversation";
  const scoreResult = await curatorScore({
    content: request.content,
    source: scoreSource,
    usageCount: 0,
    daysSinceCreated: 0,
  });
  const { confidence: score, reasoning, tier } = scoreResult;
  const threshold = request.threshold || AUTO_APPROVAL_THRESHOLD;
  
  // 4. Check promotion eligibility
  if (score < threshold) {
    // Below threshold: episodic only
    return {
      id: memoryId,
      stored: "episodic",
      score,
      created_at: createdAt,
      meta: baseMeta(["postgres"]),
    };
  }
  
  // Score meets threshold
  if (PROMOTION_MODE === "auto") {
    // Auto mode: Promote immediately
    
    // Check for duplicates (only in auto mode)
    let duplicateId: MemoryId | null = null;
    try {
      duplicateId = await checkDuplicate(neo4j, groupId, request.user_id, request.content);
    } catch (error) {
      console.warn("[degraded] Neo4j duplicate check unavailable in memory_add:", error);
      return {
        id: memoryId,
        stored: "episodic",
        score,
        created_at: createdAt,
        meta: degradedMeta(["postgres"]),
      };
    }

    if (duplicateId) {
      // Duplicate found: return existing ID
      return {
        id: duplicateId,
        stored: "semantic",
        score,
        created_at: createdAt,
        meta: baseMeta(["neo4j"]),
      };
    }
    
    // Promote to Neo4j
    const session = neo4j.session();
    try {
      await session.run(
        `CREATE (m:Memory {
          id: $id,
          group_id: $groupId,
          user_id: $userId,
          content: $content,
          score: $score,
          provenance: $provenance,
          created_at: datetime($createdAt),
          deprecated: false
        })`,
        {
          id: memoryId,
          groupId,
          userId: request.user_id,
          content: request.content,
          score,
          provenance: request.metadata?.source || "conversation",
          createdAt,
        }
      );
      
      // Log promotion event
      await pg.query(
        `INSERT INTO events (
          group_id, event_type, agent_id, status, metadata, created_at
        ) VALUES ($1, $2, $3, $4, $5, $6)`,
        [
          groupId,
          "memory_promoted",
          "system",
          "completed",
          JSON.stringify({
            memory_id: memoryId,
            score,
            tier,
            reasoning,
            trace_ref: eventId,
          }),
          createdAt,
        ]
      );
      
      return {
        id: memoryId,
        stored: "both",
        score,
        created_at: createdAt,
      };
    } catch (error) {
      console.warn("[degraded] Neo4j promotion unavailable in memory_add:", error);
      return {
        id: memoryId,
        stored: "episodic",
        score,
        created_at: createdAt,
        meta: degradedMeta(["postgres"]),
      };
    } finally {
      await session.close();
    }
  } else {
    // SOC2 mode: Queue for human approval (skip duplicate check, always queue)
    await pg.query(
      `INSERT INTO canonical_proposals (
        id, group_id, content, score, reasoning, tier, status, trace_ref, created_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
      [
        randomUUID(),
        groupId,
        request.content,
        score,
        reasoning,
        tier,
        "pending",
        eventId,
        createdAt,
      ]
    );
    
    return {
      id: memoryId,
      stored: "episodic",
      score,
      pending_review: true,
      created_at: createdAt,
      meta: baseMeta(["postgres"]),
    };
  }
  } catch (error) {
    if (error instanceof DatabaseUnavailableError || error instanceof DatabaseQueryError) {
      throw error;
    }
    if (error instanceof Error && (error as Error & { code?: string }).code) {
      throw classifyPostgresError(error, "memory_add", "INSERT events");
    }
    throw error;
  }
}

/**
 * 2. memory_search
 * 
 * Search memories across both stores.
 * Federated search: PostgreSQL (episodic) + Neo4j (semantic).
 * Results merged by relevance score.
 */
export async function memory_search(request: MemorySearchRequest): Promise<MemorySearchResponse> {
  // Validate
  const groupId = validateGroupId(request.group_id);
  const limit = Math.floor(request.limit || 10);
  
  try {
    const { pg, neo4j: neo4jDriver } = await getConnections();
    const startTime = Date.now();
  
  // Parallel search both stores
  const episodicResults = await pg.query<EpisodicMemoryRow>(
    `SELECT metadata->>'memory_id' AS id, metadata->>'content' AS content, 
            metadata->>'source' AS provenance,
            created_at
      FROM events
     WHERE group_id = $1
       AND event_type = 'memory_add'
       AND ($2::text IS NULL OR metadata->>'user_id' = $2)
       AND metadata->>'content' ILIKE '%' || $3 || '%'
     ORDER BY created_at DESC
     LIMIT $4`,
    [groupId, request.user_id || null, request.query, limit]
  );

  let semanticResults: Array<{
    id: MemoryId;
    content: string;
    score: number;
    provenance: MemoryProvenance;
    created_at: string;
    usage_count: number;
    relevance: number;
  }> = [];
  let searchMeta = baseMeta(["postgres", "neo4j"]);

  try {
      const session = neo4jDriver.session();
    try {
      const result = await session.run(
        `CALL db.index.fulltext.queryNodes('memory_search_index', $query)
         YIELD node AS m, score
         WHERE m.group_id = $groupId
           AND NOT (m)<-[:SUPERSEDES]-()
         RETURN m.id AS id,
                m.content AS content,
                m.score AS score,
                m.provenance AS provenance,
                m.created_at AS created_at,
                m.usage_count AS usage_count,
                score AS relevance
         ORDER BY relevance DESC, m.score DESC
         LIMIT $limit`,
        {
          query: request.query,
          groupId,
          limit: neo4j.int(limit),
        }
      );

      semanticResults = result.records.map((record) => ({
        id: record.get("id") as MemoryId,
        content: record.get("content"),
        score: record.get("score"),
        provenance: toProvenance(record.get("provenance")),
        created_at: record.get("created_at"),
        usage_count: record.get("usage_count")?.toNumber?.() || 0,
        relevance: record.get("relevance"),
      }));
    } finally {
      await session.close();
    }
  } catch (error) {
    console.warn("[degraded] Neo4j unavailable in memory_search:", error);
    searchMeta = degradedMeta(["postgres"]);
  }
  
  // Merge results
  const episodic = episodicResults.rows.map((row) => ({
    id: toMemoryId(row.id),
    content: row.content,
    score: 0.5, // Episodic memories don't have scores
    source: "episodic" as const,
    provenance: toProvenance(row.provenance),
    created_at: row.created_at,
    usage_count: 0,
  }));
  
  const semantic = semanticResults.map((item) => ({
    id: item.id,
    content: item.content,
    score: item.score,
    source: "semantic" as const,
    provenance: item.provenance,
    created_at: item.created_at,
    usage_count: item.usage_count,
  }));
  
  // Combine and sort by score
  const results = [...semantic, ...episodic]
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);
  
  const latency = Date.now() - startTime;
  
  return {
    results,
    count: results.length,
    latency_ms: latency,
    meta: searchMeta,
  };
  } catch (error) {
    if (error instanceof DatabaseUnavailableError || error instanceof DatabaseQueryError) {
      throw error;
    }
    if (error instanceof Error && (error as Error & { code?: string }).code) {
      throw classifyPostgresError(error, "memory_search", "SELECT events ILIKE");
    }
    throw error;
  }
}

/**
 * 3. memory_get
 * 
 * Retrieve a single memory by ID.
 * Returns memory from either store (episodic or semantic).
 */
export async function memory_get(request: MemoryGetRequest): Promise<MemoryGetResponse> {
  // Validate
  const groupId = validateGroupId(request.group_id);
  
  try {
    const { pg, neo4j } = await getConnections();
  
  // Try Neo4j first (semantic) - secondary store, degradation acceptable
  let getMeta = baseMeta(["postgres", "neo4j"]);
  const session = neo4j.session();
  try {
    const result = await session.run(
      `MATCH (m:Memory)
       WHERE m.id = $id
         AND m.group_id = $groupId
         AND NOT (m)<-[:SUPERSEDES]-()
       RETURN m.id AS id,
              m.content AS content,
              m.score AS score,
              m.provenance AS provenance,
              m.user_id AS user_id,
              m.created_at AS created_at,
              m.version AS version,
              m.deprecated AS deprecated`,
      { id: request.id, groupId }
    );
    
    if (result.records.length > 0) {
      const record = result.records[0];
      return {
        id: record.get("id") as MemoryId,
        content: record.get("content"),
        score: record.get("score"),
        source: "semantic",
        provenance: toProvenance(record.get("provenance")),
        user_id: record.get("user_id"),
        created_at: record.get("created_at"),
        version: record.get("version")?.toNumber?.() || 1,
        usage_count: 0, // TODO: Track usage
        meta: getMeta,
      };
    }
  } catch (error) {
    console.warn("[degraded] Neo4j unavailable in memory_get:", error);
    getMeta = degradedMeta(["postgres"]);
  } finally {
    await session.close();
  }
  
  // Fall back to PostgreSQL (episodic)
  const result = await pg.query<EpisodicMemoryRow>(
    `SELECT metadata->>'memory_id' AS id, metadata->>'content' AS content,
            metadata->>'source' AS provenance,
            metadata->>'user_id' AS user_id,
            created_at
     FROM events
     WHERE metadata->>'memory_id' = $1
       AND group_id = $2
       AND event_type = 'memory_add'`,
    [request.id, groupId]
  );
  
  if (result.rows.length === 0) {
    throw new Error(`Memory not found: ${request.id}`);
  }
  
  const row = result.rows[0];
  return {
    id: toMemoryId(row.id),
    content: row.content,
    score: 0.5, // Episodic memories don't have scores
    source: "episodic",
    provenance: toProvenance(row.provenance),
    user_id: row.user_id || "unknown",
    created_at: row.created_at,
    usage_count: 0,
    meta: getMeta,
  };
  } catch (error) {
    if (error instanceof DatabaseUnavailableError || error instanceof DatabaseQueryError) {
      throw error;
    }
    if (error instanceof Error && (error as Error & { code?: string }).code) {
      throw classifyPostgresError(error, "memory_get", "SELECT events by memory_id");
    }
    throw error;
  }
}

/**
 * 4. memory_list
 * 
 * List all memories for a user within a tenant.
 * Returns from both stores, merged and sorted.
 */
export async function memory_list(request: MemoryListRequest): Promise<MemoryListResponse> {
  // Validate
  const groupId = validateGroupId(request.group_id);
  const limit = request.limit || 50;
  const offset = request.offset || 0;
  
  try {
    const { pg, neo4j: neo4jDriver } = await getConnections();
    
    // Parallel query both stores
    let listMeta = baseMeta(["postgres", "neo4j"]);
    const pgQuery = `SELECT metadata->>'memory_id' AS id, metadata->>'content' AS content,
                metadata->>'source' AS provenance,
                metadata->>'user_id' AS user_id,
                created_at
         FROM events
         WHERE group_id = $1
           AND metadata->>'user_id' = $2
           AND event_type = 'memory_add'
         ORDER BY created_at DESC
         LIMIT $3 OFFSET $4`;
    const [episodicResults, semanticResults] = await Promise.all([
      // PostgreSQL — throw on failure, do NOT swallow
      pg.query<EpisodicMemoryRow>(pgQuery, [groupId, request.user_id, limit, offset]),
      
      // Neo4j
        (async () => {
          const session = neo4jDriver.session();
          try {
             const result = await session.run(
               `MATCH (m:Memory)
                WHERE m.group_id = $groupId
                  AND m.user_id = $userId
                  AND NOT (m)<-[:SUPERSEDES]-()
               RETURN m.id AS id,
                      m.content AS content,
                      m.score AS score,
                      m.provenance AS provenance,
                      m.user_id AS user_id,
                      m.created_at AS created_at,
                      m.version AS version
               ORDER BY created_at DESC
               SKIP $offset
               LIMIT $limit`,
               { groupId, userId: request.user_id, limit: neo4j.int(limit), offset: neo4j.int(offset) }
             );
            
            return result.records.map((record) => ({
              id: record.get("id") as MemoryId,
              content: record.get("content"),
              score: record.get("score"),
              source: "semantic" as const,
              provenance: toProvenance(record.get("provenance")),
              user_id: record.get("user_id"),
              created_at: record.get("created_at"),
              version: record.get("version")?.toNumber?.() || 1,
              usage_count: 0,
            }));
           } catch (err) {
             console.warn("[degraded] Neo4j query error in memory_list:", err);
             listMeta = degradedMeta(["postgres"]);
             return [];
          } finally {
            await session.close();
          }
        })(),
    ]);
  
  // Merge results
  const episodic = episodicResults.rows.map((row) => ({
    id: toMemoryId(row.id),
    content: row.content,
    score: 0.5,
    source: "episodic" as const,
    provenance: toProvenance(row.provenance),
    user_id: row.user_id || "unknown",
    created_at: row.created_at,
    usage_count: 0,
  }));
  
  const memories = [...semanticResults, ...episodic]
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
    .slice(0, limit);
  
   return {
     memories,
     total: memories.length,
     has_more: episodicResults.rows.length === limit || semanticResults.length === limit,
     meta: listMeta,
   };
   } catch (error) {
    // Classify known database errors so callers can distinguish
    // "DB is down" from "query is broken" from "legitimate empty result"
    if (error instanceof DatabaseUnavailableError || error instanceof DatabaseQueryError) {
      throw error;
    }
    // If it's a raw pg error from the query, classify it
    if (error instanceof Error && (error as Error & { code?: string }).code) {
      throw classifyPostgresError(error, "memory_list", "SELECT events");
    }
    console.error("memory_list error:", error);
    throw error;
  }
}

/**
 * 5. memory_delete
 * 
 * Soft-delete a memory.
 * - Appends deletion event to PostgreSQL (append-only)
 * - Marks Neo4j node as deprecated (if promoted)
 * - Original rows remain for audit trail
 */
export async function memory_delete(request: MemoryDeleteRequest): Promise<MemoryDeleteResponse> {
  // Validate
  const groupId = validateGroupId(request.group_id);
  const deletedAt = new Date().toISOString();
  
  try {
    const { pg, neo4j } = await getConnections();
  
  // 1. Append deletion event to PostgreSQL
  await pg.query(
    `INSERT INTO events (
      group_id, event_type, agent_id, status, metadata, created_at
    ) VALUES ($1, $2, $3, $4, $5, $6)`,
    [
      groupId,
      "memory_delete",
      request.user_id,
      "completed",
      JSON.stringify({
        memory_id: request.id,
        user_id: request.user_id,
      }),
      deletedAt,
    ]
  );
  
  // 2. Mark Neo4j node as deprecated (if exists) — secondary store, degradation acceptable
  let deleteMeta = baseMeta(["postgres", "neo4j"]);
  const session = neo4j.session();
  try {
    await session.run(
      `MATCH (m:Memory)
       WHERE m.id = $id
         AND m.group_id = $groupId
       SET m.deprecated = true,
           m.deleted_at = datetime($deletedAt)
       RETURN m.id AS id`,
      { id: request.id, groupId, deletedAt }
    );
  } catch (error) {
    console.warn("[degraded] Neo4j unavailable in memory_delete:", error);
    deleteMeta = degradedMeta(["postgres"]);
  } finally {
    await session.close();
  }
  
  return {
    id: request.id,
    deleted: true,
    deleted_at: deletedAt,
    recovery_days: RECOVERY_WINDOW_DAYS,
    meta: deleteMeta,
  };
  } catch (error) {
    if (error instanceof DatabaseUnavailableError || error instanceof DatabaseQueryError) {
      throw error;
    }
    if (error instanceof Error && (error as Error & { code?: string }).code) {
      throw classifyPostgresError(error, "memory_delete", "INSERT memory_delete event");
    }
    throw error;
  }
}

// ── Export for MCP Server ─────────────────────────────────────────────────

export const canonicalMemoryTools = {
  memory_add,
  memory_search,
  memory_get,
  memory_list,
  memory_delete,
};
