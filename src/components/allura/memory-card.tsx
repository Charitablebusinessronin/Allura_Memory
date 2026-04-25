"use client"

import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { StatusBadge } from "@/components/allura/status-badge"
import { ConfidenceBar } from "@/components/allura/confidence-bar"
import type { Memory } from "@/hooks/use-memory-list"

interface MemoryCardProps {
  memory: Memory
  onViewSource: () => void
  onForget: () => void
  formatRelativeTime?: (dateString: string) => string
  className?: string
}

function getMemoryStatus(memory: Memory): "active" | "proposed" | "forgotten" | "low_confidence" {
  if (memory.score >= 0.85) return "active"
  if (memory.score >= 0.7) return "proposed"
  if (memory.score < 0.5) return "low_confidence"
  return "proposed"
}

export function AlluraMemoryCard({ memory, onViewSource, onForget, formatRelativeTime, className }: MemoryCardProps) {
  const status = getMemoryStatus(memory)
  const provenanceLabel = memory.provenance === "conversation" ? "From conversation" : "Added manually"
  const timeLabel = formatRelativeTime
    ? formatRelativeTime(memory.created_at)
    : new Date(memory.created_at).toLocaleDateString()

  return (
    <Card
      className={`group relative overflow-hidden border border-transparent bg-white shadow-[var(--allura-shadow-card)] transition-all hover:shadow-[var(--allura-shadow-hover)] ${className ?? ""}`}
      style={{ borderRadius: "var(--allura-radius-card)" }}
    >
      <CardContent className="p-5">
        <div className="mb-3 flex items-start justify-between gap-3">
          <StatusBadge status={status} />
          {memory.score !== undefined && memory.score !== null && (
            <ConfidenceBar value={memory.score * 100} />
          )}
        </div>

        <p className="mb-1 line-clamp-3 text-base leading-7 font-medium text-[var(--allura-ink-black)]">
          {memory.content}
        </p>

        <div className="mt-3 flex flex-wrap items-center gap-2 text-sm text-[var(--allura-warm-gray)]">
          <span>{timeLabel}</span>
          <span aria-hidden="true">&middot;</span>
          <span>{provenanceLabel}</span>
          {memory.source !== "both" && memory.source && (
            <>
              <span aria-hidden="true">&middot;</span>
              <span className="capitalize">{memory.source} store</span>
            </>
          )}
          {memory.source === "both" && (
            <>
              <span aria-hidden="true">&middot;</span>
              <span>Both stores</span>
            </>
          )}
        </div>

        {memory.tags && memory.tags.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-1.5">
            {memory.tags.slice(0, 4).map((tag) => (
              <span
                key={tag}
                className="rounded-full bg-[var(--allura-navy-5)] px-2.5 py-0.5 text-xs font-medium text-[var(--allura-deep-navy)]"
              >
                {tag}
              </span>
            ))}
            {memory.tags.length > 4 && (
              <span className="rounded-full bg-[var(--allura-navy-5)] px-2.5 py-0.5 text-xs text-[var(--allura-warm-gray)]">
                +{memory.tags.length - 4}
              </span>
            )}
          </div>
        )}

        <div className="mt-4 flex items-center justify-between border-t border-[var(--allura-deep-navy)]/10 pt-3">
          <button
            type="button"
            onClick={onViewSource}
            className="text-sm font-medium text-[var(--allura-deep-navy)] transition-colors hover:underline"
          >
            View Source
          </button>
          <Button
            size="sm"
            onClick={onForget}
            className="bg-[var(--allura-coral)] text-white hover:bg-[var(--allura-coral)]/90"
            style={{ borderRadius: "var(--allura-radius-button)" }}
          >
            Forget
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}