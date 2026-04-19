import { NextRequest, NextResponse } from "next/server"

import { getPool } from "@/lib/postgres/connection"

/**
 * GET /api/users/:userId/display-name
 * Returns a human-readable display name for a userId.
 * Falls back to a friendly generic if the user is not found.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ userId: string }> }
) {
  void request
  const { userId } = await params

  if (!userId || userId.trim() === "") {
    return NextResponse.json(
      { error: "userId is required" },
      { status: 400 }
    )
  }

  try {
    const result = await getPool().query<{ display_name: string | null; email: string | null; name: string | null }>(
      `SELECT display_name, email, name FROM users WHERE id = $1 LIMIT 1`,
      [userId]
    )

    if (result.rows.length > 0) {
      const user = result.rows[0]
      const displayName =
        user?.display_name ||
        user?.name ||
        user?.email?.split("@")[0] ||
        "your memories"

      return NextResponse.json({ displayName })
    }

    return NextResponse.json({ displayName: "your memories" })
  } catch (error) {
    console.error("Error fetching user display name:", error)
    return NextResponse.json({ displayName: "your memories" })
  }
}
