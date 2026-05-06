"use client"

import { ArrowUpRight, Brain, GitBranch, Layers, Search, Zap } from "lucide-react"

const metrics = [
  { label: "Total Memories",    value: "10,000+",  delta: "+15.2% vs yesterday", color: "var(--allura-blue)",   icon: Brain },
  { label: "Entities Discovered", value: "5,845,610", delta: "+8.7% vs yesterday",  color: "var(--allura-green)",  icon: Search },
  { label: "Analyzed Records",  value: "14,824,132", delta: "+12.4% vs yesterday", color: "var(--allura-orange)", icon: Layers },
]

const counters = [
  { label: "Pending Insights",   value: "12",    color: "var(--allura-orange)" },
  { label: "Approved Insights",  value: "248",   color: "var(--allura-green)" },
  { label: "Graph Connections",  value: "1,492", color: "var(--allura-blue)" },
  { label: "Evidence Items",     value: "634",   color: "var(--dashboard-evidence)" },
  { label: "Active Agents",      value: "7",     color: "var(--allura-charcoal)" },
]

export function SystemOverviewPanel() {
  const now = new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })

  return (
    <div className="border-b border-[var(--allura-border-1)]">
      <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--allura-border-1)]">
        <div className="flex items-center gap-2">
          <Zap size={13} className="text-[var(--allura-blue)]" />
          <span className="text-[11px] font-semibold uppercase tracking-widest text-[var(--allura-charcoal)]">System Overview</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[10px] text-[var(--allura-gray-400)]">Last Updated: {now}</span>
          <span className="inline-flex items-center gap-1 rounded-full bg-[color-mix(in_srgb,var(--allura-green)_10%,white)] px-2 py-0.5 text-[10px] font-semibold text-[var(--allura-green)]">
            <span className="size-1.5 rounded-full bg-[var(--allura-green)]" />
            LIVE
          </span>
        </div>
      </div>

      {/* Big 3 counters */}
      <div className="grid grid-cols-3 divide-x divide-[var(--allura-border-1)]">
        {metrics.map((m) => (
          <div key={m.label} className="px-3 py-3">
            <p className="text-[10px] text-[var(--allura-gray-500)] uppercase tracking-wide mb-0.5">{m.label}</p>
            <p className="text-lg font-bold leading-tight" style={{ color: m.color }}>{m.value}</p>
            <p className="text-[10px] text-[var(--allura-gray-400)] mt-0.5">{m.delta}</p>
          </div>
        ))}
      </div>

      {/* 5 secondary counters */}
      <div className="grid grid-cols-5 divide-x divide-[var(--allura-border-1)] border-t border-[var(--allura-border-1)]">
        {counters.map((c) => (
          <div key={c.label} className="flex flex-col items-center py-2.5 px-1">
            <span className="text-base font-bold" style={{ color: c.color }}>{c.value}</span>
            <span className="text-[9px] text-center text-[var(--allura-gray-400)] leading-tight mt-0.5">{c.label}</span>
          </div>
        ))}
      </div>
    </div>
  )
}
