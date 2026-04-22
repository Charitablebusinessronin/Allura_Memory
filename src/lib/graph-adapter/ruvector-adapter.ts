/**
 * RuVector Graph Adapter — PostgreSQL Implementation (Slice C)
 *
 * Replaces Neo4j with PostgreSQL tables for graph-layer operations.
 * Uses two tables:
 *   1. graph_memories — stores Memory nodes (equivalent to Neo4j Memory label)
 *   2. graph_supersedes — adjacency table for SUPERSEDES relationships
 *
 * Why this works:
 * - Neo4j uses SUPERSEDES as a singly-linked list (no multi-hop traversals)
 * - All queries are single-node lookups or full-text search
 * - No path queries, no shortestPath, no relationship diversity
 * - This is table work — PG with tsvector FTS replaces Neo4j fulltext index
 *
 * Feature flag GRAPH_BACKEND=ruvector selects this adapter.
 * After Slice E, this becomes the only adapter and the flag is removed.
 *
 * ADR: AD-029 — Graph Adapter Pattern for Neo4j → RuVector Migration
 */

import type { Pool } from "pg"
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
import { GraphAdapterError } from "./types"
import type { GroupId, MemoryId, MemoryProvenance, ConfidenceScore } from "@/lib/memory/canonical-contracts"

// ── Row Types ────────────────────────────────────────────────────────────────

interface GraphMemoryRow {
  id: string
  group_id: string
  user_id: string | null
  content: string
  score: number
  provenance: string
  created_at: Date | string
  version: number
  tags: string[] | null
  deprecated: boolean
  deleted_at: Date | string | null
  restored_at: Date | string | null
}

function rowToNode(row: GraphMemoryRow): GraphMemoryNode {
  return {
    id: row.id as MemoryId,
    group_id: row.group_id as GroupId,
    user_id: row.user_id,
    content: row.content,
    score: row.score as ConfidenceScore,
    provenance: (row.provenance === "manual" ? "manual" : "conversation") as MemoryProvenance,
    created_at: row.created_at instanceof Date ? row.created_at.toISOString() : String(row.created_at),
    version: row.version,
    tags: Array.isArray(row.tags) ? row.tags : [],
    deprecated: row.deprecated,
    deleted_at: row.deleted_at instanceof Date ? row.deleted_at.toISOString() : row.deleted_at ? String(row.deleted_at) : null,
    restored_at: row.restored_at instanceof Date ? row.restored_at.toISOString() : row.restored_at ? String(row.restored_at) : null,
  }
}

// ── RuVectorGraphAdapter ─────────────────────────────────────────────────────

export class RuVectorGraphAdapter implements IGraphAdapter {
  private pool: Pool

  constructor(pool: Pool) {
    this.pool = pool
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
    try {
      await this.pool.query(
        `INSERT INTO graph_memories (id, group_id, user_id, content, score, provenance, created_at, deprecated)
         VALUES ($1, $2, $3, $4, $5, $6, $7::timestamptz, $8)`,
        [params.id, params.group_id, params.user_id, params.content, params.score, params.provenance, params.created_at, false]
      )
      return params.id
    } catch (error) {
      throw new GraphAdapterError("ruvector-graph", "createMemory", "Failed to create memory node", error instanceof Error ? error : undefined)
    }
  }

  async checkDuplicate(params: {
    group_id: GroupId
    user_id: string | null
    content: string
  }): Promise<DuplicateCheckResult> {
    try {
      // Check for non-superseded, non-deprecated exact match
      const result = await this.pool.query<{ id: string }>(
        `SELECT m.id
         FROM graph_memories m
         WHERE m.group_id = $1
           AND ($2::text IS NULL OR m.user_id = $2)
           AND m.content = $3
           AND m.deprecated = false
           AND NOT EXISTS (
             SELECT 1 FROM graph_supersedes s
             WHERE s.superseded_id = m.id
           )
         LIMIT 1`,
        [params.group_id, params.user_id ?? null, params.content]
      )
      if (result.rows.length > 0) {
        return { existingId: result.rows[0].id as MemoryId }
      }
      return { existingId: null }
    } catch (error) {
      throw new GraphAdapterError("ruvector-graph", "checkDuplicate", "Duplicate check failed", error instanceof Error ? error : undefined)
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
    const client = await this.pool.connect()
    try {
      await client.query("BEGIN")

      // Get the previous version's score and provenance
      const prevResult = await client.query<{ score: number; provenance: string }>(
        `SELECT score, provenance FROM graph_memories
         WHERE id = $1 AND group_id = $2
         FOR UPDATE`,
        [params.prev_id, params.group_id]
      )

      if (prevResult.rows.length === 0) {
        await client.query("ROLLBACK")
        return { newId: params.new_id, newVersion: params.version, success: false }
      }

      const { score, provenance } = prevResult.rows[0]

      // Create new version
      await client.query(
        `INSERT INTO graph_memories (id, group_id, user_id, content, score, provenance, version, created_at, deprecated)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8::timestamptz, $9)`,
        [params.new_id, params.group_id, params.user_id, params.content, score, provenance, params.version, params.created_at, false]
      )

      // Create SUPERSEDES relationship
      await client.query(
        `INSERT INTO graph_supersedes (newer_id, superseded_id, group_id, created_at)
         VALUES ($1, $2, $3, $4::timestamptz)`,
        [params.new_id, params.prev_id, params.group_id, params.created_at]
      )

      // Mark previous as deprecated
      await client.query(
        `UPDATE graph_memories SET deprecated = true WHERE id = $1 AND group_id = $2`,
        [params.prev_id, params.group_id]
      )

      await client.query("COMMIT")
      return { newId: params.new_id, newVersion: params.version, success: true }
    } catch (error) {
      await client.query("ROLLBACK").catch(() => {})
      throw new GraphAdapterError("ruvector-graph", "supersedesMemory", "SUPERSEDES operation failed", error instanceof Error ? error : undefined)
    } finally {
      client.release()
    }
  }

  async softDeleteMemory(params: {
    id: MemoryId
    group_id: GroupId
    deleted_at: string
  }): Promise<GraphDeleteResult> {
    try {
      const result = await this.pool.query(
        `UPDATE graph_memories
         SET deprecated = true, deleted_at = $1::timestamptz
         WHERE id = $2 AND group_id = $3`,
        [params.deleted_at, params.id, params.group_id]
      )
      return { deleted: (result.rowCount ?? 0) > 0 }
    } catch (error) {
      throw new GraphAdapterError("ruvector-graph", "softDeleteMemory", "Soft-delete failed", error instanceof Error ? error : undefined)
    }
  }

  async restoreMemory(params: {
    id: MemoryId
    group_id: GroupId
    restored_at: string
  }): Promise<GraphRestoreResult> {
    const client = await this.pool.connect()
    try {
      await client.query("BEGIN")

      // Remove deprecated flag and set restored_at
      await client.query(
        `UPDATE graph_memories
         SET deprecated = false, deleted_at = NULL, restored_at = $1::timestamptz
         WHERE id = $2 AND group_id = $3`,
        [params.restored_at, params.id, params.group_id]
      )

      // Remove incoming SUPERSEDES relationships (equivalent to DELETE r in Neo4j)
      await client.query(
        `DELETE FROM graph_supersedes
         WHERE superseded_id = $1 AND group_id = $2`,
        [params.id, params.group_id]
      )

      await client.query("COMMIT")
      return { restored: true }
    } catch (error) {
      await client.query("ROLLBACK").catch(() => {})
      throw new GraphAdapterError("ruvector-graph", "restoreMemory", "Restore failed", error instanceof Error ? error : undefined)
    } finally {
      client.release()
    }
  }

  // ── Read Operations ─────────────────────────────────────────────────────

  async getMemory(params: { id: MemoryId; group_id: GroupId }): Promise<GraphGetResult> {
    try {
      const result = await this.pool.query<GraphMemoryRow>(
        `SELECT id, group_id, user_id, content, score, provenance,
                created_at, version, tags, deprecated, deleted_at, restored_at
         FROM graph_memories
         WHERE id = $1
           AND group_id = $2
           AND deprecated = false
           AND NOT EXISTS (
             SELECT 1 FROM graph_supersedes s
             WHERE s.superseded_id = graph_memories.id
           )`,
        [params.id, params.group_id]
      )
      if (result.rows.length === 0) {
        return { node: null }
      }
      return { node: rowToNode(result.rows[0]) }
    } catch (error) {
      throw new GraphAdapterError("ruvector-graph", "getMemory", "Get memory failed", error instanceof Error ? error : undefined)
    }
  }

  async searchMemories(params: {
    query: string
    group_id: GroupId
    limit: number
  }): Promise<GraphSearchResult[]> {
    try {
      // Use tsvector full-text search (equivalent to Neo4j fulltext index)
      // ts_rank provides relevance scoring similar to Neo4j's fulltext score
      const result = await this.pool.query<{
        id: string
        content: string
        score: number
        provenance: string
        created_at: Date | string
        tags: string[] | null
        relevance: number
      }>(
        `SELECT m.id, m.content, m.score, m.provenance,
                m.created_at, m.tags,
                ts_rank(m.content_tsv, plainto_tsquery('english', $1)) AS relevance
         FROM graph_memories m
         WHERE m.group_id = $2
           AND m.deprecated = false
           AND NOT EXISTS (
             SELECT 1 FROM graph_supersedes s
             WHERE s.superseded_id = m.id
           )
           AND m.content_tsv @@ plainto_tsquery('english', $1)
         ORDER BY relevance DESC, m.score DESC
         LIMIT $3`,
        [params.query, params.group_id, params.limit]
      )

      return result.rows.map((row) => ({
        id: row.id as MemoryId,
        content: row.content,
        score: row.score as ConfidenceScore,
        provenance: (row.provenance === "manual" ? "manual" : "conversation") as MemoryProvenance,
        created_at: row.created_at instanceof Date ? row.created_at.toISOString() : String(row.created_at),
        usage_count: 0, // Usage count tracked in PG events, not graph layer
        tags: Array.isArray(row.tags) ? row.tags : [],
        relevance: row.relevance,
      }))
    } catch (error) {
      throw new GraphAdapterError("ruvector-graph", "searchMemories", "Full-text search failed", error instanceof Error ? error : undefined)
    }
  }

  async listMemories(params: {
    group_id: GroupId
    user_id: string | null
  }): Promise<GraphListResult> {
    try {
      // Count
      const countResult = await this.pool.query<{ total: string }>(
        `SELECT COUNT(*) AS total
         FROM graph_memories m
         WHERE m.group_id = $1
           AND ($2::text IS NULL OR m.user_id = $2)
           AND m.deprecated = false
           AND NOT EXISTS (
             SELECT 1 FROM graph_supersedes s
             WHERE s.superseded_id = m.id
           )`,
        [params.group_id, params.user_id ?? null]
      )
      const total = parseInt(countResult.rows[0]?.total ?? "0", 10)

      // Data
      const result = await this.pool.query<GraphMemoryRow>(
        `SELECT id, group_id, user_id, content, score, provenance,
                created_at, version, tags, deprecated, deleted_at, restored_at
         FROM graph_memories m
         WHERE m.group_id = $1
           AND ($2::text IS NULL OR m.user_id = $2)
           AND m.deprecated = false
           AND NOT EXISTS (
             SELECT 1 FROM graph_supersedes s
             WHERE s.superseded_id = m.id
           )
         ORDER BY m.created_at DESC`,
        [params.group_id, params.user_id ?? null]
      )

      return { memories: result.rows.map(rowToNode), total }
    } catch (error) {
      throw new GraphAdapterError("ruvector-graph", "listMemories", "List memories failed", error instanceof Error ? error : undefined)
    }
  }

  async countMemories(params: {
    group_id: GroupId
    user_id: string | null
  }): Promise<CountResult> {
    try {
      const result = await this.pool.query<{ total: string }>(
        `SELECT COUNT(*) AS total
         FROM graph_memories m
         WHERE m.group_id = $1
           AND ($2::text IS NULL OR m.user_id = $2)
           AND m.deprecated = false
           AND NOT EXISTS (
             SELECT 1 FROM graph_supersedes s
             WHERE s.superseded_id = m.id
           )`,
        [params.group_id, params.user_id ?? null]
      )
      return { total: parseInt(result.rows[0]?.total ?? "0", 10) }
    } catch (error) {
      throw new GraphAdapterError("ruvector-graph", "countMemories", "Count failed", error instanceof Error ? error : undefined)
    }
  }

  async checkCanonical(params: { id: MemoryId; group_id: GroupId }): Promise<CanonicalCheckResult> {
    try {
      const result = await this.pool.query<{ id: string }>(
        `SELECT m.id
         FROM graph_memories m
         WHERE m.id = $1
           AND m.group_id = $2
           AND m.deprecated = false
           AND NOT EXISTS (
             SELECT 1 FROM graph_supersedes s
             WHERE s.superseded_id = m.id
           )
         LIMIT 1`,
        [params.id, params.group_id]
      )
      return { isCanonical: result.rows.length > 0 }
    } catch (error) {
      throw new GraphAdapterError("ruvector-graph", "checkCanonical", "Canonical check failed", error instanceof Error ? error : undefined)
    }
  }

  async getVersion(params: { id: MemoryId; group_id: GroupId }): Promise<VersionLookupResult> {
    try {
      const result = await this.pool.query<{ version: number }>(
        `SELECT m.version
         FROM graph_memories m
         WHERE m.id = $1
           AND m.group_id = $2
           AND m.deprecated = false
           AND NOT EXISTS (
             SELECT 1 FROM graph_supersedes s
             WHERE s.superseded_id = m.id
           )`,
        [params.id, params.group_id]
      )
      if (result.rows.length === 0) {
        return { version: null, exists: false }
      }
      return { version: result.rows[0].version, exists: true }
    } catch (error) {
      throw new GraphAdapterError("ruvector-graph", "getVersion", "Version lookup failed", error instanceof Error ? error : undefined)
    }
  }

  async exportMemories(params: {
    group_id: GroupId
    user_id: string | null
    offset: number
    limit: number
  }): Promise<GraphExportResult> {
    try {
      const result = await this.pool.query<GraphMemoryRow>(
        `SELECT id, group_id, user_id, content, score, provenance,
                created_at, version, tags, deprecated, deleted_at, restored_at
         FROM graph_memories m
         WHERE m.group_id = $1
           AND m.deprecated = false
           AND NOT EXISTS (
             SELECT 1 FROM graph_supersedes s
             WHERE s.superseded_id = m.id
           )
           AND ($2::text IS NULL OR m.user_id = $2)
         ORDER BY m.created_at DESC
         LIMIT $3 OFFSET $4`,
        [params.group_id, params.user_id ?? null, params.limit, params.offset]
      )
      return { memories: result.rows.map(rowToNode) }
    } catch (error) {
      throw new GraphAdapterError("ruvector-graph", "exportMemories", "Export failed", error instanceof Error ? error : undefined)
    }
  }

  async getDeprecatedMemories(params: {
    ids: string[]
    group_id: GroupId
  }): Promise<Map<string, GraphMemoryNode>> {
    try {
      const result = await this.pool.query<GraphMemoryRow>(
        `SELECT id, group_id, user_id, content, score, provenance,
                created_at, version, tags, deprecated, deleted_at, restored_at
         FROM graph_memories
         WHERE group_id = $1
           AND id = ANY($2)
           AND deprecated = true`,
        [params.group_id, params.ids]
      )
      const map = new Map<string, GraphMemoryNode>()
      for (const row of result.rows) {
        const node = rowToNode(row)
        map.set(node.id, node)
      }
      return map
    } catch (error) {
      throw new GraphAdapterError("ruvector-graph", "getDeprecatedMemories", "Deprecated lookup failed", error instanceof Error ? error : undefined)
    }
  }

  async linkMemoryContext(params: {
    memory_id: MemoryId
    group_id: GroupId
    agent_id: string | null
    project_id: string | null
  }): Promise<{ authored_by: boolean; relates_to: boolean }> {
    // Phase 3: RuVector adapter doesn't yet have structural context tables.
    // When graph_memories gains agent_id/project_id columns and a
    // graph_relationships table is created, this will wire them.
    // For now, return false — the Neo4j adapter handles the active path.
    console.warn(
      `[sync-contract] linkMemoryContext called on ruvector adapter (no-op). ` +
      `memory_id=${params.memory_id} agent_id=${params.agent_id} project_id=${params.project_id}`
    )
    return { authored_by: false, relates_to: false }
  }

  // ── Lifecycle ──────────────────────────────────────────────────────────

  async isHealthy(): Promise<boolean> {
    try {
      const result = await this.pool.query("SELECT 1 AS test")
      return result.rows.length > 0
    } catch {
      return false
    }
  }

  async close(): Promise<void> {
    // Don't close the pool — it's shared (owned by connection.ts)
  }
}