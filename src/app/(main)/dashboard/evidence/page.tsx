"use client"

import { useEffect, useState } from "react"

import { EmptyState, ErrorState, EvidenceCard, LoadingState, PageHeader, WarningList } from "@/components/dashboard"
import { loadEvidence } from "@/lib/dashboard/queries"
import type { DashboardResult, Evidence } from "@/lib/dashboard/types"

export default function EvidencePage() {
  const [state, setState] = useState<DashboardResult<Evidence[]> | null>(null)
  useEffect(() => { void loadEvidence().then(setState) }, [])
  return <div className="space-y-6"><PageHeader title="Evidence" description="Raw traces and evidence records returned by Allura Brain." />{!state ? <LoadingState /> : state.error ? <ErrorState message={state.error} /> : <><WarningList warnings={state.warnings} />{(state.data ?? []).length === 0 ? <EmptyState title="No evidence returned" description="The traces endpoint returned no evidence for this tenant." /> : <div className="grid gap-3">{state.data!.map((evidence) => <EvidenceCard key={evidence.id} evidence={evidence} />)}</div>}</>}</div>
}
