"use client"

import { useState, useEffect, useCallback, useRef } from "react"
import { formatDistanceToNow } from "date-fns"
import { Copy, Check, ChevronDown, ChevronRight, Trash2, Search, Loader2, Database } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Skeleton } from "@/components/ui/skeleton"

import { APP_CONFIG } from "@/config/app-config"

const DEFAULT_GROUP_ID = APP_CONFIG.defaultGroupId
const DEFAULT_USER_ID = "system"

interface Memory {
  id: string
  content: string
  score: number
  source: string
  provenance: string
  user_id?: string
  created_at: string
  group_id?: string
  metadata?: Record<string, unknown>
}

interface MemoryListResponse {
  memories: Memory[]
  total: number
  has_more: boolean
}

type SortOrder = "created_at_desc" | "created_at_asc"

async function fetchMemories(params: {
  groupId: string
  limit: number
  offset: number
  sort: SortOrder
  query?: string
}): Promise<MemoryListResponse> {
  const url = new URL("/api/memory", window.location.origin)
  url.searchParams.set("group_id", params.groupId)
  url.searchParams.set("user_id", DEFAULT_USER_ID)
  url.searchParams.set("limit", String(params.limit))
  url.searchParams.set("offset", String(params.offset))
  url.searchParams.set("sort", params.sort)
  if (params.query) url.searchParams.set("query", params.query)

  const res = await fetch(url.toString(), { cache: "no-store" })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error((err as { error?: string }).error ?? "Failed to fetch memories")
  }
  return res.json()
}

async function deleteMemory(id: string, groupId: string): Promise<void> {
  const url = new URL(`/api/memory/${id}`, window.location.origin)
  url.searchParams.set("group_id", groupId)
  url.searchParams.set("user_id", DEFAULT_USER_ID)
  const res = await fetch(url.toString(), { method: "DELETE" })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error((err as { error?: string }).error ?? "Delete failed")
  }
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false)

  const copy = async (e: React.MouseEvent) => {
    e.stopPropagation()
    await navigator.clipboard.writeText(text)
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }

  return (
    <button
      type="button"
      onClick={copy}
      className="text-muted-foreground hover:text-foreground ml-1 transition-colors"
      aria-label="Copy ID"
    >
      {copied ? <Check className="size-3" /> : <Copy className="size-3" />}
    </button>
  )
}

interface MemoryRowProps {
  memory: Memory
  groupId: string
  onDelete: (id: string) => void
  isDeleted: boolean
}

function MemoryRow({ memory, groupId, onDelete, isDeleted }: MemoryRowProps) {
  const [expanded, setExpanded] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  if (isDeleted) return null

  const handleDelete = async (e: React.MouseEvent) => {
    e.stopPropagation()
    if (!confirmDelete) {
      setConfirmDelete(true)
      return
    }
    setDeleting(true)
    setError(null)
    try {
      await deleteMemory(memory.id, groupId)
      onDelete(memory.id)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Delete failed")
      setConfirmDelete(false)
    } finally {
      setDeleting(false)
    }
  }

  return (
    <div className="bg-card overflow-hidden rounded-lg border">
      <button
        type="button"
        className="hover:bg-muted/40 flex w-full items-center gap-3 px-4 py-3 text-left transition-colors"
        onClick={() => setExpanded((v) => !v)}
      >
        <span className="text-muted-foreground shrink-0">
          {expanded ? <ChevronDown className="size-4" /> : <ChevronRight className="size-4" />}
        </span>
        <span className="text-muted-foreground flex w-24 shrink-0 items-center font-mono text-xs">
          {memory.id.slice(0, 8)}…
          <CopyButton text={memory.id} />
        </span>
        <span className="flex-1 truncate text-sm">
          {memory.content.slice(0, 100)}
          {memory.content.length > 100 ? "…" : ""}
        </span>
        <span className="text-muted-foreground hidden shrink-0 text-xs md:block">{groupId}</span>
        <span className="text-muted-foreground hidden shrink-0 text-xs sm:block">
          {formatDistanceToNow(new Date(memory.created_at), { addSuffix: true })}
        </span>
        <span className="shrink-0" onClick={(e) => e.stopPropagation()}>
          {confirmDelete ? (
            <div className="flex items-center gap-1">
              <span className="text-destructive mr-1 text-xs">Sure?</span>
              <Button
                size="sm"
                variant="destructive"
                className="h-6 px-2 text-xs"
                disabled={deleting}
                onClick={handleDelete}
              >
                {deleting ? <Loader2 className="size-3 animate-spin" /> : "Yes"}
              </Button>
              <Button
                size="sm"
                variant="outline"
                className="h-6 px-2 text-xs"
                onClick={(e) => {
                  e.stopPropagation()
                  setConfirmDelete(false)
                }}
              >
                No
              </Button>
            </div>
          ) : (
            <Button
              size="sm"
              variant="ghost"
              className="text-muted-foreground hover:text-destructive h-7 w-7 p-0"
              onClick={handleDelete}
              aria-label="Delete memory"
            >
              <Trash2 className="size-3.5" />
            </Button>
          )}
        </span>
      </button>

      {expanded && (
        <div className="bg-muted/20 space-y-4 border-t px-4 py-4">
          <div>
            <p className="text-muted-foreground mb-1 text-xs font-medium tracking-wide uppercase">Full Content</p>
            <p className="text-sm whitespace-pre-wrap">{memory.content}</p>
          </div>
          <div className="grid gap-3 text-xs sm:grid-cols-4">
            <div>
              <p className="text-muted-foreground font-medium">ID</p>
              <p className="mt-0.5 flex items-center gap-1 font-mono">
                {memory.id.slice(0, 16)}…
                <CopyButton text={memory.id} />
              </p>
            </div>
            <div>
              <p className="text-muted-foreground font-medium">Source</p>
              <p className="mt-0.5">{memory.source}</p>
            </div>
            <div>
              <p className="text-muted-foreground font-medium">Provenance</p>
              <p className="mt-0.5">{memory.provenance}</p>
            </div>
            <div>
              <p className="text-muted-foreground font-medium">Score</p>
              <p className="mt-0.5">{memory.score?.toFixed(3) ?? "—"}</p>
            </div>
          </div>
          {memory.metadata && Object.keys(memory.metadata).length > 0 && (
            <div>
              <p className="text-muted-foreground mb-1 text-xs font-medium tracking-wide uppercase">Metadata</p>
              <pre className="bg-muted overflow-x-auto rounded p-2 text-xs">
                {JSON.stringify(memory.metadata, null, 2)}
              </pre>
            </div>
          )}
          {error && <p className="text-destructive text-xs">{error}</p>}
        </div>
      )}
    </div>
  )
}

export default function MemoriesAdminPage() {
  const [groupId, setGroupId] = useState(DEFAULT_GROUP_ID)
  const [groupIdInput, setGroupIdInput] = useState(DEFAULT_GROUP_ID)
  const [searchInput, setSearchInput] = useState("")
  const [activeQuery, setActiveQuery] = useState("")
  const [limit, setLimit] = useState(25)
  const [sort, setSort] = useState<SortOrder>("created_at_desc")
  const [offset, setOffset] = useState(0)

  const [memories, setMemories] = useState<Memory[]>([])
  const [total, setTotal] = useState(0)
  const [hasMore, setHasMore] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [deletedIds, setDeletedIds] = useState<Set<string>>(new Set())

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const load = useCallback(
    async (params: { groupId: string; limit: number; offset: number; sort: SortOrder; query: string }) => {
      setLoading(true)
      setError(null)
      try {
        const data = await fetchMemories(params)
        setMemories(data.memories ?? [])
        setTotal(data.total ?? 0)
        setHasMore(data.has_more ?? false)
        setDeletedIds(new Set())
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load memories")
      } finally {
        setLoading(false)
      }
    },
    []
  )

  useEffect(() => {
    void load({ groupId, limit, offset, sort, query: activeQuery })
  }, [load, groupId, limit, offset, sort, activeQuery])

  const handleSearchChange = (value: string) => {
    setSearchInput(value)
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => {
      setActiveQuery(value)
      setOffset(0)
    }, 300)
  }

  const handleGroupIdApply = () => {
    setGroupId(groupIdInput)
    setOffset(0)
  }

  const handleDelete = useCallback((id: string) => {
    setDeletedIds((prev) => new Set(prev).add(id))
    setTotal((prev) => Math.max(0, prev - 1))
  }, [])

  const totalPages = Math.ceil(total / limit)
  const currentPage = Math.floor(offset / limit) + 1

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Memories</h1>
        <p className="text-muted-foreground mt-1 text-sm">Admin view — {total} total</p>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
        <div className="relative flex-1">
          <Search className="text-muted-foreground absolute top-1/2 left-3 size-3.5 -translate-y-1/2" />
          <Input
            placeholder="Search memories..."
            value={searchInput}
            onChange={(e) => handleSearchChange(e.target.value)}
            className="pl-9"
          />
        </div>

        <div className="flex items-center gap-2">
          <Input
            placeholder="group_id"
            value={groupIdInput}
            onChange={(e) => setGroupIdInput(e.target.value)}
            className="w-44 text-sm"
            onKeyDown={(e) => {
              if (e.key === "Enter") handleGroupIdApply()
            }}
          />
          <Button size="sm" variant="outline" onClick={handleGroupIdApply}>
            Apply
          </Button>
        </div>

        <select
          value={limit}
          onChange={(e) => {
            setLimit(Number(e.target.value))
            setOffset(0)
          }}
          className="border-input bg-background h-9 rounded-md border px-3 text-sm"
        >
          <option value={25}>25</option>
          <option value={50}>50</option>
          <option value={100}>100</option>
        </select>

        <select
          value={sort}
          onChange={(e) => {
            setSort(e.target.value as SortOrder)
            setOffset(0)
          }}
          className="border-input bg-background h-9 rounded-md border px-3 text-sm"
        >
          <option value="created_at_desc">Newest</option>
          <option value="created_at_asc">Oldest</option>
        </select>
      </div>

      {error && (
        <div className="border-destructive/30 bg-destructive/5 text-destructive rounded-lg border px-4 py-3 text-sm">
          {error}
        </div>
      )}

      {loading ? (
        <div className="space-y-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-14 w-full rounded-lg" />
          ))}
        </div>
      ) : memories.length === 0 ? (
        <div className="bg-card flex flex-col items-center justify-center gap-3 rounded-lg border py-16 text-center">
          <Database className="text-muted-foreground size-8" />
          <p className="text-muted-foreground text-sm">No memories found.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {memories.map((memory) => (
            <MemoryRow
              key={memory.id}
              memory={memory}
              groupId={groupId}
              onDelete={handleDelete}
              isDeleted={deletedIds.has(memory.id)}
            />
          ))}
        </div>
      )}

      {!loading && totalPages > 1 && (
        <div className="flex items-center justify-between text-sm">
          <p className="text-muted-foreground">
            Page {currentPage} of {totalPages} ({total} total)
          </p>
          <div className="flex gap-2">
            <Button
              size="sm"
              variant="outline"
              disabled={offset === 0}
              onClick={() => setOffset(Math.max(0, offset - limit))}
            >
              Previous
            </Button>
            <Button size="sm" variant="outline" disabled={!hasMore} onClick={() => setOffset(offset + limit)}>
              Next
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
