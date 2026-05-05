import type { ReactNode } from "react"

import type { Insight } from "@/lib/dashboard/types"
import { cn } from "@/lib/utils"

// ─── State resolution ────────────────────────────────────────────────────────

type CardState = "candidate" | "approved" | "rejected"

function resolveState(status: Insight["status"]): CardState {
  if (status === "approved" || status === "active") return "approved"
  if (status === "rejected" || status === "superseded" || status === "deprecated") return "rejected"
  return "candidate"
}

const STATE_STYLES: Record<
  CardState,
  {
    bg: string
    border: string
    badgeColor: string
    badgeLabel: string
  }
> = {
  candidate: {
    bg: "bg-[var(--dashboard-surface)]",
    border: "border-[var(--allura-orange)]",
    badgeColor: "text-[var(--allura-orange)]",
    badgeLabel: "INSIGHT CANDIDATE",
  },
  approved: {
    bg: "bg-[var(--tone-green-bg)]",
    border: "border-[var(--allura-green)]",
    badgeColor: "text-[var(--allura-green)]",
    badgeLabel: "APPROVED INSIGHT",
  },
  rejected: {
    bg: "bg-[var(--dashboard-surface-muted)]",
    border: "border-[var(--dashboard-border-default)]",
    badgeColor: "text-[var(--dashboard-text-muted)]",
    badgeLabel: "REJECTED",
  },
}

// ─── Component ───────────────────────────────────────────────────────────────

export interface InsightCardProps {
  insight: Insight
  actions?: ReactNode
  compact?: boolean
  className?: string
}

export function InsightCard({
  insight,
  actions,
  compact = false,
  className,
}: InsightCardProps) {
  const state = resolveState(insight.status)
  const { bg, border, badgeColor, badgeLabel } = STATE_STYLES[state]

  const confidencePct = Math.round(insight.confidence * 100)
  const metaText = `Confidence: ${confidencePct}% · Agent: ${insight.agent}`
  const sourceText = `Agent: ${insight.agent} · ${insight.evidenceId ?? insight.id}`

  return (
    <article
      className={cn(
        "flex min-h-[160px] flex-col gap-2 rounded-xl border-[1.5px] p-4",
        bg,
        border,
        className,
      )}
    >
      {/* Status badge */}
      <span className={cn("text-[10px] font-semibold uppercase tracking-[1.2px] leading-[14px]", badgeColor)}>
        {badgeLabel}
      </span>

      {/* Title */}
      <h3 className="text-sm font-semibold leading-5 text-[var(--dashboard-text-primary)]">
        {insight.title}
      </h3>

      {/* Meta row */}
      <p className="text-xs leading-4 text-[var(--dashboard-text-secondary)]">
        {metaText}
      </p>

      {/* Spacer */}
      <div className="flex-1" />

      {/* Source line */}
      <p className="text-[11px] leading-4 text-[var(--dashboard-text-muted)]">
        {sourceText}
      </p>

      {/* Actions slot */}
      {actions && (
        <div className={cn("flex flex-wrap gap-2", compact && "mt-0")}>
          {actions}
        </div>
      )}
    </article>
  )
}
