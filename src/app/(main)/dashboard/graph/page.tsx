"use client"

import dynamic from "next/dynamic"
import { useCallback, useEffect, useMemo, useState } from "react"
import {
  ErrorState,
  GraphSummary,
  LoadingState,
  NodeDetailPanel,
  PageHeader,
  WarningList,
} from "@/components/dashboard"
import { loadGraph } from "@/lib/dashboard/queries"
import type { DashboardResult, GraphEdge, GraphNode } from "@/lib/dashboard/types"

const ForceGraph2D = dynamic(() => import("react-force-graph-2d"), { ssr: false })

const NODE_COLORS: Record<string, string> = {
  agent: "#1D4ED8",
  project: "#C89B3C",
  outcome: "#157A4A",
  event: "#0F1115",
  insight: "#FF5A2E",
  memory: "#9CA3AF",
  system: "#9CA3AF",
}

const NODE_RADIUS: Record<string, number> = {
  agent: 10,
  project: 10,
  outcome: 7,
  event: 7,
  insight: 7,
  memory: 5,
  system: 5,
}

export default function GraphPage() {
  const [state, setState] = useState<DashboardResult<{ nodes: GraphNode[]; edges: GraphEdge[]; totalEdges?: number }> | null>(null)
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null)
  const [hoverNodeId, setHoverNodeId] = useState<string | null>(null)
  const [filterTypes, setFilterTypes] = useState<Set<string>>(new Set())

  useEffect(() => { void loadGraph().then(setState) }, [])

  const allTypes = useMemo(() => {
    const types = new Set<string>()
    state?.data?.nodes.forEach((n) => types.add(n.type))
    return Array.from(types)
  }, [state?.data?.nodes])

  const activeTypes = useMemo(() => {
    if (filterTypes.size === 0) return new Set(allTypes)
    return filterTypes
  }, [filterTypes, allTypes])

  const nodes = useMemo(() => {
    const base = state?.data?.nodes ?? []
    return base.filter((n) => activeTypes.has(n.type))
  }, [state?.data?.nodes, activeTypes])

  const nodeIds = useMemo(() => new Set(nodes.map((n) => n.id)), [nodes])

  const edges = useMemo(() => {
    const base = state?.data?.edges ?? []
    return base.filter((e) => nodeIds.has(e.source) && nodeIds.has(e.target))
  }, [state?.data?.edges, nodeIds])

  const selectedNode = selectedNodeId ? nodes.find((n) => n.id === selectedNodeId) ?? null : null

  const toggleType = useCallback((type: string) => {
    setFilterTypes((prev) => {
      const next = new Set(prev)
      if (next.has(type)) next.delete(type)
      else next.add(type)
      return next
    })
  }, [])

  const graphData = useMemo(() => ({
    nodes: nodes.map((n) => ({ ...n, id: n.id, val: NODE_RADIUS[n.type] ?? 5 })),
    links: edges.map((e) => ({ ...e, source: e.source, target: e.target })),
  }), [nodes, edges])

  return (
    <div className="flex h-[calc(100vh-7rem)] flex-col gap-4" style={{ fontFamily: "var(--font-ibm-plex-sans)" }}>
      <PageHeader title="Graph View" description="Visualize real Neo4j relationships between memories, insights, agents, and projects." />

      {/* Filter bar */}
      <div className="flex flex-wrap items-center gap-2 rounded-lg border border-[#E5E7EB] bg-[#F6F4EF] px-3 py-2">
        <span className="text-xs font-medium text-[#6B7280]">Filter:</span>
        {allTypes.map((type) => (
          <button
            key={type}
            type="button"
            onClick={() => toggleType(type)}
            className={`rounded-full px-2.5 py-1 text-xs font-medium transition-colors ${
              activeTypes.has(type)
                ? "text-white"
                : "border border-[#D1D5DB] bg-white text-[#6B7280] hover:bg-[#F3F4F6]"
            }`}
            style={activeTypes.has(type) ? { backgroundColor: NODE_COLORS[type] ?? "#9CA3AF" } : undefined}
          >
            {type.charAt(0).toUpperCase() + type.slice(1)}
          </button>
        ))}
        {filterTypes.size > 0 && (
          <button
            type="button"
            onClick={() => setFilterTypes(new Set())}
            className="ml-auto text-xs text-[#1D4ED8] hover:underline"
          >
            Clear
          </button>
        )}
      </div>

      {!state ? (
        <LoadingState />
      ) : state.error ? (
        <ErrorState message={state.error} />
      ) : (
        <>
          <WarningList warnings={state.warnings} />
          <div className="relative flex flex-1 min-h-0 overflow-hidden rounded-xl border border-[#E5E7EB] bg-[#F6F4EF]">
            {typeof window !== "undefined" && (
              <ForceGraph2D
                graphData={graphData}
                nodeLabel={(node: any) => `${node.label} (${node.type})`}
                nodeColor={(node: any) => NODE_COLORS[node.type] ?? "#9CA3AF"}
                nodeRelSize={1}
                nodeCanvasObject={(node: any, ctx: CanvasRenderingContext2D, globalScale: number) => {
                  const r = (NODE_RADIUS[node.type] ?? 5) / globalScale
                  const isSelected = selectedNodeId === node.id
                  const isHovered = hoverNodeId === node.id
                  const scale = isHovered ? 1.3 : 1
                  const finalR = r * scale

                  // Fill
                  ctx.beginPath()
                  ctx.arc(node.x, node.y, finalR, 0, 2 * Math.PI)
                  ctx.fillStyle = NODE_COLORS[node.type] ?? "#9CA3AF"
                  ctx.fill()

                  // Border
                  ctx.beginPath()
                  ctx.arc(node.x, node.y, finalR, 0, 2 * Math.PI)
                  ctx.strokeStyle = "#FFFFFF"
                  ctx.lineWidth = 1 / globalScale
                  ctx.stroke()

                  // Selected ring
                  if (isSelected) {
                    ctx.beginPath()
                    ctx.arc(node.x, node.y, finalR + 4 / globalScale, 0, 2 * Math.PI)
                    ctx.strokeStyle = "#C89B3C"
                    ctx.lineWidth = 2 / globalScale
                    ctx.stroke()
                  }

                  // Label
                  if (globalScale > 0.8 || isSelected || isHovered) {
                    ctx.font = `${500 / globalScale}px IBM Plex Sans, system-ui, sans-serif`
                    ctx.fillStyle = "#6B7280"
                    ctx.textAlign = "center"
                    ctx.fillText(node.label, node.x, node.y + finalR + 12 / globalScale)
                  }
                }}
                linkColor={() => "rgba(156,163,175,0.6)"}
                linkWidth={() => 1}
                linkDirectionalArrowLength={0}
                backgroundColor="transparent"
                onNodeClick={(node: any) => setSelectedNodeId((prev) => (prev === node.id ? null : node.id))}
                onNodeHover={(node: any) => setHoverNodeId(node?.id ?? null)}
                warmupTicks={20}
                cooldownTicks={50}
                enableZoomInteraction={true}
                enablePanInteraction={true}
                enableNodeDrag={true}
              />
            )}

            {/* Floating toolbar */}
            <div className="absolute bottom-4 left-4 flex items-center gap-1 rounded-lg border border-[#E5E7EB] bg-white p-1.5 shadow-[0_4px_6px_-1px_rgba(15,17,21,0.1),0_2px_4px_-2px_rgba(15,17,21,0.1)]">
              <button type="button" onClick={() => {}} className="rounded p-1.5 text-[#6B7280] hover:bg-[#F3F4F6] hover:text-[#0F1115]" title="Zoom In">+</button>
              <button type="button" onClick={() => {}} className="rounded p-1.5 text-[#6B7280] hover:bg-[#F3F4F6] hover:text-[#0F1115]" title="Zoom Out">−</button>
              <button type="button" onClick={() => setSelectedNodeId(null)} className="rounded p-1.5 text-[#6B7280] hover:bg-[#F3F4F6] hover:text-[#0F1115]" title="Fit View">⟲</button>
            </div>

            {/* Detail sidebar */}
            {selectedNode && (
              <div className="absolute right-0 top-0 h-full w-[300px] overflow-y-auto border-l border-[#E5E7EB] bg-white shadow-[0_4px_6px_-1px_rgba(15,17,21,0.1),0_2px_4px_-2px_rgba(15,17,21,0.1)]">
                <div className="flex items-center justify-between border-b border-[#E5E7EB] p-4">
                  <span
                    className="rounded px-2 py-0.5 text-xs font-medium text-white"
                    style={{ backgroundColor: NODE_COLORS[selectedNode.type] ?? "#9CA3AF" }}
                  >
                    {selectedNode.type}
                  </span>
                  <button
                    type="button"
                    onClick={() => setSelectedNodeId(null)}
                    className="text-[#9CA3AF] hover:text-[#0F1115]"
                  >
                    ✕
                  </button>
                </div>
                <NodeDetailPanel node={selectedNode} edges={state.data?.edges ?? []} nodes={state.data?.nodes ?? []} />
              </div>
            )}
          </div>

          <GraphSummary
            nodes={state.data?.nodes ?? []}
            edges={state.data?.edges ?? []}
            totalEdges={state.data?.totalEdges}
            selectedNodeId={selectedNodeId}
            onNodeClick={setSelectedNodeId}
          />
        </>
      )}
    </div>
  )
}
