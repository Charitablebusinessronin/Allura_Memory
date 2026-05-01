"use client"

import { useCallback, useEffect, useState } from "react"

import { EmptyState, ErrorState, InsightActions, InsightCard, LoadingState, PageHeader, Tabs, WarningList } from "@/components/dashboard"
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

  const tabItems: Array<{ value: Tab; label: string }> = [
    { value: "pending", label: "Queue" },
    { value: "active", label: "Approved" },
    { value: "rejected", label: "Rejected" },
    { value: "superseded", label: "Superseded" },
  ]

  return <div className="space-y-6" ><PageHeader title="Insights" description="Review, approve, reject, or revise candidate insights using real curator data." />
    <Tabs items={tabItems} value={tab} onChange={setTab} />
    {actionError && <ErrorState message={actionError} />}
    {!state ? <LoadingState /> : state.error ? <ErrorState message={state.error} /> : <><WarningList warnings={state.warnings} /><div className="space-y-3">{(state.data ?? []).length === 0 ? <EmptyState title="No insights returned" description="No insights found for this status. Try a different tab or wait for the curator pipeline to generate new proposals." /> : state.data!.map((insight) => <InsightCard key={insight.id} insight={insight} actions={tab === "pending" ? <InsightActions insight={insight} onApprove={approve} onReject={reject} busy={busyId === insight.id} /> : undefined} />)}</div></>}
  </div>
}
