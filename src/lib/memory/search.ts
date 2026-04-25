/**
 * Memory Search Functions
 *
 * Search and retrieve memories from the knowledge graph
 * with PostgreSQL trace evidence linkage.
 *
 * GRAPH_BACKEND selection (Slice C):
 *   GRAPH_BACKEND=neo4j  (default) — routes through readTransaction (Cypher)
 *   GRAPH_BACKEND=ruvector           — routes through IGraphAdapter searchMemories
 *
 * ADR: AD-029 — Graph Adapter Pattern for Neo4j → RuVector Migration
 */

import { MemorySearchRequest, MemorySearchResponse, MemorySearchResult } from "./types"
import { readTransaction } from "../neo4j/connection"
import { Neo4jConnectionError, Neo4jQueryError } from "../errors/neo4j-errors"
import { getGraphBackend, createGraphAdapter } from "@/lib/graph-adapter"
import type { IGraphAdapter } from "@/lib/graph-adapter"
import type { Pool } from "pg"
import type { GroupId } from "@/lib/memory/canonical-contracts"

// ── PG Pool singleton (for GRAPH_BACKEND=ruvector) ─────────────────────────

let searchPgPool: Pool | null = null;

function getSearchPgPool(): Pool {
  if (!searchPgPool) {
    const { Pool: PgPool } = require("pg") as { Pool: new (config: Record<string, unknown>) => Pool };
    const password = process.env.POSTGRES_PASSWORD;
    if (!password) {
      throw new Error("POSTGRES_PASSWORD environment variable is required for GRAPH_BACKEND=ruvector");
    }
    searchPgPool = new PgPool({
      host: process.env.POSTGRES_HOST || "localhost",
      port: parseInt(process.env.POSTGRES_PORT || "5432"),
      database: process.env.POSTGRES_DB || "allura",
      user: process.env.POSTGRES_USER || "allura",
      password,
      connectionTimeoutMillis: 10000,
      max: 10,
    });
  }
  return searchPgPool!;
}

let searchAdapterInstance: IGraphAdapter | null = null;

function getSearchAdapter(): IGraphAdapter {
  if (!searchAdapterInstance) {
    const pool = getSearchPgPool();
    searchAdapterInstance = createGraphAdapter({ pg: pool });
  }
  return searchAdapterInstance;
}

// ── Adapter-based search (GRAPH_BACKEND=ruvector) ──────────────────────────

async function searchMemoriesAdapter(request: MemorySearchRequest): Promise<MemorySearchResponse> {
  const startTime = Date.now();
  const { query, group_id, limit = 10 } = request;

  const adapter = getSearchAdapter();
  const results = await adapter.searchMemories({
    query,
    group_id: group_id as unknown as GroupId,
    limit,
  });

  const mapped: MemorySearchResult[] = results.map((r) => ({
    id: r.id,
    type: "Insight" as const,
    topic_key: r.id,
    title: undefined,
    summary: undefined,
    content: r.content,
    confidence: r.score,
    group_id,
    status: "active" as const,
    created_at: r.created_at,
    updated_at: r.created_at,
    version: 1,
    superseded_by: undefined,
    trace_ref: undefined,
    tags: r.tags,
    metadata: { relevance_score: r.relevance },
  }));

  const queryTimeMs = Date.now() - startTime;

  return {
    results: mapped,
    total: mapped.length,
    query_time_ms: queryTimeMs,
    group_id,
  };
}

async function getMemoriesByTypeAdapter(
  _type: string,
  group_id: string,
  limit: number = 50
): Promise<MemorySearchResult[]> {
  const adapter = getSearchAdapter();
  const listResult = await adapter.listMemories({
    group_id: group_id as unknown as GroupId,
    user_id: null,
  });

  return listResult.memories.slice(0, limit).map((m) => ({
    id: m.id,
    type: "Insight" as const,
    topic_key: m.id,
    title: undefined,
    summary: undefined,
    content: m.content,
    confidence: m.score,
    group_id,
    status: m.deprecated ? ("deprecated" as const) : ("active" as const),
    created_at: m.created_at,
    updated_at: m.created_at,
    version: m.version,
    superseded_by: undefined,
    trace_ref: undefined,
    tags: m.tags,
  }));
}

async function searchAgentsAdapter(query: string, group_id: string): Promise<MemorySearchResult[]> {
  const pool = getSearchPgPool();
  const result = await pool.query(
    `SELECT node_id, props FROM graph_structural_nodes
     WHERE label = 'Agent'
       AND group_id = $1
       AND (props->>'name' ILIKE $2 OR props->>'capabilities' ILIKE $2)
     ORDER BY (props->>'confidence')::real DESC
     LIMIT 20`,
    [group_id, `%${query}%`]
  );

  return result.rows.map((row) => {
    const props = row.props as Record<string, unknown>;
    return {
      id: row.node_id,
      type: "Agent" as const,
      topic_key: row.node_id,
      title: (props.name as string) || undefined,
      summary: (props.description as string) || undefined,
      content: (props.definition as string) || "",
      confidence: (props.confidence as number) || 0.5,
      group_id,
      status: "active" as const,
      created_at: (props.created_at as string) || new Date().toISOString(),
      updated_at: (props.updated_at as string) || (props.created_at as string) || new Date().toISOString(),
      version: 1,
      superseded_by: undefined,
      trace_ref: undefined,
      tags: (props.tags as string[]) || [],
    };
  });
}

// ── Neo4j-based search (GRAPH_BACKEND=neo4j, default) ──────────────────────

async function searchMemoriesNeo4j(request: MemorySearchRequest): Promise<MemorySearchResponse> {
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

  const nodeTypes = types?.length ? types : ["Insight", "Entity", "ADR", "Pattern"]

  const groupConditions = include_global ? "m.group_id = $group_id OR m.group_id = 'global'" : "m.group_id = $group_id"

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

async function getMemoriesByTypeNeo4j(
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

async function searchAgentsNeo4j(query: string, group_id: string): Promise<MemorySearchResult[]> {
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

// ── Public API — dispatches based on GRAPH_BACKEND ─────────────────────────

/**
 * Search for memories in the knowledge graph
 *
 * Routes to IGraphAdapter when GRAPH_BACKEND=ruvector,
 * otherwise uses Neo4j fulltext search.
 *
 * @param request - Search parameters
 * @returns Search results with metadata
 * @throws {Neo4jConnectionError} if Neo4j is unreachable (neo4j backend only)
 * @throws {Neo4jQueryError} if the Cypher query fails (neo4j backend only)
 */
export async function searchMemories(request: MemorySearchRequest): Promise<MemorySearchResponse> {
  const backend = getGraphBackend();
  if (backend === "ruvector") {
    return searchMemoriesAdapter(request);
  }
  return searchMemoriesNeo4j(request);
}

/**
 * Get memories by type for a specific group
 *
 * Routes to IGraphAdapter.listMemories when GRAPH_BACKEND=ruvector,
 * otherwise uses Neo4j Cypher query.
 *
 * @param type - Memory node type
 * @param group_id - Tenant/group identifier
 * @param limit - Maximum results
 * @returns Matching memories
 */
export async function getMemoriesByType(
  type: string,
  group_id: string,
  limit: number = 50
): Promise<MemorySearchResult[]> {
  const backend = getGraphBackend();
  if (backend === "ruvector") {
    return getMemoriesByTypeAdapter(type, group_id, limit);
  }
  return getMemoriesByTypeNeo4j(type, group_id, limit);
}

/**
 * Search for agent definitions in the knowledge graph
 *
 * Routes to graph_structural_nodes when GRAPH_BACKEND=ruvector,
 * otherwise uses Neo4j Cypher query.
 *
 * @param query - Agent name or capability search
 * @param group_id - Tenant/group identifier
 * @returns Matching agent memories
 */
export async function searchAgents(query: string, group_id: string): Promise<MemorySearchResult[]> {
  const backend = getGraphBackend();
  if (backend === "ruvector") {
    return searchAgentsAdapter(query, group_id);
  }
  return searchAgentsNeo4j(query, group_id);
}
