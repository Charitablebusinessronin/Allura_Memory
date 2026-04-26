"use client"

import { useEffect, useState } from "react"

import { ErrorState, GraphSummary, LoadingState, NodeDetailPanel, PageHeader, WarningList } from "@/components/dashboard"
import { loadGraph } from "@/lib/dashboard/queries"
import type { DashboardResult, GraphEdge, GraphNode } from "@/lib/dashboard/types"

export default function GraphPage() {
  const [state, setState] = useState<DashboardResult<{ nodes: GraphNode[]; edges: GraphEdge[]; totalEdges?: number }> | null>(null)
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null)
  useEffect(() => { void loadGraph().then(setState) }, [])

  const nodes = state?.data?.nodes ?? []
  const edges = state?.data?.edges ?? []
  const selectedNode = selectedNodeId ? nodes.find((n) => n.id === selectedNodeId) ?? null : null

  return (
    <div className="space-y-6" style={{ fontFamily: "var(--font-ibm-plex-sans)" }}>
      <PageHeader title="Graph View" description="Visualize real Neo4j relationships between memories, insights, agents, and projects." />
      {!state ? <LoadingState /> : state.error ? <ErrorState message={state.error} /> : (
        <>
          <WarningList warnings={state.warnings} />
          <GraphSummary
            nodes={nodes}
            edges={edges}
            totalEdges={state.data?.totalEdges}
            selectedNodeId={selectedNodeId}
            onNodeClick={setSelectedNodeId}
          />
          <NodeDetailPanel node={selectedNode} edges={edges} nodes={nodes} />
        </>
      )}
    </div>
  )
}