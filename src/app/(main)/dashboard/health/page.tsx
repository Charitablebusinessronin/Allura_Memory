"use client"

import { Activity, Database, GitBranch, Network, RefreshCw, Server } from "lucide-react"
import { useEffect, useState } from "react"

import { ErrorState, LoadingState, PageHeader, StatusBadge, SystemStatusCard, WarningList } from "@/components/dashboard"
import { getHealth, getHealthMetrics } from "@/lib/dashboard/api"
import type { DashboardResult, SystemStatus } from "@/lib/dashboard/types"

interface HealthMetrics {
  queue: { pending_count: number; oldest_age_hours: number; approved_24h: number; rejected_24h: number }
  recall: { search_available: boolean; last_latency_ms: number | null }
  storage: {
    postgres: { status: string; latency_ms: number; total_memories: number }
    neo4j: { status: string; latency_ms: number | null; total_nodes: number | null }
  }
  degraded: { neo4j_unavailable: number; scope_error: number; embedding_failures: number; promotion_failures_24h: number }
  skills: Array<{ tool_name: string; category: string; calls_24h: number; success_rate: number; avg_latency_ms: number; last_used: string | null; trend: string }>
}

interface ComponentHealth {
  name: string
  status: "healthy" | "degraded" | "unhealthy"
  message?: string
  latency?: number
}

function statusFromHealth(s: string): "healthy" | "degraded" | "unhealthy" {
  if (s === "healthy" || s === "up") return "healthy"
  if (s === "degraded") return "degraded"
  return "unhealthy"
}

function badgeFromHealth(s: string): "active" | "pending" | "rejected" | "superseded" | "error" {
  if (s === "healthy" || s === "up") return "active"
  if (s === "degraded") return "pending"
  return "error"
}

function latencyLabel(ms: number | null | undefined): string {
  if (ms == null) return "—"
  if (ms < 100) return `${ms}ms`
  if (ms < 1000) return `${ms}ms`
  return `${(ms / 1000).toFixed(1)}s`
}

export default function HealthPage() {
  const [systemStatus, setSystemStatus] = useState<DashboardResult<SystemStatus> | null>(null)
  const [metrics, setMetrics] = useState<DashboardResult<HealthMetrics> | null>(null)
  const [refreshing, setRefreshing] = useState(false)

  const load = async () => {
    setRefreshing(true)
    const [healthResult, metricsResult] = await Promise.allSettled([
      getHealth(),
      getHealthMetrics(),
    ])
    if (healthResult.status === "fulfilled") {
      const data = healthResult.value.data as { status?: string; components?: ComponentHealth[]; dependencies?: Record<string, unknown> } | null
      const components: SystemStatus["components"] = (data?.components ?? []).map((c) => ({
        name: c.name,
        status: statusFromHealth(c.status),
        message: c.message,
        latency: c.latency,
      }))
      setSystemStatus({
        data: { status: statusFromHealth(data?.status ?? "unknown"), components },
        error: null,
        degraded: healthResult.value.degraded,
        warnings: healthResult.value.warning ? [{ id: "health-warning", source: "health", message: healthResult.value.warning }] : [],
      })
    } else {
      setSystemStatus({ data: null, error: healthResult.reason instanceof Error ? healthResult.reason.message : "Health check failed", degraded: false, warnings: [] })
    }
    if (metricsResult.status === "fulfilled") {
      const m = metricsResult.value.data as HealthMetrics | null
      setMetrics({ data: m, error: null, degraded: metricsResult.value.degraded, warnings: metricsResult.value.warning ? [{ id: "metrics-warning", source: "metrics", message: metricsResult.value.warning }] : [] })
    } else {
      setMetrics({ data: null, error: metricsResult.reason instanceof Error ? metricsResult.reason.message : "Metrics fetch failed", degraded: false, warnings: [] })
    }
    setRefreshing(false)
  }

  useEffect(() => { void load() }, [])

  const allWarnings = [...(systemStatus?.warnings ?? []), ...(metrics?.warnings ?? [])]
  const overallStatus = systemStatus?.data?.status ?? "unknown"
  const storageMetrics = metrics?.data?.storage
  const queueMetrics = metrics?.data?.queue

  const subsystemCards = [
    { name: "PostgreSQL", icon: Database, status: storageMetrics?.postgres?.status ?? "unknown", latency: storageMetrics?.postgres?.latency_ms, detail: storageMetrics?.postgres ? `${storageMetrics.postgres.total_memories.toLocaleString()} memories` : undefined },
    { name: "Neo4j", icon: GitBranch, status: storageMetrics?.neo4j?.status ?? "unknown", latency: storageMetrics?.neo4j?.latency_ms, detail: storageMetrics?.neo4j?.total_nodes != null ? `${storageMetrics.neo4j.total_nodes.toLocaleString()} nodes` : undefined },
    { name: "RuVector", icon: Network, status: metrics?.data?.recall?.search_available ? "healthy" : "unhealthy", latency: metrics?.data?.recall?.last_latency_ms, detail: metrics?.data?.recall?.search_available ? "Search available" : "Search unavailable" },
    { name: "MCP Gateway", icon: Server, status: overallStatus === "healthy" ? "healthy" : overallStatus === "degraded" ? "degraded" : "unhealthy", latency: undefined, detail: overallStatus === "healthy" ? "All services up" : "Check components" },
  ] as const

  if (!systemStatus && !metrics) return <LoadingState />

  return (
    <div className="space-y-8">
      <PageHeader
        title="System Health"
        description="Live status of all Allura Brain subsystems."
        action={
          <button
            onClick={load}
            disabled={refreshing}
            className="flex items-center gap-2 rounded-lg border border-[var(--dashboard-border)] bg-[var(--dashboard-surface)] px-3 py-2 text-sm text-[var(--dashboard-text-secondary)] transition-colors hover:bg-[var(--dashboard-surface-alt)] disabled:opacity-50"
          >
            <RefreshCw className={`size-4 ${refreshing ? "animate-spin" : ""}`} />
            <Activity className="size-4" />
            <span>{refreshing ? "Refreshing…" : "Live Status"}</span>
          </button>
        }
      />

      {allWarnings.length > 0 && <WarningList warnings={allWarnings} />}
      {systemStatus?.error && <ErrorState message={systemStatus.error} />}
      {metrics?.error && <ErrorState message={metrics.error} />}

      {/* Subsystem Cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {subsystemCards.map((s) => {
          const Icon = s.icon
          return (
            <div
              key={s.name}
              className="rounded-xl border border-[var(--dashboard-border)] bg-[var(--dashboard-surface)] p-4"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Icon className="size-4 text-[var(--dashboard-text-muted)]" />
                  <span className="text-sm font-medium text-[var(--dashboard-text-primary)]">
                    {s.name}
                  </span>
                </div>
                <StatusBadge status={badgeFromHealth(s.status)} />
              </div>
              <div className="mt-2 flex items-center justify-between">
                <p className="text-xs text-[var(--dashboard-text-muted)]">
                  {s.detail ?? (s.status === "healthy" ? "Operational" : s.status === "degraded" ? "Degraded" : "Unavailable")}
                </p>
                {s.latency != null && (
                  <span className="text-xs font-mono text-[var(--dashboard-text-muted)]">
                    {latencyLabel(s.latency)}
                  </span>
                )}
              </div>
            </div>
          )
        })}
      </div>

      {/* Queue Metrics */}
      {queueMetrics && (
        <div className="rounded-xl border border-[var(--dashboard-border)] bg-[var(--dashboard-surface)] p-5">
          <h3 className="text-sm font-semibold text-[var(--dashboard-text-primary)]">Curator Queue</h3>
          <div className="mt-3 grid gap-4 sm:grid-cols-4">
            <div>
              <p className="text-2xl font-bold text-[var(--tone-orange-text)]">{queueMetrics.pending_count}</p>
              <p className="text-xs text-[var(--dashboard-text-muted)]">Pending</p>
            </div>
            <div>
              <p className="text-2xl font-bold text-[var(--tone-green-text)]">{queueMetrics.approved_24h}</p>
              <p className="text-xs text-[var(--dashboard-text-muted)]">Approved (24h)</p>
            </div>
            <div>
              <p className="text-2xl font-bold text-[var(--dashboard-text-secondary)]">{queueMetrics.rejected_24h}</p>
              <p className="text-xs text-[var(--dashboard-text-muted)]">Rejected (24h)</p>
            </div>
            <div>
              <p className="text-2xl font-bold text-[var(--dashboard-text-primary)]">{queueMetrics.oldest_age_hours.toFixed(1)}h</p>
              <p className="text-xs text-[var(--dashboard-text-muted)]">Oldest pending</p>
            </div>
          </div>
        </div>
      )}

      {/* System Status Detail */}
      {systemStatus?.data && <SystemStatusCard status={systemStatus.data} />}
    </div>
  )
}
