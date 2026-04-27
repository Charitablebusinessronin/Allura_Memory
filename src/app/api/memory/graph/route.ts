import { NextRequest, NextResponse } from "next/server"

import { forbiddenResponse, requireRole, unauthorizedResponse } from "@/lib/auth/api-auth"
import { readTransaction } from "@/lib/neo4j/connection"
import { validateGroupId, GroupIdValidationError } from "@/lib/validation/group-id"

const EDGE_LABELS = new Set(["performed", "resulted_in", "generated", "applies_to", "connected_to", "caused_by"])

function nodeType(labels: string[]): string {
  const joined = labels.join(" ").toLowerCase()
  if (joined.includes("agent")) return "agent"
  if (joined.includes("project")) return "project"
  if (joined.includes("insight")) return "insight"
  if (joined.includes("outcome")) return "outcome"
  if (joined.includes("event") || joined.includes("trace")) return "event"
  if (joined.includes("system")) return "system"
  return "memory"
}

function edgeLabel(type: string): "performed" | "resulted_in" | "generated" | "applies_to" | "connected_to" | "caused_by" {
  const normalized = type.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "")
  return EDGE_LABELS.has(normalized) ? normalized as ReturnType<typeof edgeLabel> : "connected_to"
}

export async function GET(request: NextRequest) {
  const roleCheck = requireRole(request, "viewer")
  if (!roleCheck.user) return unauthorizedResponse()
  if (!roleCheck.allowed) return forbiddenResponse(roleCheck)

  const { searchParams } = new URL(request.url)
  const rawGroupId = searchParams.get("group_id")
  if (!rawGroupId) return NextResponse.json({ error: "group_id is required" }, { status: 400 })

  let groupId: string
  try {
    groupId = validateGroupId(rawGroupId)
  } catch (error) {
    if (error instanceof GroupIdValidationError) return NextResponse.json({ error: error.message }, { status: 400 })
    throw error
  }

  try {
    const [countResult, result] = await Promise.all([
      readTransaction(async (tx) => {
        return await tx.run(
          `MATCH (source)-[relationship]-(target)
           WHERE source.group_id = $groupId AND target.group_id = $groupId
           RETURN count(relationship) AS total`,
          { groupId }
        )
      }),
      readTransaction(async (tx) => {
        return await tx.run(
          `MATCH (source)-[relationship]-(target)
           WHERE source.group_id = $groupId AND target.group_id = $groupId
           RETURN source, relationship, target
           LIMIT 150`,
          { groupId }
        )
      }),
    ])

    const totalEdges = countResult.records[0]?.get("total")?.toNumber?.() ?? 0

    const nodeMap = new Map<string, { id: string; label: string; type: string; metadata: Record<string, unknown> }>()
    const edges: Array<{ id: string; source: string; target: string; label: ReturnType<typeof edgeLabel>; metadata: Record<string, unknown> }> = []

    for (const record of result.records) {
      const source = record.get("source")
      const target = record.get("target")
      const relationship = record.get("relationship")
      const sourceProps = source.properties as Record<string, unknown>
      const targetProps = target.properties as Record<string, unknown>
      const sourceId = String(sourceProps.id ?? source.elementId)
      const targetId = String(targetProps.id ?? target.elementId)
      nodeMap.set(sourceId, {
        id: sourceId,
        label: String(sourceProps.title ?? sourceProps.name ?? sourceProps.content ?? sourceId).slice(0, 80),
        type: nodeType(source.labels as string[]),
        metadata: {},
      })
      nodeMap.set(targetId, {
        id: targetId,
        label: String(targetProps.title ?? targetProps.name ?? targetProps.content ?? targetId).slice(0, 80),
        type: nodeType(target.labels as string[]),
        metadata: {},
      })
      edges.push({
        id: String(relationship.properties?.id ?? relationship.elementId),
        source: sourceId,
        target: targetId,
        label: edgeLabel(relationship.type),
        metadata: { relationship_type: relationship.type },
      })
    }

    return NextResponse.json({ nodes: Array.from(nodeMap.values()), edges, total_edges: totalEdges })
  } catch (error) {
    console.error("Failed to fetch memory graph:", error)
    return NextResponse.json({ error: "Failed to fetch memory graph" }, { status: 500 })
  }
}
