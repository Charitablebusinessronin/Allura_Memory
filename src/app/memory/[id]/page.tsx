"use client"

import { ArrowLeft, Clock, History, PencilLine, RotateCcw, Sparkles } from "lucide-react"
import { useParams, useRouter } from "next/navigation"
import { useCallback, useEffect, useMemo, useState } from "react"
import type { JSX } from "react"
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
import { Textarea } from "@/components/ui/textarea"
import { DEFAULT_GROUP_ID, DEFAULT_USER_ID } from "@/lib/defaults/scope"
import { formatRelativeTime, normalizeNeo4jTimestamp } from "@/lib/utils/date"

// ── Types ─────────────────────────────────────────────────────────────────

interface MemoryDetail {
  id: string
  content: string
  score: number
  source: "episodic" | "semantic" | "both"
  provenance: "conversation" | "manual"
  user_id: string
  created_at: string
  version?: number
  superseded_by?: string
  usage_count?: number
  recent_usage_count?: number | null
}

interface DeletedMemoryItem {
  id: string
  content: string
  deleted_at: string
  recovery_days_remaining: number
  created_at: string
  score: number
  source: "episodic" | "semantic" | "both"
  provenance: "conversation" | "manual"
  user_id: string
  version?: number
}

// ── Plain-English helpers ─────────────────────────────────────────────────

function toSourceProse(memory: MemoryDetail): string {
  const date = new Date(memory.created_at).toLocaleDateString("en-US", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  })
  if (memory.provenance === "conversation") {
    return `Heard during a conversation on ${date}`
  }
  return `Written by hand on ${date}`
}

function toStoreProse(source: MemoryDetail["source"]): string {
  if (source === "both") return "Kept in both memory stores for safekeeping."
  if (source === "episodic") return "Stored in the day-to-day memory store."
  return "Stored in the long-term knowledge store."
}

function toConfidenceProse(score: number): string {
  const pct = Math.round(score * 100)
  if (pct >= 90) return `High confidence (${pct}%) — Allura is very sure about this.`
  if (pct >= 70) return `Fairly confident (${pct}%) — the system believes this is accurate.`
  if (pct >= 50) return `Moderate confidence (${pct}%) — worth verifying.`
  return `Low confidence (${pct}%) — take this one with a grain of salt.`
}

// ── Page ──────────────────────────────────────────────────────────────────

export default function MemoryDetailPage(): JSX.Element | null {
  const params = useParams<{ id: string }>()
  const router = useRouter()
  const memoryId = params.id

  const [memory, setMemory] = useState<MemoryDetail | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Edit state
  const [isEditing, setIsEditing] = useState(false)
  const [editContent, setEditContent] = useState("")
  const [isSaving, setIsSaving] = useState(false)

  // Delete state
  const [showForgetConfirm, setShowForgetConfirm] = useState(false)
  const [isForgetting, setIsForgetting] = useState(false)
  const [isForgotten, setIsForgotten] = useState(false)
  const [forgottenAt, setForgottenAt] = useState<string | null>(null)

  // Restore state
  const [isRestoring, setIsRestoring] = useState(false)

  const groupId = DEFAULT_GROUP_ID
  const userId = DEFAULT_USER_ID

  const fetchMemory = useCallback(async (): Promise<void> => {
    setIsLoading(true)
    setError(null)

    try {
      const resp = await fetch(
        `/api/memory/${encodeURIComponent(memoryId)}?group_id=${encodeURIComponent(groupId)}`
      )

      if (!resp.ok) {
        if (resp.status === 404) {
          // Check deleted list
          try {
            const deletedResp = await fetch(
              `/api/memory?group_id=${encodeURIComponent(groupId)}&status=deleted&limit=200`
            )
            if (deletedResp.ok) {
              const data = await deletedResp.json()
              const deleted = (data.memories ?? []).find((m: DeletedMemoryItem) => m.id === memoryId)
              if (deleted) {
                setMemory({
                  id: deleted.id,
                  content: deleted.content,
                  score: deleted.score,
                  source: deleted.source,
                  provenance: deleted.provenance,
                  user_id: deleted.user_id,
                  created_at: normalizeNeo4jTimestamp(deleted.created_at),
                  version: deleted.version,
                  usage_count: 0,
                })
                setIsForgotten(true)
                setForgottenAt(deleted.deleted_at)
                setIsLoading(false)
                return
              }
            }
          } catch { /* fallthrough */ }
          setError("This memory has been removed or replaced.")
        } else {
          setError("Could not load this memory right now.")
        }
        return
      }

      const data: MemoryDetail = await resp.json()
      setMemory({
        ...data,
        created_at: normalizeNeo4jTimestamp(data.created_at),
      })
    } catch {
      setError("Something went wrong. Try again in a moment.")
    } finally {
      setIsLoading(false)
    }
  }, [groupId, memoryId])

  useEffect(() => { void fetchMemory() }, [fetchMemory])

  // ── Edit ──

  const startEditing = () => {
    if (!memory) return
    setEditContent(memory.content)
    setIsEditing(true)
  }

  const cancelEditing = () => {
    setIsEditing(false)
    setEditContent("")
  }

  const saveEdit = async () => {
    if (!memory || !editContent.trim()) return
    setIsSaving(true)

    try {
      const resp = await fetch(
        `/api/memory/${encodeURIComponent(memoryId)}?group_id=${encodeURIComponent(groupId)}&user_id=${encodeURIComponent(userId)}`,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ content: editContent.trim() }),
        }
      )

      if (!resp.ok) {
        toast.error("Could not save the change.")
        return
      }

      const result = await resp.json()
      if (result.id !== memoryId) {
        router.replace(`/memory/${result.id}`)
        return
      }

      await fetchMemory()
      setIsEditing(false)
      setEditContent("")
      toast.success("Updated successfully.")
    } catch {
      toast.error("Failed to save.")
    } finally {
      setIsSaving(false)
    }
  }

  // ── Forget ──

  const forgetMemory = async () => {
    if (!memory) return
    setIsForgetting(true)

    try {
      const resp = await fetch(
        `/api/memory/${encodeURIComponent(memoryId)}?group_id=${encodeURIComponent(groupId)}&user_id=${encodeURIComponent(userId)}`,
        { method: "DELETE" }
      )

      if (resp.ok) {
        toast.success("Memory forgotten.")
        router.push("/memory")
        return
      }

      toast.error("Could not forget this memory.")
    } catch {
      toast.error("Something went wrong.")
    } finally {
      setIsForgetting(false)
      setShowForgetConfirm(false)
    }
  }

  // ── Restore ──

  const restoreMemory = async () => {
    if (!memory) return
    setIsRestoring(true)

    try {
      const resp = await fetch(
        `/api/memory/${encodeURIComponent(memoryId)}/restore?group_id=${encodeURIComponent(groupId)}&user_id=${encodeURIComponent(userId)}`,
        { method: "POST" }
      )

      if (resp.ok) {
        toast.success("Memory restored.")
        router.push("/memory")
        return
      }

      toast.error("Could not restore this memory.")
    } catch {
      toast.error("Something went wrong.")
    } finally {
      setIsRestoring(false)
    }
  }

  // ── Loading ──

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center" style={{ background: "var(--allura-white)" }}>
        <Spinner />
      </div>
    )
  }

  // ── Error ──

  if (error && !memory) {
    return (
      <div className="flex min-h-screen flex-col" style={{ background: "var(--allura-white)" }}>
        <div className="mx-auto flex w-full max-w-2xl flex-1 flex-col items-center justify-center px-4 text-center">
          <h1
            className="font-display text-2xl font-black"
            style={{ fontFamily: "var(--font-family-display)", color: "var(--allura-charcoal)" }}
          >
            Can&apos;t open this memory
          </h1>
          <p className="mt-2 text-sm" style={{ color: "var(--allura-text-2)" }}>{error}</p>
          <button
            type="button"
            onClick={() => router.push("/memory")}
            className="mt-6 rounded-xl px-5 py-2.5 text-sm font-medium transition-colors hover:bg-[var(--allura-muted)]"
            style={{ border: "1px solid var(--allura-border-1)", color: "var(--allura-charcoal)" }}
          >
            <ArrowLeft className="mr-1.5 inline size-3.5" />
            Back to memories
          </button>
          <button
            type="button"
            onClick={() => void fetchMemory()}
            className="mt-3 text-sm font-medium underline underline-offset-4 transition-colors hover:text-[var(--allura-charcoal)]"
            style={{ color: "var(--allura-text-2)" }}
          >
            Try again
          </button>
        </div>
      </div>
    )
  }

  if (!memory) return null

  // ── Render ──

  return (
    <div className="flex min-h-screen flex-col" style={{ background: "var(--allura-white)" }}>
      {/* ── Top bar ── */}
      <div
        className="sticky top-0 z-20 border-b backdrop-blur"
        style={{
          borderColor: "var(--allura-border-1)",
          background: "color-mix(in srgb, var(--allura-white) 92%, transparent)",
          backdropFilter: "blur(12px)",
        }}
      >
        <div className="mx-auto flex max-w-4xl items-center justify-between px-4 py-3 sm:px-6">
          <button
            type="button"
            onClick={() => router.push("/memory")}
            className="flex items-center gap-1.5 text-sm font-medium transition-colors hover:text-[var(--allura-charcoal)]"
            style={{ color: "var(--allura-text-2)" }}
          >
            <ArrowLeft className="size-4" />
            Back to memories
          </button>
          {isForgotten ? (
            <button
              type="button"
              onClick={restoreMemory}
              disabled={isRestoring}
              className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium transition-colors"
              style={{
                background: "var(--allura-blue)",
                color: "var(--allura-white)",
              }}
            >
              <RotateCcw className="size-3.5" />
              {isRestoring ? "Restoring…" : "Restore"}
            </button>
          ) : (
            <button
              type="button"
              onClick={() => setShowForgetConfirm(true)}
              className="text-sm font-medium underline-offset-2 transition-colors hover:underline"
              style={{ color: "var(--allura-text-2)" }}
            >
              Forget this memory
            </button>
          )}
        </div>
      </div>

      <div className="mx-auto w-full max-w-3xl px-4 py-8 sm:px-6 sm:py-10">
        {/* ── Forgotten banner ── */}
        {isForgotten && forgottenAt && (
          <div className="memory-forgotten mb-6">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-sm font-medium" style={{ color: "var(--allura-charcoal)" }}>
                  This memory was forgotten on{" "}
                  {new Date(forgottenAt).toLocaleDateString("en-US", {
                    year: "numeric",
                    month: "long",
                    day: "numeric",
                  })}
                </p>
                <p className="memory-forgotten-recovery-note">
                  It&apos;s in the 30-day recovery window and can be restored.
                </p>
              </div>
              <button
                type="button"
                className="memory-forgotten-undo"
                onClick={restoreMemory}
                disabled={isRestoring}
              >
                Undo & restore
              </button>
            </div>
          </div>
        )}

        {/* ── Content card ── */}
        <div className="memory-card mb-6">
          {/* Timestamp & sparkle */}
          <div className="mb-5 flex items-center gap-2">
            <Sparkles className="size-4 shrink-0" style={{ color: "var(--allura-text-3)" }} />
            <span className="text-xs" style={{ color: "var(--allura-text-3)" }}>
              {formatRelativeTime(memory.created_at)}
            </span>
          </div>

          {isEditing ? (
            <div className="space-y-4">
              <Textarea
                value={editContent}
                onChange={(e) => setEditContent(e.target.value)}
                className="min-h-36 text-base leading-relaxed"
                autoFocus
                disabled={isSaving}
              />
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={cancelEditing}
                  disabled={isSaving}
                  className="rounded-lg px-4 py-2 text-sm font-medium transition-colors hover:bg-[var(--allura-muted)]"
                  style={{ color: "var(--allura-text-2)" }}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={saveEdit}
                  disabled={isSaving || !editContent.trim() || editContent.trim() === memory.content}
                  className="rounded-lg px-4 py-2 text-sm font-medium transition-colors"
                  style={{
                    background: "var(--allura-blue)",
                    color: "var(--allura-white)",
                  }}
                >
                  {isSaving ? "Saving…" : "Save changes"}
                </button>
              </div>
            </div>
          ) : (
            <div
              className="group cursor-pointer rounded-xl p-3 transition-colors hover:bg-[var(--allura-muted)]"
              onClick={startEditing}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => { if (e.key === "Enter") startEditing() }}
            >
              <p className="text-xl leading-relaxed font-medium" style={{ color: "var(--allura-charcoal)" }}>
                {memory.content}
              </p>
              <p
                className="mt-3 flex items-center gap-1.5 text-xs opacity-0 transition-opacity group-hover:opacity-100"
                style={{ color: "var(--allura-text-3)" }}
              >
                <PencilLine className="size-3.5" />
                Click to edit the wording
              </p>
            </div>
          )}
        </div>

        {/* ── Provenance + Confidence ── */}
        <div className="mb-6 grid gap-4 sm:grid-cols-2">
          <div className="memory-card">
            <p
              className="text-xs font-semibold tracking-wider uppercase"
              style={{ color: "var(--allura-text-2)" }}
            >
              Where this came from
            </p>
            <p className="mt-2 text-sm leading-relaxed" style={{ color: "var(--allura-charcoal)" }}>
              {toSourceProse(memory)}
            </p>
            <p className="mt-2 text-xs" style={{ color: "var(--allura-text-3)" }}>
              {toStoreProse(memory.source)}
            </p>
          </div>

          <div className="memory-card">
            <p
              className="text-xs font-semibold tracking-wider uppercase"
              style={{ color: "var(--allura-text-2)" }}
            >
              Confidence
            </p>
            <p className="mt-2 text-sm leading-relaxed" style={{ color: "var(--allura-charcoal)" }}>
              {toConfidenceProse(memory.score)}
            </p>
          </div>
        </div>

        {/* ── Evidence section ── */}
        <div
          className="mb-6 rounded-xl p-6"
          style={{ background: "var(--allura-cream)" }}
        >
          <div className="mb-3 flex items-center gap-2">
            <Clock className="size-4" style={{ color: "var(--allura-text-2)" }} />
            <p className="text-sm font-medium" style={{ color: "var(--allura-text-2)" }}>
              Timeline
            </p>
          </div>

          <div className="space-y-3 pl-6 border-l-2" style={{ borderColor: "var(--allura-border-1)" }}>
            {memory.version != null && memory.version > 1 ? (
              <>
                <div>
                  <p className="text-sm font-medium" style={{ color: "var(--allura-charcoal)" }}>
                    Version 1
                  </p>
                  <p className="text-xs" style={{ color: "var(--allura-text-3)" }}>
                    Created{" "}
                    {new Date(memory.created_at).toLocaleDateString("en-US", {
                      year: "numeric",
                      month: "long",
                      day: "numeric",
                    })}
                  </p>
                </div>
                <div>
                  <p className="text-sm font-medium" style={{ color: "var(--allura-charcoal)" }}>
                    Version {memory.version}
                  </p>
                  <p className="text-xs" style={{ color: "var(--allura-text-3)" }}>
                    Updated most recently
                  </p>
                </div>
              </>
            ) : (
              <div>
                <p className="text-sm font-medium" style={{ color: "var(--allura-charcoal)" }}>
                  Original version
                </p>
                <p className="text-xs" style={{ color: "var(--allura-text-3)" }}>
                  This memory has never been edited.
                </p>
              </div>
            )}

            {memory.superseded_by && (
              <div>
                <p className="text-xs italic" style={{ color: "var(--allura-text-3)" }}>
                  A newer version of this memory exists.
                </p>
              </div>
            )}
          </div>
        </div>

        {/* ── Actions ── */}
        <div className="flex flex-wrap gap-3">
          {!isForgotten && (
            <button
              type="button"
              onClick={startEditing}
              className="rounded-lg px-4 py-2 text-sm font-medium transition-colors hover:bg-[var(--allura-muted)]"
              style={{
                border: "1px solid var(--allura-border-1)",
                color: "var(--allura-charcoal)",
              }}
            >
              Edit wording
            </button>
          )}
          {isForgotten ? (
            <button
              type="button"
              onClick={restoreMemory}
              disabled={isRestoring}
              className="rounded-lg px-4 py-2 text-sm font-medium transition-colors"
              style={{
                background: "var(--allura-blue)",
                color: "var(--allura-white)",
              }}
            >
              {isRestoring ? "Restoring…" : "Restore this memory"}
            </button>
          ) : (
            <button
              type="button"
              onClick={() => setShowForgetConfirm(true)}
              className="rounded-lg px-4 py-2 text-sm font-medium transition-colors hover:bg-[var(--allura-muted)]"
              style={{ color: "var(--allura-text-2)" }}
            >
              Forget
            </button>
          )}
        </div>
      </div>

      {/* ── Forget confirmation dialog ── */}
      <AlertDialog open={showForgetConfirm} onOpenChange={setShowForgetConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Forget this memory?</AlertDialogTitle>
            <AlertDialogDescription>
              It will be hidden from view. You can restore it within 30 days if you change your mind.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isForgetting}>Keep it</AlertDialogCancel>
            <AlertDialogAction
              onClick={forgetMemory}
              disabled={isForgetting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isForgetting ? "Forgetting…" : "Forget it"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
