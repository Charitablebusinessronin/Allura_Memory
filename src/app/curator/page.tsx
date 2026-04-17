/**
 * Curator Dashboard
 *
 * Governance workflow for memory promotion.
 * Three tabs: Traces (raw), Approved (knowledge), Pending (decisions).
 *
 * Reference: docs/allura/BLUEPRINT.md (Requirements B16-B19, F10-F19)
 *
 * Tab 1 (Traces): Raw PostgreSQL events (admin only)
 * Tab 2 (Approved): All approved knowledge (human + auto-promoted)
 * Tab 3 (Pending): Proposals awaiting human review
 */

"use client"

import { useState, useEffect } from "react"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Separator } from "@/components/ui/separator"
import { Textarea } from "@/components/ui/textarea"
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

export default function CuratorDashboardPage() {
  const [activeTab, setActiveTab] = useState("pending")
  const [groupId, setGroupId] = useState("allura-default")
  const [traces, setTraces] = useState<Trace[]>([])
  const [insights, setInsights] = useState<Insight[]>([])
  const [proposals, setProposals] = useState<Proposal[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [selectedProposal, setSelectedProposal] = useState<Proposal | null>(null)
  const [rationale, setRationale] = useState("")

  // Fetch traces (admin only)
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

  // Fetch approved insights
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

  // Fetch pending proposals
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

  // Approve proposal
  const approveProposal = async (proposal: Proposal) => {
    try {
      const response = await fetch("/api/curator/approve", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          proposal_id: proposal.id,
          group_id: groupId,
          decision: "approve",
          curator_id: "curator-user", // TODO: Get from auth
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

  // Reject proposal
  const rejectProposal = async (proposal: Proposal) => {
    try {
      const response = await fetch("/api/curator/approve", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          proposal_id: proposal.id,
          group_id: groupId,
          decision: "reject",
          curator_id: "curator-user", // TODO: Get from auth
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

  // Fetch data on tab change
  useEffect(() => {
    if (activeTab === "traces") fetchTraces()
    else if (activeTab === "insights") fetchInsights()
    else if (activeTab === "pending") fetchProposals()
  }, [activeTab, groupId])

  // Format relative time
  const formatRelativeTime = (dateString: string) => {
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

  // Get confidence badge color
  const getConfidenceBadge = (score: number) => {
    if (score >= 0.85) return <Badge className="bg-green-500">High ({(score * 100).toFixed(0)}%)</Badge>
    if (score >= 0.7) return <Badge className="bg-yellow-500">Medium ({(score * 100).toFixed(0)}%)</Badge>
    return <Badge className="bg-red-500">Low ({(score * 100).toFixed(0)}%)</Badge>
  }

  return (
    <div className="container mx-auto max-w-7xl p-6">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Curator Dashboard</h1>
          <p className="text-muted-foreground">Human-in-the-loop governance for memory promotion</p>
        </div>
        <div className="flex items-center gap-4">
          <Input placeholder="group_id" value={groupId} onChange={(e) => setGroupId(e.target.value)} className="w-48" />
          <Button
            onClick={() => {
              if (activeTab === "traces") fetchTraces()
              else if (activeTab === "insights") fetchInsights()
              else if (activeTab === "pending") fetchProposals()
            }}
          >
            Refresh
          </Button>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="pending">Pending ({proposals.length})</TabsTrigger>
          <TabsTrigger value="insights">Approved</TabsTrigger>
          <TabsTrigger value="traces">Traces (Admin)</TabsTrigger>
        </TabsList>

        {/* Pending Tab */}
        <TabsContent value="pending">
          <Card>
            <CardHeader>
              <CardTitle>Pending Proposals</CardTitle>
              <CardDescription>
                Memories awaiting human review before promotion to knowledge graph. Sorted by confidence (descending).
              </CardDescription>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="text-muted-foreground py-8 text-center">Loading...</div>
              ) : proposals.length === 0 ? (
                <div className="text-muted-foreground py-8 text-center">
                  No pending proposals. High-confidence memories are auto-promoted in auto mode.
                </div>
              ) : (
                <ScrollArea className="h-[600px]">
                  <div className="space-y-4">
                    {proposals.map((proposal) => (
                      <Card key={proposal.id} className={selectedProposal?.id === proposal.id ? "border-primary" : ""}>
                        <CardContent className="p-4">
                          <div className="mb-2 flex items-start justify-between">
                            <div className="flex-1">
                              <p className="text-sm">{proposal.content}</p>
                            </div>
                            {getConfidenceBadge(proposal.score)}
                          </div>
                          <div className="text-muted-foreground mb-3 flex items-center gap-2 text-xs">
                            <Badge variant="outline">{proposal.tier}</Badge>
                            <span>·</span>
                            <span>{formatRelativeTime(proposal.created_at)}</span>
                            <span>·</span>
                            <span>{proposal.group_id}</span>
                          </div>
                          <p className="text-muted-foreground mb-3 text-xs">{proposal.reasoning}</p>
                          {selectedProposal?.id === proposal.id && (
                            <>
                              <Separator className="my-3" />
                              <div className="space-y-3">
                                <Textarea
                                  placeholder="Rationale for decision (optional)"
                                  value={rationale}
                                  onChange={(e) => setRationale(e.target.value)}
                                  className="min-h-[60px]"
                                />
                                <div className="flex gap-2">
                                  <Button variant="default" onClick={() => approveProposal(proposal)}>
                                    Approve
                                  </Button>
                                  <Button variant="destructive" onClick={() => rejectProposal(proposal)}>
                                    Reject
                                  </Button>
                                  <Button
                                    variant="ghost"
                                    onClick={() => {
                                      setSelectedProposal(null)
                                      setRationale("")
                                    }}
                                  >
                                    Cancel
                                  </Button>
                                </div>
                              </div>
                            </>
                          )}
                          {selectedProposal?.id !== proposal.id && (
                            <Button variant="outline" size="sm" onClick={() => setSelectedProposal(proposal)}>
                              Review
                            </Button>
                          )}
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                </ScrollArea>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Approved Tab */}
        <TabsContent value="insights">
          <Card>
            <CardHeader>
              <CardTitle>Approved Knowledge</CardTitle>
              <CardDescription>All approved memories (human + auto-promoted).</CardDescription>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="text-muted-foreground py-8 text-center">Loading...</div>
              ) : insights.length === 0 ? (
                <div className="text-muted-foreground py-8 text-center">No approved knowledge yet.</div>
              ) : (
                <ScrollArea className="h-[600px]">
                  <div className="space-y-2">
                    {insights.map((insight) => (
                      <Card key={insight.id}>
                        <CardContent className="p-4">
                          <p className="mb-2 text-sm">{insight.content}</p>
                          <div className="text-muted-foreground flex items-center gap-2 text-xs">
                            <span>{formatRelativeTime(insight.created_at)}</span>
                            <span>·</span>
                            <span>{insight.provenance}</span>
                            {insight.promoted_by && (
                              <>
                                <span>·</span>
                                <span>Promoted by {insight.promoted_by}</span>
                              </>
                            )}
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                </ScrollArea>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Traces Tab (Admin Only) */}
        <TabsContent value="traces">
          <Card>
            <CardHeader>
              <CardTitle>Raw Traces (Admin)</CardTitle>
              <CardDescription>PostgreSQL event log. Append-only audit trail.</CardDescription>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="text-muted-foreground py-8 text-center">Loading...</div>
              ) : traces.length === 0 ? (
                <div className="text-muted-foreground py-8 text-center">No traces found.</div>
              ) : (
                <ScrollArea className="h-[600px]">
                  <div className="space-y-2">
                    {traces.map((trace) => (
                      <Card key={trace.id}>
                        <CardContent className="p-4">
                          <div className="mb-2 flex items-start justify-between">
                            <Badge variant="outline">{trace.event_type}</Badge>
                            <span className="text-muted-foreground text-xs">
                              {formatRelativeTime(trace.created_at)}
                            </span>
                          </div>
                          <pre className="bg-muted overflow-x-auto rounded p-2 text-xs">
                            {JSON.stringify(trace.metadata, null, 2)}
                          </pre>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                </ScrollArea>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
