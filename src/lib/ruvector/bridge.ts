/**
 * RuVector MCP Bridge Module
 *
 * Connects the existing canonical MCP tools to RuVector's vector
 * search capabilities. Provides three primary functions:
 *
 * 1. storeMemory()     — Insert memory with tenant isolation
 * 2. retrieveMemories()— Text search (ts_rank) with trajectory tracking
 * 3. postFeedback()    — SONA feedback loop for relevance learning
 *
 * Key constraints:
 * - Server-only: throws if imported in browser
 * - Uses existing getRuVectorPool() from connection.ts (no duplicate pool)
 * - Parameterized queries ONLY (no string interpolation)
 * - group_id validation: ^allura-[a-z0-9-]+$
 * - Embedding column type is ruvector(384) in PG (NULL until embedding service)
 * - Memory IDs are BIGSERIAL (stringified); feedback IDs are UUID v4
 */

// Server-only guard
if (typeof window !== "undefined") {
  throw new Error("RuVector bridge module can only be used server-side");
}

import { randomUUID } from "node:crypto";
import type { Pool, QueryResult } from "pg";

import { getRuVectorPool, isRuVectorEnabled, checkRuVectorHealth } from "./connection";
import { validateGroupId } from "../validation/group-id";
import { GroupIdValidationError } from "../validation/group-id";
import { DatabaseUnavailableError, DatabaseQueryError, classifyPostgresError } from "../errors/database-errors";
import type {
  StoreMemoryParams,
  StoreMemoryResult,
  RetrieveMemoriesParams,
  RetrieveMemoriesResult,
  RetrievedMemory,
  PostFeedbackParams,
  RuVectorReadinessResult,
  RuVectorMemoryType,
  AlluraMemoryRow,
} from "./types";

// ── Bridge-Specific Errors ───────────────────────────────────────────────────

/**
 * Thrown when input validation fails for bridge function parameters.
 * Distinguished from DatabaseQueryError so callers can distinguish
 * "bad input" (400) from "query failed" (500).
 */
export class RuVectorBridgeValidationError extends Error {
  public readonly field: string;

  constructor(field: string, message: string) {
    super(message);
    this.name = "RuVectorBridgeValidationError";
    this.field = field;
  }
}

// ── Constants ────────────────────────────────────────────────────────────────

/** Default retrieval limit */
const DEFAULT_LIMIT = 10;

/** Default minimum similarity threshold */
const DEFAULT_THRESHOLD = 0.5;

/** Table name for memories */
const MEMORIES_TABLE = "allura_memories";

/** Table name for SONA feedback */
const FEEDBACK_TABLE = "allura_feedback";

// ── storeMemory ─────────────────────────────────────────────────────────────

/**
 * Store a memory in RuVector with tenant isolation.
 *
 * Validates group_id, inserts into allura_memories with NULL embedding
 * (embedding generation comes later), and returns the stored memory ID.
 *
 * @param params - Memory storage parameters
 * @returns Store result with ID and status
 * @throws GroupIdValidationError if userId doesn't match ^allura-[a-z0-9-]+$
 * @throws DatabaseUnavailableError if RuVector is unreachable
 * @throws DatabaseQueryError if the insert fails
 */
export async function storeMemory(
  params: StoreMemoryParams
): Promise<StoreMemoryResult> {
  const { userId, sessionId, content, memoryType = "episodic", metadata = {} } = params;

  // Validate group_id (userId maps to group_id per ARCH-001)
  const groupId = validateGroupId(userId);

  // Validate content is non-empty
  if (!content || content.trim().length === 0) {
    throw new RuVectorBridgeValidationError("content", "content must be a non-empty string");
  }

  // Validate sessionId is non-empty
  if (!sessionId || sessionId.trim().length === 0) {
    throw new RuVectorBridgeValidationError("sessionId", "sessionId must be a non-empty string");
  }

  let pool: Pool;
  try {
    pool = getRuVectorPool();
  } catch (error) {
    throw new DatabaseUnavailableError(
      "storeMemory: failed to get RuVector pool",
      error instanceof Error ? error : undefined
    );
  }

  // NOTE(ARCH-001): In Allura's tenant model, userId IS the group_id (tenant).
  // Both user_id and group_id columns receive the same validated value.
  // A future iteration may separate these when per-user isolation within a
  // tenant is needed. Until then: user_id = group_id = validated groupId.
  let result: QueryResult;
  try {
    result = await pool.query(
      `INSERT INTO ${MEMORIES_TABLE}
         (user_id, session_id, content, memory_type, embedding, metadata, group_id)
       VALUES ($1, $2, $3, $4, $5, $6::jsonb, $7)
       RETURNING id, created_at`,
      [
        groupId,  // user_id — same as group_id per ARCH-001 tenant model
        sessionId,
        content,
        memoryType,
        null, // embedding is NULL until embedding service is integrated
        JSON.stringify(metadata),
        groupId,  // group_id — validated ^allura-[a-z0-9-]+$
      ]
    );
  } catch (error) {
    const classified = classifyPostgresError(
      error instanceof Error ? error : new Error(String(error)),
      "storeMemory",
      `INSERT INTO ${MEMORIES_TABLE}`
    );
    throw classified;
  }

  const row = result.rows[0];
  return {
    id: String(row.id),
    status: "stored_pending_embedding",
    createdAt: row.created_at instanceof Date ? row.created_at.toISOString() : String(row.created_at),
    groupId,
  };
}

// ── retrieveMemories ─────────────────────────────────────────────────────────

/**
 * Retrieve memories using text search (ts_rank).
 *
 * In the initial version, this uses PostgreSQL full-text search with
 * to_tsvector/plainto_tsquery. Vector similarity search will be added
 * when embedding generation is integrated.
 *
 * Returns a trajectoryId for SONA feedback correlation.
 *
 * @param params - Retrieval parameters
 * @returns Search results with trajectory ID
 * @throws GroupIdValidationError if userId doesn't match ^allura-[a-z0-9-]+$
 * @throws DatabaseUnavailableError if RuVector is unreachable
 * @throws DatabaseQueryError if the query fails
 */
export async function retrieveMemories(
  params: RetrieveMemoriesParams
): Promise<RetrieveMemoriesResult> {
  const {
    userId,
    query,
    limit = DEFAULT_LIMIT,
    threshold = DEFAULT_THRESHOLD,
  } = params;

  // Validate group_id (userId maps to group_id per ARCH-001)
  const groupId = validateGroupId(userId);

  // Validate query is non-empty
  if (!query || query.trim().length === 0) {
    throw new RuVectorBridgeValidationError("query", "query must be a non-empty string");
  }

  // Validate limit bounds
  if (limit < 1 || limit > 100) {
    throw new RuVectorBridgeValidationError("limit", "limit must be between 1 and 100");
  }

  // Validate threshold bounds
  if (threshold < 0 || threshold > 1) {
    throw new RuVectorBridgeValidationError("threshold", "threshold must be between 0.0 and 1.0");
  }

  const trajectoryId = randomUUID();
  const startTime = Date.now();

  let pool: Pool;
  try {
    pool = getRuVectorPool();
  } catch (error) {
    throw new DatabaseUnavailableError(
      "retrieveMemories: failed to get RuVector pool",
      error instanceof Error ? error : undefined
    );
  }

  let result: QueryResult;
  try {
    // Text search using ts_rank with English text search configuration.
    // Filter by user_id (tenant isolation), threshold, and limit.
    // Normalize ts_rank to 0.0-1.0 range by dividing by the document length.
    result = await pool.query(
      `SELECT
         id,
         content,
         memory_type,
         ts_rank(
           to_tsvector('english', content),
           plainto_tsquery('english', $1)
         ) AS raw_score
       FROM ${MEMORIES_TABLE}
       WHERE user_id = $2
       ORDER BY raw_score DESC
       LIMIT $3`,
      [query, groupId, limit]
    );
  } catch (error) {
    const classified = classifyPostgresError(
      error instanceof Error ? error : new Error(String(error)),
      "retrieveMemories",
      `SELECT from ${MEMORIES_TABLE}`
    );
    throw classified;
  }

  // Calculate max possible score for normalization.
  // ts_rank can return values > 0; we normalize scores to 0.0-1.0 range.
  const rows = result.rows as Array<{
    id: string;
    content: string;
    memory_type: RuVectorMemoryType;
    raw_score: number;
  }>;

  const maxScore = rows.length > 0
    ? Math.max(...rows.map((r) => r.raw_score), 1)
    : 1;

  const memories: RetrievedMemory[] = rows
    .map((row) => ({
      id: row.id,
      content: row.content,
      memoryType: row.memory_type,
      score: row.raw_score / maxScore,
    }))
    .filter((m) => m.score >= threshold);

  const latencyMs = Date.now() - startTime;

  return {
    memories,
    total: rows.length,
    latencyMs,
    trajectoryId,
  };
}

// ── postFeedback ─────────────────────────────────────────────────────────────

/**
 * Post SONA feedback for a retrieval trajectory.
 *
 * This is the SONA feedback loop — it records which memories were
 * relevant and which weren't, allowing RuVector's self-learning
 * to improve future retrieval quality.
 *
 * ONLY fires when retrieval actually happened AND at least one
 * memory was used (usedMemoryIds has length > 0).
 *
 * @param params - Feedback parameters including trajectory ID
 * @throws DatabaseUnavailableError if RuVector is unreachable
 * @throws DatabaseQueryError if the feedback insert fails
 */
export async function postFeedback(
  params: PostFeedbackParams
): Promise<void> {
  const { trajectoryId, relevanceScores, usedMemoryIds = [], userId } = params;

  // Guard: don't fire feedback if no memories were used
  if (usedMemoryIds.length === 0) {
    console.info("[RuVector Bridge] Skipping feedback: no memories were used");
    return;
  }

  // Validate group_id (userId maps to group_id per ARCH-001)
  const groupId = validateGroupId(userId);

  // Validate trajectoryId is non-empty
  if (!trajectoryId || trajectoryId.trim().length === 0) {
    throw new RuVectorBridgeValidationError("trajectoryId", "trajectoryId must be a non-empty string");
  }

  // Validate relevanceScores has values in 0.0-1.0 range
  for (const score of relevanceScores) {
    if (typeof score !== "number" || score < 0 || score > 1) {
      throw new RuVectorBridgeValidationError("relevanceScores", "relevanceScores must be numbers between 0.0 and 1.0");
    }
  }

  // Validate relevanceScores length matches usedMemoryIds length
  // Each used memory should have a corresponding score
  if (relevanceScores.length !== usedMemoryIds.length) {
    throw new RuVectorBridgeValidationError(
      "relevanceScores",
      `relevanceScores length (${relevanceScores.length}) must match usedMemoryIds length (${usedMemoryIds.length}). ` +
      "Provide one score per memory that was used."
    );
  }

  const feedbackId = randomUUID();
  const createdAt = new Date().toISOString();

  // Partition IDs into relevant (used) and irrelevant (not used)
  const relevantIds = usedMemoryIds;
  const irrelevantIds: string[] = [];

  let pool: Pool;
  try {
    pool = getRuVectorPool();
  } catch (error) {
    throw new DatabaseUnavailableError(
      "postFeedback: failed to get RuVector pool",
      error instanceof Error ? error : undefined
    );
  }

  try {
    // Record feedback in the feedback table
    await pool.query(
      `INSERT INTO ${FEEDBACK_TABLE}
         (id, trajectory_id, relevance_scores, relevant_ids, irrelevant_ids, created_at, group_id)
       VALUES ($1, $2, $3::jsonb, $4::text[], $5::text[], $6, $7)`,
      [
        feedbackId,
        trajectoryId,
        JSON.stringify(relevanceScores),
        relevantIds,
        irrelevantIds,
        createdAt,
        groupId,
      ]
    );
  } catch (error) {
    const classified = classifyPostgresError(
      error instanceof Error ? error : new Error(String(error)),
      "postFeedback",
      `INSERT INTO ${FEEDBACK_TABLE}`
    );
    throw classified;
  }

  // Attempt SONA learning if RuVector functions are available.
  // This is best-effort — if the function doesn't exist yet, we log and continue.
  try {
    await pool.query("SELECT ruvector_sona_learn()");
  } catch (error) {
    const errMsg = error instanceof Error ? error.message : String(error);
    // SONA learning is best-effort; log but don't fail the feedback recording
    if (errMsg.includes("does not exist") || errMsg.includes("could not find")) {
      console.info(
        "[RuVector Bridge] ruvector_sona_learn() not available — feedback recorded but learning deferred"
      );
    } else {
      console.warn(
        "[RuVector Bridge] ruvector_sona_learn() failed — feedback still recorded",
        { error: errMsg }
      );
    }
  }
}

// ── isRuVectorReady ─────────────────────────────────────────────────────────

/**
 * Check if RuVector is enabled and reachable.
 *
 * Performs two checks:
 * 1. isRuVectorEnabled() — checks RUVECTOR_ENABLED env var
 * 2. checkRuVectorHealth() — attempts a lightweight health ping
 *
 * @returns Readiness result with status and optional reason
 */
export async function isRuVectorReady(): Promise<RuVectorReadinessResult> {
  // Check environment variable first
  if (!isRuVectorEnabled()) {
    return {
      ready: false,
      reason: "RUVECTOR_ENABLED is not set to 'true'",
    };
  }

  // Attempt health ping
  try {
    const health = await checkRuVectorHealth();
    if (health.status === "healthy") {
      return { ready: true };
    }

    return {
      ready: false,
      reason: `RuVector health check failed: status=${health.status} latency=${health.latencyMs}ms`,
    };
  } catch (error) {
    return {
      ready: false,
      reason: `RuVector health check error: ${error instanceof Error ? error.message : String(error)}`,
    };
  }
}