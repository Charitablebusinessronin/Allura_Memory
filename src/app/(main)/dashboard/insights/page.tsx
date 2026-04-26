"use client"

import { useCallback, useEffect, useState } from "react"

import { ErrorState, InsightActions, InsightCard, LoadingState, PageHeader, WarningList } from "@/components/dashboard/components"
import { approveProposal, rejectProposal } from "@/lib/dashboard/api"
import { loadInsights } from "@/lib/dashboard/queries"
import type { DashboardResult, Insight } from "@/lib/dashboard/types"

type Tab = "pending" | "active" | "rejected" | "superseded"

export default function InsightsPage() {
  const [tab, setTab] = useState<Tab>("pending")
  const [state, setState] = useState<DashboardResult<Insight[]> | null>(null)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)

  const refresh = useCallback(() => {
    setState(null)
    void loadInsights(tab).then(setState)
  }, [tab])

  useEffect(() => refresh(), [refresh])

  const approve = async (id: string) => {
    setBusyId(id)
    setActionError(null)
    try {
      await approveProposal(id)
      refresh()
    } catch (error) {
      setActionError(error instanceof Error ? error.message : "Approval failed")
    } finally {
      setBusyId(null)
    }
  }

  const reject = async (id: string) => {
    setBusyId(id)
    setActionError(null)
    try {
      await rejectProposal(id)
      refresh()
    } catch (error) {
      setActionError(error instanceof Error ? error.message : "Rejection failed")
    } finally {
      setBusyId(null)
    }
  }

  return <div className="space-y-6"><PageHeader title="Insight Review Queue" description="Review, approve, reject, or revise candidate insights using real curator data." />
    <div className="flex flex-wrap gap-2">{(["pending", "active", "rejected", "superseded"] as const).map((value) => <button key={value} type="button" onClick={() => setTab(value)} className={`rounded-md px-3 py-2 text-sm ${tab === value ? "bg-[#111827] text-white" : "bg-muted text-muted-foreground"}`}>{value}</button>)}</div>
    {actionError && <ErrorState message={actionError} />}
    {!state ? <LoadingState /> : state.error ? <ErrorState message={state.error} /> : <><WarningList warnings={state.warnings} /><div className="space-y-3">{(state.data ?? []).length === 0 ? <p className="text-muted-foreground rounded-xl border border-dashed p-8 text-center text-sm">No insights returned for this status.</p> : state.data!.map((insight) => <InsightCard key={insight.id} insight={insight} actions={tab === "pending" ? <InsightActions insight={insight} onApprove={approve} onReject={reject} busy={busyId === insight.id} /> : undefined} />)}</div></>}
  </div>
}
