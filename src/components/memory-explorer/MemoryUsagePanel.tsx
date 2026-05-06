"use client"

import { BarChart2 } from "lucide-react"

// Inline sparkline SVG — no extra dep
function Sparkline({ data, color, height = 32 }: { data: number[]; color: string; height?: number }) {
  const max = Math.max(...data)
  const min = Math.min(...data)
  const range = max - min || 1
  const w = 120
  const h = height
  const step = w / (data.length - 1)
  const pts = data
    .map((v, i) => `${i * step},${h - ((v - min) / range) * (h - 4) - 2}`)
    .join(" ")
  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} fill="none">
      <polyline points={pts} stroke={color} strokeWidth="1.5" strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  )
}

// Bar chart inline
function MiniBarChart({ data, color }: { data: number[]; color: string }) {
  const max = Math.max(...data)
  return (
    <svg width={120} height={32} viewBox="0 0 120 32" fill="none">
      {data.map((v, i) => {
        const barH = Math.max(2, (v / max) * 28)
        return (
          <rect
            key={i}
            x={i * (120 / data.length) + 1}
            y={32 - barH}
            width={120 / data.length - 2}
            height={barH}
            rx={1}
            fill={color}
            fillOpacity={0.8}
          />
        )
      })}
    </svg>
  )
}

const charts = [
  {
    label: "Memory Capture Rate",
    sublabel: "ACTIVE MEMORY",
    data: [12, 18, 15, 22, 19, 28, 25, 31, 27, 35],
    type: "bar" as const,
    color: "var(--allura-blue)",
  },
  {
    label: "Human vs AI",
    sublabel: "CONTRIBUTIONS",
    data: [30, 35, 28, 40, 38, 45, 42, 48, 44, 52],
    type: "bar" as const,
    color: "var(--allura-green)",
    dataB: [20, 18, 22, 15, 17, 14, 16, 12, 15, 10],
    colorB: "var(--allura-orange)",
  },
  {
    label: "Retrievals",
    sublabel: "OVER TIME",
    data: [5, 8, 12, 9, 15, 11, 18, 14, 22, 17],
    type: "bar" as const,
    color: "var(--allura-blue)",
  },
  {
    label: "Latency p95",
    sublabel: "MS",
    data: [180, 210, 195, 230, 215, 200, 225, 190, 210, 185],
    type: "line" as const,
    color: "var(--allura-orange)",
  },
  {
    label: "Promotion Accuracy",
    sublabel: "INSIGHT APPROVAL",
    data: [72, 75, 74, 78, 76, 80, 79, 82, 81, 84],
    type: "line" as const,
    color: "var(--allura-green)",
  },
  {
    label: "Insight Approval",
    sublabel: "RATE",
    data: [60, 65, 62, 68, 70, 67, 72, 74, 71, 76],
    type: "line" as const,
    color: "var(--dashboard-evidence)",
  },
]

export function MemoryUsagePanel() {
  return (
    <div className="border-b border-[var(--allura-border-1)]">
      <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--allura-border-1)]">
        <div className="flex items-center gap-2">
          <BarChart2 size={13} className="text-[var(--allura-blue)]" />
          <span className="text-[11px] font-semibold uppercase tracking-widest text-[var(--allura-charcoal)]">Memory Usage</span>
        </div>
        <select className="text-[10px] text-[var(--allura-gray-500)] bg-transparent border border-[var(--allura-border-1)] rounded px-1.5 py-0.5">
          <option>30D</option>
          <option>7D</option>
          <option>1D</option>
        </select>
      </div>

      <div className="grid grid-cols-3 divide-x divide-[var(--allura-border-1)]">
        {charts.map((c) => (
          <div key={c.label} className="px-3 py-2.5 border-b border-[var(--allura-border-1)] last:border-b-0 [&:nth-child(n+4)]:border-b-0">
            <p className="text-[9px] uppercase tracking-widest text-[var(--allura-gray-400)] mb-1">{c.sublabel}</p>
            {c.type === "bar" ? (
              <MiniBarChart data={c.data} color={c.color} />
            ) : (
              <Sparkline data={c.data} color={c.color} />
            )}
            <p className="text-[10px] text-[var(--allura-gray-500)] mt-1">{c.label}</p>
          </div>
        ))}
      </div>
    </div>
  )
}
