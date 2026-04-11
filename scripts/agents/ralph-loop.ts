#!/usr/bin/env bun
/**
 * Agent: Ralph (Autonomous Loop Runner)
 * Manifest ID: ralph
 * CI Route: none (manual or issue-tagged dispatch only)
 * Model Backend: opencode (OpenCode runtime; model resolution is OpenCode's concern)
 * See: src/lib/agents/agent-manifest.ts
 *
 * Phase 3 — Full implementation pending.
 * This stub validates manifest routing and provides the contract skeleton.
 *
 * Architecture Decision (AD-16): Ralph drives the OpenCode CLI.
 * Ralph does not talk to any model directly. Ralph invokes OpenCode,
 * checks for <promise>COMPLETE</promise>, and loops. What model
 * OpenCode uses (Ollama cloud, local, etc.) is OpenCode's concern.
 * NOT github-models. NOT open-ralph-wiggum.
 *
 * Configuration: OpenCode reads model config from opencode.json or
 * ~/.config/opencode/. No separate API token required.
 *
 * Gracefully handles missing DB connections (for CI environments)
 */

const TASK_DESCRIPTION = process.argv[2];

async function ralphLoop() {
  console.log(`[ralph] Starting autonomous loop for: ${TASK_DESCRIPTION || "(no task)"}\n`);

  // OpenCode configuration — the runtime handles model resolution
  const opencodeConfig = process.env.OPENCODE_CONFIG || "opencode.json";

  console.log(`[ralph] OpenCode config: ${opencodeConfig}`);
  console.log("[ralph] Model resolution via OpenCode");
  console.log("");

  // Check if DB connections are available
  const postgresUrl = process.env.POSTGRES_URL || process.env.DATABASE_URL;
  const neo4jUri = process.env.NEO4J_URI;

  if (!postgresUrl || !neo4jUri) {
    console.log("[ralph] ⚠️  Database connections not configured (CI environment)");
  }

  console.log("[ralph] ═══════════════════════════════════════════════════════");
  console.log("[ralph]       RALPH LOOP — STUB (Phase 3)");
  console.log("[ralph] ═══════════════════════════════════════════════════════");
  console.log("");
  console.log("Model Backend: opencode");
  console.log("Runtime:       OpenCode CLI (opencode)");
  console.log("Inference:     Whatever OpenCode is configured to use");
  console.log("Config:        opencode.json / ~/.config/opencode/");
  console.log("Auth:          OpenCode manages auth internally");
  console.log("");
  console.log("Contract:");
  console.log("  1. Receive task description");
  console.log("  2. Invoke OpenCode with task prompt + fresh context");
  console.log("  3. Agent reads repo state, executes actions, writes results");
  console.log("  4. Evaluate result (check for <promise>COMPLETE</promise>)");
  console.log("  5. If <promise>COMPLETE</promise> detected → stop");
  console.log("  6. If max_iterations reached → stop with report");
  console.log("  7. Otherwise → return to step 2 with fresh context");
  console.log("");
  console.log("Safety Guards (from AD-10, AD-11):");
  console.log("  --max-iterations: bounded (default: 10)");
  console.log("  --timeout: wall-clock timeout (default: 5m)");
  console.log("  --slice-review: human review between slices");
  console.log("  --dry-run: plan only, no execution");
  console.log("");

  if (!postgresUrl || !neo4jUri) {
    console.log("[ralph] Skipping DB logging — stub mode");
    process.exit(0);
  }

  const { getPool, closePool } = await import("../../src/lib/postgres/connection");
  const { getDriver, closeDriver } = await import("../../src/lib/neo4j/connection");

  const pgPool = getPool();
  const neo4jDriver = getDriver();
  const session = neo4jDriver.session();

  try {
    await pgPool.query(`
      INSERT INTO events (group_id, event_type, agent_id, metadata, status)
      VALUES ($1, $2, $3, $4, $5)
    `, [
      "allura-memory",
      "ralph_loop_stub",
      "ralph",
      JSON.stringify({
        task: TASK_DESCRIPTION,
        model_backend: "opencode",
        auth: "OPENCODE_CONFIG",
        phase: "stub",
      }),
      "completed",
    ]);

    await session.run(`
      CREATE (i:Insight {
        insight_id: 'ins_ralph_' + randomUUID(),
        summary: $summary,
        confidence: 0.50,
        status: 'active',
        group_id: 'allura-memory',
        created_at: datetime(),
        source_type: 'agent_loop'
      })
      RETURN i
    `, {
      summary: `Ralph loop stub: Phase 3 implementation pending. Model backend: opencode.`,
    });

    console.log("[ralph] Stub logged to PostgreSQL and Neo4j");
  } catch (error) {
    console.error("[ralph] Logging failed:", error);
    process.exit(1);
  } finally {
    await session.close();
    await closeDriver();
    await closePool();
  }
}

if (TASK_DESCRIPTION) {
  ralphLoop();
} else {
  console.error("Usage: bun scripts/agents/ralph-loop.ts <task_description>");
  console.error("       bun scripts/agents/ralph-loop.ts --dry-run <task>");
  console.error("       bun scripts/agents/ralph-loop.ts --max-iterations 5 <task>");
  console.error("");
  console.error("Model backend: opencode (OpenCode CLI)");
  process.exit(1);
}