/**
 * Approval Audit Logger
 *
 * Ensures that NO Insight enters Neo4j without an approval event logged
 * to PostgreSQL. This is the audit gate for the HITL promotion pipeline.
 *
 * Invariants:
 * - group_id on EVERY query (tenant isolation)
 * - Append-only on events table (INSERT only, no UPDATE/DELETE)
 * - Parameterized queries ($1, $2 syntax) — never string interpolation
 * - Idempotent: duplicate calls for the same proposal_id are no-ops
 *
 * Reference: docs/allura/BLUEPRINT.md (F-003: Approval Audit Flow)
 */

import type { Pool } from "pg"
import { getPool } from "@/lib/postgres/connection"
import { validateGroupId, GroupIdValidationError } from "@/lib/validation/group-id"

// ── Types ─────────────────────────────────────────────────────────────────

/**
 * Approval audit event — the canonical record of a curator decision.
 * Every field is persisted in the events table's JSONB metadata column.
 */
export interface ApprovalAuditEvent {
  /** Proposal identifier from canonical_proposals table */
  proposal_id: string
  /** Tenant namespace (must match ^allura-*) */
  group_id: string
  /** Memory identifier being promoted */
  memory_id: string
  /** Curator who made the decision */
  curator_id: string
  /** Decision outcome */
  decision: "approved" | "rejected"
  /** Optional rationale for the decision */
  rationale?: string
  /** Curator confidence score at decision time */
  score: number
  /** Tier classification at decision time */
  tier: string
  /** ISO 8601 timestamp of the decision */
  approved_at: string
}

/**
 * Error thrown when a promotion is attempted without a recorded approval.
 */
export class ApprovalRequiredError extends Error {
  public readonly proposalId: string
  public readonly groupId: string

  constructor(proposalId: string, groupId: string) {
    super(
      `Approval required before promotion: no approval event found for proposal ${proposalId} in group ${groupId}`
    )
    this.name = "ApprovalRequiredError"
    this.proposalId = proposalId
    this.groupId = groupId
  }
}

// ── Event type constants ──────────────────────────────────────────────────

const EVENT_TYPE_APPROVED = "memory_promotion_approved" as const
const EVENT_TYPE_REJECTED = "memory_promotion_rejected" as const

// ── Core Functions ────────────────────────────────────────────────────────

/**
 * Log an approval or rejection event to the PostgreSQL events table.
 *
 * Idempotent: if an event with the same proposal_id and decision already
 * exists, this function returns silently without inserting a duplicate.
 *
 * @param event - The approval audit event to log
 * @param pool  - Optional Pool override (for testing); defaults to getPool()
 * @throws GroupIdValidationError if group_id is invalid
 * @throws Error on database failure (no silent failures)
 */
export async function logApprovalEvent(
  event: ApprovalAuditEvent,
  pool?: Pool
): Promise<void> {
  // Validate group_id format — enforce tenant isolation at the boundary
  const validatedGroupId = validateGroupId(event.group_id)

  const pg = pool ?? getPool()

  const eventType =
    event.decision === "approved" ? EVENT_TYPE_APPROVED : EVENT_TYPE_REJECTED

  // Idempotency check: has this exact decision already been logged?
  const existing = await pg.query<{ id: number }>(
    `SELECT id
     FROM events
     WHERE group_id = $1
       AND event_type = $2
       AND metadata->>'proposal_id' = $3
     LIMIT 1`,
    [validatedGroupId, eventType, event.proposal_id]
  )

  if (existing.rows.length > 0) {
    // Already logged — idempotent return
    return
  }

  // INSERT into events table (append-only — never UPDATE/DELETE)
  await pg.query(
    `INSERT INTO events (group_id, event_type, agent_id, status, metadata, created_at)
     VALUES ($1, $2, $3, $4, $5, $6)`,
    [
      validatedGroupId,
      eventType,
      event.curator_id,
      "completed",
      JSON.stringify({
        proposal_id: event.proposal_id,
        memory_id: event.memory_id,
        curator_id: event.curator_id,
        decision: event.decision,
        rationale: event.rationale ?? null,
        score: event.score,
        tier: event.tier,
        approved_at: event.approved_at,
      }),
      event.approved_at,
    ]
  )
}

/**
 * Guard function: require an approval event before allowing Neo4j promotion.
 *
 * Queries the events table for a `memory_promotion_approved` event matching
 * the given proposal_id and group_id. Returns true if found.
 * Throws ApprovalRequiredError if no approval event exists.
 *
 * @param proposalId - The proposal ID to check
 * @param groupId    - The tenant namespace
 * @param pool       - Optional Pool override (for testing)
 * @returns true if approval exists
 * @throws ApprovalRequiredError if no approval event found
 * @throws GroupIdValidationError if group_id is invalid
 */
export async function requireApprovalBeforePromotion(
  proposalId: string,
  groupId: string,
  pool?: Pool
): Promise<boolean> {
  // Validate group_id format
  const validatedGroupId = validateGroupId(groupId)

  const pg = pool ?? getPool()

  const result = await pg.query<{ id: number }>(
    `SELECT id
     FROM events
     WHERE group_id = $1
       AND event_type = $2
       AND metadata->>'proposal_id' = $3
     LIMIT 1`,
    [validatedGroupId, EVENT_TYPE_APPROVED, proposalId]
  )

  if (result.rows.length === 0) {
    throw new ApprovalRequiredError(proposalId, validatedGroupId)
  }

  return true
}

/**
 * Check whether an approval event exists (non-throwing variant).
 *
 * Useful for conditional logic where you want to check status
 * without catching an exception.
 *
 * @param proposalId - The proposal ID to check
 * @param groupId    - The tenant namespace
 * @param pool       - Optional Pool override (for testing)
 * @returns true if approval exists, false otherwise
 */
export async function hasApprovalEvent(
  proposalId: string,
  groupId: string,
  pool?: Pool
): Promise<boolean> {
  try {
    await requireApprovalBeforePromotion(proposalId, groupId, pool)
    return true
  } catch (error) {
    if (error instanceof ApprovalRequiredError) {
      return false
    }
    throw error
  }
}