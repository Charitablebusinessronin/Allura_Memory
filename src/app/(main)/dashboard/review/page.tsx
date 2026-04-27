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
import { tokens } from "@/lib/tokens"
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
    <div className="space-y-6">
      <PageHeader title="Insight Review" description="Review, approve, reject, or revise candidate insights using real curator data." />

      {/* Tabs — underline uses Gold per design spec CR-3 */}
      <div className={`flex border-b border-[${tokens.color.border.subtle}]`}>
        {tabs.map((t) => (
          <button
            key={t.value}
            type="button"
            onClick={() => setTab(t.value)}
            className={`relative px-4 py-3 text-sm font-medium transition-colors ${
              tab === t.value
                ? `text-[${tokens.color.primary.default}]`
                : `text-[${tokens.color.text.secondary}] hover:text-[${tokens.color.text.primary}]`
            }`}
          >
            {t.label}
            {tab === t.value && (
              <span className={`absolute bottom-0 left-0 right-0 h-0.5 bg-[${tokens.color.accent.gold}]`} />
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
              <div className={`rounded-xl border border-dashed border-[${tokens.color.border.default}] p-8 text-center`}>
                <p className={`text-sm text-[${tokens.color.text.secondary}]`}>No insights returned for this status.</p>
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
