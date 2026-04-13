#!/usr/bin/env bun
/**
 * Curator Notion Sync — Surface proposals for human review
 *
 * Syncs pending canonical_proposals to a Notion database
 * for human-in-the-loop review.
 *
 * ## Notion Integration
 *
 * Notion page creation is performed via the `notionCreatePage` injectable
 * function. In production the caller passes a thin wrapper around
 * mcp__claude_ai_Notion__notion-create-pages (or mcp__MCP_DOCKER__notion-create-pages).
 * In tests, a mock is injected instead.
 *
 * Required env vars (only needed when using the default CLI runner):
 *   - NOTION_CURATOR_DB_ID: ID of the Curator Proposals database
 *     default: 08d2e672-2a73-45b0-a31d-b4a7be551e16
 *     data_source_id: 42894678-aedb-4c90-9371-6494a9fe5270
 *
 * ## Notion DB Schema (collection://42894678-aedb-4c90-9371-6494a9fe5270)
 *   Title        — title  (proposal content, max 100 chars)
 *   Status       — select: pending | approved | rejected
 *   Type         — select: insight | pattern | decision | constraint
 *   Score        — number
 *   Group ID     — text
 *   Notes        — text   (trace_ref + reasoning summary)
 *   Proposed At  — date
 *   Notion Synced — checkbox
 *
 * Usage: bun src/curator/notion-sync.ts [--group-id allura-roninmemory]
 */

import { getPool, closePool } from "../lib/postgres/connection";
import { insertDlqEntry } from "./notion-sync-dlq";

// ── Constants ──────────────────────────────────────────────────────────────

/**
 * Default Notion Curator Proposals database ID.
 * Override via NOTION_CURATOR_DB_ID env var.
 */
export const DEFAULT_NOTION_CURATOR_DB_ID = "08d2e672-2a73-45b0-a31d-b4a7be551e16";

/**
 * The data_source_id for the Curator Proposals collection.
 * This is the collection UUID used in mcp__claude_ai_Notion__notion-create-pages.
 */
export const NOTION_CURATOR_DATA_SOURCE_ID = "42894678-aedb-4c90-9371-6494a9fe5270";

/** Maps canonical tier values to Notion Type select options */
const TIER_TO_NOTION_TYPE: Record<string, string> = {
  emerging: "insight",
  adoption: "pattern",
  mainstream: "decision",
};

// ── Types ──────────────────────────────────────────────────────────────────

export interface PendingProposal {
  id: string;
  content: string;
  score: string;
  reasoning: string | null;
  tier: string;
  created_at: string;
  trace_ref: number | null;
}

export interface NotionSyncConfig {
  groupId: string;
  /**
   * Notion Curator Proposals database ID.
   * Defaults to DEFAULT_NOTION_CURATOR_DB_ID / NOTION_CURATOR_DB_ID env var.
   */
  notionDbId?: string;
  /**
   * Injectable Notion page creation function.
   * In production: wrap mcp__claude_ai_Notion__notion-create-pages.
   * In tests: provide a mock.
   *
   * @param params - Page creation parameters
   * @returns Object with the created page's id and url
   */
  notionCreatePage?: NotionCreatePageFn;
}

/**
 * Parameters passed to the injectable Notion page creation function.
 */
export interface NotionPageParams {
  /** data_source_id of the Curator Proposals collection */
  dataSourceId: string;
  properties: {
    Title: string;
    Status: string;
    Type: string;
    Score: number;
    "Group ID": string;
    Notes: string;
    "date:Proposed At:start": string;
    "Notion Synced": string;
  };
  content: string;
}

/**
 * Result returned by the injectable Notion page creation function.
 */
export interface NotionPageResult {
  id: string;
  url: string;
}

/**
 * Signature for the injectable Notion page creation function.
 */
export type NotionCreatePageFn = (params: NotionPageParams) => Promise<NotionPageResult>;

export interface NotionSyncResult {
  proposalsFound: number;
  proposalsSynced: number;
  syncedProposalIds: string[];
  errors: string[];
}

// ── Core Functions ─────────────────────────────────────────────────────────

/**
 * Fetch pending proposals from canonical_proposals table.
 * These are the items that need human review.
 *
 * @param groupId - Tenant identifier (must match ^allura- pattern)
 * @returns Array of pending proposals ordered by score DESC
 */
export async function getPendingProposals(groupId: string): Promise<PendingProposal[]> {
  if (!/^allura-[a-z0-9-]+$/.test(groupId)) {
    throw new Error(`Invalid group_id: ${groupId}. Must match ^allura-[a-z0-9-]+$`);
  }

  const pool = getPool();

  const result = await pool.query(
    `SELECT id, content, score, reasoning, tier, created_at, trace_ref
     FROM canonical_proposals
     WHERE group_id = $1 AND status = 'pending'
     ORDER BY score DESC, created_at ASC
     LIMIT 50`,
    [groupId]
  );

  return result.rows;
}

/**
 * Mark a proposal as synced to Notion (so we don't re-sync it).
 * Appends the Notion page ID to the proposal's rationale field.
 *
 * @param proposalId - UUID of the canonical_proposals record
 * @param notionPageId - Notion page ID returned after creation
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

/**
 * Sync pending proposals to Notion.
 *
 * When Notion is configured (NOTION_API_KEY + NOTION_CURATOR_DB_ID):
 *   - Creates a Notion page for each pending proposal
 *   - Marks each proposal as synced via markSynced()
 *
 * When Notion is NOT configured:
 *   - Returns the proposals for display/manual review
 *   - Reports proposalsSynced = 0 with a descriptive error
 *
 * @param config - Sync configuration including group_id and optional Notion credentials
 * @returns Sync result with counts and any errors
 */
export async function syncToNotion(config: NotionSyncConfig): Promise<NotionSyncResult> {
  const errors: string[] = [];
  const syncedIds: string[] = [];

  const proposals = await getPendingProposals(config.groupId);

  if (proposals.length === 0) {
    return {
      proposalsFound: 0,
      proposalsSynced: 0,
      syncedProposalIds: [],
      errors: [],
    };
  }

  // Check if Notion is configured
  if (!config.notionApiKey || !config.notionDbId) {
    return {
      proposalsFound: proposals.length,
      proposalsSynced: 0,
      syncedProposalIds: [],
      errors: [
        `Notion not configured. Set NOTION_API_KEY and NOTION_CURATOR_DB_ID to enable sync.`,
        `Found ${proposals.length} pending proposals awaiting review.`,
      ],
    };
  }

  // Notion sync would happen here via MCP_DOCKER_notion-create-pages
  // For now, we document the interface and return unsynced.
  // TODO: Wire to MCP_DOCKER_notion-create-pages when API key is available.
  for (const proposal of proposals) {
    try {
      // Placeholder: would call notion-create-pages here
      // const notionPage = await notionCreatePage({ ... });
      // await markSynced(proposal.id, notionPage.id);
      // syncedIds.push(proposal.id);

      errors.push(`Notion API call not yet wired for proposal ${proposal.id}`);
    } catch (err) {
      errors.push(`Failed to sync proposal ${proposal.id}: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  return {
    proposalsFound: proposals.length,
    proposalsSynced: syncedIds.length,
    syncedProposalIds: syncedIds,
    errors,
  };
}

// ── CLI Mode ────────────────────────────────────────────────────────────────

const isMainModule = process.argv[1]?.includes("notion-sync.ts");

if (isMainModule) {
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

  async function main() {
    console.log(`[NotionSync] Fetching pending proposals for ${GROUP_ID}...`);

    const proposals = await getPendingProposals(GROUP_ID);
    console.log(`[NotionSync] Found ${proposals.length} pending proposals`);

    for (const p of proposals) {
      console.log(`  - [${p.tier}] score=${p.score} | ${p.content.slice(0, 80)}...`);
    }

    // Attempt Notion sync if configured
    const syncResult = await syncToNotion({
      groupId: GROUP_ID,
      notionApiKey: process.env.NOTION_API_KEY,
      notionDbId: process.env.NOTION_CURATOR_DB_ID,
    });

    if (syncResult.proposalsSynced > 0) {
      console.log(`\n[NotionSync] Synced ${syncResult.proposalsSynced} proposals to Notion`);
    } else if (syncResult.errors.length > 0) {
      console.log(`\n[NotionSync] Sync status:`);
      for (const err of syncResult.errors) {
        console.log(`  - ${err}`);
      }
    }

    await closePool();
  }

  main().catch(console.error);
}