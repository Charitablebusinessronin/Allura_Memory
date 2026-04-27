import { Database } from "lucide-react"

import type { Metric } from "@/lib/dashboard/types"
import { cn } from "@/lib/utils"
import { tokens } from "@/lib/tokens"

const toneClasses: Record<Metric["tone"], string> = {
  blue:     `bg-[color-mix(in_srgb,${tokens.color.primary.default}_10%,white)]     text-[var(--allura-blue)]`,
  orange:   `bg-[color-mix(in_srgb,${tokens.color.secondary.default}_10%,white)]   text-[var(--allura-orange)]`,
  green:    `bg-[color-mix(in_srgb,${tokens.color.success.default}_10%,white)]     text-[var(--allura-green)]`,
  charcoal: `bg-[color-mix(in_srgb,${tokens.color.text.primary}_10%,white)]       text-[var(--allura-charcoal)]`,
  gold:     `bg-[color-mix(in_srgb,${tokens.color.accent.gold}_10%,white)]        text-[var(--allura-gold-hover)]`,
  red:      `bg-[color-mix(in_srgb,${tokens.color.secondary.hover}_10%,white)]    text-[var(--allura-orange-hover)]`,
  muted:    `bg-[var(--allura-muted)]                                    text-[var(--allura-text-2)]`,
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
