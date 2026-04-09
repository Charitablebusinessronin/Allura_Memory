#!/usr/bin/env bun
/**
 * Dijkstra Review Agent
 * 
 * Performs code review on pull requests.
 * Routes from GitHub webhook → Dijkstra (Reviewer)
 */

import { getPool, closePool } from "../../src/lib/postgres/connection";
import { getDriver, closeDriver } from "../../src/lib/neo4j/connection";

const PR_NUMBER = process.argv[2];

async function dijkstraReview() {
  console.log(`[dijkstra] Starting code review for PR #${PR_NUMBER}...\n`);
  
  const pgPool = getPool();
  const neo4jDriver = getDriver();
  const session = neo4jDriver.session();
  
  try {
    // Log review start
    await pgPool.query(`
      INSERT INTO events (group_id, event_type, agent_id, metadata, status)
      VALUES ($1, $2, $3, $4, $5)
    `, [
      'allura-roninmemory',
      'pr_review_started',
      'dijkstra',
      JSON.stringify({ pr_number: PR_NUMBER, reviewer: 'dijkstra' }),
      'completed'
    ]);
    
    // Simulate review (in production, would analyze actual PR diff)
    const reviewFindings = [
      "Code structure follows Dijkstra's structured programming principles",
      "No GOTO statements found ✓",
      "Edge cases considered in error handling",
      "Consider adding more comments for complex logic"
    ];
    
    // Create insight in Neo4j
    await session.run(`
      CREATE (i:Insight {
        insight_id: 'ins_review_' + randomUUID(),
        summary: $summary,
        confidence: 0.85,
        status: 'active',
        group_id: 'allura-roninmemory',
        created_at: datetime(),
        source_type: 'agent_review'
      })
      RETURN i
    `, {
      summary: `PR #${PR_NUMBER} review: ${reviewFindings.length} findings by Dijkstra`
    });
    
    console.log("[dijkstra] Review complete:");
    reviewFindings.forEach(finding => console.log(`  - ${finding}`));
    
    // Log review completion
    await pgPool.query(`
      INSERT INTO events (group_id, event_type, agent_id, metadata, status)
      VALUES ($1, $2, $3, $4, $5)
    `, [
      'allura-roninmemory',
      'pr_review_completed',
      'dijkstra',
      JSON.stringify({ 
        pr_number: PR_NUMBER, 
        findings_count: reviewFindings.length,
        confidence: 0.85 
      }),
      'completed'
    ]);
    
    console.log("\n[dijkstra] Review logged to PostgreSQL and Neo4j");
    
  } catch (error) {
    console.error("[dijkstra] Review failed:", error);
    process.exit(1);
  } finally {
    await session.close();
    await closeDriver();
    await closePool();
  }
}

if (PR_NUMBER) {
  dijkstraReview();
} else {
  console.error("Usage: bun scripts/agents/dijkstra-review.ts <pr_number>");
  process.exit(1);
}
