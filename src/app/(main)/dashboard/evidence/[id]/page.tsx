"use client"

import { useEffect, useState } from "react"
import Link from "next/link"

import { ErrorState, LoadingState, PageHeader, StatusPill, WarningList } from "@/components/dashboard/components"
import { Button } from "@/components/ui/button"
import { loadEvidenceDetail } from "@/lib/dashboard/queries"
import type { DashboardResult, Evidence } from "@/lib/dashboard/types"

export default function EvidenceDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const [id, setId] = useState<string | null>(null)
  const [state, setState] = useState<DashboardResult<Evidence> | null>(null)
  useEffect(() => { void params.then((next) => setId(next.id)) }, [params])
  useEffect(() => { if (id) void loadEvidenceDetail(id).then(setState) }, [id])
  if (!id || !state) return <LoadingState />
  if (state.error) return <ErrorState message={state.error} />
  if (!state.data) return <ErrorState message="Evidence not found." />
  const evidence = state.data
  return <div className="space-y-6"><Button variant="ghost" asChild><Link href="/dashboard/evidence">← Back to evidence</Link></Button><PageHeader title={evidence.title} description="Dive into the real evidence behind this memory or insight." action={<StatusPill value={evidence.status} />} /><WarningList warnings={state.warnings} /><div className="grid gap-6 lg:grid-cols-[1fr_320px]"><section className="rounded-xl border bg-card"><div className="border-b p-5"><h2 className="font-semibold">Raw Evidence Log</h2></div><pre className="overflow-x-auto whitespace-pre-wrap p-5 text-sm">{evidence.rawLog}</pre></section><aside className="rounded-xl border bg-card p-5"><h2 className="font-semibold">Metadata</h2><dl className="mt-4 space-y-3 text-sm"><div><dt className="text-muted-foreground">Source</dt><dd>{evidence.source}</dd></div><div><dt className="text-muted-foreground">Agent</dt><dd>{evidence.agent}</dd></div><div><dt className="text-muted-foreground">Project</dt><dd>{evidence.project}</dd></div><div><dt className="text-muted-foreground">Timestamp</dt><dd>{new Date(evidence.timestamp).toLocaleString()}</dd></div><div><dt className="text-muted-foreground">Tags</dt><dd>{evidence.tags.length ? evidence.tags.join(", ") : "None returned"}</dd></div></dl></aside></div></div>
}
