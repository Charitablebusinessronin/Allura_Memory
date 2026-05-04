"use client"

import dynamic from "next/dynamic"
import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { Search, SlidersHorizontal } from "lucide-react"

import {
  ExplorerStatusBar,
  KnowledgeLayersPanel,
  MemoryUsagePanel,
  RecentConnectionsTable,
  ReviewQueuePanel,
  SystemHealthPanel,
  SystemOverviewPanel,
} from "@/components/memory-explorer"
import { NodeDetailPanel } from "@/components/dashboard"

// Types for the explorer data
import type { GraphNode, GraphEdge } from "@/lib/dashboard/types"
import {
  loadGraph,
  loadDashboardOverview,
  loadCuratorQueue,
} from "@/lib/dashboard/queries"
import { getHealthMetrics } from "@/lib/dashboard/api"

const ForceGraph2D = dynamic(() => import("react-force-graph-2d"), { ssr: false })

// ─── Fallback demo graph — Allura Memory content model ───────────────────────
// Used when live data is unavailable (graceful degradation)
const FALLBACK_NODES: GraphNode[] = [
  { id: "n1",  label: "MCP Auth Failure",       type: "memory"  },
  { id: "n2",  label: "Missing DB Secrets",      type: "memory"  },
  { id: "n3",  label: "Postgres Auth Failed",    type: "memory"  },
  { id: "n4",  label: "Agent Brooks",            type: "agent"   },
  { id: "n5",  label: "Allura Core",             type: "system"  },
  { id: "n6",  label: "Insight: Add Secret Check", type: "insight" },
  { id: "n7",  label: "Evidence: Error Log",     type: "evidence" },
  { id: "n8",  label: "Project: Allura Memory",  type: "project" },
  { id: "n9",  label: "Tool Retry Without Context", type: "memory" },
  { id: "n10", label: "User Onboarding Dropoff", type: "memory"  },
  { id: "n11", label: "Retrieval Pattern",       type: "memory"  },
  { id: "n12", label: "Promotion Candidate",     type: "insight" },
]

const FALLBACK_EDGES = [
  { id: "e1",  source: "n2", target: "n1",  label: "caused"      },
  { id: "e2",  source: "n2", target: "n3",  label: "led to"      },
  { id: "e3",  source: "n4", target: "n1",  label: "observed"    },
  { id: "e4",  source: "n7", target: "n6",  label: "supports"    },
  { id: "e5",  source: "n6", target: "n8",  label: "informs"     },
  { id: "e6",  source: "n4", target: "n9",  label: "triggered"   },
  { id: "e7",  source: "n5", target: "n2",  label: "missing"     },
  { id: "e8",  source: "n10", target: "n8", label: "impacts"     },
  { id: "e9",  source: "n11", target: "n12",label: "candidate"   },
  { id: "e10", source: "n12", target: "n6", label: "promotes to" },
  { id: "e11", source: "n1",  target: "n3", label: "triggered"   },
]

// Brand color per node type
const NODE_COLORS: Record<string, string> = {
  memory:   "#1D4ED8",  // blue
  insight:  "#157A44",  // green
  evidence: "#C89B3C",  // gold
  agent:    "#FF5A2E",  // orange
  project:  "#157A44",  // green
  system:   "#111827",  // charcoal
}

function nodeColor(type: string) {
  return NODE_COLORS[type] ?? "#6B7280"
}

const NODE_RADII: Record<string, number> = {
  system: 9, project: 8, agent: 7, insight: 6, memory: 5, evidence: 4,
}

// Type definitions for the explorer data
interface ExplorerData {
  graph: { nodes: GraphNode[]; edges: GraphEdge[] }
  overview: { metrics: any[]; systemStatus: any }
  reviewQueue: any[]
  healthMetrics: any
}

export default function MemoryExplorerPage() {
  const graphRef = useRef<any>(null)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [hoverId, setHoverId]       = useState<string | null>(null)
  const [query, setQuery]           = useState("")
  const [filterType, setFilterType] = useState<string>("all")
  
  // Data state
  const [liveData, setLiveData] = useState<ExplorerData | null>(null)
  const [loading, setLoading] = useState(true)
  const [degraded, setDegraded] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  // Data fetching on mount
  useEffect(() => {
    async function fetchAll() {
      try {
        const [graphResult, overviewResult, reviewResult, healthResult] = await Promise.allSettled([
          loadGraph(),
          loadDashboardOverview(),
          loadCuratorQueue("pending"),
          getHealthMetrics(),
        ])
        
        const graphData = graphResult.status === "fulfilled" && graphResult.value.data
          ? graphResult.value.data
          : null
        const overviewData = overviewResult.status === "fulfilled" && overviewResult.value.data
          ? { metrics: overviewResult.value.data.metrics || [], systemStatus: overviewResult.value.data.systemStatus || { status: "unknown", components: [] } }
          : null
        const reviewQueue = reviewResult.status === "fulfilled" && reviewResult.value.data
          ? reviewResult.value.data
          : []
        const healthMetrics = healthResult.status === "fulfilled" && healthResult.value.data
          ? healthResult.value.data
          : null
        
        // Check for any failures
        const hasFailures = [graphResult, overviewResult, reviewResult, healthResult].some(
          (r) => r.status === "rejected" || (r.status === "fulfilled" && r.value.degraded)
        )
        
        if (hasFailures) {
          setDegraded(true)
          setErrorMessage("Could not load live data — showing preview")
        }
        
        if (graphData && overviewData) {
          setLiveData({
            graph: graphData,
            overview: overviewData,
            reviewQueue,
            healthMetrics,
          })
        } else {
          // Keep liveData null and fall back to fallback data
          setDegraded(true)
          setErrorMessage("Could not load live data — showing preview")
        }
      } catch (error) {
        setDegraded(true)
        setErrorMessage("Could not load live data — showing preview")
      } finally {
        setLoading(false)
      }
    }
    fetchAll()
  }, [])

  // Use liveData ?? fallback data
  const nodes = liveData?.graph.nodes ?? FALLBACK_NODES
  const edges = liveData?.graph.edges ?? FALLBACK_EDGES

  // Filter nodes by type + search
  const visibleNodes = useMemo(() => {
    return nodes.filter((n) => {
      const matchType  = filterType === "all" || n.type === filterType
      const matchQuery = !query || n.label.toLowerCase().includes(query.toLowerCase())
      return matchType && matchQuery
    })
  }, [filterType, query, nodes])

  const visibleIds = useMemo(() => new Set(visibleNodes.map((n) => n.id)), [visibleNodes])

  const visibleEdges = useMemo(
    () => edges.filter((e) => visibleIds.has(e.source) && visibleIds.has(e.target)),
    [visibleIds, edges]
  )

  const graphData = useMemo(() => ({
    nodes: visibleNodes.map((n) => ({ ...n, val: NODE_RADII[n.type] ?? 5 })),
    links: visibleEdges.map((e) => ({ source: e.source, target: e.target })),
  }), [visibleNodes, visibleEdges])

  const selectedNode = selectedId ? nodes.find((n) => n.id === selectedId) ?? null : null

  const zoomIn  = useCallback(() => graphRef.current?.zoom(graphRef.current.zoom() * 1.2, 300), [])
  const zoomOut = useCallback(() => graphRef.current?.zoom(graphRef.current.zoom() * 0.8, 300), [])
  const fitView = useCallback(() => { graphRef.current?.zoom(1, 300); graphRef.current?.centerAt(0, 0, 300) }, [])

  const allTypes = useMemo(
    () => ["all", ...Array.from(new Set(FALLBACK_NODES.map((n) => n.type)))],
    []
  )

  return (
    // Break out of parent padding using negative margins
    <div
      className="-mx-4 -my-6 sm:-mx-6 sm:-my-8 lg:-mx-8 lg:-py-8 flex flex-col"
      style={{ height: "calc(100vh - 3.5rem)" }}
    >
      {/* ── Top search bar ─────────────────────────────────── */}
      <div className="flex items-center gap-3 border-b border-[var(--allura-border-1)] bg-[var(--allura-white)] px-4 py-2.5 shrink-0">
        <div className="flex flex-1 items-center gap-2 rounded-md border border-[var(--allura-border-1)] bg-[var(--allura-gray-100)] px-3 py-1.5">
          <Search size={13} className="shrink-0 text-[var(--allura-gray-400)]" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search memories, insights, agents, projects..."
            className="flex-1 bg-transparent text-[12px] text-[var(--allura-charcoal)] placeholder:text-[var(--allura-gray-400)] outline-none"
          />
        </div>
        <div className="flex items-center gap-1">
          {allTypes.map((t) => (
            <button
              key={t}
              onClick={() => setFilterType(t)}
              className={`rounded px-2.5 py-1 text-[10px] font-medium capitalize transition-colors ${
                filterType === t
                  ? "text-white"
                  : "text-[var(--allura-gray-500)] hover:bg-[var(--allura-gray-100)]"
              }`}
              style={filterType === t ? { backgroundColor: t === "all" ? "var(--allura-charcoal)" : nodeColor(t) } : undefined}
            >
              {t}
            </button>
          ))}
        </div>
        <button className="flex items-center gap-1.5 rounded border border-[var(--allura-border-1)] px-2.5 py-1 text-[10px] text-[var(--allura-gray-500)] hover:bg-[var(--allura-gray-100)]">
          <SlidersHorizontal size={11} />
          Tune
        </button>
      </div>

      {/* ── Main 2-column area ─────────────────────────────── */}
      <div className="flex flex-1 min-h-0 overflow-hidden">

        {/* ── LEFT: Graph + Connections table ──────────────── */}
        <div className="flex flex-col flex-1 min-w-0 border-r border-[var(--allura-border-1)] overflow-hidden">

          {/* Graph header */}
          <div className="flex items-center justify-between border-b border-[var(--allura-border-1)] bg-[var(--allura-white)] px-4 py-2.5 shrink-0">
            <div className="flex items-center gap-2.5">
              <span className="text-[11px] font-semibold uppercase tracking-widest text-[var(--allura-charcoal)]">
                Active Knowledge Network
              </span>
              <span className="inline-flex items-center gap-1 rounded-full bg-[color-mix(in_srgb,var(--allura-green)_10%,white)] px-2 py-0.5 text-[9px] font-bold uppercase tracking-widest text-[var(--allura-green)]">
                <span className="size-1.5 animate-pulse rounded-full bg-[var(--allura-green)]" />
                Live
              </span>
            </div>
            <div className="flex items-center gap-3 text-[10px] text-[var(--allura-gray-400)]">
              <span>{visibleNodes.length} nodes · {visibleEdges.length} connections</span>
            </div>
          </div>

          {/* Graph canvas */}
          <div className="relative flex-1 min-h-0 bg-[var(--allura-cream)]">
            {typeof window !== "undefined" && (
              <ForceGraph2D
                ref={graphRef}
                graphData={graphData}
                nodeLabel={(n: any) => `${n.label} [${n.type}]`}
                nodeColor={(n: any) => nodeColor(n.type)}
                nodeRelSize={1}
                nodeCanvasObject={(node: any, ctx: CanvasRenderingContext2D, gs: number) => {
                  const r = (NODE_RADII[node.type] ?? 5) / gs * 2.5
                  const isSelected = selectedId === node.id
                  const isHovered  = hoverId === node.id
                  const scale = isHovered ? 1.25 : 1
                  const fr = r * scale

                  // Node fill
                  ctx.beginPath()
                  ctx.arc(node.x, node.y, fr, 0, Math.PI * 2)
                  ctx.fillStyle = nodeColor(node.type)
                  ctx.fill()

                  // White border
                  ctx.beginPath()
                  ctx.arc(node.x, node.y, fr, 0, Math.PI * 2)
                  ctx.strokeStyle = "#ffffff"
                  ctx.lineWidth = 1 / gs
                  ctx.stroke()

                  // Gold selection ring
                  if (isSelected) {
                    ctx.beginPath()
                    ctx.arc(node.x, node.y, fr + 4 / gs, 0, Math.PI * 2)
                    ctx.strokeStyle = "#C89B3C"
                    ctx.lineWidth = 2 / gs
                    ctx.stroke()
                  }

                  // Label
                  if (gs > 0.7 || isSelected || isHovered) {
                    ctx.font = `${Math.min(11, 500 / gs)}px IBM Plex Sans, system-ui, sans-serif`
                    ctx.fillStyle = "#374151"
                    ctx.textAlign = "center"
                    ctx.fillText(node.label, node.x, node.y + fr + 10 / gs)
                  }
                }}
                linkColor={() => "rgba(107,114,128,0.35)"}
                linkWidth={() => 1}
                linkDirectionalArrowLength={4}
                linkDirectionalArrowRelPos={1}
                backgroundColor="transparent"
                onNodeClick={(n: any) => setSelectedId((p) => (p === n.id ? null : n.id))}
                onNodeHover={(n: any) => setHoverId(n?.id ?? null)}
                warmupTicks={20}
                cooldownTicks={60}
              />
            )}

            {/* Zoom controls */}
            <div className="absolute bottom-4 left-4 flex items-center gap-0.5 rounded-lg border border-[var(--allura-border-1)] bg-white/90 p-1 shadow-sm backdrop-blur">
              <button onClick={zoomIn}  className="rounded px-2 py-1 text-sm text-[var(--allura-gray-500)] hover:bg-[var(--allura-gray-100)] hover:text-[var(--allura-charcoal)]">+</button>
              <button onClick={zoomOut} className="rounded px-2 py-1 text-sm text-[var(--allura-gray-500)] hover:bg-[var(--allura-gray-100)] hover:text-[var(--allura-charcoal)]">−</button>
              <button onClick={fitView} className="rounded px-2 py-1 text-sm text-[var(--allura-gray-500)] hover:bg-[var(--allura-gray-100)] hover:text-[var(--allura-charcoal)]">⟲</button>
            </div>

            {/* Color legend */}
            <div className="absolute bottom-4 right-4 flex flex-col gap-1 rounded-lg border border-[var(--allura-border-1)] bg-white/90 p-2.5 shadow-sm backdrop-blur">
              {Object.entries(NODE_COLORS).map(([type, color]) => (
                <div key={type} className="flex items-center gap-1.5">
                  <span className="size-2 rounded-full" style={{ backgroundColor: color }} />
                  <span className="text-[9px] capitalize text-[var(--allura-gray-500)]">{type}</span>
                </div>
              ))}
            </div>

            {/* Node detail panel */}
            {selectedNode && (
              <div className="absolute right-0 top-0 h-full w-[280px] overflow-y-auto border-l border-[var(--allura-border-1)] bg-white shadow-lg">
                <div className="flex items-center justify-between border-b border-[var(--allura-border-1)] p-3">
                  <span
                    className="rounded px-2 py-0.5 text-[10px] font-semibold text-white capitalize"
                    style={{ backgroundColor: nodeColor(selectedNode.type) }}
                  >
                    {selectedNode.type}
                  </span>
                  <button
                    onClick={() => setSelectedId(null)}
                    className="text-xs text-[var(--allura-gray-400)] hover:text-[var(--allura-charcoal)]"
                  >
                    ✕
                  </button>
                </div>
                <div className="p-3">
                  <p className="text-[12px] font-semibold text-[var(--allura-charcoal)] mb-2">{selectedNode.label}</p>
                  <div className="space-y-1">
                    {FALLBACK_EDGES.filter((e) => e.source === selectedNode.id || e.target === selectedNode.id).map((e) => {
                      const other = e.source === selectedNode.id
                        ? FALLBACK_NODES.find((n) => n.id === e.target)
                        : FALLBACK_NODES.find((n) => n.id === e.source)
                      const dir = e.source === selectedNode.id ? "→" : "←"
                      return other ? (
                        <div key={e.id} className="flex items-start gap-1.5 text-[10px] text-[var(--allura-gray-500)]">
                          <span className="text-[var(--allura-gray-400)]">{dir}</span>
                          <span className="italic">{e.label}</span>
                          <span
                            className="font-medium"
                            style={{ color: nodeColor(other.type) }}
                          >
                            {other.label}
                          </span>
                        </div>
                      ) : null
                    })}
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Recent connections table */}
          <div className="h-44 shrink-0 border-t border-[var(--allura-border-1)] bg-[var(--allura-white)] overflow-hidden">
            <RecentConnectionsTable />
          </div>
        </div>

        {/* ── RIGHT: System panels ──────────────────────────── */}
        <div
          className="w-[400px] shrink-0 overflow-y-auto bg-[var(--allura-white)]"
          style={{ scrollbarWidth: "thin" }}
        >
          <SystemOverviewPanel />
          <MemoryUsagePanel />
          <ReviewQueuePanel />
          <KnowledgeLayersPanel />
          <SystemHealthPanel />
        </div>
      </div>

      {/* ── Bottom status bar ─────────────────────────────── */}
      <ExplorerStatusBar />
    </div>
  )
}
