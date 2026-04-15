import Link from "next/link"
import type { Metadata } from "next"
import { RefreshCw, AlertTriangle, Activity, Clock, CheckCircle, XCircle, MinusCircle } from "lucide-react"

export const metadata: Metadata = {
  title: "Dashboard",
  description: "System overview — health, pending approvals, and component status",
}

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Separator } from "@/components/ui/separator"

import type { ComponentHealth, HealthResponse } from "@/app/api/health/route"
import { HealthTable, RefreshButton } from "./_components/health-table"

const DEFAULT_GROUP_ID = "allura-roninmemory"

async function fetchHealth(): Promise<HealthResponse | null> {
  try {
    const res = await fetch(`${process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"}/api/health?detailed=true`, {
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
      `${process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"}/api/curator/proposals?group_id=${DEFAULT_GROUP_ID}&status=pending&limit=1`,
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
      `${process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"}/api/memory?group_id=${DEFAULT_GROUP_ID}&user_id=system&limit=1`,
      { cache: "no-store" }
    )
    if (!res.ok) return 0
    const data = await res.json()
    return (data as { total?: number }).total ?? 0
  } catch {
    return 0
  }
}

function StatusBadge({ status }: { status: string }) {
  if (status === "healthy") {
    return (
      <Badge className="border-green-500/20 bg-green-500/10 text-green-600 dark:text-green-400">
        <CheckCircle className="mr-1 size-3" />
        healthy
      </Badge>
    )
  }
  if (status === "degraded") {
    return (
      <Badge className="border-yellow-500/20 bg-yellow-500/10 text-yellow-600 dark:text-yellow-400">
        <MinusCircle className="mr-1 size-3" />
        degraded
      </Badge>
    )
  }
  return (
    <Badge variant="destructive">
      <XCircle className="mr-1 size-3" />
      unhealthy
    </Badge>
  )
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

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-muted-foreground text-sm font-medium">System Health</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <Activity className="text-muted-foreground size-4" />
              {health ? <StatusBadge status={health.status} /> : <Badge variant="outline">unknown</Badge>}
            </div>
            {health && (
              <p className="text-muted-foreground mt-2 text-xs">
                Uptime: {Math.floor(health.uptime / 3600)}h {Math.floor((health.uptime % 3600) / 60)}m
              </p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-muted-foreground text-sm font-medium">Pending Approvals</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <span className="text-2xl font-bold">{pendingCount}</span>
              {pendingCount > 0 && (
                <Button asChild size="sm" variant="outline">
                  <Link href="/dashboard/curator">Review</Link>
                </Button>
              )}
            </div>
            <p className="text-muted-foreground mt-1 text-xs">proposals awaiting review</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-muted-foreground text-sm font-medium">Total Memories</CardTitle>
          </CardHeader>
          <CardContent>
            <span className="text-2xl font-bold">{totalMemories}</span>
            <p className="text-muted-foreground mt-1 text-xs">stored in {DEFAULT_GROUP_ID}</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-muted-foreground text-sm font-medium">Active Components</CardTitle>
          </CardHeader>
          <CardContent>
            <span className="text-2xl font-bold">
              {activeComponents}
              <span className="text-muted-foreground text-base font-normal">/{components.length}</span>
            </span>
            <p className="text-muted-foreground mt-1 text-xs">healthy components</p>
          </CardContent>
        </Card>
      </div>

      {pendingCount > 0 && (
        <div className="flex items-start gap-3 rounded-lg border border-yellow-500/30 bg-yellow-500/5 p-4">
          <AlertTriangle className="mt-0.5 size-4 shrink-0 text-yellow-600 dark:text-yellow-400" />
          <div className="flex-1">
            <p className="text-sm font-medium">Needs Attention</p>
            <p className="text-muted-foreground mt-0.5 text-sm">
              {pendingCount} curator proposal{pendingCount > 1 ? "s" : ""} pending human review.{" "}
              <Link href="/dashboard/curator" className="hover:text-foreground underline underline-offset-2">
                Review now
              </Link>
            </p>
          </div>
        </div>
      )}

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
