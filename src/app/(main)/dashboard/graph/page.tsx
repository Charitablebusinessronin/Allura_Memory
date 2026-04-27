"use client"

import dynamic from "next/dynamic"
import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import {
  ErrorState,
  GraphSummary,
  LoadingState,
  NodeDetailPanel,
  PageHeader,
  WarningList,
} from "@/components/dashboard"
import { loadGraph } from "@/lib/dashboard/queries"
import { tokens } from "@/lib/tokens"
import { getGraphNodeColor, getGraphNodeRadius } from "@/lib/tokens"
import type { DashboardResult, GraphEdge, GraphNode } from "@/lib/dashboard/types"

const ForceGraph2D = dynamic(() => import("react-force-graph-2d"), { ssr: false })

export default function GraphPage() {
  const [state, setState] = useState<DashboardResult<{ nodes: GraphNode[]; edges: GraphEdge[]; totalEdges?: number }> | null>(null)
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null)
  const [hoverNodeId, setHoverNodeId] = useState<string | null>(null)
  const [filterTypes, setFilterTypes] = useState<Set<string>>(new Set())
  const graphRef = useRef<any>(null)

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
    nodes: nodes.map((n) => ({ ...n, id: n.id, val: getGraphNodeRadius(n.type) })),
    links: edges.map((e) => ({ ...e, source: e.source, target: e.target })),
  }), [nodes, edges])

  // Zoom controls — ForceGraph2D exposes zoom via ref (zoom(), centerAt())
  const zoomIn = useCallback(() => {
    if (graphRef.current) {
      graphRef.current.zoom(graphRef.current.zoom() * 1.2, 400)
    }
  }, [])
  const zoomOut = useCallback(() => {
    if (graphRef.current) {
      graphRef.current.zoom(graphRef.current.zoom() * 0.8, 400)
    }
  }, [])
  const fitView = useCallback(() => {
    if (graphRef.current) {
      graphRef.current.zoom(1.0, 400)
      graphRef.current.centerAt(0, 0, 400)
    }
  }, [])

  return (
    <div className="flex h-[calc(100vh-7rem)] flex-col gap-4">
      <PageHeader title="Graph" description="Visualize real Neo4j relationships between memories, insights, agents, and projects." />

      {/* Filter bar */}
      <div className={`flex flex-wrap items-center gap-2 rounded-lg border border-[var(--allura-border-1)] bg-[var(--allura-cream)] px-3 py-2`}>
        <span className={`text-xs font-medium text-[var(--allura-text-2)]`}>Filter:</span>
        {allTypes.map((type) => (
          <button
            key={type}
            type="button"
            onClick={() => toggleType(type)}
            className={`rounded-full px-2.5 py-1 text-xs font-medium transition-colors ${
              activeTypes.has(type)
                ? "text-white"
                : `border border-[var(--allura-border-2)] bg-white text-[var(--allura-text-2)] hover:bg-[var(--allura-muted)]`
            }`}
            style={activeTypes.has(type) ? { backgroundColor: getGraphNodeColor(type) } : undefined}
          >
            {type.charAt(0).toUpperCase() + type.slice(1)}
          </button>
        ))}
        {filterTypes.size > 0 && (
          <button
            type="button"
            onClick={() => setFilterTypes(new Set())}
            className={`ml-auto text-xs text-[var(--allura-blue)] hover:underline`}
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
          <div className={`relative flex flex-1 min-h-0 overflow-hidden rounded-xl border border-[var(--allura-border-1)] bg-[var(--allura-cream)]`}>
            {typeof window !== "undefined" && (
              <ForceGraph2D
                ref={graphRef}
                graphData={graphData}
                nodeLabel={(node: any) => `${node.label} (${node.type})`}
                nodeColor={(node: any) => getGraphNodeColor(node.type)}
                nodeRelSize={1}
                nodeCanvasObject={(node: any, ctx: CanvasRenderingContext2D, globalScale: number) => {
                  const r = getGraphNodeRadius(node.type) / globalScale
                  const isSelected = selectedNodeId === node.id
                  const isHovered = hoverNodeId === node.id
                  const scale = isHovered ? 1.3 : 1
                  const finalR = r * scale
                  const nodeColor = getGraphNodeColor(node.type)

                  // Fill
                  ctx.beginPath()
                  ctx.arc(node.x, node.y, finalR, 0, 2 * Math.PI)
                  ctx.fillStyle = nodeColor
                  ctx.fill()

                  // Border
                  ctx.beginPath()
                  ctx.arc(node.x, node.y, finalR, 0, 2 * Math.PI)
                  ctx.strokeStyle = tokens.color.surface.default
                  ctx.lineWidth = 1 / globalScale
                  ctx.stroke()

                  // Selected ring
                  if (isSelected) {
                    ctx.beginPath()
                    ctx.arc(node.x, node.y, finalR + 4 / globalScale, 0, 2 * Math.PI)
                    ctx.strokeStyle = tokens.color.accent.gold
                    ctx.lineWidth = 2 / globalScale
                    ctx.stroke()
                  }

                  // Label
                  if (globalScale > 0.8 || isSelected || isHovered) {
                    ctx.font = `${500 / globalScale}px IBM Plex Sans, system-ui, sans-serif`
                    ctx.fillStyle = tokens.color.text.secondary
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

            {/* Floating toolbar with real zoom controls */}
            <div className={`absolute bottom-4 left-4 flex items-center gap-1 rounded-lg border border-[var(--allura-border-1)] bg-white p-1.5 shadow-[var(--allura-sh-md)]`}>
              <button type="button" onClick={zoomIn} className={`rounded p-1.5 text-[var(--allura-text-2)] hover:bg-[var(--allura-muted)] hover:text-[var(--allura-charcoal)]`} title="Zoom In">+</button>
              <button type="button" onClick={zoomOut} className={`rounded p-1.5 text-[var(--allura-text-2)] hover:bg-[var(--allura-muted)] hover:text-[var(--allura-charcoal)]`} title="Zoom Out">−</button>
              <button type="button" onClick={fitView} className={`rounded p-1.5 text-[var(--allura-text-2)] hover:bg-[var(--allura-muted)] hover:text-[var(--allura-charcoal)]`} title="Fit View">⟲</button>
            </div>

            {/* Detail sidebar */}
            {selectedNode && (
              <div className={`absolute right-0 top-0 h-full w-[300px] overflow-y-auto border-l border-[var(--allura-border-1)] bg-white shadow-[var(--allura-sh-md)]`}>
                <div className={`flex items-center justify-between border-b border-[var(--allura-border-1)] p-4`}>
                  <span
                    className="rounded px-2 py-0.5 text-xs font-medium text-white"
                    style={{ backgroundColor: getGraphNodeColor(selectedNode.type) }}
                  >
                    {selectedNode.type}
                  </span>
                  <button
                    type="button"
                    onClick={() => setSelectedNodeId(null)}
                    className={`text-[var(--allura-text-3)] hover:text-[var(--allura-charcoal)]`}
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
