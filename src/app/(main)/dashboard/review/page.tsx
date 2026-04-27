"use client"

import { useCallback, useEffect, useState } from "react"

import {
  ErrorState,
  InsightActions,
  InsightCard,
  LoadingState,
  PageHeader,
  WarningList,
} from "@/components/dashboard"
import { Button } from "@/components/ui/button"
import { approveProposal, rejectProposal } from "@/lib/dashboard/api"
import { loadInsights } from "@/lib/dashboard/queries"
import type { DashboardResult, Insight } from "@/lib/dashboard/types"

type Tab = "pending" | "approved" | "rejected"

const tabs: Array<{ value: Tab; label: string }> = [
  { value: "pending", label: "Pending" },
  { value: "approved", label: "Approved" },
  { value: "rejected", label: "Rejected" },
]

export default function ReviewPage() {
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

  return (
    <div className="space-y-6" style={{ fontFamily: "var(--font-ibm-plex-sans)" }}>
      <PageHeader title="Insight Review" description="Review, approve, reject, or revise candidate insights using real curator data." />

      {/* Tabs */}
      <div className="flex border-b border-[#E5E7EB]">
        {tabs.map((t) => (
          <button
            key={t.value}
            type="button"
            onClick={() => setTab(t.value)}
            className={`relative px-4 py-3 text-sm font-medium transition-colors ${
              tab === t.value
                ? "text-[#1D4ED8]"
                : "text-[#6B7280] hover:text-[#0F1115]"
            }`}
          >
            {t.label}
            {tab === t.value && (
              <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#1D4ED8]" />
            )}
          </button>
        ))}
      </div>

      {actionError && <ErrorState message={actionError} />}

      {!state ? (
        <LoadingState />
      ) : state.error ? (
        <ErrorState message={state.error} />
      ) : (
        <>
          <WarningList warnings={state.warnings} />
          <div className="space-y-3">
            {(state.data ?? []).length === 0 ? (
              <div className="rounded-xl border border-dashed border-[#D1D5DB] p-8 text-center">
                <p className="text-sm text-[#6B7280]">No insights returned for this status.</p>
              </div>
            ) : (
              state.data!.map((insight) => (
                <InsightCard
                  key={insight.id}
                  insight={insight}
                  actions={
                    tab === "pending" ? (
                      <InsightActions
                        insight={insight}
                        onApprove={approve}
                        onReject={reject}
                        busy={busyId === insight.id}
                      />
                    ) : undefined
                  }
                />
              ))
            )}
          </div>
        </>
      )}
    </div>
  )
}
