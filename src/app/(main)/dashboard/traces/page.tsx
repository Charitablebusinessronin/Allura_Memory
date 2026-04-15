"use client"

import { useState, useEffect, useCallback } from "react"
import { formatDistanceToNow } from "date-fns"
import { ChevronDown, ChevronRight, Search, Loader2, ListChecks, Filter, RefreshCw } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"

import { APP_CONFIG } from "@/config/app-config"

const DEFAULT_GROUP_ID = APP_CONFIG.defaultGroupId

interface TraceEvent {
  id: string
  group_id: string
  event_type: string
  agent_id: string
  workflow_id: string | null
  status: string
  metadata: Record<string, unknown>
  created_at: string
}

interface EventTypeOption {
  event_type: string
  count: number
}

interface AgentOption {
  agent_id: string
  count: number
}

export default function TracesPage() {
  const [traces, setTraces] = useState<TraceEvent[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [totalCount, setTotalCount] = useState(0)
  const [hasMore, setHasMore] = useState(false)
  const [offset, setOffset] = useState(0)
  const [expandedId, setExpandedId] = useState<string | null>(null)

  // Filters
  const [eventType, setEventType] = useState<string>("all")
  const [agentId, setAgentId] = useState<string>("all")
  const [eventTypes, setEventTypes] = useState<EventTypeOption[]>([])
  const [agents, setAgents] = useState<AgentOption[]>([])

  const LIMIT = 50

  const loadTraces = useCallback(
    async (resetOffset = false) => {
      setLoading(true)
      setError(null)
      const currentOffset = resetOffset ? 0 : offset

      try {
        const params = new URLSearchParams({
          group_id: DEFAULT_GROUP_ID,
          limit: String(LIMIT),
          offset: String(currentOffset),
        })
        if (eventType && eventType !== "all") {
          params.set("event_type", eventType)
        }
        if (agentId && agentId !== "all") {
          params.set("agent_id", agentId)
        }

        const res = await fetch(`/api/audit/events?${params.toString()}`)
        if (!res.ok) {
          throw new Error(`Failed to fetch traces: ${res.status}`)
        }
        const data = await res.json()
        const events = data.events ?? []
        const pagination = data.pagination ?? {}

        if (resetOffset) {
          setTraces(events)
        } else {
          setTraces((prev) => [...prev, ...events])
        }
        setTotalCount(pagination.total ?? events.length)
        setHasMore(pagination.has_more ?? false)
        setOffset(currentOffset + LIMIT)
      } catch (err) {
        setError(err instanceof Error ? err.message : "Unknown error")
      } finally {
        setLoading(false)
      }
    },
    [offset, eventType, agentId]
  )

  const loadFilters = useCallback(async () => {
    try {
      const baseParams = `group_id=${DEFAULT_GROUP_ID}&limit=1000`
      const res = await fetch(`/api/audit/events?${baseParams}`)
      if (!res.ok) return
      const data = await res.json()
      const events: TraceEvent[] = data.events ?? []

      // Build filter options from data
      const typeCounts = new Map<string, number>()
      const agentCounts = new Map<string, number>()
      for (const event of events) {
        typeCounts.set(event.event_type, (typeCounts.get(event.event_type) ?? 0) + 1)
        agentCounts.set(event.agent_id, (agentCounts.get(event.agent_id) ?? 0) + 1)
      }
      setEventTypes(
        Array.from(typeCounts.entries())
          .map(([event_type, count]) => ({ event_type, count }))
          .sort((a, b) => b.count - a.count)
      )
      setAgents(
        Array.from(agentCounts.entries())
          .map(([agent_id, count]) => ({ agent_id, count }))
          .sort((a, b) => b.count - a.count)
      )
    } catch {
      // Silently fail — filters are best-effort
    }
  }, [])

  useEffect(() => {
    loadFilters()
    loadTraces(true)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    loadTraces(true)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [eventType, agentId])

  const statusColor = (status: string) => {
    switch (status) {
      case "completed":
        return "border-green-500/20 bg-green-500/10 text-green-600 dark:text-green-400"
      case "pending":
        return "border-yellow-500/20 bg-yellow-500/10 text-yellow-600 dark:text-yellow-400"
      case "failed":
        return "border-red-500/20 bg-red-500/10 text-red-600 dark:text-red-400"
      default:
        return ""
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Traces</h1>
          <p className="text-muted-foreground mt-1 text-sm">
            Audit event trail for {DEFAULT_GROUP_ID} — {totalCount} events
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => {
            loadFilters()
            loadTraces(true)
          }}
          disabled={loading}
        >
          <RefreshCw className={`mr-1 size-3 ${loading ? "animate-spin" : ""}`} />
          Refresh
        </Button>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <Filter className="text-muted-foreground size-4" />
        <Select value={eventType} onValueChange={setEventType}>
          <SelectTrigger className="w-[220px]">
            <SelectValue placeholder="Event Type" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Types</SelectItem>
            {eventTypes.map((et) => (
              <SelectItem key={et.event_type} value={et.event_type}>
                {et.event_type} ({et.count})
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={agentId} onValueChange={setAgentId}>
          <SelectTrigger className="w-[200px]">
            <SelectValue placeholder="Agent" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Agents</SelectItem>
            {agents.map((a) => (
              <SelectItem key={a.agent_id} value={a.agent_id}>
                {a.agent_id} ({a.count})
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {(eventType !== "all" || agentId !== "all") && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              setEventType("all")
              setAgentId("all")
            }}
          >
            Clear filters
          </Button>
        )}
      </div>

      {/* Error state */}
      {error && (
        <div className="rounded-lg border border-red-500/30 bg-red-500/5 p-4 text-sm text-red-600 dark:text-red-400">
          {error}
        </div>
      )}

      {/* Table */}
      <div className="rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[40px]" />
              <TableHead>Type</TableHead>
              <TableHead>Agent</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Time</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {traces.length === 0 && !loading && (
              <TableRow>
                <TableCell colSpan={5} className="text-muted-foreground py-8 text-center">
                  No trace events found
                </TableCell>
              </TableRow>
            )}
            {traces.map((trace) => (
              <TableRow
                key={trace.id}
                className="cursor-pointer"
                onClick={() => setExpandedId(expandedId === trace.id ? null : trace.id)}
              >
                <TableCell>
                  {expandedId === trace.id ? <ChevronDown className="size-4" /> : <ChevronRight className="size-4" />}
                </TableCell>
                <TableCell>
                  <Badge variant="outline" className="font-mono text-xs">
                    {trace.event_type}
                  </Badge>
                </TableCell>
                <TableCell className="font-mono text-sm">{trace.agent_id}</TableCell>
                <TableCell>
                  <Badge className={statusColor(trace.status)}>{trace.status}</Badge>
                </TableCell>
                <TableCell className="text-muted-foreground text-sm">
                  {formatDistanceToNow(new Date(trace.created_at), {
                    addSuffix: true,
                  })}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {/* Expanded metadata panel */}
      {expandedId &&
        (() => {
          const trace = traces.find((t) => t.id === expandedId)
          if (!trace) return null
          return (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">Event Metadata — {trace.event_type}</CardTitle>
              </CardHeader>
              <CardContent>
                <pre className="bg-muted overflow-auto rounded-md p-3 text-xs">
                  {JSON.stringify(
                    {
                      id: trace.id,
                      group_id: trace.group_id,
                      event_type: trace.event_type,
                      agent_id: trace.agent_id,
                      workflow_id: trace.workflow_id,
                      status: trace.status,
                      created_at: trace.created_at,
                      metadata: trace.metadata,
                    },
                    null,
                    2
                  )}
                </pre>
              </CardContent>
            </Card>
          )
        })()}

      {/* Loading */}
      {loading && (
        <div className="flex items-center justify-center py-8">
          <Loader2 className="text-muted-foreground mr-2 size-5 animate-spin" />
          <span className="text-muted-foreground text-sm">Loading traces...</span>
        </div>
      )}

      {/* Load more */}
      {hasMore && !loading && (
        <div className="flex justify-center">
          <Button variant="outline" onClick={() => loadTraces(false)}>
            Load more
          </Button>
        </div>
      )}
    </div>
  )
}
