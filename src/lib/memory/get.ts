/**
 * Memory Get Functions
 *
 * Retrieve specific memories from Neo4j knowledge graph
 * with optional history and evidence linkage.
 */

import { GetMemoryRequest, GetMemoryResponse, MemorySearchResult } from "./types"
import { readTransaction } from "../neo4j/connection"
import { Neo4jConnectionError, Neo4jQueryError } from "../errors/neo4j-errors"

/**
 * Get a specific memory by topic_key
 *
 * @param request - Get parameters
 * @returns Memory with optional history
 * @throws {Neo4jConnectionError} if Neo4j is unreachable
 * @throws {Neo4jQueryError} if the Cypher query fails
 */
export async function getMemory(request: GetMemoryRequest): Promise<GetMemoryResponse | null> {
  const { topic_key, group_id, version, include_history = false, include_evidence = false } = request

  // Build the main query
  let versionFilter = ""
  if (version !== undefined) {
    versionFilter = " AND m.version = $version"
  }

  // Get current version (not superseded)
  const mainCypher = `
    MATCH (m)
    WHERE m.topic_key = $topic_key
      AND (m.group_id = $group_id OR m.group_id = 'global')
      AND m.status IN ['active', 'draft', 'testing']
      ${versionFilter}
      AND NOT (m)<-[:SUPERSEDES]-()
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
           m.metadata AS metadata
    LIMIT 1
  `

  const mainResult = await readTransaction(async (tx) => {
    const result = await tx.run(mainCypher, {
      topic_key,
      group_id,
      version: version || null,
    })

    if (result.records.length === 0) {
      return null
    }

    const record = result.records[0]
    return {
      id: record.get("topic_key"),
      type: record.get("type"),
      topic_key: record.get("topic_key"),
      title: record.get("title") || undefined,
      summary: record.get("summary") || undefined,
      content: record.get("content"),
      confidence: record.get("confidence") || 0.5,
      group_id: record.get("group_id"),
      status: record.get("status") || "active",
      created_at: record.get("created_at")?.toString() || new Date().toISOString(),
      updated_at: record.get("updated_at")?.toString() || new Date().toISOString(),
      version: record.get("version")?.toNumber?.() || 1,
      superseded_by: undefined,
      trace_ref: record.get("trace_ref") || undefined,
      tags: record.get("tags") || [],
      metadata: record.get("metadata") || {},
    } as MemorySearchResult
  })

  if (!mainResult) {
    return null
  }

  const response: GetMemoryResponse = {
    current: mainResult,
  }

  // Get history if requested
  if (include_history) {
    const historyCypher = `
      MATCH (current {topic_key: $topic_key})-[:SUPERSEDES]->(old)
      WHERE current.group_id = $group_id OR $group_id = 'global'
      RETURN old.topic_key AS topic_key,
             old.group_id AS group_id,
             labels(old)[0] AS type,
             old.title AS title,
             old.summary AS summary,
             old.content AS content,
             old.confidence AS confidence,
             old.status AS status,
             old.created_at AS created_at,
             old.updated_at AS updated_at,
             old.version AS version,
             old.trace_ref AS trace_ref,
             old.tags AS tags
      ORDER BY old.version DESC
      LIMIT 10
    `

    const historyResult = await readTransaction(async (tx) => {
      const result = await tx.run(historyCypher, { topic_key, group_id })
      return result.records.map((record) => ({
        id: record.get("topic_key"),
        type: record.get("type"),
        topic_key: record.get("topic_key"),
        title: record.get("title") || undefined,
        summary: record.get("summary") || undefined,
        content: record.get("content"),
        confidence: record.get("confidence") || 0.5,
        group_id: record.get("group_id"),
        status: record.get("status") || "active",
        created_at: record.get("created_at")?.toString() || new Date().toISOString(),
        updated_at: record.get("updated_at")?.toString() || new Date().toISOString(),
        version: record.get("version")?.toNumber?.() || 1,
        superseded_by: topic_key,
        trace_ref: record.get("trace_ref") || undefined,
        tags: record.get("tags") || [],
      })) as MemorySearchResult[]
    })

    response.history = historyResult
  }

  // Get evidence if requested and trace_ref exists
  if (include_evidence && mainResult.trace_ref) {
    // This would query PostgreSQL for trace evidence
    // For now, we'll return a placeholder
    response.evidence = [
      {
        id: mainResult.trace_ref,
        type: "trace",
        timestamp: mainResult.created_at,
        summary: "Evidence linked via trace_ref",
      },
    ]
  }

  return response
}

/**
 * Get current active version of a memory
 *
 * @param topic_key - Memory identifier
 * @param group_id - Tenant/group identifier
 * @returns Current memory or null
 * @throws {Neo4jConnectionError} if Neo4j is unreachable
 * @throws {Neo4jQueryError} if the Cypher query fails
 */
export async function getCurrentMemory(topic_key: string, group_id: string): Promise<MemorySearchResult | null> {
  const response = await getMemory({
    topic_key,
    group_id,
    include_history: false,
    include_evidence: false,
  })

  return response?.current || null
}

/**
 * Get memory history (all versions)
 *
 * @param topic_key - Memory identifier
 * @param group_id - Tenant/group identifier
 * @returns Array of historical versions
 * @throws {Neo4jConnectionError} if Neo4j is unreachable
 * @throws {Neo4jQueryError} if the Cypher query fails
 */
export async function getMemoryHistory(topic_key: string, group_id: string): Promise<MemorySearchResult[]> {
  const cypher = `
    MATCH (m {topic_key: $topic_key})
    WHERE m.group_id = $group_id OR m.group_id = 'global'
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
           m.tags AS tags
    ORDER BY m.version DESC
    LIMIT 20
  `

  const results = await readTransaction(async (tx) => {
    const result = await tx.run(cypher, { topic_key, group_id })
    return result.records.map((record) => ({
      id: record.get("topic_key"),
      type: record.get("type"),
      topic_key: record.get("topic_key"),
      title: record.get("title") || undefined,
      summary: record.get("summary") || undefined,
      content: record.get("content"),
      confidence: record.get("confidence") || 0.5,
      group_id: record.get("group_id"),
      status: record.get("status") || "active",
      created_at: record.get("created_at")?.toString() || new Date().toISOString(),
      updated_at: record.get("updated_at")?.toString() || new Date().toISOString(),
      version: record.get("version")?.toNumber?.() || 1,
      superseded_by: undefined,
      trace_ref: record.get("trace_ref") || undefined,
      tags: record.get("tags") || [],
    }))
  })

  return results as MemorySearchResult[]
}

/**
 * Check if a topic_key exists
 *
 * @param topic_key - Memory identifier
 * @param group_id - Tenant/group identifier
 * @returns True if memory exists
 * @throws {Neo4jConnectionError} if Neo4j is unreachable
 * @throws {Neo4jQueryError} if the Cypher query fails
 */
export async function memoryExists(topic_key: string, group_id: string): Promise<boolean> {
  const cypher = `
    MATCH (m {topic_key: $topic_key})
    WHERE m.group_id = $group_id OR m.group_id = 'global'
    RETURN count(m) > 0 AS exists
  `

  const result = await readTransaction(async (tx) => {
    const res = await tx.run(cypher, { topic_key, group_id })
    return res.records[0]?.get("exists") || false
  })

  return Boolean(result)
}
