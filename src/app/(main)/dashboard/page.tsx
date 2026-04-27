"use client"

import { useEffect, useMemo, useState } from "react"

import { Activity, Brain, GitBranch, Lightbulb, Users } from "lucide-react"

import {
  ActivityPanel,
  ErrorState,
  InsightCard,
  LoadingState,
  MetricCard,
  PageHeader,
  SystemStatusCard,
  WarningList,
} from "@/components/dashboard"
import { cn } from "@/lib/utils"
import { loadDashboardOverview } from "@/lib/dashboard/queries"
import type { DashboardOverview, DashboardResult } from "@/lib/dashboard/types"

export default function DashboardPage() {
  const [state, setState] = useState<DashboardResult<DashboardOverview> | null>(null)

  useEffect(() => {
    void loadDashboardOverview().then(setState)
  }, [])

  if (!state) return <LoadingState />
  if (state.error) return <ErrorState message={state.error} />
  if (!state.data) return <ErrorState message="Dashboard returned no data." />

  const metrics = state.data.metrics.map((m) => ({
    ...m,
    icon:
      m.id === "pending-insights"
        ? Lightbulb
        : m.id === "approved-insights"
          ? Brain
          : m.id === "graph-connections"
            ? GitBranch
            : Activity,
  }))

  return (
    <div className="space-y-8">
      <PageHeader
        title="Overview"
        description="Mission control for your system memory"
      />

      <WarningList warnings={state.warnings} />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {metrics.map((metric) => (
          <MetricCard key={metric.id} metric={metric} />
        ))}
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.6fr_1fr]">
        <ActivityPanel items={state.data.activity} />
        <aside className="agency-card">
          <div className="agency-card-header">
            <h2 className="text-sm font-semibold text-[var(--dashboard-text-primary)]">
              Pending Queue
            </h2>
            <a href="/dashboard/insights" className="text-xs font-medium text-[var(--allura-blue)] hover:underline">
              View all →
            </a>
          </div>
          <div className="agency-card-body space-y-3">
            {state.data.pendingInsights.length === 0 ? (
              <p className="text-sm text-[var(--dashboard-text-muted)]">
                No pending insights in the curator queue.
              </p>
            ) : (
              state.data.pendingInsights.slice(0, 5).map((insight) => (
                <InsightCard key={insight.id} insight={insight} />
              ))
            )}
          </div>
        </aside>
      </div>

      <SystemStatusCard status={state.data.systemStatus} />
    </div>
  )
}
