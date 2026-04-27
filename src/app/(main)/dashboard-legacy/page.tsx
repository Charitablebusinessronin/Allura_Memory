import type { Metadata } from "next"

export const metadata: Metadata = {
  title: "Dashboard",
  description: "System overview — health, pending approvals, and component status",
}

import type { ComponentHealth, HealthResponse } from "@/app/api/health/route"
import { HealthTable, RefreshButton } from "./_components/health-table"
import { LiveKPIs } from "./_components/live-kpis"
import { BudgetCard } from "./_components/budget-card"

import { APP_CONFIG } from "@/config/app-config"

const DEFAULT_GROUP_ID = APP_CONFIG.defaultGroupId

// fetchHealth, fetchPendingCount, fetchTotalMemories feed SSR initial props to LiveKPIs.
// The client component then takes over with live SSE updates.

async function fetchHealth(): Promise<HealthResponse | null> {
  try {
    const res = await fetch(`${process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3100"}/api/health?detailed=true`, {
      cache: "no-store",
    })
    if (!res.ok) return null
    return res.json()
  } catch {
    return null
  }
}

async function fetchPendingCount(): Promise<number> {
  try {
    const res = await fetch(
      `${process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3100"}/api/curator/proposals?group_id=${DEFAULT_GROUP_ID}&status=pending&limit=1000`,
      { cache: "no-store" }
    )
    if (!res.ok) return 0
    const data = await res.json()
    return (data.proposals as unknown[])?.length ?? 0
  } catch {
    return 0
  }
}

async function fetchTotalMemories(): Promise<number> {
  try {
    const res = await fetch(
      `${process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3100"}/api/memory/count?group_id=${DEFAULT_GROUP_ID}`,
      { cache: "no-store" }
    )
    if (!res.ok) return 0
    const data = await res.json()
    return (data as { count?: number }).count ?? 0
  } catch {
    return 0
  }
}

export default async function DashboardPage() {
  const [health, pendingCount, totalMemories] = await Promise.all([
    fetchHealth(),
    fetchPendingCount(),
    fetchTotalMemories(),
  ])

  const components: ComponentHealth[] = health?.components ?? []
  const activeComponents = components.filter((c) => c.status === "healthy").length

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Dashboard</h1>
        <p className="text-muted-foreground mt-1 text-sm">System overview for {DEFAULT_GROUP_ID}</p>
      </div>

      <LiveKPIs
        initialHealth={health}
        initialTotalMemories={totalMemories}
        initialPendingCount={pendingCount}
        initialActiveComponents={activeComponents}
        groupId={DEFAULT_GROUP_ID}
      />

      <BudgetCard groupId={DEFAULT_GROUP_ID} />

      <div>
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-base font-semibold">Component Status</h2>
          <RefreshButton />
        </div>
        <HealthTable components={components} />
      </div>
    </div>
  )
}
