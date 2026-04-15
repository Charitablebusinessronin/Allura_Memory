/**
 * Canonical MCP Tools for Allura Memory
 *
 * Implements the 8 canonical memory operations defined in canonical-contracts.ts.
 * This is the ONLY interface exposed to AI agents via MCP.
 *
 * Reference: docs/allura/BLUEPRINT.md
 *
 * Operations:
 * 1. memory_add    - Add a memory (episodic → score → promote/queue)
 * 2. memory_search  - Search memories (federated: Postgres + Neo4j)
 * 3. memory_get     - Get a single memory by ID
 * 4. memory_list    - List all memories for a user
 * 5. memory_delete  - Soft-delete a memory
 * 6. memory_update  - Append-only versioned update
 * 7. memory_promote - Request curator promotion
 * 8. memory_export  - Export memories
 *
 * Budget & Circuit Breaker Integration:
 * - memory_add: Budget-enforced (pre-check, post-update). Write-intensive, needs rate limiting.
 * - memory_update, memory_delete, memory_promote: Budget-tracked (record usage after call).
 * - All write ops: Wrapped in circuit breakers for DB calls (separate breakers for PG & Neo4j).
 * - Read ops: Circuit breakers on DB calls, no budget check (reads are cheap).
 * - Fail-open: If budget/circuit breaker can't initialize, requests pass through.
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
  MemoryUpdateRequest,
  MemoryUpdateResponse,
  MemoryPromoteRequest,
  MemoryPromoteResponse,
  MemoryExportRequest,
  MemoryExportResponse,
  GroupId,
  MemoryId,
  MemoryContent,
  ConfidenceScore,
  StorageLocation,
  MemoryProvenance,
  MemoryResponseMeta,
} from "@/lib/memory/canonical-contracts";
import {
  MemoryNotFoundError,
  MemoryAlreadyCanonicalError,
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
import { validateGroupId as canonicalValidateGroupId } from "@/lib/validation/group-id";
import { createProposalDedupChecker, getDedupThreshold, type ProposalCandidate } from "@/lib/dedup/proposal-dedup";
import { BudgetEnforcer } from "@/lib/budget/enforcer";
import { type SessionId, DEFAULT_BUDGET_CONFIG } from "@/lib/budget/types";
import {
  checkBudgetBeforeCall,
  updateBudgetAfterCall,
  createSessionId,
} from "@/lib/budget/middleware-integration";
import { BreakerManager } from "@/lib/circuit-breaker/manager";
import { shouldUseRuVector, searchWithFeedback } from "@/lib/ruvector/retrieval-adapter";

config();

// ── Neo4j DateTime → ISO string ──────────────────────────────────────────
// Neo4j driver returns temporal types as neo4j.DateTime objects, not ISO strings.
// Convert them so the API always returns plain strings.
function neo4jDateToISO(value: unknown): string {
  if (typeof value === "string") return value;
  if (value && typeof value === "object" && "year" in value) {
    // neo4j.DateTime — use the driver's toString() which produces ISO format
    if (typeof (value as { toString?: () => string }).toString === "function") {
      const str = (value as { toString: () => string }).toString();
      const parsed = new Date(str);
      if (!isNaN(parsed.getTime())) return parsed.toISOString();
    }
    // Fallback: manually construct from neo4j integer fields
    const d = value as Record<string, { low: number; high?: number }>;
    const get = (field: string): number => d[field]?.low ?? 0;
    return new Date(
      Date.UTC(get("year"), get("month") - 1, get("day"), get("hour"), get("minute"), get("second"), Math.floor(get("nanosecond") / 1_000_000))
    ).toISOString();
  }
  // Last resort
  return new Date(value as string | number).toISOString();
}

// ── Budget Enforcer & Circuit Breaker Setup ────────────────────────────────
//
// Fail-open design: if budget enforcer or circuit breaker can't initialize,
// requests pass through. Budget is only enforced on write operations.
// Circuit breakers wrap database calls, not tool handlers.

const BUDGET_ENABLED = process.env.BUDGET_ENABLED !== "false";
const BUDGET_MAX_RPM = parseInt(process.env.BUDGET_MAX_RPM || "60", 10);
const BUDGET_MAX_TOKENS_PER_HOUR = parseInt(process.env.BUDGET_MAX_TOKENS_PER_HOUR || "100000", 10);
const CIRCUIT_BREAKER_FAILURE_THRESHOLD = parseInt(process.env.CIRCUIT_BREAKER_FAILURE_THRESHOLD || "5", 10);
const CIRCUIT_BREAKER_RESET_TIMEOUT = parseInt(process.env.CIRCUIT_BREAKER_RESET_TIMEOUT || "30000", 10);

let budgetEnforcer: BudgetEnforcer | null = null;
let breakerManager: BreakerManager | null = null;

function getBudgetEnforcer(): BudgetEnforcer | null {
  if (!BUDGET_ENABLED) return null;
  try {
    if (!budgetEnforcer) {
      budgetEnforcer = new BudgetEnforcer({
        budgetConfig: {
          ...DEFAULT_BUDGET_CONFIG,
          defaults: {
            ...DEFAULT_BUDGET_CONFIG.defaults,
            maxTokens: BUDGET_MAX_TOKENS_PER_HOUR,
            maxToolCalls: BUDGET_MAX_RPM,
          },
        },
        enabled: true,
      });
    }
    return budgetEnforcer;
  } catch (error) {
    console.error("[budget] Failed to initialize budget enforcer, failing open:", error);
    return null;
  }
}

function getBreakerManager(): BreakerManager | null {
  try {
    if (!breakerManager) {
      breakerManager = new BreakerManager({
        defaultConfig: {
          errorThreshold: CIRCUIT_BREAKER_FAILURE_THRESHOLD,
          openTimeoutMs: CIRCUIT_BREAKER_RESET_TIMEOUT,
        },
        enableAutoRecovery: true,
        healthCheckIntervalMs: 30000,
        maxBreakersPerScope: 100,
      });
    }
    return breakerManager;
  } catch (error) {
    console.error("[circuit-breaker] Failed to initialize breaker manager, failing open:", error);
    return null;
  }
}

const activeSessions = new Map<string, SessionId>();

function ensureSession(groupId: string, agentId: string): SessionId | null {
  const enforcer = getBudgetEnforcer();
  if (!enforcer) return null;

  const sessionKey = `${groupId}:${agentId}`;
  const existing = activeSessions.get(sessionKey);
  if (existing) {
    if (enforcer.getSessionState(existing)) {
      return existing;
    }
    activeSessions.delete(sessionKey);
  }

  try {
    const sessionId = createSessionId(groupId, agentId, `mcp-${Date.now()}`);
    enforcer.startSession(sessionId);
    activeSessions.set(sessionKey, sessionId);
    return sessionId;
  } catch (error) {
    console.warn("[budget] Failed to start session, failing open:", error);
    return null;
  }
}

async function checkBudget(
  groupId: string,
  agentId: string,
  toolName: string,
): Promise<{ allowed: boolean; reason?: string; retryAfter?: number }> {
  const enforcer = getBudgetEnforcer();
  const sessionId = ensureSession(groupId, agentId);

  if (!enforcer || !sessionId) {
    return { allowed: true };
  }

  try {
    const budgetCheck = checkBudgetBeforeCall(enforcer, sessionId);
    if (!budgetCheck.allowed) {
      const halt = budgetCheck.haltReason;
      const retryAfter =
        halt?.type === "time_limit"
          ? Math.ceil((halt.limitMs - halt.elapsedMs) / 1000)
          : undefined;
      console.warn(
        `[budget] Budget exceeded for ${groupId}/${agentId} on ${toolName}: ${budgetCheck.reason}`,
      );
      return { allowed: false, reason: budgetCheck.reason, retryAfter };
    }
    return { allowed: true };
  } catch (error) {
    console.error("[budget] Budget check failed, failing open:", error);
    return { allowed: true };
  }
}

function recordToolCall(
  groupId: string,
  agentId: string,
  toolName: string,
  durationMs: number,
  success: boolean,
): void {
  const enforcer = getBudgetEnforcer();
  const sessionId = ensureSession(groupId, agentId);
  if (!enforcer || !sessionId) return;

  try {
    updateBudgetAfterCall(enforcer, sessionId, { toolName, durationMs, success });
  } catch (error) {
    console.warn("[budget] Failed to record tool call:", error);
  }
}

async function withCircuitBreaker<T>(
  breakerName: string,
  groupId: string,
  operation: string,
  fn: () => Promise<T>,
): Promise<T> {
  const manager = getBreakerManager();
  if (!manager) {
    return fn();
  }

  try {
    const { result, breakerResult } = await manager.executeThrough(
      breakerName,
      groupId,
      operation,
      fn,
    );

    if (!breakerResult.allowed) {
      throw new Error(
        `Circuit breaker open for ${breakerName}: ${breakerResult.rejectionReason}`,
      );
    }

    if (!breakerResult.success && breakerResult.error) {
      throw breakerResult.error;
    }

    return result as T;
  } catch (error) {
    if (
      error instanceof Error &&
      error.message.startsWith("Circuit breaker open")
    ) {
      console.warn(`[circuit-breaker] ${error.message}`);
    }
    throw error;
  }
}

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
  budgetEnforcer = null;
  breakerManager = null;
  activeSessions.clear();
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

/**
 * ARCH-001: Validate group_id using canonical module.
 * All entry points must enforce ^allura-[a-z0-9-]+$ pattern.
 */
function validateGroupId(groupId: string): GroupId {
  return canonicalValidateGroupId(groupId) as GroupId;
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
  userId: string | null | undefined,
  content: string
): Promise<MemoryId | null> {
  const session = neo4j.session();

  try {
    // Exact match check
    const result = await session.run(
      `
      MATCH (m:Memory)
      WHERE m.group_id = $groupId
        AND ($userId IS NULL OR m.user_id = $userId)
        AND m.content = $content
        AND NOT (m)<-[:SUPERSEDES]-()
      RETURN m.id AS id
      LIMIT 1
      `,
      { groupId, userId: userId ?? null, content }
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
  
  const groupId = validateGroupId(request.group_id);
  const agentId = request.metadata?.agent_id || "api";
  const memoryId = generateMemoryId();
  const createdAt = new Date().toISOString();
  const startTime = Date.now();

  // Budget pre-check: memory_add is write-intensive, enforce budget before proceeding
  const budgetResult = await checkBudget(groupId, agentId, "memory_add");
  if (!budgetResult.allowed) {
    return {
      id: memoryId,
      stored: "episodic",
      score: 0,
      created_at: createdAt,
      meta: {
        contract_version: "v1",
        degraded: true,
        stores_used: [],
        stores_attempted: [],
        warnings: [budgetResult.reason ?? "Budget exceeded"],
      },
    } satisfies MemoryAddResponse;
  }
  
  try {
    const { pg, neo4j } = await getConnections();
  
  // Write to PostgreSQL (episodic) — wrapped in circuit breaker
  const eventResult = await withCircuitBreaker("postgres", groupId, "memory_add:insert_event", async () =>
    pg.query(
    `INSERT INTO events (
      group_id, event_type, agent_id, status, metadata, created_at
    ) VALUES ($1, $2, $3, $4, $5, $6)
    RETURNING id`,
    [
      groupId,
      "memory_add",
      agentId,
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
  ));
  
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
    
    // Check for duplicates (only in auto mode) — circuit-breaker wrapped
    let duplicateId: MemoryId | null = null;
    try {
      duplicateId = await withCircuitBreaker("neo4j", groupId, "memory_add:duplicate_check", async () =>
        checkDuplicate(neo4j, groupId, request.user_id, request.content),
      );
    } catch (error) {
      if (error instanceof Error && error.message.startsWith("Circuit breaker open")) {
        throw error;
      }
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
      
      // Log promotion event — circuit-breaker wrapped
      await withCircuitBreaker("postgres", groupId, "memory_add:log_promotion", async () =>
        pg.query(
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
      ));
      
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
    // SOC2 mode: Queue for human approval with dedup check

    // Check for near-duplicate proposals before inserting
    const dedupThreshold = getDedupThreshold();
    const dedupChecker = createProposalDedupChecker(undefined, dedupThreshold);

    try {
      const existingRows = await pg.query<{ id: string; content: string; score: number; status: string; created_at: string }>(
        `SELECT id, content, score, status, created_at
         FROM canonical_proposals
         WHERE group_id = $1
           AND status IN ('pending', 'approved')
         ORDER BY created_at DESC
         LIMIT 100`,
        [groupId],
      );

      const existingProposals: ProposalCandidate[] = existingRows.rows.map((row) => ({
        id: row.id,
        content: row.content,
        score: Number(row.score),
        status: row.status,
        created_at: row.created_at,
      }));

      const dedupResult = dedupChecker.checkProposals(request.content, existingProposals);

      if (dedupResult.isDuplicate && dedupResult.existingProposal) {
        // Skip duplicate — log and return existing
        console.warn(
          `[dedup] Skipping duplicate proposal for group_id=${groupId}: ` +
          `similarity=${dedupResult.similarity.toFixed(4)} threshold=${dedupResult.threshold} ` +
          `existing_proposal_id=${dedupResult.existingProposal.id} ` +
          `new_content_preview="${request.content.slice(0, 80)}..."`,
        );

        return {
          id: memoryId,
          stored: "episodic",
          score,
          pending_review: true,
          created_at: createdAt,
          meta: baseMeta(["postgres"]),
          duplicate: true,
          duplicate_of: dedupResult.existingProposal.id,
          similarity: dedupResult.similarity,
        };
      }
    } catch (dedupError) {
      // Dedup check is non-blocking: log warning and proceed with insert
      console.warn("[dedup] Proposal dedup check failed, proceeding with insert:", dedupError);
    }

    // Skip proposal queue for load-test group_ids — test writes must not pollute HITL queue
    if (groupId.endsWith('-loadtest')) {
      return {
        id: memoryId,
        stored: "episodic",
        score,
        created_at: createdAt,
        meta: baseMeta(["postgres"]),
      };
    }

    // SOC2 mode: Queue for human approval — circuit-breaker wrapped PG insert
    await withCircuitBreaker("postgres", groupId, "memory_add:insert_proposal", async () =>
      pg.query(
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
      ));
    
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
  } finally {
    recordToolCall(groupId, agentId, "memory_add", Date.now() - startTime, true);
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
        created_at: neo4jDateToISO(record.get("created_at")),
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

  // --- RuVector conditional enrichment ---
  // Feature-flagged: only activates when RUVECTOR_ENABLED=true AND health check passes.
  // Fail-closed: if RuVector is unavailable, search continues with PG+Neo4j results only.
  let ruvectorResults: Array<{ id: string; content: string; score: number; source: string }> = [];
  let ruvectorTrajectoryId: string | undefined;

  try {
    if (await shouldUseRuVector()) {
      const ruvectorResult = await searchWithFeedback(groupId, request.query, {
        limit: request.limit ?? 10,
        threshold: 0.3, // Lower threshold for recall; canonical layer filters further
      });

      ruvectorTrajectoryId = ruvectorResult.trajectoryId;
      ruvectorResults = ruvectorResult.memories.map((m) => ({
        id: m.id,
        content: m.content,
        score: m.score,
        source: "ruvector",
      }));
    }
  } catch (ruvectorErr) {
    // RuVector failure is non-fatal — log and continue with PG+Neo4j results only
    console.warn(
      "[memory_search] RuVector enrichment failed, continuing with PG+Neo4j:",
      ruvectorErr instanceof Error ? ruvectorErr.message : String(ruvectorErr),
    );
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

  // Map RuVector results into canonical shape
  const ruvector = ruvectorResults.map((r) => ({
    id: r.id as MemoryId,
    content: r.content as MemoryContent,
    score: r.score as ConfidenceScore,
    source: "episodic" as StorageLocation, // RuVector is episodic storage
    provenance: "conversation" as MemoryProvenance,
    created_at: new Date().toISOString(), // RuVector doesn't return created_at in retrieveMemories
    usage_count: 0,
  }));
  
  // Combine and sort by score
  const results = [...semantic, ...episodic, ...ruvector]
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);
  
  const latency = Date.now() - startTime;

  // Build stores_used array based on what actually returned results
  const storesUsed: Array<"postgres" | "neo4j" | "ruvector"> = [];
  if (episodic.length > 0 || searchMeta.stores_used.includes("postgres")) {
    storesUsed.push("postgres");
  }
  if (semanticResults.length > 0 || searchMeta.stores_used.includes("neo4j")) {
    storesUsed.push("neo4j");
  }
  if (ruvectorResults.length > 0) {
    storesUsed.push("ruvector");
  }
  // Fallback: ensure at least the stores attempted are listed
  if (storesUsed.length === 0) {
    storesUsed.push(...searchMeta.stores_used);
  }

  return {
    results,
    count: results.length,
    latency_ms: latency,
    meta: {
      ...searchMeta,
      stores_used: storesUsed,
      ...(ruvectorTrajectoryId !== undefined
        ? { ruvector_trajectory_id: ruvectorTrajectoryId, ruvector_count: ruvectorResults.length }
        : {}),
    },
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
        created_at: neo4jDateToISO(record.get("created_at")),
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
           AND ($2::text IS NULL OR metadata->>'user_id' = $2)
           AND event_type = 'memory_add'
         ORDER BY created_at DESC
         LIMIT $3 OFFSET $4`;
    const [episodicResults, semanticResults] = await Promise.all([
      // PostgreSQL — throw on failure, do NOT swallow
      pg.query<EpisodicMemoryRow>(pgQuery, [groupId, request.user_id ?? null, limit, offset]),
      
      // Neo4j
        (async () => {
          const session = neo4jDriver.session();
          try {
             const result = await session.run(
               `MATCH (m:Memory)
                WHERE m.group_id = $groupId
                  AND ($userId IS NULL OR m.user_id = $userId)
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
               { groupId, userId: request.user_id ?? null, limit: neo4j.int(limit), offset: neo4j.int(offset) }
             );
            
            return result.records.map((record) => ({
              id: record.get("id") as MemoryId,
              content: record.get("content"),
              score: record.get("score"),
              source: "semantic" as const,
              provenance: toProvenance(record.get("provenance")),
              user_id: record.get("user_id"),
              created_at: neo4jDateToISO(record.get("created_at")),
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
  const startTime = Date.now();
  
  try {
    const { pg, neo4j } = await getConnections();
  
  // 1. Append deletion event to PostgreSQL — circuit-breaker wrapped
  await withCircuitBreaker("postgres", groupId, "memory_delete:insert_event", async () =>
    pg.query(
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
    )
  );
  
  // 2. Mark Neo4j node as deprecated (if exists) — secondary store, degradation acceptable
  let deleteMeta = baseMeta(["postgres", "neo4j"]);
  try {
    await withCircuitBreaker("neo4j", groupId, "memory_delete:mark_deprecated", async () => {
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
      } finally {
        await session.close();
      }
    });
  } catch (error) {
    if (error instanceof Error && error.message.startsWith("Circuit breaker open")) {
      throw error;
    }
    console.warn("[degraded] Neo4j unavailable in memory_delete:", error);
    deleteMeta = degradedMeta(["postgres"]);
  }
  
  recordToolCall(groupId, request.user_id, "memory_delete", Date.now() - startTime, true);

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

/**
 * 6. memory_update
 *
 * Append-only versioned update.
 * - Appends audit event to PostgreSQL (always, append-only)
 * - If memory exists in Neo4j: creates new node + SUPERSEDES relationship, marks old deprecated
 * - If episodic-only or Neo4j unavailable: returns stored='episodic' with degradedMeta
 * - PG errors fail loudly; Neo4j errors degrade gracefully
 */
export async function memory_update(request: MemoryUpdateRequest): Promise<MemoryUpdateResponse> {
  const groupId = validateGroupId(request.group_id);
  const newId = generateMemoryId();
  const updatedAt = new Date().toISOString();
  const agentId = String(request.metadata?.agent_id ?? request.user_id);
  const startTime = Date.now();

  try {
    const { pg, neo4j: neo4jDriver } = await getConnections();

    // 1. Append audit event to PostgreSQL (mandatory, append-only) — circuit-breaker wrapped
    await withCircuitBreaker("postgres", groupId, "memory_update:insert_event", async () =>
      pg.query(
        `INSERT INTO events (group_id, event_type, agent_id, status, metadata, created_at)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [
          groupId,
          "memory_update",
          agentId,
          "completed",
          JSON.stringify({
            new_memory_id: newId,
            previous_memory_id: request.id,
            user_id: request.user_id,
            content: request.content,
            reason: request.reason,
            ...request.metadata,
          }),
          updatedAt,
        ]
      )
    );

    // 2. Attempt Neo4j SUPERSEDES versioning — circuit-breaker wrapped
    try {
      return await withCircuitBreaker("neo4j", groupId, "memory_update:supersedes", async () => {
        const session = neo4jDriver.session();
        try {
          const existing = await session.run(
            `MATCH (v1:Memory)
             WHERE v1.id = $prevId
               AND v1.group_id = $groupId
               AND NOT (v1)<-[:SUPERSEDES]-()
             RETURN v1.version AS version`,
            { prevId: request.id, groupId }
          );

          if (existing.records.length === 0) {
            return {
              id: newId,
              previous_id: request.id as MemoryId,
              stored: "episodic" as const,
              version: 1,
              updated_at: updatedAt,
              meta: baseMeta(["postgres"]),
            };
          }

          const prevVersion: number = existing.records[0].get("version")?.toNumber?.() ?? 1;
          const newVersion = prevVersion + 1;

          await session.run(
            `MATCH (v1:Memory { id: $prevId, group_id: $groupId })
             CREATE (v2:Memory {
               id: $newId,
               group_id: $groupId,
               user_id: $userId,
               content: $content,
               score: v1.score,
               provenance: v1.provenance,
               version: $version,
               created_at: datetime($updatedAt),
               deprecated: false
             })
             CREATE (v2)-[:SUPERSEDES]->(v1)
             SET v1.deprecated = true
             SET v1:deprecated`,
            {
              prevId: request.id,
              newId,
              groupId,
              userId: request.user_id,
              content: request.content,
              version: neo4j.int(newVersion),
              updatedAt,
            }
          );

          return {
            id: newId,
            previous_id: request.id as MemoryId,
            stored: "semantic" as const,
            version: newVersion,
            updated_at: updatedAt,
            meta: baseMeta(["postgres", "neo4j"]),
          };
        } finally {
          await session.close();
        }
      });
    } catch (error) {
      if (error instanceof Error && error.message.startsWith("Circuit breaker open")) {
        throw error;
      }
      console.warn("[degraded] Neo4j unavailable in memory_update:", error);
      recordToolCall(groupId, agentId, "memory_update", Date.now() - startTime, true);
      return {
        id: newId,
        previous_id: request.id as MemoryId,
        stored: "episodic",
        version: 1,
        updated_at: updatedAt,
        meta: degradedMeta(["postgres"]),
      };
    }
  } catch (error) {
    if (error instanceof DatabaseUnavailableError || error instanceof DatabaseQueryError) {
      throw error;
    }
    if (error instanceof Error && (error as Error & { code?: string }).code) {
      throw classifyPostgresError(error, "memory_update", "INSERT memory_update event");
    }
    throw error;
  } finally {
    recordToolCall(groupId, agentId, "memory_update", Date.now() - startTime, true);
  }
}

/**
 * 7. memory_promote
 *
 * Request curator promotion for an episodic memory.
 * Never auto-promotes — always routes through canonical_proposals for HITL.
 * Idempotent: returns existing proposal_id if a pending proposal already exists.
 * Fails loudly on Neo4j errors (promotion must be observable).
 */
export async function memory_promote(request: MemoryPromoteRequest): Promise<MemoryPromoteResponse> {
  const groupId = validateGroupId(request.group_id);
  const queuedAt = new Date().toISOString();

  const { pg, neo4j: neo4jDriver } = await getConnections();

  // 1. Check if already canonical in Neo4j — fails loudly (no silent fallback)
  const neo4jSession = neo4jDriver.session();
  try {
    const canonicalCheck = await neo4jSession.run(
      `MATCH (m:Memory)
       WHERE m.id = $id
         AND m.group_id = $groupId
         AND NOT (m)<-[:SUPERSEDES]-()
         AND m.deprecated = false
       RETURN m.id AS id LIMIT 1`,
      { id: request.id, groupId }
    );
    if (canonicalCheck.records.length > 0) {
      return {
        id: request.id,
        proposal_id: "",
        status: "already_canonical",
        queued_at: queuedAt,
        meta: baseMeta(["neo4j"]),
      };
    }
  } finally {
    await neo4jSession.close();
  }

  // 2. Check for existing pending proposal (idempotency)
  const existingProposal = await pg.query<{ id: string }>(
    `SELECT id FROM canonical_proposals
     WHERE group_id = $1
       AND status = 'pending'
       AND content LIKE '%' || $2 || '%'
     LIMIT 1`,
    [groupId, request.id]
  );
  if (existingProposal.rows.length > 0) {
    return {
      id: request.id,
      proposal_id: existingProposal.rows[0].id,
      status: "queued",
      queued_at: queuedAt,
      meta: baseMeta(["postgres"]),
    };
  }

  // 3. Dedup: check for near-duplicate proposals using text similarity
  const dedupThreshold = getDedupThreshold();
  const dedupChecker = createProposalDedupChecker(undefined, dedupThreshold);

  // 4. Fetch memory content from PG
  const memoryRow = await pg.query<{ id: string; content: string; event_id: string }>(
    `SELECT metadata->>'memory_id' AS id,
            metadata->>'content' AS content,
            id AS event_id
     FROM events
     WHERE group_id = $1
       AND event_type = 'memory_add'
       AND metadata->>'memory_id' = $2
     ORDER BY created_at DESC
     LIMIT 1`,
    [groupId, request.id]
  );

  if (memoryRow.rows.length === 0) {
    throw new MemoryNotFoundError(request.id);
  }

  const { content, event_id } = memoryRow.rows[0];

  // 4. Score content
  const scoreResult = await curatorScore({
    content,
    source: "conversation",
    usageCount: 0,
    daysSinceCreated: 0,
  });

  // 4b. Dedup: check for near-duplicate proposals before inserting
  try {
    const dedupRows = await pg.query<{ id: string; content: string; score: number; status: string; created_at: string }>(
      `SELECT id, content, score, status, created_at
       FROM canonical_proposals
       WHERE group_id = $1
         AND status IN ('pending', 'approved')
       ORDER BY created_at DESC
       LIMIT 100`,
      [groupId],
    );

    const dedupCandidates: ProposalCandidate[] = dedupRows.rows.map((row) => ({
      id: row.id,
      content: row.content,
      score: Number(row.score),
      status: row.status,
      created_at: row.created_at,
    }));

    const dedupResult = dedupChecker.checkProposals(content, dedupCandidates);

    if (dedupResult.isDuplicate && dedupResult.existingProposal) {
      console.warn(
        `[dedup] Skipping duplicate promote proposal for group_id=${groupId}: ` +
        `similarity=${dedupResult.similarity.toFixed(4)} threshold=${dedupResult.threshold} ` +
        `existing_proposal_id=${dedupResult.existingProposal.id} ` +
        `content_preview="${content.slice(0, 80)}..."`,
      );

      return {
        id: request.id,
        proposal_id: dedupResult.existingProposal.id,
        status: "queued",
        queued_at: queuedAt,
        meta: baseMeta(["postgres"]),
      };
    }
  } catch (dedupErr) {
    console.warn("[dedup] Proposal dedup check failed in memory_promote, proceeding with insert:", dedupErr);
  }

  // 5. Insert proposal
  const proposalId = randomUUID();
  await pg.query(
    `INSERT INTO canonical_proposals
       (id, group_id, content, score, reasoning, tier, status, trace_ref, created_at)
     VALUES ($1, $2, $3, $4, $5, $6, 'pending', $7, $8)`,
    [
      proposalId,
      groupId,
      content,
      scoreResult.confidence,
      scoreResult.reasoning,
      scoreResult.tier,
      event_id,
      queuedAt,
    ]
  );

  // 6. Append audit event
  await pg.query(
    `INSERT INTO events (group_id, event_type, agent_id, status, metadata, created_at)
     VALUES ($1, $2, $3, $4, $5, $6)`,
    [
      groupId,
      "memory_promote_requested",
      request.curator_id ?? request.user_id,
      "completed",
      JSON.stringify({
        memory_id: request.id,
        proposal_id: proposalId,
        rationale: request.rationale,
        score: scoreResult.confidence,
      }),
      queuedAt,
    ]
  );

  return {
    id: request.id,
    proposal_id: proposalId,
    status: "queued",
    queued_at: queuedAt,
    meta: baseMeta(["postgres"]),
  };
}

/**
 * 8. memory_export
 *
 * Export memories filtered by group_id and optional canonical status.
 * canonical_only=true  → Neo4j only; throws DatabaseUnavailableError if Neo4j is down.
 * canonical_only=false → Both stores; deduplicates by memory_id (Neo4j wins).
 */
export async function memory_export(request: MemoryExportRequest): Promise<MemoryExportResponse> {
  const groupId = validateGroupId(request.group_id);
  const limit = Math.min(request.limit ?? 1000, 10000);
  const offset = request.offset ?? 0;
  const exportedAt = new Date().toISOString();

  const { pg, neo4j: neo4jDriver } = await getConnections();

  // Canonical memories from Neo4j
  let canonicalMemories: MemoryGetResponse[] = [];
  let neo4jFailed = false;

  const neo4jSession = neo4jDriver.session();
  try {
    const result = await neo4jSession.run(
      `MATCH (m:Memory)
       WHERE m.group_id = $groupId
         AND NOT (m)<-[:SUPERSEDES]-()
         AND m.deprecated = false
         AND ($userId IS NULL OR m.user_id = $userId)
       RETURN m.id AS id,
              m.content AS content,
              m.score AS score,
              m.provenance AS provenance,
              m.user_id AS user_id,
              m.created_at AS created_at,
              m.version AS version
       ORDER BY m.created_at DESC
       SKIP $offset
       LIMIT $limit`,
      {
        groupId,
        userId: request.user_id ?? null,
        offset: neo4j.int(offset),
        limit: neo4j.int(limit),
      }
    );

    canonicalMemories = result.records.map((record) => ({
      id: record.get("id") as MemoryId,
      content: record.get("content"),
      score: record.get("score"),
      source: "semantic" as const,
      provenance: toProvenance(record.get("provenance")),
      user_id: record.get("user_id"),
      created_at: neo4jDateToISO(record.get("created_at")),
      version: record.get("version")?.toNumber?.() ?? 1,
      usage_count: 0,
      meta: baseMeta(["neo4j"]),
    }));
  } catch (error) {
    if (request.canonical_only) {
      // canonical_only=true: no fallback — fail loudly
      throw new DatabaseUnavailableError("memory_export:neo4j", error instanceof Error ? error : undefined);
    }
    console.warn("[degraded] Neo4j unavailable in memory_export:", error);
    neo4jFailed = true;
  } finally {
    await neo4jSession.close();
  }

  if (request.canonical_only) {
    return {
      memories: canonicalMemories,
      count: canonicalMemories.length,
      exported_at: exportedAt,
      canonical_count: canonicalMemories.length,
      episodic_count: 0,
      meta: baseMeta(["neo4j"]),
    };
  }

  // Episodic memories from PostgreSQL
  const canonicalIds = new Set(canonicalMemories.map((m) => m.id));

  const pgResult = await pg.query<EpisodicMemoryRow>(
    `SELECT metadata->>'memory_id' AS id,
            metadata->>'content' AS content,
            metadata->>'source' AS provenance,
            metadata->>'user_id' AS user_id,
            created_at
     FROM events
     WHERE group_id = $1
       AND event_type = 'memory_add'
       AND ($2::text IS NULL OR metadata->>'user_id' = $2)
     ORDER BY created_at DESC
     LIMIT $3 OFFSET $4`,
    [groupId, request.user_id ?? null, limit, offset]
  );

  // Deduplicate: Neo4j wins on collision
  const episodicMemories: MemoryGetResponse[] = pgResult.rows
    .filter((row) => !canonicalIds.has(row.id as MemoryId))
    .map((row) => ({
      id: toMemoryId(row.id),
      content: row.content,
      score: 0.5,
      source: "episodic" as const,
      provenance: toProvenance(row.provenance),
      user_id: row.user_id ?? "",
      created_at: row.created_at,
      version: 1,
      usage_count: 0,
    }));

  const allMemories = [...canonicalMemories, ...episodicMemories];
  const exportMeta = neo4jFailed
    ? degradedMeta(["postgres"])
    : baseMeta(["postgres", "neo4j"]);

  return {
    memories: allMemories,
    count: allMemories.length,
    exported_at: exportedAt,
    canonical_count: canonicalMemories.length,
    episodic_count: episodicMemories.length,
    meta: exportMeta,
  };
}

// ── Export for MCP Server ─────────────────────────────────────────────────

export const canonicalMemoryTools = {
  memory_add,
  memory_search,
  memory_get,
  memory_list,
  memory_delete,
  memory_update,
  memory_promote,
  memory_export,
};

export { getBudgetEnforcer, getBreakerManager, ensureSession, checkBudget, recordToolCall, withCircuitBreaker };
