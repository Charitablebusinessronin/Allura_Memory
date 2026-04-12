/**
 * Curator Proposals API
 * 
 * GET /api/curator/proposals - List pending proposals
 * 
 * Reference: docs/allura/BLUEPRINT.md (Requirements F13-F15)
 */

import { NextRequest, NextResponse } from "next/server";
import { Pool } from "pg";
import { validateGroupId, GroupIdValidationError } from "@/lib/validation/group-id";

let pgPool: Pool | null = null;

async function getPool(): Promise<Pool> {
  if (!pgPool) {
    pgPool = new Pool({
      host: process.env.POSTGRES_HOST || "localhost",
      port: parseInt(process.env.POSTGRES_PORT || "5432"),
      database: process.env.POSTGRES_DB || "memory",
      user: process.env.POSTGRES_USER || "ronin4life",
      password: process.env.POSTGRES_PASSWORD,
    });
  }
  return pgPool;
}

/**
 * GET /api/curator/proposals
 * 
 * Query params:
 * - group_id: Required tenant identifier
 * - status: Proposal status (pending | approved | rejected | all)
 * - limit: Max results (default: 20)
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const groupId = searchParams.get("group_id");
    const status = searchParams.get("status") || "pending";
    const limit = parseInt(searchParams.get("limit") || "20");

    if (!groupId) {
      return NextResponse.json(
        { error: "group_id is required" },
        { status: 400 }
      );
    }

    // Validate group_id format (ARCH-001: enforces allura-* pattern)
    let validatedGroupId: string;
    try {
      validatedGroupId = validateGroupId(groupId);
    } catch (error) {
      if (error instanceof GroupIdValidationError) {
        return NextResponse.json(
          { error: `Invalid group_id: ${error.message}` },
          { status: 400 }
        );
      }
      throw error;
    }

    const pool = await getPool();

    // Build query based on status
    let query: string;
    let params: unknown[];

    if (status === "all") {
      query = `
        SELECT id, group_id, content, score, reasoning, tier, status, trace_ref, created_at
        FROM canonical_proposals
        WHERE group_id = $1
        ORDER BY score DESC, created_at DESC
        LIMIT $2
      `;
      params = [validatedGroupId, limit];
    } else {
      query = `
        SELECT id, group_id, content, score, reasoning, tier, status, trace_ref, created_at
        FROM canonical_proposals
        WHERE group_id = $1 AND status = $2
        ORDER BY score DESC, created_at DESC
        LIMIT $3
      `;
      params = [validatedGroupId, status, limit];
    }

    const result = await pool.query(query, params);

    return NextResponse.json({
      proposals: result.rows.map((row) => ({
        id: row.id,
        group_id: row.group_id,
        content: row.content,
        score: parseFloat(row.score),
        reasoning: row.reasoning,
        tier: row.tier,
        status: row.status,
        trace_ref: row.trace_ref,
        created_at: row.created_at,
      })),
    });
  } catch (error) {
    console.error("Failed to fetch proposals:", error);
    return NextResponse.json(
      { error: "Failed to fetch proposals" },
      { status: 500 }
    );
  }
}