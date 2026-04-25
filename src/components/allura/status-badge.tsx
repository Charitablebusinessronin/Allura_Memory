"use client"

import { cn } from "@/lib/utils"
import type { AlluraStatus } from "@/lib/brand/allura"
import { ALLURA_STATUS_MAP } from "@/lib/brand/allura"

interface StatusBadgeProps {
  status: AlluraStatus
  className?: string
}

export function StatusBadge({ status, className }: StatusBadgeProps) {
  const config = ALLURA_STATUS_MAP[status]

  return (
    <span
      className={cn(
        "inline-flex items-center rounded-[var(--allura-radius-badge)] px-2.5 py-0.5",
        "text-xs font-semibold leading-4 tracking-wide",
        className
      )}
      style={{
        backgroundColor: config.bg,
        color: config.text,
      }}
    >
      {config.label}
    </span>
  )
}