/**
 * process-pending-proposals.ts — Batch Proposal Processor
 *
 * Iterates pending proposals for a group and logs them for HITL review.
 * PROMOTION_MODE=auto is accepted only as historical configuration; it does
 * not bypass curator approval.
 *
 * Usage:
 *   bun run src/scripts/process-pending-proposals.ts
 *
 * Environment variables:
 *   PROMOTION_MODE            — "auto" | "soc2" (compatibility only)
 *   AUTO_APPROVAL_THRESHOLD   — ignored by this HITL listing script
 *   ALLURA_GROUP_ID           — group to process (default: allura-system)
 *   PROCESS_LIMIT             — max proposals per run (default: 50)
 */

import { config } from "dotenv"

config()

import { getPool } from "@/lib/postgres/connection"

async function run() {
  const group_id = process.env.ALLURA_GROUP_ID ?? "allura-system"
  const limit = parseInt(process.env.PROCESS_LIMIT ?? "50", 10)
  const threshold = process.env.AUTO_APPROVAL_THRESHOLD
    ? parseFloat(process.env.AUTO_APPROVAL_THRESHOLD)
    : undefined

  const mode = process.env.PROMOTION_MODE ?? "soc2"
  console.log(`[process-pending-proposals] mode=${mode} group=${group_id} limit=${limit} threshold=${threshold ?? "default"}`)

  const pg = getPool()
  const rows = await pg.query(
    `SELECT id, score, tier FROM canonical_proposals WHERE group_id = $1 AND status = 'pending' ORDER BY created_at ASC LIMIT $2`,
    [group_id, limit]
  )

  if (rows.rows.length === 0) {
    console.log("[process-pending-proposals] No pending proposals.")
    await pg.end()
    return
  }

  console.log(`[process-pending-proposals] ${rows.rows.length} proposals awaiting HITL review:`)
  for (const row of rows.rows) {
    console.log(`  id=${row.id} score=${row.score} tier=${row.tier}`)
  }
  await pg.end()
}

run().catch((err) => {
  console.error("[process-pending-proposals] Fatal:", err)
  process.exit(1)
})
