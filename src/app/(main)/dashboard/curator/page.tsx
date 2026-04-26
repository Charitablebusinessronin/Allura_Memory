"use client"

import { useCallback, useEffect, useState } from "react"

import { ErrorState, InsightActions, InsightCard, LoadingState, PageHeader, WarningList } from "@/components/dashboard"
import { approveProposal, rejectProposal } from "@/lib/dashboard/api"
import { loadInsights } from "@/lib/dashboard/queries"
import type { DashboardResult, Insight } from "@/lib/dashboard/types"

export default function CuratorPage() {
  const [state, setState] = useState<DashboardResult<Insight[]> | null>(null)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)

  const refresh = useCallback(() => {
    setState(null)
    void loadInsights("pending").then(setState)
  }, [])

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

  const proposals = state?.data ?? []
  const pendingCount = proposals.length

  return (
    <div className="space-y-6" style={{ fontFamily: "var(--font-ibm-plex-sans)" }}>
      <PageHeader title="Curator" description="Review and approve or reject pending promotion proposals from real Brain data." />

      <div className="grid gap-4 md:grid-cols-3">
        <div className="rounded-xl border bg-[var(--dashboard-surface)] p-5">
          <p className="text-xs font-semibold uppercase tracking-wider text-[var(--dashboard-text-secondary)]">Pending</p>
          <p className="mt-1 text-2xl font-bold text-[var(--tone-orange-text)]">{pendingCount}</p>
        </div>
        <div className="rounded-xl border bg-[var(--dashboard-surface)] p-5">
          <p className="text-xs font-semibold uppercase tracking-wider text-[var(--dashboard-text-secondary)]">Data Source</p>
          <p className="mt-1 text-2xl font-bold text-[var(--tone-green-text)]">Real</p>
          <p className="text-xs text-[var(--dashboard-text-secondary)]">Curator proposals API</p>
        </div>
        <div className="rounded-xl border bg-[var(--dashboard-surface)] p-5">
          <p className="text-xs font-semibold uppercase tracking-wider text-[var(--dashboard-text-secondary)]">Policy</p>
          <p className="mt-1 text-sm font-semibold text-[var(--dashboard-text-primary)]">HITL Required</p>
          <p className="text-xs text-[var(--dashboard-text-secondary)]">All promotions require human approval</p>
        </div>
      </div>

      {actionError && <ErrorState message={actionError} />}

      {!state ? <LoadingState /> : state.error ? <ErrorState message={state.error} /> : (
        <>
          <WarningList warnings={state.warnings} />
          {proposals.length === 0 ? (
            <div className="rounded-xl border border-dashed p-10 text-center">
              <p className="font-medium text-[var(--dashboard-text-primary)]">No pending proposals</p>
              <p className="text-[var(--dashboard-text-secondary)] mt-1 text-sm">The curator queue is empty. New proposals will appear here when the scoring pipeline generates them.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {proposals.map((insight) => (
                <InsightCard key={insight.id} insight={insight} actions={<InsightActions insight={insight} onApprove={approve} onReject={reject} busy={busyId === insight.id} />} />
              ))}
            </div>
          )}
        </>
      )}
    </div>
  )
}