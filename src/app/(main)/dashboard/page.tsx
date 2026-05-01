"use client"

import { useEffect, useState } from "react"
import { Activity, Brain, GitBranch, Lightbulb } from "lucide-react"

import {
  ActivityPanel,
  ErrorState,
  InsightCard,
  LoadingState,
  MetricCardsSkeleton,
  MetricCard,
  PageHeader,
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

  if (!state) return <div className="space-y-8"><MetricCardsSkeleton /></div>
  if (state.error) return <ErrorState message={state.error} />
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
      <div className="flex flex-col gap-1">
        <span
          className="font-mono text-xs font-semibold uppercase tracking-[0.14em] text-[var(--allura-gold-text)]"
        >
          Allura Memory dashboard
        </span>
        <h1 className="text-[44px] font-bold leading-[1.05] tracking-[-0.05em]">
          Overview
        </h1>
        <p className="text-base text-[var(--allura-gray-500)] max-w-[760px]">
          Activity dashboard for your memory graph
        </p>
      </div>

      {/* Stat Cards */}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {metrics.map((metric) => (
          <MetricCard key={metric.id} metric={metric} />
        ))}
      </div>

      <WarningList warnings={state.warnings} />

      {/* Split: Activity + Pending Queue */}
      <div className="grid gap-6 xl:grid-cols-[1.6fr_1fr]">
        <ActivityPanel items={state.data.activity} />

        <section className="agency-card">
          <div className="agency-card-header">
            <h2 className="text-lg font-semibold text-[var(--allura-charcoal)]">Pending Queue</h2>
          </div>
          <div className="agency-card-body space-y-3">
            {state.data.pendingInsights.length === 0 ? (
              <p className="text-sm text-[var(--allura-gray-500)]">
                No pending insights in the curator queue.
              </p>
            ) : (
              state.data.pendingInsights.slice(0, 5).map((insight) => (
                <InsightCard key={insight.id} insight={insight} />
              ))
            )}
          </div>
        </section>
      </div>

      <SystemStatusCard status={state.data.systemStatus} />
    </div>
  )
}
