"use client"

import { useCallback, useMemo, useRef, useState } from "react"
import type { GraphEdge, GraphNode, SearchResult } from "./types"
import { GraphCanvas } from "./GraphCanvas"
import type { GraphCanvasHandle } from "./GraphCanvas"
import { SearchBar } from "./SearchBar"
import { DetailPane } from "./DetailPane"
import { ResultList } from "./ResultList"

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
  const canvasRef = useRef<GraphCanvasHandle>(null)

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

  const handleResultSelect = useCallback((nodeId: string) => {
    setSelectedId(nodeId)
    setQuery("")
  }, [])

  return (
    <div className={`memory-explorer${className ? ` ${className}` : ""}`}>
      <SearchBar
        query={query}
        onChange={setQuery}
        resultListId="memory-explorer-result-list"
        hasResults={searchResults.length > 0}
      />

      {/* Result list — shown when search has results */}
      <ResultList
        results={searchResults}
        onSelect={handleResultSelect}
        id="memory-explorer-result-list"
      />

      {/* Graph canvas — hidden on mobile (§8) */}
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
