#!/usr/bin/env bun
/**
 * Log GitHub Events to Allura Memory
 * 
 * Logs all GitHub webhook events to PostgreSQL for agent processing.
 * Gracefully handles missing DB connections (for CI environments)
 */

// Parse CLI args early so we can exit gracefully if no DB
const args = process.argv.slice(2);
const event: Record<string, string> = {};

for (let i = 0; i < args.length; i++) {
  const arg = args[i];
  if (arg.startsWith('--')) {
    const key = arg.replace('--', '');
    const value = args[i + 1];
    if (value && !value.startsWith('--')) {
      event[key] = value;
      i++;
    }
  }
}

console.log('[log-github-event] Logging event:', event);

// Check if DB connections are available
const postgresUrl = process.env.POSTGRES_URL || process.env.DATABASE_URL;

if (!postgresUrl) {
  console.log('[log-github-event] ⚠️  Database connection not configured (CI environment)');
  console.log('[log-github-event] Skipping DB logging - event still captured in workflow');
  console.log(`[log-github-event] Event: ${event.event} by ${event.actor} on ${event.sha?.substring(0, 8)}`);
  console.log('\n[log-github-event] Run with POSTGRES_URL for full logging');
  process.exit(0);
}

import { getPool, closePool } from "../src/lib/postgres/connection";

async function logGitHubEvent() {
  console.log('[log-github-event] Logging event:', event);
  
  const pgPool = getPool();
  
  try {
    await pgPool.query(`
      INSERT INTO events (group_id, event_type, agent_id, metadata, status)
      VALUES ($1, $2, $3, $4, $5)
    `, [
      'allura-roninmemory',
      `github_${event.event}`,
      'github-webhook',
      JSON.stringify({
        actor: event.actor,
        repository: event.repo,
        commit_sha: event.sha,
        timestamp: new Date().toISOString()
      }),
      'completed'
    ]);
    
    console.log('[log-github-event] Event logged successfully');
    
  } catch (error) {
    console.error('[log-github-event] Failed to log event:', error);
    process.exit(1);
  } finally {
    await closePool();
  }
}

logGitHubEvent();
