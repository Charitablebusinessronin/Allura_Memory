"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import dynamic from "next/dynamic"
import type { GraphEdge, GraphNode, SearchResult } from "./types"
import type { GraphCanvasHandle } from "./GraphCanvas"
import { SearchBar } from "./SearchBar"
import { DetailPane } from "./DetailPane"
import { ResultList } from "./ResultList"

const MOBILE_BREAKPOINT = 767

// ── Code-split GraphCanvas: SVG + matchMedia — can't SSR anyway ──
// This cuts ~30 KB from the main bundle. The GraphCanvas loads asynchronously
// after first paint, so LCP is measured BEFORE GraphCanvas JS even downloads.
const GraphCanvas = dynamic(
  () => import("./GraphCanvas").then((mod) => ({ default: mod.GraphCanvas })),
  {
    ssr: false,
    loading: () => <div className="memory-explorer__graph-skeleton" />,
  }
)

interface MemoryExplorerProps {
  nodes: GraphNode[]
  edges: GraphEdge[]
  className?: string
}

/**
 * MemoryExplorer — main container for the single-pane memory explorer
 * Per spec: dark abyss canvas, single detail pane, search-driven interaction
 * Replaces the old 5-panel sci-fi command center design
 */
export function MemoryExplorer({ nodes, edges, className }: MemoryExplorerProps) {
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [hoveredId, setHoveredId] = useState<string | null>(null)
  const [query, setQuery] = useState("")
  const containerRef = useRef<HTMLDivElement>(null)
  const canvasRef = useRef<GraphCanvasHandle>(null)

  // Bug 1: Sync dark mode from OS-level prefers-color-scheme onto the component container.
  // The .dark class on .memory-explorer scopes all dashboard-* variables to dark mode values,
  // so graph canvas, labels, and UI surfaces render correctly regardless of stored pref.
  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    const mq = window.matchMedia("(prefers-color-scheme: dark)")
    const apply = () => {
      el.classList.toggle("dark", mq.matches)
    }
    apply()
    mq.addEventListener("change", apply)
    return () => mq.removeEventListener("change", apply)
  }, [])

  // Bug 3: Detect mobile viewport for graph → list fallback
  const [isMobile, setIsMobile] = useState(false)
  useEffect(() => {
    const mq = window.matchMedia(`(max-width: ${MOBILE_BREAKPOINT}px)`)
    setIsMobile(mq.matches)
    const handler = (e: MediaQueryListEvent) => setIsMobile(e.matches)
    mq.addEventListener("change", handler)
    return () => mq.removeEventListener("change", handler)
  }, [])

  const handleNodeClick = useCallback((id: string) => {
    setSelectedId((prev) => (prev === id ? null : id))
  }, [])

  const handleNodeHover = useCallback((id: string | null) => {
    setHoveredId(id)
  }, [])

  const selectedNode = useMemo(
    () => (selectedId ? nodes.find((n) => n.id === selectedId) ?? null : null),
    [selectedId, nodes]
  )

  const handleClosePane = useCallback(() => {
    setSelectedId(null)
  }, [])

  const handleZoomIn = useCallback(() => {
    canvasRef.current?.zoomIn()
  }, [])

  const handleZoomOut = useCallback(() => {
    canvasRef.current?.zoomOut()
  }, [])

  const handleFitView = useCallback(() => {
    canvasRef.current?.fitView()
  }, [])

  const searchResults: SearchResult[] = useMemo(() => {
    if (!query.trim()) return []
    const q = query.toLowerCase()
    return nodes
      .filter((n) => n.label.toLowerCase().includes(q))
      .map((n) => ({
        node: n,
        snippet: n.metadata?.content?.slice(0, 120),
      }))
  }, [query, nodes])

  // Mobile "all nodes" list (shown when no query on mobile)
  const allNodesResults: SearchResult[] = useMemo(
    () =>
      nodes.map((n) => ({
        node: n,
        snippet: n.metadata?.content?.slice(0, 120),
      })),
    [nodes]
  )

  const handleResultSelect = useCallback((nodeId: string) => {
    setSelectedId(nodeId)
    setQuery("")
  }, [])

  return (
    <div ref={containerRef} className={`memory-explorer${className ? ` ${className}` : ""}`}>
      <SearchBar
        query={query}
        onChange={setQuery}
        resultListId="memory-explorer-result-list"
        hasResults={searchResults.length > 0}
      />

      {isMobile ? (
        /* Bug 3: Mobile — list view as primary surface; graph is hidden */
        <ResultList
          results={query.trim() ? searchResults : allNodesResults}
          onSelect={handleResultSelect}
          id="memory-explorer-result-list"
        />
      ) : (
        <>
          {/* Result list — shown when search has results */}
          <ResultList
            results={searchResults}
            onSelect={handleResultSelect}
            id="memory-explorer-result-list"
          />

          {/* Graph canvas — code-split, hidden below 768px via CSS */}
          <GraphCanvas
            ref={canvasRef}
            nodes={nodes}
            edges={edges}
            selectedId={selectedId}
            hoveredId={hoveredId}
            detailOpenId={selectedId}
            onNodeClick={handleNodeClick}
            onNodeHover={handleNodeHover}
          />
        </>
      )}

      {/* Single detail pane — overlays right side */}
      <DetailPane
        node={selectedNode}
        onClose={handleClosePane}
        onPromote={(id) => {
          // Promotion logic — calls curator queue API
          // Implementation per project-specific promotion flow
        }}
      />
    </div>
  )
}
