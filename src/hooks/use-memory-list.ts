/**
 * useMemoryList — data layer hook for the Memory Viewer page.
 *
 * Extracts all fetch logic, state, and CRUD operations from page.tsx.
 * Pure rendering stays in the page; this hook owns the data.
 */

import { useState, useEffect, useRef, useCallback } from "react"
import { toast } from "sonner"

interface Memory {
  id: string
  content: string
  score: number
  source: "episodic" | "semantic" | "both"
  provenance: "conversation" | "manual"
  created_at: string
  usage_count?: number
  expanded?: boolean
  tags?: string[]
}

interface SearchResponse {
  results: Memory[]
  count: number
  latency_ms: number
}

interface ListResponse {
  memories: Memory[]
  total: number
  has_more: boolean
}

interface UseMemoryListOptions {
  groupId: string
  userId?: string
  allUsers?: boolean
  limit?: number
}

interface UseMemoryListReturn {
  // Data
  memories: Memory[]
  hasMore: boolean

  // Loading states
  isLoading: boolean
  isLoadingMore: boolean

  // Search
  searchQuery: string
  setSearchQuery: (query: string) => void

  // Filters
  groupId: string
  setGroupId: (id: string) => void
  userId: string
  setUserId: (id: string) => void
  allUsers: boolean
  setAllUsers: (v: boolean | ((prev: boolean) => boolean)) => void

  // Actions
  loadMore: () => Promise<void>
  deleteMemory: (memory: Memory) => Promise<void>
  addMemory: (content: string) => Promise<boolean>
  refresh: () => void
  toggleExpand: (id: string) => void

  // Undo
  recentlyDeleted: Memory[]
  undoDelete: () => Promise<void>
  showUndo: boolean

  // Utility
  formatRelativeTime: (dateString: string) => string
}

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

/** Normalize a memory object's created_at from potential Neo4j DateTime */
function normalizeMemory(m: Memory): Memory {
  return { ...m, created_at: normalizeCreatedAt(m.created_at), content: m.content ?? "" }
}

/** Format relative time */
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

export type { Memory, UseMemoryListOptions, UseMemoryListReturn }

export function useMemoryList({
  groupId: initialGroupId,
  userId: initialUserId = "",
  allUsers: initialAllUsers = false,
  limit = 20,
}: UseMemoryListOptions): UseMemoryListReturn {
  const [memories, setMemories] = useState<Memory[]>([])
  const [searchQuery, setSearchQuery] = useState("")
  const [groupId, setGroupId] = useState(initialGroupId)
  const [userId, setUserId] = useState(initialUserId)
  const [allUsers, setAllUsers] = useState(initialAllUsers)
  const [isLoading, setIsLoading] = useState(false)
  const [isLoadingMore, setIsLoadingMore] = useState(false)
  const [hasMore, setHasMore] = useState(false)
  const [offset, setOffset] = useState(0)
  const [recentlyDeleted, setRecentlyDeleted] = useState<Memory[]>([])
  const [showUndo, setShowUndo] = useState(false)

  const PAGE_LIMIT = limit
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const mountedRef = useRef(true)

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      mountedRef.current = false
    }
  }, [])

  // Fetch all memories for user
  const fetchMemories = useCallback(
    async (appendOffset?: number) => {
      const isAppend = appendOffset !== undefined
      if (isAppend) {
        setIsLoadingMore(true)
      } else {
        setIsLoading(true)
      }
      try {
        const currentOffset = isAppend ? appendOffset : 0
        const userParam = allUsers ? "" : userId ? `&user_id=${encodeURIComponent(userId)}` : ""
        const response = await fetch(
          `/api/memory?group_id=${encodeURIComponent(groupId)}${userParam}&limit=${PAGE_LIMIT}&offset=${currentOffset}`
        )
        const data: ListResponse = await response.json()
        const newMemories = (data.memories || []).map(normalizeMemory)
        if (!mountedRef.current) return
        if (isAppend) {
          setMemories((prev) => [...prev, ...newMemories])
        } else {
          setMemories(newMemories)
        }
        setHasMore(data.has_more)
        setOffset(currentOffset + newMemories.length)
      } catch (error) {
        console.error("Failed to fetch memories:", error)
      } finally {
        if (mountedRef.current) {
          if (isAppend) {
            setIsLoadingMore(false)
          } else {
            setIsLoading(false)
          }
        }
      }
    },
    [groupId, userId, allUsers, PAGE_LIMIT]
  )

  // Search memories
  const searchMemories = useCallback(async () => {
    if (!searchQuery.trim()) {
      fetchMemories()
      return
    }

    setIsLoading(true)
    try {
      const userParam = allUsers ? "" : userId ? `&user_id=${encodeURIComponent(userId)}` : ""
      const response = await fetch(
        `/api/memory?query=${encodeURIComponent(searchQuery)}&group_id=${encodeURIComponent(groupId)}${userParam}&limit=50`
      )
      const data: SearchResponse = await response.json()
      if (!mountedRef.current) return
      setMemories((data.results || []).map(normalizeMemory))
      setHasMore(false)
      setOffset(0)
    } catch (error) {
      console.error("Failed to search:", error)
    } finally {
      if (mountedRef.current) {
        setIsLoading(false)
      }
    }
  }, [searchQuery, groupId, userId, allUsers, fetchMemories])

  // FIX BUG-004: debounced real-time search — no Enter key required
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => {
      if (searchQuery.trim()) {
        searchMemories()
      } else {
        fetchMemories()
      }
    }, 300)
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
    }
  }, [searchQuery, fetchMemories, searchMemories])

  // Fetch memories on mount / when group/user changes
  useEffect(() => {
    fetchMemories()
  }, [groupId, userId, allUsers, fetchMemories])

  // Add memory (called from modal)
  const addMemory = useCallback(
    async (content: string): Promise<boolean> => {
      try {
        const response = await fetch("/api/memory", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            group_id: groupId,
            user_id: userId,
            content,
            metadata: { source: "manual" },
          }),
        })

        if (response.ok) {
          toast.success("Saved to memory")
          fetchMemories()
          return true
        }
        toast.error("Failed to save memory")
        return false
      } catch (error) {
        console.error("Failed to add memory:", error)
        toast.error("Failed to save memory")
        return false
      }
    },
    [groupId, userId, fetchMemories]
  )

  // Delete memory (soft delete)
  const deleteMemory = useCallback(
    async (memory: Memory) => {
      try {
        const response = await fetch(`/api/memory/${memory.id}?group_id=${groupId}&user_id=${userId}`, {
          method: "DELETE",
        })

        if (response.ok) {
          toast.success("Memory forgotten")
          setRecentlyDeleted((prev) => [memory, ...prev].slice(0, 10))
          setShowUndo(true)
          setMemories((prev) => prev.filter((m) => m.id !== memory.id))
          setTimeout(() => setShowUndo(false), 30000)
        }
      } catch (error) {
        console.error("Failed to delete memory:", error)
        toast.error("Failed to forget memory")
      }
    },
    [groupId, userId]
  )

  // Undo deletion
  const undoDelete = useCallback(async () => {
    if (recentlyDeleted.length === 0) return
    const memory = recentlyDeleted[0]
    await addMemory(memory.content)
    setRecentlyDeleted((prev) => prev.slice(1))
    setShowUndo(false)
    toast.success("Memory restored")
  }, [recentlyDeleted, addMemory])

  // Load more (pagination)
  const loadMore = useCallback(async () => {
    await fetchMemories(offset)
  }, [fetchMemories, offset])

  // Refresh (reset and refetch)
  const refresh = useCallback(() => {
    fetchMemories()
  }, [fetchMemories])

  // Toggle expanded state for a memory card
  const toggleExpand = useCallback((id: string) => {
    setMemories((prev) => prev.map((m) => (m.id === id ? { ...m, expanded: !m.expanded } : { ...m, expanded: false })))
  }, [])

  return {
    // Data
    memories,
    hasMore,

    // Loading states
    isLoading,
    isLoadingMore,

    // Search
    searchQuery,
    setSearchQuery,

    // Filters
    groupId,
    setGroupId,
    userId,
    setUserId,
    allUsers,
    setAllUsers,

    // Actions
    loadMore,
    deleteMemory,
    addMemory,
    refresh,
    toggleExpand,

    // Undo
    recentlyDeleted,
    undoDelete,
    showUndo,

    // Utility
    formatRelativeTime,
  }
}
