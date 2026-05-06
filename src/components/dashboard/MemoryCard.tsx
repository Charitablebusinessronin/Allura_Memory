import type { Memory } from "@/lib/dashboard/types"
import { cn } from "@/lib/utils"

const TYPE_BADGE_LABELS: Record<Memory["type"], string> = {
  memory: "RAW MEMORY",
  event: "EVENT",
  outcome: "OUTCOME",
  insight: "INSIGHT",
}

function formatRelativeTime(timestamp: string): string {
  const diff = Date.now() - new Date(timestamp).getTime()
  const minutes = Math.floor(diff / 60_000)
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  if (days < 30) return `${days}d ago`
  const months = Math.floor(days / 30)
  return `${months}mo ago`
}

function formatConfidence(confidence: number | undefined): string | null {
  if (confidence == null) return null
  const pct = confidence > 1 ? confidence : confidence * 100
  return `${Math.round(pct)}%`
}

interface MemoryCardProps {
  memory: Memory
  selected?: boolean
  onClick?: () => void
  className?: string
}

export function MemoryCard({ memory, selected, onClick, className }: MemoryCardProps) {
  const isSuperseded = memory.status === "superseded"
  const isSelected = selected === true && !isSuperseded

  const badgeLabel = TYPE_BADGE_LABELS[memory.type] ?? memory.type.toUpperCase()
  const relativeTime = formatRelativeTime(memory.timestamp)
  const confidenceStr = formatConfidence(memory.confidence)
  const sourceRef = memory.evidenceIds[0] ?? memory.id

  const metaParts = [memory.agent, relativeTime, confidenceStr ? `Confidence ${confidenceStr}` : null].filter(Boolean)

  const isInteractive = !!onClick

  return (
    <article
      className={cn(
        "flex min-h-[140px] flex-col gap-2 rounded-xl border p-4",
        isSelected
          ? "border-[var(--allura-blue)] bg-[var(--tone-blue-bg)]"
          : "border-[var(--dashboard-border)] bg-[var(--dashboard-surface)]",
        isSuperseded && "bg-[var(--dashboard-surface-muted)] opacity-60",
        isInteractive && "cursor-pointer transition-colors hover:border-[var(--allura-blue)]/50",
        className
      )}
      onClick={onClick}
      role={isInteractive ? "button" : undefined}
      tabIndex={isInteractive ? 0 : undefined}
      onKeyDown={
        isInteractive
          ? (e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault()
                onClick()
              }
            }
          : undefined
      }
      aria-pressed={isInteractive ? isSelected : undefined}
    >
      {/* Type badge */}
      <p
        className={cn(
          "text-[10px] font-semibold tracking-[1.2px] uppercase leading-[14px]",
          isSuperseded
            ? "text-[var(--allura-blue)]/50"
            : "text-[var(--allura-blue)]"
        )}
      >
        {badgeLabel}
      </p>

      {/* Title */}
      <p
        className={cn(
          "text-sm font-semibold leading-5",
          isSuperseded
            ? "text-[var(--dashboard-text-primary)]/50"
            : "text-[var(--dashboard-text-primary)]"
        )}
      >
        {memory.title}
      </p>

      {/* Meta row */}
      <p
        className={cn(
          "text-xs leading-4",
          isSuperseded
            ? "text-[var(--dashboard-text-secondary)]/50"
            : "text-[var(--dashboard-text-secondary)]"
        )}
      >
        {metaParts.join(" • ")}
      </p>

      {/* Spacer */}
      <div className="flex-1" />

      {/* Source line */}
      <p
        className={cn(
          "text-[11px] leading-4",
          isSuperseded
            ? "text-[var(--dashboard-text-muted)]/50"
            : "text-[var(--dashboard-text-muted)]"
        )}
      >
        Source: {memory.project} · {sourceRef}
      </p>
    </article>
  )
}
