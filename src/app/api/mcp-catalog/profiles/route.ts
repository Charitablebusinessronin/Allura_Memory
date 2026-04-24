/**
 * GET /api/mcp-catalog/profiles
 *
 * List all active tool profiles.
 */

import { NextResponse } from "next/server"
import { listProfiles } from "@/lib/mcp-catalog/registry"
import { captureException } from "@/lib/observability/sentry"

export async function GET() {
  try {
    const profiles = await listProfiles()
    return NextResponse.json({ profiles, count: profiles.length })
  } catch (error) {
    captureException(error, { tags: { route: "/api/mcp-catalog/profiles", method: "GET" } })
    return NextResponse.json({ error: "Failed to list profiles" }, { status: 500 })
  }
}