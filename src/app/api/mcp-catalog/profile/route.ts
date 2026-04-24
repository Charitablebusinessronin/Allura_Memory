/**
 * POST /api/mcp-catalog/profile
 *
 * Create a tool profile or add/remove tools from an existing profile.
 *
 * GET /api/mcp-catalog/profile?name=allura-core
 * Returns the allowlist for a specific profile.
 */

import { NextRequest, NextResponse } from "next/server"
import { createProfile, addToolToProfile, removeToolFromProfile, getProfileAllowlist } from "@/lib/mcp-catalog/registry"
import { captureException } from "@/lib/observability/sentry"

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { action, name, description, created_by, tool_id, tools } = body

    if (!name) {
      return NextResponse.json({ error: "name is required" }, { status: 400 })
    }

    switch (action) {
      case "create": {
        if (!description) {
          return NextResponse.json({ error: "description is required for create" }, { status: 400 })
        }
        const profile = await createProfile(name, description, created_by || "system", tools || [])
        return NextResponse.json({ profile })
      }

      case "add_tool": {
        if (!tool_id) {
          return NextResponse.json({ error: "tool_id is required for add_tool" }, { status: 400 })
        }
        await addToolToProfile(name, tool_id)
        return NextResponse.json({ success: true, action: "add_tool", profile: name, tool: tool_id })
      }

      case "remove_tool": {
        if (!tool_id) {
          return NextResponse.json({ error: "tool_id is required for remove_tool" }, { status: 400 })
        }
        await removeToolFromProfile(name, tool_id)
        return NextResponse.json({ success: true, action: "remove_tool", profile: name, tool: tool_id })
      }

      default:
        return NextResponse.json(
          { error: `Unknown action: ${action}. Use create, add_tool, or remove_tool.` },
          { status: 400 }
        )
    }
  } catch (error) {
    captureException(error, { tags: { route: "/api/mcp-catalog/profile", method: "POST" } })
    return NextResponse.json({ error: "Failed to manage profile" }, { status: 500 })
  }
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const name = searchParams.get("name")

    if (!name) {
      return NextResponse.json({ error: "name query parameter is required" }, { status: 400 })
    }

    const allowlist = await getProfileAllowlist(name)
    return NextResponse.json({ profile: name, tools: allowlist, count: allowlist.length })
  } catch (error) {
    captureException(error, { tags: { route: "/api/mcp-catalog/profile", method: "GET" } })
    return NextResponse.json({ error: "Failed to get profile" }, { status: 500 })
  }
}