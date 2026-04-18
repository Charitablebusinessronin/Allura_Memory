import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

/**
 * GET /api/users/:userId/display-name
 * Returns a human-readable display name for a userId.
 * Falls back to a friendly generic if the user is not found.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { userId: string } }
) {
  const { userId } = params

  if (!userId || userId.trim() === '') {
    return NextResponse.json(
      { error: 'userId is required' },
      { status: 400 }
    )
  }

  try {
    // Try to fetch user display name from database
    // Adjust this query based on your actual user table schema
    const result = await db.query(
      `SELECT display_name, email, name FROM users WHERE id = $1 LIMIT 1`,
      [userId]
    )

    if (result.rows.length > 0) {
      const user = result.rows[0]
      // Prefer display_name > name > email prefix
      const displayName =
        user.display_name ||
        user.name ||
        user.email?.split('@')[0] ||
        'your memories'

      return NextResponse.json({ displayName })
    }

    // User not found - return friendly fallback
    return NextResponse.json({ displayName: 'your memories' })
  } catch (error) {
    console.error('Error fetching user display name:', error)
    // On error, return graceful fallback
    return NextResponse.json({ displayName: 'your memories' })
  }
}
