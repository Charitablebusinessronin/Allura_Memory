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

// ── Sub-module imports ────────────────────────────────────────────────────
import { getConnections, resetConnections } from "./canonical-tools/connection"
import {
  neo4jDateToISO,
  EpisodicMemoryRow,
  toMemoryId,
  toProvenance,
  parseEpisodicTags,
  getRecentUsageCount,
  baseMeta,
  degradedMeta,
  getPromotionMode,
  getAutoApprovalThreshold,
  DUPLICATE_THRESHOLD,
  RECOVERY_WINDOW_DAYS,
  validateGroupId,
  generateMemoryId,
  sortDedupedMemories,
} from "./canonical-tools/validation-utils"
import {
  getBudgetEnforcer,
  getBreakerManager,
  ensureSession,
  checkBudget,
  recordToolCall,
  withCircuitBreaker,
} from "./canonical-tools/budget-circuit"
import { checkDuplicate } from "./canonical-tools/duplicate-check"

// ── External imports ──────────────────────────────────────────────────────
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
  MemoryRestoreRequest,
  MemoryRestoreResponse,
  MemoryListDeletedRequest,
  MemoryListDeletedResponse,
  GroupId,
  MemoryId,
  MemoryContent,
  ConfidenceScore,
  StorageLocation,
  MemoryProvenance,
  MemoryResponseMeta,
} from "@/lib/memory/canonical-contracts"
import {
  MemoryNotFoundError,
  MemoryAlreadyCanonicalError,
  MemoryNotDeletedError,
  RecoveryWindowExpiredError,
} from "@/lib/memory/canonical-contracts"

import neo4j from "neo4j-driver"
import { randomUUID } from "crypto"
import { DatabaseUnavailableError, DatabaseQueryError, classifyPostgresError } from "@/lib/errors/database-errors"
import { curatorScore } from "@/lib/curator/score"
import { createProposalDedupChecker, getDedupThreshold, type ProposalCandidate } from "@/lib/dedup/proposal-dedup"
import { shouldUseRuVector, searchWithFeedback } from "@/lib/ruvector/retrieval-adapter"

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
  const PROMOTION_MODE = getPromotionMode()
  const AUTO_APPROVAL_THRESHOLD = getAutoApprovalThreshold()

  console.log(`[DEBUG memory_add] PROMOTION_MODE=${PROMOTION_MODE}, AUTO_APPROVAL_THRESHOLD=${AUTO_APPROVAL_THRESHOLD}`)

  const groupId = validateGroupId(request.group_id)
  const agentId = request.metadata?.agent_id || "api"
  const memoryId = generateMemoryId()
  const createdAt = new Date().toISOString()
  const startTime = Date.now()

  // Budget pre-check: memory_add is write-intensive, enforce budget before proceeding
  const budgetResult = await checkBudget(groupId, agentId, "memory_add")
  if (!budgetResult.allowed) {
    throw new Error(
      `Budget exceeded for ${agentId} in ${groupId}: ${budgetResult.reason ?? "rate limit reached"}. Memory was NOT stored.`
    )
  }

  try {
    const { pg, neo4j } = await getConnections()

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
      )
    )

    const eventId = eventResult.rows[0].id

    // 3. Score content
    // Map MemoryProvenance ('conversation'|'manual') to curatorScore source ('conversation'|'manually_added')
    const scoreSource: "conversation" | "manually_added" =
      request.metadata?.source === "manual" ? "manually_added" : "conversation"
    const scoreResult = await curatorScore({
      content: request.content,
      source: scoreSource,
      usageCount: 0,
      daysSinceCreated: 0,
    })
    const { confidence: score, reasoning, tier } = scoreResult
    const threshold = request.threshold || AUTO_APPROVAL_THRESHOLD

    // 4. Check promotion eligibility
    if (score < threshold) {
      // Below threshold: episodic only
      return {
        id: memoryId,
        stored: "episodic",
        score,
        created_at: createdAt,
        meta: baseMeta(["postgres"]),
      }
    }

    // Score meets threshold
    if (PROMOTION_MODE === "auto") {
      // Auto mode: Promote immediately

      // Check for duplicates (only in auto mode) — circuit-breaker wrapped
      let duplicateId: MemoryId | null = null
      try {
        duplicateId = await withCircuitBreaker("neo4j", groupId, "memory_add:duplicate_check", async () =>
          checkDuplicate(neo4j, groupId, request.user_id, request.content)
        )
      } catch (error) {
        if (error instanceof Error && error.message.startsWith("Circuit breaker open")) {
          throw error
        }
        console.warn("[degraded] Neo4j duplicate check unavailable in memory_add:", error)
        return {
          id: memoryId,
          stored: "episodic",
          score,
          created_at: createdAt,
          meta: degradedMeta(["postgres"]),
        }
      }

      if (duplicateId) {
        // Duplicate found: return existing ID
        return {
          id: duplicateId,
          stored: "semantic",
          score,
          created_at: createdAt,
          meta: baseMeta(["neo4j"]),
        }
      }

      // Promote to Neo4j
      const session = neo4j.session()
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
        )

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
          )
        )

        return {
          id: memoryId,
          stored: "both",
          score,
          created_at: createdAt,
        }
      } catch (error) {
        console.warn("[degraded] Neo4j promotion unavailable in memory_add:", error)
        return {
          id: memoryId,
          stored: "episodic",
          score,
          created_at: createdAt,
          meta: degradedMeta(["postgres"]),
        }
      } finally {
        await session.close()
      }
    } else {
      // SOC2 mode: Queue for human approval with dedup check

      // Check for near-duplicate proposals before inserting
      const dedupThreshold = getDedupThreshold()
      const dedupChecker = createProposalDedupChecker(undefined, dedupThreshold)

      try {
        const existingRows = await pg.query<{
          id: string
          content: string
          score: number
          status: string
          created_at: string
        }>(
          `SELECT id, content, score, status, created_at
         FROM canonical_proposals
         WHERE group_id = $1
           AND status IN ('pending', 'approved')
         ORDER BY created_at DESC
         LIMIT 100`,
          [groupId]
        )

        const existingProposals: ProposalCandidate[] = existingRows.rows.map((row) => ({
          id: row.id,
          content: row.content,
          score: Number(row.score),
          status: row.status,
          created_at: row.created_at,
        }))

        const dedupResult = dedupChecker.checkProposals(request.content, existingProposals)

        if (dedupResult.isDuplicate && dedupResult.existingProposal) {
          // Skip duplicate — log and return existing
          console.warn(
            `[dedup] Skipping duplicate proposal for group_id=${groupId}: ` +
              `similarity=${dedupResult.similarity.toFixed(4)} threshold=${dedupResult.threshold} ` +
              `existing_proposal_id=${dedupResult.existingProposal.id} ` +
              `new_content_preview="${request.content.slice(0, 80)}..."`
          )

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
          }
        }
      } catch (dedupError) {
        // Dedup check is non-blocking: log warning and proceed with insert
        console.warn("[dedup] Proposal dedup check failed, proceeding with insert:", dedupError)
      }

      // Skip proposal queue for load-test group_ids — test writes must not pollute HITL queue
      if (groupId.endsWith("-loadtest")) {
        return {
          id: memoryId,
          stored: "episodic",
          score,
          created_at: createdAt,
          meta: baseMeta(["postgres"]),
        }
      }

      // SOC2 mode: Queue for human approval — circuit-breaker wrapped PG insert
      await withCircuitBreaker("postgres", groupId, "memory_add:insert_proposal", async () =>
        pg.query(
          `INSERT INTO canonical_proposals (
          id, group_id, content, score, reasoning, tier, status, trace_ref, created_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
          [randomUUID(), groupId, request.content, score, reasoning, tier, "pending", eventId, createdAt]
        )
      )

      return {
        id: memoryId,
        stored: "episodic",
        score,
        pending_review: true,
        created_at: createdAt,
        meta: baseMeta(["postgres"]),
      }
    }
  } catch (error) {
    if (error instanceof DatabaseUnavailableError || error instanceof DatabaseQueryError) {
      throw error
    }
    if (error instanceof Error && (error as Error & { code?: string }).code) {
      throw classifyPostgresError(error, "memory_add", "INSERT events")
    }
    throw error
  } finally {
    recordToolCall(groupId, agentId, "memory_add", Date.now() - startTime, true)
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
  const groupId = validateGroupId(request.group_id)
  const limit = Math.floor(request.limit || 10)

  try {
    const { pg, neo4j: neo4jDriver } = await getConnections()
    const startTime = Date.now()

    // Parallel search both stores
    const episodicResults = await pg.query<EpisodicMemoryRow>(
      `SELECT metadata->>'memory_id' AS id, metadata->>'content' AS content, 
            metadata->>'source' AS provenance,
            metadata->>'tags' AS tags,
            created_at
      FROM events
     WHERE group_id = $1
       AND event_type = 'memory_add'
       AND ($2::text IS NULL OR metadata->>'user_id' = $2)
       AND metadata->>'content' ILIKE '%' || $3 || '%'
     ORDER BY created_at DESC
     LIMIT $4`,
      [groupId, request.user_id || null, request.query, limit]
    )

    let semanticResults: Array<{
      id: MemoryId
      content: string
      score: number
      provenance: MemoryProvenance
      created_at: string
      usage_count: number
      relevance: number
      tags: string[]
    }> = []
    let searchMeta = baseMeta(["postgres", "neo4j"])

    try {
      const session = neo4jDriver.session()
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
                m.tags AS tags,
                score AS relevance
         ORDER BY relevance DESC, m.score DESC
         LIMIT $limit`,
          {
            query: request.query,
            groupId,
            limit: neo4j.int(limit),
          }
        )

        semanticResults = result.records.map((record) => ({
          id: record.get("id") as MemoryId,
          content: record.get("content"),
          score: record.get("score"),
          provenance: toProvenance(record.get("provenance")),
          created_at: neo4jDateToISO(record.get("created_at")),
          usage_count: record.get("usage_count")?.toNumber?.() || 0,
          tags: record.get("tags") || [],
          relevance: record.get("relevance"),
        }))
      } finally {
        await session.close()
      }
    } catch (error) {
      console.warn("[degraded] Neo4j unavailable in memory_search:", error)
      searchMeta = degradedMeta(["postgres"])
    }

    // --- RuVector conditional enrichment ---
    // Feature-flagged: only activates when RUVECTOR_ENABLED=true AND health check passes.
    // Fail-closed: if RuVector is unavailable, search continues with PG+Neo4j results only.
    let ruvectorResults: Array<{ id: string; content: string; score: number; source: string }> = []
    let ruvectorTrajectoryId: string | undefined

    try {
      if (await shouldUseRuVector()) {
        const ruvectorResult = await searchWithFeedback(groupId, request.query, {
          limit: request.limit ?? 10,
          threshold: 0.3, // Lower threshold for recall; canonical layer filters further
        })

        ruvectorTrajectoryId = ruvectorResult.trajectoryId
        ruvectorResults = ruvectorResult.memories.map((m) => ({
          id: m.id,
          content: m.content,
          score: m.score,
          source: "ruvector",
        }))
      }
    } catch (ruvectorErr) {
      // RuVector failure is non-fatal — log and continue with PG+Neo4j results only
      console.warn(
        "[memory_search] RuVector enrichment failed, continuing with PG+Neo4j:",
        ruvectorErr instanceof Error ? ruvectorErr.message : String(ruvectorErr)
      )
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
      tags: parseEpisodicTags(row.tags),
    }))

    const semantic = semanticResults.map((item) => ({
      id: item.id,
      content: item.content,
      score: item.score,
      source: "semantic" as const,
      provenance: item.provenance,
      created_at: item.created_at,
      usage_count: item.usage_count,
      tags: item.tags,
    }))

    // Map RuVector results into canonical shape
    const ruvector = ruvectorResults.map((r) => ({
      id: r.id as MemoryId,
      content: r.content as MemoryContent,
      score: r.score as ConfidenceScore,
      source: "episodic" as StorageLocation, // RuVector is episodic storage
      provenance: "conversation" as MemoryProvenance,
      created_at: new Date().toISOString(), // RuVector doesn't return created_at in retrieveMemories
      usage_count: 0,
      tags: [] as string[],
    }))

    // Combine and sort by score
    const results = [...semantic, ...episodic, ...ruvector].sort((a, b) => b.score - a.score).slice(0, limit)

    const latency = Date.now() - startTime

    // Build stores_used array based on what actually returned results
    const storesUsed: Array<"postgres" | "neo4j" | "ruvector"> = []
    if (episodic.length > 0 || searchMeta.stores_used.includes("postgres")) {
      storesUsed.push("postgres")
    }
    if (semanticResults.length > 0 || searchMeta.stores_used.includes("neo4j")) {
      storesUsed.push("neo4j")
    }
    if (ruvectorResults.length > 0) {
      storesUsed.push("ruvector")
    }
    // Fallback: ensure at least the stores attempted are listed
    if (storesUsed.length === 0) {
      storesUsed.push(...searchMeta.stores_used)
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
    }
  } catch (error) {
    if (error instanceof DatabaseUnavailableError || error instanceof DatabaseQueryError) {
      throw error
    }
    if (error instanceof Error && (error as Error & { code?: string }).code) {
      throw classifyPostgresError(error, "memory_search", "SELECT events ILIKE")
    }
    throw error
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
  const groupId = validateGroupId(request.group_id)

  try {
    const { pg, neo4j } = await getConnections()

    // Try Neo4j first (semantic) - secondary store, degradation acceptable
    let getMeta = baseMeta(["postgres", "neo4j"])
    const session = neo4j.session()
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
              m.tags AS tags,
              m.deprecated AS deprecated`,
        { id: request.id, groupId }
      )

      if (result.records.length > 0) {
        const record = result.records[0]

        // Query recent usage from PG events table (uses migration-18 index)
        const recentUsage = await getRecentUsageCount(pg, groupId, request.id)

        return {
          id: record.get("id") as MemoryId,
          content: record.get("content"),
          score: record.get("score"),
          source: "semantic",
          provenance: toProvenance(record.get("provenance")),
          user_id: record.get("user_id"),
          created_at: neo4jDateToISO(record.get("created_at")),
          version: record.get("version")?.toNumber?.() || 1,
          usage_count: recentUsage ?? 0,
          recent_usage_count: recentUsage,
          tags: record.get("tags") || [],
          meta: getMeta,
        }
      }
    } catch (error) {
      console.warn("[degraded] Neo4j unavailable in memory_get:", error)
      getMeta = degradedMeta(["postgres"])
    } finally {
      await session.close()
    }

    // Fall back to PostgreSQL (episodic)
    const result = await pg.query<EpisodicMemoryRow>(
      `SELECT metadata->>'memory_id' AS id, metadata->>'content' AS content,
            metadata->>'source' AS provenance,
            metadata->>'user_id' AS user_id,
            metadata->>'tags' AS tags,
            created_at
     FROM events
     WHERE metadata->>'memory_id' = $1
       AND group_id = $2
       AND event_type = 'memory_add'`,
      [request.id, groupId]
    )

    if (result.rows.length === 0) {
      throw new MemoryNotFoundError(request.id)
    }

    const row = result.rows[0]

    // Query recent usage from PG events table (uses migration-18 index)
    const recentUsage = await getRecentUsageCount(pg, groupId, request.id)

    return {
      id: toMemoryId(row.id),
      content: row.content,
      score: 0.5, // Episodic memories don't have scores
      source: "episodic",
      provenance: toProvenance(row.provenance),
      user_id: row.user_id || "unknown",
      created_at: row.created_at,
      usage_count: recentUsage ?? 0,
      recent_usage_count: recentUsage,
      tags: parseEpisodicTags(row.tags),
      meta: getMeta,
    }
  } catch (error) {
    if (error instanceof DatabaseUnavailableError || error instanceof DatabaseQueryError) {
      throw error
    }
    if (error instanceof Error && (error as Error & { code?: string }).code) {
      throw classifyPostgresError(error, "memory_get", "SELECT events by memory_id")
    }
    throw error
  }
}

/**
 * 4. memory_list
 *
 * List all memories for a user within a tenant.
 * Returns from both stores, merged and sorted.
 *
 * Pagination strategy: fetch all matching records from both stores,
 * deduplicate by id, sort, then slice in application code.
 * This produces correct total counts and non-overlapping pages,
 * unlike per-store LIMIT/OFFSET which misses/duplicates promoted memories.
 *
 * TODO Phase 3: cursor-based pagination when total > 5000
 */
export async function memory_list(request: MemoryListRequest): Promise<MemoryListResponse> {
  // Validate
  const groupId = validateGroupId(request.group_id)
  const limit = request.limit || 50
  const offset = request.offset || 0
  const sort = request.sort || "created_at_desc"

  try {
    const { pg, neo4j: neo4jDriver } = await getConnections()

    // Parallel query both stores — no LIMIT/OFFSET; we paginate in application code
    let listMeta = baseMeta(["postgres", "neo4j"])

    // PG: fetch count + data (no LIMIT/OFFSET on data)
    const [pgCountResult, episodicResults, semanticResults] = await Promise.all([
      // Total count from PG
      pg.query<{ total_count: string }>(
        `SELECT COUNT(*) AS total_count
         FROM events
         WHERE group_id = $1
           AND ($2::text IS NULL OR metadata->>'user_id' = $2)
           AND event_type = 'memory_add'`,
        [groupId, request.user_id ?? null]
      ),

      // PG data (no LIMIT/OFFSET — all rows for merge)
      pg.query<EpisodicMemoryRow>(
        `SELECT metadata->>'memory_id' AS id, metadata->>'content' AS content,
                metadata->>'source' AS provenance,
                metadata->>'user_id' AS user_id,
                metadata->>'tags' AS tags,
                created_at
         FROM events
         WHERE group_id = $1
           AND ($2::text IS NULL OR metadata->>'user_id' = $2)
           AND event_type = 'memory_add'
         ORDER BY created_at DESC`,
        [groupId, request.user_id ?? null]
      ),

      // Neo4j — fetch all + count in one pass
      (async () => {
        const session = neo4jDriver.session()
        try {
          // Get total count from Neo4j
          const countResult = await session.run(
            `MATCH (m:Memory)
             WHERE m.group_id = $groupId
               AND ($userId IS NULL OR m.user_id = $userId)
               AND NOT (m)<-[:SUPERSEDES]-()
             RETURN count(m) AS total`,
            { groupId, userId: request.user_id ?? null }
          )
          const neo4jTotal = countResult.records[0]?.get("total")?.toNumber?.() ?? 0

          // Get all data (no SKIP/LIMIT — paginate in application code)
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
                        m.version AS version,
                        m.tags AS tags
                 ORDER BY m.created_at DESC`,
            { groupId, userId: request.user_id ?? null }
          )

          const memories = result.records.map((record) => ({
            id: record.get("id") as MemoryId,
            content: record.get("content"),
            score: record.get("score"),
            source: "semantic" as const,
            provenance: toProvenance(record.get("provenance")),
            user_id: record.get("user_id"),
            created_at: neo4jDateToISO(record.get("created_at")),
            version: record.get("version")?.toNumber?.() || 1,
            usage_count: 0,
            recent_usage_count: null as number | null,
            tags: record.get("tags") || [],
          }))

          return { memories, total: neo4jTotal }
        } catch (err) {
          console.warn("[degraded] Neo4j query error in memory_list:", err)
          listMeta = degradedMeta(["postgres"])
          return { memories: [], total: 0 }
        } finally {
          await session.close()
        }
      })(),
    ])

    // Map PG rows to canonical shape
    const episodic = episodicResults.rows.map((row) => ({
      id: toMemoryId(row.id),
      content: row.content,
      score: 0.5,
      source: "episodic" as const,
      provenance: toProvenance(row.provenance),
      user_id: row.user_id || "unknown",
      created_at: row.created_at,
      usage_count: 0,
      recent_usage_count: null as number | null,
      tags: parseEpisodicTags(row.tags),
    }))

    // Deduplicate by id (promoted memories exist in both stores;
    // when id collides, prefer semantic version which has score/version)
    const seen = new Set<string>()
    const deduped = [...semanticResults.memories, ...episodic].filter((m) => {
      if (seen.has(m.id)) return false
      seen.add(m.id)
      return true
    })

    // Sort according to sort param
    const sorted = sortDedupedMemories(deduped, sort)

    // Compute total across both stores after dedup
    const pgTotal = parseInt(pgCountResult.rows[0]?.total_count ?? "0", 10)
    const neo4jTotal = semanticResults.total
    // When both stores are up, total = deduped.length (most accurate).
    // In degraded mode (one store failed), use the available store's count
    // plus the other store's count as approximation.
    const total = listMeta.degraded
      ? pgTotal + neo4jTotal // approximate: can't dedup across failed store
      : deduped.length

    // Slice for requested page
    const page = sorted.slice(offset, offset + limit)
    const has_more = offset + limit < total

    return {
      memories: page,
      total,
      has_more,
      meta: listMeta,
    }
  } catch (error) {
    // Classify known database errors so callers can distinguish
    // "DB is down" from "query is broken" from "legitimate empty result"
    if (error instanceof DatabaseUnavailableError || error instanceof DatabaseQueryError) {
      throw error
    }
    // If it's a raw pg error from the query, classify it
    if (error instanceof Error && (error as Error & { code?: string }).code) {
      throw classifyPostgresError(error, "memory_list", "SELECT events")
    }
    console.error("memory_list error:", error)
    throw error
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
  const groupId = validateGroupId(request.group_id)
  const deletedAt = new Date().toISOString()
  const startTime = Date.now()

  try {
    const { pg, neo4j } = await getConnections()

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
    )

    // 2. Mark Neo4j node as deprecated (if exists) — secondary store, degradation acceptable
    let deleteMeta = baseMeta(["postgres", "neo4j"])
    try {
      await withCircuitBreaker("neo4j", groupId, "memory_delete:mark_deprecated", async () => {
        const session = neo4j.session()
        try {
          await session.run(
            `MATCH (m:Memory)
           WHERE m.id = $id
             AND m.group_id = $groupId
           SET m.deprecated = true,
               m.deleted_at = datetime($deletedAt)
           RETURN m.id AS id`,
            { id: request.id, groupId, deletedAt }
          )
        } finally {
          await session.close()
        }
      })
    } catch (error) {
      if (error instanceof Error && error.message.startsWith("Circuit breaker open")) {
        throw error
      }
      console.warn("[degraded] Neo4j unavailable in memory_delete:", error)
      deleteMeta = degradedMeta(["postgres"])
    }

    recordToolCall(groupId, request.user_id, "memory_delete", Date.now() - startTime, true)

    return {
      id: request.id,
      deleted: true,
      deleted_at: deletedAt,
      recovery_days: RECOVERY_WINDOW_DAYS,
      meta: deleteMeta,
    }
  } catch (error) {
    if (error instanceof DatabaseUnavailableError || error instanceof DatabaseQueryError) {
      throw error
    }
    if (error instanceof Error && (error as Error & { code?: string }).code) {
      throw classifyPostgresError(error, "memory_delete", "INSERT memory_delete event")
    }
    throw error
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
  const groupId = validateGroupId(request.group_id)
  const newId = generateMemoryId()
  const updatedAt = new Date().toISOString()
  const agentId = String(request.metadata?.agent_id ?? request.user_id)
  const startTime = Date.now()

  try {
    const { pg, neo4j: neo4jDriver } = await getConnections()

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
    )

    // 2. Attempt Neo4j SUPERSEDES versioning — circuit-breaker wrapped
    try {
      return await withCircuitBreaker("neo4j", groupId, "memory_update:supersedes", async () => {
        const session = neo4jDriver.session()
        try {
          const existing = await session.run(
            `MATCH (v1:Memory)
             WHERE v1.id = $prevId
               AND v1.group_id = $groupId
               AND NOT (v1)<-[:SUPERSEDES]-()
             RETURN v1.version AS version`,
            { prevId: request.id, groupId }
          )

          if (existing.records.length === 0) {
            return {
              id: newId,
              previous_id: request.id as MemoryId,
              stored: "episodic" as const,
              version: 1,
              updated_at: updatedAt,
              meta: baseMeta(["postgres"]),
            }
          }

          const prevVersion: number = existing.records[0].get("version")?.toNumber?.() ?? 1
          const newVersion = prevVersion + 1

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
          )

          return {
            id: newId,
            previous_id: request.id as MemoryId,
            stored: "semantic" as const,
            version: newVersion,
            updated_at: updatedAt,
            meta: baseMeta(["postgres", "neo4j"]),
          }
        } finally {
          await session.close()
        }
      })
    } catch (error) {
      if (error instanceof Error && error.message.startsWith("Circuit breaker open")) {
        throw error
      }
      console.warn("[degraded] Neo4j unavailable in memory_update:", error)
      recordToolCall(groupId, agentId, "memory_update", Date.now() - startTime, true)
      return {
        id: newId,
        previous_id: request.id as MemoryId,
        stored: "episodic",
        version: 1,
        updated_at: updatedAt,
        meta: degradedMeta(["postgres"]),
      }
    }
  } catch (error) {
    if (error instanceof DatabaseUnavailableError || error instanceof DatabaseQueryError) {
      throw error
    }
    if (error instanceof Error && (error as Error & { code?: string }).code) {
      throw classifyPostgresError(error, "memory_update", "INSERT memory_update event")
    }
    throw error
  } finally {
    recordToolCall(groupId, agentId, "memory_update", Date.now() - startTime, true)
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
  const groupId = validateGroupId(request.group_id)
  const queuedAt = new Date().toISOString()

  const { pg, neo4j: neo4jDriver } = await getConnections()

  // 1. Check if already canonical in Neo4j — fails loudly (no silent fallback)
  const neo4jSession = neo4jDriver.session()
  try {
    const canonicalCheck = await neo4jSession.run(
      `MATCH (m:Memory)
       WHERE m.id = $id
         AND m.group_id = $groupId
         AND NOT (m)<-[:SUPERSEDES]-()
         AND m.deprecated = false
       RETURN m.id AS id LIMIT 1`,
      { id: request.id, groupId }
    )
    if (canonicalCheck.records.length > 0) {
      return {
        id: request.id,
        proposal_id: "",
        status: "already_canonical",
        queued_at: queuedAt,
        meta: baseMeta(["neo4j"]),
      }
    }
  } finally {
    await neo4jSession.close()
  }

  // 2. Check for existing pending proposal (idempotency)
  const existingProposal = await pg.query<{ id: string }>(
    `SELECT id FROM canonical_proposals
     WHERE group_id = $1
       AND status = 'pending'
       AND content LIKE '%' || $2 || '%'
     LIMIT 1`,
    [groupId, request.id]
  )
  if (existingProposal.rows.length > 0) {
    return {
      id: request.id,
      proposal_id: existingProposal.rows[0].id,
      status: "queued",
      queued_at: queuedAt,
      meta: baseMeta(["postgres"]),
    }
  }

  // 3. Dedup: check for near-duplicate proposals using text similarity
  const dedupThreshold = getDedupThreshold()
  const dedupChecker = createProposalDedupChecker(undefined, dedupThreshold)

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
  )

  if (memoryRow.rows.length === 0) {
    throw new MemoryNotFoundError(request.id)
  }

  const { content, event_id } = memoryRow.rows[0]

  // 4. Score content
  const scoreResult = await curatorScore({
    content,
    source: "conversation",
    usageCount: 0,
    daysSinceCreated: 0,
  })

  // 4b. Dedup: check for near-duplicate proposals before inserting
  try {
    const dedupRows = await pg.query<{
      id: string
      content: string
      score: number
      status: string
      created_at: string
    }>(
      `SELECT id, content, score, status, created_at
       FROM canonical_proposals
       WHERE group_id = $1
         AND status IN ('pending', 'approved')
       ORDER BY created_at DESC
       LIMIT 100`,
      [groupId]
    )

    const dedupCandidates: ProposalCandidate[] = dedupRows.rows.map((row) => ({
      id: row.id,
      content: row.content,
      score: Number(row.score),
      status: row.status,
      created_at: row.created_at,
    }))

    const dedupResult = dedupChecker.checkProposals(content, dedupCandidates)

    if (dedupResult.isDuplicate && dedupResult.existingProposal) {
      console.warn(
        `[dedup] Skipping duplicate promote proposal for group_id=${groupId}: ` +
          `similarity=${dedupResult.similarity.toFixed(4)} threshold=${dedupResult.threshold} ` +
          `existing_proposal_id=${dedupResult.existingProposal.id} ` +
          `content_preview="${content.slice(0, 80)}..."`
      )

      return {
        id: request.id,
        proposal_id: dedupResult.existingProposal.id,
        status: "queued",
        queued_at: queuedAt,
        meta: baseMeta(["postgres"]),
      }
    }
  } catch (dedupErr) {
    console.warn("[dedup] Proposal dedup check failed in memory_promote, proceeding with insert:", dedupErr)
  }

  // 5. Insert proposal
  const proposalId = randomUUID()
  await pg.query(
    `INSERT INTO canonical_proposals
       (id, group_id, content, score, reasoning, tier, status, trace_ref, created_at)
     VALUES ($1, $2, $3, $4, $5, $6, 'pending', $7, $8)`,
    [proposalId, groupId, content, scoreResult.confidence, scoreResult.reasoning, scoreResult.tier, event_id, queuedAt]
  )

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
  )

  return {
    id: request.id,
    proposal_id: proposalId,
    status: "queued",
    queued_at: queuedAt,
    meta: baseMeta(["postgres"]),
  }
}

/**
 * 8. memory_export
 *
 * Export memories filtered by group_id and optional canonical status.
 * canonical_only=true  → Neo4j only; throws DatabaseUnavailableError if Neo4j is down.
 * canonical_only=false → Both stores; deduplicates by memory_id (Neo4j wins).
 */
export async function memory_export(request: MemoryExportRequest): Promise<MemoryExportResponse> {
  const groupId = validateGroupId(request.group_id)
  const limit = Math.min(request.limit ?? 1000, 10000)
  const offset = request.offset ?? 0
  const exportedAt = new Date().toISOString()

  const { pg, neo4j: neo4jDriver } = await getConnections()

  // Canonical memories from Neo4j
  let canonicalMemories: MemoryGetResponse[] = []
  let neo4jFailed = false

  const neo4jSession = neo4jDriver.session()
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
              m.version AS version,
              m.tags AS tags
       ORDER BY m.created_at DESC
       SKIP $offset
       LIMIT $limit`,
      {
        groupId,
        userId: request.user_id ?? null,
        offset: neo4j.int(offset),
        limit: neo4j.int(limit),
      }
    )

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
      recent_usage_count: null as number | null,
      tags: record.get("tags") || [],
      meta: baseMeta(["neo4j"]),
    }))
  } catch (error) {
    if (request.canonical_only) {
      // canonical_only=true: no fallback — fail loudly
      throw new DatabaseUnavailableError("memory_export:neo4j", error instanceof Error ? error : undefined)
    }
    console.warn("[degraded] Neo4j unavailable in memory_export:", error)
    neo4jFailed = true
  } finally {
    await neo4jSession.close()
  }

  if (request.canonical_only) {
    return {
      memories: canonicalMemories,
      count: canonicalMemories.length,
      exported_at: exportedAt,
      canonical_count: canonicalMemories.length,
      episodic_count: 0,
      meta: baseMeta(["neo4j"]),
    }
  }

  // Episodic memories from PostgreSQL
  const canonicalIds = new Set(canonicalMemories.map((m) => m.id))

  const pgResult = await pg.query<EpisodicMemoryRow>(
    `SELECT metadata->>'memory_id' AS id,
            metadata->>'content' AS content,
            metadata->>'source' AS provenance,
            metadata->>'user_id' AS user_id,
            metadata->>'tags' AS tags,
            created_at
     FROM events
     WHERE group_id = $1
       AND event_type = 'memory_add'
       AND ($2::text IS NULL OR metadata->>'user_id' = $2)
     ORDER BY created_at DESC
     LIMIT $3 OFFSET $4`,
    [groupId, request.user_id ?? null, limit, offset]
  )

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
      recent_usage_count: null as number | null,
      tags: parseEpisodicTags(row.tags),
    }))

  const allMemories = [...canonicalMemories, ...episodicMemories]
  const exportMeta = neo4jFailed ? degradedMeta(["postgres"]) : baseMeta(["postgres", "neo4j"])

  return {
    memories: allMemories,
    count: allMemories.length,
    exported_at: exportedAt,
    canonical_count: canonicalMemories.length,
    episodic_count: episodicMemories.length,
    meta: exportMeta,
  }
}

// ── 9. memory_restore ────────────────────────────────────────────────────────

/**
 * Restore a soft-deleted memory within the recovery window (30 days).
 *
 * Flow:
 * 1. Find delete event in PostgreSQL within recovery window
 * 2. Remove deprecated flag + SUPERSEDES relationship in Neo4j
 * 3. Append restore event to PostgreSQL (append-only, no UPDATE)
 * 4. Return restore confirmation
 *
 * Constraints:
 * - No UPDATE on PostgreSQL events table (append-only)
 * - RESTORE appends event_type='memory_restore' row
 * - Neo4j: REMOVE m.deprecated, REMOVE m:deprecated label
 * - group_id scoped on every query
 */
export async function memory_restore(request: MemoryRestoreRequest): Promise<MemoryRestoreResponse> {
  const groupId = validateGroupId(request.group_id)
  const restoredAt = new Date().toISOString()
  const startTime = Date.now()

  try {
    const { pg, neo4j } = await getConnections()

    // 1. Verify memory was deleted within the recovery window
    const deleteEventResult = await withCircuitBreaker(
      "postgres",
      groupId,
      "memory_restore:find_delete_event",
      async () =>
        pg.query<{ id: string; created_at: string; metadata: Record<string, unknown> }>(
          `SELECT id, created_at, metadata
         FROM events
         WHERE group_id = $1
           AND event_type = 'memory_delete'
           AND metadata->>'memory_id' = $2
           AND created_at >= NOW() - INTERVAL '${RECOVERY_WINDOW_DAYS} days'
         ORDER BY created_at DESC
         LIMIT 1`,
          [groupId, request.id]
        )
    )

    if (deleteEventResult.rows.length === 0) {
      // Check if a memory_delete event exists at all (outside window = expired)
      const anyDeleteResult = await withCircuitBreaker(
        "postgres",
        groupId,
        "memory_restore:find_any_delete",
        async () =>
          pg.query<{ id: string }>(
            `SELECT id FROM events WHERE group_id = $1 AND event_type = 'memory_delete' AND metadata->>'memory_id' = $2 LIMIT 1`,
            [groupId, request.id]
          )
      )

      if (anyDeleteResult.rows.length === 0) {
        throw new MemoryNotDeletedError(request.id)
      }
      throw new RecoveryWindowExpiredError(request.id)
    }

    // 2. Restore in Neo4j — remove deprecated flag and label
    let restoreMeta = baseMeta(["postgres", "neo4j"])
    try {
      await withCircuitBreaker("neo4j", groupId, "memory_restore:restore_node", async () => {
        const session = neo4j.session()
        try {
          // Remove SUPERSEDES relationship pointing TO this memory (if any)
          // and remove deprecated flag and label
          await session.run(
            `MATCH (m:Memory)
             WHERE m.id = $id
               AND m.group_id = $groupId
             REMOVE m.deprecated
             REMOVE m:deprecated
             WITH m
             OPTIONAL MATCH (newer)-[r:SUPERSEDES]->(m)
             DELETE r
             SET m.restored_at = datetime($restoredAt)
             RETURN m.id AS id`,
            { id: request.id, groupId, restoredAt }
          )
        } finally {
          await session.close()
        }
      })
    } catch (error) {
      if (error instanceof Error && error.message.startsWith("Circuit breaker open")) {
        throw error
      }
      console.warn("[degraded] Neo4j unavailable in memory_restore:", error)
      restoreMeta = degradedMeta(["postgres"])
    }

    // 3. Append restore event to PostgreSQL (append-only)
    await withCircuitBreaker("postgres", groupId, "memory_restore:insert_event", async () =>
      pg.query(
        `INSERT INTO events (group_id, event_type, agent_id, status, metadata, created_at)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [
          groupId,
          "memory_restore",
          request.user_id,
          "completed",
          JSON.stringify({
            memory_id: request.id,
            user_id: request.user_id,
            deleted_at: deleteEventResult.rows[0].created_at,
          }),
          restoredAt,
        ]
      )
    )

    recordToolCall(groupId, request.user_id, "memory_restore", Date.now() - startTime, true)

    return {
      id: request.id,
      restored: true,
      restored_at: restoredAt,
      meta: restoreMeta,
    }
  } catch (error) {
    if (error instanceof MemoryNotDeletedError || error instanceof RecoveryWindowExpiredError) {
      throw error
    }
    if (error instanceof DatabaseUnavailableError || error instanceof DatabaseQueryError) {
      throw error
    }
    if (error instanceof Error && (error as Error & { code?: string }).code) {
      throw classifyPostgresError(error, "memory_restore", "SELECT/INSERT events")
    }
    throw error
  }
}

// ── 10. memory_list_deleted ──────────────────────────────────────────────────

/**
 * List soft-deleted memories within the 30-day recovery window.
 *
 * Flow:
 * 1. Query PostgreSQL for memory_delete events within recovery window
 * 2. For each deleted memory, find the most recent memory_add event (pre-deletion content)
 * 3. Cross-reference Neo4j for semantic memories that are deprecated
 * 4. Return list with recovery_days_remaining
 *
 * Constraints:
 * - group_id scoped on every query
 * - No UPDATE on PostgreSQL events table (append-only)
 * - Only events within recovery window
 */
export async function memory_list_deleted(request: MemoryListDeletedRequest): Promise<MemoryListDeletedResponse> {
  const groupId = validateGroupId(request.group_id)
  const limit = request.limit || 50
  const offset = request.offset || 0

  try {
    const { pg, neo4j: neo4jDriver } = await getConnections()

    let listMeta = baseMeta(["postgres", "neo4j"])

    // 1. Find memory_delete events within the recovery window, grouped by memory_id
    const deleteEventsResult = await withCircuitBreaker(
      "postgres",
      groupId,
      "memory_list_deleted:find_deletes",
      async () =>
        pg.query<{ memory_id: string; user_id: string; deleted_at: string }>(
          `SELECT DISTINCT ON (metadata->>'memory_id')
           metadata->>'memory_id' AS memory_id,
           metadata->>'user_id' AS user_id,
           created_at AS deleted_at
         FROM events
         WHERE group_id = $1
           AND event_type = 'memory_delete'
           AND ($2::text IS NULL OR metadata->>'user_id' = $2)
           AND created_at >= NOW() - INTERVAL '${RECOVERY_WINDOW_DAYS} days'
         ORDER BY metadata->>'memory_id', created_at DESC`,
          [groupId, request.user_id ?? null]
        )
    )

    if (deleteEventsResult.rows.length === 0) {
      return { memories: [], total: 0, has_more: false, meta: listMeta }
    }

    // 2. For each deleted memory, find the pre-deletion content from the most recent memory_add event
    const deletedMemoryIds = deleteEventsResult.rows.map((r) => r.memory_id)

    // Build memory content lookup from PG add events
    const addEventsResult = await withCircuitBreaker(
      "postgres",
      groupId,
      "memory_list_deleted:find_add_events",
      async () =>
        pg.query<{
          memory_id: string
          content: string
          source: string
          provenance: string
          user_id: string
          created_at: string
          score: string
          tags: string
        }>(
          `SELECT DISTINCT ON (metadata->>'memory_id')
           metadata->>'memory_id' AS memory_id,
           metadata->>'content' AS content,
           metadata->>'source' AS source,
           metadata->>'provenance' AS provenance,
           metadata->>'user_id' AS user_id,
           created_at,
           metadata->>'score' AS score,
           metadata->>'tags' AS tags
         FROM events
         WHERE group_id = $1
           AND event_type = 'memory_add'
           AND metadata->>'memory_id' = ANY($2)
         ORDER BY metadata->>'memory_id', created_at DESC`,
          [groupId, deletedMemoryIds]
        )
    )

    const addByMemoryId = new Map(addEventsResult.rows.map((r) => [r.memory_id, r]))

    // 3. Cross-reference Neo4j for deprecated memories
    let neo4jMemories: Map<
      string,
      {
        content: string
        score: number
        provenance: string
        user_id: string
        created_at: string
        version: number
        tags: string[]
      }
    > = new Map()
    try {
      const session = neo4jDriver.session()
      try {
        const neo4jResult = await session.run(
          `MATCH (m:Memory)
           WHERE m.group_id = $groupId
             AND m.id IN $ids
             AND m.deprecated = true
           RETURN m.id AS id,
                  m.content AS content,
                  m.score AS score,
                  m.provenance AS provenance,
                  m.user_id AS user_id,
                  m.created_at AS created_at,
                  m.version AS version,
                  m.tags AS tags`,
          { groupId, ids: deletedMemoryIds }
        )

        neo4jMemories = new Map(
          neo4jResult.records.map((record) => [
            record.get("id") as string,
            {
              content: record.get("content"),
              score: record.get("score")?.toNumber?.() ?? 0.5,
              provenance: record.get("provenance"),
              user_id: record.get("user_id"),
              created_at: neo4jDateToISO(record.get("created_at")),
              version: record.get("version")?.toNumber?.() ?? 1,
              tags: record.get("tags") || [],
            },
          ])
        )
      } finally {
        await session.close()
      }
    } catch (error) {
      console.warn("[degraded] Neo4j unavailable in memory_list_deleted:", error)
      listMeta = degradedMeta(["postgres"])
    }

    // 4. Merge PG and Neo4j results — prefer Neo4j when available
    const now = Date.now()
    const memories = deleteEventsResult.rows
      .map((delRow) => {
        const addRow = addByMemoryId.get(delRow.memory_id)
        const neo4jData = neo4jMemories.get(delRow.memory_id)

        const content = neo4jData?.content ?? addRow?.content ?? "(content unavailable)"
        const provenance = toProvenance(neo4jData?.provenance ?? addRow?.provenance)
        const userId = neo4jData?.user_id ?? addRow?.user_id ?? delRow.user_id ?? "unknown"
        const createdAt = neo4jData?.created_at ?? addRow?.created_at ?? delRow.deleted_at
        const score = (neo4jData?.score ?? parseFloat(addRow?.score ?? "0.5")) || 0.5
        const version = neo4jData?.version ?? 1
        const tags = neo4jData?.tags ?? parseEpisodicTags(addRow?.tags ?? null)
        const source: StorageLocation = neo4jData ? "semantic" : "episodic"

        const deletedAtDate = new Date(delRow.deleted_at)
        const recoveryDeadline = new Date(deletedAtDate.getTime() + RECOVERY_WINDOW_DAYS * 24 * 60 * 60 * 1000)
        const daysRemaining = Math.max(0, Math.ceil((recoveryDeadline.getTime() - now) / (24 * 60 * 60 * 1000)))

        return {
          id: delRow.memory_id as MemoryId,
          content: content as MemoryContent,
          source,
          provenance,
          user_id: userId,
          created_at: createdAt,
          deleted_at: delRow.deleted_at,
          recovery_days_remaining: daysRemaining,
          score: score as ConfidenceScore,
          tags,
          version,
        }
      })
      .filter((m) => m.content !== "(content unavailable)" || neo4jMemories.has(m.id as string))
      .sort((a, b) => new Date(b.deleted_at).getTime() - new Date(a.deleted_at).getTime())

    const total = memories.length
    const page = memories.slice(offset, offset + limit)
    const has_more = offset + limit < total

    return {
      memories: page,
      total,
      has_more,
      meta: listMeta,
    }
  } catch (error) {
    if (error instanceof DatabaseUnavailableError || error instanceof DatabaseQueryError) {
      throw error
    }
    if (error instanceof Error && (error as Error & { code?: string }).code) {
      throw classifyPostgresError(error, "memory_list_deleted", "SELECT events")
    }
    throw error
  }
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
  memory_restore,
  memory_list_deleted,
}

export { getBudgetEnforcer, getBreakerManager, ensureSession, checkBudget, recordToolCall, withCircuitBreaker }

export { resetConnections }