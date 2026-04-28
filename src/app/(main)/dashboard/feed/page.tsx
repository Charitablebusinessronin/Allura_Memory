"use client"

import { useEffect, useMemo, useState } from "react"
import { useRouter } from "next/navigation"

import {
  EmptyState,
  ErrorState,
  LoadingState,
  MemoryCard,
  PageHeader,
  WarningList,
} from "@/components/dashboard"
import { Button } from "@/components/ui/button"
import { Dropdown } from "@/components/ui/dropdown"
import { Pagination } from "@/components/ui/pagination"
import { SearchBar } from "@/components/ui/search-bar"
import { loadMemories } from "@/lib/dashboard/queries"
import type { DashboardResult, Memory } from "@/lib/dashboard/types"

const PAGE_SIZE = 10

const typeOptions = [
  { value: "all", label: "All Types" },
  { value: "event", label: "Event" },
  { value: "outcome", label: "Outcome" },
  { value: "insight", label: "Insight" },
  { value: "memory", label: "Memory" },
]

const sortOptions = [
  { value: "newest", label: "Newest first" },
  { value: "oldest", label: "Oldest first" },
  { value: "confidence", label: "Highest confidence" },
]

export default function MemoryFeedPage() {
  const router = useRouter()
  const [query, setQuery] = useState("")
  const [typeFilter, setTypeFilter] = useState("all")
  const [sort, setSort] = useState("newest")
  const [page, setPage] = useState(1)
  const [state, setState] = useState<DashboardResult<Memory[]> | null>(null)

  useEffect(() => {
    const handle = window.setTimeout(() => {
      void loadMemories(query).then(setState)
    }, 250)
    return () => window.clearTimeout(handle)
  }, [query])

  const filtered = useMemo(() => {
    const items = state?.data ?? []
    let result = typeFilter === "all" ? items : items.filter((item) => item.type === typeFilter)
    if (sort === "newest") {
      result = [...result].sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
    } else if (sort === "oldest") {
      result = [...result].sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime())
    } else if (sort === "confidence") {
      result = [...result].sort((a, b) => (b.confidence ?? 0) - (a.confidence ?? 0))
    }
    return result
  }, [state?.data, typeFilter, sort])

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
  const pageItems = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)

  return (
    <div className="space-y-6">
      <PageHeader title="Memory Feed" description="Search and explore real memories from Allura Brain." />

      <div className={`flex flex-col gap-3 rounded-xl border border-[var(--allura-border-1)] bg-white p-3 shadow-[var(--allura-sh-sm)] lg:flex-row lg:items-center lg:justify-between`}>
        <div className="flex flex-1 flex-col gap-3 sm:flex-row sm:items-center">
          <SearchBar
            placeholder="Search memories…"
            value={query}
            onChange={(v) => {
              setQuery(v)
              setPage(1)
            }}
            className="w-full sm:w-80"
          />
          <Dropdown
            options={typeOptions}
            value={typeFilter}
            onChange={(v) => {
              setTypeFilter(v as string)
              setPage(1)
            }}
            className="w-full sm:w-44"
          />
          <Dropdown
            options={sortOptions}
            value={sort}
            onChange={(v) => setSort(v as string)}
            className="w-full sm:w-44"
          />
        </div>
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" onClick={() => { setQuery(""); setTypeFilter("all"); setSort("newest"); setPage(1) }}>
            Clear
          </Button>
        </div>
      </div>

      {!state ? (
        <LoadingState />
      ) : state.error ? (
        <ErrorState message={state.error} />
      ) : (
        <>
          <WarningList warnings={state.warnings} />
          {pageItems.length === 0 ? (
            <EmptyState
              title="No memories returned"
              description={query ? "No memories match your search. Try different keywords." : "The Brain returned no memories for the current filter."}
            />
          ) : (
            <div className="space-y-3">
              {pageItems.map((memory) => (
                <MemoryCard key={memory.id} memory={memory} />
              ))}
            </div>
          )}
          <div className="pt-4">
            <Pagination currentPage={page} totalPages={totalPages} onPageChange={setPage} />
          </div>
        </>
      )}
    </div>
  )
}
