"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { Activity, Brain, GitBranch, Lightbulb } from "lucide-react"

import {
  ActivityPanel,
  ErrorState,
  InsightCard,
  MetricCard,
  OverviewSkeleton,
  SystemStatusCard,
  WarningList,
} from "@/components/dashboard"
import { Button } from "@/components/ui/button"
import { loadDashboardOverview } from "@/lib/dashboard/queries"
import type { DashboardOverview, DashboardResult } from "@/lib/dashboard/types"

export default function DashboardPage() {
  const [state, setState] = useState<DashboardResult<DashboardOverview> | null>(null)

  useEffect(() => {
    let alive = true
    void loadDashboardOverview().then((result) => {
      if (alive) setState(result)
    })
    return () => {
      alive = false
    }
  }, [])

  if (!state) return <OverviewSkeleton />
  if (state.error) return <ErrorState message={state.error} action={<Button size="sm" variant="outline" onClick={() => window.location.reload()}>Retry</Button>} />
  if (!state.data) return <ErrorState message="Dashboard returned no data." />

  const metrics = state.data.metrics.map((m) => ({
    ...m,
    icon:
      m.id === "pending-insights" ? Lightbulb :
      m.id === "approved-insights" ? Brain :
      m.id === "graph-connections" ? GitBranch :
      Activity,
  }))

  return (
    <div className="space-y-8">
      {/* Hero */}
      <div className="flex flex-col gap-5 xl:flex-row xl:items-end xl:justify-between">
        <div className="flex flex-col gap-1">
          <span
            className="font-mono text-xs font-semibold uppercase tracking-[0.14em] text-[var(--allura-gold-text)]"
          >
            Memory that shows its work
          </span>
          <h1 className="text-[44px] font-bold leading-[1.05] tracking-[-0.05em]">
            Overview
          </h1>
          <p className="max-w-[760px] text-base text-[var(--dashboard-text-secondary)]">
            Review what the Brain knows, what needs curator attention, and which evidence supports every promoted insight.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button asChild variant="primary" size="md">
            <Link href="/dashboard/insights">Review insights</Link>
          </Button>
          <Button asChild variant="ghost" size="md">
            <Link href="/dashboard/evidence">Open evidence</Link>
          </Button>
          <Button asChild variant="ghost" size="md">
            <Link href="/dashboard/graph">Explore graph</Link>
          </Button>
        </div>
      </div>

      {/* Stat Cards */}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {metrics.map((metric) => (
          <MetricCard key={metric.id} metric={metric} icon={metric.icon} />
        ))}
      </div>

      <WarningList warnings={state.warnings} />

      {/* Split: Activity + Pending Queue */}
      <div className="grid gap-6 xl:grid-cols-[1.6fr_1fr]">
        <ActivityPanel items={state.data.activity} />

        <section className="agency-card">
          <div className="agency-card-header">
            <div>
              <h2 className="text-lg font-semibold text-[var(--allura-charcoal)]">Needs Review</h2>
              <p className="mt-1 text-sm text-[var(--dashboard-text-secondary)]">High-confidence proposals waiting for human approval.</p>
            </div>
          </div>
          <div className="agency-card-body space-y-3">
            {state.data.pendingInsights.length === 0 ? (
              <p className="text-sm text-[var(--allura-gray-500)]">
                No pending insights in the curator queue.
              </p>
            ) : (
              state.data.pendingInsights.slice(0, 5).map((insight) => (
                <InsightCard
                  key={insight.id}
                  insight={insight}
                  compact
                  actions={
                    <>
                      <Button asChild size="sm" variant="primary">
                        <Link href={`/dashboard/insights?promote=${encodeURIComponent(insight.id)}`}>Review</Link>
                      </Button>
                      {insight.evidenceId && (
                        <Button asChild size="sm" variant="ghost">
                          <Link href={`/dashboard/evidence/${encodeURIComponent(insight.evidenceId)}`}>Evidence</Link>
                        </Button>
                      )}
                    </>
                  }
                />
              ))
            )}
          </div>
        </section>
      </div>

      <SystemStatusCard status={state.data.systemStatus} />
    </div>
  )
}
