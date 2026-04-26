"use client"

import { useEffect, useState } from "react"

import { ErrorState, GraphSummary, LoadingState, PageHeader, WarningList } from "@/components/dashboard"
import { loadGraph } from "@/lib/dashboard/queries"
import type { DashboardResult, GraphEdge, GraphNode } from "@/lib/dashboard/types"

export default function GraphPage() {
  const [state, setState] = useState<DashboardResult<{ nodes: GraphNode[]; edges: GraphEdge[]; totalEdges?: number }> | null>(null)
  useEffect(() => { void loadGraph().then(setState) }, [])
  return <div className="space-y-6"><PageHeader title="Graph View" description="Visualize real Neo4j relationships between memories, insights, agents, and projects." />{!state ? <LoadingState /> : state.error ? <ErrorState message={state.error} /> : <><WarningList warnings={state.warnings} /><GraphSummary nodes={state.data?.nodes ?? []} edges={state.data?.edges ?? []} totalEdges={state.data?.totalEdges} /></>}</div>
}
