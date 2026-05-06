"use client"

import { Activity } from "lucide-react"

// Inline sparkline for health metrics
function HealthSparkline({ data, color }: { data: number[]; color: string }) {
  const max = Math.max(...data)
  const min = Math.min(...data)
  const range = max - min || 1
  const w = 80
  const h = 20
  const step = w / (data.length - 1)
  const pts = data
    .map((v, i) => `${i * step},${h - ((v - min) / range) * (h - 2) - 1}`)
    .join(" ")
  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} fill="none">
      <polyline points={pts} stroke={color} strokeWidth="1.5" strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  )
}

const metrics = [
  { label: "CPU Usage",    value: 58, data: [45,50,52,48,55,57,54,58,56,58], color: "var(--allura-blue)" },
  { label: "Memory Usage", value: 62, data: [55,58,60,57,62,61,63,60,62,62], color: "var(--allura-green)" },
  { label: "Disk I/O",     value: 41, data: [30,35,38,32,40,38,41,39,40,41], color: "var(--allura-orange)" },
  { label: "Network I/O",  value: 72, data: [60,65,68,62,70,68,72,69,71,72], color: "var(--dashboard-evidence)" },
]

function pctColor(v: number) {
  if (v >= 80) return "var(--allura-orange)"
  if (v >= 60) return "var(--dashboard-evidence)"
  return "var(--allura-green)"
}

export function SystemHealthPanel() {
  return (
    <div>
      <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--allura-border-1)]">
        <div className="flex items-center gap-2">
          <Activity size={13} className="text-[var(--allura-green)]" />
          <span className="text-[11px] font-semibold uppercase tracking-widest text-[var(--allura-charcoal)]">System Health</span>
        </div>
        <span className="inline-flex items-center gap-1 rounded-full bg-[color-mix(in_srgb,var(--allura-green)_10%,white)] px-2 py-0.5 text-[10px] font-semibold text-[var(--allura-green)]">
          <span className="size-1.5 rounded-full bg-[var(--allura-green)]" />
          LIVE
        </span>
      </div>

      <div className="divide-y divide-[var(--allura-border-1)]">
        {metrics.map((m) => (
          <div key={m.label} className="flex items-center gap-3 px-4 py-2.5">
            <span className="w-20 text-[10px] text-[var(--allura-gray-500)] shrink-0">{m.label}</span>
            <div className="flex-1 min-w-0">
              <HealthSparkline data={m.data} color={m.color} />
            </div>
            <span className="text-[11px] font-bold shrink-0" style={{ color: pctColor(m.value) }}>{m.value}%</span>
          </div>
        ))}
      </div>
    </div>
  )
}
