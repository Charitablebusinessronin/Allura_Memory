/**
 * Curator Approve/Reject API
 * 
 * POST /api/curator/approve - Approve or reject a proposal
 * 
 * Reference: docs/allura/BLUEPRINT.md (Requirements F11-F12, B18-B19)
 */

import { NextRequest, NextResponse } from "next/server";
import { Pool } from "pg";
import neo4j, { Driver } from "neo4j-driver";
import { randomUUID } from "crypto";

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
    });
  }

  if (!neo4jDriver) {
    neo4jDriver = neo4j.driver(
      process.env.NEO4J_URI || "bolt://localhost:7687",
      neo4j.auth.basic(
        process.env.NEO4J_USER || "neo4j",
        process.env.NEO4J_PASSWORD || "password"
      )
    );
  }

  return { pg: pgPool, neo4j: neo4jDriver };
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

    // Validate group_id format
    if (!group_id.startsWith("allura-")) {
      return NextResponse.json(
        { error: "Invalid group_id. Must match pattern: allura-*" },
        { status: 400 }
      );
    }

    const { pg, neo4j } = await getConnections();

    // Fetch proposal
    const proposalResult = await pg.query(
      `SELECT id, group_id, content, score, reasoning, tier, status, trace_ref
       FROM canonical_proposals
       WHERE id = $1 AND group_id = $2`,
      [proposal_id, group_id]
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
      // Promote to Neo4j
      const memoryId = randomUUID();
      const session = neo4j.session();

      try {
        await session.run(
          `CREATE (m:Memory {
            id: $id,
            group_id: $groupId,
            content: $content,
            score: $score,
            provenance: 'conversation',
            created_at: datetime($createdAt),
            promoted_at: datetime($promotedAt),
            promoted_by: $curator_id,
            deprecated: false
          })`,
          {
            id: memoryId,
            groupId: group_id,
            content: proposal.content,
            score: proposal.score,
            createdAt: proposal.created_at,
            promotedAt: decidedAt,
            curator_id,
          }
        );
      } finally {
        await session.close();
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
          id, group_id, event_type, agent_id, status, metadata, created_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [
          randomUUID(),
          group_id,
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
          id, group_id, event_type, agent_id, status, metadata, created_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [
          randomUUID(),
          group_id,
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
    console.error("Failed to process curator decision:", error);
    return NextResponse.json(
      { error: "Failed to process curator decision" },
      { status: 500 }
    );
  }
}