import { Database } from "lucide-react"

import type { Metric } from "@/lib/dashboard/types"
import { cn } from "@/lib/utils"

const toneClasses: Record<Metric["tone"], string> = {
  blue: "bg-[color-mix(in_srgb,#1D4ED8_10%,white)] text-[#1D4ED8]",
  orange: "bg-[color-mix(in_srgb,#FF5A2E_10%,white)] text-[#FF5A2E]",
  green: "bg-[color-mix(in_srgb,#157A4A_10%,white)] text-[#157A4A]",
  charcoal: "bg-[color-mix(in_srgb,#0F1115_10%,white)] text-[#0F1115]",
  gold: "bg-[color-mix(in_srgb,#C89B3C_10%,white)] text-[#A87D2B]",
  red: "bg-[color-mix(in_srgb,#FF5A2E_10%,white)] text-[#E04D1F]",
  muted: "bg-[#F3F4F6] text-[#6B7280]",
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