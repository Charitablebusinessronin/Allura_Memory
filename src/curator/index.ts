#!/usr/bin/env bun
/**
 * Curator Workflow Runner
 *
 * Runs the curator workflow for HITL promotion of insights.
 * Usage: bun src/curator/index.ts run
 *
 * Approval: POST /api/curator/approve is the sole approval path.
 * See docs/adr/ADR-003-approve-promotions-deprecation.md
 */

import { getPool, closePool } from "../lib/postgres/connection";
import { curatorScore } from "../lib/curator/score";

// ── Core Functions ─────────────────────────────────────────────────────────

async function runCurator() {
  console.log("[Curator] Starting workflow...\n");

  const pgPool = getPool();
  
  try {
    // Step 1: Query PostgreSQL for unpromoted events
    console.log("[Curator] Querying PostgreSQL for candidate events...");
    const pgResult = await pgPool.query(`
      SELECT id, event_type, agent_id, metadata, created_at
      FROM events
      WHERE status != 'promoted'
        AND created_at > NOW() - INTERVAL '7 days'
      ORDER BY created_at DESC
      LIMIT 20
    `);
    
    console.log(`[Curator] Found ${pgResult.rows.length} candidate events\n`);
    
    // Step 2: Score each event
    const scoredEvents = [];
    for (const row of pgResult.rows) {
      const content = JSON.stringify({
        type: row.event_type,
        agent: row.agent_id,
        ...row.metadata
      });
      
      const score = await curatorScore({
        content,
        usageCount: 0,
        daysSinceCreated: Math.floor((Date.now() - new Date(row.created_at).getTime()) / (1000 * 60 * 60 * 24)),
        source: "conversation"
      });
      
      scoredEvents.push({
        ...row,
        score
      });
      
      console.log(`[Curator] Scored event ${row.id}: ${score.confidence.toFixed(2)} (${score.tier})`);
    }
    
    // Step 3: Filter high-confidence events
    const highConfidence = scoredEvents.filter(e => e.score.confidence >= 0.7);
    console.log(`\n[Curator] ${highConfidence.length} events qualify for promotion\n`);
    
    // Step 4: Create promotion proposals in PostgreSQL canonical_proposals
    for (const event of highConfidence) {
      await pgPool.query(
        `INSERT INTO canonical_proposals (id, group_id, content, score, reasoning, tier, status, trace_ref, created_at)
         VALUES (gen_random_uuid(), $1, $2, $3, $4, $5, 'pending', $6, NOW())
         ON CONFLICT DO NOTHING`,
        [
          'allura-roninmemory',
          JSON.stringify({ event_type: event.event_type, agent_id: event.agent_id, ...event.metadata }),
          event.score.confidence,
          event.score.reasoning,
          event.score.tier,
          event.id,
        ]
      );
      console.log(`[Curator] Queued proposal for event ${event.id} in canonical_proposals`);
    }
    
    console.log("\n[Curator] Workflow complete!");
    console.log("[Curator] Run POST /api/curator/approve to approve promotions");
    
  } catch (error) {
    console.error("[Curator] Error:", error);
    process.exit(1);
  } finally {
    await closePool();
  }
}

// ── CLI Mode ────────────────────────────────────────────────────────────────

const isMainModule = process.argv[1]?.includes("index.ts");
const COMMAND = process.argv[2] || "run";

if (isMainModule) {
  if (COMMAND === "run") {
    runCurator();
  } else {
    console.log("Usage: bun src/curator/index.ts run");
    console.log("Approval: POST /api/curator/approve (see ADR-003)");
    process.exit(1);
  }
}
