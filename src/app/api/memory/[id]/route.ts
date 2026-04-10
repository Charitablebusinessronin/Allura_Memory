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

// ── GET /api/memory/[id] (memory_get) ──────────────────────────────────────

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { searchParams } = new URL(request.url);
    
    const getRequest: MemoryGetRequest = {
      id: params.id as MemoryId,
      group_id: (searchParams.get("group_id") || "") as GroupId,
    };
    
    if (!getRequest.group_id) {
      return NextResponse.json(
        { error: "group_id is required" },
        { status: 400 }
      );
    }
    
    const response = await memory_get(getRequest);
    
    return NextResponse.json(response);
  } catch (error) {
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
  { params }: { params: { id: string } }
) {
  try {
    const { searchParams } = new URL(request.url);
    
    const deleteRequest: MemoryDeleteRequest = {
      id: params.id as MemoryId,
      group_id: (searchParams.get("group_id") || "") as GroupId,
      user_id: searchParams.get("user_id") || "",
    };
    
    if (!deleteRequest.group_id) {
      return NextResponse.json(
        { error: "group_id is required" },
        { status: 400 }
      );
    }
    
    if (!deleteRequest.user_id) {
      return NextResponse.json(
        { error: "user_id is required" },
        { status: 400 }
      );
    }
    
    const response = await memory_delete(deleteRequest);
    
    return NextResponse.json(response);
  } catch (error) {
    console.error("Memory DELETE error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}