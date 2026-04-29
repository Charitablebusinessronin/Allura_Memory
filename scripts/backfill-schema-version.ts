#!/usr/bin/env bun
/**
 * Backfill Schema Version (FR-1, FR-2, NFR-3)
 *
 * Sets schema_version = 1 on all existing rows (PG) and nodes (Neo4j) where null.
 * This script is idempotent — safe to re-run.
 *
 * Usage:
 *   bun run scripts/backfill-schema-version.ts
 *
 * Environment:
 *   DATABASE_URL       — Main PostgreSQL connection string
 *   RUVECTOR_DATABASE_URL — RuVector PostgreSQL connection string (or same as DATABASE_URL)
 *   NEO4J_URL          — Neo4j bolt URL (e.g., bolt://localhost:7687)
 *   NEO4J_USER         — Neo4j username (default: neo4j)
 *   NEO4J_PASSWORD     — Neo4j password
 */

import { Pool } from "pg"
import neo4j from "neo4j-driver"

const SCHEMA_VERSION = 1

async function backfillPostgres(pool: Pool, tableName: string): Promise<number> {
  console.log(`[backfill] Checking ${tableName} for rows needing schema_version...`)

  // Count rows needing backfill
  const countResult = await pool.query(
    `SELECT COUNT(*) as count FROM ${tableName} WHERE schema_version IS NULL OR schema_version != $1`,
    [SCHEMA_VERSION]
  )
  const needsBackfill = parseInt(countResult.rows[0].count, 10)

  if (needsBackfill === 0) {
    console.log(`[backfill] ${tableName}: all rows already at schema_version = ${SCHEMA_VERSION}`)
    return 0
  }

  console.log(`[backfill] ${tableName}: ${needsBackfill} rows need backfill`)

  // Update rows — idempotent, sets version to current
  const updateResult = await pool.query(
    `UPDATE ${tableName} SET schema_version = $1 WHERE schema_version IS NULL OR schema_version != $1`,
    [SCHEMA_VERSION]
  )

  const updated = updateResult.rowCount ?? 0
  console.log(`[backfill] ${tableName}: ${updated} rows updated to schema_version = ${SCHEMA_VERSION}`)

  // Verify
  const verifyResult = await pool.query(
    `SELECT schema_version, COUNT(*) as count FROM ${tableName} GROUP BY schema_version ORDER BY schema_version`
  )
  console.log(`[backfill] ${tableName} verification:`, verifyResult.rows)

  return updated
}

async function backfillNeo4j(driver: ReturnType<typeof neo4j.driver>): Promise<{ memories: number; insights: number }> {
  console.log("[backfill] Checking Neo4j nodes needing schema_version...")

  const session = driver.session()

  try {
    // Backfill Memory nodes
    const memoryResult = await session.run(
      `MATCH (m:Memory) WHERE m.schema_version IS NULL SET m.schema_version = $version`,
      { version: neo4j.int(SCHEMA_VERSION) }
    )
    const memoriesBackfilled = memoryResult.summary.counters.updates().propertiesSet ?? 0
    console.log(`[backfill] Neo4j Memory nodes: ${memoriesBackfilled} properties set`)

    // Backfill Insight nodes
    const insightResult = await session.run(
      `MATCH (i:Insight) WHERE i.schema_version IS NULL SET i.schema_version = $version`,
      { version: neo4j.int(SCHEMA_VERSION) }
    )
    const insightsBackfilled = insightResult.summary.counters.updates().propertiesSet ?? 0
    console.log(`[backfill] Neo4j Insight nodes: ${insightsBackfilled} properties set`)

    // Also set schema_version = 1 on nodes that have a different version (shouldn't exist yet)
    const memoryVerify = await session.run(
      `MATCH (m:Memory) WHERE m.schema_version IS NULL OR NOT EXISTS(m.schema_version) SET m.schema_version = $version RETURN count(m) as count`,
      { version: neo4j.int(SCHEMA_VERSION) }
    )
    const insightVerify = await session.run(
      `MATCH (i:Insight) WHERE i.schema_version IS NULL OR NOT EXISTS(i.schema_version) SET i.schema_version = $version RETURN count(i) as count`,
      { version: neo4j.int(SCHEMA_VERSION) }
    )

    // Verify counts
    const memoryCount = await session.run(
      `MATCH (m:Memory) RETURN m.schema_version as sv, count(m) as count ORDER BY sv`
    )
    console.log("[backfill] Neo4j Memory verification:", memoryCount.records.map((r: any) => ({
      schema_version: r.get("sv")?.toNumber?.() ?? r.get("sv"),
      count: r.get("count").toNumber()
    })))

    const insightCount = await session.run(
      `MATCH (i:Insight) RETURN i.schema_version as sv, count(i) as count ORDER BY sv`
    )
    console.log("[backfill] Neo4j Insight verification:", insightCount.records.map((r: any) => ({
      schema_version: r.get("sv")?.toNumber?.() ?? r.get("sv"),
      count: r.get("count").toNumber()
    })))

    return { memories: memoriesBackfilled, insights: insightsBackfilled }
  } finally {
    await session.close()
  }
}

async function main(): Promise<void> {
  console.log("[backfill] Starting schema version backfill...")
  console.log(`[backfill] Target schema_version: ${SCHEMA_VERSION}`)

  // ── PostgreSQL: events table ──────────────────────────────────────────────
  const databaseUrl = process.env.DATABASE_URL
  if (!databaseUrl) {
    console.error("[backfill] ERROR: DATABASE_URL environment variable is required")
    process.exit(1)
  }

  const mainPool = new Pool({ connectionString: databaseUrl })

  try {
    await backfillPostgres(mainPool, "events")
  } catch (err) {
    console.error("[backfill] Error backfilling events:", err)
  }

  // ── PostgreSQL: allura_memories table (RuVector) ──────────────────────────
  const ruvectorUrl = process.env.RUVECTOR_DATABASE_URL || databaseUrl
  const ruvectorPool = ruvectorUrl === databaseUrl ? mainPool : new Pool({ connectionString: ruvectorUrl })

  try {
    await backfillPostgres(ruvectorPool, "allura_memories")
  } catch (err) {
    console.error("[backfill] Error backfilling allura_memories:", err)
  }

  if (ruvectorPool !== mainPool) {
    await ruvectorPool.end()
  }

  // ── Neo4j: Memory and Insight nodes ───────────────────────────────────────
  const neo4jUrl = process.env.NEO4J_URL
  if (neo4jUrl) {
    const neo4jUser = process.env.NEO4J_USER || "neo4j"
    const neo4jPassword = process.env.NEO4J_PASSWORD || ""

    const driver = neo4j.driver(neo4jUrl, neo4j.auth.basic(neo4jUser, neo4jPassword))

    try {
      await backfillNeo4j(driver)
    } catch (err) {
      console.error("[backfill] Error backfilling Neo4j:", err)
    } finally {
      await driver.close()
    }
  } else {
    console.log("[backfill] Skipping Neo4j backfill: NEO4J_URL not set")
  }

  // ── Cleanup ────────────────────────────────────────────────────────────────
  await mainPool.end()

  console.log("[backfill] Backfill complete!")
}

main().catch((err) => {
  console.error("[backfill] Fatal error:", err)
  process.exit(1)
})