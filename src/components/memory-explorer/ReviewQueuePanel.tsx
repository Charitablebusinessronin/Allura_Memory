"use client"

import { AlertTriangle, ArrowRight } from "lucide-react"

const items = [
  { id: "1", text: "Missing DB secrets caused MCP startup failure",   age: "2m ago",  tone: "orange" },
  { id: "2", text: "Agent retried tool call without context",          age: "7m ago",  tone: "orange" },
  { id: "3", text: "User dropped off onboarding step 2",               age: "11m ago", tone: "orange" },
  { id: "4", text: "Duplicate insight detected — review before promote", age: "18m ago", tone: "blue" },
  { id: "5", text: "Notion mirror sync delayed > 30s",                 age: "22m ago", tone: "blue" },
]

const toneColors: Record<string, string> = {
  orange: "var(--allura-orange)",
  blue:   "var(--allura-blue)",
  green:  "var(--allura-green)",
}

export function ReviewQueuePanel() {
  return (
    <div className="border-b border-[var(--allura-border-1)]">
      <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--allura-border-1)]">
        <div className="flex items-center gap-2">
          <AlertTriangle size={13} className="text-[var(--allura-orange)]" />
          <span className="text-[11px] font-semibold uppercase tracking-widest text-[var(--allura-charcoal)]">Review Queue</span>
        </div>
        <button className="text-[10px] text-[var(--allura-blue)] hover:underline flex items-center gap-0.5">
          View All <ArrowRight size={10} />
        </button>
      </div>

      <div className="divide-y divide-[var(--allura-border-1)]">
        {items.map((item) => (
          <div key={item.id} className="flex items-start gap-2.5 px-4 py-2.5 hover:bg-[var(--allura-gray-100)] transition-colors cursor-pointer">
            <span
              className="mt-0.5 size-1.5 shrink-0 rounded-full"
              style={{ backgroundColor: toneColors[item.tone] ?? "var(--allura-gray-400)" }}
            />
            <span className="flex-1 text-[11px] text-[var(--allura-charcoal)] leading-snug">{item.text}</span>
            <span className="shrink-0 text-[10px] text-[var(--allura-gray-400)]">{item.age}</span>
          </div>
        ))}
      </div>
    </div>
  )
}
