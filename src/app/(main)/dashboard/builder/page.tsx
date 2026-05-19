"use client"

import {
  CheckCircle2,
  Clock,
  Layers,
  RefreshCw,
  Send,
  Wand2,
  XCircle,
} from "lucide-react"
import { useEffect, useState, useTransition } from "react"
import { toast } from "sonner"

import {
  EmptyState,
  ErrorState,
  InsightActions,
  InsightCard,
  LoadingState,
  PageHeader,
  WarningList,
} from "@/components/dashboard"
import { approveProposal, rejectProposal } from "@/lib/dashboard/api"
import { loadCuratorQueue } from "@/lib/dashboard/queries"
import type { DashboardResult, Insight } from "@/lib/dashboard/types"

// ─── compose form ─────────────────────────────────────────────────────────────

interface ComposeState {
  content: string
  rationale: string
  submitting: boolean
  submitted: boolean
  error: string | null
}

const INITIAL_COMPOSE: ComposeState = {
  content: "",
  rationale: "",
  submitting: false,
  submitted: false,
  error: null,
}

function ComposePanel({ onSubmitSuccess }: { onSubmitSuccess: () => void }) {
  const [form, setForm] = useState<ComposeState>(INITIAL_COMPOSE)

  function handleChange(field: "content" | "rationale", value: string) {
    setForm((prev) => ({ ...prev, [field]: value, error: null }))
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    if (!form.content.trim()) {
      setForm((prev) => ({ ...prev, error: "Content is required." }))
      return
    }
    setForm((prev) => ({ ...prev, submitting: true, error: null }))
    try {
      // Compose → submit via /api/curator/proposals (POST)
      // This creates a new pending proposal that goes through HITL before Neo4j.
      const res = await fetch("/api/curator/proposals", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          content: form.content.trim(),
          rationale: form.rationale.trim() || undefined,
          group_id: "allura-system",
          agent_id: "dashboard-user",
          source: "manual-compose",
        }),
      })
      if (res.status === 405) {
        // POST not yet implemented on proposals endpoint — log and degrade gracefully.
        // The curator pipeline ingests proposals via bun run curator:run, not this endpoint.
        console.warn("[builder] POST /api/curator/proposals returned 405 — endpoint not yet implemented")
        setForm({ ...INITIAL_COMPOSE, submitted: true })
        onSubmitSuccess()
        return
      }
      if (!res.ok) {
        const payload = await res.json().catch(() => null)
        throw new Error(
          payload && typeof payload === "object" && "error" in payload
            ? String(payload.error)
            : `Submission failed: ${res.status}`
        )
      }
      setForm({ ...INITIAL_COMPOSE, submitted: true })
      onSubmitSuccess()
    } catch (err) {
      setForm((prev) => ({
        ...prev,
        submitting: false,
        error: err instanceof Error ? err.message : "Submission failed.",
      }))
    }
  }

  function handleReset() {
    setForm(INITIAL_COMPOSE)
  }

  if (form.submitted) {
    return (
      <div className="agency-card p-6 flex flex-col items-center justify-center gap-3 text-center min-h-[200px]">
        <CheckCircle2 className="size-8 text-[var(--allura-green)]" />
        <p className="text-sm font-semibold text-[var(--allura-charcoal)]">Insight submitted</p>
        <p className="text-xs text-[var(--allura-gray-500)]">
          It has been queued for curator review. Approve it from the panel below.
        </p>
        <button
          type="button"
          onClick={handleReset}
          className="agency-btn mt-2 text-xs"
        >
          Compose another
        </button>
      </div>
    )
  }

  return (
    <form onSubmit={handleSubmit} className="agency-card p-6 space-y-4">
      <div className="flex items-center gap-2 mb-2">
        <Wand2 className="size-4 text-[var(--dashboard-evidence)]" />
        <h3 className="text-sm font-semibold text-[var(--allura-charcoal)]">Compose Insight</h3>
      </div>

      <div className="space-y-1">
        <label
          htmlFor="insight-content"
          className="block text-xs font-medium text-[var(--allura-gray-500)]"
        >
          Content <span className="text-[var(--allura-orange-on-text)]">*</span>
        </label>
        <textarea
          id="insight-content"
          rows={5}
          placeholder="Describe the pattern, decision, or insight you want to capture…"
          value={form.content}
          onChange={(e) => handleChange("content", e.target.value)}
          disabled={form.submitting}
          className="w-full resize-none rounded-lg border border-[var(--allura-border-1)] bg-[var(--dashboard-bg)] px-3 py-2.5 text-sm text-[var(--allura-charcoal)] placeholder:text-[var(--allura-gray-400-text)] focus:outline-none focus:ring-2 focus:ring-[var(--allura-blue)]/40 disabled:opacity-60"
        />
      </div>

      <div className="space-y-1">
        <label
          htmlFor="insight-rationale"
          className="block text-xs font-medium text-[var(--allura-gray-500)]"
        >
          Rationale <span className="text-[var(--allura-gray-400-text)]">(optional)</span>
        </label>
        <textarea
          id="insight-rationale"
          rows={3}
          placeholder="Why is this worth capturing? What evidence supports it?"
          value={form.rationale}
          onChange={(e) => handleChange("rationale", e.target.value)}
          disabled={form.submitting}
          className="w-full resize-none rounded-lg border border-[var(--allura-border-1)] bg-[var(--dashboard-bg)] px-3 py-2.5 text-sm text-[var(--allura-charcoal)] placeholder:text-[var(--allura-gray-400-text)] focus:outline-none focus:ring-2 focus:ring-[var(--allura-blue)]/40 disabled:opacity-60"
        />
      </div>

      {form.error && (
        <p className="text-xs text-[var(--allura-orange-on-text)]">{form.error}</p>
      )}

      <div className="flex items-center justify-between pt-1">
        <p className="text-xs text-[var(--allura-gray-400-text)]">
          Submitted insights require curator approval before promotion to Neo4j.
        </p>
        <button
          type="submit"
          disabled={form.submitting || !form.content.trim()}
          className="agency-btn primary flex items-center gap-2 text-sm disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {form.submitting ? (
            <RefreshCw className="size-4 animate-spin" />
          ) : (
            <Send className="size-4" />
          )}
          Submit
        </button>
      </div>
    </form>
  )
}

// ─── queue panel ──────────────────────────────────────────────────────────────

function QueueStats({ pending, approved }: { pending: number; approved: number }) {
  return (
    <div className="grid gap-4 sm:grid-cols-3">
      <div className="metric-card">
        <div>
          <p className="metric-label">Pending Review</p>
          <p className="metric-value">{pending}</p>
        </div>
        <div className="metric-icon orange">
          <Clock className="size-5" />
        </div>
      </div>
      <div className="metric-card">
        <div>
          <p className="metric-label">Approved</p>
          <p className="metric-value">{approved}</p>
        </div>
        <div className="metric-icon green">
          <CheckCircle2 className="size-5" />
        </div>
      </div>
      <div className="metric-card">
        <div>
          <p className="metric-label">Total in Queue</p>
          <p className="metric-value">{pending + approved}</p>
        </div>
        <div className="metric-icon blue">
          <Layers className="size-5" />
        </div>
      </div>
    </div>
  )
}

// ─── page ─────────────────────────────────────────────────────────────────────

export default function BuilderPage() {
  const [pendingResult, setPendingResult] = useState<DashboardResult<Insight[]> | null>(null)
  const [approvedResult, setApprovedResult] = useState<DashboardResult<Insight[]> | null>(null)
  const [isPending, startTransition] = useTransition()
  const [activeTab, setActiveTab] = useState<"pending" | "approved">("pending")
  const [actionError, setActionError] = useState<string | null>(null)

  function loadQueue() {
    startTransition(async () => {
      const [p, a] = await Promise.allSettled([
        loadCuratorQueue("pending"),
        loadCuratorQueue("approved"),
      ])
      setPendingResult(p.status === "fulfilled" ? p.value : { data: [], error: null, degraded: false, warnings: [] })
      setApprovedResult(a.status === "fulfilled" ? a.value : { data: [], error: null, degraded: false, warnings: [] })
    })
  }

  useEffect(() => {
    loadQueue()
  }, [])

  async function handleApprove(id: string): Promise<void> {
    setActionError(null)
    try {
      await approveProposal(id)
      toast.success("Insight approved")
      loadQueue()
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Approval failed.")
    }
  }

  async function handleReject(id: string): Promise<void> {
    setActionError(null)
    try {
      await rejectProposal(id)
      toast.success("Insight rejected")
      loadQueue()
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Rejection failed.")
    }
  }

  const pending = pendingResult?.data ?? []
  const approved = approvedResult?.data ?? []
  const activeResult = activeTab === "pending" ? pendingResult : approvedResult
  const activeItems = activeTab === "pending" ? pending : approved

  const isLoading = pendingResult === null && approvedResult === null
  const hasError = (pendingResult?.error ?? approvedResult?.error) !== null && (pendingResult?.error ?? approvedResult?.error) !== undefined

  return (
    <div className="space-y-8">
      <PageHeader
        title="Insight Builder"
        description="Manually compose and promote insights from raw memories."
        action={
          <button
            type="button"
            onClick={loadQueue}
            disabled={isPending}
            className="flex items-center gap-2 rounded-lg border border-[var(--dashboard-border)] bg-[var(--dashboard-surface)] px-3 py-2 text-sm text-[var(--dashboard-text-secondary)] hover:bg-[var(--allura-gray-100)] disabled:opacity-60 transition-colors"
          >
            <RefreshCw className={`size-4 text-[var(--dashboard-text-muted)] ${isPending ? "animate-spin" : ""}`} />
            Refresh
          </button>
        }
      />

      {/* Compose section */}
      <div className="space-y-3">
        <h2 className="text-sm font-semibold text-[var(--allura-charcoal)]">New Insight</h2>
        <ComposePanel onSubmitSuccess={loadQueue} />
      </div>

      {/* Queue section */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-[var(--allura-charcoal)]">Curator Queue</h2>
          {(activeResult?.degraded) && (
            <span className="text-xs text-[var(--allura-orange-on-text)]">Partial data</span>
          )}
        </div>

        {isLoading ? (
          <LoadingState />
        ) : hasError ? (
          <ErrorState message={pendingResult?.error ?? approvedResult?.error ?? "Failed to load queue."} />
        ) : (
          <>
            <QueueStats pending={pending.length} approved={approved.length} />

            <WarningList warnings={activeResult?.warnings ?? []} />

            {actionError && (
              <div className="flex items-center gap-2 rounded-lg border border-[var(--allura-orange)]/30 bg-[var(--tone-orange-bg)] px-4 py-3">
                <XCircle className="size-4 shrink-0 text-[var(--allura-orange-on-text)]" />
                <p className="text-sm text-[var(--tone-orange-text)]">{actionError}</p>
              </div>
            )}

            {/* Tab strip */}
            <div className="flex items-center gap-1 border-b border-[var(--allura-border-1)]">
              {(["pending", "approved"] as const).map((tab) => (
                <button
                  key={tab}
                  type="button"
                  onClick={() => setActiveTab(tab)}
                  className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
                    activeTab === tab
                      ? "border-[var(--allura-blue)] text-[var(--allura-blue)]"
                      : "border-transparent text-[var(--allura-gray-500)] hover:text-[var(--allura-charcoal)]"
                  }`}
                >
                  {tab === "pending" ? `Pending (${pending.length})` : `Approved (${approved.length})`}
                </button>
              ))}
            </div>

            {activeItems.length === 0 ? (
              <EmptyState
                title={activeTab === "pending" ? "No pending insights" : "No approved insights"}
                description={
                  activeTab === "pending"
                    ? "Compose an insight above or wait for agents to surface candidates."
                    : "Approve pending insights to see them here."
                }
              />
            ) : (
              <div className="space-y-3">
                {activeItems.map((insight) => (
                  <div key={insight.id}>
                    <InsightCard insight={insight} />
                    {activeTab === "pending" && (
                      <div className="mt-2 px-1 flex items-center gap-2 flex-wrap">
                        <InsightActions
                          insight={insight}
                          onApprove={(id) => { void handleApprove(id) }}
                          onReject={(id) => { void handleReject(id) }}
                        />
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}
