/**
 * process-pending-proposals.ts — Batch Proposal Processor
 *
 * Iterates all pending proposals for a group and:
 *   - PROMOTION_MODE=auto + score >= threshold → auto-approves (no HITL)
 *   - PROMOTION_MODE=soc2  (or score below threshold) → logs for HITL
 *
 * Usage:
 *   PROMOTION_MODE=auto bun run src/scripts/process-pending-proposals.ts
 *   PROMOTION_MODE=auto AUTO_APPROVAL_THRESHOLD=0.8 bun run src/scripts/process-pending-proposals.ts
 *
 * Environment variables:
 *   PROMOTION_MODE            — "auto" | "soc2" (default: soc2)
 *   AUTO_APPROVAL_THRESHOLD   — number 0–1 (default: 0.75)
 *   ALLURA_GROUP_ID           — group to process (default: allura-system)
 *   PROCESS_LIMIT             — max proposals per run (default: 50)
 */

import { config } from "dotenv"

config()

import { autoPromotePendingProposals, isAutoPromoteEnabled } from "@/lib/curator/auto-promote"
import { getPool } from "@/lib/postgres/connection"

async function run() {
  const group_id = process.env.ALLURA_GROUP_ID ?? "allura-system"
  const limit = parseInt(process.env.PROCESS_LIMIT ?? "50", 10)
  const threshold = process.env.AUTO_APPROVAL_THRESHOLD
    ? parseFloat(process.env.AUTO_APPROVAL_THRESHOLD)
    : undefined

  const mode = process.env.PROMOTION_MODE ?? "soc2"
  console.log(`[process-pending-proposals] mode=${mode} group=${group_id} limit=${limit} threshold=${threshold ?? "default"}`)

  if (!isAutoPromoteEnabled()) {
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
    return
  }

  const result = await autoPromotePendingProposals({ group_id, limit, threshold })

  console.log(`[process-pending-proposals] promoted=${result.promoted.length} skipped=${result.skipped.length} errors=${result.errors.length}`)

  if (result.promoted.length > 0) {
    console.log("  Promoted:", result.promoted)
  }
  if (result.skipped.length > 0) {
    console.log("  Skipped (below threshold / HITL):", result.skipped)
  }
  if (result.errors.length > 0) {
    console.error("  Errors:", result.errors)
    process.exitCode = 1
  }

  const pg = getPool()
  await pg.end()
}

run().catch((err) => {
  console.error("[process-pending-proposals] Fatal:", err)
  process.exit(1)
})
