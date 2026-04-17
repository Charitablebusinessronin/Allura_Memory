"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import type { JSX } from "react"
import { useParams, useRouter } from "next/navigation"
import { ArrowLeft, Clock3, FileSearch, PencilLine, ShieldCheck, Sparkles } from "lucide-react"
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
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"
import { Skeleton } from "@/components/ui/skeleton"
import { Spinner } from "@/components/ui/spinner"
import { Textarea } from "@/components/ui/textarea"
import { toast } from "sonner"
import { DURHAM_GRADIENTS } from "@/lib/brand/durham"
import { DEFAULT_GROUP_ID, DEFAULT_USER_ID } from "@/lib/defaults/scope"
import { normalizeNeo4jTimestamp, formatRelativeTime } from "@/lib/utils/date"

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
}

interface MemoryUpdateResult {
  id: string
  previous_id: string
  stored: "episodic" | "semantic" | "both"
  version: number
  updated_at: string
}

function toNaturalSource(memory: MemoryDetail): string {
  return memory.provenance === "conversation" ? "Heard during a conversation" : "Added by hand"
}

function toStoreLabel(source: MemoryDetail["source"]): string {
  if (source === "both") return "Available in both memory stores"
  if (source === "episodic") return "Stored in the episodic memory store"
  return "Stored in the semantic memory store"
}

function toUsageMessage(usageCount?: number): string {
  if (usageCount == null) return "No usage signal is available for this memory yet."
  if (usageCount <= 0) return "This memory has not been called on recently."
  if (usageCount === 1) return "This memory has been used once recently."
  return `This memory has been used ${usageCount} times recently.`
}

export default function MemoryDetailPage(): JSX.Element | null {
  const params = useParams<{ id: string }>()
  const router = useRouter()
  const memoryId = params.id

  const [memory, setMemory] = useState<MemoryDetail | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [isEditing, setIsEditing] = useState(false)
  const [editContent, setEditContent] = useState("")
  const [isSaving, setIsSaving] = useState(false)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)

  const groupId = DEFAULT_GROUP_ID
  const userId = DEFAULT_USER_ID

  const fetchMemory = useCallback(async (): Promise<void> => {
    setIsLoading(true)
    setError(null)

    try {
      const response = await fetch(
        `/api/memory/${encodeURIComponent(memoryId)}?group_id=${encodeURIComponent(groupId)}`
      )

      if (!response.ok) {
        if (response.status === 404) {
          setError("This memory could not be found. It may have been removed or replaced.")
        } else {
          const data = await response.json().catch(() => ({}))
          setError((data as { error?: string }).error ?? `HTTP ${response.status}`)
        }
        return
      }

      const data: MemoryDetail = await response.json()
      setMemory({
        ...data,
        created_at: normalizeNeo4jTimestamp(data.created_at),
      })
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load memory")
    } finally {
      setIsLoading(false)
    }
  }, [groupId, memoryId])

  useEffect(() => {
    void fetchMemory()
  }, [fetchMemory])

  const startEditing = (): void => {
    if (!memory) return
    setEditContent(memory.content)
    setIsEditing(true)
  }

  const cancelEditing = (): void => {
    setIsEditing(false)
    setEditContent("")
  }

  const saveEdit = async (): Promise<void> => {
    if (!memory || !editContent.trim()) return
    setIsSaving(true)

    try {
      const response = await fetch(
        `/api/memory/${encodeURIComponent(memoryId)}?group_id=${encodeURIComponent(groupId)}&user_id=${encodeURIComponent(userId)}`,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ content: editContent.trim() }),
        }
      )

      if (!response.ok) {
        const data = await response.json().catch(() => ({}))
        setError((data as { error?: string }).error ?? "Failed to update memory")
        return
      }

      const result: MemoryUpdateResult = await response.json()

      if (result.id !== memoryId) {
        router.replace(`/memory/${result.id}`)
        return
      }

      await fetchMemory()
      setIsEditing(false)
      setEditContent("")
      toast.success("Memory updated")
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to save changes"
      setError(message)
      toast.error(message)
    } finally {
      setIsSaving(false)
    }
  }

  const deleteMemory = async (): Promise<void> => {
    if (!memory) return
    setIsDeleting(true)

    try {
      const response = await fetch(
        `/api/memory/${encodeURIComponent(memoryId)}?group_id=${encodeURIComponent(groupId)}&user_id=${encodeURIComponent(userId)}`,
        { method: "DELETE" }
      )

      if (response.ok) {
        toast.success("Memory forgotten")
        router.push("/memory")
        return
      }

      const data = await response.json().catch(() => ({}))
      const message = (data as { error?: string }).error ?? "Failed to delete memory"
      setError(message)
      toast.error(message)
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to delete memory"
      setError(message)
      toast.error(message)
    } finally {
      setIsDeleting(false)
      setShowDeleteConfirm(false)
    }
  }

  const confidenceLabel = useMemo(() => {
    if (!memory) return ""
    return `${(memory.score * 100).toFixed(0)}% confidence`
  }, [memory])

  if (isLoading) {
    return (
      <div className="min-h-screen bg-[--durham-page-bg]" style={{ backgroundImage: DURHAM_GRADIENTS.page }}>
        <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6 lg:px-8">
          <div className="space-y-4 rounded-[28px] border border-white/70 bg-white/70 p-6 shadow-[--durham-shadow-base]/8 shadow-xl backdrop-blur">
            <Skeleton className="h-10 w-40" />
            <Skeleton className="h-10 w-2/3" />
            <Skeleton className="h-48 w-full" />
            <Skeleton className="h-32 w-full" />
          </div>
        </div>
      </div>
    )
  }

  if (error && !memory) {
    return (
      <div className="min-h-screen bg-[--durham-page-bg]" style={{ backgroundImage: DURHAM_GRADIENTS.page }}>
        <div className="mx-auto max-w-3xl px-4 py-8 sm:px-6 lg:px-8">
          <div className="rounded-[28px] border border-white/70 bg-white/80 p-6 text-center shadow-[--durham-shadow-base]/8 shadow-xl backdrop-blur">
            <p className="text-xs font-semibold tracking-[0.28em] text-[--durham-amber-ochre] uppercase">
              Memory detail
            </p>
            <h1 className="mt-3 text-2xl font-semibold text-[--durham-deep-graphite]">
              We could not open this memory.
            </h1>
            <p className="mt-3 text-base text-[--durham-muted-text]">{error}</p>
            <div className="mt-6 flex flex-wrap justify-center gap-3">
              <Button variant="outline" onClick={() => router.push("/memory")}>
                Back to memories
              </Button>
              <Button
                onClick={() => void fetchMemory()}
                className="bg-[--durham-rich-navy] text-[--durham-warm-mist] hover:bg-[--durham-hover-navy]"
              >
                Try again
              </Button>
            </div>
          </div>
        </div>
      </div>
    )
  }

  if (!memory) {
    return (
      <div className="min-h-screen bg-[--durham-page-bg]" style={{ backgroundImage: DURHAM_GRADIENTS.page }}>
        <div className="mx-auto max-w-3xl px-4 py-8 sm:px-6 lg:px-8">
          <div className="rounded-[28px] border border-white/70 bg-white/80 p-6 text-center shadow-[--durham-shadow-base]/8 shadow-xl backdrop-blur">
            <h1 className="text-2xl font-semibold text-[--durham-deep-graphite]">Memory not found</h1>
            <p className="mt-3 text-base text-[--durham-muted-text]">
              This memory may have been removed or the link is no longer current.
            </p>
            <Button variant="outline" onClick={() => router.push("/memory")} className="mt-6">
              Back to memories
            </Button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[--durham-page-bg]" style={{ backgroundImage: DURHAM_GRADIENTS.page }}>
      <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8 lg:py-10">
        <div className="rounded-[30px] border border-white/70 bg-white/72 p-4 shadow-[--durham-shadow-base]/8 shadow-xl backdrop-blur sm:p-6 lg:p-8">
          <div className="flex flex-col gap-4 border-b border-[--durham-inner-border-alt] pb-6 sm:flex-row sm:items-center sm:justify-between">
            <div className="space-y-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => router.push("/memory")}
                className="-ml-3 text-[--durham-rich-navy] hover:bg-white/60"
              >
                <ArrowLeft className="mr-2 size-4" />
                Back to memories
              </Button>
              <p className="text-xs font-semibold tracking-[0.28em] text-[--durham-amber-ochre] uppercase">
                Memory detail
              </p>
              <h1 className="text-3xl leading-tight font-semibold text-[--durham-deep-graphite] sm:text-4xl">
                A closer look at what Allura remembers.
              </h1>
            </div>

            <div className="flex flex-wrap gap-2">
              <div className="rounded-full border border-[--durham-inner-border] bg-white px-3 py-1.5 text-sm text-[--durham-warm-slate]">
                {toNaturalSource(memory)}
              </div>
              {memory.version != null && (
                <div className="rounded-full border border-[--durham-inner-border] bg-white px-3 py-1.5 text-sm text-[--durham-warm-slate]">
                  Version {memory.version}
                </div>
              )}
              <div className="rounded-full border border-[--durham-confidence-border] bg-[--durham-confidence-bg] px-3 py-1.5 text-sm text-[--durham-confidence-text]">
                {confidenceLabel}
              </div>
            </div>
          </div>

          {error && memory && (
            <div className="mt-6 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
              {error}
              <button className="ml-2 underline" onClick={() => setError(null)}>
                Dismiss
              </button>
            </div>
          )}

          <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,1.6fr)_minmax(280px,0.95fr)]">
            <Card className="border-[--durham-border] bg-white/92 shadow-sm">
              <CardContent className="p-6 sm:p-8">
                <div className="flex items-center gap-2 text-sm text-[--durham-muted-text]">
                  <Sparkles className="size-4 text-[--durham-amber-ochre]" />
                  <span>{formatRelativeTime(memory.created_at)}</span>
                </div>

                {isEditing ? (
                  <div className="mt-5 space-y-4">
                    <Textarea
                      value={editContent}
                      onChange={(event) => setEditContent(event.target.value)}
                      className="min-h-48 border-[--durham-border-light] bg-[--durham-surface] text-base leading-7"
                      autoFocus
                      disabled={isSaving}
                    />
                    <div className="flex flex-wrap justify-end gap-2">
                      <Button variant="ghost" onClick={cancelEditing} disabled={isSaving}>
                        Cancel
                      </Button>
                      <Button
                        onClick={saveEdit}
                        disabled={isSaving || !editContent.trim() || editContent.trim() === memory.content}
                        className="bg-[--durham-rich-navy] text-[--durham-warm-mist] hover:bg-[--durham-hover-navy]"
                      >
                        {isSaving ? (
                          <>
                            <Spinner className="mr-2" />
                            Saving…
                          </>
                        ) : (
                          "Save changes"
                        )}
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="mt-5 space-y-6">
                    <div
                      className="group rounded-[24px] border border-transparent bg-[--durham-surface] p-5 transition hover:border-[--durham-border]"
                      onClick={startEditing}
                      role="button"
                      tabIndex={0}
                      onKeyDown={(event) => {
                        if (event.key === "Enter" || event.key === " ") startEditing()
                      }}
                    >
                      <p className="text-2xl leading-10 font-semibold text-[--durham-deep-graphite] sm:text-[2rem]">
                        {memory.content}
                      </p>
                      <p className="mt-4 flex items-center gap-2 text-sm text-[--durham-subtle-text] opacity-0 transition-opacity group-hover:opacity-100">
                        <PencilLine className="size-4" />
                        Click to edit the wording while keeping version history intact.
                      </p>
                    </div>

                    <div className="grid gap-4 md:grid-cols-2">
                      <div className="rounded-[22px] border border-[--durham-border] bg-[--durham-panel-subtle] p-5">
                        <div className="flex items-center gap-2 text-sm font-medium text-[--durham-rich-navy]">
                          <ShieldCheck className="size-4 text-[--durham-amber-ochre]" />
                          Provenance
                        </div>
                        <p className="mt-3 text-sm leading-6 text-[--durham-warm-slate]">
                          {memory.provenance === "conversation"
                            ? `Captured from a conversation on ${new Date(memory.created_at).toLocaleString()}.`
                            : `Added manually on ${new Date(memory.created_at).toLocaleString()}.`}
                        </p>
                        <p className="mt-3 text-sm text-[--durham-muted-text]">{toStoreLabel(memory.source)}</p>
                      </div>

                      <div className="rounded-[22px] border border-[--durham-border] bg-[--durham-panel-subtle] p-5">
                        <div className="flex items-center gap-2 text-sm font-medium text-[--durham-rich-navy]">
                          <Clock3 className="size-4 text-[--durham-amber-ochre]" />
                          Usage
                        </div>
                        <p className="mt-3 text-sm leading-6 text-[--durham-warm-slate]">
                          {toUsageMessage(memory.usage_count)}
                        </p>
                      </div>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            <div className="space-y-4">
              <Card className="border-[--durham-border] bg-white/92 shadow-sm">
                <CardContent className="p-6">
                  <div className="flex items-center gap-2 text-sm font-medium text-[--durham-rich-navy]">
                    <FileSearch className="size-4 text-[--durham-amber-ochre]" />
                    Trust signals
                  </div>

                  <div className="mt-4 space-y-4 text-sm">
                    <div>
                      <p className="text-[--durham-caption-text]">Created</p>
                      <p className="mt-1 font-medium text-[--durham-deep-graphite]">
                        {new Date(memory.created_at).toLocaleString()}
                      </p>
                    </div>
                    <Separator className="bg-[--durham-border]" />
                    <div>
                      <p className="text-[--durham-caption-text]">Confidence</p>
                      <p className="mt-1 font-medium text-[--durham-deep-graphite]">{confidenceLabel}</p>
                    </div>
                    <Separator className="bg-[--durham-border]" />
                    <div>
                      <p className="text-[--durham-caption-text]">Status</p>
                      <p className="mt-1 font-medium text-[--durham-deep-graphite]">
                        {memory.superseded_by ? "A newer version exists" : "Current version in view"}
                      </p>
                      {memory.superseded_by && (
                        <button
                          className="mt-2 text-sm font-medium text-[--durham-rich-navy] underline underline-offset-4"
                          onClick={() => router.push(`/memory/${memory.superseded_by}`)}
                        >
                          Open the newer version
                        </button>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="border-[--durham-border] bg-white/92 shadow-sm">
                <CardContent className="p-6">
                  <p className="text-sm font-medium text-[--durham-rich-navy]">Reference details</p>
                  <div className="mt-4 space-y-4 text-sm text-[--durham-warm-slate]">
                    <div>
                      <p className="text-[--durham-caption-text]">Memory ID</p>
                      <p className="mt-1 font-mono text-xs break-all text-[--durham-deep-graphite]">{memory.id}</p>
                    </div>
                    <div>
                      <p className="text-[--durham-caption-text]">Workspace</p>
                      <p className="mt-1 font-mono text-xs break-all text-[--durham-deep-graphite]">{groupId}</p>
                    </div>
                    {memory.user_id && (
                      <div>
                        <p className="text-[--durham-caption-text]">User</p>
                        <p className="mt-1 font-mono text-xs break-all text-[--durham-deep-graphite]">
                          {memory.user_id}
                        </p>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>

              <div className="flex flex-wrap gap-2">
                <Button
                  onClick={startEditing}
                  variant="outline"
                  className="border-[--durham-border-light] bg-white text-[--durham-rich-navy] hover:bg-[--durham-hover-amber-bg]"
                >
                  Edit wording
                </Button>
                <Button
                  variant="ghost"
                  className="text-red-700 hover:bg-red-50 hover:text-red-800"
                  onClick={() => setShowDeleteConfirm(true)}
                >
                  Forget memory
                </Button>
              </div>
            </div>
          </div>
        </div>
      </div>

      <AlertDialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Forget this memory?</AlertDialogTitle>
            <AlertDialogDescription>
              This removes it from active use while keeping the backend flow intact. You can restore it within 30 days.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={deleteMemory}
              disabled={isDeleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isDeleting ? (
                <>
                  <Spinner className="mr-2" />
                  Forgetting…
                </>
              ) : (
                "Forget"
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
