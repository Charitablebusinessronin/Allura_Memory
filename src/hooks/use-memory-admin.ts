/**
 * useMemoryAdmin — data layer hook for the admin Memories dashboard.
 *
 * Extracts all fetch logic, state management, and CRUD operations
 * from dashboard/memories/page.tsx. Pure rendering stays in the page.
 */

import { useState, useEffect, useCallback, useRef } from "react"
import { normalizeNeo4jTimestamp } from "@/lib/utils/date"
import { DEFAULT_GROUP_ID } from "@/lib/defaults/scope"

const DEFAULT_USER_ID = "system"

export interface AdminMemory {
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
  memories: AdminMemory[]
  total: number
  has_more: boolean
}

interface SearchResponse {
  results: AdminMemory[]
  count: number
  latency_ms: number
}

export type SortOrder = "created_at_desc" | "created_at_asc"

function normalizeMemory(m: AdminMemory): AdminMemory {
  return { ...m, created_at: normalizeNeo4jTimestamp(m.created_at), content: m.content ?? "" }
}

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
  const data = await res.json()

  if (params.query && Array.isArray((data as SearchResponse).results)) {
    const search = data as SearchResponse
    return {
      memories: search.results.map(normalizeMemory),
      total: search.count,
      has_more: false,
    }
  }

  const list = data as MemoryListResponse
  return {
    ...list,
    memories: (list.memories ?? []).map(normalizeMemory),
  }
}

export async function deleteMemoryById(id: string, groupId: string): Promise<void> {
  const url = new URL(`/api/memory/${id}`, window.location.origin)
  url.searchParams.set("group_id", groupId)
  url.searchParams.set("user_id", DEFAULT_USER_ID)
  const res = await fetch(url.toString(), { method: "DELETE" })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error((err as { error?: string }).error ?? "Delete failed")
  }
}

export interface UseMemoryAdminReturn {
  memories: AdminMemory[]
  total: number
  hasMore: boolean
  loading: boolean
  error: string | null
  deletedIds: Set<string>
  groupId: string
  groupIdInput: string
  setGroupIdInput: (v: string) => void
  searchInput: string
  handleSearchChange: (v: string) => void
  handleGroupIdApply: () => void
  handleDelete: (id: string) => void
  limit: number
  setLimit: (v: number) => void
  sort: SortOrder
  setSort: (v: SortOrder) => void
  offset: number
  setOffset: (v: number) => void
  totalPages: number
  currentPage: number
}

export function useMemoryAdmin(): UseMemoryAdminReturn {
  const [groupId, setGroupId] = useState(DEFAULT_GROUP_ID)
  const [groupIdInput, setGroupIdInput] = useState(DEFAULT_GROUP_ID)
  const [searchInput, setSearchInput] = useState("")
  const [activeQuery, setActiveQuery] = useState("")
  const [limit, setLimit] = useState(25)
  const [sort, setSort] = useState<SortOrder>("created_at_desc")
  const [offset, setOffset] = useState(0)

  const [memories, setMemories] = useState<AdminMemory[]>([])
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

  return {
    memories,
    total,
    hasMore,
    loading,
    error,
    deletedIds,
    groupId,
    groupIdInput,
    setGroupIdInput,
    searchInput,
    handleSearchChange,
    handleGroupIdApply,
    handleDelete,
    limit,
    setLimit: (v: number) => { setLimit(v); setOffset(0) },
    sort,
    setSort: (v: SortOrder) => { setSort(v); setOffset(0) },
    offset,
    setOffset,
    totalPages,
    currentPage,
  }
}
