import { NextRequest, NextResponse } from "next/server";
import { getPool } from "@/lib/postgres/connection";
import { validateGroupId, GroupIdValidationError } from "@/lib/validation/group-id";
import { requireRole, forbiddenResponse, unauthorizedResponse } from "@/lib/auth/api-auth";

/**
 * GET /api/memory/count
 *
 * Returns the total count of memory_add events for a tenant.
 * Optionally scoped by user_id.
 *
 * Query params:
 *   group_id  — required
 *   user_id   — optional; omit for all users
 */
export async function GET(request: NextRequest) {
  const roleCheck = requireRole(request, "viewer");
  if (!roleCheck.user) return unauthorizedResponse();
  if (!roleCheck.allowed) return forbiddenResponse(roleCheck);

  const { searchParams } = new URL(request.url);
  const rawGroupId = searchParams.get("group_id");
  const userId = searchParams.get("user_id") || null;

  let groupId: string;
  try {
    groupId = validateGroupId(rawGroupId);
  } catch (err) {
    if (err instanceof GroupIdValidationError) {
      return NextResponse.json({ error: err.message }, { status: 400 });
    }
    throw err;
  }

  const pool = getPool();
  const result = await pool.query<{ count: string }>(
    `SELECT COUNT(*) AS count
       FROM events
      WHERE group_id = $1
        AND event_type = 'memory_add'
        AND ($2::text IS NULL OR metadata->>'user_id' = $2)`,
    [groupId, userId],
  );

  return NextResponse.json({ count: parseInt(result.rows[0].count, 10) });
}
