/**
 * Controlled Retrieval API — F10, F11
 *
 * POST /api/memory/retrieval - Retrieve approved knowledge through the controlled retrieval layer.
 *
 * This is the sole endpoint agents should use to retrieve knowledge.
 * Agents MUST NOT query PostgreSQL or Neo4j directly (AD-19).
 *
 * Reference: docs/allura/DESIGN-MEMORY-SYSTEM.md §Retrieval Layer
 */

import { NextRequest, NextResponse } from "next/server";
import {
  retrieveKnowledge,
  RetrievalError,
  type RetrievalRequest,
} from "@/lib/memory/retrieval-layer";
import { requireRole, forbiddenResponse, unauthorizedResponse } from "@/lib/auth/api-auth";
import { captureException } from "@/lib/observability/sentry";

/**
 * POST /api/memory/retrieval
 *
 * Request body:
 * - group_id: Required tenant identifier
 * - agent_id: Required agent identifier (for audit)
 * - query: Required search query
 * - mode: 'semantic' | 'structured' | 'hybrid' | 'traces' (default: hybrid)
 * - scope: { project: true, global: true }
 * - include_traces: boolean (default: false, policy-gated)
 * - filters: { status, source_type, min_confidence, max_confidence, since, until }
 * - limit: number (default: 10)
 */
export async function POST(request: NextRequest) {
  // Auth: require viewer or above role
  const roleCheck = requireRole(request, "viewer");
  if (!roleCheck.user) {
    return unauthorizedResponse();
  }
  if (!roleCheck.allowed) {
    return forbiddenResponse(roleCheck);
  }

  try {
    const body = await request.json();

    const retrievalRequest: RetrievalRequest = {
      group_id: body.group_id,
      agent_id: body.agent_id,
      query: body.query,
      mode: body.mode,
      scope: body.scope,
      include_traces: body.include_traces,
      filters: body.filters,
      limit: body.limit,
    };

    const response = await retrieveKnowledge(retrievalRequest);

    return NextResponse.json(response);
  } catch (error) {
    if (error instanceof RetrievalError) {
      return NextResponse.json(
        { error: error.message },
        { status: 400 }
      );
    }

    captureException(error, {
      tags: { route: "/api/memory/retrieval", method: "POST" },
    });
    console.error("Failed to process retrieval query:", error);
    return NextResponse.json(
      { error: "Failed to process retrieval query" },
      { status: 500 }
    );
  }
}