import { DEFAULT_GROUP_ID } from "@/lib/defaults/scope"

export const DASHBOARD_GROUP_ID = DEFAULT_GROUP_ID || "allura-system"

type QueryValue = string | number | boolean | null | undefined

export class DashboardApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly url: string
  ) {
    super(message)
    this.name = "DashboardApiError"
  }
}

function withGroupId(params?: Record<string, QueryValue>): URLSearchParams {
  const search = new URLSearchParams()
  search.set("group_id", DASHBOARD_GROUP_ID)
  for (const [key, value] of Object.entries(params ?? {})) {
    if (value !== undefined && value !== null && value !== "") {
      search.set(key, String(value))
    }
  }
  return search
}

async function readJson<T>(path: string, init?: RequestInit): Promise<{ data: T; degraded: boolean; warning: string | null }> {
  const response = await fetch(path, {
    cache: "no-store",
    ...init,
    headers: {
      Accept: "application/json",
      ...(init?.headers ?? {}),
    },
  })
  const warning = response.headers.get("Warning")
  const degraded = response.status === 206 || Boolean(warning)
  const payload = await response.json().catch(() => null)

  if (!response.ok && response.status !== 206) {
    const message =
      payload && typeof payload === "object" && "error" in payload ? String(payload.error) : `Request failed: ${response.status}`
    throw new DashboardApiError(message, response.status, path)
  }

  return { data: payload as T, degraded, warning }
}

export function getMemoryList(params?: Record<string, QueryValue>) {
  return readJson<unknown>(`/api/memory?${withGroupId(params).toString()}`)
}

export function getMemoryById(id: string) {
  return readJson<unknown>(`/api/memory/${encodeURIComponent(id)}?${withGroupId().toString()}`)
}

export function getMemoryCount() {
  return readJson<{ count?: number }>(`/api/memory/count?${withGroupId().toString()}`)
}

export function getTraces(params?: Record<string, QueryValue>) {
  return readJson<{ traces?: unknown[] }>(`/api/memory/traces?${withGroupId(params).toString()}`)
}

export function getInsights(params?: Record<string, QueryValue>) {
  return readJson<{ insights?: unknown[]; total?: number; has_more?: boolean }>(
    `/api/memory/insights?${withGroupId(params).toString()}`
  )
}

export function getInsightHistory(id: string) {
  return readJson<{ history?: unknown[] }>(
    `/api/memory/insights/${encodeURIComponent(id)}/history?${withGroupId().toString()}`
  )
}

export function getCuratorProposals(params?: Record<string, QueryValue>) {
  return readJson<{ proposals?: unknown[] }>(`/api/curator/proposals?${withGroupId(params).toString()}`)
}

export function getAuditEvents(params?: Record<string, QueryValue>) {
  return readJson<{ events?: unknown[]; pagination?: { total?: number; has_more?: boolean } }>(
    `/api/audit/events?${withGroupId(params).toString()}`
  )
}

export function getHealth() {
  return readJson<unknown>("/api/health?detailed=true")
}

export function getHealthMetrics() {
  return readJson<{
    timestamp: string
    queue: { pending_count: number; oldest_age_hours: number; approved_24h: number; rejected_24h: number }
    recall: { search_available: boolean; last_latency_ms: number | null }
    storage: {
      postgres: { status: string; latency_ms: number; total_memories: number }
      neo4j: { status: string; latency_ms: number | null; total_nodes: number | null }
    }
    degraded: {
      neo4j_unavailable: number
      scope_error: number
      embedding_failures: number
      promotion_failures_24h: number
    }
    skills?: Array<{
      tool_name: string
      category: string
      calls_24h: number
      success_rate: number
      avg_latency_ms: number
      last_used: string | null
      trend: "up" | "down" | "flat"
    }>
  }>("/api/health/metrics")
}

export function getGraph(params?: Record<string, QueryValue>) {
  return readJson<unknown>(`/api/memory/graph?${withGroupId(params).toString()}`)
}

export async function approveProposal(proposalId: string): Promise<void> {
  await readJson<unknown>("/api/curator/approve", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      proposal_id: proposalId,
      group_id: DASHBOARD_GROUP_ID,
      decision: "approve",
      curator_id: "dashboard-user",
    }),
  })
}

export async function rejectProposal(proposalId: string, rationale?: string): Promise<void> {
  await readJson<unknown>("/api/curator/reject", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      proposal_id: proposalId,
      group_id: DASHBOARD_GROUP_ID,
      curator_id: "dashboard-user",
      rationale,
    }),
  })
}
