#!/usr/bin/env bun
/**
 * Curator Watchdog — Autonomous Scoring Loop
 *
 * Polls PostgreSQL for unpromoted events, scores them,
 * and creates proposals in canonical_proposals for human review.
 *
 * Brooks principle: The architecture is the curator queue;
 * the watchdog is merely the implementation that feeds it.
 *
 * Usage: bun src/curator/watchdog.ts [--interval 60] [--group-id allura-roninmemory]
 */

import { getPool, closePool } from "../lib/postgres/connection";
import { curatorScore } from "../lib/curator/score";

export interface WatchdogConfig {
  groupId: string;
  scoreThreshold: number;
}

/**
 * Scan for unpromoted events and create proposals for those that pass scoring.
 * Returns the number of proposals created in this cycle.
 *
 * @param config - Watchdog configuration (group_id and score threshold)
 * @returns Number of proposals created
 */
export async function scanAndPropose(config: WatchdogConfig): Promise<number> {
  const pool = getPool();

  // Find events that don't have a corresponding proposal yet.
  // Exclude system-generated event types (trigger artifacts) to prevent
  // the log_proposal_created trigger from creating a re-scan loop.
  const result = await pool.query(`
    SELECT e.id, e.event_type, e.agent_id, e.metadata, e.created_at
    FROM events e
    WHERE e.group_id = $1
      AND e.status != 'promoted'
      AND e.agent_id != 'system'
      AND e.agent_id NOT LIKE 'k6-%'
      AND e.event_type NOT IN ('proposal_created', 'proposal_decided', 'proposal_approved', 'proposal_rejected', 'session_start', 'session_end', 'WATCHDOG_HEARTBEAT', 'notion_sync_pending')
      AND NOT EXISTS (
        SELECT 1 FROM canonical_proposals cp
        WHERE cp.trace_ref = e.id
      )
      AND e.created_at > NOW() - INTERVAL '7 days'
    ORDER BY e.created_at DESC
    LIMIT 50
  `, [config.groupId]);

  let proposalsCreated = 0;

  for (const row of result.rows) {
    const content = JSON.stringify({
      type: row.event_type,
      agent: row.agent_id,
      ...row.metadata,
    });

    const score = await curatorScore({
      content,
      usageCount: 0,
      daysSinceCreated: Math.floor(
        (Date.now() - new Date(row.created_at).getTime()) / (1000 * 60 * 60 * 24)
      ),
      source: "conversation",
    });

    if (score.confidence >= config.scoreThreshold) {
      await pool.query(
        `INSERT INTO canonical_proposals (id, group_id, content, score, reasoning, tier, status, trace_ref, created_at)
         VALUES (gen_random_uuid(), $1, $2, $3, $4, $5, 'pending', $6, NOW())
         ON CONFLICT DO NOTHING`,
        [
          config.groupId,
          content,
          score.confidence,
          score.reasoning,
          score.tier,
          row.id,
        ]
      );
      proposalsCreated++;
      console.log(`[Watchdog] Queued proposal for event ${row.id}: ${score.confidence.toFixed(2)} (${score.tier})`);
    }
  }

  return proposalsCreated;
}

// ── CLI Mode ────────────────────────────────────────────────────────────────

// Only run CLI when executed directly (not when imported)
const isMainModule = process.argv[1]?.includes("watchdog.ts");

if (isMainModule) {
  // Parse CLI args
  const args = process.argv.slice(2);
  function getArg(name: string, defaultValue: string): string {
    const idx = args.indexOf(`--${name}`);
    return idx >= 0 && args[idx + 1] ? args[idx + 1] : defaultValue;
  }

  const INTERVAL_MS = parseInt(getArg("interval", "60"), 10) * 1000;
  const GROUP_ID = getArg("group-id", "allura-roninmemory");
  const SCORE_THRESHOLD = parseFloat(getArg("threshold", "0.7"));

  // Validate group_id format
  if (!/^allura-[a-z0-9-]+$/.test(GROUP_ID)) {
    console.error(`[Watchdog] Invalid group_id: ${GROUP_ID}. Must match ^allura-[a-z0-9-]+$`);
    process.exit(1);
  }

  const watchdogConfig: WatchdogConfig = {
    groupId: GROUP_ID,
    scoreThreshold: SCORE_THRESHOLD,
  };

  async function main() {
    console.log(`[Watchdog] Starting autonomous curator loop`);
    console.log(`[Watchdog] group_id=${GROUP_ID}, interval=${INTERVAL_MS / 1000}s, threshold=${SCORE_THRESHOLD}`);

    let cycleCount = 0;
    const pool = getPool();

    async function runCycle(): Promise<void> {
      cycleCount++;
      const newProposals = await scanAndPropose(watchdogConfig);
      await pool.query(
        `INSERT INTO events (event_type, agent_id, group_id, metadata, created_at)
         VALUES ($1, $2, $3, $4, NOW())`,
        [
          'WATCHDOG_HEARTBEAT',
          'watchdog',
          watchdogConfig.groupId,
          JSON.stringify({ proposals_created: newProposals, scan_cycle: cycleCount }),
        ]
      );
      return newProposals > 0
        ? void console.log(`[Watchdog] Scan complete: ${newProposals} new proposals`)
        : undefined;
    }

    // Run first scan immediately
    await runCycle();
    console.log(`[Watchdog] Initial scan complete (cycle 1)`);

    // Then loop
    setInterval(async () => {
      try {
        await runCycle();
      } catch (error) {
        console.error("[Watchdog] Scan failed:", error);
      }
    }, INTERVAL_MS);
  }

  main().catch(console.error);

  // Graceful shutdown
  process.on("SIGINT", async () => {
    console.log("\n[Watchdog] Shutting down...");
    await closePool();
    process.exit(0);
  });
}