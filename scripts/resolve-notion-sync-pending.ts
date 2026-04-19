/**
 * P1: Bulk-resolve stale notion_sync_pending events.
 *
 * These are orphan sync events from load testing / old curator runs.
 * Since no Notion pages need to be created for stale test data,
 * we skip the MCP call and just append completion events.
 *
 * Append-only: INSERTs only, no UPDATE/DELETE on events table.
 *
 * Run: bun scripts/resolve-notion-sync-pending.ts
 */
import { getPool, closePool } from "../src/lib/postgres/connection";

async function main(): Promise<void> {
  const pool = getPool();

  // Find all pending notion sync events
  const { rows } = await pool.query<{
    id: string;
    group_id: string;
  }>(
    `SELECT id, group_id
     FROM events
     WHERE event_type = 'notion_sync_pending'
       AND status = 'pending'`
  );

  console.log(`[NotionSync] Found ${rows.length} pending sync events.`);

  if (rows.length === 0) {
    console.log("[NotionSync] Nothing to resolve. Done.");
    await closePool();
    return;
  }

  // Append completion events (one per pending event)
  let count = 0;
  for (const row of rows) {
    const result = await pool.query(
      `INSERT INTO events (group_id, event_type, agent_id, status, metadata, created_at)
       VALUES ($1, 'notion_sync_completed', 'notion-sync-worker', 'completed',
               $2::jsonb, NOW())`,
      [
        row.group_id,
        JSON.stringify({
          supersedes_id: row.id,
          notion_page_url: null,
          skipped_reason: "manual_resolution — stale load-test orphan, no Notion page needed",
        }),
      ]
    );
    if (result.rowCount && result.rowCount > 0) count++;
  }

  console.log(`[NotionSync] Resolved ${count}/${rows.length} sync events.`);

  // Verify: re-check pending count
  const verify = await pool.query(
    `SELECT COUNT(*) AS remaining
     FROM events
     WHERE event_type = 'notion_sync_pending'
       AND status = 'pending'
       AND id NOT IN (
         SELECT (metadata->>'supersedes_id')::bigint
         FROM events
         WHERE event_type = 'notion_sync_completed'
       )`
  );
  console.log(
    `[NotionSync] Unresolved pending events: ${verify.rows[0].remaining}`
  );

  await closePool();
}

main().catch((err) => {
  console.error("[NotionSync] Fatal:", err);
  process.exit(1);
});
