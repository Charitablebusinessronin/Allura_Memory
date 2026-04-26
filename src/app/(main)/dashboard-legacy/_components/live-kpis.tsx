"use client"

import { useEffect, useRef, useState } from "react"
import Link from "next/link"
import { Activity, AlertTriangle, CheckCircle, MinusCircle, XCircle } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import type { HealthResponse } from "@/app/api/health/route"
import type { SnapshotPayload } from "@/app/api/stream/route"

export interface LiveKPIsProps {
  initialHealth: HealthResponse | null
  initialTotalMemories: number
  initialPendingCount: number
  initialActiveComponents: number
  groupId: string
}

function StatusBadge({ status }: { status: string }) {
  if (status === "healthy") {
    return (
      <Badge className="border-green-500/20 bg-green-500/10 text-green-600 dark:text-green-400">
        <CheckCircle className="mr-1 size-3" />
        healthy
      </Badge>
    )
  }
  if (status === "degraded") {
    return (
      <Badge className="border-yellow-500/20 bg-yellow-500/10 text-yellow-600 dark:text-yellow-400">
        <MinusCircle className="mr-1 size-3" />
        degraded
      </Badge>
    )
  }
  return (
    <Badge variant="destructive">
      <XCircle className="mr-1 size-3" />
      unhealthy
    </Badge>
  )
}

function formatUptime(uptime: number): string {
  return `${Math.floor(uptime / 3600)}h ${Math.floor((uptime % 3600) / 60)}m`
}

export function LiveKPIs({
  initialHealth,
  initialTotalMemories,
  initialPendingCount,
  initialActiveComponents,
  groupId,
}: LiveKPIsProps) {
  const [health, setHealth] = useState<HealthResponse | null>(initialHealth)
  const [totalMemories, setTotalMemories] = useState(initialTotalMemories)
  const [pendingCount, setPendingCount] = useState(initialPendingCount)
  const [activeComponents, setActiveComponents] = useState(initialActiveComponents)
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null)
  const [connected, setConnected] = useState(false)

  const esRef = useRef<EventSource | null>(null)
  const retryDelayRef = useRef(1000)

  useEffect(() => {
    let cancelled = false

    function connect() {
      if (cancelled) return

      const es = new EventSource(`/api/stream?group_id=${encodeURIComponent(groupId)}`)
      esRef.current = es

      es.onopen = () => {
        if (!cancelled) {
          setConnected(true)
          retryDelayRef.current = 1000
        }
      }

      es.onmessage = (event) => {
        if (cancelled) return
        try {
          const payload = JSON.parse(event.data as string) as SnapshotPayload | { type: "ping" }
          if (payload.type === "ping") return

          if (payload.type === "snapshot") {
            const snap = payload as SnapshotPayload
            setHealth(snap.health)
            setTotalMemories(snap.totalMemories)
            setPendingCount(snap.pendingCount)
            // Derive activeComponents from health components
            const comps = snap.health?.components ?? []
            setActiveComponents(comps.filter((c) => c.status === "healthy").length)
            setLastUpdated(new Date())
          }
        } catch {
          // Ignore malformed events
        }
      }

      es.onerror = () => {
        if (cancelled) return
        setConnected(false)
        es.close()
        // Exponential backoff, max 30s
        const delay = Math.min(retryDelayRef.current, 30_000)
        retryDelayRef.current = Math.min(delay * 2, 30_000)
        setTimeout(connect, delay)
      }
    }

    connect()

    return () => {
      cancelled = true
      esRef.current?.close()
      esRef.current = null
    }
  }, [groupId])

  const components = health?.components ?? []

  return (
    <div className="space-y-4">
      {/* Live indicator */}
      <div className="flex items-center justify-end gap-1.5">
        <span
          className={`size-2 rounded-full ${connected ? "animate-pulse bg-green-500" : "bg-muted-foreground/40"}`}
        />
        <span className="text-muted-foreground text-xs">
          {connected ? "live" : "reconnecting"}
          {lastUpdated && connected && (
            <span className="ml-1 opacity-60">
              · updated {lastUpdated.toLocaleTimeString()}
            </span>
          )}
        </span>
      </div>

      {/* KPI grid */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-muted-foreground text-sm font-medium">System Health</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <Activity className="text-muted-foreground size-4" />
              {health ? <StatusBadge status={health.status} /> : <Badge variant="outline">unknown</Badge>}
            </div>
            {health && (
              <p className="text-muted-foreground mt-2 text-xs">
                Uptime: {formatUptime(health.uptime)}
              </p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-muted-foreground text-sm font-medium">Pending Approvals</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <span className="text-2xl font-bold">{pendingCount}</span>
              {pendingCount > 0 && (
                <Button asChild size="sm" variant="outline">
                  <Link href="/dashboard/curator">Review</Link>
                </Button>
              )}
            </div>
            <p className="text-muted-foreground mt-1 text-xs">proposals awaiting review</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-muted-foreground text-sm font-medium">Total Memories</CardTitle>
          </CardHeader>
          <CardContent>
            <span className="text-2xl font-bold">{totalMemories}</span>
            <p className="text-muted-foreground mt-1 text-xs">stored in {groupId}</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-muted-foreground text-sm font-medium">Active Components</CardTitle>
          </CardHeader>
          <CardContent>
            <span className="text-2xl font-bold">
              {activeComponents}
              <span className="text-muted-foreground text-base font-normal">/{components.length}</span>
            </span>
            <p className="text-muted-foreground mt-1 text-xs">healthy components</p>
          </CardContent>
        </Card>
      </div>

      {/* Pending alert banner */}
      {pendingCount > 0 && (
        <div className="flex items-start gap-3 rounded-lg border border-yellow-500/30 bg-yellow-500/5 p-4">
          <AlertTriangle className="mt-0.5 size-4 shrink-0 text-yellow-600 dark:text-yellow-400" />
          <div className="flex-1">
            <p className="text-sm font-medium">Needs Attention</p>
            <p className="text-muted-foreground mt-0.5 text-sm">
              {pendingCount} curator proposal{pendingCount > 1 ? "s" : ""} pending human review.{" "}
              <Link href="/dashboard/curator" className="hover:text-foreground underline underline-offset-2">
                Review now
              </Link>
            </p>
          </div>
        </div>
      )}
    </div>
  )
}
