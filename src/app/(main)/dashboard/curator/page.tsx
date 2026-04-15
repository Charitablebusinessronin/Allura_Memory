"use client"

import { useState, useEffect, useCallback } from "react"
import { formatDistanceToNow } from "date-fns"
import { ChevronDown, ChevronRight, CheckCircle, XCircle, Loader2, ClipboardList } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Textarea } from "@/components/ui/textarea"
import { Skeleton } from "@/components/ui/skeleton"

import { APP_CONFIG } from "@/config/app-config"

const DEFAULT_GROUP_ID = APP_CONFIG.defaultGroupId
const CURATOR_ID = "dashboard-user"

type ProposalStatus = "pending" | "approved" | "rejected"

interface Proposal {
  id: string
  group_id: string
  content: string
  score: number
  reasoning: string | null
  tier: string | null
  status: ProposalStatus
  trace_ref: string | null
  created_at: string
}

type FilterTab = "all" | "pending" | "approved" | "rejected"

async function fetchProposals(filter: FilterTab): Promise<Proposal[]> {
  const status = filter === "all" ? "all" : filter
  const res = await fetch(`/api/curator/proposals?group_id=${DEFAULT_GROUP_ID}&status=${status}&limit=100`, {
    cache: "no-store",
  })
  if (!res.ok) throw new Error("Failed to fetch proposals")
  const data = await res.json()
  return data.proposals ?? []
}

async function submitDecision(proposalId: string, decision: "approve" | "reject", rationale?: string): Promise<void> {
  const res = await fetch("/api/curator/approve", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      proposal_id: proposalId,
      group_id: DEFAULT_GROUP_ID,
      decision,
      curator_id: CURATOR_ID,
      rationale: rationale || undefined,
    }),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error((err as { error?: string }).error ?? "Decision failed")
  }
}

function StatusBadge({ status }: { status: ProposalStatus }) {
  if (status === "approved") {
    return <Badge className="border-green-500/20 bg-green-500/10 text-green-600 dark:text-green-400">approved</Badge>
  }
  if (status === "rejected") {
    return <Badge variant="destructive">rejected</Badge>
  }
  return <Badge className="border-yellow-500/20 bg-yellow-500/10 text-yellow-600 dark:text-yellow-400">pending</Badge>
}

interface ProposalRowProps {
  proposal: Proposal
  onDecision: (id: string, decision: "approve" | "reject", rationale?: string) => void
  optimisticStatus: ProposalStatus | null
  isPending: boolean
}

function ProposalRow({ proposal, onDecision, optimisticStatus, isPending }: ProposalRowProps) {
  const [expanded, setExpanded] = useState(false)
  const [rejectionReason, setRejectionReason] = useState("")
  const [confirmReject, setConfirmReject] = useState(false)

  const effectiveStatus = optimisticStatus ?? proposal.status
  const isSettled = effectiveStatus !== "pending"

  return (
    <div className="bg-card overflow-hidden rounded-lg border">
      <button
        type="button"
        className="hover:bg-muted/40 flex w-full items-center gap-3 px-4 py-3 text-left transition-colors"
        onClick={() => setExpanded((v) => !v)}
      >
        <span className="text-muted-foreground shrink-0">
          {expanded ? <ChevronDown className="size-4" /> : <ChevronRight className="size-4" />}
        </span>
        <span className="text-muted-foreground w-20 shrink-0 truncate font-mono text-xs">
          {proposal.id.slice(0, 8)}…
        </span>
        <span className="flex-1 truncate text-sm">
          {proposal.content.slice(0, 120)}
          {proposal.content.length > 120 ? "…" : ""}
        </span>
        <span className="text-muted-foreground hidden shrink-0 text-xs sm:block">
          {formatDistanceToNow(new Date(proposal.created_at), { addSuffix: true })}
        </span>
        <span className="shrink-0">
          <StatusBadge status={effectiveStatus} />
        </span>
      </button>

      {expanded && (
        <div className="bg-muted/20 space-y-4 border-t px-4 py-4">
          <div className="space-y-1">
            <p className="text-muted-foreground text-xs font-medium tracking-wide uppercase">Full Content</p>
            <p className="text-sm whitespace-pre-wrap">{proposal.content}</p>
          </div>

          <div className="grid gap-3 text-xs sm:grid-cols-3">
            {proposal.trace_ref && (
              <div>
                <p className="text-muted-foreground font-medium">Trace ID</p>
                <p className="mt-0.5 truncate font-mono">{proposal.trace_ref}</p>
              </div>
            )}
            {proposal.tier && (
              <div>
                <p className="text-muted-foreground font-medium">Tier</p>
                <p className="mt-0.5">{proposal.tier}</p>
              </div>
            )}
            <div>
              <p className="text-muted-foreground font-medium">Score</p>
              <p className="mt-0.5">{proposal.score.toFixed(3)}</p>
            </div>
          </div>

          {proposal.reasoning && (
            <div>
              <p className="text-muted-foreground text-xs font-medium tracking-wide uppercase">Reasoning</p>
              <p className="text-muted-foreground mt-1 text-sm">{proposal.reasoning}</p>
            </div>
          )}

          {!isSettled && (
            <div className="flex flex-col gap-3 pt-1">
              {confirmReject ? (
                <div className="space-y-2">
                  <Textarea
                    placeholder="Rejection reason (optional)"
                    value={rejectionReason}
                    onChange={(e) => setRejectionReason(e.target.value)}
                    className="resize-none text-sm"
                    rows={2}
                  />
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      variant="destructive"
                      disabled={isPending}
                      onClick={() => onDecision(proposal.id, "reject", rejectionReason || undefined)}
                    >
                      {isPending && <Loader2 className="mr-1.5 size-3 animate-spin" />}
                      Confirm Reject
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => setConfirmReject(false)}>
                      Cancel
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    className="bg-green-600 text-white hover:bg-green-700"
                    disabled={isPending}
                    onClick={() => onDecision(proposal.id, "approve")}
                  >
                    {isPending ? (
                      <Loader2 className="mr-1.5 size-3 animate-spin" />
                    ) : (
                      <CheckCircle className="mr-1.5 size-3" />
                    )}
                    Approve
                  </Button>
                  <Button size="sm" variant="destructive" disabled={isPending} onClick={() => setConfirmReject(true)}>
                    <XCircle className="mr-1.5 size-3" />
                    Reject
                  </Button>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

export default function CuratorPage() {
  const [filter, setFilter] = useState<FilterTab>("pending")
  const [proposals, setProposals] = useState<Proposal[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [optimisticOverrides, setOptimisticOverrides] = useState<Map<string, ProposalStatus>>(new Map())
  const [pendingIds, setPendingIds] = useState<Set<string>>(new Set())
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const data = await fetchProposals(filter)
      setProposals(data)
      setOptimisticOverrides(new Map())
      setSelectedIds(new Set())
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load proposals")
    } finally {
      setLoading(false)
    }
  }, [filter])

  useEffect(() => {
    void load()
  }, [load])

  const handleDecision = useCallback(async (id: string, decision: "approve" | "reject", rationale?: string) => {
    setOptimisticOverrides((prev) => new Map(prev).set(id, decision === "approve" ? "approved" : "rejected"))
    setPendingIds((prev) => new Set(prev).add(id))

    try {
      await submitDecision(id, decision, rationale)
    } catch (err) {
      setOptimisticOverrides((prev) => {
        const next = new Map(prev)
        next.delete(id)
        return next
      })
      setError(err instanceof Error ? err.message : "Decision failed")
    } finally {
      setPendingIds((prev) => {
        const next = new Set(prev)
        next.delete(id)
        return next
      })
    }
  }, [])

  const pendingProposals = proposals.filter((p) => {
    const effective = optimisticOverrides.get(p.id) ?? p.status
    return effective === "pending"
  })

  const handleBulkApprove = async () => {
    const toApprove = pendingProposals.filter((p) => selectedIds.size === 0 || selectedIds.has(p.id))
    await Promise.all(toApprove.map((p) => handleDecision(p.id, "approve")))
    setSelectedIds(new Set())
  }

  const visibleProposals = proposals.filter((p) => {
    if (filter === "all") return true
    const effective = optimisticOverrides.get(p.id) ?? p.status
    return effective === filter
  })

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Curator Queue</h1>
        <p className="text-muted-foreground mt-1 text-sm">
          {pendingProposals.length} proposal{pendingProposals.length !== 1 ? "s" : ""} pending review
        </p>
      </div>

      <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
        <Tabs value={filter} onValueChange={(v) => setFilter(v as FilterTab)}>
          <TabsList>
            <TabsTrigger value="all">All</TabsTrigger>
            <TabsTrigger value="pending">Pending</TabsTrigger>
            <TabsTrigger value="approved">Approved</TabsTrigger>
            <TabsTrigger value="rejected">Rejected</TabsTrigger>
          </TabsList>
        </Tabs>

        {pendingProposals.length > 1 && (
          <Button size="sm" className="bg-green-600 text-white hover:bg-green-700" onClick={handleBulkApprove}>
            <CheckCircle className="mr-1.5 size-3.5" />
            Approve All Pending ({pendingProposals.length})
          </Button>
        )}
      </div>

      {error && (
        <div className="border-destructive/30 bg-destructive/5 text-destructive rounded-lg border px-4 py-3 text-sm">
          {error}
        </div>
      )}

      {loading ? (
        <div className="space-y-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-14 w-full rounded-lg" />
          ))}
        </div>
      ) : visibleProposals.length === 0 ? (
        <div className="bg-card flex flex-col items-center justify-center gap-3 rounded-lg border py-16 text-center">
          <ClipboardList className="text-muted-foreground size-8" />
          <p className="text-muted-foreground text-sm">Queue is clear.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {visibleProposals.map((proposal) => (
            <ProposalRow
              key={proposal.id}
              proposal={proposal}
              onDecision={handleDecision}
              optimisticStatus={optimisticOverrides.get(proposal.id) ?? null}
              isPending={pendingIds.has(proposal.id)}
            />
          ))}
        </div>
      )}
    </div>
  )
}
