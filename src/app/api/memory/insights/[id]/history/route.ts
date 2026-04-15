import { NextRequest, NextResponse } from "next/server"
import { getInsightHistory } from "@/lib/neo4j/client"
import { validateGroupId, GroupIdValidationError } from "@/lib/validation/group-id"
import { requireRole, forbiddenResponse, unauthorizedResponse } from "@/lib/auth/api-auth"

/**
 * GET /api/memory/insights/[id]/history
 *
 * Get the version history (SUPERSEDES chain) for an insight.
 * Query params:
 * - group_id: Required tenant identifier (format: allura-*)
 */
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  // Auth: require viewer or above role
  const roleCheck = requireRole(request, "viewer")
  if (!roleCheck.user) {
    return unauthorizedResponse()
  }
  if (!roleCheck.allowed) {
    return forbiddenResponse(roleCheck)
  }

  try {
    const { id } = await params
    const { searchParams } = new URL(request.url)
    const group_id_param = searchParams.get("group_id")

    if (!group_id_param) {
      return NextResponse.json(
        { error: "group_id is required. Provide a valid tenant identifier (format: allura-*)" },
        { status: 400 }
      )
    }

    let group_id: string
    try {
      group_id = validateGroupId(group_id_param)
    } catch (error) {
      if (error instanceof GroupIdValidationError) {
        return NextResponse.json({ error: `Invalid group_id: ${error.message}` }, { status: 400 })
      }
      throw error
    }

    const history = await getInsightHistory(id, group_id)

    return NextResponse.json({ history })
  } catch (error) {
    console.error("Failed to fetch insight history:", error)
    return NextResponse.json({ error: "Failed to fetch insight history" }, { status: 500 })
  }
}
