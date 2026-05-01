"use client"

import { useEffect, useMemo, useState } from "react"

import { EmptyState, ErrorState, LoadingState, MetricCardsSkeleton, PageHeader, WarningList } from "@/components/dashboard"
import { loadGraphNodes } from "@/lib/dashboard/queries"
import type { DashboardResult, GraphEdge, GraphNode } from "@/lib/dashboard/types"

function NodeCard({ node, connectionCount }: { node: GraphNode; connectionCount: number }) {
  return (
    <article className="rounded-xl border bg-[var(--dashboard-surface)] p-5" >
      <div className="flex items-start justify-between">
        <div>
          <h3 className="font-semibold text-[var(--dashboard-text-primary)]">{node.label}</h3>
          <span className="mt-1 inline-block rounded-full bg-[var(--tone-green-bg)] px-2 py-0.5 text-xs font-medium text-[var(--tone-green-text)]">
            {node.type}
          </span>
        </div>
      </div>
      <p className="text-[var(--dashboard-text-secondary)] mt-2 text-sm">
        {connectionCount} connection{connectionCount === 1 ? "" : "s"} in graph
      </p>
      {node.metadata && Object.keys(node.metadata).filter((k) => node.metadata![k] !== undefined && node.metadata![k] !== null && node.metadata![k] !== "").length > 0 && (
        <div className="mt-3 space-y-1">
          {Object.entries(node.metadata)
            .filter(([, v]) => v !== undefined && v !== null && v !== "")
            .slice(0, 3)
            .map(([key, value]) => (
              <p key={key} className="text-xs text-[var(--dashboard-text-secondary)]">
                <span className="font-medium">{key}:</span> {typeof value === "object" ? JSON.stringify(value) : String(value)}
              </p>
            ))}
        </div>
      )}
    </article>
  )
}

export default function ProjectsPage() {
  const [state, setState] = useState<DashboardResult<{ nodes: GraphNode[]; edges: GraphEdge[] }> | null>(null)
  useEffect(() => { void loadGraphNodes("project").then(setState) }, [])

  const connectionCounts = useMemo(() => {
    const counts = new Map<string, number>()
    const edges = state?.data?.edges ?? []
    const nodes = state?.data?.nodes ?? []
    for (const node of nodes) counts.set(node.id, 0)
    for (const edge of edges) {
      counts.set(edge.source, (counts.get(edge.source) ?? 0) + 1)
      counts.set(edge.target, (counts.get(edge.target) ?? 0) + 1)
    }
    return counts
  }, [state?.data])

  const nodes = state?.data?.nodes ?? []

  return (
    <div className="space-y-6" >
      <PageHeader title="Projects" description="Projects observed in real Brain memory metadata and graph relationships." />
      {!state ? <MetricCardsSkeleton /> : state.error ? <ErrorState message={state.error} /> : (
        <>
          <WarningList warnings={state.warnings} />
          {nodes.length === 0 ? (
            <EmptyState title="No projects found in graph" description="No project-type nodes were found in the Neo4j graph for this tenant." />
          ) : (
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              {nodes.map((node) => (
                <NodeCard key={node.id} node={node} connectionCount={connectionCounts.get(node.id) ?? 0} />
              ))}
            </div>
          )}
        </>
      )}
    </div>
  )
}