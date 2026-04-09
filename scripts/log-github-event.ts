#!/usr/bin/env bun
/**
 * Log GitHub Events to Allura Memory
 * 
 * Logs all GitHub webhook events to PostgreSQL for agent processing.
 */

import { getPool, closePool } from "../src/lib/postgres/connection";

interface GitHubEvent {
  event: string;
  actor: string;
  repo: string;
  sha?: string;
}

async function logGitHubEvent() {
  const args = process.argv.slice(2);
  const event: Partial<GitHubEvent> = {};
  
  // Parse CLI args
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg.startsWith('--')) {
      const key = arg.replace('--', '');
      const value = args[i + 1];
      if (value && !value.startsWith('--')) {
        (event as any)[key] = value;
        i++;
      }
    }
  }
  
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
