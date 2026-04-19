/**
 * P1: Bulk-reject orphan load-test proposals.
 *
 * canonical_proposals status CHECK only allows pending/approved/rejected,
 * so "cancel" = reject with rationale explaining the bulk action.
 * The log_proposal_decided trigger auto-INSERTs to the append-only events table.
 *
 * Run: bun scripts/cancel-loadtest-proposals.ts
 */
import { createHash } from "crypto";
import { getPool, closePool } from "../src/lib/postgres/connection";

const CURATOR_ID = "knuth-bulk-cancel";
const RATIONALE =
  "Bulk cancellation of orphan load-test proposals. Produced by k6 load testing; never resolved. Auto-rejected to clear the pending queue.";

async function main(): Promise<void> {
  const pool = getPool();
  const decidedAt = new Date().toISOString();

  // Diagnostic: count orphans
  const diag = await pool.query(
    `SELECT group_id, COUNT(*) AS cnt
     FROM canonical_proposals
     WHERE status = 'pending'
       AND created_at < NOW() - INTERVAL '7 days'
     GROUP BY group_id
     ORDER BY cnt DESC`
  );
  console.log("[Knuth] Pending proposals by group_id:");
  for (const row of diag.rows) {
    console.log(`  ${row.group_id}: ${row.cnt}`);
  }

  // Fetch orphans: load-test group_ids OR traced to k6 agents
  const { rows } = await pool.query<{
    id: string;
    group_id: string;
    content: string;
    score: string;
    tier: string;
  }>(
    `SELECT cp.id, cp.group_id, cp.content, cp.score, cp.tier
     FROM canonical_proposals cp
     WHERE cp.status = 'pending'
       AND (
         cp.group_id LIKE '%-loadtest'
         OR cp.trace_ref IN (
           SELECT e.id FROM events e
           WHERE e.agent_id LIKE 'k6-%'
              OR e.group_id LIKE '%-loadtest'
         )
       )`
  );

  if (rows.length === 0) {
    // Fallback: grab all stale pending proposals older than 7 days
    const fallback = await pool.query<{
      id: string;
      group_id: string;
      content: string;
      score: string;
      tier: string;
    }>(
      `SELECT id, group_id, content, score, tier
       FROM canonical_proposals
       WHERE status = 'pending'
         AND created_at < NOW() - INTERVAL '7 days'`
    );
    if (fallback.rows.length === 0) {
      console.log("[Knuth] No orphan proposals found. Done.");
      await closePool();
      return;
    }
    console.log(
      `[Knuth] No k6/loadtest matches, but found ${fallback.rows.length} stale pending proposals (>7d). Rejecting those.`
    );
    rows.push(...fallback.rows);
  }

  console.log(`[Knuth] Rejecting ${rows.length} orphan proposals...`);

  let count = 0;
  for (const row of rows) {
    const witnessPayload = `${row.id}|${row.group_id}|${row.content}|${row.score}|${row.tier}|rejected|${decidedAt}|${CURATOR_ID}`;
    const witness_hash = createHash("shake256", { outputLength: 64 })
      .update(witnessPayload)
      .digest("hex");

    const result = await pool.query(
      `UPDATE canonical_proposals
       SET status       = 'rejected',
           decided_at   = $1,
           decided_by   = $2,
           rationale    = $3,
           witness_hash = $4
       WHERE id = $5
         AND group_id = $6
         AND status = 'pending'`,
      [decidedAt, CURATOR_ID, RATIONALE, witness_hash, row.id, row.group_id]
    );
    if (result.rowCount && result.rowCount > 0) count++;
  }

  console.log(`[Knuth] Rejected ${count}/${rows.length} proposals.`);

  // Verify
  const verify = await pool.query(
    `SELECT COUNT(*) AS remaining FROM canonical_proposals WHERE status = 'pending'`
  );
  console.log(
    `[Knuth] Remaining pending proposals: ${verify.rows[0].remaining}`
  );

  await closePool();
}

main().catch((err) => {
  console.error("[Knuth] Fatal:", err);
  process.exit(1);
});
