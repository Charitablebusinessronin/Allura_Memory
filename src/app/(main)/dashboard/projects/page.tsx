"use client"

import { useEffect, useMemo, useState } from "react"

import { EmptyState, ErrorState, LoadingState, PageHeader, WarningList } from "@/components/dashboard"
import { loadMemories } from "@/lib/dashboard/queries"
import type { DashboardResult, Memory } from "@/lib/dashboard/types"

export default function ProjectsPage() {
  const [state, setState] = useState<DashboardResult<Memory[]> | null>(null)
  useEffect(() => { void loadMemories().then(setState) }, [])
  const projects = useMemo(() => Array.from(new Set((state?.data ?? []).map((memory) => memory.project))).filter(Boolean), [state?.data])
  return <div className="space-y-6"><PageHeader title="Projects" description="Projects observed in real Brain memory metadata." />{!state ? <LoadingState /> : state.error ? <ErrorState message={state.error} /> : <><WarningList warnings={state.warnings} />{projects.length === 0 ? <EmptyState title="No projects returned" description="No project metadata was found in the current Brain data." /> : <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">{projects.map((project) => <div key={project} className="rounded-xl border bg-card p-5"><h3 className="font-semibold">{project}</h3><p className="text-muted-foreground mt-1 text-sm">Connected to {state.data!.filter((memory) => memory.project === project).length} memories.</p></div>)}</div>}</>}</div>
}
