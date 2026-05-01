"use client"

import { useEffect, useMemo, useState } from "react"

import { EmptyState, ErrorState, LoadingState, MemoryCard, PageHeader, SearchInput, Tabs, WarningList, SearchResultsSkeleton } from "@/components/dashboard"
import { loadMemories } from "@/lib/dashboard/queries"
import type { DashboardResult, Memory } from "@/lib/dashboard/types"

type Tab = "all" | "event" | "outcome" | "insight"

const tabItems: Array<{ value: Tab; label: string }> = [
  { value: "all", label: "All" },
  { value: "event", label: "Events" },
  { value: "outcome", label: "Outcomes" },
  { value: "insight", label: "Insights" },
]

export default function MemoriesPage() {
  const [query, setQuery] = useState("")
  const [tab, setTab] = useState<Tab>("all")
  const [state, setState] = useState<DashboardResult<Memory[]> | null>(null)

  useEffect(() => {
    const handle = window.setTimeout(() => {
      void loadMemories(query).then(setState)
    }, 250)
    return () => window.clearTimeout(handle)
  }, [query])

  const memories = useMemo(() => {
    const items = state?.data ?? []
    return tab === "all" ? items : items.filter((item) => item.type === tab)
  }, [state?.data, tab])

  return (
    <div className="space-y-6" >
      <PageHeader title="Memory Feed" description="Search and explore real memories from Allura Brain." />
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
        <SearchInput value={query} onChange={setQuery} placeholder="Search memories..." />
        <Tabs items={tabItems} value={tab} onChange={setTab} />
      </div>
      {!state ? <SearchResultsSkeleton /> : state.error ? <ErrorState message={state.error} /> : <>
        <WarningList warnings={state.warnings} />
        {memories.length === 0 ? <EmptyState title="No memories found" description={query ? "No memories match your search. Try a different search term." : "No memories available for the current filter. Try adjusting your selection."} /> : <div className="space-y-3">{memories.map((memory) => <MemoryCard key={memory.id} memory={memory} />)}</div>}
      </>}
    </div>
  )
}
