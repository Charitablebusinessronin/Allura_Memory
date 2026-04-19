/**
 * Curator Approve/Reject API
 *
 * POST /api/curator/approve - Approve or reject a proposal
 *
 * Reference: docs/allura/BLUEPRINT.md (Requirements F11-F12, B18-B19)
 *
 * ## Notion Integration (P0 — AD-CURATOR-NOTION)
 *
 * On approve/reject, a Notion page is created in the Curator Proposals
 * database. This is NON-BLOCKING — if the Notion MCP call fails,
 * the approval state machine still completes. The Notion page URL
 * is written back to the proposal's rationale field for traceability.
 *
 * Idempotency: Before creating a new page, we check if one already
 * exists (via the [notion-page:...] marker in rationale).
 */

import { NextRequest, NextResponse } from "next/server"
import { randomUUID } from "crypto"
import { createHash } from "crypto"
import { getPool } from "@/lib/postgres/connection"
import { Neo4jConnectionError, Neo4jPromotionError } from "@/lib/errors/neo4j-errors"
import { createInsight, InsightConflictError } from "@/lib/neo4j/queries/insert-insight"
import { validateGroupId, GroupIdValidationError } from "@/lib/validation/group-id"
import { requireRole, forbiddenResponse, unauthorizedResponse } from "@/lib/auth/api-auth"
import { captureException } from "@/lib/observability/sentry"

/**
 * POST /api/curator/approve
 *
 * Body:
 * - proposal_id: Required
 * - group_id: Required tenant identifier
 * - decision: 'approve' | 'reject'
 * - curator_id: Required (person or system making decision)
 * - rationale: Optional reasoning
 */
export async function POST(request: NextRequest) {
  // Auth: require curator or admin role
  const roleCheck = requireRole(request, "curator")
  if (!roleCheck.user) {
    return unauthorizedResponse()
  }
  if (!roleCheck.allowed) {
    return forbiddenResponse(roleCheck)
  }

  try {
    const body = await request.json()
    const { proposal_id, group_id, decision, curator_id, rationale } = body

    // Validate required fields
    if (!proposal_id) {
      return NextResponse.json({ error: "proposal_id is required" }, { status: 400 })
    }

    if (!group_id) {
      return NextResponse.json({ error: "group_id is required" }, { status: 400 })
    }

    if (!decision || !["approve", "reject"].includes(decision)) {
      return NextResponse.json({ error: "decision must be 'approve' or 'reject'" }, { status: 400 })
    }

    if (!curator_id) {
      return NextResponse.json({ error: "curator_id is required" }, { status: 400 })
    }

    // Validate group_id format (ARCH-001: enforces allura-* pattern)
    let validatedGroupId: string
    try {
      validatedGroupId = validateGroupId(group_id)
    } catch (error) {
      if (error instanceof GroupIdValidationError) {
        return NextResponse.json({ error: `Invalid group_id: ${error.message}` }, { status: 400 })
      }
      throw error
    }

    const pg = getPool()

    // Fetch proposal
    const proposalResult = await pg.query(
      `SELECT id, group_id, content, score, reasoning, tier, status, trace_ref
       FROM canonical_proposals
       WHERE id = $1 AND group_id = $2`,
      [proposal_id, validatedGroupId]
    )

    if (proposalResult.rows.length === 0) {
      return NextResponse.json({ error: "Proposal not found" }, { status: 404 })
    }

    const proposal = proposalResult.rows[0]

    if (proposal.status !== "pending") {
      return NextResponse.json({ error: `Proposal already ${proposal.status}` }, { status: 400 })
    }

    const decidedAt = new Date().toISOString()
    const witnessPayload = `${proposal_id}|${validatedGroupId}|${proposal.content}|${proposal.score}|${proposal.tier}|${decision}|${decidedAt}|${curator_id}`
    // SHAKE-256 per spec (AD-CURATOR-WITNESS) — 64-byte output matches SHA-256 security level
    const witness_hash = createHash("shake256", { outputLength: 64 }).update(witnessPayload).digest("hex")

    if (decision === "approve") {
      // Promote to Neo4j via versioned InsightHead + SUPERSEDES system
      const memoryId = randomUUID()

      try {
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
            rationale: rationale || null,
            proposal_id: proposal_id,
          },
        })
      } catch (err) {
        if (err instanceof InsightConflictError) {
          return NextResponse.json({ error: "Insight already promoted" }, { status: 409 })
        }
        if (err instanceof Neo4jConnectionError || err instanceof Neo4jPromotionError) {
          return NextResponse.json({ error: "Neo4j unavailable — proposal queued but not promoted" }, { status: 503 })
        }
        throw err
      }

      // Update proposal status
      await pg.query(
        `UPDATE canonical_proposals
         SET status = 'approved',
             decided_at = $1,
             decided_by = $2,
             rationale = $3,
             witness_hash = $4
         WHERE id = $5`,
        [decidedAt, curator_id, rationale || null, witness_hash, proposal_id]
      )

      // Log approval event
      await pg.query(
        `INSERT INTO events (
          group_id, event_type, agent_id, status, metadata, created_at
        ) VALUES ($1, $2, $3, $4, $5, $6)`,
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
            rationale,
          }),
          decidedAt,
        ]
      )

      // Emit notion_sync_pending event for async MCP Docker processing
      // The notion-sync-worker will pick this up and call MCP_DOCKER_notion-create-pages
      await pg.query(
        `INSERT INTO events (
          group_id, event_type, agent_id, status, metadata, created_at
        ) VALUES ($1, $2, $3, $4, $5, $6)`,
        [
          validatedGroupId,
          "notion_sync_pending",
          "curator-approve",
          "pending",
          JSON.stringify({
            proposal_id,
            content: proposal.content,
            score: parseFloat(proposal.score),
            tier: proposal.tier,
            status: "approved",
            curator_id,
            rationale,
            decided_at: decidedAt,
            data_source_id: "42894678-aedb-4c90-9371-6494a9fe5270",
          }),
          decidedAt,
        ]
      )

      return NextResponse.json({
        success: true,
        memory_id: memoryId,
        decided_at: decidedAt,
        notion_sync: "pending",
      })
    } else {
      // Reject proposal
      await pg.query(
        `UPDATE canonical_proposals
         SET status = 'rejected',
             decided_at = $1,
             decided_by = $2,
             rationale = $3,
             witness_hash = $4
         WHERE id = $5`,
        [decidedAt, curator_id, rationale || null, witness_hash, proposal_id]
      )

      // Log rejection event
      await pg.query(
        `INSERT INTO events (
          group_id, event_type, agent_id, status, metadata, created_at
        ) VALUES ($1, $2, $3, $4, $5, $6)`,
        [
          validatedGroupId,
          "proposal_rejected",
          curator_id,
          "completed",
          JSON.stringify({
            proposal_id,
            score: proposal.score,
            tier: proposal.tier,
            rationale,
          }),
          decidedAt,
        ]
      )

      // Emit notion_sync_pending event for async MCP Docker processing
      await pg.query(
        `INSERT INTO events (
          group_id, event_type, agent_id, status, metadata, created_at
        ) VALUES ($1, $2, $3, $4, $5, $6)`,
        [
          validatedGroupId,
          "notion_sync_pending",
          "curator-approve",
          "pending",
          JSON.stringify({
            proposal_id,
            content: proposal.content,
            score: parseFloat(proposal.score),
            tier: proposal.tier,
            status: "rejected",
            curator_id,
            rationale,
            decided_at: decidedAt,
            data_source_id: "42894678-aedb-4c90-9371-6494a9fe5270",
          }),
          decidedAt,
        ]
      )

      return NextResponse.json({
        success: true,
        decided_at: decidedAt,
        notion_sync: "pending",
      })
    }
  } catch (error) {
    if (error instanceof Neo4jConnectionError || error instanceof Neo4jPromotionError) {
      captureException(error, {
        tags: { route: "/api/curator/approve", method: "POST", error_type: "neo4j_unavailable" },
      })
      return NextResponse.json({ error: "Neo4j unavailable" }, { status: 503 })
    }
    captureException(error, { tags: { route: "/api/curator/approve", method: "POST" } })
    console.error("Failed to process curator decision:", error)
    return NextResponse.json({ error: "Failed to process curator decision" }, { status: 500 })
  }
}
