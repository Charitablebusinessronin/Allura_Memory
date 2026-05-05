"use client"

import { Layers } from "lucide-react"

const layers = [
  { label: "Raw Memory",     color: "#1D4ED8", count: "10,241", pct: 100 },
  { label: "Evidence",       color: "#2563EB", count: "634",    pct: 60  },
  { label: "Insight",        color: "#157A44", count: "248",    pct: 40  },
  { label: "ADR / Decisions",color: "#C89B3C", count: "87",     pct: 25  },
  { label: "Knowledge Graph",color: "#111827", count: "1,492",  pct: 50  },
  { label: "Notion Mirror",  color: "#6B7280", count: "312",    pct: 30  },
]

export function KnowledgeLayersPanel() {
  return (
    <div className="border-b border-[var(--allura-border-1)]">
      <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--allura-border-1)]">
        <div className="flex items-center gap-2">
          <Layers size={13} className="text-[var(--allura-blue)]" />
          <span className="text-[11px] font-semibold uppercase tracking-widest text-[var(--allura-charcoal)]">Knowledge Layers</span>
        </div>
        <span className="inline-flex items-center gap-1 rounded-full bg-[color-mix(in_srgb,var(--allura-green)_10%,white)] px-2 py-0.5 text-[10px] font-semibold text-[var(--allura-green)]">
          <span className="size-1.5 rounded-full bg-[var(--allura-green)]" />
          LIVE
        </span>
      </div>

      <div className="flex gap-4 px-4 py-3">
        {/* Stacked bar visual */}
        <div className="flex flex-col gap-1 shrink-0" style={{ width: 80 }}>
          {layers.map((l) => (
            <div
              key={l.label}
              className="rounded-sm"
              style={{
                height: Math.max(6, (l.pct / 100) * 14),
                backgroundColor: l.color,
                opacity: 0.85,
                width: "100%",
              }}
            />
          ))}
        </div>

        {/* Legend */}
        <div className="flex flex-col gap-1.5 flex-1 min-w-0">
          {layers.map((l) => (
            <div key={l.label} className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-1.5 min-w-0">
                <span className="size-2 rounded-sm shrink-0" style={{ backgroundColor: l.color }} />
                <span className="text-[10px] text-[var(--allura-gray-600)] truncate">{l.label}</span>
              </div>
              <span className="text-[10px] font-medium text-[var(--allura-charcoal)] shrink-0">{l.count}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
