import { NextRequest, NextResponse } from "next/server";
import { getPool } from "@/lib/postgres/connection";
import { getDriver } from "@/lib/neo4j/connection";
import { validateGroupId, GroupIdValidationError } from "@/lib/validation/group-id";
import { requireRole, forbiddenResponse, unauthorizedResponse } from "@/lib/auth/api-auth";

/**
 * GET /api/memory/count
 *
 * Returns the total count of unique active memories for a tenant.
 * Queries both PostgreSQL (episodic) and Neo4j (semantic), deduplicates
 * promoted memories, and returns the merged count.
 *
 * This ensures the dashboard "Total Memories" matches what users see
 * in the Memory Viewer page.
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

  try {
    // Query both stores in parallel
    const [pgResult, neo4jResult] = await Promise.all([
      // PostgreSQL: Get all memory IDs (episodic layer)
      getPool().query<{ id: string }>(
        `SELECT metadata->>'memory_id' AS id
         FROM events
         WHERE group_id = $1
           AND event_type = 'memory_add'
           AND ($2::text IS NULL OR metadata->>'user_id' = $2)`,
        [groupId, userId],
      ),

      // Neo4j: Get all memory IDs (semantic layer, non-deprecated)
      (async () => {
        const driver = getDriver();
        const session = driver.session();
        try {
          const result = await session.run(
            `MATCH (m:Memory)
             WHERE m.group_id = $groupId
               AND ($userId IS NULL OR m.user_id = $userId)
               AND NOT (m)<-[:SUPERSEDES]-()
             RETURN m.id AS id`,
            { groupId, userId: userId ?? null }
          );
          return { ids: result.records.map((r: { get: (key: string) => string }) => r.get("id")) };
        } catch (err) {
          console.warn("[degraded] Neo4j unavailable in memory count:", err);
          return { ids: [] as string[] };
        } finally {
          await session.close();
        }
      })(),
    ]);

    // Deduplicate: Create a Set of all unique memory IDs
    // Promoted memories exist in both stores; we count them once
    const uniqueIds = new Set<string>();
    pgResult.rows.forEach((row: { id: string | null }) => {
      if (row.id) uniqueIds.add(row.id);
    });
    neo4jResult.ids.forEach((id: string) => {
      if (id) uniqueIds.add(id);
    });

    return NextResponse.json({ count: uniqueIds.size });
  } catch (error) {
    console.error("memory_count error:", error);
    return NextResponse.json({ error: "Failed to count memories" }, { status: 500 });
  }
}
