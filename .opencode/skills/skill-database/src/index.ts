#!/usr/bin/env bun

import { Server } from "@modelcontextprotocol/sdk/server/index.js"
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js"
import { CallToolRequestSchema, ListToolsRequestSchema } from "@modelcontextprotocol/sdk/types.js"
import { Pool, type QueryResultRow } from "pg"
import { z } from "zod"

const GROUP_ID_PATTERN = /^allura-[a-z0-9-]+$/
const ALL_GROUPS = "allura-*"
const ALLOWED_ORDER_BY = new Set(["created_at DESC", "created_at ASC", "id DESC", "id ASC", "event_type ASC", "event_type DESC"])

export function validateGroupIdOrWildcard(groupId: unknown): string {
  if (typeof groupId !== "string") throw new Error("groupId must be a string")
  const trimmed = groupId.trim()
  if (trimmed === ALL_GROUPS) return trimmed
  if (!GROUP_ID_PATTERN.test(trimmed)) throw new Error("groupId must match ^allura-[a-z0-9-]+$")
  return trimmed
}

export function isReadOnlySql(query: string): boolean {
  const cleaned = query.replace(/\/\*[\s\S]*?\*\//g, " ").replace(/--.*$/gm, " ").trim().toUpperCase()
  if (!cleaned) return false
  if (/\b(INSERT|UPDATE|DELETE|MERGE|UPSERT|CREATE|ALTER|DROP|TRUNCATE)\b/.test(cleaned)) return false
  return /^(SELECT|WITH|SHOW|EXPLAIN)\b/.test(cleaned)
}

export function normalizeOrderBy(orderBy: string): string {
  const normalized = orderBy.trim()
  if (!ALLOWED_ORDER_BY.has(normalized)) {
    throw new Error(`Unsupported order_by: ${orderBy}`)
  }
  return normalized
}

function requiresTenantScope(query: string, groupId: string): void {
  if (groupId === ALL_GROUPS) return
  const upper = query.toUpperCase()
  if (upper.includes("INFORMATION_SCHEMA") || upper.includes("PG_CATALOG")) return
  if (!/group_id|\$\d+/i.test(query)) {
    throw new Error("SQL query must explicitly scope by group_id or use query_traces for tenant-safe access")
  }
}

function createPool(): Pool {
  if (process.env.POSTGRES_URL) {
    return new Pool({ connectionString: process.env.POSTGRES_URL })
  }

  return new Pool({
    host: process.env.POSTGRES_HOST ?? "localhost",
    port: Number(process.env.POSTGRES_PORT ?? 5432),
    database: process.env.POSTGRES_DB ?? "memory",
    user: process.env.POSTGRES_USER ?? "ronin4life",
    password: process.env.POSTGRES_PASSWORD,
  })
}

export async function executeReadOnlySql(
  pool: Pool,
  query: string,
  parameters: unknown[],
  groupId: string,
): Promise<{ rows: QueryResultRow[]; rowCount: number }> {
  requiresTenantScope(query, groupId)
  const result = await pool.query(query, parameters)
  return { rows: result.rows, rowCount: result.rowCount ?? result.rows.length }
}

export async function insertTrace(
  pool: Pool,
  input: {
    event_type: string
    agent_id: string
    group_id: string
    status?: string
    metadata?: Record<string, unknown>
  },
): Promise<{ id: number; created_at: string }> {
  const result = await pool.query<{ id: number; created_at: string }>(
    `
    INSERT INTO events (event_type, group_id, agent_id, status, metadata)
    VALUES ($1, $2, $3, $4, $5)
    RETURNING id, created_at
    `,
    [input.event_type, input.group_id, input.agent_id, input.status ?? "completed", JSON.stringify(input.metadata ?? {})],
  )

  return result.rows[0]
}

export async function queryTraces(
  pool: Pool,
  input: {
    group_id: string
    agent_id?: string
    event_type?: string
    status?: string
    limit: number
    offset: number
    order_by: string
  },
): Promise<{ rows: QueryResultRow[]; total: number }> {
  const clauses = ["group_id = $1"]
  const params: unknown[] = [input.group_id]
  let next = 2

  if (input.agent_id) {
    clauses.push(`agent_id = $${next++}`)
    params.push(input.agent_id)
  }
  if (input.event_type) {
    clauses.push(`event_type = $${next++}`)
    params.push(input.event_type)
  }
  if (input.status) {
    clauses.push(`status = $${next++}`)
    params.push(input.status)
  }

  const whereClause = clauses.join(" AND ")
  const orderBy = normalizeOrderBy(input.order_by)
  const rowsResult = await pool.query(
    `SELECT id, event_type, group_id, agent_id, status, metadata, created_at FROM events WHERE ${whereClause} ORDER BY ${orderBy} LIMIT $${next} OFFSET $${next + 1}`,
    [...params, input.limit, input.offset],
  )
  const countResult = await pool.query<{ total: string }>(`SELECT COUNT(*)::text AS total FROM events WHERE ${whereClause}`, params)
  return { rows: rowsResult.rows, total: Number(countResult.rows[0]?.total ?? 0) }
}

const executeArgsSchema = z.object({
  query: z.string().min(1),
  parameters: z.array(z.unknown()).default([]),
  groupId: z.string().default("allura-roninmemory"),
})

const insertArgsSchema = z.object({
  event_type: z.string().min(1),
  agent_id: z.string().min(1),
  group_id: z.string().min(1),
  status: z.string().default("completed"),
  metadata: z.record(z.unknown()).default({}),
})

const queryArgsSchema = z.object({
  group_id: z.string().min(1),
  agent_id: z.string().optional(),
  event_type: z.string().optional(),
  status: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(1000).default(100),
  offset: z.coerce.number().int().min(0).default(0),
  order_by: z.string().default("created_at DESC"),
})

const server = new Server(
  { name: "allura-skill-database", version: "1.0.0" },
  { capabilities: { tools: {} } },
)

server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: [
    {
      name: "execute_sql",
      description: "Execute read-only SQL against PostgreSQL",
      inputSchema: {
        type: "object",
        properties: {
          query: { type: "string" },
          parameters: { type: "array", items: {}, default: [] },
          groupId: { type: "string", default: "allura-roninmemory" },
        },
        required: ["query"],
      },
    },
    {
      name: "insert_trace",
      description: "Append a trace row to the events table",
      inputSchema: {
        type: "object",
        properties: {
          event_type: { type: "string" },
          agent_id: { type: "string" },
          group_id: { type: "string" },
          status: { type: "string", default: "completed" },
          metadata: { type: "object", additionalProperties: true, default: {} },
        },
        required: ["event_type", "agent_id", "group_id"],
      },
    },
    {
      name: "query_traces",
      description: "Query trace events with tenant-safe filters",
      inputSchema: {
        type: "object",
        properties: {
          group_id: { type: "string" },
          agent_id: { type: "string" },
          event_type: { type: "string" },
          status: { type: "string" },
          limit: { type: "integer", default: 100, minimum: 1, maximum: 1000 },
          offset: { type: "integer", default: 0, minimum: 0 },
          order_by: { type: "string", default: "created_at DESC" },
        },
        required: ["group_id"],
      },
    },
  ],
}))

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  try {
    const pool = createPool()
    try {
      if (request.params.name === "execute_sql") {
        const args = executeArgsSchema.parse(request.params.arguments ?? {})
        const groupId = validateGroupIdOrWildcard(args.groupId)
        if (!isReadOnlySql(args.query)) {
          throw new Error("Only read-only SQL queries are allowed")
        }
        const result = await executeReadOnlySql(pool, args.query, [...args.parameters], groupId)
        return { content: [{ type: "text", text: JSON.stringify({ success: true, ...result }, null, 2) }] }
      }

      if (request.params.name === "insert_trace") {
        const args = insertArgsSchema.parse(request.params.arguments ?? {})
        const groupId = validateGroupIdOrWildcard(args.group_id)
        const result = await insertTrace(pool, { ...args, group_id: groupId })
        return { content: [{ type: "text", text: JSON.stringify({ success: true, ...result, groupId }, null, 2) }] }
      }

      if (request.params.name === "query_traces") {
        const args = queryArgsSchema.parse(request.params.arguments ?? {})
        const groupId = validateGroupIdOrWildcard(args.group_id)
        const result = await queryTraces(pool, { ...args, group_id: groupId })
        return { content: [{ type: "text", text: JSON.stringify({ success: true, ...result, groupId }, null, 2) }] }
      }

      throw new Error(`Unknown tool: ${request.params.name}`)
    } finally {
      await pool.end()
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error"
    return {
      content: [{ type: "text", text: JSON.stringify({ success: false, error: message }, null, 2) }],
      isError: true,
    }
  }
})

export async function main(): Promise<void> {
  const transport = new StdioServerTransport()
  await server.connect(transport)
  console.error("Allura Database Skill MCP Server running on stdio")
}

if (import.meta.main) {
  main().catch((error: Error) => {
    console.error("Fatal error in MCP server:", error)
    process.exit(1)
  })
}
