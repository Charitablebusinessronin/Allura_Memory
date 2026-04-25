"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Separator } from "@/components/ui/separator"
import { StatusBadge } from "@/components/allura/status-badge"
import { ConfidenceBar } from "@/components/allura/confidence-bar"
import { TraceCard } from "@/components/allura/trace-card"
import { EmptyState } from "@/components/allura/empty-state"
import { toast } from "sonner"

interface Trace {
  id: string
  group_id: string
  event_type: string
  agent_id: string
  status: string
  metadata: Record<string, unknown>
  created_at: string
}

interface Proposal {
  id: string
  group_id: string
  content: string
  score: number
  reasoning: string
  tier: "emerging" | "adoption" | "established"
  status: "pending" | "approved" | "rejected"
  trace_ref: string
  created_at: string
}

interface Insight {
  id: string
  group_id: string
  content: string
  score: number
  provenance: string
  created_at: string
  promoted_at?: string
  promoted_by?: string
}

type CuratorTab = "pending" | "approved" | "traces"

function getProposalStatus(proposal: Proposal): "active" | "proposed" | "forgotten" | "low_confidence" {
  if (proposal.status === "approved") return "active"
  if (proposal.status === "rejected") return "forgotten"
  if (proposal.score < 0.5) return "low_confidence"
  return "proposed"
}

function formatRelativeTime(dateString: string) {
  const date = new Date(dateString)
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffMins = Math.floor(diffMs / 60000)
  const diffHours = Math.floor(diffMins / 60)
  const diffDays = Math.floor(diffHours / 24)

  if (diffMins < 1) return "just now"
  if (diffMins < 60) return `${diffMins} minutes ago`
  if (diffHours < 24) return `${diffHours} hours ago`
  if (diffDays < 7) return `${diffDays} days ago`
  return date.toLocaleDateString()
}

export default function CuratorDashboardPage() {
  const [activeTab, setActiveTab] = useState<CuratorTab>("pending")
  const [groupId, setGroupId] = useState("allura-default")
  const [traces, setTraces] = useState<Trace[]>([])
  const [insights, setInsights] = useState<Insight[]>([])
  const [proposals, setProposals] = useState<Proposal[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [selectedProposal, setSelectedProposal] = useState<Proposal | null>(null)
  const [rationale, setRationale] = useState("")

  const fetchTraces = async () => {
    setIsLoading(true)
    try {
      const response = await fetch(`/api/memory/traces?group_id=${groupId}&limit=50`)
      const data = await response.json()
      setTraces(data.traces || [])
    } catch (error) {
      console.error("Failed to fetch traces:", error)
    } finally {
      setIsLoading(false)
    }
  }

  const fetchInsights = async () => {
    setIsLoading(true)
    try {
      const response = await fetch(`/api/memory/insights?group_id=${groupId}&limit=50`)
      const data = await response.json()
      setInsights(data.insights || [])
    } catch (error) {
      console.error("Failed to fetch insights:", error)
    } finally {
      setIsLoading(false)
    }
  }

  const fetchProposals = async () => {
    setIsLoading(true)
    try {
      const response = await fetch(`/api/curator/proposals?group_id=${groupId}&status=pending`)
      const data = await response.json()
      setProposals(data.proposals || [])
    } catch (error) {
      console.error("Failed to fetch proposals:", error)
    } finally {
      setIsLoading(false)
    }
  }

  const approveProposal = async (proposal: Proposal) => {
    try {
      const response = await fetch("/api/curator/approve", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          proposal_id: proposal.id,
          group_id: groupId,
          decision: "approve",
          curator_id: "curator-user",
          rationale,
        }),
      })

      if (response.ok) {
        toast.success("Proposal approved — memory promoted to knowledge graph")
        fetchProposals()
        setSelectedProposal(null)
        setRationale("")
      } else {
        toast.error("Failed to approve proposal")
      }
    } catch (error) {
      console.error("Failed to approve proposal:", error)
    }
  }

  const rejectProposal = async (proposal: Proposal) => {
    try {
      const response = await fetch("/api/curator/approve", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          proposal_id: proposal.id,
          group_id: groupId,
          decision: "reject",
          curator_id: "curator-user",
          rationale,
        }),
      })

      if (response.ok) {
        toast.success("Proposal rejected — memory stays in episodic storage")
        fetchProposals()
        setSelectedProposal(null)
        setRationale("")
      } else {
        toast.error("Failed to reject proposal")
      }
    } catch (error) {
      console.error("Failed to reject proposal:", error)
    }
  }

  useEffect(() => {
    if (activeTab === "traces") fetchTraces()
    else if (activeTab === "approved") fetchInsights()
    else if (activeTab === "pending") fetchProposals()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab, groupId])

  return (
    <div className="flex min-h-screen flex-col bg-[var(--allura-pure-white)]">
      {/* Header */}
      <header className="border-b border-[var(--allura-deep-navy)]/10 bg-[var(--allura-deep-navy)] px-4 py-4 sm:px-6">
        <div className="mx-auto flex max-w-7xl items-center justify-between">
          <div>
            <h1 className="font-display text-2xl text-[var(--allura-pure-white)]">Curator Dashboard</h1>
            <p className="text-sm text-[var(--allura-clarity-blue)]">Human-in-the-loop governance for memory promotion</p>
          </div>
          <div className="flex items-center gap-3">
            <Input
              placeholder="group_id"
              value={groupId}
              onChange={(e) => setGroupId(e.target.value)}
              className="w-48 border-[var(--allura-clarity-blue)]/30 bg-[var(--allura-deep-navy)] text-sm text-[var(--allura-pure-white)] placeholder:text-[var(--allura-clarity-blue)]/60"
              style={{ borderRadius: "var(--allura-radius-input)" }}
            />
            <Button
              onClick={() => {
                if (activeTab === "traces") fetchTraces()
                else if (activeTab === "approved") fetchInsights()
                else if (activeTab === "pending") fetchProposals()
              }}
              variant="outline"
              className="border-[var(--allura-clarity-blue)]/30 text-[var(--allura-pure-white)] hover:bg-[var(--allura-clarity-blue)]/20"
              style={{ borderRadius: "var(--allura-radius-button)" }}
            >
              Refresh
            </Button>
          </div>
        </div>
      </header>

      {/* Tabs */}
      <div className="mx-auto w-full max-w-7xl px-4 pt-4 sm:px-6">
        <div className="flex gap-1 rounded-xl bg-[var(--allura-navy-5)] p-1">
          {(["pending", "approved", "traces"] as const).map((tab) => (
            <button
              key={tab}
              type="button"
              onClick={() => setActiveTab(tab)}
              className={`flex-1 rounded-lg px-4 py-2.5 text-sm font-medium transition-all ${
                activeTab === tab
                  ? "bg-white text-[var(--allura-deep-navy)] shadow-[var(--allura-shadow-card)]"
                  : "text-[var(--allura-warm-gray)] hover:text-[var(--allura-deep-navy)]"
              }`}
              style={{ borderRadius: "var(--allura-radius-button)" }}
            >
              {tab === "pending" && `Pending (${proposals.length})`}
              {tab === "approved" && "Approved"}
              {tab === "traces" && "Traces (Admin)"}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      <div className="mx-auto w-full max-w-7xl px-4 py-4 sm:px-6">
        {activeTab === "pending" && (
          <PendingView
            proposals={proposals}
            isLoading={isLoading}
            selectedProposal={selectedProposal}
            setSelectedProposal={setSelectedProposal}
            rationale={rationale}
            setRationale={setRationale}
            approveProposal={approveProposal}
            rejectProposal={rejectProposal}
          />
        )}
        {activeTab === "approved" && (
          <ApprovedView insights={insights} isLoading={isLoading} />
        )}
        {activeTab === "traces" && (
          <TracesView traces={traces} isLoading={isLoading} />
        )}
      </div>
    </div>
  )
}

interface PendingViewProps {
  proposals: Proposal[]
  isLoading: boolean
  selectedProposal: Proposal | null
  setSelectedProposal: (p: Proposal | null) => void
  rationale: string
  setRationale: (r: string) => void
  approveProposal: (p: Proposal) => void
  rejectProposal: (p: Proposal) => void
}

function PendingView({
  proposals,
  isLoading,
  selectedProposal,
  setSelectedProposal,
  rationale,
  setRationale,
  approveProposal,
  rejectProposal,
}: PendingViewProps) {
  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-16">
        <div className="size-8 animate-spin rounded-full border-2 border-[var(--allura-deep-navy)] border-t-transparent" />
      </div>
    )
  }

  if (proposals.length === 0) {
    return <EmptyState title="All caught up." description="No pending proposals. High-confidence memories are auto-promoted." />
  }

  return (
    <div className="flex gap-4" style={{ minHeight: 500 }}>
      {/* Left column — compact card list */}
      <div className="w-[300px] shrink-0 overflow-y-auto rounded-xl border border-[var(--allura-deep-navy)]/10 bg-white">
        <div className="space-y-0 divide-y divide-[var(--allura-deep-navy)]/10">
          {proposals.map((proposal) => (
            <button
              key={proposal.id}
              type="button"
              onClick={() => {
                setSelectedProposal(selectedProposal?.id === proposal.id ? null : proposal)
                setRationale("")
              }}
              className={`flex w-full items-start gap-2 px-4 py-3 text-left transition-colors ${
                selectedProposal?.id === proposal.id
                  ? "bg-[var(--allura-navy-5)]"
                  : "hover:bg-[var(--allura-navy-5)]/50"
              }`}
            >
              <StatusBadge status={getProposalStatus(proposal)} className="shrink-0 mt-0.5" />
              <div className="min-w-0 flex-1">
                <p className="line-clamp-2 text-sm text-[var(--allura-ink-black)]">{proposal.content}</p>
                <div className="mt-1 flex items-center gap-2 text-xs text-[var(--allura-warm-gray)]">
                  <span>{formatRelativeTime(proposal.created_at)}</span>
                  <span>&middot;</span>
                  <span className="capitalize">{proposal.tier}</span>
                </div>
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Right column — detail */}
      <div className="flex-1 overflow-y-auto rounded-xl border border-[var(--allura-deep-navy)]/10 bg-white p-6">
        {selectedProposal ? (
          <div className="space-y-5">
            <div className="flex items-start justify-between">
              <div>
                <h3 className="text-lg font-semibold text-[var(--allura-ink-black)]">
                  Proposal Detail
                </h3>
                <div className="mt-1 flex items-center gap-2 text-sm text-[var(--allura-warm-gray)]">
                  <span>{formatRelativeTime(selectedProposal.created_at)}</span>
                  <span>&middot;</span>
                  <span className="capitalize">{selectedProposal.tier}</span>
                  <span>&middot;</span>
                  <span>{selectedProposal.group_id}</span>
                </div>
              </div>
              <StatusBadge status={getProposalStatus(selectedProposal)} />
            </div>

            <p className="leading-7 text-[var(--allura-ink-black)]">{selectedProposal.content}</p>

            <div className="flex items-end gap-4">
              <ConfidenceBar value={selectedProposal.score * 100} />
            </div>

            {selectedProposal.reasoning && (
              <div>
                <p className="mb-1 text-[11px] font-bold tracking-[0.2em] text-[var(--allura-coral)] uppercase">Reasoning</p>
                <p className="text-sm leading-6 text-[var(--allura-warm-gray)]">{selectedProposal.reasoning}</p>
              </div>
            )}

            {/* Trace evidence */}
            <div>
              <p className="mb-2 text-[11px] font-bold tracking-[0.2em] text-[var(--allura-coral)] uppercase">Evidence</p>
              <TraceCard
                tool="memory.propose"
                snippet={`Score: ${(selectedProposal.score * 100).toFixed(0)}% — ${selectedProposal.reasoning || "Auto-scored by curator pipeline"}`}
                timestamp={formatRelativeTime(selectedProposal.created_at)}
              />
            </div>

            <Separator className="bg-[var(--allura-deep-navy)]/10" />

            <div className="space-y-3">
              <Textarea
                placeholder="Rationale for decision (optional)"
                value={rationale}
                onChange={(e) => setRationale(e.target.value)}
                className="min-h-[60px] border-[var(--allura-deep-navy)]/20 bg-[var(--allura-pure-white)]"
                style={{ borderRadius: "var(--allura-radius-input)" }}
              />
              <div className="flex gap-2">
                <Button
                  onClick={() => approveProposal(selectedProposal)}
                  className="bg-[var(--allura-deep-navy)] text-[var(--allura-pure-white)] hover:bg-[var(--allura-deep-navy)]/90"
                  style={{ borderRadius: "var(--allura-radius-button)" }}
                >
                  Approve ✓
                </Button>
                <Button
                  variant="outline"
                  className="border-[var(--allura-deep-navy)] text-[var(--allura-deep-navy)]"
                  style={{ borderRadius: "var(--allura-radius-button)" }}
                >
                  Edit ✎
                </Button>
                <Button
                  variant="ghost"
                  onClick={() => rejectProposal(selectedProposal)}
                  className="text-[var(--allura-warm-gray)] hover:bg-[var(--allura-coral-10)] hover:text-[var(--allura-coral)]"
                  style={{ borderRadius: "var(--allura-radius-button)" }}
                >
                  Reject ✕
                </Button>
              </div>
            </div>
          </div>
        ) : (
          <div className="flex h-full items-center justify-center py-20">
            <p className="text-sm text-[var(--allura-warm-gray)]">Select a proposal to review</p>
          </div>
        )}
      </div>
    </div>
  )
}

function ApprovedView({ insights, isLoading }: { insights: Insight[]; isLoading: boolean }) {
  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-16">
        <div className="size-8 animate-spin rounded-full border-2 border-[var(--allura-deep-navy)] border-t-transparent" />
      </div>
    )
  }

  if (insights.length === 0) {
    return <EmptyState title="No approved knowledge yet" description="Approved memories will appear here after curator review." />
  }

  return (
    <div className="space-y-3">
      {insights.map((insight) => (
        <div
          key={insight.id}
          className="rounded-xl border border-[var(--allura-deep-navy)]/10 bg-white p-4 shadow-[var(--allura-shadow-card)]"
          style={{ borderRadius: "var(--allura-radius-card)" }}
        >
          <p className="mb-2 text-sm text-[var(--allura-ink-black)]">{insight.content}</p>
          <div className="flex items-center gap-2 text-xs text-[var(--allura-warm-gray)]">
            <span>{formatRelativeTime(insight.created_at)}</span>
            <span>&middot;</span>
            <span>{insight.provenance}</span>
            {insight.promoted_by && (
              <>
                <span>&middot;</span>
                <span>Promoted by {insight.promoted_by}</span>
              </>
            )}
          </div>
        </div>
      ))}
    </div>
  )
}

function TracesView({ traces, isLoading }: { traces: Trace[]; isLoading: boolean }) {
  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-16">
        <div className="size-8 animate-spin rounded-full border-2 border-[var(--allura-deep-navy)] border-t-transparent" />
      </div>
    )
  }

  if (traces.length === 0) {
    return <EmptyState title="No traces found" description="Raw event traces will appear here when available." />
  }

  return (
    <div className="space-y-3">
      {traces.map((trace) => (
        <div
          key={trace.id}
          className="rounded-xl border border-[var(--allura-deep-navy)]/10 bg-white p-4 shadow-[var(--allura-shadow-card)]"
          style={{ borderRadius: "var(--allura-radius-card)" }}
        >
          <div className="mb-2 flex items-start justify-between">
            <StatusBadge
              status={trace.status === "completed" ? "active" : trace.status === "pending" ? "proposed" : "low_confidence"}
            />
            <span className="text-xs text-[var(--allura-warm-gray)]">
              {formatRelativeTime(trace.created_at)}
            </span>
          </div>
          <pre className="overflow-x-auto rounded-lg bg-[var(--allura-pure-white)] p-2 text-xs text-[var(--allura-ink-black)]">
            {JSON.stringify(trace.metadata, null, 2)}
          </pre>
        </div>
      ))}
    </div>
  )
}