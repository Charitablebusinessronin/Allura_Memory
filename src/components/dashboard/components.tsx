"use client"

import Link from "next/link"
import type { ReactNode } from "react"

import { AlertCircle, CheckCircle2, Clock, Database, GitBranch, Loader2 } from "lucide-react"

import { Button } from "@/components/ui/button"
import type { ActivityItem, Evidence, GraphEdge, GraphNode, Insight, Memory, Metric, SystemStatus } from "@/lib/dashboard/types"
import { cn } from "@/lib/utils"

export function PageHeader({ title, description, action }: { title: string; description: string; action?: ReactNode }) {
  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-[#111827] dark:text-foreground">{title}</h1>
        <p className="text-muted-foreground mt-1 text-sm">{description}</p>
      </div>
      {action}
    </div>
  )
}

export function LoadingState({ label = "Loading real Brain data..." }: { label?: string }) {
  return <div className="flex items-center gap-2 rounded-xl border bg-card p-6 text-sm text-muted-foreground"><Loader2 className="size-4 animate-spin" />{label}</div>
}

export function ErrorState({ message }: { message: string }) {
  return <div className="flex items-start gap-2 rounded-xl border border-red-500/20 bg-red-500/5 p-4 text-sm text-red-700 dark:text-red-300"><AlertCircle className="mt-0.5 size-4" />{message}</div>
}

export function EmptyState({ title, description }: { title: string; description: string }) {
  return <div className="rounded-xl border border-dashed p-10 text-center"><p className="font-medium">{title}</p><p className="text-muted-foreground mt-1 text-sm">{description}</p></div>
}

export function WarningList({ warnings }: { warnings: Array<{ id: string; message: string; source: string }> }) {
  if (warnings.length === 0) return null
  return <div className="space-y-2">{warnings.map((warning) => <ErrorState key={warning.id} message={`${warning.source}: ${warning.message}`} />)}</div>
}

const toneClasses: Record<Metric["tone"], string> = {
  blue: "bg-[#1D4ED8]/10 text-[#1D4ED8]",
  orange: "bg-[#FF5A2E]/10 text-[#FF5A2E]",
  green: "bg-[#157A4A]/10 text-[#157A4A]",
  charcoal: "bg-[#111827]/10 text-[#111827]",
  gold: "bg-[#C89B3C]/10 text-[#8a651d]",
  red: "bg-red-500/10 text-red-600",
  muted: "bg-muted text-muted-foreground",
}

export function MetricCard({ metric }: { metric: Metric }) {
  return <div className="rounded-xl border bg-card p-5 shadow-xs"><div className="flex items-start justify-between"><div><p className="text-sm font-medium text-muted-foreground">{metric.label}</p><p className="mt-2 text-3xl font-semibold">{metric.value}</p><p className="text-muted-foreground mt-1 text-xs">{metric.description}</p></div><div className={cn("rounded-full p-3", toneClasses[metric.tone])}><Database className="size-5" /></div></div></div>
}

export function StatusPill({ value }: { value: string }) {
  const lower = value.toLowerCase()
  const cls = lower.includes("approve") || lower.includes("active") || lower.includes("healthy")
    ? "bg-[#157A4A]/10 text-[#157A4A]"
    : lower.includes("pending") || lower.includes("degraded")
      ? "bg-[#FF5A2E]/10 text-[#FF5A2E]"
      : lower.includes("reject") || lower.includes("fail") || lower.includes("unhealthy")
        ? "bg-red-500/10 text-red-600"
        : "bg-muted text-muted-foreground"
  return <span className={cn("inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium", cls)}>{value}</span>
}

export function ActivityPanel({ items }: { items: ActivityItem[] }) {
  return <section className="rounded-xl border bg-card"><div className="border-b p-5"><h2 className="font-semibold">Recent Activity</h2></div><div className="divide-y">{items.length === 0 ? <div className="p-5"><EmptyState title="No audit activity" description="The Brain returned no recent activity for this tenant." /></div> : items.map((item) => <div key={item.id} className="flex gap-3 p-4"><Clock className="mt-0.5 size-4 text-muted-foreground" /><div><p className="text-sm font-medium capitalize">{item.title}</p><p className="text-muted-foreground text-xs">{item.description}</p><p className="text-muted-foreground mt-1 text-xs">{new Date(item.timestamp).toLocaleString()}</p></div></div>)}</div></section>
}

export function InsightCard({ insight, actions }: { insight: Insight; actions?: ReactNode }) {
  return <article className="rounded-xl border bg-card p-5"><div className="flex items-start justify-between gap-4"><div><h3 className="font-semibold">{insight.title}</h3><div className="text-muted-foreground mt-2 flex flex-wrap gap-3 text-xs"><span>Agent: {insight.agent}</span><span>Project: {insight.project}</span><span>{new Date(insight.createdAt).toLocaleString()}</span></div></div><div className="text-right"><p className="text-xs text-muted-foreground">Confidence</p><p className="font-semibold">{Math.round(insight.confidence * 100)}%</p></div></div><div className="mt-4 grid gap-3 md:grid-cols-3"><div className="rounded-lg border p-3"><p className="text-xs text-muted-foreground">Event</p><p className="mt-1 text-sm">{insight.event}</p></div><div className="rounded-lg border p-3"><p className="text-xs text-muted-foreground">Outcome</p><p className="mt-1 text-sm">{insight.outcome}</p></div><div className="rounded-lg border p-3"><p className="text-xs text-muted-foreground">Evidence</p><p className="mt-1 text-sm">{insight.evidence}</p></div></div>{actions && <div className="mt-4 flex flex-wrap gap-2">{actions}</div>}</article>
}

export function MemoryCard({ memory }: { memory: Memory }) {
  return <article className="rounded-xl border bg-card p-5"><div className="flex items-start justify-between gap-4"><div><h3 className="font-semibold">{memory.title}</h3><p className="text-muted-foreground mt-2 line-clamp-2 text-sm">{memory.content}</p></div><StatusPill value={memory.status} /></div><div className="text-muted-foreground mt-4 flex flex-wrap gap-3 text-xs"><span>Agent: {memory.agent}</span><span>Project: {memory.project}</span><span>{new Date(memory.timestamp).toLocaleString()}</span><span>{memory.connectedMemoryCount} connections</span></div>{memory.tags.length > 0 && <div className="mt-3 flex flex-wrap gap-1.5">{memory.tags.slice(0, 5).map((tag) => <span key={tag} className="rounded-full bg-muted px-2 py-0.5 text-xs">{tag}</span>)}</div>}</article>
}

export function EvidenceCard({ evidence }: { evidence: Evidence }) {
  return <Link href={`/dashboard/evidence/${encodeURIComponent(evidence.id)}`} className="block rounded-xl border bg-card p-5 transition hover:bg-muted/30"><div className="flex items-start justify-between"><h3 className="font-semibold">{evidence.title}</h3><StatusPill value={evidence.status} /></div><p className="text-muted-foreground mt-2 line-clamp-2 text-sm">{evidence.rawLog}</p><div className="text-muted-foreground mt-3 flex flex-wrap gap-3 text-xs"><span>{evidence.source}</span><span>{evidence.agent}</span><span>{new Date(evidence.timestamp).toLocaleString()}</span></div></Link>
}

export function SystemStatusCard({ status }: { status: SystemStatus }) {
  return <section className="rounded-xl border bg-card"><div className="flex items-center justify-between border-b p-5"><h2 className="font-semibold">System Status</h2><StatusPill value={status.status} /></div><div className="divide-y">{status.components.length === 0 ? <div className="p-5"><EmptyState title="No component health returned" description="The health endpoint did not return component-level data." /></div> : status.components.map((component) => <div key={component.name} className="flex items-center justify-between gap-3 p-4"><div><p className="text-sm font-medium">{component.name}</p><p className="text-muted-foreground text-xs">{component.message ?? "No message"}</p></div><StatusPill value={component.status} /></div>)}</div></section>
}

export function GraphSummary({ nodes, edges, totalEdges }: { nodes: GraphNode[]; edges: GraphEdge[]; totalEdges?: number }) {
  return <div className="grid gap-6 lg:grid-cols-[1fr_280px]"><div className="relative min-h-[520px] overflow-hidden rounded-xl border bg-[#F5F1E6]/30 p-6"><div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(29,78,216,0.08),transparent_55%)]" />{nodes.length === 0 ? <div className="relative flex h-[460px] items-center justify-center"><EmptyState title="No graph relationships returned" description="Neo4j returned no tenant-scoped graph nodes. The UI will not invent relationships." /></div> : <div className="relative grid h-full place-items-center"><div className="flex max-w-3xl flex-wrap items-center justify-center gap-4">{nodes.slice(0, 24).map((node) => <div key={node.id} className="rounded-xl border bg-card px-4 py-3 text-center shadow-xs"><GitBranch className="mx-auto mb-1 size-4 text-[#1D4ED8]" /><p className="text-sm font-medium">{node.label}</p><p className="text-muted-foreground text-xs">{node.type}</p></div>)}</div></div>}</div><aside className="rounded-xl border bg-card p-5"><h2 className="font-semibold">Graph Truth</h2><p className="text-muted-foreground mt-1 text-sm">{nodes.length} visible nodes · {edges.length} visible edges</p><p className="text-muted-foreground mt-1 text-xs">Total tenant relationships: {totalEdges ?? "Unavailable"}</p><div className="mt-4 space-y-2">{edges.slice(0, 12).map((edge) => <div key={edge.id} className="rounded-lg border p-2 text-xs"><p className="font-medium">{edge.label}</p><p className="text-muted-foreground truncate">{edge.source} → {edge.target}</p></div>)}</div></aside></div>
}

export function InsightActions({ insight, onApprove, onReject, busy }: { insight: Insight; onApprove: (id: string) => void; onReject: (id: string) => void; busy?: boolean }) {
  return <><Button size="sm" disabled={busy} onClick={() => onApprove(insight.id)}><CheckCircle2 className="mr-1.5 size-3" />Approve</Button><Button size="sm" variant="outline" disabled={busy}>Revise</Button><Button size="sm" variant="destructive" disabled={busy} onClick={() => onReject(insight.id)}>Reject</Button>{insight.evidenceId && <Button size="sm" variant="outline" asChild><Link href={`/dashboard/evidence/${encodeURIComponent(insight.evidenceId)}`}>View Evidence</Link></Button>}</>
}
