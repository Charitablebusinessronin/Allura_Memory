"use client"

import { useCallback, useEffect, useRef } from "react"
import { X } from "lucide-react"
import { cn } from "@/lib/utils"
import type { Memory } from "@/hooks/use-memory-list"
import { StatusBadge } from "@/components/allura/status-badge"
import { ConfidenceBar } from "@/components/allura/confidence-bar"
import { TraceCard } from "@/components/allura/trace-card"
import { Button } from "@/components/ui/button"

interface TraceEntry {
  tool: string
  snippet: string
  timestamp: string
}

interface PanelDrawerProps {
  memory: Memory | null
  open: boolean
  onClose: () => void
  formatRelativeTime?: (dateString: string) => string
  className?: string
}

function getMemoryStatus(memory: Memory): "active" | "proposed" | "forgotten" | "low_confidence" {
  if (memory.score >= 0.85) return "active"
  if (memory.score >= 0.7) return "proposed"
  if (memory.score < 0.5) return "low_confidence"
  return "proposed"
}

function getTraces(memory: Memory): TraceEntry[] {
  return [
    {
      tool: "memory.search",
      snippet: "Queried knowledge graph for related context",
      timestamp: new Date(memory.created_at).toLocaleTimeString(),
    },
  ]
}

function SkeletonRow() {
  return (
    <div className="space-y-3 p-6">
      <div className="h-4 w-24 animate-pulse rounded bg-[var(--allura-coral-10)]" />
      <div className="h-6 w-40 animate-pulse rounded bg-[var(--allura-navy-5)]" />
      <div className="mt-6 h-4 w-24 animate-pulse rounded bg-[var(--allura-coral-10)]" />
      <div className="h-20 w-full animate-pulse rounded bg-[var(--allura-navy-5)]" />
      <div className="mt-6 h-4 w-24 animate-pulse rounded bg-[var(--allura-coral-10)]" />
      <div className="flex gap-3">
        <div className="h-10 w-28 animate-pulse rounded bg-[var(--allura-navy-5)]" />
        <div className="h-10 w-20 animate-pulse rounded bg-[var(--allura-navy-5)]" />
        <div className="h-10 w-24 animate-pulse rounded bg-[var(--allura-navy-5)]" />
      </div>
    </div>
  )
}

export function PanelDrawer({ memory, open, onClose, formatRelativeTime, className }: PanelDrawerProps) {
  const drawerRef = useRef<HTMLDivElement>(null)
  const previousFocusRef = useRef<HTMLElement | null>(null)

  useEffect(() => {
    if (open) {
      previousFocusRef.current = document.activeElement as HTMLElement
      drawerRef.current?.focus()
    }
  }, [open])

  useEffect(() => {
    if (!open && previousFocusRef.current) {
      previousFocusRef.current.focus()
      previousFocusRef.current = null
    }
  }, [open])

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose()
      }
    },
    [onClose]
  )

  useEffect(() => {
    if (!open) return
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose()
    }
    document.addEventListener("keydown", handler)
    return () => document.removeEventListener("keydown", handler)
  }, [open, onClose])

  const status = memory ? getMemoryStatus(memory) : undefined
  const traces = memory ? getTraces(memory) : []
  const timeLabel = memory && formatRelativeTime ? formatRelativeTime(memory.created_at) : memory ? new Date(memory.created_at).toLocaleDateString() : ""

  return (
    <>
      {open && (
        <div
          className="fixed inset-0 z-40 bg-black/20 backdrop-blur-sm"
          onClick={onClose}
          aria-hidden="true"
        />
      )}
      <div
        ref={drawerRef}
        role="dialog"
        aria-modal={open}
        aria-label="Memory source details"
        tabIndex={-1}
        onKeyDown={handleKeyDown}
        className={cn(
          "fixed inset-y-0 right-0 z-50 flex w-full flex-col border-l border-[var(--allura-deep-navy)]/10 bg-[var(--allura-pure-white)] shadow-[var(--allura-shadow-modal)] transition-transform duration-300 ease-out",
          "sm:w-[420px]",
          open ? "translate-x-0" : "translate-x-full",
          className
        )}
      >
        <div className="flex items-center justify-between border-b border-[var(--allura-deep-navy)]/10 px-6 py-4">
          <h2 className="font-display text-lg text-[var(--allura-deep-navy)]">
            Source Details
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-[var(--allura-radius-button)] p-1.5 text-[var(--allura-warm-gray)] transition-colors hover:bg-[var(--allura-navy-5)] hover:text-[var(--allura-deep-navy)]"
            aria-label="Close panel"
          >
            <X className="size-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto">
          {!memory ? (
            <div className="flex flex-col items-center justify-center py-20 text-center">
              <p className="text-sm text-[var(--allura-warm-gray)]">
                Source not available
              </p>
            </div>
          ) : (
            <div className="space-y-0">
              {/* Origin section */}
              <section className="border-b border-[var(--allura-deep-navy)]/10 px-6 py-5">
                <p className="mb-3 text-[11px] font-bold tracking-[0.2em] text-[var(--allura-deep-navy)] uppercase">
                  Origin
                </p>
                <div className="flex items-center gap-3">
                  <span className="text-base font-semibold text-[var(--allura-deep-navy)]">
                    {memory.provenance === "conversation" ? "Conversation agent" : "Manual entry"}
                  </span>
                  {status && <StatusBadge status={status} />}
                </div>
                <p className="mt-1.5 text-sm text-[var(--allura-warm-gray)]">
                  {traces.length} trace{traces.length === 1 ? "" : "s"} recorded
                </p>
                {memory.score !== undefined && memory.score !== null && (
                  <div className="mt-3">
                    <ConfidenceBar value={memory.score * 100} />
                  </div>
                )}
                <p className="mt-2 text-xs text-[var(--allura-warm-gray)]">
                  {timeLabel}
                </p>
              </section>

              {/* Evidence section */}
              <section className="border-b border-[var(--allura-deep-navy)]/10 px-6 py-5">
                <p className="mb-3 text-[11px] font-bold tracking-[0.2em] text-[var(--allura-deep-navy)] uppercase">
                  Evidence
                </p>
                <div className="space-y-2">
                  {traces.map((trace, i) => (
                    <TraceCard
                      key={i}
                      tool={trace.tool}
                      snippet={trace.snippet}
                      timestamp={trace.timestamp}
                    />
                  ))}
                </div>
              </section>

              {/* Content preview */}
              <section className="border-b border-[var(--allura-deep-navy)]/10 px-6 py-5">
                <p className="mb-3 text-[11px] font-bold tracking-[0.2em] text-[var(--allura-deep-navy)] uppercase">
                  Content
                </p>
                <p className="text-sm leading-6 text-[var(--allura-ink-black)]">
                  {memory.content}
                </p>
                {memory.tags && memory.tags.length > 0 && (
                  <div className="mt-3 flex flex-wrap gap-1.5">
                    {memory.tags.slice(0, 6).map((tag) => (
                      <span
                        key={tag}
                        className="rounded-full bg-[var(--allura-navy-5)] px-2.5 py-0.5 text-xs font-medium text-[var(--allura-deep-navy)]"
                      >
                        {tag}
                      </span>
                    ))}
                    {memory.tags.length > 6 && (
                      <span className="rounded-full bg-[var(--allura-navy-5)] px-2.5 py-0.5 text-xs text-[var(--allura-warm-gray)]">
                        +{memory.tags.length - 6}
                      </span>
                    )}
                  </div>
                )}
              </section>

              {/* Actions section */}
              <section className="px-6 py-5">
                <p className="mb-3 text-[11px] font-bold tracking-[0.2em] text-[var(--allura-deep-navy)] uppercase">
                  Actions
                </p>
                <div className="flex flex-wrap gap-2">
                  <Button
                    className="bg-[var(--allura-deep-navy)] text-[var(--allura-pure-white)] hover:bg-[var(--allura-deep-navy)]/90"
                    style={{ borderRadius: "var(--allura-radius-button)" }}
                  >
                    Promote
                  </Button>
                  <Button
                    variant="outline"
                    className="border-[var(--allura-deep-navy)] text-[var(--allura-deep-navy)]"
                    style={{ borderRadius: "var(--allura-radius-button)" }}
                  >
                    Edit
                  </Button>
                  <Button
                    variant="ghost"
                    className="text-[var(--allura-deep-navy)] hover:bg-[var(--allura-coral-10)]"
                    style={{ borderRadius: "var(--allura-radius-button)" }}
                  >
                    Deprecate
                  </Button>
                </div>
              </section>
            </div>
          )}
        </div>
      </div>
    </>
  )
}