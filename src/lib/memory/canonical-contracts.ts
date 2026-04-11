/**
 * Canonical Memory API Contracts (Allura v1)
 * 
 * These are the authoritative TypeScript interfaces for the 5 canonical memory operations.
 * All implementations (MCP, REST, internal) MUST conform to these contracts.
 * 
 * Reference: docs/allura/BLUEPRINT.md
 * 
 * Invariants:
 * - group_id is REQUIRED on every operation (enforced by schema)
 * - group_id MUST match ^allura- (CHECK constraint)
 * - PostgreSQL is append-only (no UPDATE/DELETE on events table)
 * - Neo4j uses SUPERSEDES for versioning (never mutate nodes)
 * - PROMOTION_MODE controls autonomous promotion (auto | soc2)
 */

// ── Core Types ─────────────────────────────────────────────────────────────

/**
 * Tenant namespace - enforced by PostgreSQL CHECK constraint
 * Must match pattern: ^allura-.*
 */
export type GroupId = string & { readonly __brand: unique symbol };

/**
 * Memory identifier - UUID v4
 */
export type MemoryId = string & { readonly __brand: unique symbol };

/**
 * User identifier within a tenant
 */
export type UserId = string;

/**
 * Memory content - the actual text stored
 */
export type MemoryContent = string;

/**
 * Confidence score (0.0 to 1.0)
 * Determines promotion eligibility (threshold: 0.85 by default)
 */
export type ConfidenceScore = number;

/**
 * Storage location indicator
 * - 'episodic': PostgreSQL only (below promotion threshold)
 * - 'semantic': Neo4j (promoted knowledge)
 * - 'both': Both stores (promoted in auto mode)
 */
export type StorageLocation = 'episodic' | 'semantic' | 'both';

/**
 * Promotion mode
 * - 'auto': Promote immediately if score >= threshold
 * - 'soc2': Queue for human approval before promotion
 */
export type PromotionMode = 'auto' | 'soc2';

/**
 * Memory provenance
 * - 'conversation': Learned from agent interaction
 * - 'manual': Added by user
 */
export type MemoryProvenance = 'conversation' | 'manual';

/**
 * Memory status in Neo4j
 * - 'active': Current version
 * - 'deprecated': Superseded by newer version
 */
export type MemoryStatus = 'active' | 'deprecated';

export interface MemoryResponseMeta {
  contract_version: 'v1';
  degraded: boolean;
  degraded_reason?: 'neo4j_unavailable';
  stores_used: Array<'postgres' | 'neo4j'>;
  stores_attempted: Array<'postgres' | 'neo4j'>;
  warnings?: string[];
}

// ── Request/Response Contracts ───────────────────────────────────────────

/**
 * 1. memory_add
 * 
 * Add a memory for a user.
 * 
 * Flow:
 * 1. Validate group_id and content
 * 2. Write to PostgreSQL (events table, append-only)
 * 3. Score content (0.0 to 1.0)
 * 4. If score >= threshold:
 *    - auto mode: Promote to Neo4j immediately
 *    - soc2 mode: Queue in proposals table
 * 5. Return memory ID and storage location
 */
export interface MemoryAddRequest {
  /** Required: Tenant namespace (format: allura-*) */
  group_id: GroupId;
  
  /** Required: User identifier within tenant */
  user_id: UserId;
  
  /** Required: Memory content text */
  content: MemoryContent;
  
  /** Optional: Metadata (source, context, etc.) */
  metadata?: {
    source?: MemoryProvenance;
    conversation_id?: string;
    agent_id?: string;
    [key: string]: unknown;
  };
  
  /** Optional: Override promotion threshold (default: 0.85) */
  threshold?: number;
}

export interface MemoryAddResponse {
  /** Memory identifier */
  id: MemoryId;
  
  /** Where the memory was stored */
  stored: StorageLocation;
  
  /** Confidence score (0.0 to 1.0) */
  score: ConfidenceScore;
  
  /** Whether memory is pending human review (soc2 mode only) */
  pending_review?: boolean;
  
  /** Timestamp */
  created_at: string;

  /** Execution metadata */
  meta?: MemoryResponseMeta;
}

/**
 * 2. memory_search
 * 
 * Search memories across both stores.
 * Federated search: PostgreSQL (episodic) + Neo4j (semantic).
 * Results merged by relevance score.
 */
export interface MemorySearchRequest {
  /** Required: Search query */
  query: string;
  
  /** Required: Tenant namespace */
  group_id: GroupId;
  
  /** Optional: User identifier (scope to user) */
  user_id?: UserId;
  
  /** Optional: Maximum results (default: 10) */
  limit?: number;
  
  /** Optional: Minimum confidence filter */
  min_score?: ConfidenceScore;
  
  /** Optional: Include global memories (default: true) */
  include_global?: boolean;
}

export interface MemorySearchResult {
  /** Memory identifier */
  id: MemoryId;
  
  /** Memory content */
  content: MemoryContent;
  
  /** Confidence score */
  score: ConfidenceScore;
  
  /** Storage location */
  source: StorageLocation;
  
  /** Provenance */
  provenance: MemoryProvenance;
  
  /** Timestamp */
  created_at: string;
  
  /** Usage count (how many times retrieved) */
  usage_count?: number;
}

export interface MemorySearchResponse {
  /** Search results */
  results: MemorySearchResult[];
  
  /** Total count */
  count: number;
  
  /** Query execution time (ms) */
  latency_ms: number;

  /** Execution metadata */
  meta?: MemoryResponseMeta;
}

/**
 * 3. memory_get
 * 
 * Retrieve a single memory by ID.
 * Returns memory from either store (episodic or semantic).
 */
export interface MemoryGetRequest {
  /** Required: Memory identifier */
  id: MemoryId;
  
  /** Required: Tenant namespace (for isolation) */
  group_id: GroupId;
}

export interface MemoryGetResponse {
  /** Memory identifier */
  id: MemoryId;
  
  /** Memory content */
  content: MemoryContent;
  
  /** Confidence score */
  score: ConfidenceScore;
  
  /** Storage location */
  source: StorageLocation;
  
  /** Provenance */
  provenance: MemoryProvenance;
  
  /** User identifier */
  user_id: UserId;
  
  /** Timestamp */
  created_at: string;
  
  /** Version history (if semantic) */
  version?: number;
  
  /** Superseded by (if deprecated) */
  superseded_by?: MemoryId;
  
  /** Usage count */
  usage_count?: number;

  /** Execution metadata */
  meta?: MemoryResponseMeta;
}

/**
 * 4. memory_list
 * 
 * List all memories for a user within a tenant.
 * Returns from both stores, merged and sorted.
 */
export interface MemoryListRequest {
  /** Required: Tenant namespace */
  group_id: GroupId;
  
  /** Required: User identifier */
  user_id: UserId;
  
  /** Optional: Maximum results (default: 50) */
  limit?: number;
  
  /** Optional: Pagination offset */
  offset?: number;
  
  /** Optional: Sort order (default: 'created_at_desc') */
  sort?: 'created_at_desc' | 'created_at_asc' | 'score_desc' | 'score_asc';
}

export interface MemoryListResponse {
  /** Memories */
  memories: MemoryGetResponse[];
  
  /** Total count */
  total: number;
  
  /** Has more results */
  has_more: boolean;

  /** Execution metadata */
  meta?: MemoryResponseMeta;
}

/**
 * 5. memory_delete
 * 
 * Soft-delete a memory.
 * - Appends deletion event to PostgreSQL (append-only)
 * - Marks Neo4j node as deprecated (if promoted)
 * - Original rows remain for audit trail
 */
export interface MemoryDeleteRequest {
  /** Required: Memory identifier */
  id: MemoryId;
  
  /** Required: Tenant namespace */
  group_id: GroupId;
  
  /** Required: User identifier (for authorization) */
  user_id: UserId;
}

export interface MemoryDeleteResponse {
  /** Memory identifier */
  id: MemoryId;
  
  /** Deletion status */
  deleted: boolean;
  
  /** Deletion timestamp */
  deleted_at: string;
  
  /** Recovery window (days) */
  recovery_days: number;

  /** Execution metadata */
  meta?: MemoryResponseMeta;
}

// ── Governance Contracts (Curator Workflow) ───────────────────────────────

/**
 * Proposal status in curator queue
 */
export type ProposalStatus = 'pending' | 'approved' | 'rejected';

/**
 * Curator proposal (soc2 mode only)
 */
export interface CuratorProposal {
  /** Proposal identifier */
  id: string;
  
  /** Tenant namespace */
  group_id: GroupId;
  
  /** Memory content */
  content: MemoryContent;
  
  /** Confidence score */
  score: ConfidenceScore;
  
  /** Reasoning for score */
  reasoning: string;
  
  /** Tier classification */
  tier: 'emerging' | 'adoption' | 'established';
  
  /** Status */
  status: ProposalStatus;
  
  /** Trace reference (PostgreSQL event ID) */
  trace_ref: string;
  
  /** Timestamp */
  created_at: string;
}

/**
 * Approve/reject proposal (curator action)
 */
export interface CuratorApproveRequest {
  /** Proposal identifier */
  proposal_id: string;
  
  /** Tenant namespace */
  group_id: GroupId;
  
  /** Decision */
  decision: 'approve' | 'reject';
  
  /** Curator identifier */
  curator_id: string;
  
  /** Reasoning */
  rationale?: string;
}

export interface CuratorApproveResponse {
  /** Success status */
  success: boolean;
  
  /** Memory ID (if approved) */
  memory_id?: MemoryId;
  
  /** Timestamp */
  decided_at: string;
}

// ── Configuration ─────────────────────────────────────────────────────────

/**
 * Memory system configuration
 */
export interface MemoryConfig {
  /** Promotion mode */
  promotion_mode: PromotionMode;
  
  /** Auto-approval threshold (default: 0.85) */
  auto_approval_threshold: number;
  
  /** Duplicate detection threshold (default: 0.95) */
  duplicate_threshold: number;
  
  /** Soft-delete recovery window (days, default: 30) */
  recovery_window_days: number;
}

// ── Error Types ────────────────────────────────────────────────────────────

/**
 * Memory API error
 */
export interface MemoryError {
  /** Error code */
  code: 'INVALID_GROUP_ID' | 'MEMORY_NOT_FOUND' | 'UNAUTHORIZED' | 'VALIDATION_ERROR' | 'INTERNAL_ERROR';
  
  /** Error message */
  message: string;
  
  /** Additional details */
  details?: Record<string, unknown>;
}

/**
 * Validation error for group_id
 */
export class GroupIdValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'GroupIdValidationError';
  }
}

/**
 * Memory not found error
 */
export class MemoryNotFoundError extends Error {
  constructor(id: string) {
    super(`Memory not found: ${id}`);
    this.name = 'MemoryNotFoundError';
  }
}

/**
 * Unauthorized error
 */
export class UnauthorizedError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'UnauthorizedError';
  }
}
