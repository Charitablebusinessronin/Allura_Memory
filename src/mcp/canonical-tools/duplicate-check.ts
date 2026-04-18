/**
 * Duplicate Detection for Canonical MCP Tools
 *
 * Check for duplicate memories in Neo4j using exact match.
 */

import type { Driver } from "neo4j-driver"
import type { GroupId, MemoryId } from "@/lib/memory/canonical-contracts"

/**
 * Check for duplicate memories in Neo4j.
 * Returns existing memory ID if duplicate found, null otherwise.
 */
export async function checkDuplicate(
  neo4j: Driver,
  groupId: GroupId,
  userId: string | null | undefined,
  content: string
): Promise<MemoryId | null> {
  const session = neo4j.session()

  try {
    // Exact match check
    const result = await session.run(
      `
      MATCH (m:Memory)
      WHERE m.group_id = $groupId
        AND ($userId IS NULL OR m.user_id = $userId)
        AND m.content = $content
        AND NOT (m)<-[:SUPERSEDES]-()
      RETURN m.id AS id
      LIMIT 1
      `,
      { groupId, userId: userId ?? null, content }
    )

    if (result.records.length > 0) {
      return result.records[0].get("id") as MemoryId
    }

    // TODO: Semantic similarity check (requires embeddings)

    return null
  } finally {
    await session.close()
  }
}