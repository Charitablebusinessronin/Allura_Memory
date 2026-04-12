#!/usr/bin/env bun
/**
 * Curator Workflow Runner
 * 
 * Runs the curator workflow for HITL promotion of insights.
 * Usage: bun src/curator/index.ts run
 */

// TODO: Remove approvePromotions() after all integrations use POST /api/curator/approve

import { getPool, closePool } from "../lib/postgres/connection";
import { getDriver, closeDriver } from "../lib/neo4j/connection";
import { curatorScore } from "../lib/curator/score";
import { Neo4jQueryError, Neo4jConnectionError } from "../lib/errors/neo4j-errors";

// ── Error Types ────────────────────────────────────────────────────────────

/**
 * Thrown when approvePromotions() is called outside of explicitly
 * permitted contexts (MIGRATION_MODE or DEBUG_LEGACY).
 *
 * This error is the hard-block — it prevents the legacy Neo4j-based
 * approval path from being used in operational contexts.
 * The sole operational approval path is POST /api/curator/approve.
 */
export class DeprecatedApprovalPathError extends Error {
  constructor() {
    super(
      "approvePromotions() is deprecated. Use /api/curator/approve. " +
        "Set MIGRATION_MODE=true only for explicit migration contexts."
    );
    this.name = "DeprecatedApprovalPathError";
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

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

/**
 * @deprecated Use POST /api/curator/approve instead.
 * This function reads from legacy PromotionProposal Neo4j nodes
 * which will be removed in a future version.
 *
 * HARD-BLOCK: This function throws DeprecatedApprovalPathError unless
 * called with MIGRATION_MODE=true or DEBUG_LEGACY=true.
 * No other calling context is permitted.
 */
export async function approvePromotions(): Promise<void> {
  // ── HARD-BLOCK GUARD ────────────────────────────────────────────────────
  // The sole operational approval path is POST /api/curator/approve.
  // This function may ONLY be called in explicit migration or debug contexts.
  if (process.env.MIGRATION_MODE !== "true" && process.env.DEBUG_LEGACY !== "true") {
    throw new DeprecatedApprovalPathError();
  }

  // Log which bypass flag is in effect
  if (process.env.MIGRATION_MODE === "true") {
    console.warn("[MIGRATION] approvePromotions() called with MIGRATION_MODE=true — legacy path permitted for migration only.");
  }
  if (process.env.DEBUG_LEGACY === "true") {
    console.warn("[DEBUG] approvePromotions() called with DEBUG_LEGACY=true — legacy path permitted for debugging only.");
  }

  console.warn("[DEPRECATED] approvePromotions() is deprecated. Use POST /api/curator/approve instead.");

  console.log("[Curator] Approving promotions...\n");
  
  const neo4jDriver = getDriver();
  const session = neo4jDriver.session();
  
  try {
    let result;
    try {
      result = await session.run(`
        MATCH (p:PromotionProposal)
        WHERE p.status = 'pending'
          AND p.group_id = 'allura-roninmemory'
        RETURN p.event_id AS eventId,
               p.confidence AS confidence,
               p.reasoning AS reasoning
        LIMIT 10
      `);
    } catch (err) {
      throw new Neo4jQueryError('MATCH pending PromotionProposals', err instanceof Error ? err : new Error(String(err)));
    }
    
    console.log(`[Curator] Found ${result.records.length} pending proposals\n`);
    
    for (const record of result.records) {
      const eventId = record.get('eventId');
      const confidence = record.get('confidence');
      
      // Create Insight node
      try {
        await session.run(`
          MATCH (p:PromotionProposal {event_id: $eventId})
          CREATE (i:Insight {
            insight_id: 'ins_' + randomUUID(),
            summary: p.reasoning,
            confidence: p.confidence,
            status: 'active',
            created_at: datetime(),
            group_id: p.group_id
          })
          CREATE (p)-[:PROMOTED_TO]->(i)
          SET p.status = 'approved',
              p.approved_at = datetime()
          RETURN i
        `, { eventId });
      } catch (err) {
        throw new Neo4jQueryError('CREATE Insight', err instanceof Error ? err : new Error(String(err)));
      }
      
      console.log(`[Curator] Approved and promoted: ${eventId} (${confidence})`);
    }
    
    console.log("\n[Curator] Approval complete!");
    
  } catch (error) {
    if (error instanceof Neo4jConnectionError) {
      console.error("[Curator] Neo4j connection failed:", error.message);
    } else {
      console.error("[Curator] Error:", error);
    }
    process.exit(1);
  } finally {
    await session.close();
    await closeDriver();
  }
}

// ── CLI Mode ────────────────────────────────────────────────────────────────

const isMainModule = process.argv[1]?.includes("index.ts");
const COMMAND = process.argv[2] || "run";

if (isMainModule) {
  if (COMMAND === "run") {
    runCurator();
  } else if (COMMAND === "approve") {
    // HARD-BLOCK: CLI 'approve' command also requires env flags
    if (process.env.MIGRATION_MODE !== "true" && process.env.DEBUG_LEGACY !== "true") {
      console.error(
        "[BLOCKED] 'curator approve' is deprecated. Use POST /api/curator/approve instead.\n" +
        "  Set MIGRATION_MODE=true for explicit migration, or DEBUG_LEGACY=true for debugging."
      );
      process.exit(1);
    }
    approvePromotions();
  } else {
    console.log("Usage: bun src/curator/index.ts [run|approve]");
    process.exit(1);
  }
}
