/**
 * RuVector Bridge Types
 *
 * TypeScript interfaces for the RuVector MCP bridge module.
 * These types define the contract between the canonical MCP tools
 * and RuVector's vector search capabilities.
 *
 * Key design decisions:
 * - `userId` maps to `group_id` for tenant isolation (ARCH-001)
 * - `embedding` column uses `vector(1024)` type in PostgreSQL (qwen3-embedding:8b, Matryoshka 1024d)
 *   TypeScript represents this as `number[] | null` since pg driver returns arrays
 * - `trajectoryId` enables SONA feedback loop correlation
 * - Memory IDs are BIGSERIAL (stringified); feedback IDs are UUID v4
 */

// ── Core Types ──────────────────────────────────────────────────────────────

/**
 * Memory types supported by RuVector storage.
 * Maps to the canonical memory taxonomy:
 * - episodic: Session-scoped, short-lived memories
 * - semantic: Curated knowledge (promoted from episodic)
 * - procedural: Skill/process knowledge
 */
export type RuVectorMemoryType = "episodic" | "semantic" | "procedural";

/**
 * Storage result status codes
 */
export type RuVectorStoreStatus = "stored" | "stored_pending_embedding" | "failed";

// ── Request/Response Contracts ──────────────────────────────────────────────

/**
 * Parameters for storing a memory in RuVector.
 *
 * `userId` maps to `group_id` (tenant isolation per ARCH-001).
 * Must match ^allura-[a-z0-9-]+$ pattern.
 */
export interface StoreMemoryParams {
  /** Tenant isolation key (maps to group_id). Must match ^allura-[a-z0-9-]+$ */
  userId: string;

  /** Session grouping identifier */
  sessionId: string;

  /** The text content to store and embed */
  content: string;

  /** Memory classification. Default: 'episodic' */
  memoryType?: RuVectorMemoryType;

  /** Optional metadata to attach */
  metadata?: Record<string, unknown>;
}

/**
 * Result from storing a memory in RuVector.
 */
export interface StoreMemoryResult {
  /** Unique identifier for the stored memory */
  id: string;

  /** Whether storage succeeded (or is pending embedding) */
  status: RuVectorStoreStatus;

  /** Timestamp of creation (ISO 8601) */
  createdAt: string;

  /** The group_id used for tenant isolation */
  groupId: string;
}

/**
 * Parameters for retrieving memories from RuVector.
 *
 * Supports hybrid search (vector + BM25 with RRF fusion), vector-only,
 * or text-only (BM25) search modes. Default: 'hybrid'.
 */
export interface RetrieveMemoriesParams {
  /** Tenant isolation key (maps to group_id) */
  userId: string;

  /** Search query text */
  query: string;

  /** Maximum results to return. Default: 10 */
  limit?: number;

  /** Minimum similarity score (0.0-1.0). Default: 0.5 */
  threshold?: number;

  /** Search mode: 'hybrid' (vector+BM25), 'vector', or 'text'. Default: 'hybrid' */
  searchMode?: "hybrid" | "vector" | "text";
}

/**
 * A single retrieved memory result.
 */
export interface RetrievedMemory {
  /** Memory identifier */
  id: string;

  /** Memory content text */
  content: string;

  /** Memory classification */
  memoryType: RuVectorMemoryType;

  /** Relevance score (0.0-1.0) */
  score: number;
}

/**
 * Result from retrieving memories from RuVector.
 *
 * Includes `trajectoryId` for SONA feedback correlation.
 * The trajectory ID is generated per retrieval call and
 * can be used to correlate feedback with the original search.
 * `modesUsed` indicates which search modes were actually used
 * (may differ from requested searchMode if embedding fails).
 */
export interface RetrieveMemoriesResult {
  /** Retrieved memories, sorted by relevance (descending) */
  memories: RetrievedMemory[];

  /** Total number of matching results (may exceed limit) */
  total: number;

  /** Search execution time in milliseconds */
  latencyMs: number;

  /**
   * Trajectory ID for SONA feedback loop.
   * Pass this to postFeedback() along with relevance scores.
   */
  trajectoryId: string;

  /** Which search modes were actually used */
  modesUsed: Array<"vector" | "text">;
}

/**
 * Parameters for posting SONA feedback.
 *
 * Feedback is ONLY processed when retrieval actually happened
 * AND at least one memory was used.
 */
export interface PostFeedbackParams {
  /** Trajectory ID from a retrieveMemories call */
  trajectoryId: string;

  /** Relevance scores (0.0-1.0) for each retrieved memory, in order */
  relevanceScores: number[];

  /** IDs of memories that were actually used in the response */
  usedMemoryIds?: string[];

  /** Tenant isolation key (maps to group_id). Must match ^allura-[a-z0-9-]+$ */
  userId: string;
}

// ── RuVector Readiness ──────────────────────────────────────────────────────

/**
 * Result from checking RuVector readiness.
 */
export interface RuVectorReadinessResult {
  /** Whether RuVector is enabled and reachable */
  ready: boolean;

  /** If not ready, the reason */
  reason?: string;
}

// ── Internal Types ───────────────────────────────────────────────────────────

/**
 * Row shape from the allura_memories table.
 * Used internally when mapping query results.
 */
/**
 * Row shape from the allura_memories table.
 * Used internally when mapping query results.
 *
 * Note: id is BIGSERIAL (bigint in PG, stringified in JS),
 * embedding is vector(1024) in PG (number[] | null in JS).
 */
export interface AlluraMemoryRow {
  id: string;             // BIGSERIAL, stringified
  user_id: string;         // Same as group_id per ARCH-001
  session_id: string;
  content: string;
  memory_type: RuVectorMemoryType;
  embedding: number[] | null;  // vector(1024) → number[] in JS
  metadata: Record<string, unknown>;
  created_at: string;
  group_id: string;
  trajectory_id: string | null;
  relevance: number;
  deleted_at: string | null;
  schema_version: number;  // Schema version for compatibility checks (FR-1)
}

/**
 * SONA feedback record structure.
 * Stored in the allura_feedback table.
 */
export interface SonaFeedbackRecord {
  id: string;
  trajectory_id: string;
  query_text: string;
  relevant_ids: string[];
  irrelevant_ids: string[];
  relevance_scores: number[];
  created_at: string;
}