"use client"

import { useEffect, useMemo, useState } from "react"

import { EmptyState, ErrorState, LoadingState, PageHeader, WarningList } from "@/components/dashboard"
import { loadMemories } from "@/lib/dashboard/queries"
import type { DashboardResult, Memory } from "@/lib/dashboard/types"

export default function AgentsPage() {
  const [state, setState] = useState<DashboardResult<Memory[]> | null>(null)
  useEffect(() => { void loadMemories().then(setState) }, [])
  const agents = useMemo(() => Array.from(new Set((state?.data ?? []).map((memory) => memory.agent))).filter(Boolean), [state?.data])
  return <div className="space-y-6"><PageHeader title="Agents" description="Agents observed in real Brain memory provenance." />{!state ? <LoadingState /> : state.error ? <ErrorState message={state.error} /> : <><WarningList warnings={state.warnings} />{agents.length === 0 ? <EmptyState title="No agents returned" description="No agent provenance was found in the current Brain data." /> : <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">{agents.map((agent) => <div key={agent} className="rounded-xl border bg-card p-5"><h3 className="font-semibold">{agent}</h3><p className="text-muted-foreground mt-1 text-sm">Observed in {state.data!.filter((memory) => memory.agent === agent).length} memories.</p></div>)}</div>}</>}</div>
}
