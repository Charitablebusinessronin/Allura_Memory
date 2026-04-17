/**
 * Memory Search Functions
 *
 * Search and retrieve memories from Neo4j knowledge graph
 * with PostgreSQL trace evidence linkage.
 */

import { MemorySearchRequest, MemorySearchResponse, MemorySearchResult } from "./types"
import { readTransaction } from "../neo4j/connection"
import { Neo4jConnectionError, Neo4jQueryError } from "../errors/neo4j-errors"

/**
 * Search for memories in the knowledge graph
 *
 * @param request - Search parameters
 * @returns Search results with metadata
 * @throws {Neo4jConnectionError} if Neo4j is unreachable
 * @throws {Neo4jQueryError} if the Cypher query fails
 */
export async function searchMemories(request: MemorySearchRequest): Promise<MemorySearchResponse> {
  const startTime = Date.now()

  const {
    query,
    group_id,
    types,
    limit = 10,
    offset = 0,
    include_global = true,
    confidence_min,
    date_from,
    date_to,
  } = request

  // Build Cypher query with full-text search
  const nodeTypes = types?.length ? types : ["Insight", "Entity", "ADR", "Pattern"]
  const typeLabels = nodeTypes.map((t) => `:${t}`).join("|")

  // Construct WHERE clause for group_id isolation
  const groupConditions = include_global ? "m.group_id = $group_id OR m.group_id = 'global'" : "m.group_id = $group_id"

  // Add optional filters
  const additionalConditions: string[] = []
  if (confidence_min !== undefined) {
    additionalConditions.push("m.confidence >= $confidence_min")
  }
  if (date_from) {
    additionalConditions.push("m.created_at >= $date_from")
  }
  if (date_to) {
    additionalConditions.push("m.created_at <= $date_to")
  }

  const whereClause =
    additionalConditions.length > 0 ? `(${groupConditions}) AND ${additionalConditions.join(" AND ")}` : groupConditions

  const indexNames = nodeTypes.map((t) => `memory_search_index_${t.toLowerCase()}`)

  const cypher = `
    ${indexNames
      .map(
        (idx) => `
    CALL db.index.fulltext.queryNodes('${idx}', $query)
    YIELD node AS m, score AS ${idx}_score
    WHERE (
      ${groupConditions}
      AND NOT (m)<-[:SUPERSEDES]-()
    )
    RETURN m.topic_key AS topic_key,
           m.group_id AS group_id,
           labels(m)[0] AS type,
           m.title AS title,
           m.summary AS summary,
           m.content AS content,
           m.confidence AS confidence,
           m.status AS status,
           m.created_at AS created_at,
           m.updated_at AS updated_at,
           m.version AS version,
           m.trace_ref AS trace_ref,
           m.tags AS tags,
           ${idx}_score AS relevance_score
    `
      )
      .join("\n    UNION ALL\n    ")}
    ORDER BY relevance_score DESC, confidence DESC, created_at DESC
    SKIP toInteger($offset)
    LIMIT toInteger($limit)
  `

  const params: Record<string, unknown> = {
    query,
    group_id,
    limit,
    offset,
  }

  if (confidence_min !== undefined) {
    params.confidence_min = confidence_min
  }
  if (date_from) {
    params.date_from = date_from
  }
  if (date_to) {
    params.date_to = date_to
  }

  const results = await readTransaction(async (tx) => {
    const result = await tx.run(cypher, params)
    return result.records.map((record) => ({
      id: record.get("topic_key"),
      type: record.get("type") || "Insight",
      topic_key: record.get("topic_key"),
      title: record.get("title") || undefined,
      summary: record.get("summary") || undefined,
      content: record.get("content"),
      confidence: record.get("confidence"),
      group_id: record.get("group_id"),
      status: record.get("status") || "active",
      created_at: record.get("created_at"),
      updated_at: record.get("updated_at") || record.get("created_at"),
      version: record.get("version") || 1,
      superseded_by: undefined,
      trace_ref: record.get("trace_ref") || undefined,
      tags: record.get("tags") || [],
      metadata: { relevance_score: record.get("relevance_score") },
    }))
  })

  const queryTimeMs = Date.now() - startTime

  return {
    results: results as MemorySearchResult[],
    total: results.length,
    query_time_ms: queryTimeMs,
    group_id,
  }
}

/**
 * Get memories by type for a specific group
 *
 * @param type - Memory node type
 * @param group_id - Tenant/group identifier
 * @param limit - Maximum results
 * @returns Matching memories
 * @throws {Neo4jConnectionError} if Neo4j is unreachable
 * @throws {Neo4jQueryError} if the Cypher query fails
 */
export async function getMemoriesByType(
  type: string,
  group_id: string,
  limit: number = 50
): Promise<MemorySearchResult[]> {
  const cypher = `
    MATCH (m:${type})
    WHERE m.group_id = $group_id
      AND m.status = 'active'
      AND NOT (())-[:SUPERSEDES]->(m)
    RETURN m.topic_key AS topic_key,
           m.group_id AS group_id,
           m.type AS type,
           m.title AS title,
           m.summary AS summary,
           m.content AS content,
           m.confidence AS confidence,
           m.status AS status,
           m.created_at AS created_at,
           m.updated_at AS updated_at,
           m.version AS version,
           m.trace_ref AS trace_ref,
           m.tags AS tags
    ORDER BY m.confidence DESC, m.created_at DESC
    LIMIT toInteger($limit)
  `

  const results = await readTransaction(async (tx) => {
    const result = await tx.run(cypher, { type, group_id, limit })
    return result.records.map((record) => ({
      id: record.get("topic_key"),
      type: type,
      topic_key: record.get("topic_key"),
      title: record.get("title") || undefined,
      summary: record.get("summary") || undefined,
      content: record.get("content"),
      confidence: record.get("confidence"),
      group_id: record.get("group_id"),
      status: record.get("status") || "active",
      created_at: record.get("created_at"),
      updated_at: record.get("updated_at") || record.get("created_at"),
      version: record.get("version") || 1,
      superseded_by: undefined,
      trace_ref: record.get("trace_ref") || undefined,
      tags: record.get("tags") || [],
    }))
  })

  return results as MemorySearchResult[]
}

/**
 * Search for agent definitions in the knowledge graph
 *
 * @param query - Agent name or capability search
 * @param group_id - Tenant/group identifier
 * @returns Matching agent memories
 * @throws {Neo4jConnectionError} if Neo4j is unreachable
 * @throws {Neo4jQueryError} if the Cypher query fails
 */
export async function searchAgents(query: string, group_id: string): Promise<MemorySearchResult[]> {
  const cypher = `
    MATCH (a:Agent)
    WHERE (a.group_id = $group_id OR a.group_id = 'global')
      AND a.status = 'active'
      AND (a.name CONTAINS $query OR a.capabilities CONTAINS $query)
    RETURN a.topic_key AS topic_key,
           a.group_id AS group_id,
           'Agent' AS type,
           a.name AS title,
           a.description AS summary,
           a.definition AS content,
           a.confidence AS confidence,
           a.status AS status,
           a.created_at AS created_at,
           a.updated_at AS updated_at,
           a.version AS version,
           a.tags AS tags
    ORDER BY a.confidence DESC
    LIMIT 20
  `

  const results = await readTransaction(async (tx) => {
    const result = await tx.run(cypher, { query, group_id })
    return result.records.map((record) => ({
      id: record.get("topic_key"),
      type: "Agent" as const,
      topic_key: record.get("topic_key"),
      title: record.get("title") || undefined,
      summary: record.get("summary") || undefined,
      content: record.get("content"),
      confidence: record.get("confidence") || 0.5,
      group_id: record.get("group_id"),
      status: record.get("status") || "active",
      created_at: record.get("created_at"),
      updated_at: record.get("updated_at") || record.get("created_at"),
      version: record.get("version") || 1,
      superseded_by: undefined,
      trace_ref: undefined,
      tags: record.get("tags") || [],
    }))
  })

  return results as MemorySearchResult[]
}
