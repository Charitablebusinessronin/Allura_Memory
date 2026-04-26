"use client"

import { useEffect, useState } from "react"

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

  return (
    <div className="space-y-6" style={{ fontFamily: "var(--font-ibm-plex-sans)" }}>
      <PageHeader title="Overview" description="Mission control for Allura Brain memory governance." />
      <WarningList warnings={state.warnings} />
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {state.data.metrics.map((metric) => <MetricCard key={metric.id} metric={metric} />)}
      </div>
      <div className="grid gap-6 xl:grid-cols-[1fr_1.25fr]">
        <ActivityPanel items={state.data.activity} />
        <section className="rounded-xl border bg-card">
          <div className="border-b p-5"><h2 className="font-semibold">Pending Insight Queue</h2></div>
          <div className="space-y-3 p-5">
            {state.data.pendingInsights.length === 0 ? (
              <p className="text-muted-foreground text-sm">No pending insights returned by the curator queue.</p>
            ) : (
              state.data.pendingInsights.slice(0, 3).map((insight) => <InsightCard key={insight.id} insight={insight} />)
            )}
          </div>
        </section>
      </div>
      <SystemStatusCard status={state.data.systemStatus} />
    </div>
  )
}
