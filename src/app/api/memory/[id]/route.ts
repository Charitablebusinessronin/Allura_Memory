/**
 * Individual Memory REST API
 * 
 * GET /api/memory/[id] - memory_get
 * DELETE /api/memory/[id] - memory_delete
 */

import { NextRequest, NextResponse } from "next/server";
import { memory_get, memory_delete } from "@/mcp/canonical-tools";
import type {
  MemoryGetRequest,
  MemoryDeleteRequest,
  GroupId,
  MemoryId,
} from "@/lib/memory/canonical-contracts";
import {
  DatabaseUnavailableError,
  DatabaseQueryError,
} from "@/lib/errors/database-errors";
import { validateGroupId, GroupIdValidationError } from "@/lib/validation/group-id";
import type { MemoryResponseMeta } from "@/lib/memory/canonical-contracts";

// ── Degraded Response Helper ────────────────────────────────────────────────
// See src/app/api/memory/route.ts for rationale (Issue #14).
// When meta.degraded = true, return 206 + Warning header instead of silent 200.

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function jsonWithDegradation<T extends any = any>(
  data: T & { meta?: MemoryResponseMeta },
): NextResponse<T> {
  const meta = data.meta;
  if (meta?.degraded) {
    const warning = meta.degraded_reason
      ? `299 Allura "${meta.degraded_reason}"`
      : '299 Allura "partial_data"';
    return NextResponse.json(data, {
      status: 206,
      headers: { Warning: warning },
    });
  }
  return NextResponse.json(data);
}

// ── GET /api/memory/[id] (memory_get) ──────────────────────────────────────

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const { searchParams } = new URL(request.url);
    
    const rawGroupId = searchParams.get("group_id");
    if (!rawGroupId) {
      return NextResponse.json(
        { error: "group_id is required" },
        { status: 400 }
      );
    }
    
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
    
    const getRequest: MemoryGetRequest = {
      id: id as MemoryId,
      group_id: validatedGroupId as GroupId,
    };
    
    const response = await memory_get(getRequest);
    
    return jsonWithDegradation(response);
  } catch (error) {
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

    if (error instanceof Error && error.message.includes("not found")) {
      return NextResponse.json(
        { error: error.message },
        { status: 404 }
      );
    }
    
    console.error("Memory GET error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

// ── DELETE /api/memory/[id] (memory_delete) ───────────────────────────────

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const { searchParams } = new URL(request.url);
    
    const rawGroupId = searchParams.get("group_id");
    if (!rawGroupId) {
      return NextResponse.json(
        { error: "group_id is required" },
        { status: 400 }
      );
    }
    
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
    
    if (!searchParams.get("user_id")) {
      return NextResponse.json(
        { error: "user_id is required" },
        { status: 400 }
      );
    }
    
    const deleteRequest: MemoryDeleteRequest = {
      id: id as MemoryId,
      group_id: validatedGroupId as GroupId,
      user_id: searchParams.get("user_id") || "",
    };
    
    const response = await memory_delete(deleteRequest);
    
    return jsonWithDegradation(response);
  } catch (error) {
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

    console.error("Memory DELETE error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}