"use client"

import { useState, useEffect, useCallback } from "react"
import { formatDistanceToNow } from "date-fns"
import { ChevronDown, ChevronRight, Loader2, Lightbulb, RefreshCw, Filter, ArrowUpDown } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Progress } from "@/components/ui/progress"

const DEFAULT_GROUP_ID = "allura-roninmemory"

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

export default function InsightsPage() {
  const [insights, setInsights] = useState<InsightRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [totalCount, setTotalCount] = useState(0)
  const [expandedId, setExpandedId] = useState<string | null>(null)

  // Filters
  const [status, setStatus] = useState<string>("active")
  const [limit, setLimit] = useState(50)

  const loadInsights = useCallback(async () => {
    setLoading(true)
    setError(null)

    try {
      const params = new URLSearchParams({
        group_id: DEFAULT_GROUP_ID,
        limit: String(limit),
      })
      if (status && status !== "all") {
        params.set("status", status)
      }

      const res = await fetch(`/api/memory/insights?${params.toString()}`)
      if (!res.ok) {
        throw new Error(`Failed to fetch insights: ${res.status}`)
      }
      const data = await res.json()
      setInsights(data.insights ?? [])
      setTotalCount(data.total ?? 0)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error")
    } finally {
      setLoading(false)
    }
  }, [status, limit])

  useEffect(() => {
    loadInsights()
  }, [loadInsights])

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
        <Button variant="outline" size="sm" onClick={loadInsights} disabled={loading}>
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

        <Select value={String(limit)} onValueChange={(v) => setLimit(Number(v))}>
          <SelectTrigger className="w-[120px]">
            <SelectValue placeholder="Limit" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="25">25</SelectItem>
            <SelectItem value="50">50</SelectItem>
            <SelectItem value="100">100</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Error state */}
      {error && (
        <div className="rounded-lg border border-red-500/30 bg-red-500/5 p-4 text-sm text-red-600 dark:text-red-400">
          {error}
        </div>
      )}

      {/* Insights table */}
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
                  {expandedId === insight.id ? <ChevronDown className="size-4" /> : <ChevronRight className="size-4" />}
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

      {/* Expanded detail panel */}
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
              <CardContent className="space-y-3">
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
