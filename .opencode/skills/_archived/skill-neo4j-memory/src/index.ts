#!/usr/bin/env bun

import { Server } from "@modelcontextprotocol/sdk/server/index.js"
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js"
import { CallToolRequestSchema, ListToolsRequestSchema } from "@modelcontextprotocol/sdk/types.js"
import neo4j, { type Driver, type Session } from "neo4j-driver"
import { z } from "zod"

const GROUP_ID_PATTERN = /^allura-[a-z0-9-]+$/
const ALL_GROUPS = "allura-*"

export function validateGroupIdOrWildcard(groupId: unknown): string {
  if (typeof groupId !== "string") {
    throw new Error("groupId must be a string")
  }

  const trimmed = groupId.trim()
  if (trimmed === ALL_GROUPS) {
    return trimmed
  }

  if (!GROUP_ID_PATTERN.test(trimmed)) {
    throw new Error("groupId must match ^allura-[a-z0-9-]+$ or be allura-*")
  }

  return trimmed
}

function toPlainValue(value: unknown): unknown {
  if (value === null || value === undefined) return value
  if (Array.isArray(value)) return value.map(toPlainValue)
  if (typeof value === "object") {
    if ("properties" in (value as Record<string, unknown>)) {
      return toPlainValue((value as { properties: unknown }).properties)
    }
    if (typeof (value as { toNumber?: () => number }).toNumber === "function") {
      return (value as { toNumber: () => number }).toNumber()
    }
    if (typeof (value as { toString?: () => string }).toString === "function" && "year" in (value as Record<string, unknown>)) {
      return (value as { toString: () => string }).toString()
    }

    const result: Record<string, unknown> = {}
    for (const [key, entry] of Object.entries(value as Record<string, unknown>)) {
      result[key] = toPlainValue(entry)
    }
    return result
  }
  return value
}

function mapInsight(raw: Record<string, unknown>): Record<string, unknown> {
  const insight = toPlainValue(raw) as Record<string, unknown>
  return {
    id: insight.id ?? insight.insight_id ?? null,
    insightId: insight.insight_id ?? insight.id ?? null,
    content: insight.content ?? null,
    groupId: insight.group_id ?? null,
    confidence: typeof insight.confidence === "number" ? insight.confidence : 0,
    createdAt: insight.created_at ?? null,
    createdBy: insight.created_by ?? insight.user_id ?? null,
    status: insight.status ?? null,
    topicKey: insight.topic_key ?? null,
    metadata: typeof insight.metadata === "object" && insight.metadata !== null ? insight.metadata : {},
  }
}

function createDriver(): Driver {
  const uri = process.env.NEO4J_URI ?? "bolt://localhost:7687"
  const user = process.env.NEO4J_USER ?? "neo4j"
  const password = process.env.NEO4J_PASSWORD ?? "password"
  return neo4j.driver(uri, neo4j.auth.basic(user, password))
}

async function withSession<T>(driver: Driver, fn: (session: Session) => Promise<T>): Promise<T> {
  const session = driver.session({ defaultAccessMode: neo4j.session.READ })
  try {
    return await fn(session)
  } finally {
    await session.close()
  }
}

export async function recallInsightById(driver: Driver, insightId: string, groupId: string): Promise<Record<string, unknown> | null> {
  return withSession(driver, async (session) => {
    const result = await session.run(
      `
      MATCH (i:Insight)
      WHERE (i.id = $insightId OR i.insight_id = $insightId)
        AND ($groupId = $allGroups OR i.group_id = $groupId)
        AND NOT (i)<-[:SUPERSEDES]-(:Insight)
      RETURN i
      LIMIT 1
      `,
      { insightId, groupId, allGroups: ALL_GROUPS },
    )

    if (result.records.length === 0) return null
    return mapInsight(result.records[0].get("i") as Record<string, unknown>)
  })
}

export async function searchInsightsByText(driver: Driver, query: string, groupId: string, limit: number): Promise<Record<string, unknown>[]> {
  return withSession(driver, async (session) => {
    try {
      const result = await session.run(
        `
        CALL db.index.fulltext.queryNodes('memory_search_index', $query)
        YIELD node, score
        WHERE node:Insight
          AND ($groupId = $allGroups OR node.group_id = $groupId)
          AND NOT (node)<-[:SUPERSEDES]-(:Insight)
        RETURN node AS i, score
        ORDER BY score DESC
        LIMIT $limit
        `,
        { query, groupId, limit: neo4j.int(limit), allGroups: ALL_GROUPS },
      )

      return result.records.map((record) => mapInsight(record.get("i") as Record<string, unknown>))
    } catch {
      const result = await session.run(
        `
        MATCH (i:Insight)
        WHERE ($groupId = $allGroups OR i.group_id = $groupId)
          AND NOT (i)<-[:SUPERSEDES]-(:Insight)
          AND (
            toLower(coalesce(i.content, '')) CONTAINS toLower($query)
            OR toLower(coalesce(i.topic_key, '')) CONTAINS toLower($query)
            OR toLower(coalesce(i.insight_id, '')) CONTAINS toLower($query)
          )
        RETURN i
        ORDER BY coalesce(i.confidence, 0) DESC, coalesce(i.created_at, datetime()) DESC
        LIMIT $limit
        `,
        { query, groupId, limit: neo4j.int(limit), allGroups: ALL_GROUPS },
      )

      return result.records.map((record) => mapInsight(record.get("i") as Record<string, unknown>))
    }
  })
}

export async function listInsights(driver: Driver, groupId: string, limit: number, offset: number): Promise<{ items: Record<string, unknown>[]; total: number }> {
  return withSession(driver, async (session) => {
    const countResult = await session.run(
      `
      MATCH (i:Insight)
      WHERE ($groupId = $allGroups OR i.group_id = $groupId)
        AND NOT (i)<-[:SUPERSEDES]-(:Insight)
      RETURN count(i) AS total
      `,
      { groupId, allGroups: ALL_GROUPS },
    )

    const dataResult = await session.run(
      `
      MATCH (i:Insight)
      WHERE ($groupId = $allGroups OR i.group_id = $groupId)
        AND NOT (i)<-[:SUPERSEDES]-(:Insight)
      RETURN i
      ORDER BY coalesce(i.created_at, datetime()) DESC
      SKIP $offset
      LIMIT $limit
      `,
      { groupId, offset: neo4j.int(offset), limit: neo4j.int(limit), allGroups: ALL_GROUPS },
    )

    const totalValue = toPlainValue(countResult.records[0]?.get("total"))
    return {
      items: dataResult.records.map((record) => mapInsight(record.get("i") as Record<string, unknown>)),
      total: typeof totalValue === "number" ? totalValue : 0,
    }
  })
}

const recallArgsSchema = z
  .object({
    insightId: z.string().min(1).optional(),
    query: z.string().min(1).optional(),
    groupId: z.string().default("allura-roninmemory"),
    limit: z.coerce.number().int().min(1).max(100).default(10),
  })
  .refine((value) => Boolean(value.insightId || value.query), {
    message: "Either insightId or query is required",
  })

const listArgsSchema = z.object({
  groupId: z.string().default("allura-roninmemory"),
  limit: z.coerce.number().int().min(1).max(100).default(10),
  offset: z.coerce.number().int().min(0).default(0),
})

const server = new Server(
  { name: "allura-skill-neo4j-memory", version: "1.0.0" },
  { capabilities: { tools: {} } },
)

server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: [
    {
      name: "recall_insight",
      description: "Recall an approved Insight from Neo4j by ID or text query",
      inputSchema: {
        type: "object",
        properties: {
          insightId: { type: "string" },
          query: { type: "string" },
          groupId: { type: "string", default: "allura-roninmemory" },
          limit: { type: "integer", default: 10, minimum: 1, maximum: 100 },
        },
      },
    },
    {
      name: "list_insights",
      description: "List current Insight nodes for one tenant",
      inputSchema: {
        type: "object",
        properties: {
          groupId: { type: "string", default: "allura-roninmemory" },
          limit: { type: "integer", default: 10, minimum: 1, maximum: 100 },
          offset: { type: "integer", default: 0, minimum: 0 },
        },
      },
    },
  ],
}))

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  try {
    const driver = createDriver()
    try {
      if (request.params.name === "recall_insight") {
        const args = recallArgsSchema.parse(request.params.arguments ?? {})
        const groupId = validateGroupIdOrWildcard(args.groupId)

        const payload = args.insightId
          ? await recallInsightById(driver, args.insightId, groupId)
          : await searchInsightsByText(driver, args.query!, groupId, args.limit)

        return {
          content: [{ type: "text", text: JSON.stringify({ success: true, result: payload }, null, 2) }],
        }
      }

      if (request.params.name === "list_insights") {
        const args = listArgsSchema.parse(request.params.arguments ?? {})
        const groupId = validateGroupIdOrWildcard(args.groupId)
        const payload = await listInsights(driver, groupId, args.limit, args.offset)
        return {
          content: [{ type: "text", text: JSON.stringify({ success: true, ...payload }, null, 2) }],
        }
      }

      throw new Error(`Unknown tool: ${request.params.name}`)
    } finally {
      await driver.close()
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
  console.error("Allura Neo4j Memory Skill MCP Server running on stdio")
}

if (import.meta.main) {
  main().catch((error: Error) => {
    console.error("Fatal error in MCP server:", error)
    process.exit(1)
  })
}
