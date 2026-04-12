#!/usr/bin/env bun
/**
 * Curator Notion Sync — Surface proposals for human review
 *
 * Syncs pending canonical_proposals to a Notion database
 * for human-in-the-loop review.
 *
 * Usage: bun src/curator/notion-sync.ts [--group-id allura-roninmemory]
 */

import { getPool, closePool } from "../lib/postgres/connection";

// NOTE: Actual Notion API calls would go through MCP_DOCKER notion tools.
// This module provides the query layer that feeds Notion sync.
// The Notion database creation and page writing is done via
// MCP_DOCKER_notion-create-database and MCP_DOCKER_notion-create-pages.

const args = process.argv.slice(2);
function getArg(name: string, defaultValue: string): string {
  const idx = args.indexOf(`--${name}`);
  return idx >= 0 && args[idx + 1] ? args[idx + 1] : defaultValue;
}

const GROUP_ID = getArg("group-id", "allura-roninmemory");

// Validate group_id format
if (!/^allura-[a-z0-9-]+$/.test(GROUP_ID)) {
  console.error(`[NotionSync] Invalid group_id: ${GROUP_ID}. Must match ^allura-[a-z0-9-]+$`);
  process.exit(1);
}

export interface PendingProposal {
  id: string;
  content: string;
  score: string;
  reasoning: string | null;
  tier: string;
  created_at: string;
  trace_ref: number | null;
}

/**
 * Fetch pending proposals from canonical_proposals table.
 * These are the items that need human review.
 */
export async function getPendingProposals(): Promise<PendingProposal[]> {
  const pool = getPool();

  const result = await pool.query(
    `SELECT id, content, score, reasoning, tier, created_at, trace_ref
     FROM canonical_proposals
     WHERE group_id = $1 AND status = 'pending'
     ORDER BY score DESC, created_at ASC
     LIMIT 50`,
    [GROUP_ID]
  );

  return result.rows;
}

/**
 * Mark a proposal as synced to Notion (so we don't re-sync it).
 * Stores the Notion page ID in the proposal's metadata.
 */
export async function markSynced(proposalId: string, notionPageId: string): Promise<void> {
  const pool = getPool();

  await pool.query(
    `UPDATE canonical_proposals
     SET rationale = COALESCE(rationale, '') || $1
     WHERE id = $2`,
    [`[notion:${notionPageId}]`, proposalId]
  );
}

// Main execution
async function main() {
  console.log(`[NotionSync] Fetching pending proposals for ${GROUP_ID}...`);

  const proposals = await getPendingProposals();
  console.log(`[NotionSync] Found ${proposals.length} pending proposals`);

  for (const p of proposals) {
    console.log(`  - [${p.tier}] score=${p.score} | ${p.content.slice(0, 80)}...`);
  }

  console.log(`\n[NotionSync] To sync to Notion, use MCP_DOCKER notion-create-pages with this data.`);

  await closePool();
}

main().catch(console.error);