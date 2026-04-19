import { NextRequest, NextResponse } from "next/server"

import { getPool } from "@/lib/postgres/connection"

/**
 * GET /api/groups/:groupId/display-name
 * Returns a human-readable display name for a groupId.
 * Falls back to a friendly generic if the group is not found.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ groupId: string }> }
) {
  void request
  const { groupId } = await params

  if (!groupId || groupId.trim() === "") {
    return NextResponse.json(
      { error: "groupId is required" },
      { status: 400 }
    )
  }

  try {
    const result = await getPool().query<{ name: string | null; display_name: string | null }>(
      `SELECT name, display_name FROM groups WHERE id = $1 LIMIT 1`,
      [groupId]
    )

    if (result.rows.length > 0) {
      const group = result.rows[0]
      const displayName = group?.display_name || group?.name || "team memories"

      return NextResponse.json({ displayName })
    }

    return NextResponse.json({ displayName: "team memories" })
  } catch (error) {
    console.error("Error fetching group display name:", error)
    return NextResponse.json({ displayName: "team memories" })
  }
}
