/**
 * Neo4j Graph Adapter — Legacy Implementation (Slice C)
 *
 * Wraps the existing neo4j-driver Cypher queries behind the IGraphAdapter
 * interface. This is the "before" picture — every method maps to exactly
 * one inline Cypher block from canonical-tools.ts.
 *
 * Purpose: Enable side-by-side comparison with RuVectorGraphAdapter
 * during the migration. Feature flag GRAPH_BACKEND=neo4j selects this.
 *
 * After Slice E (Remove Neo4j), this file is archived.
 *
 * ADR: AD-029 — Graph Adapter Pattern for Neo4j → RuVector Migration
 */

import type { Driver } from "neo4j-driver"
import neo4j from "neo4j-driver"
import type {
  IGraphAdapter,
  GraphMemoryNode,
  GraphSearchResult,
  DuplicateCheckResult,
  VersionLookupResult,
  CanonicalCheckResult,
  CountResult,
  GraphListResult,
  GraphGetResult,
  GraphDeleteResult,
  GraphSupersedesResult,
  GraphRestoreResult,
  GraphExportResult,
} from "./types"
import { GraphAdapterError, GraphAdapterUnavailableError } from "./types"
import type { GroupId, MemoryId, MemoryProvenance, ConfidenceScore } from "@/lib/memory/canonical-contracts"

// ── Helper: Neo4j DateTime → ISO string ──────────────────────────────────────

function neo4jDateToISO(value: unknown): string {
  if (typeof value === "string") return value
  if (value && typeof value === "object" && "year" in value) {
    if (typeof (value as { toString?: () => string }).toString === "function") {
      const str = (value as { toString: () => string }).toString()
      const parsed = new Date(str)
      if (!isNaN(parsed.getTime())) return parsed.toISOString()
    }
    const d = value as Record<string, { low: number; high?: number }>
    const get = (field: string): number => d[field]?.low ?? 0
    return new Date(
      Date.UTC(
        get("year"),
        get("month") - 1,
        get("day"),
        get("hour"),
        get("minute"),
        get("second"),
        Math.floor(get("nanosecond") / 1_000_000)
      )
    ).toISOString()
  }
  return new Date(value as string | number).toISOString()
}

function toProvenance(value: string | null | undefined): MemoryProvenance {
  return value === "manual" ? "manual" : "conversation"
}

function recordToNode(record: Record<string, unknown>): GraphMemoryNode {
  const get = (key: string) => record[key]
  return {
    id: get("id") as MemoryId,
    content: get("content") as string,
    score: (get("score") as number) ?? 0.5,
    provenance: toProvenance(get("provenance") as string | null),
    user_id: (get("user_id") as string) ?? null,
    created_at: neo4jDateToISO(get("created_at")),
    version: (get("version") as { toNumber?: () => number })?.toNumber?.() ?? 1,
    tags: (get("tags") as string[]) || [],
    deprecated: (get("deprecated") as boolean) ?? false,
    deleted_at: get("deleted_at") ? neo4jDateToISO(get("deleted_at")) : null,
    restored_at: get("restored_at") ? neo4jDateToISO(get("restored_at")) : null,
    group_id: get("group_id") as GroupId,
  }
}

// ── Neo4jGraphAdapter ────────────────────────────────────────────────────────

export class Neo4jGraphAdapter implements IGraphAdapter {
  private driver: Driver

  constructor(driver: Driver) {
    this.driver = driver
  }

  // ── Write Operations ───────────────────────────────────────────────────

  async createMemory(params: {
    id: MemoryId
    group_id: GroupId
    user_id: string | null
    content: string
    score: ConfidenceScore
    provenance: MemoryProvenance
    created_at: string
  }): Promise<MemoryId> {
    const session = this.driver.session()
    try {
      await session.run(
        `CREATE (m:Memory {
          id: $id,
          group_id: $groupId,
          user_id: $userId,
          content: $content,
          score: $score,
          provenance: $provenance,
          created_at: datetime($createdAt),
          deprecated: false
        })`,
        {
          id: params.id,
          groupId: params.group_id,
          userId: params.user_id,
          content: params.content,
          score: params.score,
          provenance: params.provenance,
          createdAt: params.created_at,
        }
      )
      return params.id
    } catch (error) {
      throw new GraphAdapterError("neo4j", "createMemory", "Failed to create memory node", error instanceof Error ? error : undefined)
    } finally {
      await session.close()
    }
  }

  async checkDuplicate(params: {
    group_id: GroupId
    user_id: string | null
    content: string
  }): Promise<DuplicateCheckResult> {
    const session = this.driver.session()
    try {
      const result = await session.run(
        `MATCH (m:Memory)
         WHERE m.group_id = $groupId
           AND ($userId IS NULL OR m.user_id = $userId)
           AND m.content = $content
           AND NOT (m)<-[:SUPERSEDES]-()
         RETURN m.id AS id
         LIMIT 1`,
        { groupId: params.group_id, userId: params.user_id ?? null, content: params.content }
      )
      if (result.records.length > 0) {
        return { existingId: result.records[0].get("id") as MemoryId }
      }
      return { existingId: null }
    } catch (error) {
      throw new GraphAdapterError("neo4j", "checkDuplicate", "Duplicate check failed", error instanceof Error ? error : undefined)
    } finally {
      await session.close()
    }
  }

  async supersedesMemory(params: {
    prev_id: MemoryId
    new_id: MemoryId
    group_id: GroupId
    user_id: string | null
    content: string
    version: number
    created_at: string
  }): Promise<GraphSupersedesResult> {
    const session = this.driver.session()
    try {
      await session.run(
        `MATCH (v1:Memory { id: $prevId, group_id: $groupId })
         CREATE (v2:Memory {
           id: $newId,
           group_id: $groupId,
           user_id: $userId,
           content: $content,
           score: v1.score,
           provenance: v1.provenance,
           version: $version,
           created_at: datetime($createdAt),
           deprecated: false
         })
         CREATE (v2)-[:SUPERSEDES]->(v1)
         SET v1.deprecated = true
         SET v1:deprecated`,
        {
          prevId: params.prev_id,
          newId: params.new_id,
          groupId: params.group_id,
          userId: params.user_id,
          content: params.content,
          version: neo4j.int(params.version),
          createdAt: params.created_at,
        }
      )
      return { newId: params.new_id, newVersion: params.version, success: true }
    } catch (error) {
      throw new GraphAdapterError("neo4j", "supersedesMemory", "SUPERSEDES operation failed", error instanceof Error ? error : undefined)
    } finally {
      await session.close()
    }
  }

  async softDeleteMemory(params: {
    id: MemoryId
    group_id: GroupId
    deleted_at: string
  }): Promise<GraphDeleteResult> {
    const session = this.driver.session()
    try {
      const result = await session.run(
        `MATCH (m:Memory)
         WHERE m.id = $id
           AND m.group_id = $groupId
         SET m.deprecated = true,
             m.deleted_at = datetime($deletedAt)
         RETURN m.id AS id`,
        { id: params.id, groupId: params.group_id, deletedAt: params.deleted_at }
      )
      return { deleted: result.records.length > 0 }
    } catch (error) {
      throw new GraphAdapterError("neo4j", "softDeleteMemory", "Soft-delete failed", error instanceof Error ? error : undefined)
    } finally {
      await session.close()
    }
  }

  async restoreMemory(params: {
    id: MemoryId
    group_id: GroupId
    restored_at: string
  }): Promise<GraphRestoreResult> {
    const session = this.driver.session()
    try {
      await session.run(
        `MATCH (m:Memory)
         WHERE m.id = $id
           AND m.group_id = $groupId
         REMOVE m.deprecated
         REMOVE m:deprecated
         WITH m
         OPTIONAL MATCH (newer)-[r:SUPERSEDES]->(m)
         DELETE r
         SET m.restored_at = datetime($restoredAt)
         RETURN m.id AS id`,
        { id: params.id, groupId: params.group_id, restoredAt: params.restored_at }
      )
      return { restored: true }
    } catch (error) {
      throw new GraphAdapterError("neo4j", "restoreMemory", "Restore failed", error instanceof Error ? error : undefined)
    } finally {
      await session.close()
    }
  }

  // ── Read Operations ─────────────────────────────────────────────────────

  async getMemory(params: { id: MemoryId; group_id: GroupId }): Promise<GraphGetResult> {
    const session = this.driver.session()
    try {
      const result = await session.run(
        `MATCH (m:Memory)
         WHERE m.id = $id
           AND m.group_id = $groupId
           AND NOT (m)<-[:SUPERSEDES]-()
         RETURN m.id AS id,
                m.content AS content,
                m.score AS score,
                m.provenance AS provenance,
                m.user_id AS user_id,
                m.created_at AS created_at,
                m.version AS version,
                m.tags AS tags,
                m.deprecated AS deprecated`,
        { id: params.id, groupId: params.group_id }
      )
      if (result.records.length === 0) {
        return { node: null }
      }
      return { node: recordToNode(result.records[0] as unknown as Record<string, unknown>) }
    } catch (error) {
      throw new GraphAdapterError("neo4j", "getMemory", "Get memory failed", error instanceof Error ? error : undefined)
    } finally {
      await session.close()
    }
  }

  async searchMemories(params: {
    query: string
    group_id: GroupId
    limit: number
  }): Promise<GraphSearchResult[]> {
    const session = this.driver.session()
    try {
      const result = await session.run(
        `CALL db.index.fulltext.queryNodes('memory_search_index', $query)
         YIELD node AS m, score
         WHERE m.group_id = $groupId
           AND NOT (m)<-[:SUPERSEDES]-()
         RETURN m.id AS id,
                m.content AS content,
                m.score AS score,
                m.provenance AS provenance,
                m.created_at AS created_at,
                m.usage_count AS usage_count,
                m.tags AS tags,
                score AS relevance
         ORDER BY relevance DESC, m.score DESC
         LIMIT $limit`,
        { query: params.query, groupId: params.group_id, limit: neo4j.int(params.limit) }
      )
      return result.records.map((record) => ({
        id: record.get("id") as MemoryId,
        content: record.get("content") as string,
        score: record.get("score") as ConfidenceScore,
        provenance: toProvenance(record.get("provenance") as string | null),
        created_at: neo4jDateToISO(record.get("created_at")),
        usage_count: (record.get("usage_count") as { toNumber?: () => number })?.toNumber?.() ?? 0,
        tags: (record.get("tags") as string[]) || [],
        relevance: record.get("relevance") as number,
      }))
    } catch (error) {
      throw new GraphAdapterError("neo4j", "searchMemories", "Full-text search failed", error instanceof Error ? error : undefined)
    } finally {
      await session.close()
    }
  }

  async listMemories(params: {
    group_id: GroupId
    user_id: string | null
  }): Promise<GraphListResult> {
    const session = this.driver.session()
    try {
      // Count
      const countResult = await session.run(
        `MATCH (m:Memory)
         WHERE m.group_id = $groupId
           AND ($userId IS NULL OR m.user_id = $userId)
           AND NOT (m)<-[:SUPERSEDES]-()
         RETURN count(m) AS total`,
        { groupId: params.group_id, userId: params.user_id ?? null }
      )
      const total = countResult.records[0]?.get("total")?.toNumber?.() ?? 0

      // Data
      const result = await session.run(
        `MATCH (m:Memory)
         WHERE m.group_id = $groupId
           AND ($userId IS NULL OR m.user_id = $userId)
           AND NOT (m)<-[:SUPERSEDES]-()
         RETURN m.id AS id,
                m.content AS content,
                m.score AS score,
                m.provenance AS provenance,
                m.user_id AS user_id,
                m.created_at AS created_at,
                m.version AS version,
                m.tags AS tags
         ORDER BY m.created_at DESC`,
        { groupId: params.group_id, userId: params.user_id ?? null }
      )

      const memories = result.records.map((record) => recordToNode(record as unknown as Record<string, unknown>))
      return { memories, total }
    } catch (error) {
      throw new GraphAdapterError("neo4j", "listMemories", "List memories failed", error instanceof Error ? error : undefined)
    } finally {
      await session.close()
    }
  }

  async countMemories(params: {
    group_id: GroupId
    user_id: string | null
  }): Promise<CountResult> {
    const session = this.driver.session()
    try {
      const result = await session.run(
        `MATCH (m:Memory)
         WHERE m.group_id = $groupId
           AND ($userId IS NULL OR m.user_id = $userId)
           AND NOT (m)<-[:SUPERSEDES]-()
         RETURN count(m) AS total`,
        { groupId: params.group_id, userId: params.user_id ?? null }
      )
      return { total: result.records[0]?.get("total")?.toNumber?.() ?? 0 }
    } catch (error) {
      throw new GraphAdapterError("neo4j", "countMemories", "Count failed", error instanceof Error ? error : undefined)
    } finally {
      await session.close()
    }
  }

  async checkCanonical(params: { id: MemoryId; group_id: GroupId }): Promise<CanonicalCheckResult> {
    const session = this.driver.session()
    try {
      const result = await session.run(
        `MATCH (m:Memory)
         WHERE m.id = $id
           AND m.group_id = $groupId
           AND NOT (m)<-[:SUPERSEDES]-()
           AND m.deprecated = false
         RETURN m.id AS id LIMIT 1`,
        { id: params.id, groupId: params.group_id }
      )
      return { isCanonical: result.records.length > 0 }
    } catch (error) {
      throw new GraphAdapterError("neo4j", "checkCanonical", "Canonical check failed", error instanceof Error ? error : undefined)
    } finally {
      await session.close()
    }
  }

  async getVersion(params: { id: MemoryId; group_id: GroupId }): Promise<VersionLookupResult> {
    const session = this.driver.session()
    try {
      const result = await session.run(
        `MATCH (v1:Memory)
         WHERE v1.id = $id
           AND v1.group_id = $groupId
           AND NOT (v1)<-[:SUPERSEDES]-()
         RETURN v1.version AS version`,
        { id: params.id, groupId: params.group_id }
      )
      if (result.records.length === 0) {
        return { version: null, exists: false }
      }
      return {
        version: (result.records[0].get("version") as { toNumber?: () => number })?.toNumber?.() ?? 1,
        exists: true,
      }
    } catch (error) {
      throw new GraphAdapterError("neo4j", "getVersion", "Version lookup failed", error instanceof Error ? error : undefined)
    } finally {
      await session.close()
    }
  }

  async exportMemories(params: {
    group_id: GroupId
    user_id: string | null
    offset: number
    limit: number
  }): Promise<GraphExportResult> {
    const session = this.driver.session()
    try {
      const result = await session.run(
        `MATCH (m:Memory)
         WHERE m.group_id = $groupId
           AND NOT (m)<-[:SUPERSEDES]-()
           AND m.deprecated = false
           AND ($userId IS NULL OR m.user_id = $userId)
         RETURN m.id AS id,
                m.content AS content,
                m.score AS score,
                m.provenance AS provenance,
                m.user_id AS user_id,
                m.created_at AS created_at,
                m.version AS version,
                m.tags AS tags
         ORDER BY m.created_at DESC
         SKIP $offset
         LIMIT $limit`,
        {
          groupId: params.group_id,
          userId: params.user_id ?? null,
          offset: neo4j.int(params.offset),
          limit: neo4j.int(params.limit),
        }
      )
      return {
        memories: result.records.map((record) => recordToNode(record as unknown as Record<string, unknown>)),
      }
    } catch (error) {
      throw new GraphAdapterError("neo4j", "exportMemories", "Export failed", error instanceof Error ? error : undefined)
    } finally {
      await session.close()
    }
  }

  async getDeprecatedMemories(params: {
    ids: string[]
    group_id: GroupId
  }): Promise<Map<string, GraphMemoryNode>> {
    const session = this.driver.session()
    try {
      const result = await session.run(
        `MATCH (m:Memory)
         WHERE m.group_id = $groupId
           AND m.id IN $ids
           AND m.deprecated = true
         RETURN m.id AS id,
                m.content AS content,
                m.score AS score,
                m.provenance AS provenance,
                m.user_id AS user_id,
                m.created_at AS created_at,
                m.version AS version,
                m.tags AS tags`,
        { groupId: params.group_id, ids: params.ids }
      )
      const map = new Map<string, GraphMemoryNode>()
      for (const record of result.records) {
        const node = recordToNode(record as unknown as Record<string, unknown>)
        map.set(node.id, node)
      }
      return map
    } catch (error) {
      throw new GraphAdapterError("neo4j", "getDeprecatedMemories", "Deprecated lookup failed", error instanceof Error ? error : undefined)
    } finally {
      await session.close()
    }
  }

  async linkMemoryContext(params: {
    memory_id: MemoryId
    group_id: GroupId
    agent_id: string | null
    project_id: string | null
  }): Promise<{ authored_by: boolean; relates_to: boolean }> {
    // Skip if nothing to link
    if (!params.agent_id && !params.project_id) {
      return { authored_by: false, relates_to: false }
    }

    const session = this.driver.session()
    try {
      let authoredBy = false
      let relatesTo = false

      // Wire AUTHORED_BY → Agent (best-effort, skips if Agent not found)
      if (params.agent_id) {
        const result = await session.run(
          `MATCH (m) WHERE m.id = $memoryId AND m.group_id = $groupId AND (m:Memory OR m:Insight)
           OPTIONAL MATCH (a:Agent {id: $agentId, group_id: $groupId})
           FOREACH (x IN CASE WHEN a IS NOT NULL THEN [1] ELSE [] END |
             MERGE (m)-[:AUTHORED_BY]->(a)
           )
           RETURN a IS NOT NULL AS linked`,
          {
            memoryId: params.memory_id,
            groupId: params.group_id,
            agentId: params.agent_id,
          }
        )
        authoredBy = result.records[0]?.get('linked') ?? false
      }

      // Wire RELATES_TO → Project (best-effort, skips if Project not found)
      if (params.project_id) {
        const result = await session.run(
          `MATCH (m) WHERE m.id = $memoryId AND m.group_id = $groupId AND (m:Memory OR m:Insight)
           OPTIONAL MATCH (p:Project {id: $projectId, group_id: $groupId})
           FOREACH (x IN CASE WHEN p IS NOT NULL THEN [1] ELSE [] END |
             MERGE (m)-[:RELATES_TO]->(p)
           )
           RETURN p IS NOT NULL AS linked`,
          {
            memoryId: params.memory_id,
            groupId: params.group_id,
            projectId: params.project_id,
          }
        )
        relatesTo = result.records[0]?.get('linked') ?? false
      }

      return { authored_by: authoredBy, relates_to: relatesTo }
    } catch (error) {
      // Log but don't throw — relationship wiring is best-effort, not blocking
      console.warn(
        `[sync-contract] linkMemoryContext failed for memory=${params.memory_id}:`,
        error instanceof Error ? error.message : error
      )
      return { authored_by: false, relates_to: false }
    } finally {
      await session.close()
    }
  }

  // ── Lifecycle ──────────────────────────────────────────────────────────

  async isHealthy(): Promise<boolean> {
    try {
      const session = this.driver.session()
      try {
        await session.run("RETURN 1 AS test")
        return true
      } finally {
        await session.close()
      }
    } catch {
      return false
    }
  }

  async close(): Promise<void> {
    // Don't close the driver — it's shared (owned by connection.ts)
    // The adapter is a wrapper, not the owner.
  }
}