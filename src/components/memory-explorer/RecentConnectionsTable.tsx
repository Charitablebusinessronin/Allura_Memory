"use client"

import { useState } from "react"

const connections = [
  { type: "Evidence",           rel: "supports",    target: "Insight",             firstSeen: "Just now", confidence: 98.4 },
  { type: "Agent Brooks",       rel: "created",     target: "Memory",              firstSeen: "2m ago",   confidence: 94.7 },
  { type: "MCP Server Launch",  rel: "caused",      target: "Auth Failure",        firstSeen: "5m ago",   confidence: 92.1 },
  { type: "Missing DB Secrets", rel: "led to",      target: "Postgres Auth Failed",firstSeen: "5m ago",   confidence: 89.6 },
  { type: "Insight Candidate",  rel: "promoted to", target: "Approved Insight",    firstSeen: "9m ago",   confidence: 87.2 },
]

function confidenceColor(v: number) {
  if (v >= 92) return "var(--allura-green)"
  if (v >= 85) return "var(--allura-blue)"
  return "var(--allura-orange)"
}

const TABS = ["LEGEND", "PRESETS", "RECORDS", "CONNECTIONS"] as const
type Tab = typeof TABS[number]

export function RecentConnectionsTable() {
  const [activeTab, setActiveTab] = useState<Tab>("CONNECTIONS")
  return (
    <div className="h-full overflow-hidden flex flex-col">
      <div className="flex items-center justify-between px-4 py-2.5 border-b border-[var(--allura-border-1)] shrink-0">
        <div className="flex items-center gap-4">
          {TABS.map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`text-[10px] font-semibold uppercase tracking-widest pb-0.5 transition-colors duration-150 ${
                activeTab === tab
                  ? "text-[var(--allura-blue)] border-b-2 border-[var(--allura-blue)]"
                  : "text-[var(--allura-gray-400)] hover:text-[var(--allura-gray-600)]"
              }`}
            >
              {tab}
            </button>
          ))}
        </div>
        <span className="text-[10px] text-[var(--allura-gray-400)]">Recent Connections</span>
      </div>

      <div className="overflow-auto flex-1">
        {activeTab === "CONNECTIONS" && (
          <table className="w-full">
          <thead>
            <tr className="border-b border-[var(--allura-border-1)]">
              {["Type", "Relationship", "First Seen", "Confidence"].map((h) => (
                <th key={h} className="px-4 py-2 text-left text-[9px] uppercase tracking-widest text-[var(--allura-gray-400)] font-medium whitespace-nowrap">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--allura-border-1)]">
            {connections.map((row, i) => (
              <tr key={i} className="hover:bg-[var(--allura-gray-100)] transition-colors cursor-pointer">
                <td className="px-4 py-2.5">
                  <span className="inline-block rounded px-1.5 py-0.5 text-[10px] font-medium bg-[var(--allura-gray-100)] text-[var(--allura-charcoal)]">
                    {row.type}
                  </span>
                </td>
                <td className="px-4 py-2.5 text-[11px] text-[var(--allura-gray-500)]">
                  <span className="text-[var(--allura-gray-400)]">→</span> {row.rel} <span className="text-[var(--allura-charcoal)] font-medium">{row.target}</span>
                </td>
                <td className="px-4 py-2.5 text-[11px] text-[var(--allura-gray-400)] whitespace-nowrap">{row.firstSeen}</td>
                <td className="px-4 py-2.5">
                  <span className="text-[11px] font-bold" style={{ color: confidenceColor(row.confidence) }}>
                    {row.confidence}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        )}

        {activeTab !== "CONNECTIONS" && (
          <div className="flex items-center justify-center h-full">
            <div className="text-center">
              <p className="text-[11px] font-semibold uppercase tracking-widest text-[var(--allura-gray-400)]">
                {activeTab}
              </p>
              <p className="text-[10px] text-[var(--allura-gray-400)] mt-1">
                Coming soon
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
