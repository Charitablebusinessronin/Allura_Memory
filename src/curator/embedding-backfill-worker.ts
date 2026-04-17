#!/usr/bin/env bun
/**
 * Embedding Backfill Worker — Generates embeddings for allura_memories rows
 *
 * This worker runs as a separate Bun process and:
 * 1. Polls `allura_memories` WHERE `embedding IS NULL AND deleted_at IS NULL`
 * 2. Calls `generateEmbeddingBatch()` in batches of 10
 * 3. Updates rows with generated embeddings using `::ruvector` cast
 * 4. Handles failures gracefully — failed embeddings remain NULL (retried next cycle)
 * 5. Tracks progress with simple stats logging
 *
 * ## Architecture
 *
 * Follows the pattern of `notion-sync-worker.ts`. The worker is a standalone
 * Bun script that connects to RuVector PG (port 5433) via `getRuVectorPool()`
 * and calls Ollama's nomic-embed-text model via `generateEmbeddingBatch()`.
 *
 * Failed embeddings use DLQ-like behavior: rows are simply left as NULL,
 * so they'll be picked up again on the next poll cycle. No separate DLQ table
 * is needed — the absence of an embedding IS the retry signal.
 *
 * ## Usage
 *
 *   # Single batch then exit
 *   bun run src/curator/embedding-backfill-worker.ts --once
 *
 *   # Continuous polling (default 30s interval)
 *   bun run src/curator/embedding-backfill-worker.ts --interval 30000
 *
 *   # Dry run (log what would be done, no writes)
 *   bun run src/curator/embedding-backfill-worker.ts --dry-run
 *
 *   # Specific group_id filter
 *   bun run src/curator/embedding-backfill-worker.ts --group-id allura-test
 *
 * ## Environment
 *
 *   RUVECTOR_PASSWORD — Required (or POSTGRES_PASSWORD)
 *   RUVECTOR_HOST     — Default: localhost
 *   RUVECTOR_PORT     — Default: 5433
 *   RUVECTOR_DB       — Default: ruvector_test
 *   RUVECTOR_USER      — Default: ruvector
 */

// Server-only guard
if (typeof window !== "undefined") {
  throw new Error("Embedding backfill worker can only be used server-side")
}

import { getRuVectorPool, closeRuVectorPool } from "../lib/ruvector/connection"
import { generateEmbeddingBatch } from "../lib/ruvector/embedding-service"

// ── Constants ────────────────────────────────────────────────────────────────

/** Default polling interval in milliseconds */
const DEFAULT_POLL_INTERVAL_MS = 30_000

/** Number of rows to fetch per batch */
const BATCH_SIZE = 10

/** Maximum concurrent embedding batch operations */
const MAX_CONCURRENT_BATCHES = 2

/** Log prefix for consistent output */
const LOG_PREFIX = "[EmbedBackfill]"

// ── Types ────────────────────────────────────────────────────────────────────

/** A pending row that needs an embedding */
export interface PendingMemoryRow {
  id: string
  content: string
}

/** Accumulated stats for the worker session */
export interface BackfillStats {
  totalProcessed: number
  successfullyEmbedded: number
  failed: number
  cyclesCompleted: number
}

/** CLI configuration parsed from args */
export interface WorkerConfig {
  once: boolean
  dryRun: boolean
  pollIntervalMs: number
  groupId: string | null
}

// ── CLI Argument Parsing ────────────────────────────────────────────────────

/**
 * Parse CLI arguments into a WorkerConfig.
 *
 * Supported flags:
 *   --once           Run a single batch then exit
 *   --dry-run        Log actions without writing to DB
 *   --interval N     Polling interval in ms (default: 30000)
 *   --group-id ID    Only process rows for this group_id
 */
export function parseArgs(argv: string[]): WorkerConfig {
  const config: WorkerConfig = {
    once: false,
    dryRun: false,
    pollIntervalMs: DEFAULT_POLL_INTERVAL_MS,
    groupId: null,
  }

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i]

    if (arg === "--once") {
      config.once = true
    } else if (arg === "--dry-run") {
      config.dryRun = true
    } else if (arg === "--interval" && argv[i + 1]) {
      config.pollIntervalMs = parseInt(argv[i + 1], 10)
      i++ // skip value
    } else if (arg === "--group-id" && argv[i + 1]) {
      config.groupId = argv[i + 1]
      i++ // skip value
    }
  }

  return config
}

// ── Core Functions ──────────────────────────────────────────────────────────

/**
 * Fetch pending rows from allura_memories that need embeddings.
 *
 * @param limit - Maximum rows to fetch
 * @param groupId - Optional group_id filter for tenant isolation
 * @returns Array of rows with id and content
 */
export async function getPendingRows(
  limit: number = BATCH_SIZE,
  groupId: string | null = null
): Promise<PendingMemoryRow[]> {
  const pool = getRuVectorPool()

  let query: string
  const params: unknown[] = [limit]

  if (groupId) {
    query = `
      SELECT id, content FROM allura_memories
      WHERE embedding IS NULL AND deleted_at IS NULL AND group_id = $2
      ORDER BY created_at ASC
      LIMIT $1
    `
    params.push(groupId)
  } else {
    query = `
      SELECT id, content FROM allura_memories
      WHERE embedding IS NULL AND deleted_at IS NULL
      ORDER BY created_at ASC
      LIMIT $1
    `
  }

  const result = await pool.query(query, params)
  return result.rows.map((row: Record<string, unknown>) => ({
    id: String(row.id),
    content: String(row.content),
  }))
}

/**
 * Format an embedding vector as a string literal for the ruvector column type.
 *
 * RuVector requires the embedding as a string literal `'[0.1,0.2,...]'`
 * that is then cast with `::ruvector` in the SQL.
 *
 * @param embedding - Array of numbers from the embedding model
 * @returns String representation like '[0.1,0.2,...,0.768]'
 */
export function formatEmbeddingForUpdate(embedding: number[]): string {
  return `[${embedding.join(",")}]`
}

/**
 * Update a single row with its generated embedding.
 *
 * Uses the `::ruvector` cast to convert the string literal
 * into the proper vector type for the column.
 *
 * @param id - Row id (BIGSERIAL, stringified)
 * @param embedding - The embedding vector
 */
export async function updateRowEmbedding(id: string, embedding: number[]): Promise<void> {
  const pool = getRuVectorPool()
  const embeddingStr = formatEmbeddingForUpdate(embedding)

  // NOTE: This UPDATE is an exception to the append-only invariant.
  // Embedding backfill fills a computed column that was NULL.
  // The original event is preserved — this mutates only the derived vector column,
  // not the event trace.
  await pool.query(`UPDATE allura_memories SET embedding = $1::ruvector WHERE id = $2`, [embeddingStr, id])
}

/**
 * Process a single batch of pending rows.
 *
 * For each row that needs an embedding:
 * 1. Collect content strings
 * 2. Call `generateEmbeddingBatch()` (already handles parallelism internally)
 * 3. Update each row with its embedding (or leave NULL on failure)
 *
 * @param rows - Pending rows to process
 * @param dryRun - If true, log only without writing
 * @returns Number of successful and failed embeddings
 */
export async function processBatch(
  rows: PendingMemoryRow[],
  dryRun: boolean = false
): Promise<{ succeeded: number; failed: number }> {
  if (rows.length === 0) {
    return { succeeded: 0, failed: 0 }
  }

  const contents = rows.map((row) => row.content)

  if (dryRun) {
    console.log(
      `${LOG_PREFIX} [DRY RUN] Would generate embeddings for ${rows.length} rows:`,
      rows.map((r) => ({ id: r.id, contentPreview: r.content.slice(0, 50) }))
    )
    return { succeeded: 0, failed: 0 }
  }

  // Generate embeddings (batch handles internal concurrency)
  const embeddings = await generateEmbeddingBatch(contents)

  let succeeded = 0
  let failed = 0

  // Update each row individually — partial success is okay
  for (let i = 0; i < rows.length; i++) {
    const row = rows[i]
    const embedding = embeddings[i]

    if (embedding === null) {
      // Failed embedding — leave as NULL, will be retried next cycle
      failed++
      console.warn(`${LOG_PREFIX} Embedding failed for row ${row.id}, will retry next cycle`)
      continue
    }

    try {
      await updateRowEmbedding(row.id, embedding)
      succeeded++
    } catch (err) {
      // DB update failed — embedding is generated but write failed
      // The row is still NULL, so it'll be retried
      failed++
      const message = err instanceof Error ? err.message : String(err)
      console.error(`${LOG_PREFIX} Failed to update row ${row.id}: ${message}`)
    }
  }

  return { succeeded, failed }
}

/**
 * Run a single backfill cycle: fetch pending rows, process, report.
 *
 * @param config - Worker configuration
 * @returns Stats from this cycle
 */
export async function runBackfillCycle(
  config: WorkerConfig
): Promise<{ succeeded: number; failed: number; rowsFound: number }> {
  const rows = await getPendingRows(BATCH_SIZE, config.groupId)
  const rowsFound = rows.length

  if (rowsFound === 0) {
    console.log(`${LOG_PREFIX} No pending rows found`)
    return { succeeded: 0, failed: 0, rowsFound: 0 }
  }

  console.log(`${LOG_PREFIX} Found ${rowsFound} rows pending embedding`)

  const { succeeded, failed } = await processBatch(rows, config.dryRun)

  console.log(`${LOG_PREFIX} Cycle complete: ${succeeded} embedded, ${failed} failed (of ${rowsFound})`)

  return { succeeded, failed, rowsFound }
}

// ── Worker Main Loop ────────────────────────────────────────────────────────

/**
 * Run the embedding backfill worker.
 *
 * In `--once` mode, processes a single batch and exits.
 * In continuous mode, polls at the configured interval until SIGINT.
 *
 * Graceful shutdown on SIGINT:
 * - Stops accepting new cycles
 * - Reports final stats
 * - Closes the DB pool
 */
export async function runWorker(config: WorkerConfig): Promise<BackfillStats> {
  const stats: BackfillStats = {
    totalProcessed: 0,
    successfullyEmbedded: 0,
    failed: 0,
    cyclesCompleted: 0,
  }

  let running = true

  // Graceful shutdown handler
  const shutdown = () => {
    if (!running) return
    running = false
    console.log(`\n${LOG_PREFIX} Shutting down gracefully...`)
  }

  process.on("SIGINT", shutdown)
  process.on("SIGTERM", shutdown)

  const mode = config.once ? "single-cycle" : `continuous (${config.pollIntervalMs}ms interval)`
  const filters = config.groupId ? ` [group_id=${config.groupId}]` : ""
  const dryRunTag = config.dryRun ? " [DRY RUN]" : ""

  console.log(`${LOG_PREFIX} Starting worker (${mode}${filters}${dryRunTag})`)

  try {
    while (running) {
      const cycleResult = await runBackfillCycle(config)

      stats.totalProcessed += cycleResult.rowsFound
      stats.successfullyEmbedded += cycleResult.succeeded
      stats.failed += cycleResult.failed
      stats.cyclesCompleted++

      if (config.once) {
        break
      }

      if (!running) {
        break
      }

      // Wait for next poll — resolves early on SIGINT
      await new Promise<void>((resolve) => {
        let resolved = false
        const done = () => {
          if (resolved) return
          resolved = true
          clearTimeout(sleepTimer)
          clearInterval(checkTimer)
          resolve()
        }

        const sleepTimer = setTimeout(done, config.pollIntervalMs)
        const checkTimer = setInterval(() => {
          if (!running) done()
        }, 1000)

        // Early exit on SIGINT during sleep
        process.once("SIGINT", done)
      })

      if (!running) {
        break
      }
    }
  } finally {
    // Remove listeners to avoid duplicates if called multiple times
    process.removeListener("SIGINT", shutdown)
    process.removeListener("SIGTERM", shutdown)

    // Report final stats
    console.log(`${LOG_PREFIX} Final stats:`, {
      totalProcessed: stats.totalProcessed,
      successfullyEmbedded: stats.successfullyEmbedded,
      failed: stats.failed,
      cyclesCompleted: stats.cyclesCompleted,
    })

    // Cleanup
    await closeRuVectorPool()
  }

  return stats
}

// ── CLI Entry Point ─────────────────────────────────────────────────────────

const isMainModule = process.argv[1]?.includes("embedding-backfill-worker.ts")

if (isMainModule) {
  const config = parseArgs(process.argv.slice(2))

  runWorker(config)
    .then((stats) => {
      console.log(`${LOG_PREFIX} Worker completed`, stats)
      process.exit(0)
    })
    .catch((err) => {
      console.error(`${LOG_PREFIX} Fatal error:`, err)
      process.exit(1)
    })
}
