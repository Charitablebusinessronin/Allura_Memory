"use client"

import { useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"

import {
  EmptyState,
  ErrorState,
  EvidenceCard,
  LoadingState,
  PageHeader,
  SearchInput,
  Tabs,
  WarningList,
} from "@/components/dashboard"
import { Button } from "@/components/ui/button"
import { loadEvidence } from "@/lib/dashboard/queries"
import type { DashboardResult, Evidence } from "@/lib/dashboard/types"

type Tab = "all" | "traces" | "memory-derived"

const tabItems: Array<{ value: Tab; label: string }> = [
  { value: "all", label: "All" },
  { value: "traces", label: "Traces" },
  { value: "memory-derived", label: "Memory-derived" },
]

export default function EvidencePage() {
  const [tab, setTab] = useState<Tab>("all")
  const [search, setSearch] = useState("")
  const [state, setState] = useState<DashboardResult<Evidence[]> | null>(null)

  useEffect(() => {
    void loadEvidence().then(setState)
  }, [])

  const filtered = useMemo(() => {
    const base = state?.data ?? []
    const byTab =
      tab === "all"
        ? base
        : tab === "traces"
        ? base.filter((e) => e.source.toLowerCase().includes("trace"))
        : base.filter(
            (e) =>
e.source.toLowerCase().includes("memory") ||
              e.source.toLowerCase().includes("semantic")
          )
    if (!search.trim()) return byTab
    const q = search.toLowerCase()
    return byTab.filter(
      (e) =>
        e.title.toLowerCase().includes(q) ||
        e.agent.toLowerCase().includes(q) ||
        e.tags.some((t) => t.toLowerCase().includes(q))
    )
  }, [state?.data, tab, search])

  return (
    <div className="space-y-6" >
      <PageHeader
        title="Evidence Detail"
        description="Raw traces and evidence records returned by Allura Brain."
      />

      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <Tabs items={tabItems} value={tab} onChange={setTab} />
        <SearchInput
          value={search}
          onChange={setSearch}
          placeholder="Search evidence..."
        />
      </div>

      {!state ? (
        <LoadingState />
      ) : state.error ? (
        <ErrorState message={state.error} />
      ) : (
        <>
          <WarningList warnings={state.warnings} />
          {filtered.length === 0 ? (
            <EmptyState
              title="No evidence returned"
              description={
                search
                  ? "No evidence matches your search. Try different keywords."
                  : "The traces endpoint returned no evidence for this tenant."
              }
            />
          ) : (
            <div className="grid gap-3">
              {filtered.map((evidence) => (
                <EvidenceCard key={evidence.id} evidence={evidence} />
              ))}
            </div>
          )}
        </>
      )}
    </div>
  )
}
