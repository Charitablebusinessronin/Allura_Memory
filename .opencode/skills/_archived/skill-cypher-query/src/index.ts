#!/usr/bin/env bun

import { Server } from "@modelcontextprotocol/sdk/server/index.js"
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js"
import { CallToolRequestSchema, ListToolsRequestSchema } from "@modelcontextprotocol/sdk/types.js"
import neo4j, { type Driver, type Session } from "neo4j-driver"
import { z } from "zod"

const GROUP_ID_PATTERN = /^allura-[a-z0-9-]+$/
const ALL_GROUPS = "allura-*"

export function validateGroupIdOrWildcard(groupId: unknown): string {
  if (typeof groupId !== "string") throw new Error("groupId must be a string")
  const trimmed = groupId.trim()
  if (trimmed === ALL_GROUPS) return trimmed
  if (!GROUP_ID_PATTERN.test(trimmed)) throw new Error("groupId must match ^allura-[a-z0-9-]+$")
  return trimmed
}

export function isReadOnlyCypher(query: string): boolean {
  const cleaned = query.replace(/\/\*[\s\S]*?\*\//g, " ").replace(/--.*$/gm, " ").trim()
  const upper = cleaned.toUpperCase()
  if (!upper) return false

  const forbidden = /\b(CREATE|MERGE|SET|DELETE|REMOVE|DROP|LOAD\s+CSV|CALL\s+DBMS\.PROCEDURES|CALL\s+APOC\.[A-Z0-9_]+\.WRITE)\b/
  if (forbidden.test(upper)) return false

  return /^(MATCH|WITH|RETURN|UNWIND|CALL|SHOW|OPTIONAL MATCH|EXPLAIN|PROFILE)\b/.test(upper)
}

function isSchemaCypher(query: string): boolean {
  return /^(SHOW|CALL\s+DB\.(LABELS|RELATIONSHIPTYPES|PROPERTYKEYS))\b/i.test(query.trim())
}

export function requiresTenantScope(query: string, groupId: string): void {
  if (groupId === ALL_GROUPS || isSchemaCypher(query)) return
  if (!/group_id|\$groupId/i.test(query)) {
    throw new Error("Cypher query must explicitly scope by group_id or use the $groupId parameter")
  }
}

function createDriver(): Driver {
  return neo4j.driver(
    process.env.NEO4J_URI ?? "bolt://localhost:7687",
    neo4j.auth.basic(process.env.NEO4J_USER ?? "neo4j", process.env.NEO4J_PASSWORD ?? "password"),
  )
}

async function withSession<T>(driver: Driver, fn: (session: Session) => Promise<T>): Promise<T> {
  const session = driver.session({ defaultAccessMode: neo4j.session.READ })
  try {
    return await fn(session)
  } finally {
    await session.close()
  }
}

function toPlainValue(value: unknown): unknown {
  if (value === null || value === undefined) return value
  if (Array.isArray(value)) return value.map(toPlainValue)
  if (typeof value === "object") {
    if ("properties" in (value as Record<string, unknown>)) return toPlainValue((value as { properties: unknown }).properties)
    if (typeof (value as { toNumber?: () => number }).toNumber === "function") return (value as { toNumber: () => number }).toNumber()
    const objectValue: Record<string, unknown> = {}
    for (const [key, entry] of Object.entries(value as Record<string, unknown>)) objectValue[key] = toPlainValue(entry)
    return objectValue
  }
  return value
}

export async function executeReadOnlyCypher(
  driver: Driver,
  cypher: string,
  parameters: Record<string, unknown>,
  groupId: string,
): Promise<{ records: Record<string, unknown>[]; fields: string[] }> {
  return withSession(driver, async (session) => {
    const result = await session.run(cypher, { ...parameters, groupId })
    const fields = result.records[0]?.keys.map((key) => String(key)) ?? []
    return {
      fields,
      records: result.records.map((record) => {
        const shaped: Record<string, unknown> = {}
        for (const key of fields) {
          shaped[key] = toPlainValue(record.get(key))
        }
        return shaped
      }),
    }
  })
}

export async function getSchemaInfo(driver: Driver): Promise<Record<string, unknown>> {
  return withSession(driver, async (session) => {
    // Must run sequentially — Neo4j does not allow parallel queries on one session
    const labels = await session.run("CALL db.labels()")
    const relationshipTypes = await session.run("CALL db.relationshipTypes()")
    const propertyKeys = await session.run("CALL db.propertyKeys()")

    return {
      nodeLabels: labels.records.map((record) => String(record.get(0))),
      relationshipTypes: relationshipTypes.records.map((record) => String(record.get(0))),
      propertyKeys: propertyKeys.records.map((record) => String(record.get(0))),
      sampledAt: new Date().toISOString(),
    }
  })
}

const executeArgsSchema = z.object({
  cypher: z.string().min(1),
  parameters: z.record(z.unknown()).default({}),
  groupId: z.string().default("allura-roninmemory"),
})

const schemaArgsSchema = z.object({
  groupId: z.string().default("allura-roninmemory"),
})

const server = new Server(
  { name: "allura-skill-cypher-query", version: "1.0.0" },
  { capabilities: { tools: {} } },
)

server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: [
    {
      name: "execute_cypher",
      description: "Execute a read-only Cypher query against Neo4j",
      inputSchema: {
        type: "object",
        properties: {
          cypher: { type: "string" },
          parameters: { type: "object", additionalProperties: true, default: {} },
          groupId: { type: "string", default: "allura-roninmemory" },
        },
        required: ["cypher"],
      },
    },
    {
      name: "get_schema_info",
      description: "Read Neo4j schema information",
      inputSchema: { type: "object", properties: { groupId: { type: "string", default: "allura-roninmemory" } } },
    },
  ],
}))

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  try {
    const driver = createDriver()
    try {
      if (request.params.name === "execute_cypher") {
        const args = executeArgsSchema.parse(request.params.arguments ?? {})
        const groupId = validateGroupIdOrWildcard(args.groupId)
        if (!isReadOnlyCypher(args.cypher)) {
          throw new Error("Only read-only Cypher queries are allowed")
        }
        requiresTenantScope(args.cypher, groupId)
        const result = await executeReadOnlyCypher(driver, args.cypher, args.parameters, groupId)
        return { content: [{ type: "text", text: JSON.stringify({ success: true, ...result }, null, 2) }] }
      }

      if (request.params.name === "get_schema_info") {
        schemaArgsSchema.parse(request.params.arguments ?? {})
        const result = await getSchemaInfo(driver)
        return { content: [{ type: "text", text: JSON.stringify({ success: true, schema: result }, null, 2) }] }
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
  console.error("Allura Cypher Query Skill MCP Server running on stdio")
}

if (import.meta.main) {
  main().catch((error: Error) => {
    console.error("Fatal error in MCP server:", error)
    process.exit(1)
  })
}
