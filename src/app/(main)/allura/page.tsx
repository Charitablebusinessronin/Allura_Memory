"use client"

import { useEffect, useMemo, useState } from "react"

import {
  EmptyState,
  ErrorState,
  EvidenceCard,
  InsightCard,
  MemoryCard,
  PageHeader,
  SearchResultsSkeleton,
  WarningList,
} from "@/components/dashboard"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { ALLURA_ROUTE_SECTIONS, getAlluraRoutePolicy } from "@/lib/dashboard/allura-route"
import { loadCuratorQueue, loadEvidence, loadGraph, loadInsights, loadMemories } from "@/lib/dashboard/queries"
import type { DashboardResult, Evidence, GraphEdge, GraphNode, Insight, Memory } from "@/lib/dashboard/types"

type AlluraRouteData = {
  memories: DashboardResult<Memory[]>
  insights: DashboardResult<Insight[]>
  evidence: DashboardResult<Evidence[]>
  queue: DashboardResult<Insight[]>
  graph: DashboardResult<{ nodes: GraphNode[]; edges: GraphEdge[]; totalEdges?: number }>
}

function emptyResult<T>(data: T): DashboardResult<T> {
  return { data, error: null, degraded: false, warnings: [] }
}

async function loadAlluraRouteData(): Promise<AlluraRouteData> {
  const [memories, insights, evidence, queue, graph] = await Promise.all([
    loadMemories(),
    loadInsights("active"),
    loadEvidence(),
    loadCuratorQueue("pending"),
    loadGraph(),
  ])

  return { memories, insights, evidence, queue, graph }
}

function uniqueStrings(values: Array<string | undefined>): string[] {
  return Array.from(new Set(values.filter((value): value is string => Boolean(value && value !== "unknown"))))
}

export default function AlluraRoutePage() {
  const [state, setState] = useState<AlluraRouteData | null>(null)

  useEffect(() => {
    let cancelled = false
    void loadAlluraRouteData()
      .then((data) => {
        if (!cancelled) setState(data)
      })
      .catch((error) => {
        if (!cancelled) {
          const message = error instanceof Error ? error.message : "Unable to load Allura Brain data"
          setState({
            memories: { ...emptyResult<Memory[]>([]), error: message },
            insights: emptyResult<Insight[]>([]),
            evidence: emptyResult<Evidence[]>([]),
            queue: emptyResult<Insight[]>([]),
            graph: emptyResult<{ nodes: GraphNode[]; edges: GraphEdge[] }>({ nodes: [], edges: [] }),
          })
        }
      })
    return () => {
      cancelled = true
    }
  }, [])

  const policy = useMemo(() => getAlluraRoutePolicy(), [])
  const memories = state?.memories.data ?? []
  const insights = state?.insights.data ?? []
  const evidence = state?.evidence.data ?? []
  const queue = state?.queue.data ?? []
  const graph = state?.graph.data ?? { nodes: [], edges: [] }
  const warnings = [
    ...(state?.memories.warnings ?? []),
    ...(state?.insights.warnings ?? []),
    ...(state?.evidence.warnings ?? []),
    ...(state?.queue.warnings ?? []),
    ...(state?.graph.warnings ?? []),
  ]
  const errors = [state?.memories.error, state?.insights.error, state?.evidence.error, state?.queue.error, state?.graph.error].filter(
    Boolean
  ) as string[]
  const isDegraded = Boolean(
    state?.memories.degraded || state?.insights.degraded || state?.evidence.degraded || state?.queue.degraded || state?.graph.degraded
  )

  const provenanceAgents = uniqueStrings([
    ...memories.map((memory) => memory.agent),
    ...insights.map((insight) => insight.agent),
    ...evidence.map((item) => item.agent),
  ])
  const extractedFacts = evidence
    .filter((item) => item.rawLog.trim().length > 0)
    .slice(0, 8)

  return (
    <div className="space-y-6">
      <PageHeader
        title="Allura Brain"
        description="Mission Control view for memories, insights, traces, provenance, extracted facts, and HITL approvals."
      />

      <section className="grid gap-3 rounded-xl border border-[var(--dashboard-border)] bg-[var(--dashboard-surface)] p-4 shadow-[var(--allura-sh-sm)] md:grid-cols-2 xl:grid-cols-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[1.2px] text-[var(--dashboard-text-muted)]">System of record</p>
          <p className="mt-1 text-sm font-semibold text-[var(--dashboard-text-primary)]">{policy.system_of_record}</p>
        </div>
        <div>
          <p className="text-xs font-semibold uppercase tracking-[1.2px] text-[var(--dashboard-text-muted)]">Read / write</p>
          <p className="mt-1 text-sm font-semibold text-[var(--dashboard-text-primary)]">
            {policy.read_policy.min_role} read · {policy.write_policy.min_role} write
          </p>
        </div>
        <div>
          <p className="text-xs font-semibold uppercase tracking-[1.2px] text-[var(--dashboard-text-muted)]">Degraded behavior</p>
          <p className="mt-1 text-sm font-semibold text-[var(--dashboard-text-primary)]">{policy.degradation_behavior}</p>
        </div>
        <div>
          <p className="text-xs font-semibold uppercase tracking-[1.2px] text-[var(--dashboard-text-muted)]">Evidence policy</p>
          <p className="mt-1 text-sm font-semibold text-[var(--dashboard-text-primary)]">{policy.evidence_policy}</p>
        </div>
      </section>

      <div className="flex flex-wrap gap-2">
        {ALLURA_ROUTE_SECTIONS.map((section) => (
          <Badge key={section.id} variant="outline" className="border-[var(--dashboard-border)] text-[var(--dashboard-text-secondary)]">
            {section.label}: {section.readMode}
          </Badge>
        ))}
        {isDegraded && <Badge className="bg-[var(--allura-orange)] text-white">Degraded</Badge>}
      </div>

      <WarningList warnings={warnings} />
      {errors.map((error) => <ErrorState key={error} message={error} />)}

      {!state ? (
        <SearchResultsSkeleton />
      ) : (
        <Tabs defaultValue="memories" className="space-y-4">
          <TabsList className="flex h-auto flex-wrap justify-start gap-2 bg-transparent p-0">
            {ALLURA_ROUTE_SECTIONS.map((section) => (
              <TabsTrigger key={section.id} value={section.id} className="rounded-full border border-[var(--dashboard-border)] px-3 py-1.5">
                {section.label}
              </TabsTrigger>
            ))}
          </TabsList>

          <TabsContent value="memories" className="space-y-3">
            {memories.length === 0 ? <EmptyState title="No memories returned" description="Allura Brain returned no memory rows for this group." /> : memories.slice(0, 10).map((memory) => <MemoryCard key={memory.id} memory={memory} />)}
          </TabsContent>

          <TabsContent value="insights" className="grid gap-3 md:grid-cols-2">
            {insights.length === 0 ? <EmptyState title="No active insights" description="Curated semantic knowledge will appear after HITL approval." /> : insights.slice(0, 8).map((insight) => <InsightCard key={insight.id} insight={insight} />)}
          </TabsContent>

          <TabsContent value="trace-logs" className="space-y-3">
            {evidence.length === 0 ? <EmptyState title="No trace logs" description="Append-only evidence was not returned by the trace endpoint." /> : evidence.slice(0, 10).map((item) => <EvidenceCard key={item.id} evidence={item} />)}
          </TabsContent>

          <TabsContent value="provenance" className="grid gap-3 md:grid-cols-3">
            <SummaryCard label="Agents" value={provenanceAgents.length} detail={provenanceAgents.slice(0, 5).join(", ") || "No agent provenance returned"} />
            <SummaryCard label="Graph nodes" value={graph.nodes.length} detail="Derived from Allura Brain graph endpoint" />
            <SummaryCard label="Graph edges" value={graph.edges.length} detail="Relationship evidence returned by graph endpoint" />
          </TabsContent>

          <TabsContent value="extracted-facts" className="space-y-3">
            {extractedFacts.length === 0 ? <EmptyState title="No extracted facts" description="No fact-like evidence was returned from traces." /> : extractedFacts.map((item) => <EvidenceCard key={item.id} evidence={item} />)}
          </TabsContent>

          <TabsContent value="approval-queue" className="grid gap-3 md:grid-cols-2">
            {queue.length === 0 ? <EmptyState title="Approval queue is empty" description="No pending canonical proposals require HITL review." /> : queue.slice(0, 10).map((insight) => <InsightCard key={insight.id} insight={insight} />)}
          </TabsContent>
        </Tabs>
      )}
    </div>
  )
}

function SummaryCard({ label, value, detail }: { label: string; value: number; detail: string }) {
  return (
    <article className="rounded-xl border border-[var(--dashboard-border)] bg-[var(--dashboard-surface)] p-4">
      <p className="text-xs font-semibold uppercase tracking-[1.2px] text-[var(--dashboard-text-muted)]">{label}</p>
      <p className="mt-2 text-2xl font-semibold text-[var(--dashboard-text-primary)]">{value}</p>
      <p className="mt-2 text-sm text-[var(--dashboard-text-secondary)]">{detail}</p>
    </article>
  )
}
