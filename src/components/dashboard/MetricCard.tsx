import { Database } from "lucide-react"

import type { Metric } from "@/lib/dashboard/types"
import { cn } from "@/lib/utils"

const toneClasses: Record<Metric["tone"], string> = {
  blue: "bg-[var(--tone-blue-bg)] text-[var(--tone-blue-text)]",
  orange: "bg-[var(--tone-orange-bg)] text-[var(--tone-orange-text)]",
  green: "bg-[var(--tone-green-bg)] text-[var(--tone-green-text)]",
  charcoal: "bg-[var(--tone-charcoal-bg)] text-[var(--tone-charcoal-text)]",
  gold: "bg-[var(--tone-gold-bg)] text-[var(--tone-gold-text)]",
  red: "bg-[var(--tone-red-bg)] text-[var(--tone-red-text)]",
  muted: "bg-muted text-muted-foreground",
}

export function MetricCard({ metric }: { metric: Metric }) {
  return (
    <div className="rounded-xl border bg-card p-5 shadow-xs">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm font-medium text-muted-foreground">{metric.label}</p>
          <p className="mt-2 text-3xl font-semibold">{metric.value}</p>
          <p className="text-muted-foreground mt-1 text-xs">{metric.description}</p>
        </div>
        <div className={cn("rounded-full p-3", toneClasses[metric.tone])}>
          <Database className="size-5" />
        </div>
      </div>
    </div>
  )
}