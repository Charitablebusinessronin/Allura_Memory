/**
 * GET /api/health/metrics
 *
 * Observability metrics endpoint for Allura Memory.
 * Returns queue health, recall latency, promotion stats, and degraded mode counters.
 *
 * Reference: docs/allura/SPRINT-PLAN.md (Sprint 5)
 */

import { NextRequest, NextResponse } from "next/server"
import { getPool } from "@/lib/postgres/connection"
import { captureException } from "@/lib/observability/sentry"

export interface MetricsResponse {
  timestamp: string
  queue: {
    pending_count: number
    oldest_age_hours: number
    approved_24h: number
    rejected_24h: number
  }
  recall: {
    search_available: boolean
    last_latency_ms: number | null
  }
  storage: {
    postgres: {
      status: "healthy" | "degraded" | "unhealthy"
      latency_ms: number
      total_memories: number
    }
    neo4j: {
      status: "healthy" | "degraded" | "unhealthy"
      latency_ms: number | null
      total_nodes: number | null
    }
  }
  degraded: {
    neo4j_unavailable: number
    scope_error: number
    embedding_failures: number
    promotion_failures_24h: number
  }
}

export async function GET(request: NextRequest): Promise<NextResponse<MetricsResponse>> {
  const timestamp = new Date().toISOString()

  try {
    const pg = getPool()

    // Queue health metrics
    const queueMetrics = await pg.query(`
      SELECT
        (SELECT count(*) FROM canonical_proposals WHERE status = 'pending') as pending_count,
        (SELECT COALESCE(EXTRACT(EPOCH FROM (now() - min(created_at)))/3600, 0)
         FROM canonical_proposals WHERE status = 'pending') as oldest_age_hours,
        (SELECT count(*) FROM canonical_proposals
         WHERE status = 'approved' AND decided_at >= now() - interval '24 hours') as approved_24h,
        (SELECT count(*) FROM canonical_proposals
         WHERE status = 'rejected' AND decided_at >= now() - interval '24 hours') as rejected_24h
    `)

    const row = queueMetrics.rows[0]

    // Storage metrics — PostgreSQL
    const pgStart = Date.now()
    const pgHealthResult = await pg.query("SELECT count(*) as total FROM allura_memories")
    const pgLatency = Date.now() - pgStart

    // Storage metrics — Neo4j (degradable)
    let neo4jStatus: "healthy" | "degraded" | "unhealthy" = "unhealthy"
    let neo4jLatency: number | null = null
    let neo4jNodes: number | null = null

    try {
      const neo4j = await import("neo4j-driver")
      const driver = neo4j.driver(
        process.env.NEO4J_URI || "bolt://localhost:7687",
        neo4j.auth.basic(process.env.NEO4J_USER || "neo4j", process.env.NEO4J_PASSWORD || "password")
      )
      const session = driver.session()
      const neo4jStart = Date.now()
      const result = await session.run("MATCH (n:Memory) RETURN count(n) AS total")
      neo4jLatency = Date.now() - neo4jStart
      neo4jNodes = result.records[0]?.get("total")?.toNumber() ?? null
      neo4jStatus = "healthy"
      await session.close()
      await driver.close()
    } catch {
      neo4jStatus = "unhealthy"
    }

    // Degraded mode counters from events table
    const degradedMetrics = await pg.query(`
      SELECT
        (SELECT count(*) FROM events
         WHERE event_type = 'neo4j_unavailable' AND created_at >= now() - interval '24 hours') as neo4j_unavailable,
        (SELECT count(*) FROM events
         WHERE event_type = 'scope_error' AND created_at >= now() - interval '24 hours') as scope_error,
        (SELECT count(*) FROM events
         WHERE event_type = 'embedding_failure' AND created_at >= now() - interval '24 hours') as embedding_failures,
        (SELECT count(*) FROM events
         WHERE event_type = 'proposal_approved'
         AND metadata::text LIKE '%"neo4j_error"%'
         AND created_at >= now() - interval '24 hours') as promotion_failures_24h
    `)

    const degraded = degradedMetrics.rows[0]

    // Recall availability check
    let searchAvailable = true
    let lastSearchLatency: number | null = null
    try {
      const searchStart = Date.now()
      await pg.query("SELECT id FROM allura_memories LIMIT 1")
      lastSearchLatency = Date.now() - searchStart
    } catch {
      searchAvailable = false
    }

    const metrics: MetricsResponse = {
      timestamp,
      queue: {
        pending_count: parseInt(row.pending_count) || 0,
        oldest_age_hours: parseFloat(row.oldest_age_hours) || 0,
        approved_24h: parseInt(row.approved_24h) || 0,
        rejected_24h: parseInt(row.rejected_24h) || 0,
      },
      recall: {
        search_available: searchAvailable,
        last_latency_ms: lastSearchLatency,
      },
      storage: {
        postgres: {
          status: pgLatency < 5000 ? "healthy" : pgLatency < 10000 ? "degraded" : "unhealthy",
          latency_ms: pgLatency,
          total_memories: parseInt(pgHealthResult.rows[0]?.total) || 0,
        },
        neo4j: {
          status: neo4jStatus,
          latency_ms: neo4jLatency,
          total_nodes: neo4jNodes,
        },
      },
      degraded: {
        neo4j_unavailable: parseInt(degraded.neo4j_unavailable) || 0,
        scope_error: parseInt(degraded.scope_error) || 0,
        embedding_failures: parseInt(degraded.embedding_failures) || 0,
        promotion_failures_24h: parseInt(degraded.promotion_failures_24h) || 0,
      },
    }

    return NextResponse.json(metrics)
  } catch (error) {
    captureException(error, { tags: { route: "/api/health/metrics", method: "GET" } })

    return NextResponse.json(
      {
        timestamp,
        queue: { pending_count: 0, oldest_age_hours: 0, approved_24h: 0, rejected_24h: 0 },
        recall: { search_available: false, last_latency_ms: null },
        storage: {
          postgres: { status: "unhealthy" as const, latency_ms: 0, total_memories: 0 },
          neo4j: { status: "unhealthy" as const, latency_ms: null, total_nodes: null },
        },
        degraded: {
          neo4j_unavailable: 0,
          scope_error: 0,
          embedding_failures: 0,
          promotion_failures_24h: 0,
        },
      },
      { status: 503 }
    )
  }
}