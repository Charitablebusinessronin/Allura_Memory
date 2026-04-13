/**
 * Canonical Memory REST API
 * 
 * Implements the 5 canonical memory operations via REST.
 * Matches the MCP tools interface exactly.
 * 
 * Reference: docs/allura/BLUEPRINT.md
 * 
 * Endpoints:
 * - POST /api/memory (memory_add)
 * - GET /api/memory (memory_list)
 * - GET /api/memory/search (memory_search)
 * - GET /api/memory/[id] (memory_get)
 * - DELETE /api/memory/[id] (memory_delete)
 */

import { NextRequest, NextResponse } from "next/server";
import {
  memory_add,
  memory_search,
  memory_get,
  memory_list,
  memory_delete,
} from "@/mcp/canonical-tools";
import type {
  MemoryAddRequest,
  MemorySearchRequest,
  MemoryGetRequest,
  MemoryListRequest,
  MemoryDeleteRequest,
  GroupId,
} from "@/lib/memory/canonical-contracts";
import {
  DatabaseUnavailableError,
  DatabaseQueryError,
} from "@/lib/errors/database-errors";
import { validateGroupId, GroupIdValidationError } from "@/lib/validation/group-id";
import { requireRole, forbiddenResponse, unauthorizedResponse } from "@/lib/auth/api-auth";
import { captureException } from "@/lib/observability/sentry";

// ── Error Handling ────────────────────────────────────────────────────────

function handleError(error: unknown, route: string, method: string): NextResponse {
  captureException(error, { tags: { route, method } });
  console.error("Memory API error:", error);
  
  if (error instanceof GroupIdValidationError) {
    return NextResponse.json(
      { error: error.message },
      { status: 400 }
    );
  }

  if (error instanceof DatabaseUnavailableError) {
    return NextResponse.json(
      { error: `Service temporarily unavailable: ${error.operation}`, operation: error.operation },
      { status: 503 }
    );
  }

  if (error instanceof DatabaseQueryError) {
    return NextResponse.json(
      { error: `Database query failed: ${error.operation}`, operation: error.operation },
      { status: 500 }
    );
  }
  
  if (error instanceof Error) {
    if (error.message.includes("Invalid group_id")) {
      return NextResponse.json(
        { error: error.message },
        { status: 400 }
      );
    }
    
    if (error.message.includes("not found")) {
      return NextResponse.json(
        { error: error.message },
        { status: 404 }
      );
    }
  }
  
  return NextResponse.json(
    { error: "Internal server error" },
    { status: 500 }
  );
}

// ── POST /api/memory (memory_add) ─────────────────────────────────────────

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
    
    // Validate group_id format (ARCH-001: enforces allura-* pattern)
    let validatedGroupId: string;
    try {
      validatedGroupId = validateGroupId(body.group_id);
    } catch (error) {
      if (error instanceof GroupIdValidationError) {
        return NextResponse.json(
          { error: `Invalid group_id: ${error.message}` },
          { status: 400 }
        );
      }
      throw error;
    }
    
    if (!body.user_id) {
      return NextResponse.json(
        { error: "user_id is required" },
        { status: 400 }
      );
    }
    
    if (!body.content) {
      return NextResponse.json(
        { error: "content is required" },
        { status: 400 }
      );
    }
    
    const addRequest: MemoryAddRequest = {
      group_id: validatedGroupId as GroupId,
      user_id: body.user_id,
      content: body.content,
      metadata: body.metadata,
      threshold: body.threshold,
    };
    
    const response = await memory_add(addRequest);
    
    return NextResponse.json(response);
  } catch (error) {
    return handleError(error, "/api/memory", "POST");
  }
}

// ── GET /api/memory (memory_list) ─────────────────────────────────────────

export async function GET(request: NextRequest) {
  // Auth: require viewer or above role
  const roleCheck = requireRole(request, "viewer");
  if (!roleCheck.user) {
    return unauthorizedResponse();
  }
  if (!roleCheck.allowed) {
    return forbiddenResponse(roleCheck);
  }

  try {
    const { searchParams } = new URL(request.url);
    
    // Validate group_id format (ARCH-001: enforces allura-* pattern)
    const rawGroupId = searchParams.get("group_id");
    let validatedGroupId: string;
    try {
      validatedGroupId = validateGroupId(rawGroupId);
    } catch (error) {
      if (error instanceof GroupIdValidationError) {
        return NextResponse.json(
          { error: `Invalid group_id: ${error.message}` },
          { status: 400 }
        );
      }
      throw error;
    }
    
    if (!rawGroupId) {
      return NextResponse.json(
        { error: "group_id is required" },
        { status: 400 }
      );
    }
    
    // Check if this is a search request
    const query = searchParams.get("query");
    if (query) {
      // Route to memory_search
      const searchRequest: MemorySearchRequest = {
        query,
        group_id: validatedGroupId as GroupId,
        user_id: searchParams.get("user_id") || undefined,
        limit: searchParams.get("limit") ? parseInt(searchParams.get("limit")!) : 10,
        min_score: searchParams.get("min_score") ? parseFloat(searchParams.get("min_score")!) : undefined,
        include_global: searchParams.get("include_global") !== "false",
      };
      
      const response = await memory_search(searchRequest);
      return NextResponse.json(response);
    }
    
    // Otherwise, route to memory_list
    const listRequest: MemoryListRequest = {
      group_id: validatedGroupId as GroupId,
      user_id: searchParams.get("user_id") || "",
      limit: searchParams.get("limit") ? parseInt(searchParams.get("limit")!) : 50,
      offset: searchParams.get("offset") ? parseInt(searchParams.get("offset")!) : 0,
      sort: (searchParams.get("sort") as "created_at_desc" | "created_at_asc" | "score_desc" | "score_asc") || "created_at_desc",
    };
    
    if (!listRequest.user_id) {
      return NextResponse.json(
        { error: "user_id is required" },
        { status: 400 }
      );
    }
    
    const response = await memory_list(listRequest);
    
    return NextResponse.json(response);
  } catch (error) {
    return handleError(error, "/api/memory", "GET");
  }
}