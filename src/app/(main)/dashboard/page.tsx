"use client"

import { useEffect, useState } from "react"
import { Activity, Brain, GitBranch, Lightbulb } from "lucide-react"

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

  if (!state) return <LoadingState />
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
    <div className="space-y-6" style={{ fontFamily: "var(--font-ibm-plex-sans)" }}>
      <PageHeader
        title="Overview"
        description="Activity dashboard for your memory graph"
      />
      <WarningList warnings={state.warnings} />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {metrics.map((metric) => (
          <MetricCard key={metric.id} metric={metric} />
        ))}
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.6fr_1fr]">
        <ActivityPanel items={state.data.activity} />
        <section className="rounded-xl border border-[#E5E7EB] bg-white shadow-[0_4px_6px_-1px_rgba(15,17,21,0.1),0_2px_4px_-2px_rgba(15,17,21,0.1)]">
          <div className="border-b border-[#E5E7EB] p-5">
            <h2 className="text-lg font-semibold text-[#0F1115]">Pending Queue</h2>
          </div>
          <div className="space-y-3 p-5">
            {state.data.pendingInsights.length === 0 ? (
              <p className="text-sm text-[#6B7280]">No pending insights in the curator queue.</p>
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
