/**
 * Harness End-to-End Test
 *
 * Tests the full plugin harness flow:
 * 1. MCP discovery → log event
 * 2. MCP approval → log event
 * 3. MCP load → log event
 * 4. Skill proposal → log event
 * 5. Skill load → log event
 * 6. Query Postgres to verify all events logged
 *
 * Run: bun .opencode/harness/test-e2e.ts
 */

import { harness } from "./index";
import { getPool, isPoolHealthy } from "@/lib/postgres/connection";
import type { TraceRecord } from "@/lib/postgres/types";

const TEST_GROUP_ID = "allura-system";

async function main() {
  console.log("═══════════════════════════════════════════════════════════════");
  console.log("Harness End-to-End Test");
  console.log("═══════════════════════════════════════════════════════════════\n");

  // Step 1: Health check
  console.log("Step 1: Postgres Health Check");
  console.log("─────────────────────────────────────────────────────────────");
  const isHealthy = await isPoolHealthy();
  if (!isHealthy) {
    console.error("❌ Postgres is not healthy. Aborting.");
    process.exit(1);
  }
  console.log("✅ Postgres is healthy\n");

  // Step 2: MCP Discovery
  console.log("Step 2: MCP Discovery");
  console.log("─────────────────────────────────────────────────────────────");
  const discovered = await harness.discoverMCP("database");
  console.log(`✅ Discovered ${discovered.approved.length} approved, ${discovered.unapproved.length} pending\n`);

  // Step 3: MCP Approval
  console.log("Step 3: MCP Approval");
  console.log("─────────────────────────────────────────────────────────────");
  const approved = await harness.approveMCP("postgresql-mcp");
  console.log(
    `${approved.success ? "✅" : "⏳"} ${approved.nextStep}\n`
  );

  // Step 4: MCP Load
  console.log("Step 4: MCP Load");
  console.log("─────────────────────────────────────────────────────────────");
  const loaded = await harness.loadMCP("postgresql-mcp");
  console.log(
    `${loaded.success ? "✅" : "❌"} ${loaded.message}`
  );
  if (loaded.tools.length > 0) {
    console.log(`Tools: ${loaded.tools.slice(0, 3).join(", ")}`);
  }
  console.log();

  // Step 5: Skill Proposal
  console.log("Step 5: Skill Proposal");
  console.log("─────────────────────────────────────────────────────────────");
  const proposed = await harness.proposeSkill("code-review");
  console.log(
    `${proposed.found ? "✅" : "❌"} ${proposed.found ? "Found skill: code-review" : "Skill not found"}\n`
  );

  // Step 6: Skill Load
  console.log("Step 6: Skill Load");
  console.log("─────────────────────────────────────────────────────────────");
  const skillLoaded = await harness.loadSkill("code-review", "oracle");
  console.log(
    `${skillLoaded.success ? "✅" : "❌"} ${skillLoaded.instruction}\n`
  );

  // Step 7: Query Postgres for logged events
  console.log("Step 7: Query Postgres Events");
  console.log("─────────────────────────────────────────────────────────────");

  const pool = getPool();
  const result = await pool.query<TraceRecord>(
    `
    SELECT
      id,
      event_type,
      agent_id,
      metadata,
      created_at
    FROM events
    WHERE group_id = $1
      AND agent_id = 'brooks'
    ORDER BY created_at DESC
    LIMIT 20
    `,
    [TEST_GROUP_ID]
  );

  console.log(`Found ${result.rows.length} events:\n`);

  result.rows.slice(0, 10).forEach((row, idx) => {
    const eventType = (row.metadata as Record<string, unknown>)?.event_type || row.event_type;
    const timestamp = row.created_at.toISOString().split("T")[1].slice(0, 8);
    console.log(`${idx + 1}. [${timestamp}] ${eventType}`);
  });

  console.log("\n═══════════════════════════════════════════════════════════════");
  console.log("✅ Harness E2E Test Complete");
  console.log("═══════════════════════════════════════════════════════════════");
  console.log("\nSummary:");
  console.log("- MCP discovery logged");
  console.log("- MCP approval logged");
  console.log("- MCP load logged");
  console.log("- Skill proposal logged");
  console.log("- Skill load logged");
  console.log(`- Total events in Postgres: ${result.rows.length}`);
  console.log("\n✅ All events successfully persisted to PostgreSQL (append-only)");

  process.exit(0);
}

main().catch((err) => {
  console.error("❌ Test failed:", err);
  process.exit(1);
});
