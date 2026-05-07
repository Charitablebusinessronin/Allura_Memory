"use client"

import { Clock, Search, X } from "lucide-react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { useMemo, useState } from "react"
import { toast } from "sonner"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { Spinner } from "@/components/ui/spinner"
import { DEFAULT_GROUP_ID, DEFAULT_USER_ID } from "@/lib/defaults/scope"
import { formatRelativeTime } from "@/lib/utils/date"
import { useMemoryList } from "@/hooks/use-memory-list"
import type { Memory } from "@/hooks/use-memory-list"

// ── Plain-English provenance labels ───────────────────────────────────────

function provenanceLabel(memory: Memory): string {
  if (memory.provenance === "conversation") {
    const time = formatRelativeTime(memory.created_at)
    return `Learned from a conversation ${time}`
  }
  return `Added by you ${formatRelativeTime(memory.created_at)}`
}

function confidenceLabel(score: number): string {
  const pct = Math.round(score * 100)
  if (pct >= 90) return "High confidence"
  if (pct >= 70) return "Fairly confident"
  if (pct >= 50) return "Some confidence"
  return "Low confidence"
}

// ── Page ──────────────────────────────────────────────────────────────────

export default function ConsumerMemoryPage() {
  const router = useRouter()

  const {
    memories,
    hasMore,
    isLoading,
    isLoadingMore,
    searchQuery,
    setSearchQuery,
    groupId,
    userId,
    loadMore,
    deleteMemory,
    formatRelativeTime: fmt,
  } = useMemoryList({
    groupId: DEFAULT_GROUP_ID,
    userId: DEFAULT_USER_ID,
    limit: 30,
  })

  const [forgetTarget, setForgetTarget] = useState<Memory | null>(null)
  const [isDeleting, setIsDeleting] = useState(false)
  const [forgottenIds, setForgottenIds] = useState<Set<string>>(new Set())

  const handleForget = async () => {
    if (!forgetTarget) return
    setIsDeleting(true)
    try {
      await deleteMemory(forgetTarget)
      setForgottenIds((prev) => new Set(prev).add(forgetTarget.id))
    } finally {
      setIsDeleting(false)
      setForgetTarget(null)
    }
  }

  const resultsLabel = useMemo(() => {
    if (searchQuery) {
      return `${memories.length} result${memories.length === 1 ? "" : "s"} for "${searchQuery}"`
    }
    return `${memories.length} memor${memories.length === 1 ? "y" : "ies"}`
  }, [memories.length, searchQuery])

  return (
    <div className="flex min-h-screen flex-col" style={{ background: "var(--allura-white)" }}>
      {/* ── Minimal consumer nav ── */}
      <header
        className="sticky top-0 z-20 border-b"
        style={{
          borderColor: "var(--allura-border-1)",
          background: "color-mix(in srgb, var(--allura-white) 92%, transparent)",
          backdropFilter: "blur(12px)",
        }}
      >
        <div className="mx-auto flex max-w-4xl items-center justify-between px-4 py-4 sm:px-6">
          <Link
            href="/memory"
            className="font-display text-xl font-black tracking-tight"
            style={{ fontFamily: "var(--font-family-display)", color: "var(--allura-charcoal)" }}
          >
            Allura
          </Link>
          <nav className="flex items-center gap-6 text-sm font-medium" style={{ color: "var(--allura-text-2)" }}>
            <Link href="/memory" className="transition-colors hover:text-[var(--allura-charcoal)]">
              Memories
            </Link>
          </nav>
        </div>
      </header>

      {/* ── Hero ── */}
      <section className="px-4 pt-12 pb-8 text-center sm:pt-16 sm:pb-10">
        <h1
          className="font-display text-3xl font-black leading-tight tracking-tight sm:text-4xl"
          style={{ fontFamily: "var(--font-family-display)", color: "var(--allura-charcoal)" }}
        >
          What your system remembers
        </h1>
        <p className="mx-auto mt-3 max-w-md text-base leading-relaxed" style={{ color: "var(--allura-text-2)" }}>
          A warm, honest view into everything Allura has learned about your world.
        </p>
      </section>

      {/* ── Search ── */}
      <section className="px-4 pb-2 sm:px-6">
        <div className="mx-auto max-w-[640px]">
          <div className="memory-search">
            <Search className="size-5 shrink-0" style={{ color: "var(--allura-text-3)" }} />
            <input
              type="text"
              placeholder="Search memories by phrase or topic"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              aria-label="Search memories"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery("")}
                className="flex shrink-0 items-center justify-center rounded-full p-0.5 transition-colors hover:bg-[var(--allura-muted)]"
                aria-label="Clear search"
              >
                <X className="size-4" style={{ color: "var(--allura-text-2)" }} />
              </button>
            )}
          </div>
          {!isLoading && (
            <p className="mt-2 text-xs" style={{ color: "var(--allura-text-3)" }}>
              {resultsLabel}
            </p>
          )}
        </div>
      </section>

      {/* ── Memory list ── */}
      <section className="flex-1 px-4 pt-4 pb-16 sm:px-6">
        <div className="mx-auto max-w-[640px]">
          {isLoading ? (
            <div className="flex items-center justify-center py-16">
              <Spinner />
            </div>
          ) : memories.length === 0 ? (
            <div className="memory-empty">
              <h2
                className="font-display"
                style={{ fontFamily: "var(--font-family-display)", color: "var(--allura-charcoal)" }}
              >
                Nothing has been saved yet
              </h2>
              <p style={{ color: "var(--allura-text-2)" }}>
                Once conversations or notes are stored, they will appear here as a warm record
                of what Allura has learned.
              </p>
            </div>
          ) : (
            <div className="rounded-xl overflow-hidden border" style={{ borderColor: "var(--allura-border-1)" }}>
              {memories.map((memory) => {
                const isForgotten = forgottenIds.has(memory.id)
                return (
                  <button
                    key={memory.id}
                    type="button"
                    className={`memory-list-item w-full text-left ${isForgotten ? "memory-forgotten opacity-60" : ""}`}
                    onClick={() => router.push(`/memory/${memory.id}`)}
                    style={isForgotten ? undefined : undefined}
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="min-w-0 flex-1">
                        <p
                          className="line-clamp-2 text-base font-medium leading-relaxed"
                          style={{ color: "var(--allura-charcoal)" }}
                        >
                          {memory.content}
                        </p>
                        <div className="mt-1.5 flex flex-wrap items-center gap-2">
                          <span className="memory-provenance">
                            {provenanceLabel(memory)}
                          </span>
                          <span
                            className="rounded-full px-2 py-0.5 text-xs font-medium"
                            style={{
                              background: "var(--allura-muted)",
                              color: "var(--allura-text-2)",
                            }}
                          >
                            {confidenceLabel(memory.score)}
                          </span>
                        </div>
                      </div>
                      <Clock
                        className="mt-0.5 size-4 shrink-0"
                        style={{ color: "var(--allura-text-3)" }}
                      />
                    </div>
                    {isForgotten && (
                      <p className="memory-forgotten-recovery-note">
                        This memory has been forgotten. It can be restored within 30 days.
                      </p>
                    )}
                  </button>
                )
              })}
            </div>
          )}

          {hasMore && memories.length > 0 && (
            <div className="mt-6 flex justify-center">
              <button
                type="button"
                onClick={loadMore}
                disabled={isLoadingMore}
                className="rounded-lg px-5 py-2.5 text-sm font-medium transition-colors"
                style={{
                  border: "1px solid var(--allura-border-1)",
                  background: "var(--allura-white)",
                  color: "var(--allura-charcoal)",
                }}
              >
                {isLoadingMore ? "Loading…" : "Load more memories"}
              </button>
            </div>
          )}
        </div>
      </section>

      {/* ── Forget confirmation ── */}
      <AlertDialog open={forgetTarget !== null} onOpenChange={(open) => { if (!open) setForgetTarget(null) }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Forget this memory?</AlertDialogTitle>
            <AlertDialogDescription>
              It will be moved aside and hidden from view. You can restore it within 30 days if you change your mind.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>Keep it</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleForget}
              disabled={isDeleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isDeleting ? "Forgetting…" : "Forget it"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
