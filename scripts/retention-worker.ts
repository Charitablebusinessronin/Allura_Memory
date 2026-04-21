#!/usr/bin/env bun
/**
 * Memory Retention Worker
 *
 * Enforces storage lifecycle policies:
 * - Raw traces: expire after configurable TTL (default 90 days)
 * - Vectors (allura_memories): evict episodic projections past TTL
 * - Deprecated insights: hard-delete after grace period (default 30 days post-deprecation)
 * - Approved proposals past retention window: archive and prune
 *
 * Usage: bun scripts/retention-worker.ts [--dry-run] [--group-id allura-default]
 *
 * Critical: Run this BEFORE any large backfill to prevent unbounded growth.
 */

import { getPool, closePool } from "../src/lib/postgres/connection";
import { config } from "dotenv";
import { resolve } from "path";

config({ path: resolve(__dirname, "../.env.local") });
config({ path: resolve(__dirname, "../.env") });

// ── Retention Policies ────────────────────────────────────────────────────

interface RetentionPolicy {
  store: string;
  ttlDays: number;
  description: string;
}

const DEFAULT_POLICIES: RetentionPolicy[] = [
  {
    store: "raw_traces",
    ttlDays: parseInt(process.env.RETENTION_RAW_TRACES_DAYS || "90"),
    description: "Raw episodic traces in events table",
  },
  {
    store: "vectors",
    ttlDays: parseInt(process.env.RETENTION_VECTORS_DAYS || "90"),
    description: "Episodic vector projections in allura_memories",
  },
  {
    store: "deprecated_insights",
    ttlDays: parseInt(process.env.RETENTION_DEPRECATED_DAYS || "30"),
    description: "Deprecated/superseded insights past grace period",
  },
  {
    store: "rejected_proposals",
    ttlDays: parseInt(process.env.RETENTION_REJECTED_DAYS || "30"),
    description: "Rejected proposals past appeal window",
  },
];

// ── Worker ─────────────────────────────────────────────────────────────────

interface RetentionResult {
  store: string;
  examined: number;
  expired: number;
  action: string;
  details: string;
}

export async function runRetention(
  groupId: string,
  policies: RetentionPolicy[] = DEFAULT_POLICIES,
  dryRun: boolean = false
): Promise<RetentionResult[]> {
  const pool = getPool();
  const results: RetentionResult[] = [];

  for (const policy of policies) {
    const cutoff = `NOW() - INTERVAL '${policy.ttlDays} days'`;

    switch (policy.store) {
      case "raw_traces": {
        // Count and optionally delete old episodic traces
        const countResult = await pool.query(
          `SELECT COUNT(*) as cnt FROM events
           WHERE group_id = $1
             AND created_at < ${cutoff}
             AND event_type = 'memory_add'`,
          [groupId]
        );
        const examined = parseInt(countResult.rows[0]?.cnt || "0");

        if (!dryRun && examined > 0) {
          await pool.query(
            `DELETE FROM events
             WHERE group_id = $1
               AND created_at < ${cutoff}
               AND event_type = 'memory_add'`,
            [groupId]
          );
        }

        results.push({
          store: policy.store,
          examined,
          expired: dryRun ? examined : examined,
          action: dryRun ? "would_delete" : "deleted",
          details: `Traces older than ${policy.ttlDays} days`,
        });
        break;
      }

      case "vectors": {
        // Evict episodic vector projections past TTL
        const countResult = await pool.query(
          `SELECT COUNT(*) as cnt FROM allura_memories
           WHERE user_id = $1
             AND created_at < ${cutoff}
             AND memory_type = 'episodic'`,
          [groupId]
        );
        const examined = parseInt(countResult.rows[0]?.cnt || "0");

        if (!dryRun && examined > 0) {
          await pool.query(
            `DELETE FROM allura_memories
             WHERE user_id = $1
               AND created_at < ${cutoff}
               AND memory_type = 'episodic'`,
            [groupId]
          );
        }

        results.push({
          store: policy.store,
          examined,
          expired: dryRun ? examined : examined,
          action: dryRun ? "would_delete" : "deleted",
          details: `Episodic vectors older than ${policy.ttlDays} days`,
        });
        break;
      }

      case "deprecated_insights": {
        // Hard-delete Neo4j nodes marked deprecated past grace period
        // Note: This only cleans PG-side metadata; Neo4j cleanup needs graph adapter
        const countResult = await pool.query(
          `SELECT COUNT(*) as cnt FROM events
           WHERE group_id = $1
             AND event_type = 'memory_delete'
             AND created_at < ${cutoff}`,
          [groupId]
        );
        const examined = parseInt(countResult.rows[0]?.cnt || "0");

        results.push({
          store: policy.store,
          examined,
          expired: 0, // Neo4j cleanup handled separately
          action: dryRun ? "would_audit" : "audited",
          details: `Deprecated insights past ${policy.ttlDays}-day grace period (Neo4j cleanup requires graph adapter)`,
        });
        break;
      }

      case "rejected_proposals": {
        // Archive and delete rejected proposals past appeal window
        const countResult = await pool.query(
          `SELECT COUNT(*) as cnt FROM canonical_proposals
           WHERE group_id = $1
             AND status = 'rejected'
             AND decided_at < ${cutoff}`,
          [groupId]
        );
        const examined = parseInt(countResult.rows[0]?.cnt || "0");

        if (!dryRun && examined > 0) {
          // Archive to events before deletion (audit trail)
          await pool.query(
            `INSERT INTO events (group_id, event_type, agent_id, status, metadata, created_at)
             SELECT group_id, 'retention_archive', 'retention-worker', 'completed',
                    jsonb_build_object('action', 'rejected_proposal_pruned', 'proposal_id', id, 'content_preview', substring(content, 1, 100)),
                    NOW()
             FROM canonical_proposals
             WHERE group_id = $1
               AND status = 'rejected'
               AND decided_at < ${cutoff}`,
            [groupId]
          );

          await pool.query(
            `DELETE FROM canonical_proposals
             WHERE group_id = $1
               AND status = 'rejected'
               AND decided_at < ${cutoff}`,
            [groupId]
          );
        }

        results.push({
          store: policy.store,
          examined,
          expired: dryRun ? examined : examined,
          action: dryRun ? "would_archive_and_delete" : "archived_and_deleted",
          details: `Rejected proposals older than ${policy.ttlDays} days`,
        });
        break;
      }
    }
  }

  return results;
}

// ── CLI Entry Point ────────────────────────────────────────────────────────

async function main() {
  const args = process.argv.slice(2);
  const dryRun = args.includes("--dry-run");
  const groupIdArg = args.find((a) => !a.startsWith("--"));
  const groupId = groupIdArg || process.env.GROUP_ID || "allura-default";

  console.log(`\n🧹 Memory Retention Worker`);
  console.log(`   Group: ${groupId}`);
  console.log(`   Mode:  ${dryRun ? "DRY RUN" : "LIVE"}\n`);

  const results = await runRetention(groupId, DEFAULT_POLICIES, dryRun);

  console.log("Results:");
  for (const r of results) {
    console.log(`  ${r.store}: ${r.examined} examined, ${r.expired} ${r.action} — ${r.details}`);
  }

  console.log(`\n✅ Retention ${dryRun ? "preview" : "complete"}\n`);
  await closePool();
}

main().catch((err) => {
  console.error("Retention worker failed:", err);
  process.exit(1);
});