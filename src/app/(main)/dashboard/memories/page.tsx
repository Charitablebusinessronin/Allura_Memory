"use client"

import { useEffect, useMemo, useState } from "react"
import { Search } from "lucide-react"

import { EmptyState, ErrorState, LoadingState, MemoryCard, PageHeader, WarningList } from "@/components/dashboard/components"
import { Input } from "@/components/ui/input"
import { loadMemories } from "@/lib/dashboard/queries"
import type { DashboardResult, Memory } from "@/lib/dashboard/types"

type Tab = "all" | "event" | "outcome" | "insight"

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
    <div className="space-y-6">
      <PageHeader title="Memory Feed" description="Search and explore real memories from Allura Brain." />
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
        <div className="relative flex-1">
          <Search className="text-muted-foreground absolute top-1/2 left-3 size-4 -translate-y-1/2" />
          <Input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search memories..." className="pl-9" />
        </div>
        <div className="flex gap-2">
          {(["all", "event", "outcome", "insight"] as const).map((value) => (
            <button key={value} type="button" onClick={() => setTab(value)} className={`rounded-md px-3 py-2 text-sm ${tab === value ? "bg-[#111827] text-white" : "bg-muted text-muted-foreground"}`}>{value}</button>
          ))}
        </div>
      </div>
      {!state ? <LoadingState /> : state.error ? <ErrorState message={state.error} /> : <>
        <WarningList warnings={state.warnings} />
        {memories.length === 0 ? <EmptyState title="No memories returned" description="The Brain returned no memories for the current filter. No fake rows are shown." /> : <div className="space-y-3">{memories.map((memory) => <MemoryCard key={memory.id} memory={memory} />)}</div>}
      </>}
    </div>
  )
}
