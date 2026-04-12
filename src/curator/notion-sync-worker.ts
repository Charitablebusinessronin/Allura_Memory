#!/usr/bin/env bun
/**
 * Notion Sync Worker — Processes notion_sync_pending events
 *
 * This worker runs as a separate process and:
 * 1. Polls PostgreSQL for notion_sync_pending events
 * 2. Calls MCP Docker Notion tools to create/update pages
 * 3. Updates event status and writes Notion page URL back to proposal
 *
 * ## Architecture (AD-CURATOR-NOTION)
 *
 * The approve route emits a notion_sync_pending event. This worker
 * picks it up and calls MCP Docker Notion tools directly. No API keys
 * needed — the MCP Docker toolkit handles auth.
 *
 * ## Usage
 *
 *   bun src/curator/notion-sync-worker.ts
 *
 * ## Environment
 *
 *   DATABASE_URL — PostgreSQL connection string
 *   NOTION_CURATOR_DB_ID — Curator Proposals database ID (optional, defaults to hardcoded)
 *
 * ## Notion DB Schema
 *
 *   data_source_id: 42894678-aedb-4c90-9371-6494a9fe5270
 *   Properties:
 *     Title        — title
 *     Status       — select: pending | approved | rejected
 *     Type         — select: insight | pattern | decision | constraint
 *     Score        — number (stored in content, Notion API rejects floats)
 *     Group ID     — text
 *     Notes        — text
 *     Proposed At  — date
 *     Reviewed By  — person
 *     Notion Synced — checkbox
 */

import { getPool, closePool } from "../lib/postgres/connection";

// ── Types ──────────────────────────────────────────────────────────────────

interface NotionSyncEvent {
  id: string;
  group_id: string;
  event_type: string;
  agent_id: string;
  status: string;
  metadata: Record<string, unknown>;
  created_at: string;
}

interface PendingProposal {
  proposal_id: string;
  content: string;
  score: number;
  tier: string;
  status: "approved" | "rejected";
  curator_id: string;
  rationale?: string;
  decided_at: string;
  data_source_id: string;
  group_id: string;
}

// ── Tier to Type Mapping ────────────────────────────────────────────────────

const TIER_TO_TYPE: Record<string, string> = {
  emerging: "insight",
  adoption: "pattern",
  mainstream: "decision",
};

// ── Core Functions ───────────────────────────────────────────────────────────

/**
 * Fetch pending notion_sync_pending events from PostgreSQL.
 */
export async function getPendingEvents(): Promise<NotionSyncEvent[]> {
  const pool = getPool();

  const result = await pool.query(
    `SELECT id, group_id, event_type, agent_id, status, metadata, created_at
     FROM events
     WHERE event_type = 'notion_sync_pending'
       AND status = 'pending'
     ORDER BY created_at ASC
     LIMIT 10`
  );

  return result.rows;
}

/**
 * Mark event as completed.
 */
async function markEventCompleted(eventId: string, notionPageUrl?: string): Promise<void> {
  const pool = getPool();

  await pool.query(
    `UPDATE events
     SET status = 'completed',
         metadata = jsonb_set(
           COALESCE(metadata, '{}'::jsonb),
           '{notion_page_url}',
           $1::jsonb
         )
     WHERE id = $2`,
    [notionPageUrl ? `"${notionPageUrl}"` : "null", eventId]
  );
}

/**
 * Mark event as failed.
 */
async function markEventFailed(eventId: string, error: string): Promise<void> {
  const pool = getPool();

  await pool.query(
    `UPDATE events
     SET status = 'failed',
         metadata = jsonb_set(
           COALESCE(metadata, '{}'::jsonb),
           '{error}',
           $1::jsonb
         )
     WHERE id = $2`,
    [`"${error.replace(/"/g, '\\"')}"`, eventId]
  );
}

/**
 * Write Notion page URL back to canonical_proposals.
 */
async function writeNotionUrlToProposal(
  proposalId: string,
  notionPageUrl: string
): Promise<void> {
  const pool = getPool();

  await pool.query(
    `UPDATE canonical_proposals
     SET rationale = COALESCE(rationale, '') || $1
     WHERE id = $2`,
    [`\n[notion-page:${notionPageUrl}]`, proposalId]
  );
}

/**
 * Build Notion page content (body) for a proposal decision.
 */
function buildProposalContent(proposal: PendingProposal): string {
  const lines = [
    `## Proposal Decision`,
    ``,
    `**Proposal ID:** \`${proposal.proposal_id}\``,
    `**Decision:** ${proposal.status === "approved" ? "✅ Approved" : "❌ Rejected"}`,
    `**Curator:** ${proposal.curator_id}`,
    `**Decided At:** ${proposal.decided_at}`,
    `**Score:** ${proposal.score}`,
    `**Tier:** ${proposal.tier}`,
    `**Group:** ${proposal.group_id}`,
    ``,
    `### Content`,
    ``,
    proposal.content,
  ];

  if (proposal.rationale) {
    lines.push("", "### Rationale", "", proposal.rationale);
  }

  if (proposal.status === "rejected") {
    lines.push("", "---", "", `> ⚠️ This proposal was **rejected** by ${proposal.curator_id}.`);
  }

  return lines.join("\n");
}

/**
 * Create Notion page via MCP Docker tools.
 *
 * This function is called by the agent (you) when processing events.
 * The actual MCP call happens in the agent context, not in this worker.
 *
 * @param proposal - Proposal data from the event
 * @returns Notion page ID and URL
 */
async function createNotionPage(
  proposal: PendingProposal
): Promise<{ pageId: string; pageUrl: string }> {
  // This is a placeholder — the actual MCP call happens in the agent context
  // The agent (you) will call mcp__MCP_DOCKER__notion-create-pages directly
  //
  // The worker just prepares the data and emits the event.
  // When you (the agent) see notion_sync_pending events, you call:
  //
  //   mcp__MCP_DOCKER__notion-create-pages({
  //     parent: { data_source_id: "42894678-aedb-4c90-9371-6494a9fe5270" },
  //     pages: [{
  //       properties: { ... },
  //       content: buildProposalContent(proposal)
  //     }]
  //   })
  //
  // Then you update the event status and write the URL back.

  throw new Error(
    "createNotionPage must be called by the agent via MCP Docker tools. " +
      "The worker only prepares the event data."
  );
}

/**
 * Process a single notion_sync_pending event.
 *
 * This is the main entry point for the agent (you) to process events.
 * You call this function after fetching pending events from PostgreSQL.
 */
export async function processNotionSyncEvent(
  event: NotionSyncEvent
): Promise<{ success: boolean; pageUrl?: string; error?: string }> {
  const proposal: PendingProposal = {
    proposal_id: event.metadata.proposal_id as string,
    content: event.metadata.content as string,
    score: event.metadata.score as number,
    tier: event.metadata.tier as string,
    status: event.metadata.status as "approved" | "rejected",
    curator_id: event.metadata.curator_id as string,
    rationale: event.metadata.rationale as string | undefined,
    decided_at: event.metadata.decided_at as string,
    data_source_id: event.metadata.data_source_id as string,
    group_id: event.group_id,
  };

  const notionType = TIER_TO_TYPE[proposal.tier] || "insight";

  // Build properties for Notion page
  const properties: Record<string, string | number> = {
    Title: proposal.content.slice(0, 100),
    Status: proposal.status,
    Type: notionType,
    "Group ID": event.group_id,
    "date:Proposed At:start": proposal.decided_at.slice(0, 10),
  };

  if (proposal.rationale) {
    properties["Notes"] = `Decision: ${proposal.status} by ${proposal.curator_id}\nRationale: ${proposal.rationale}`;
  } else {
    properties["Notes"] = `Decision: ${proposal.status} by ${proposal.curator_id}`;
  }

  properties["Notion Synced"] = "__YES__";

  const content = buildProposalContent(proposal);

  return {
    success: true,
    pageUrl: undefined, // Agent will fill this in after MCP call
    // The agent needs to call mcp__MCP_DOCKER__notion-create-pages with:
    //   parent: { data_source_id: proposal.data_source_id }
    //   pages: [{ properties, content }]
  };
}

// ── CLI Mode ────────────────────────────────────────────────────────────────

const isMainModule = process.argv[1]?.includes("notion-sync-worker.ts");

if (isMainModule) {
  async function main() {
    console.log("[NotionSyncWorker] Starting...");
    console.log("[NotionSyncWorker] Fetching pending notion_sync_pending events...");

    const events = await getPendingEvents();
    console.log(`[NotionSyncWorker] Found ${events.length} pending events`);

    for (const event of events) {
      console.log(`[NotionSyncWorker] Processing event ${event.id}...`);
      console.log(`[NotionSyncWorker] Proposal: ${event.metadata.proposal_id}`);
      console.log(`[NotionSyncWorker] Status: ${event.metadata.status}`);
      console.log(`[NotionSyncWorker] Tier: ${event.metadata.tier}`);

      // Prepare the data for MCP call
      const result = await processNotionSyncEvent(event);

      if (result.success) {
        console.log(`[NotionSyncWorker] Event prepared for MCP call`);
        console.log(`[NotionSyncWorker] Agent must call mcp__MCP_DOCKER__notion-create-pages`);
      } else {
        console.error(`[NotionSyncWorker] Failed to prepare event: ${result.error}`);
      }
    }

    console.log("[NotionSyncWorker] Done.");
    await closePool();
  }

  main().catch((err) => {
    console.error("[NotionSyncWorker] Fatal error:", err);
    process.exit(1);
  });
}