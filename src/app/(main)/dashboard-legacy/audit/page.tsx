"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { format, formatDistanceToNow } from "date-fns"
import {
  CalendarRange,
  ChevronDown,
  ChevronRight,
  Download,
  Filter,
  Loader2,
  RefreshCw,
  ScrollText,
} from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { DURHAM_GRADIENTS } from "@/lib/brand/durham"
import { DEFAULT_GROUP_ID } from "@/lib/defaults/scope"
import { formatGroupHeader } from "@/lib/utils/date"

const PAGE_SIZE = 50
const EXPORT_LIMIT = 10000

interface AuditEvent {
  id: number
  group_id: string
  agent_id: string
  event_type: string
  status: string
  created_at: string
  metadata: Record<string, unknown> | null
}

interface FilterOption {
  value: string
  count: number
}

function normalizeDateTime(value: string): string | null {
  if (!value) return null

  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) return null
  return parsed.toISOString()
}

function statusBadgeClass(status: string): string {
  switch (status) {
    case "completed":
      return "border-[--durham-status-success-border] bg-[--durham-status-success-bg] text-[--durham-status-success-text]"
    case "pending":
      return "border-[--durham-status-pending-border] bg-[--durham-status-pending-bg] text-[--durham-status-pending-text]"
    case "failed":
      return "border-[--durham-status-failed-border] bg-[--durham-status-failed-bg] text-[--durham-status-failed-text]"
    default:
      return "border-[--durham-status-default-border] bg-[--durham-status-default-bg] text-[--durham-status-default-text]"
  }
}

function toTitleCase(value: string): string {
  return value.replace(/[_-]+/g, " ").replace(/\b\w/g, (match) => match.toUpperCase())
}

function buildEventSummary(event: AuditEvent): string {
  const pieces: string[] = []

  if (event.agent_id) {
    pieces.push(`${event.agent_id} recorded ${toTitleCase(event.event_type).toLowerCase()}`)
  } else {
    pieces.push(toTitleCase(event.event_type))
  }

  pieces.push(`with a ${event.status.toLowerCase()} status`)

  return `${pieces.join(" ")}.`
}

function buildMetadataSummary(metadata: Record<string, unknown> | null): string {
  if (!metadata || Object.keys(metadata).length === 0) {
    return "No additional context was attached to this event."
  }

  const entries = Object.entries(metadata)
    .slice(0, 3)
    .map(([key, value]) => `${toTitleCase(key)}: ${String(value)}`)

  return entries.join(" · ")
}

export default function AuditLogPage() {
  const [events, setEvents] = useState<AuditEvent[]>([])
  const [loading, setLoading] = useState(true)
  const [exporting, setExporting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [totalCount, setTotalCount] = useState(0)
  const [hasMore, setHasMore] = useState(false)
  const [offset, setOffset] = useState(0)
  const [expandedId, setExpandedId] = useState<number | null>(null)

  const [eventType, setEventType] = useState("all")
  const [agentId, setAgentId] = useState("all")
  const [from, setFrom] = useState("")
  const [to, setTo] = useState("")
  const [eventTypes, setEventTypes] = useState<FilterOption[]>([])
  const [agents, setAgents] = useState<FilterOption[]>([])

  const activeFilterCount = useMemo(() => {
    return [eventType !== "all", agentId !== "all", Boolean(from), Boolean(to)].filter(Boolean).length
  }, [agentId, eventType, from, to])

  const groupedEvents = useMemo(() => {
    const grouped = new Map<string, AuditEvent[]>()

    for (const event of events) {
      const label = formatGroupHeader(event.created_at)
      const current = grouped.get(label) ?? []
      current.push(event)
      grouped.set(label, current)
    }

    return Array.from(grouped.entries()).map(([label, dayEvents]) => ({ label, events: dayEvents }))
  }, [events])

  const buildQueryParams = useCallback(
    (currentOffset: number, limit: number) => {
      const params = new URLSearchParams({
        group_id: DEFAULT_GROUP_ID,
        limit: String(limit),
        offset: String(currentOffset),
      })

      if (eventType !== "all") params.set("event_type", eventType)
      if (agentId !== "all") params.set("agent_id", agentId)

      const fromValue = normalizeDateTime(from)
      if (fromValue) params.set("from", fromValue)

      const toValue = normalizeDateTime(to)
      if (toValue) params.set("to", toValue)

      return params
    },
    [agentId, eventType, from, to]
  )

  const loadAuditEvents = useCallback(
    async (currentOffset: number, resetOffset: boolean) => {
      setLoading(true)
      setError(null)

      try {
        const res = await fetch(`/api/audit/events?${buildQueryParams(currentOffset, PAGE_SIZE).toString()}`)
        if (!res.ok) {
          throw new Error(`Failed to fetch audit events: ${res.status}`)
        }

        const data = (await res.json()) as {
          events?: AuditEvent[]
          pagination?: {
            total?: number
            has_more?: boolean
          }
        }

        const nextEvents = data.events ?? []
        if (resetOffset) {
          setEvents(nextEvents)
        } else {
          setEvents((previous) => [...previous, ...nextEvents])
        }

        setTotalCount(data.pagination?.total ?? nextEvents.length)
        setHasMore(data.pagination?.has_more ?? false)
        setOffset(currentOffset + PAGE_SIZE)
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load audit events")
      } finally {
        setLoading(false)
      }
    },
    [buildQueryParams]
  )

  const loadFilterOptions = useCallback(async () => {
    try {
      const params = new URLSearchParams({ group_id: DEFAULT_GROUP_ID, limit: "1000", offset: "0" })
      const res = await fetch(`/api/audit/events?${params.toString()}`)
      if (!res.ok) return

      const data = (await res.json()) as { events?: AuditEvent[] }
      const filterEvents = data.events ?? []
      const typeCounts = new Map<string, number>()
      const agentCounts = new Map<string, number>()

      for (const event of filterEvents) {
        typeCounts.set(event.event_type, (typeCounts.get(event.event_type) ?? 0) + 1)
        agentCounts.set(event.agent_id, (agentCounts.get(event.agent_id) ?? 0) + 1)
      }

      setEventTypes(
        Array.from(typeCounts.entries())
          .map(([value, count]) => ({ value, count }))
          .sort((left, right) => right.count - left.count || left.value.localeCompare(right.value))
      )

      setAgents(
        Array.from(agentCounts.entries())
          .map(([value, count]) => ({ value, count }))
          .sort((left, right) => right.count - left.count || left.value.localeCompare(right.value))
      )
    } catch {
      // Best-effort only.
    }
  }, [])

  useEffect(() => {
    void loadFilterOptions()
  }, [loadFilterOptions])

  useEffect(() => {
    setExpandedId(null)
    setOffset(0)
    void loadAuditEvents(0, true)
  }, [agentId, eventType, from, to, loadAuditEvents])

  const handleRefresh = async () => {
    setOffset(0)
    await Promise.all([loadFilterOptions(), loadAuditEvents(0, true)])
  }

  const handleExportCsv = async () => {
    setExporting(true)

    try {
      const params = buildQueryParams(0, EXPORT_LIMIT)
      params.set("format", "csv")

      const link = document.createElement("a")
      link.href = `/api/audit/events?${params.toString()}`
      link.download = `audit-events-${DEFAULT_GROUP_ID}.csv`
      document.body.appendChild(link)
      link.click()
      link.remove()
    } finally {
      setExporting(false)
    }
  }

  const handleExportJson = async () => {
    setExporting(true)

    try {
      const params = buildQueryParams(0, EXPORT_LIMIT)

      const res = await fetch(`/api/audit/events?${params.toString()}`)
      if (!res.ok) {
        setError(`Failed to export JSON: HTTP ${res.status}`)
        return
      }

      const data = await res.json()
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" })
      const url = URL.createObjectURL(blob)

      const link = document.createElement("a")
      link.href = url
      link.download = `audit-events-${DEFAULT_GROUP_ID}.json`
      document.body.appendChild(link)
      link.click()
      link.remove()
      URL.revokeObjectURL(url)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to export JSON")
    } finally {
      setExporting(false)
    }
  }

  return (
    <div className="min-h-screen" style={{ backgroundImage: DURHAM_GRADIENTS.page }}>
      <div className="space-y-6 rounded-[28px] border border-white/70 bg-white/74 p-4 shadow-[--durham-shadow-base]/8 shadow-xl backdrop-blur sm:p-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="max-w-2xl space-y-2">
            <p className="text-xs font-semibold tracking-[0.28em] text-[--durham-amber-ochre] uppercase">Audit trail</p>
            <h1 className="text-3xl font-semibold tracking-tight text-[--durham-deep-graphite]">
              A calmer view of system activity.
            </h1>
            <p className="text-sm leading-6 text-[--durham-muted-text]">
              Review append-only events for {DEFAULT_GROUP_ID} in plain language, then expand any row to inspect the raw
              JSON.
            </p>
            <p className="text-sm text-[--durham-warm-slate]">
              {totalCount} event{totalCount === 1 ? "" : "s"} in the current view.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handleRefresh}
              disabled={loading}
              className="border-[--durham-border-light] bg-white/90 text-[--durham-rich-navy] hover:bg-[--durham-hover-amber-bg]"
            >
              <RefreshCw className={`mr-1 size-3 ${loading ? "animate-spin" : ""}`} />
              Refresh
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={handleExportCsv}
              disabled={exporting || loading}
              className="border-[--durham-border-light] bg-white/90 text-[--durham-rich-navy] hover:bg-[--durham-hover-amber-bg]"
            >
              {exporting ? <Loader2 className="mr-1 size-3 animate-spin" /> : <Download className="mr-1 size-3" />}
              Export CSV
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={handleExportJson}
              disabled={exporting || loading}
              className="border-[--durham-border-light] bg-white/90 text-[--durham-rich-navy] hover:bg-[--durham-hover-amber-bg]"
            >
              {exporting ? <Loader2 className="mr-1 size-3 animate-spin" /> : <Download className="mr-1 size-3" />}
              Download JSON
            </Button>
          </div>
        </div>

        <Card className="border-[--durham-border] bg-white/85 shadow-sm">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base text-[--durham-deep-graphite]">
              <ScrollText className="size-4 text-[--durham-amber-ochre]" />
              Narrow the view
            </CardTitle>
            <CardDescription className="text-[--durham-muted-text]">
              Filters only change what you see here. Export still respects the current selection.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-wrap items-center gap-2 text-sm text-[--durham-muted-text]">
              <Filter className="size-4 text-[--durham-steel-blue]" />
              <span>
                {activeFilterCount === 0
                  ? "No active filters"
                  : `${activeFilterCount} active filter${activeFilterCount === 1 ? "" : "s"}`}
              </span>
            </div>

            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
              <Select value={eventType} onValueChange={setEventType}>
                <SelectTrigger className="border-[--durham-border-light] bg-white">
                  <SelectValue placeholder="Event type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All event types</SelectItem>
                  {eventTypes.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.value} ({option.count})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Select value={agentId} onValueChange={setAgentId}>
                <SelectTrigger className="border-[--durham-border-light] bg-white">
                  <SelectValue placeholder="Agent" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All agents</SelectItem>
                  {agents.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.value} ({option.count})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Input
                type="datetime-local"
                value={from}
                onChange={(event) => setFrom(event.target.value)}
                aria-label="From time"
                className="border-[--durham-border-light] bg-white"
              />
              <Input
                type="datetime-local"
                value={to}
                onChange={(event) => setTo(event.target.value)}
                aria-label="To time"
                className="border-[--durham-border-light] bg-white"
              />
            </div>

            {activeFilterCount > 0 && (
              <div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setEventType("all")
                    setAgentId("all")
                    setFrom("")
                    setTo("")
                  }}
                  className="text-[--durham-rich-navy] hover:bg-[--durham-hover-amber-bg]"
                >
                  Clear filters
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

        {error && <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">{error}</div>}

        {!loading && events.length === 0 && (
          <Card className="border-[--durham-border] bg-white/80 p-6 text-center shadow-sm">
            <p className="text-sm text-[--durham-muted-text]">No audit events matched the current filters.</p>
          </Card>
        )}

        <div className="space-y-6">
          {groupedEvents.map((group) => (
            <section key={group.label} className="space-y-3">
              <div className="flex items-center gap-3">
                <div className="flex size-9 items-center justify-center rounded-full bg-[--durham-hover-amber-bg] text-[--durham-rich-navy]">
                  <CalendarRange className="size-4" />
                </div>
                <div>
                  <h2 className="text-base font-semibold text-[--durham-deep-graphite]">{group.label}</h2>
                  <p className="text-sm text-[--durham-muted-text]">
                    {group.events.length} event{group.events.length === 1 ? "" : "s"}
                  </p>
                </div>
              </div>

              <div className="space-y-3">
                {group.events.map((event) => {
                  const expanded = expandedId === event.id

                  return (
                    <Card key={event.id} className="border-[--durham-border] bg-white/88 shadow-sm">
                      <button
                        type="button"
                        className="w-full p-5 text-left"
                        onClick={() => setExpandedId(expanded ? null : event.id)}
                      >
                        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                          <div className="space-y-3">
                            <div className="flex flex-wrap items-center gap-2">
                              <Badge
                                variant="outline"
                                className="border-[--durham-border] bg-white font-normal text-[--durham-warm-slate]"
                              >
                                {toTitleCase(event.event_type)}
                              </Badge>
                              <Badge className={statusBadgeClass(event.status)}>{toTitleCase(event.status)}</Badge>
                              <span className="text-sm text-[--durham-muted-text]">
                                {formatDistanceToNow(new Date(event.created_at), { addSuffix: true })}
                              </span>
                            </div>

                            <div>
                              <p className="text-base font-medium text-[--durham-deep-graphite]">
                                {buildEventSummary(event)}
                              </p>
                              <p className="mt-2 text-sm leading-6 text-[--durham-muted-text]">
                                {buildMetadataSummary(event.metadata)}
                              </p>
                            </div>

                            <div className="flex flex-wrap gap-4 text-sm text-[--durham-muted-text]">
                              <span>{format(new Date(event.created_at), "PPP p")}</span>
                              <span>Agent: {event.agent_id}</span>
                              <span>Event #{event.id}</span>
                            </div>
                          </div>

                          <div className="flex items-center gap-2 text-sm font-medium text-[--durham-rich-navy]">
                            <span>{expanded ? "Hide raw event" : "Inspect raw event"}</span>
                            {expanded ? <ChevronDown className="size-4" /> : <ChevronRight className="size-4" />}
                          </div>
                        </div>
                      </button>

                      {expanded && (
                        <div className="border-t border-[--durham-inner-border] px-5 pb-5">
                          <div className="rounded-2xl bg-[--durham-raw-bg] p-4 text-xs text-[--durham-raw-text]">
                            <pre className="overflow-auto whitespace-pre-wrap">{JSON.stringify(event, null, 2)}</pre>
                          </div>
                        </div>
                      )}
                    </Card>
                  )
                })}
              </div>
            </section>
          ))}
        </div>

        {loading && (
          <div className="flex items-center justify-center py-8 text-sm text-[--durham-muted-text]">
            <Loader2 className="mr-2 size-5 animate-spin" />
            Loading audit events…
          </div>
        )}

        {hasMore && !loading && (
          <div className="flex justify-center">
            <Button
              variant="outline"
              onClick={() => void loadAuditEvents(offset, false)}
              className="border-[--durham-border-light] bg-white text-[--durham-rich-navy] hover:bg-[--durham-hover-amber-bg]"
            >
              Load more
            </Button>
          </div>
        )}
      </div>
    </div>
  )
}
