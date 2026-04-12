/**
 * Curator Approve/Reject API
 * 
 * POST /api/curator/approve - Approve or reject a proposal
 * 
 * Reference: docs/allura/BLUEPRINT.md (Requirements F11-F12, B18-B19)
 */

import { NextRequest, NextResponse } from "next/server";
import { Pool } from "pg";
import { randomUUID } from "crypto";
import { Neo4jConnectionError, Neo4jPromotionError } from "@/lib/errors/neo4j-errors";
import { createInsight, InsightConflictError } from "@/lib/neo4j/queries/insert-insight";
import { validateGroupId, GroupIdValidationError } from "@/lib/validation/group-id";

let pgPool: Pool | null = null;

async function getConnections(): Promise<{ pg: Pool }> {
  if (!pgPool) {
    pgPool = new Pool({
      host: process.env.POSTGRES_HOST || "localhost",
      port: parseInt(process.env.POSTGRES_PORT || "5432"),
      database: process.env.POSTGRES_DB || "memory",
      user: process.env.POSTGRES_USER || "ronin4life",
      password: process.env.POSTGRES_PASSWORD,
    });
  }

  return { pg: pgPool };
}

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
  try {
    const body = await request.json();
    const { proposal_id, group_id, decision, curator_id, rationale } = body;

    // Validate required fields
    if (!proposal_id) {
      return NextResponse.json(
        { error: "proposal_id is required" },
        { status: 400 }
      );
    }

    if (!group_id) {
      return NextResponse.json(
        { error: "group_id is required" },
        { status: 400 }
      );
    }

    if (!decision || !["approve", "reject"].includes(decision)) {
      return NextResponse.json(
        { error: "decision must be 'approve' or 'reject'" },
        { status: 400 }
      );
    }

    if (!curator_id) {
      return NextResponse.json(
        { error: "curator_id is required" },
        { status: 400 }
      );
    }

    // Validate group_id format (ARCH-001: enforces allura-* pattern)
    let validatedGroupId: string;
    try {
      validatedGroupId = validateGroupId(group_id);
    } catch (error) {
      if (error instanceof GroupIdValidationError) {
        return NextResponse.json(
          { error: `Invalid group_id: ${error.message}` },
          { status: 400 }
        );
      }
      throw error;
    }

    const { pg } = await getConnections();

    // Fetch proposal
    const proposalResult = await pg.query(
      `SELECT id, group_id, content, score, reasoning, tier, status, trace_ref
       FROM canonical_proposals
       WHERE id = $1 AND group_id = $2`,
      [proposal_id, validatedGroupId]
    );

    if (proposalResult.rows.length === 0) {
      return NextResponse.json(
        { error: "Proposal not found" },
        { status: 404 }
      );
    }

    const proposal = proposalResult.rows[0];

    if (proposal.status !== "pending") {
      return NextResponse.json(
        { error: `Proposal already ${proposal.status}` },
        { status: 400 }
      );
    }

    const decidedAt = new Date().toISOString();

    if (decision === "approve") {
      // Promote to Neo4j via versioned InsightHead + SUPERSEDES system
      const memoryId = randomUUID();

      try {
        await createInsight({
          insight_id: memoryId,
          group_id: validatedGroupId,
          content: proposal.content,
          confidence: parseFloat(proposal.score),
          source_type: "promotion",
          created_by: curator_id,
          metadata: {
            trace_ref: proposal.trace_ref,
            tier: proposal.tier,
            rationale: rationale || null,
            proposal_id: proposal_id,
          },
        });
      } catch (err) {
        if (err instanceof InsightConflictError) {
          return NextResponse.json(
            { error: "Insight already promoted" },
            { status: 409 }
          );
        }
        if (err instanceof Neo4jConnectionError || err instanceof Neo4jPromotionError) {
          return NextResponse.json(
            { error: "Neo4j unavailable — proposal queued but not promoted" },
            { status: 503 }
          );
        }
        throw err;
      }

      // Update proposal status
      await pg.query(
        `UPDATE canonical_proposals
         SET status = 'approved',
             decided_at = $1,
             decided_by = $2,
             rationale = $3
         WHERE id = $4`,
        [decidedAt, curator_id, rationale || null, proposal_id]
      );

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
      );

      return NextResponse.json({
        success: true,
        memory_id: memoryId,
        decided_at: decidedAt,
      });
    } else {
      // Reject proposal
      await pg.query(
        `UPDATE canonical_proposals
         SET status = 'rejected',
             decided_at = $1,
             decided_by = $2,
             rationale = $3
         WHERE id = $4`,
        [decidedAt, curator_id, rationale || null, proposal_id]
      );

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
      );

      return NextResponse.json({
        success: true,
        decided_at: decidedAt,
      });
    }
  } catch (error) {
    if (error instanceof Neo4jConnectionError || error instanceof Neo4jPromotionError) {
      return NextResponse.json({ error: "Neo4j unavailable" }, { status: 503 });
    }
    console.error("Failed to process curator decision:", error);
    return NextResponse.json(
      { error: "Failed to process curator decision" },
      { status: 500 }
    );
  }
}
