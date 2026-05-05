import { cn } from "@/lib/utils"
import type { Memory, Insight, Evidence } from "@/lib/dashboard/types"

export type BadgeStatus =
  | Memory["status"]
  | Insight["status"]
  | Evidence["status"]
  | "processing"
  | "error"
  | "candidate"

interface StatusBadgeProps {
  status: BadgeStatus
  className?: string
}

const statusConfig: Record<
  BadgeStatus,
  { bg: string; text: string; label: string }
> = {
  approved: {
    bg: "bg-[var(--tone-green-bg)]",
    text: "text-[var(--tone-green-text)]",
    label: "Approved",
  },
  active: {
    bg: "bg-[var(--tone-green-bg)]",
    text: "text-[var(--allura-green)]",
    label: "Active",
  },
  pending: {
    bg: "bg-[var(--tone-orange-bg)]",
    text: "text-[var(--dashboard-text-secondary)]",
    label: "Pending",
  },
  candidate: {
    bg: "bg-[var(--tone-orange-bg)]",
    text: "text-[var(--tone-orange-text)]",
    label: "Candidate",
  },
  rejected: {
    bg: "bg-[var(--tone-red-bg)]",
    text: "text-[var(--tone-red-text)]",
    label: "Rejected",
  },
  superseded: {
    bg: "bg-[var(--dashboard-surface-muted)]",
    text: "text-[var(--dashboard-text-secondary)]",
    label: "Superseded",
  },
  processing: {
    bg: "bg-[var(--tone-blue-bg)]",
    text: "text-[var(--allura-blue)]",
    label: "Processing",
  },
  error: {
    bg: "bg-[var(--tone-red-bg)]",
    text: "text-[var(--tone-red-text)]",
    label: "Error",
  },
  unknown: {
    bg: "bg-[var(--dashboard-surface-muted)]",
    text: "text-[var(--dashboard-text-muted)]",
    label: "Unknown",
  },
  deprecated: {
    bg: "bg-[var(--dashboard-surface-muted)]",
    text: "text-[var(--dashboard-text-muted)]",
    label: "Deprecated",
  },
}

export function StatusBadge({ status, className }: StatusBadgeProps) {
  const config = statusConfig[status] ?? statusConfig.unknown

  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2 py-[3px] text-[12px] font-semibold whitespace-nowrap font-[var(--font-ibm-plex-sans)]",
        config.bg,
        config.text,
        className
      )}
    >
      {config.label}
    </span>
  )
}
