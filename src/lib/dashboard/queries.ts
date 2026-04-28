import {
  getAuditEvents,
  getCuratorProposals,
  getGraph,
  getHealth,
  getHealthMetrics,
  getInsights,
  getMemoryById,
  getMemoryCount,
  getMemoryList,
  getTraces,
} from "@/lib/dashboard/api"
import {
  mapAuditResponse,
  mapGraph,
  mapInsightsResponse,
  mapMemoriesResponse,
  mapMetrics,
  mapProposalsResponse,
  mapSystemStatus,
  mapTraceToEvidence,
  mapTracesResponse,
  warningFrom,
} from "@/lib/dashboard/mappers"
import type { DashboardOverview, DashboardResult, Evidence, GraphEdge, GraphNode, Insight, Memory } from "@/lib/dashboard/types"

function failure<T>(error: unknown): DashboardResult<T> {
  return {
    data: null,
    error: error instanceof Error ? error.message : "Unknown dashboard data error",
    degraded: false,
    warnings: [],
  }
}

function extractGraphCounts(raw: unknown): { nodeCount?: number; edgeCount?: number } {
  if (!raw || typeof raw !== "object") return {}
  const payload = raw as { node_count?: unknown; total_edges?: unknown }
  return {
    nodeCount: typeof payload.node_count === "number" ? payload.node_count : undefined,
    edgeCount: typeof payload.total_edges === "number" ? payload.total_edges : undefined,
  }
}

export async function loadDashboardOverview(): Promise<DashboardResult<DashboardOverview>> {
  try {
    const [memoryCount, pending, approved, audit, health, healthMetrics, graph] = await Promise.allSettled([
      getMemoryCount(),
      getCuratorProposals({ status: "pending", limit: 6 }),
      getInsights({ status: "active", limit: 6 }),
      getAuditEvents({ limit: 8 }),
      getHealth(),
      getHealthMetrics(),
      getGraph({ stats: true }),
    ])

    const warnings = []
    const degraded = [memoryCount, pending, approved, audit, health, healthMetrics, graph].some(
      (result) => result.status === "fulfilled" && result.value.degraded
    )

    for (const [source, result] of [
      ["memory-count", memoryCount],
      ["pending-insights", pending],
      ["approved-insights", approved],
      ["audit", audit],
      ["health", health],
      ["health-metrics", healthMetrics],
      ["graph", graph],
    ] as const) {
      if (result.status === "fulfilled") warnings.push(...warningFrom(source, result.value.warning))
      else warnings.push({ id: `${source}-error`, source, message: result.reason instanceof Error ? result.reason.message : "Request failed" })
    }

    const pendingInsights = pending.status === "fulfilled" ? mapProposalsResponse(pending.value.data) : []
    const approvedInsights = approved.status === "fulfilled" ? mapInsightsResponse(approved.value.data) : []
    const graphData = graph.status === "fulfilled" ? extractGraphCounts(graph.value.data) : {}
    const failedPromotions = healthMetrics.status === "fulfilled"
      ? Number((healthMetrics.value.data as { degraded?: { promotion_failures_24h?: number } })?.degraded?.promotion_failures_24h ?? 0)
      : 0
    const totalMemories = memoryCount.status === "fulfilled" ? Number(memoryCount.value.data.count ?? 0) : 0

    return {
      data: {
        metrics: mapMetrics(totalMemories, pendingInsights.length, approvedInsights.length, graphData.edgeCount ?? "Unavailable", failedPromotions),
        activity: audit.status === "fulfilled" ? mapAuditResponse(audit.value.data) : [],
        pendingInsights,
        systemStatus: health.status === "fulfilled" ? mapSystemStatus(health.value.data) : { status: "unknown", components: [] },
        warnings,
      },
      error: null,
      degraded,
      warnings,
    }
  } catch (error) {
    return failure(error)
  }
}

export async function loadMemories(query?: string): Promise<DashboardResult<Memory[]>> {
  try {
    const result = await getMemoryList({ query, limit: 50, include_global: true })
    return {
      data: mapMemoriesResponse(result.data),
      error: null,
      degraded: result.degraded,
      warnings: warningFrom("memories", result.warning),
    }
  } catch (error) {
    return failure(error)
  }
}

export async function loadInsights(status = "pending"): Promise<DashboardResult<Insight[]>> {
  try {
    if (status === "pending") {
      const result = await getCuratorProposals({ status: "pending", limit: 50 })
      return { data: mapProposalsResponse(result.data), error: null, degraded: result.degraded, warnings: warningFrom("curator", result.warning) }
    }
    const result = await getInsights({ status, limit: 50 })
    return { data: mapInsightsResponse(result.data), error: null, degraded: result.degraded, warnings: warningFrom("insights", result.warning) }
  } catch (error) {
    return failure(error)
  }
}

export async function loadEvidence(): Promise<DashboardResult<Evidence[]>> {
  try {
    const result = await getTraces({ limit: 50 })
    return { data: mapTracesResponse(result.data), error: null, degraded: result.degraded, warnings: warningFrom("evidence", result.warning) }
  } catch (error) {
    return failure(error)
  }
}

export async function loadEvidenceDetail(id: string): Promise<DashboardResult<Evidence>> {
  try {
    const memory = await getMemoryById(id).catch(() => null)
    if (memory) {
      const memories = mapMemoriesResponse({ memories: [memory.data] })
      const first = memories[0]
      return {
        data: {
          id: first.id,
          title: first.title,
          status: first.status,
          rawLog: first.content,
          source: first.type,
          agent: first.agent,
          project: first.project,
          timestamp: first.timestamp,
          tags: first.tags,
          metadata: { confidence: first.confidence, connectedMemoryCount: first.connectedMemoryCount },
          relatedMemoryId: first.id,
        },
        error: null,
        degraded: memory.degraded,
        warnings: warningFrom("evidence-memory", memory.warning),
      }
    }
    const traces = await getTraces({ limit: 100 })
    const match = (traces.data.traces ?? []).find((trace) => {
      const item = trace as { id?: unknown; trace_id?: unknown; metadata?: { trace_ref?: unknown } }
      return String(item.id ?? item.trace_id ?? item.metadata?.trace_ref ?? "") === id
    })
    if (!match) return { data: null, error: "Evidence was not found in memory or trace stores.", degraded: false, warnings: [] }
    return { data: mapTraceToEvidence(match), error: null, degraded: traces.degraded, warnings: warningFrom("evidence-traces", traces.warning) }
  } catch (error) {
    return failure(error)
  }
}

export async function loadGraph(): Promise<DashboardResult<{ nodes: GraphNode[]; edges: GraphEdge[]; totalEdges?: number }>> {
  try {
    const result = await getGraph()
    return { data: mapGraph(result.data), error: null, degraded: result.degraded, warnings: warningFrom("graph", result.warning) }
  } catch (error) {
    return failure(error)
  }
}

export async function loadGraphNodes(nodeType: string): Promise<DashboardResult<{ nodes: GraphNode[]; edges: GraphEdge[] }>> {
  try {
    const result = await getGraph()
    const mapped = mapGraph(result.data)
    const nodes = mapped.nodes.filter((n) => n.type === nodeType)
    const nodeIds = new Set(nodes.map((n) => n.id))
    const edges = mapped.edges.filter((e) => nodeIds.has(e.source) || nodeIds.has(e.target))
    return { data: { nodes, edges }, error: null, degraded: result.degraded, warnings: warningFrom("graph", result.warning) }
  } catch (error) {
    return failure(error)
  }
}
