/**
 * auto-promote.ts — Auto-Promotion Service
 *
 * When PROMOTION_MODE=auto and a proposal's score >= AUTO_APPROVAL_THRESHOLD,
 * promotes it to Neo4j as an Insight without requiring HITL curator action.
 *
 * PROMOTION_MODE values:
 *   "soc2"  — all promotions require human approval (HITL)
 *   "auto"  — eligible proposals are promoted immediately
 *
 * Reference: docs/allura/BLUEPRINT.md (F10, F12, B18)
 */

if (typeof window !== "undefined") {
  throw new Error("auto-promote can only be used server-side")
}

import { randomUUID } from "crypto"
import { createHash } from "crypto"
import { getPool } from "@/lib/postgres/connection"
import { createInsight } from "@/lib/neo4j/queries/insert-insight"
import { InsightConflictError } from "@/lib/neo4j/queries/insert-insight"
import { Neo4jConnectionError, Neo4jPromotionError } from "@/lib/errors/neo4j-errors"
import { validateGroupId } from "@/lib/validation/group-id"

// ── Types ──────────────────────────────────────────────────────────────────

export interface AutoPromoteOptions {
  group_id: string
  /** Score threshold for auto-promotion (default: AUTO_APPROVAL_THRESHOLD env, or 0.75) */
  threshold?: number
  /** Max proposals to process in one call (default: 50) */
  limit?: number
}

export interface AutoPromoteResult {
  promoted: string[]
  skipped: string[]
  errors: Array<{ proposal_id: string; reason: string }>
}

// ── Constants ──────────────────────────────────────────────────────────────

const DEFAULT_THRESHOLD = 0.75

function getThreshold(override?: number): number {
  if (override !== undefined) return override
  const env = parseFloat(process.env.AUTO_APPROVAL_THRESHOLD ?? "")
  return isNaN(env) ? DEFAULT_THRESHOLD : env
}

// ── Core service ───────────────────────────────────────────────────────────

/**
 * Check whether auto-promotion is enabled.
 */
export function isAutoPromoteEnabled(): boolean {
  return process.env.PROMOTION_MODE === "auto"
}

/**
 * Promote a single pending proposal to Neo4j without HITL.
 * Updates canonical_proposals status to 'approved' and logs an event.
 *
 * Does nothing and returns null if the proposal is not in 'pending' state.
 */
export async function autoPromoteProposal(
  proposal_id: string,
  group_id: string,
  curator_id = "auto-promote"
): Promise<{ memory_id: string; decided_at: string } | null> {
  const validatedGroupId = validateGroupId(group_id)
  const pg = getPool()

  const proposalResult = await pg.query(
    `SELECT id, group_id, content, score, tier, trace_ref
     FROM canonical_proposals
     WHERE id = $1 AND group_id = $2 AND status = 'pending'`,
    [proposal_id, validatedGroupId]
  )

  if (proposalResult.rows.length === 0) {
    return null
  }

  const proposal = proposalResult.rows[0]
  const memoryId = randomUUID()
  const decidedAt = new Date().toISOString()

  const witnessPayload = `${proposal_id}|${validatedGroupId}|${proposal.content}|${proposal.score}|${proposal.tier}|approve|${decidedAt}|${curator_id}`
  const witness_hash = createHash("shake256", { outputLength: 64 }).update(witnessPayload).digest("hex")

  await createInsight({
    insight_id: memoryId,
    group_id: validatedGroupId,
    content: proposal.content,
    confidence: parseFloat(proposal.score),
    topic_key: `curator.${proposal.tier}`,
    source_type: "promotion",
    created_by: curator_id,
    metadata: {
      trace_ref: proposal.trace_ref,
      tier: proposal.tier,
      proposal_id,
      auto_promoted: true,
    },
  })

  await pg.query(
    `UPDATE canonical_proposals
     SET status = 'approved',
         decided_at = $1,
         decided_by = $2,
         rationale = 'Auto-promoted: score >= threshold',
         witness_hash = $3
     WHERE id = $4`,
    [decidedAt, curator_id, witness_hash, proposal_id]
  )

  await pg.query(
    `INSERT INTO events (group_id, event_type, agent_id, status, metadata, created_at)
     VALUES ($1, $2, $3, $4, $5, $6)`,
    [
      validatedGroupId,
      "proposal_approved",
      curator_id,
      "completed",
      JSON.stringify({
        proposal_id,
        memory_id: memoryId,
        score: proposal.score,
        tier: proposal.tier,
        auto_promoted: true,
      }),
      decidedAt,
    ]
  )

  return { memory_id: memoryId, decided_at: decidedAt }
}

/**
 * Scan pending proposals for a group and auto-promote all that meet the
 * score threshold. Skips proposals below threshold (leaves for HITL).
 *
 * Only runs when PROMOTION_MODE=auto. Returns immediately with empty
 * result when mode is 'soc2'.
 */
export async function autoPromotePendingProposals(
  opts: AutoPromoteOptions
): Promise<AutoPromoteResult> {
  const result: AutoPromoteResult = { promoted: [], skipped: [], errors: [] }

  if (!isAutoPromoteEnabled()) {
    return result
  }

  const { group_id, limit = 50 } = opts
  const threshold = getThreshold(opts.threshold)
  const validatedGroupId = validateGroupId(group_id)
  const pg = getPool()

  const rows = await pg.query(
    `SELECT id, score
     FROM canonical_proposals
     WHERE group_id = $1 AND status = 'pending'
     ORDER BY created_at ASC
     LIMIT $2`,
    [validatedGroupId, limit]
  )

  for (const row of rows.rows) {
    const score = parseFloat(row.score)
    if (score < threshold) {
      result.skipped.push(row.id)
      continue
    }

    try {
      const promoted = await autoPromoteProposal(row.id, validatedGroupId)
      if (promoted) {
        result.promoted.push(row.id)
      } else {
        result.skipped.push(row.id)
      }
    } catch (err) {
      const reason =
        err instanceof InsightConflictError
          ? "already promoted"
          : err instanceof Neo4jConnectionError || err instanceof Neo4jPromotionError
            ? "neo4j_unavailable"
            : err instanceof Error
              ? err.message
              : String(err)
      result.errors.push({ proposal_id: row.id, reason })
    }
  }

  return result
}
