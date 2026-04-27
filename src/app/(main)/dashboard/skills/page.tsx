"use client"

import { useState } from "react"
import Link from "next/link"
import { ArrowUpRight, Brain, CheckCircle2, Clock, Zap } from "lucide-react"

import { PageHeader } from "@/components/dashboard"

/* ── Mock skill tracking data ── */
interface SkillMetric {
  id: string
  name: string
  category: "memory" | "insight" | "graph" | "curator" | "agent"
  totalCalls: number
  successRate: number // 0–1
  avgLatencyMs: number
  lastUsed: string
  trend: "up" | "down" | "flat"
}

const skills: SkillMetric[] = [
  { id: "memory-search", name: "memory_search", category: "memory", totalCalls: 12470, successRate: 0.987, avgLatencyMs: 42, lastUsed: "2026-04-27T12:45:00Z", trend: "up" },
  { id: "memory-add", name: "memory_add", category: "memory", totalCalls: 8321, successRate: 0.994, avgLatencyMs: 68, lastUsed: "2026-04-27T13:10:00Z", trend: "flat" },
  { id: "insight-generate", name: "insight_generate", category: "insight", totalCalls: 3450, successRate: 0.912, avgLatencyMs: 1240, lastUsed: "2026-04-27T11:30:00Z", trend: "up" },
  { id: "graph-query", name: "graph_query", category: "graph", totalCalls: 6780, successRate: 0.965, avgLatencyMs: 156, lastUsed: "2026-04-27T12:58:00Z", trend: "up" },
  { id: "curator-approve", name: "curator_approve", category: "curator", totalCalls: 1203, successRate: 0.998, avgLatencyMs: 89, lastUsed: "2026-04-27T10:15:00Z", trend: "flat" },
  { id: "agent-create", name: "agent_create", category: "agent", totalCalls: 452, successRate: 0.876, avgLatencyMs: 320, lastUsed: "2026-04-26T18:22:00Z", trend: "down" },
  { id: "memory-export", name: "memory_export", category: "memory", totalCalls: 1890, successRate: 0.982, avgLatencyMs: 210, lastUsed: "2026-04-27T09:45:00Z", trend: "up" },
  { id: "trace-ingest", name: "trace_ingest", category: "insight", totalCalls: 5670, successRate: 0.991, avgLatencyMs: 55, lastUsed: "2026-04-27T13:18:00Z", trend: "flat" },
]

function relativeTime(ts: string): string {
  const diff = Date.now() - new Date(ts).getTime()
  if (diff < 60_000) return "just now"
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m ago`
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}h ago`
  return `${Math.floor(diff / 86_400_000)}d ago`
}

function trendArrow(trend: SkillMetric["trend"]) {
  if (trend === "up") return <span className="text-[var(--allura-green)]">↑</span>
  if (trend === "down") return <span className="text-[var(--allura-orange)]">↓</span>
  return <span className="text-[var(--allura-gray-400)]">→</span>
}

function categoryIcon(cat: SkillMetric["category"]) {
  switch (cat) {
    case "memory": return <Brain className="size-4" />
    case "insight": return <Zap className="size-4" />
    case "graph": return <Brain className="size-4" />
    case "curator": return <CheckCircle2 className="size-4" />
    case "agent": return <Brain className="size-4" />
    default: return <Brain className="size-4" />
  }
}

function categoryLabel(cat: SkillMetric["category"]) {
  const map: Record<string, string> = {
    memory: "Memory",
    insight: "Insight",
    graph: "Graph",
    curator: "Curator",
    agent: "Agent",
  }
  return map[cat] ?? cat
}

function categoryBadgeClass(cat: SkillMetric["category"]) {
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
  const [filter, setFilter] = useState<"all" | SkillMetric["category"]>("all")

  const totalCalls = skills.reduce((sum, s) => sum + s.totalCalls, 0)
  const avgSuccess = skills.reduce((sum, s) => sum + s.successRate, 0) / skills.length
  const avgLatency = Math.round(skills.reduce((sum, s) => sum + s.avgLatencyMs, 0) / skills.length)
  const totalSkills = skills.length

  const filtered = filter === "all" ? skills : skills.filter((s) => s.category === filter)

  return (
    <div className="space-y-8">
      {/* Hero */}
      <div className="flex flex-col gap-1">
        <span
          className="font-mono text-xs font-semibold uppercase tracking-[0.14em]"
          style={{ color: "var(--allura-gold)", fontFamily: "'IBM Plex Mono', monospace" }}
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
                : "bg-white text-[var(--allura-gray-500)] border-[var(--allura-gray-200)] hover:bg-[var(--allura-gray-100)]"
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
                <tr key={skill.id}>
                  <td>
                    <div className="flex items-center gap-3">
                      <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[var(--allura-gray-100)] text-[var(--allura-gray-500)]">
                        {categoryIcon(skill.category)}
                      </div>
                      <span className="font-medium text-[var(--allura-charcoal)]">{skill.name}</span>
                    </div>
                  </td>
                  <td>
                    <span className={`agency-badge ${categoryBadgeClass(skill.category)}`}>
                      {categoryLabel(skill.category)}
                    </span>
                  </td>
                  <td className="text-right font-mono text-sm">
                    {skill.totalCalls.toLocaleString()}
                  </td>
                  <td className="text-right">
                    <div className="flex items-center justify-end gap-2">
                      <div className="h-1.5 w-16 overflow-hidden rounded-full bg-[var(--allura-gray-100)]">
                        <div
                          className="h-full rounded-full"
                          style={{
                            width: `${skill.successRate * 100}%`,
                            backgroundColor:
                              skill.successRate >= 0.95
                                ? "var(--allura-green)"
                                : skill.successRate >= 0.85
                                  ? "var(--allura-gold)"
                                  : "var(--allura-orange)",
                          }}
                        />
                      </div>
                      <span className="font-mono text-xs text-[var(--allura-gray-500)]">
                        {(skill.successRate * 100).toFixed(1)}%
                      </span>
                    </div>
                  </td>
                  <td className="text-right font-mono text-sm text-[var(--allura-gray-500)]">
                    {skill.avgLatencyMs}ms
                  </td>
                  <td className="text-right text-sm">{trendArrow(skill.trend)}</td>
                  <td className="text-sm text-[var(--allura-gray-500)]">{relativeTime(skill.lastUsed)}</td>
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
