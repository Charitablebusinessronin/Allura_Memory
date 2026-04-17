/**
 * Memory Detail Page — /memory/[id]
 *
 * Displays a single memory with inline edit capability.
 * Uses append-only update (SUPERSEDES pattern — never mutates existing rows).
 *
 * Design: iPhone clean, one thing on screen.
 * Reference: docs/allura/DESIGN-ALLURA.md
 */

"use client"

import { useState, useEffect, useCallback } from "react"
import type { JSX } from "react"
import { useParams, useRouter } from "next/navigation"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import { Separator } from "@/components/ui/separator"
import { Textarea } from "@/components/ui/textarea"
import { Spinner } from "@/components/ui/spinner"
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

// ── Types ──────────────────────────────────────────────────────────────────

/** Shape returned by GET /api/memory/[id] (MemoryGetResponse) */
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

/** Shape returned by PUT /api/memory/[id] (MemoryUpdateResponse) */
interface MemoryUpdateResult {
  id: string
  previous_id: string
  stored: "episodic" | "semantic" | "both"
  version: number
  updated_at: string
}

// ── Helpers ────────────────────────────────────────────────────────────────

/** Normalize Neo4j DateTime objects to ISO strings (defensive client-side fix) */
function normalizeCreatedAt(value: unknown): string {
  if (typeof value === "string") return value
  if (value && typeof value === "object" && "year" in (value as Record<string, unknown>)) {
    const d = value as Record<string, { low: number; high?: number }>
    const get = (field: string): number => d[field]?.low ?? 0
    return new Date(
      Date.UTC(
        get("year"),
        get("month") - 1,
        get("day"),
        get("hour"),
        get("minute"),
        get("second"),
        Math.floor(get("nanosecond") / 1_000_000)
      )
    ).toISOString()
  }
  return String(value ?? new Date().toISOString())
}

/** Format relative time string */
function formatRelativeTime(dateString: string): string {
  const date = new Date(dateString)
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffMins = Math.floor(diffMs / 60000)
  const diffHours = Math.floor(diffMins / 60)
  const diffDays = Math.floor(diffHours / 24)

  if (diffMins < 1) return "just now"
  if (diffMins < 60) return `${diffMins} minutes ago`
  if (diffHours < 24) return `${diffHours} hours ago`
  if (diffDays < 7) return `${diffDays} days ago`
  return date.toLocaleDateString()
}

/** Source badge color */
function sourceBadgeVariant(source: MemoryDetail["source"]): "default" | "secondary" | "outline" {
  switch (source) {
    case "episodic":
      return "secondary"
    case "semantic":
      return "default"
    case "both":
      return "outline"
  }
}

// ── Page Component ─────────────────────────────────────────────────────────

export default function MemoryDetailPage(): JSX.Element | null {
  const params = useParams<{ id: string }>()
  const router = useRouter()
  const memoryId = params.id

  // State
  const [memory, setMemory] = useState<MemoryDetail | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Edit state
  const [isEditing, setIsEditing] = useState(false)
  const [editContent, setEditContent] = useState("")
  const [isSaving, setIsSaving] = useState(false)

  // Delete state
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)

  // Config: read from env defaults (matching list page pattern)
  const groupId = process.env.NEXT_PUBLIC_DEFAULT_GROUP_ID ?? "allura-roninmemory"
  const userId = process.env.NEXT_PUBLIC_DEFAULT_USER_ID ?? ""

  // ── Fetch memory ──────────────────────────────────────────────────────

  const fetchMemory = useCallback(async (): Promise<void> => {
    setIsLoading(true)
    setError(null)
    try {
      const response = await fetch(
        `/api/memory/${encodeURIComponent(memoryId)}?group_id=${encodeURIComponent(groupId)}`
      )
      if (!response.ok) {
        if (response.status === 404) {
          setError("Memory not found. It may have been deleted or the ID is incorrect.")
        } else {
          const data = await response.json().catch(() => ({}))
          setError((data as { error?: string }).error ?? `HTTP ${response.status}`)
        }
        return
      }
      const data: MemoryDetail = await response.json()
      setMemory({
        ...data,
        created_at: normalizeCreatedAt(data.created_at),
      })
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load memory")
    } finally {
      setIsLoading(false)
    }
  }, [memoryId, groupId])

  useEffect(() => {
    fetchMemory()
  }, [fetchMemory])

  // ── Edit handlers ─────────────────────────────────────────────────────

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

      // If the update created a new ID, navigate to the new version
      if (result.id !== memoryId) {
        router.replace(`/memory/${result.id}`)
        return
      }

      // Refresh memory data
      await fetchMemory()
      setIsEditing(false)
      setEditContent("")
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save changes")
    } finally {
      setIsSaving(false)
    }
  }

  // ── Delete handler ───────────────────────────────────────────────────

  const deleteMemory = async (): Promise<void> => {
    if (!memory) return
    setIsDeleting(true)
    try {
      const response = await fetch(
        `/api/memory/${encodeURIComponent(memoryId)}?group_id=${encodeURIComponent(groupId)}&user_id=${encodeURIComponent(userId)}`,
        { method: "DELETE" }
      )

      if (response.ok) {
        router.push("/memory")
        return
      }

      const data = await response.json().catch(() => ({}))
      setError((data as { error?: string }).error ?? "Failed to delete memory")
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete memory")
    } finally {
      setIsDeleting(false)
      setShowDeleteConfirm(false)
    }
  }

  // ── Render: Loading ───────────────────────────────────────────────────

  if (isLoading) {
    return (
      <div className="bg-background min-h-screen">
        <div className="container mx-auto px-4 py-4">
          <Button variant="ghost" size="sm" className="mb-4" disabled>
            ← Back
          </Button>
        </div>
        <div className="container mx-auto space-y-4 px-4">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-4 w-32" />
          <Skeleton className="h-4 w-24" />
        </div>
      </div>
    )
  }

  // ── Render: Error ─────────────────────────────────────────────────────

  if (error && !memory) {
    return (
      <div className="bg-background min-h-screen">
        <div className="container mx-auto px-4 py-4">
          <Button variant="ghost" size="sm" onClick={() => router.push("/memory")} className="mb-4">
            ← Back to memories
          </Button>
        </div>
        <div className="container mx-auto px-4 py-12 text-center">
          <p className="mb-2 text-lg">Something went wrong</p>
          <p className="text-muted-foreground mb-4">{error}</p>
          <div className="flex justify-center gap-2">
            <Button variant="outline" onClick={() => router.push("/memory")}>
              Back to memories
            </Button>
            <Button onClick={fetchMemory}>Try again</Button>
          </div>
        </div>
      </div>
    )
  }

  if (!memory) {
    return (
      <div className="bg-background min-h-screen">
        <div className="container mx-auto px-4 py-4">
          <Button variant="ghost" size="sm" onClick={() => router.push("/memory")} className="mb-4">
            ← Back to memories
          </Button>
        </div>
        <div className="container mx-auto px-4 py-12 text-center">
          <p className="mb-2 text-lg">Memory not found</p>
          <p className="text-muted-foreground mb-4">This memory may have been deleted or the URL is incorrect.</p>
          <Button variant="outline" onClick={() => router.push("/memory")}>
            Back to memories
          </Button>
        </div>
      </div>
    )
  }

  // ── Render: Detail ───────────────────────────────────────────────────

  return (
    <div className="bg-background min-h-screen">
      {/* Header */}
      <div className="border-b">
        <div className="container mx-auto flex items-center justify-between px-4 py-4">
          <Button variant="ghost" size="sm" onClick={() => router.push("/memory")}>
            ← Back to memories
          </Button>
          <div className="flex items-center gap-2">
            <Badge variant={sourceBadgeVariant(memory.source)}>{memory.source}</Badge>
            {memory.version != null && <Badge variant="outline">v{memory.version}</Badge>}
          </div>
        </div>
      </div>

      {/* Content Area */}
      <div className="container mx-auto max-w-2xl px-4 py-6">
        {/* Inline error banner (for save/delete failures) */}
        {error && memory && (
          <div className="bg-destructive/10 text-destructive mb-4 rounded-lg p-3 text-sm">
            {error}
            <button className="ml-2 underline" onClick={() => setError(null)}>
              Dismiss
            </button>
          </div>
        )}

        <Card>
          <CardContent className="p-4 sm:p-6">
            {/* Content: Display or Edit mode */}
            {isEditing ? (
              <div className="space-y-3">
                <Textarea
                  value={editContent}
                  onChange={(e) => setEditContent(e.target.value)}
                  className="min-h-32 text-sm"
                  autoFocus
                  disabled={isSaving}
                />
                <div className="flex justify-end gap-2">
                  <Button variant="ghost" size="sm" onClick={cancelEditing} disabled={isSaving}>
                    Cancel
                  </Button>
                  <Button
                    size="sm"
                    onClick={saveEdit}
                    disabled={isSaving || !editContent.trim() || editContent.trim() === memory.content}
                  >
                    {isSaving ? (
                      <>
                        <Spinner className="mr-2" />
                        Saving…
                      </>
                    ) : (
                      "Save"
                    )}
                  </Button>
                </div>
              </div>
            ) : (
              <div
                className="group cursor-pointer"
                onClick={startEditing}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") startEditing()
                }}
              >
                <p className="text-sm whitespace-pre-wrap">{memory.content}</p>
                <p className="text-muted-foreground mt-2 text-xs opacity-0 transition-opacity group-hover:opacity-100">
                  Click to edit
                </p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Metadata Section */}
        <div className="mt-4 space-y-3">
          <Separator />

          <div className="grid grid-cols-1 gap-3 text-sm sm:grid-cols-2">
            {/* Created */}
            <div>
              <span className="text-muted-foreground">Created</span>
              <p className="font-medium">{new Date(memory.created_at).toLocaleString()}</p>
              <p className="text-muted-foreground text-xs">{formatRelativeTime(memory.created_at)}</p>
            </div>

            {/* Source */}
            <div>
              <span className="text-muted-foreground">Source</span>
              <p className="font-medium">
                {memory.provenance === "conversation" ? "From conversation" : "Added manually"}
              </p>
            </div>

            {/* Group ID */}
            <div>
              <span className="text-muted-foreground">Group</span>
              <p className="font-mono text-xs font-medium">{groupId}</p>
            </div>

            {/* Score */}
            <div>
              <span className="text-muted-foreground">Confidence</span>
              <p className="font-medium">{(memory.score * 100).toFixed(0)}%</p>
            </div>

            {/* Usage */}
            {memory.usage_count != null && (
              <div>
                <span className="text-muted-foreground">Used</span>
                <p className="font-medium">{memory.usage_count} times this week</p>
              </div>
            )}

            {/* Superseded by */}
            {memory.superseded_by && (
              <div>
                <span className="text-muted-foreground">Superseded by</span>
                <p className="font-medium">
                  <a className="text-primary hover:text-primary/80 underline" href={`/memory/${memory.superseded_by}`}>
                    View newer version
                  </a>
                </p>
              </div>
            )}

            {/* User */}
            {memory.user_id && (
              <div>
                <span className="text-muted-foreground">User</span>
                <p className="font-mono text-xs font-medium">{memory.user_id}</p>
              </div>
            )}
          </div>

          <Separator />

          {/* Actions */}
          <div className="flex items-center justify-between pt-1">
            <p className="text-muted-foreground text-xs">
              Stored in {memory.source === "both" ? "both stores" : `${memory.source} store`}
            </p>
            <Button
              variant="ghost"
              size="sm"
              className="text-destructive hover:text-destructive"
              onClick={() => setShowDeleteConfirm(true)}
            >
              Forget
            </Button>
          </div>
        </div>
      </div>

      {/* Delete Confirmation Dialog (shadcn AlertDialog — NOT window.confirm) */}
      <AlertDialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Forget this memory?</AlertDialogTitle>
            <AlertDialogDescription>
              This will remove the memory from your AI&apos;s knowledge. You can undo this within 30 days.
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
