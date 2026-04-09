#!/usr/bin/env bun
/**
 * Brooks Triage Agent
 * 
 * Performs issue triage and orchestration.
 * Routes from GitHub webhook → Brooks (Orchestrator)
 */

import { getPool, closePool } from "../../src/lib/postgres/connection";
import { getDriver, closeDriver } from "../../src/lib/neo4j/connection";

const ISSUE_NUMBER = process.argv[2];

async function brooksTriage() {
  console.log(`[brooks] Starting issue triage for #${ISSUE_NUMBER}...\n`);
  
  const pgPool = getPool();
  const neo4jDriver = getDriver();
  const session = neo4jDriver.session();
  
  try {
    // Log triage start
    await pgPool.query(`
      INSERT INTO events (group_id, event_type, agent_id, metadata, status)
      VALUES ($1, $2, $3, $4, $5)
    `, [
      'allura-roninmemory',
      'issue_triage_started',
      'brooks',
      JSON.stringify({ issue_number: ISSUE_NUMBER, orchestrator: 'brooks' }),
      'completed'
    ]);
    
    // Simulate triage (in production, would analyze actual issue)
    const triageResults = [
      "Issue categorized as 'feature-request'",
      "Complexity: Essential (not accidental)",
      "Recommendation: Delegate to Hopper for exploration",
      "Estimated effort: 2-3 days (Brooks's Law: adding devs won't help)"
    ];
    
    // Create insight in Neo4j
    await session.run(`
      CREATE (i:Insight {
        insight_id: 'ins_triage_' + randomUUID(),
        summary: $summary,
        confidence: 0.88,
        status: 'active',
        group_id: 'allura-roninmemory',
        created_at: datetime(),
        source_type: 'agent_triage'
      })
      RETURN i
    `, {
      summary: `Issue #${ISSUE_NUMBER} triage: ${triageResults.length} findings by Brooks`
    });
    
    console.log("[brooks] Triage complete:");
    triageResults.forEach(result => console.log(`  - ${result}`));
    
    // Log triage completion
    await pgPool.query(`
      INSERT INTO events (group_id, event_type, agent_id, metadata, status)
      VALUES ($1, $2, $3, $4, $5)
    `, [
      'allura-roninmemory',
      'issue_triage_completed',
      'brooks',
      JSON.stringify({ 
        issue_number: ISSUE_NUMBER, 
        findings_count: triageResults.length,
        confidence: 0.88 
      }),
      'completed'
    ]);
    
    console.log("\n[brooks] Triage logged to PostgreSQL and Neo4j");
    
  } catch (error) {
    console.error("[brooks] Triage failed:", error);
    process.exit(1);
  } finally {
    await session.close();
    await closeDriver();
    await closePool();
  }
}

if (ISSUE_NUMBER) {
  brooksTriage();
} else {
  console.error("Usage: bun scripts/agents/brooks-triage.ts <issue_number>");
  process.exit(1);
}
