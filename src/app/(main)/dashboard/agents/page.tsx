"use client"

import { useEffect, useMemo, useState } from "react"

import { Activity, Brain, Lightbulb, MoreHorizontal, Users } from "lucide-react"

import {
  EmptyState,
  ErrorState,
  LoadingState,
  PageHeader,
  WarningList,
} from "@/components/dashboard"
import { cn } from "@/lib/utils"
import { loadGraphNodes } from "@/lib/dashboard/queries"
import type { DashboardResult, GraphEdge, GraphNode } from "@/lib/dashboard/types"

function confidencePercent(node: GraphNode) {
  const c = Number(node.metadata?.confidence ?? node.metadata?.score ?? 0)
  if (!Number.isFinite(c)) return "—"
  return `${Math.round(c * 100)}%`
}

interface AgentMetric {
  label: string
  value: string
  tone: "blue" | "orange" | "green" | "charcoal"
  icon: React.ComponentType<{ className?: string }>
}

function buildMetrics(nodes: GraphNode[], _edges: GraphEdge[]): AgentMetric[] {
  const total = nodes.length
  const active = nodes.filter((n) => {
    const s = String(n.metadata?.status ?? "").toLowerCase()
    return s === "active" || s === "online"
  }).length
  const pending = nodes.filter((n) => {
    const s = String(n.metadata?.status ?? "").toLowerCase()
    return s === "pending" || s === "proposed"
  }).length
  const avgConfidence =
    total > 0
      ? (
          nodes.reduce((sum, n) => {
            const c = Number(n.metadata?.confidence ?? n.metadata?.score ?? 0)
            return sum + (Number.isFinite(c) ? c : 0)
          }, 0) / total
        ).toFixed(0)
      : "0"
  return [
    { label: "Total Agents", value: String(total), tone: "blue", icon: Users },
    { label: "Active", value: String(active), tone: "green", icon: Activity },
    { label: "Pending", value: String(pending), tone: "orange", icon: Lightbulb },
    { label: "Avg Confidence", value: `${avgConfidence}%`, tone: "charcoal", icon: Brain },
  ]
}

function AgentCard({
  node,
  connectionCount,
}: {
  node: GraphNode
  connectionCount: number
}) {
  const tone =
    (node.metadata?.status as string | undefined)?.toLowerCase() === "active"
      ? "green"
      : "orange"
  return (
    <article className="agency-card">
      <div className="agency-card-header !py-4">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-[var(--allura-charcoal)] text-white">
            <span className="text-xs font-bold tracking-tight">
              {(node.label ?? "A").charAt(0).toUpperCase()}
            </span>
          </div>
          <div className="flex flex-col">
            <span className="text-sm font-semibold text-[var(--dashboard-text-primary)]">
              {node.label}
            </span>
            <span className="text-xs text-[var(--dashboard-text-muted)]">{node.type}</span>
          </div>
        </div>
        <button className="rounded-lg p-1.5 text-[var(--dashboard-text-muted)] hover:bg-[var(--dashboard-surface-muted)] hover:text-[var(--dashboard-text-primary)] transition-colors">
          <MoreHorizontal className="size-4" />
        </button>
      </div>
      <div className="agency-card-body !pt-3">
        <div className="mb-3 flex items-center gap-2">
          <span className={cn("agency-badge", tone === "green" ? "outcome" : "insight")}>
            {String(node.metadata?.status ?? "Unknown")}
          </span>
          <span className="agency-badge event">
            {connectionCount} connection{connectionCount === 1 ? "" : "s"}
          </span>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="rounded-lg border border-[var(--dashboard-border)] p-3">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-[var(--dashboard-text-muted)]">
              Role
            </p>
            <p className="mt-1 text-sm text-[var(--dashboard-text-primary)]">
              {String(node.metadata?.role ?? "—")}
            </p>
          </div>
          <div className="rounded-lg border border-[var(--dashboard-border)] p-3">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-[var(--dashboard-text-muted)]">
              Last Seen
            </p>
            <p className="mt-1 text-sm text-[var(--dashboard-text-primary)]">
              {String(node.metadata?.last_seen ?? node.metadata?.last_active ?? "—")}
            </p>
          </div>
          <div className="rounded-lg border border-[var(--dashboard-border)] p-3">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-[var(--dashboard-text-muted)]">
              Memories
            </p>
            <p className="mt-1 text-sm text-[var(--dashboard-text-primary)]">
              {String(node.metadata?.memory_count ?? "—")}
            </p>
          </div>
          <div className="rounded-lg border border-[var(--dashboard-border)] p-3">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-[var(--dashboard-text-muted)]">
              Confidence
            </p>
            <p className="mt-1 text-sm text-[var(--dashboard-text-primary)]">
              {confidencePercent(node)}
            </p>
          </div>
        </div>
        <div className="mt-4 flex items-center gap-2">
          <button className="agency-btn secondary text-xs">View Graph</button>
          <button className="agency-btn ghost text-xs">View Evidence</button>
        </div>
      </div>
    </article>
  )
}

function AgentsPageContent({ state }: { state: DashboardResult<{ nodes: GraphNode[]; edges: GraphEdge[] }> }) {
  const nodes = state.data?.nodes ?? []
  const edges = state.data?.edges ?? []

  const connectionCounts = useMemo(() => {
    const counts = new Map<string, number>()
    for (const n of nodes) counts.set(n.id, 0)
    for (const e of edges) {
      counts.set(e.source, (counts.get(e.source) ?? 0) + 1)
      counts.set(e.target, (counts.get(e.target) ?? 0) + 1)
    }
    return counts
  }, [nodes, edges])

  const metrics = useMemo(() => buildMetrics(nodes, edges), [nodes, edges])

  return (
    <div className="space-y-8">
      <PageHeader
        title="Agents"
        description="Agents observed in real Brain memory provenance and graph relationships."
        action={
          <button className="agency-btn primary text-sm">Manage Agents</button>
        }
      />
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {metrics.map((m) => (
          <div key={m.label} className="metric-card">
            <div>
              <p className="metric-label">{m.label}</p>
              <p className="metric-value">{m.value}</p>
            </div>
            <div className={cn("metric-icon", m.tone)}>
              <m.icon className="size-5" />
            </div>
          </div>
        ))}
      </div>
      <WarningList warnings={state.warnings} />
      {nodes.length === 0 ? (
        <EmptyState
          title="No agents found in graph"
          description="No agent-type nodes were found in the Neo4j graph for this tenant."
        />
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {nodes.map((node) => (
            <AgentCard
              key={node.id}
              node={node}
              connectionCount={connectionCounts.get(node.id) ?? 0}
            />
          ))}
        </div>
      )}
    </div>
  )
}

export default function AgentsPage() {
  const [state, setState] = useState<DashboardResult<{ nodes: GraphNode[]; edges: GraphEdge[] }> | null>(null)
  useEffect(() => {
    void loadGraphNodes("agent").then(setState)
  }, [])

  return (
    <div>
      {!state ? (
        <LoadingState />
      ) : state.error ? (
        <ErrorState message={state.error} />
      ) : (
        <AgentsPageContent state={state} />
      )}
    </div>
  )
}
