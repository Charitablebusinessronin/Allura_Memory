"use client"

import { useState, useEffect, useCallback } from "react"
import { formatDistanceToNow } from "date-fns"
import { ChevronDown, ChevronRight, Loader2, Lightbulb, RefreshCw, Filter, ArrowUpDown, History } from "lucide-react"

import { APP_CONFIG } from "@/config/app-config"
import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Progress } from "@/components/ui/progress"

const DEFAULT_GROUP_ID = APP_CONFIG.defaultGroupId

type InsightStatus = "active" | "superseded" | "deprecated" | "reverted"

interface InsightRecord {
  id: string
  insight_id: string
  version: number
  content: string
  confidence: number
  group_id: string
  source_type: string
  source_ref: string | null
  created_at: string
  created_by: string | null
  status: string
  metadata: Record<string, unknown>
}

interface VersionHistoryEntry {
  insight: InsightRecord
  superseded_by: InsightRecord | null
  supersedes: InsightRecord | null
}

export default function InsightsPage() {
  const [insights, setInsights] = useState<InsightRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [totalCount, setTotalCount] = useState(0)
  const [hasMore, setHasMore] = useState(false)
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [versionHistory, setVersionHistory] = useState<VersionHistoryEntry[] | null>(null)
  const [historyLoading, setHistoryLoading] = useState(false)

  // Filters
  const [status, setStatus] = useState<string>("active")
  const [sourceType, setSourceType] = useState<string>("all")
  const [confidence, setConfidence] = useState<string>("all")
  const [limit, setLimit] = useState(50)
  const [offset, setOffset] = useState(0)

  const loadInsights = useCallback(async () => {
    setLoading(true)
    setError(null)

    try {
      const params = new URLSearchParams({
        group_id: DEFAULT_GROUP_ID,
        limit: String(limit),
        offset: String(offset),
      })
      if (status && status !== "all") {
        params.set("status", status)
      }
      if (sourceType && sourceType !== "all") {
        params.set("source_type", sourceType)
      }
      if (confidence === "high") {
        params.set("min_confidence", "0.85")
      } else if (confidence === "medium") {
        params.set("min_confidence", "0.6")
        params.set("max_confidence", "0.85")
      } else if (confidence === "low") {
        params.set("max_confidence", "0.6")
      }

      const res = await fetch(`/api/memory/insights?${params.toString()}`)
      if (!res.ok) {
        throw new Error(`Failed to fetch insights: ${res.status}`)
      }
      const data = await res.json()
      if (offset === 0) {
        setInsights(data.insights ?? [])
      } else {
        setInsights((prev) => [...prev, ...(data.insights ?? [])])
      }
      setTotalCount(data.total ?? 0)
      setHasMore(data.has_more ?? false)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error")
    } finally {
      setLoading(false)
    }
  }, [status, sourceType, confidence, limit, offset])

  const loadVersionHistory = useCallback(async (insightId: string) => {
    setHistoryLoading(true)
    try {
      const res = await fetch(
        `/api/memory/insights/${encodeURIComponent(insightId)}/history?group_id=${DEFAULT_GROUP_ID}`
      )
      if (!res.ok) {
        setVersionHistory(null)
        return
      }
      const data = await res.json()
      setVersionHistory(data.history ?? [])
    } catch {
      setVersionHistory(null)
    } finally {
      setHistoryLoading(false)
    }
  }, [])

  // Reload when filters change
  useEffect(() => {
    setOffset(0)
    setLoading(true)
    loadInsights()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status, sourceType, confidence, limit])

  // Load version history when an insight is expanded
  useEffect(() => {
    if (expandedId) {
      const insight = insights.find((i) => i.id === expandedId)
      if (insight) {
        loadVersionHistory(insight.insight_id)
      }
    } else {
      setVersionHistory(null)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [expandedId])

  const statusColor = (s: string) => {
    switch (s) {
      case "active":
        return "border-green-500/20 bg-green-500/10 text-green-600 dark:text-green-400"
      case "superseded":
        return "border-blue-500/20 bg-blue-500/10 text-blue-600 dark:text-blue-400"
      case "deprecated":
        return "border-yellow-500/20 bg-yellow-500/10 text-yellow-600 dark:text-yellow-400"
      case "reverted":
        return "border-red-500/20 bg-red-500/10 text-red-600 dark:text-red-400"
      default:
        return ""
    }
  }

  const confidenceLabel = (c: number) => {
    if (c >= 0.85) return "High"
    if (c >= 0.6) return "Medium"
    return "Low"
  }

  const confidenceColor = (c: number) => {
    if (c >= 0.85) return "text-green-600 dark:text-green-400"
    if (c >= 0.6) return "text-yellow-600 dark:text-yellow-400"
    return "text-red-600 dark:text-red-400"
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Insights</h1>
          <p className="text-muted-foreground mt-1 text-sm">
            Knowledge graph insights for {DEFAULT_GROUP_ID} — {totalCount} {status === "all" ? "total" : status}
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => {
            setOffset(0)
            loadInsights()
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
        <Select value={status} onValueChange={setStatus}>
          <SelectTrigger className="w-[160px]">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Statuses</SelectItem>
            <SelectItem value="active">Active</SelectItem>
            <SelectItem value="superseded">Superseded</SelectItem>
            <SelectItem value="deprecated">Deprecated</SelectItem>
            <SelectItem value="reverted">Reverted</SelectItem>
          </SelectContent>
        </Select>

        <Select value={sourceType} onValueChange={setSourceType}>
          <SelectTrigger className="w-[140px]">
            <SelectValue placeholder="Source" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Sources</SelectItem>
            <SelectItem value="trace">Trace</SelectItem>
            <SelectItem value="manual">Manual</SelectItem>
            <SelectItem value="promotion">Promotion</SelectItem>
            <SelectItem value="import">Import</SelectItem>
          </SelectContent>
        </Select>

        <Select value={confidence} onValueChange={setConfidence}>
          <SelectTrigger className="w-[160px]">
            <SelectValue placeholder="Confidence" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Confidence</SelectItem>
            <SelectItem value="high">High (≥ 85%)</SelectItem>
            <SelectItem value="medium">Medium (60-85%)</SelectItem>
            <SelectItem value="low">Low (&lt; 60%)</SelectItem>
          </SelectContent>
        </Select>

        {(status !== "active" || sourceType !== "all" || confidence !== "all") && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              setStatus("active")
              setSourceType("all")
              setConfidence("all")
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

      {/* Desktop: table view */}
      <div className="hidden sm:block">
        <div className="rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[40px]" />
                <TableHead>Insight ID</TableHead>
                <TableHead>Content</TableHead>
                <TableHead>Confidence</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Source</TableHead>
                <TableHead>Version</TableHead>
                <TableHead>Time</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {insights.length === 0 && !loading && (
                <TableRow>
                  <TableCell colSpan={8} className="text-muted-foreground py-8 text-center">
                    No insights found
                  </TableCell>
                </TableRow>
              )}
              {insights.map((insight) => (
                <TableRow
                  key={insight.id}
                  className="cursor-pointer"
                  onClick={() => setExpandedId(expandedId === insight.id ? null : insight.id)}
                >
                  <TableCell>
                    {expandedId === insight.id ? (
                      <ChevronDown className="size-4" />
                    ) : (
                      <ChevronRight className="size-4" />
                    )}
                  </TableCell>
                  <TableCell className="font-mono text-xs">{insight.insight_id.slice(0, 12)}...</TableCell>
                  <TableCell className="max-w-[300px] truncate text-sm">{insight.content}</TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <Progress value={insight.confidence * 100} className="h-2 w-16" />
                      <span className={`text-xs font-medium ${confidenceColor(insight.confidence)}`}>
                        {(insight.confidence * 100).toFixed(0)}%
                      </span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge className={statusColor(insight.status)}>{insight.status}</Badge>
                  </TableCell>
                  <TableCell className="text-muted-foreground text-sm">{insight.source_type}</TableCell>
                  <TableCell className="text-sm">v{insight.version}</TableCell>
                  <TableCell className="text-muted-foreground text-sm">
                    {formatDistanceToNow(new Date(insight.created_at), {
                      addSuffix: true,
                    })}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </div>

      {/* Mobile: card list */}
      <div className="space-y-3 sm:hidden">
        {insights.length === 0 && !loading && (
          <Card className="p-4 text-center">
            <p className="text-muted-foreground text-sm">No insights found</p>
          </Card>
        )}
        {insights.map((insight) => (
          <Card
            key={insight.id}
            className="cursor-pointer p-4"
            onClick={() => setExpandedId(expandedId === insight.id ? null : insight.id)}
          >
            <p className="line-clamp-3 text-sm leading-relaxed">{insight.content}</p>
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <Badge className={statusColor(insight.status)}>{insight.status}</Badge>
              <Badge variant="outline" className="text-xs">
                {(insight.confidence * 100).toFixed(0)}% {confidenceLabel(insight.confidence)}
              </Badge>
              <Badge variant="outline" className="text-xs">
                {insight.source_type}
              </Badge>
            </div>
            <p className="text-muted-foreground mt-2 text-xs">
              {formatDistanceToNow(new Date(insight.created_at), { addSuffix: true })}
            </p>
          </Card>
        ))}
      </div>

      {/* Expanded detail panel with version history timeline */}
      {expandedId &&
        (() => {
          const insight = insights.find((i) => i.id === expandedId)
          if (!insight) return null
          return (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">
                  Insight Detail — {insight.insight_id} (v{insight.version})
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <p className="text-muted-foreground mb-1 text-xs font-medium uppercase">Content</p>
                  <p className="text-sm leading-relaxed">{insight.content}</p>
                </div>
                <div>
                  <p className="text-muted-foreground mb-1 text-xs font-medium uppercase">Confidence</p>
                  <div className="flex items-center gap-2">
                    <Progress value={insight.confidence * 100} className="h-3 w-32" />
                    <span className={`text-sm font-medium ${confidenceColor(insight.confidence)}`}>
                      {(insight.confidence * 100).toFixed(1)}% ({confidenceLabel(insight.confidence)})
                    </span>
                  </div>
                </div>

                {/* Version history timeline */}
                <div>
                  <p className="text-muted-foreground mb-2 flex items-center gap-1 text-xs font-medium uppercase">
                    <History className="size-3" />
                    Version History ({insight.version} version
                    {insight.version !== 1 ? "s" : ""})
                  </p>
                  {historyLoading ? (
                    <div className="flex items-center gap-2 py-2">
                      <Loader2 className="text-muted-foreground size-4 animate-spin" />
                      <span className="text-muted-foreground text-sm">Loading history...</span>
                    </div>
                  ) : versionHistory && versionHistory.length > 0 ? (
                    <div className="space-y-0">
                      {versionHistory.map((entry, idx) => (
                        <div key={entry.insight.id} className="flex items-start gap-3 pb-2">
                          {/* Timeline dot and line */}
                          <div className="flex flex-col items-center">
                            <div
                              className={`size-3 rounded-full border-2 ${
                                entry.insight.status === "active"
                                  ? "border-green-500 bg-green-500"
                                  : entry.insight.status === "superseded"
                                    ? "border-blue-500 bg-blue-500"
                                    : entry.insight.status === "deprecated"
                                      ? "border-yellow-500 bg-yellow-500"
                                      : "border-red-500 bg-red-500"
                              }`}
                            />
                            {idx < versionHistory.length - 1 && <div className="bg-border w-px flex-1" />}
                          </div>
                          {/* Version content */}
                          <div className="min-w-0 flex-1 pb-2">
                            <div className="flex items-center gap-2">
                              <span className="text-xs font-semibold">v{entry.insight.version}</span>
                              <Badge variant="outline" className={`text-[10px] ${statusColor(entry.insight.status)}`}>
                                {entry.insight.status}
                              </Badge>
                              <span className="text-muted-foreground text-[10px]">
                                {(entry.insight.confidence * 100).toFixed(0)}% confidence
                              </span>
                              {entry.insight.created_at && (
                                <span className="text-muted-foreground text-[10px]">
                                  {formatDistanceToNow(new Date(entry.insight.created_at), {
                                    addSuffix: true,
                                  })}
                                </span>
                              )}
                            </div>
                            {entry.insight.content !== insight.content && (
                              <p className="text-muted-foreground mt-0.5 truncate text-xs">{entry.insight.content}</p>
                            )}
                            {entry.supersedes && (
                              <span className="text-muted-foreground text-[10px]">
                                ← supersedes v{entry.supersedes.version}
                              </span>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-muted-foreground text-sm">Single version — no SUPERSEDES chain.</p>
                  )}
                </div>

                {/* Full metadata */}
                <div>
                  <p className="text-muted-foreground mb-1 text-xs font-medium uppercase">Full Metadata</p>
                  <pre className="bg-muted overflow-auto rounded-md p-3 text-xs">
                    {JSON.stringify(insight, null, 2)}
                  </pre>
                </div>
              </CardContent>
            </Card>
          )
        })()}

      {/* Loading */}
      {loading && (
        <div className="flex items-center justify-center py-8">
          <Loader2 className="text-muted-foreground mr-2 size-5 animate-spin" />
          <span className="text-muted-foreground text-sm">Loading insights...</span>
        </div>
      )}

      {/* Load more */}
      {hasMore && !loading && (
        <div className="flex justify-center">
          <Button
            variant="outline"
            onClick={() => {
              setOffset((prev) => prev + limit)
            }}
          >
            Load more
          </Button>
        </div>
      )}

      {/* Empty state with no Neo4j data */}
      {!loading && insights.length === 0 && status === "active" && (
        <Card>
          <CardContent className="py-8 text-center">
            <Lightbulb className="text-muted-foreground mx-auto mb-3 size-8" />
            <p className="text-sm font-medium">No active insights yet</p>
            <p className="text-muted-foreground mt-1 text-xs">
              Insights are created when curators approve proposals from the{" "}
              <a href="/dashboard/curator" className="hover:text-foreground underline underline-offset-2">
                Curator Queue
              </a>
              . They represent knowledge that has been validated and promoted to the Neo4j knowledge graph.
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
