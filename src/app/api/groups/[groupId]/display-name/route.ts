import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

/**
 * GET /api/groups/:groupId/display-name
 * Returns a human-readable display name for a groupId.
 * Falls back to a friendly generic if the group is not found.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { groupId: string } }
) {
  const { groupId } = params

  if (!groupId || groupId.trim() === '') {
    return NextResponse.json(
      { error: 'groupId is required' },
      { status: 400 }
    )
  }

  try {
    // Try to fetch group display name from database
    // Adjust this query based on your actual groups table schema
    const result = await db.query(
      `SELECT name, display_name FROM groups WHERE id = $1 LIMIT 1`,
      [groupId]
    )

    if (result.rows.length > 0) {
      const group = result.rows[0]
      // Prefer display_name > name
      const displayName = group.display_name || group.name || 'team memories'

      return NextResponse.json({ displayName })
    }

    // Group not found - return friendly fallback
    return NextResponse.json({ displayName: 'team memories' })
  } catch (error) {
    console.error('Error fetching group display name:', error)
    // On error, return graceful fallback
    return NextResponse.json({ displayName: 'team memories' })
  }
}
