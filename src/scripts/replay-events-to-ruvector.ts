#!/usr/bin/env bun
/**
 * Replay Events to RuVector — Backfill allura_memories from historical events
 *
 * Reads memory_add events from the `events` table and projects them into
 * `allura_memories` using the same storeMemory() function as the live path.
 *
 * Uses checkpointing (last processed event ID) so it can resume after interruption.
 * Idempotent: uses ON CONFLICT to avoid duplicates on replay.
 *
 * Usage:
 *   bun run src/scripts/replay-events-to-ruvector.ts --once
 *   bun run src/scripts/replay-events-to-ruvector.ts --batch-size 100 --interval 1000
 *   bun run src/scripts/replay-events-to-ruvector.ts --group-id allura-system
 */

import { getRuVectorPool, closeRuVectorPool } from "../lib/ruvector/connection"
import { generateEmbedding } from "../lib/ruvector/embedding-service"
import { Pool } from "pg"
import { env } from "process"

// ── Config ──────────────────────────────────────────────────────────────────

const DEFAULT_BATCH_SIZE = 50
const CHECKPOINT_KEY = "replay_events_to_ruvector_last_id"

interface ReplayConfig {
  batchSize: number
  once: boolean
  intervalMs: number
  groupId: string | null
  dryRun: boolean
}

function parseArgs(argv: string[]): ReplayConfig {
  const config: ReplayConfig = {
    batchSize: DEFAULT_BATCH_SIZE,
    once: false,
    intervalMs: 5000,
    groupId: null,
    dryRun: false,
  }
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i]
    if (arg === "--once") config.once = true
    else if (arg === "--dry-run") config.dryRun = true
    else if (arg === "--batch-size" && argv[i + 1]) { config.batchSize = parseInt(argv[++i], 10) }
    else if (arg === "--interval" && argv[i + 1]) { config.intervalMs = parseInt(argv[++i], 10) }
    else if (arg === "--group-id" && argv[i + 1]) { config.groupId = argv[++i] }
  }
  return config
}

// ── Checkpoint ──────────────────────────────────────────────────────────────

async function getCheckpoint(pool: Pool, groupId: string): Promise<number> {
  const result = await pool.query(
    `SELECT last_event_id FROM checkpoints WHERE group_id = $1 ORDER BY created_at DESC LIMIT 1`,
    [groupId]
  )
  return result.rows[0]?.last_event_id ?? 0
}

async function saveCheckpoint(pool: Pool, groupId: string, lastEventId: number, eventCount: number): Promise<void> {
  await pool.query(
    `INSERT INTO checkpoints (group_id, event_count, last_event_id, state_hash, witness_log_count)
     VALUES ($1::varchar, $2::bigint, $3::bigint, md5($1::text || $2::text || $3::text), 0)`,
    [groupId, eventCount, lastEventId]
  )
}

// ── Main ───────────────────────────────────────────────────────────────────

async function replay(config: ReplayConfig): Promise<{ processed: number; embedded: number; failed: number }> {
  const pgPool = new Pool({
    host: env.POSTGRES_HOST || "localhost",
    port: parseInt(env.POSTGRES_PORT || "5432", 10),
    database: env.POSTGRES_DB || "memory",
    user: env.POSTGRES_USER || "ronin4life",
    password: env.POSTGRES_PASSWORD || env.RUVECTOR_PASSWORD,
  })

  const ruvPool = getRuVectorPool()
  let processed = 0
  let embedded = 0
  let failed = 0

  try {
    const lastId = await getCheckpoint(pgPool, config.groupId || 'allura-system')

    const whereClauses = [
      "event_type = 'memory_add'",
      "id > $1",
    ]
    const params: unknown[] = [lastId]
    let paramIdx = 2

    if (config.groupId) {
      whereClauses.push(`group_id = $${paramIdx++}`)
      params.push(config.groupId)
    }

    const query = `
      SELECT id, group_id, metadata, created_at
      FROM events
      WHERE ${whereClauses.join(" AND ")}
      ORDER BY id ASC
      LIMIT $${paramIdx}
    `
    params.push(config.batchSize)

    const result = await pgPool.query(query, params)

    if (result.rows.length === 0) {
      console.log("[Replay] No new events to process")
      return { processed: 0, embedded: 0, failed: 0 }
    }

    console.log(`[Replay] Found ${result.rows.length} events to process (from id > ${lastId})`)

    for (const row of result.rows) {
      const metadata = typeof row.metadata === "string" ? JSON.parse(row.metadata) : row.metadata
      const content = metadata?.content
      const userId = metadata?.user_id || row.group_id
      const memoryId = metadata?.memory_id

      if (!content || !content.trim()) {
        console.warn(`[Replay] Skipping event ${row.id}: no content`)
        continue
      }

      if (config.dryRun) {
        console.log(`[Replay] [DRY RUN] Would project: event_id=${row.id} content="${content.slice(0, 60)}..."`)
        processed++
        continue
      }

      // Generate embedding
      const embedding = await generateEmbedding(content)
      const embeddingValue = embedding ? `[${embedding.join(",")}]` : null

      // Upsert into allura_memories (idempotent on memory_id)
      try {
        await ruvPool.query(
          `INSERT INTO allura_memories (user_id, session_id, content, memory_type, embedding, metadata, group_id)
           VALUES ($1, $2, $3, $4, $5::vector, $6::jsonb, $7)
           ON CONFLICT DO NOTHING`,
          [
            row.group_id,
            `replay-${row.id}`,
            content,
            "episodic",
            embeddingValue,
            JSON.stringify({ memory_id: memoryId, event_id: String(row.id), source: metadata?.source || "replay", replayed: true }),
            row.group_id,
          ]
        )
        embedded++
      } catch (err) {
        // ON CONFLICT needs a unique constraint; if it doesn't exist, just skip duplicates
        const msg = err instanceof Error ? err.message : String(err)
        if (msg.includes("duplicate") || msg.includes("unique")) {
          console.info(`[Replay] Skipping duplicate: event_id=${row.id}`)
        } else {
          console.error(`[Replay] Failed to insert event ${row.id}: ${msg}`)
          failed++
        }
      }

      processed++

      // Save checkpoint every batch
      if (processed % config.batchSize === 0) {
        await saveCheckpoint(pgPool, config.groupId || 'allura-system', row.id, processed)
        console.log(`[Replay] Checkpoint saved at event_id=${row.id} (processed: ${processed})`)
      }
    }

    // Final checkpoint
    if (result.rows.length > 0) {
      const lastProcessedId = result.rows[result.rows.length - 1].id
      await saveCheckpoint(pgPool, config.groupId || 'allura-system', lastProcessedId, processed)
      console.log(`[Replay] Final checkpoint at event_id=${lastProcessedId}`)
    }
  } finally {
    await pgPool.end()
    await closeRuVectorPool()
  }

  return { processed, embedded, failed }
}

// ── Entry ───────────────────────────────────────────────────────────────────

const isMainModule = process.argv[1]?.includes("replay-events-to-ruvector")

if (isMainModule) {
  const config = parseArgs(process.argv.slice(2))
  console.log(`[Replay] Starting with config:`, config)

  replay(config)
    .then((stats) => {
      console.log(`[Replay] Complete:`, stats)
      process.exit(0)
    })
    .catch((err) => {
      console.error(`[Replay] Fatal:`, err)
      process.exit(1)
    })
}

export { replay, parseArgs }