"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { ArrowUpRight, Brain, CheckCircle2, Clock, RefreshCw, Zap } from "lucide-react"

import { ErrorState, LoadingState, PageHeader, WarningList } from "@/components/dashboard"
import { getHealthMetrics } from "@/lib/dashboard/api"
import type { DashboardWarning } from "@/lib/dashboard/types"

interface SkillMetric {
  tool_name: string
  category: string
  calls_24h: number
  success_rate: number
  avg_latency_ms: number
  last_used: string | null
  trend: "up" | "down" | "flat"
}

type Category = "memory" | "insight" | "graph" | "curator" | "agent"

const categoryMap: Record<string, Category> = {
  memory_search: "memory",
  memory_add: "memory",
  memory_update: "memory",
  memory_delete: "memory",
  memory_export: "memory",
  memory_list: "memory",
  memory_get: "memory",
  memory_promote: "memory",
  insight_generate: "insight",
  graph_query: "graph",
  graph_create_relations: "graph",
  curator_approve: "curator",
  curator_reject: "curator",
  agent_create: "agent",
  agent_update: "agent",
  trace_ingest: "insight",
}

const fallbackSkills: SkillMetric[] = [
  { tool_name: "memory_search", category: "memory", calls_24h: 0, success_rate: 0, avg_latency_ms: 0, last_used: null, trend: "flat" },
  { tool_name: "memory_add", category: "memory", calls_24h: 0, success_rate: 0, avg_latency_ms: 0, last_used: null, trend: "flat" },
]

function relativeTime(ts: string | null): string {
  if (!ts) return "—"
  const diff = Date.now() - new Date(ts).getTime()
  if (diff < 60_000) return "just now"
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m ago`
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}h ago`
  return `${Math.floor(diff / 86_400_000)}d ago`
}

function trendArrow(trend: SkillMetric["trend"]) {
  if (trend === "up") return <span className="text-[var(--allura-green)]">↑</span>
  if (trend === "down") return <span className="text-[var(--allura-orange)]">↓</span>
  return <span className="text-[var(--allura-gray-400-text)]">→</span>
}

function categoryIcon(cat: Category) {
  switch (cat) {
    case "memory": return <Brain className="size-4" />
    case "insight": return <Zap className="size-4" />
    case "graph": return <Brain className="size-4" />
    case "curator": return <CheckCircle2 className="size-4" />
    case "agent": return <Brain className="size-4" />
    default: return <Brain className="size-4" />
  }
}

function categoryLabel(cat: string): string {
  const map: Record<string, string> = {
    memory: "Memory",
    insight: "Insight",
    graph: "Graph",
    curator: "Curator",
    agent: "Agent",
  }
  return map[cat] ?? cat
}

function categoryBadgeClass(cat: string) {
  switch (cat) {
    case "memory": return "bg-[var(--tone-blue-bg)] text-[var(--tone-blue-text)] border-[var(--allura-blue)]/20"
    case "insight": return "bg-[var(--tone-orange-bg)] text-[var(--tone-orange-text)] border-[var(--allura-orange)]/20"
    case "graph": return "bg-[var(--tone-gold-bg)] text-[var(--tone-gold-text)] border-[var(--allura-gold)]/20"
    case "curator": return "bg-[var(--tone-green-bg)] text-[var(--tone-green-text)] border-[var(--allura-green)]/20"
    case "agent": return "bg-[var(--tone-charcoal-bg)] text-[var(--tone-charcoal-text)] border-[var(--allura-charcoal)]/20"
    default: return "bg-[var(--allura-gray-100)] text-[var(--allura-gray-500)] border-[var(--allura-gray-200)]"
  }
}

export default function SkillsPage() {
  const [skills, setSkills] = useState<SkillMetric[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [warnings, setWarnings] = useState<DashboardWarning[]>([])
  const [filter, setFilter] = useState<"all" | Category>("all")

  useEffect(() => {
    let alive = true
    void (async () => {
      try {
        const result = await getHealthMetrics()
        if (!alive) return
        const data = result.data as { skills?: SkillMetric[] } | null
        const rawSkills = data?.skills ?? []
        const mapped: SkillMetric[] = rawSkills.map((s) => ({
          ...s,
          category: categoryMap[s.tool_name] ?? s.category ?? "memory",
        }))
        setSkills(mapped.length > 0 ? mapped : fallbackSkills)
        setWarnings(result.warning ? [{ id: "metrics-warning", source: "metrics", message: result.warning }] : [])
      } catch (err) {
        if (!alive) return
        setError(err instanceof Error ? err.message : "Failed to load skill metrics")
        setSkills(fallbackSkills)
      } finally {
        if (alive) setLoading(false)
      }
    })()
    return () => { alive = false }
  }, [])

  const totalCalls = skills.reduce((sum, s) => sum + s.calls_24h, 0)
  const avgSuccess = skills.length > 0 ? skills.reduce((sum, s) => sum + s.success_rate, 0) / skills.length : 0
  const avgLatency = skills.length > 0 ? Math.round(skills.reduce((sum, s) => sum + s.avg_latency_ms, 0) / skills.length) : 0
  const totalSkills = skills.length

  const filtered = filter === "all" ? skills : skills.filter((s) => s.category === filter)

  return (
    <div className="space-y-8">
      {/* Hero */}
      <div className="flex flex-col gap-1">
        <span
          className="font-mono text-xs font-semibold uppercase tracking-[0.14em]"
          style={{ color: "var(--allura-gold-text)", fontFamily: "'IBM Plex Mono', monospace" }}
        >
          Allura Memory dashboard
        </span>
        <h1 className="text-[44px] font-bold leading-[1.05] tracking-[-0.05em]">Skills</h1>
        <p className="text-base text-[var(--allura-gray-500)] max-w-[760px]">
          Track MCP tool and skill execution performance across your memory Brain.
        </p>
      </div>

      {/* Stat Cards */}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <div className="metric-card">
          <div>
            <p className="metric-label">Total Calls (24h)</p>
            <p className="metric-value">{totalCalls.toLocaleString()}</p>
          </div>
          <div className="metric-icon blue">
            <Zap className="size-5" />
          </div>
        </div>
        <div className="metric-card">
          <div>
            <p className="metric-label">Avg Success Rate</p>
            <p className="metric-value">{(avgSuccess * 100).toFixed(1)}%</p>
          </div>
          <div className="metric-icon green">
            <CheckCircle2 className="size-5" />
          </div>
        </div>
        <div className="metric-card">
          <div>
            <p className="metric-label">Avg Latency</p>
            <p className="metric-value">{avgLatency}ms</p>
          </div>
          <div className="metric-icon gold">
            <Clock className="size-5" />
          </div>
        </div>
        <div className="metric-card">
          <div>
            <p className="metric-label">Active Skills</p>
            <p className="metric-value">{totalSkills}</p>
          </div>
          <div className="metric-icon charcoal">
            <Brain className="size-5" />
          </div>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="flex flex-wrap items-center gap-2">
        {(["all", "memory", "insight", "graph", "curator", "agent"] as const).map((cat) => (
          <button
            key={cat}
            type="button"
            onClick={() => setFilter(cat)}
            className={`rounded-full px-3 py-1.5 text-xs font-medium border transition-colors ${
              filter === cat
                ? "bg-[var(--allura-blue)] text-white border-[var(--allura-blue)]"
                : "bg-[var(--dashboard-surface)] text-[var(--allura-gray-500)] border-[var(--allura-gray-200)] hover:bg-[var(--allura-gray-100)]"
            }`}
          >
            {cat === "all" ? "All Skills" : categoryLabel(cat)}
          </button>
        ))}
      </div>

      {/* Skills Table */}
      <div className="agency-card overflow-hidden">
        <div className="agency-card-header">
          <h2 className="text-lg font-semibold text-[var(--allura-charcoal)]">Skill Performance</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="agency-table w-full">
            <thead>
              <tr>
                <th>Skill</th>
                <th>Category</th>
                <th className="text-right">Calls</th>
                <th className="text-right">Success</th>
                <th className="text-right">Latency</th>
                <th className="text-right">Trend</th>
                <th>Last Used</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((skill) => (
                <tr key={skill.tool_name}>
                  <td>
                    <div className="flex items-center gap-3">
                      <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[var(--allura-gray-100)] text-[var(--allura-gray-500)]">
                        {categoryIcon(skill.category as Category)}
                      </div>
                      <span className="font-medium text-[var(--allura-charcoal)]">{skill.tool_name}</span>
                    </div>
                  </td>
                  <td>
                    <span className={`agency-badge ${categoryBadgeClass(skill.category)}`}>
                      {categoryLabel(skill.category)}
                    </span>
                  </td>
                  <td className="text-right font-mono text-sm">
                    {skill.calls_24h.toLocaleString()}
                  </td>
                  <td className="text-right">
                    <div className="flex items-center justify-end gap-2">
                      <div className="h-1.5 w-16 overflow-hidden rounded-full bg-[var(--allura-gray-100)]">
                        <div
                          className="h-full rounded-full"
                          style={{
                            width: `${skill.success_rate * 100}%`,
                            backgroundColor:
                              skill.success_rate >= 0.95
                                ? "var(--allura-green)"
                                : skill.success_rate >= 0.85
                                  ? "var(--allura-gold)"
                                  : "var(--allura-orange)",
                          }}
                        />
                      </div>
                      <span className="font-mono text-xs text-[var(--allura-gray-500)]">
                        {(skill.success_rate * 100).toFixed(1)}%
                      </span>
                    </div>
                  </td>
                  <td className="text-right font-mono text-sm text-[var(--allura-gray-500)]">
                    {skill.avg_latency_ms}ms
                  </td>
                  <td className="text-right text-sm">{trendArrow(skill.trend)}</td>
                  <td className="text-sm text-[var(--allura-gray-500)]">{relativeTime(skill.last_used)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* CTA */}
      <div className="flex items-center justify-between rounded-xl border border-dashed border-[var(--allura-gray-200)] p-6">
        <div>
          <h3 className="text-sm font-semibold text-[var(--allura-charcoal)]">Want deeper telemetry?</h3>
          <p className="text-xs text-[var(--allura-gray-500)] mt-1">
            Instrument your skills with the OpenTelemetry SDK for per-call traces.
          </p>
        </div>
        <Link
          href="/dashboard/settings"
          className="agency-btn primary text-xs"
        >
          Configure <ArrowUpRight className="size-3.5" />
        </Link>
      </div>
    </div>
  )
}
