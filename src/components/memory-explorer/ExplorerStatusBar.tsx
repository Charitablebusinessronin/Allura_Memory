"use client"

import { Activity, CheckCircle, Cpu, Database, Radio, Shield } from "lucide-react"
import { useEffect, useState } from "react"

export function ExplorerStatusBar() {
  const [time, setTime] = useState("")

  useEffect(() => {
    const update = () =>
      setTime(new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }))
    update()
    const t = setInterval(update, 60_000)
    return () => clearInterval(t)
  }, [])

  return (
    <div
      className="flex h-9 shrink-0 items-center justify-between border-t border-[var(--allura-border-1)] bg-[var(--allura-charcoal)] px-4"
      style={{ fontFamily: "'IBM Plex Mono', ui-monospace, monospace" }}
    >
      {/* Left cluster */}
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-1.5">
          <span className="size-1.5 rounded-full bg-[var(--allura-blue)]" />
          <span className="text-[10px] text-[var(--allura-gray-300)] uppercase tracking-widest">54 Active Nodes</span>
        </div>
        <div className="flex items-center gap-1.5">
          <Database size={10} className="text-[var(--allura-gray-400)]" />
          <span className="text-[10px] text-[var(--allura-gray-300)]">{time} Records Synced</span>
        </div>
        <div className="flex items-center gap-1.5">
          <Radio size={10} className="text-[var(--allura-green)]" />
          <span className="text-[10px] text-[var(--allura-green)] uppercase tracking-widest">Synaptic Stream</span>
        </div>
      </div>

      {/* Center */}
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-1.5">
          <Cpu size={10} className="text-[var(--dashboard-evidence)]" />
          <span className="text-[10px] text-[var(--allura-gray-300)]">Memory Model: v2.1</span>
        </div>
        <div className="flex items-center gap-1.5">
          <CheckCircle size={10} className="text-[var(--allura-green)]" />
          <span className="text-[10px] text-[var(--allura-green)]">All Systems Operational</span>
        </div>
      </div>

      {/* Right cluster */}
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-1.5">
          <Activity size={10} className="text-[var(--allura-orange)]" />
          <span className="text-[10px] text-[var(--allura-orange)] font-bold">99%</span>
          <span className="text-[10px] text-[var(--allura-gray-300)]">Live Agent: Active</span>
        </div>
        <span className="text-[10px] font-semibold uppercase tracking-widest text-[var(--allura-cream)]">
          Allura Memory
        </span>
      </div>
    </div>
  )
}
