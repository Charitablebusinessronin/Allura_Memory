"use client"

import { useEffect, useRef, useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import type { SnapshotPayload, BreakerStateEntry } from "@/app/api/stream/route"

export interface BudgetCardProps {
  groupId: string
}

const STORE_LABELS: Record<string, string> = {
  postgres: "PostgreSQL",
  neo4j: "Neo4j",
}

function storeLabel(name: string): string {
  return STORE_LABELS[name.toLowerCase()] ?? name
}

function BreakerDot({ state }: { state: BreakerStateEntry["state"] }) {
  if (state === "closed") {
    return (
      <span className="flex items-center gap-1.5">
        <span className="size-2 rounded-full bg-green-500" />
        <Badge className="border-green-500/20 bg-green-500/10 text-green-600 dark:text-green-400">
          closed
        </Badge>
      </span>
    )
  }
  if (state === "half_open") {
    return (
      <span className="flex items-center gap-1.5">
        <span className="size-2 rounded-full bg-yellow-500" />
        <Badge className="border-yellow-500/20 bg-yellow-500/10 text-yellow-600 dark:text-yellow-400">
          recovering
        </Badge>
      </span>
    )
  }
  return (
    <span className="flex items-center gap-1.5">
      <span className="size-2 rounded-full bg-red-500" />
      <Badge variant="destructive">open</Badge>
    </span>
  )
}

export function BudgetCard({ groupId }: BudgetCardProps) {
  const [breakerStates, setBreakerStates] = useState<BreakerStateEntry[]>([])
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
            setBreakerStates((payload as SnapshotPayload).breakerStates)
          }
        } catch {
          // Ignore malformed events
        }
      }

      es.onerror = () => {
        if (cancelled) return
        setConnected(false)
        es.close()
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

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-medium">Store Health</CardTitle>
          <span
            className={`size-2 rounded-full ${connected ? "animate-pulse bg-green-500" : "bg-muted-foreground/40"}`}
          />
        </div>
      </CardHeader>
      <CardContent>
        {breakerStates.length === 0 ? (
          <p className="text-muted-foreground text-xs">No circuit data</p>
        ) : (
          <ul className="space-y-2">
            {breakerStates.map((entry) => (
              <li key={entry.name} className="flex items-center justify-between text-sm">
                <span className="font-medium">{storeLabel(entry.name)}</span>
                <BreakerDot state={entry.state} />
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  )
}
