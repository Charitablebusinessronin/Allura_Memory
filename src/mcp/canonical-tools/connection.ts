/**
 * Connection Management for Canonical MCP Tools
 *
 * Manages PostgreSQL and Neo4j singleton connections.
 * dotenv config is loaded here since connection setup needs env vars.
 */

import { Pool } from "pg"
import neo4j, { Driver } from "neo4j-driver"
import { config } from "dotenv"
import { resetBudgetState } from "./budget-circuit"

config()

// ── Connection Management ─────────────────────────────────────────────────

let pgPool: Pool | null = null
let neo4jDriver: Driver | null = null

export async function getConnections(): Promise<{ pg: Pool; neo4j: Driver }> {
  if (!pgPool) {
    pgPool = new Pool({
      host: process.env.POSTGRES_HOST || "localhost",
      port: parseInt(process.env.POSTGRES_PORT || "5432"),
      database: process.env.POSTGRES_DB || "memory",
      user: process.env.POSTGRES_USER || "ronin4life",
      password: process.env.POSTGRES_PASSWORD,
      connectionTimeoutMillis: 10000,
      max: 10,
    })
  }

  if (!neo4jDriver) {
    neo4jDriver = neo4j.driver(
      process.env.NEO4J_URI || "bolt://localhost:7687",
      neo4j.auth.basic(process.env.NEO4J_USER || "neo4j", process.env.NEO4J_PASSWORD || "password"),
      { maxConnectionPoolSize: 50 }
    )
  }

  return { pg: pgPool, neo4j: neo4jDriver }
}

/**
 * Reset cached connections. Used in tests to force reconnection
 * after changing environment variables.
 */
export function resetConnections(): void {
  if (pgPool) {
    pgPool.end().catch(() => {})
    pgPool = null
  }
  if (neo4jDriver) {
    neo4jDriver.close().catch(() => {})
    neo4jDriver = null
  }
  resetBudgetState()
}