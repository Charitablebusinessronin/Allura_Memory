/**
 * Tests for Notion Sync Dead Letter Queue (DLQ)
 *
 * Tests the DLQ system for handling Notion sync failures:
 * 1. Insert failed events into DLQ
 * 2. Exponential backoff retry scheduling
 * 3. Status transitions (pending_retry → retrying → completed/permanently_failed)
 * 4. Requeue permanently failed entries
 * 5. DLQ statistics
 * 6. group_id validation enforcement
 * 7. Integration with notion-sync-worker
 *
 * Run with: bun vitest run src/__tests__/notion-sync-dlq.test.ts
 */

import { describe, it, expect, beforeEach, afterEach, vi, beforeAll, afterAll } from "vitest";
import { Pool } from "pg";
import { randomUUID } from "crypto";
import { config } from "dotenv";

import {
  insertDlqEntry,
  getRetryableEntries,
  markEntryRetrying,
  markEntryCompleted,
  markEntryFailed,
  getPermanentlyFailedEntries,
  getDlqStats,
  requeueFailedEntry,
  calculateNextRetryAt,
  BACKOFF_SCHEDULE_SECONDS,
  MAX_RETRIES,
  type DlqEntry,
} from "../curator/notion-sync-dlq";

import {
  handleNotionSyncFailure,
  processDlqRetries,
  type NotionSyncEvent,
} from "../curator/notion-sync-worker";

// Load environment variables
config();

// Skip E2E tests unless explicitly enabled
const shouldRunE2E = process.env.RUN_E2E_TESTS === "true";
const E2E_TIMEOUT = 30000;

// Per-run isolation
const RUN_ID = randomUUID().slice(0, 8);
const GROUP_ID = `allura-dlq-test-${RUN_ID}` as const;

// ── Unit Tests (no DB required) ─────────────────────────────────────────────

describe("Notion Sync DLQ — Unit Tests", () => {
  describe("calculateNextRetryAt", () => {
    it("should calculate first retry at +1 minute", () => {
      const before = Date.now();
      const result = calculateNextRetryAt(0);
      const after = Date.now();

      const resultTime = new Date(result).getTime();
      // Should be approximately 60 seconds from now
      expect(resultTime).toBeGreaterThanOrEqual(before + 59_000);
      expect(resultTime).toBeLessThanOrEqual(after + 61_000);
    });

    it("should calculate second retry at +5 minutes", () => {
      const before = Date.now();
      const result = calculateNextRetryAt(1);
      const after = Date.now();

      const resultTime = new Date(result).getTime();
      // Should be approximately 300 seconds from now
      expect(resultTime).toBeGreaterThanOrEqual(before + 299_000);
      expect(resultTime).toBeLessThanOrEqual(after + 301_000);
    });

    it("should calculate third retry at +15 minutes", () => {
      const before = Date.now();
      const result = calculateNextRetryAt(2);
      const after = Date.now();

      const resultTime = new Date(result).getTime();
      expect(resultTime).toBeGreaterThanOrEqual(before + 899_000);
      expect(resultTime).toBeLessThanOrEqual(after + 901_000);
    });

    it("should calculate fourth retry at +1 hour", () => {
      const before = Date.now();
      const result = calculateNextRetryAt(3);
      const after = Date.now();

      const resultTime = new Date(result).getTime();
      expect(resultTime).toBeGreaterThanOrEqual(before + 3_599_000);
      expect(resultTime).toBeLessThanOrEqual(after + 3_601_000);
    });

    it("should calculate fifth retry at +6 hours", () => {
      const before = Date.now();
      const result = calculateNextRetryAt(4);
      const after = Date.now();

      const resultTime = new Date(result).getTime();
      expect(resultTime).toBeGreaterThanOrEqual(before + 21_599_000);
      expect(resultTime).toBeLessThanOrEqual(after + 21_601_000);
    });

    it("should clamp retry count beyond schedule to last entry", () => {
      const before = Date.now();
      const result = calculateNextRetryAt(99); // Way beyond max
      const after = Date.now();

      const resultTime = new Date(result).getTime();
      // Should use the last schedule entry (6 hours = 21600 seconds)
      expect(resultTime).toBeGreaterThanOrEqual(before + 21_599_000);
      expect(resultTime).toBeLessThanOrEqual(after + 21_601_000);
    });

    it("should return ISO-8601 formatted string", () => {
      const result = calculateNextRetryAt(0);
      // Should be parseable as a date
      expect(new Date(result).toISOString()).toBe(result);
    });
  });

  describe("Constants", () => {
    it("should have 5 backoff schedule entries", () => {
      expect(BACKOFF_SCHEDULE_SECONDS).toHaveLength(5);
    });

    it("should have backoff schedule in ascending order", () => {
      for (let i = 1; i < BACKOFF_SCHEDULE_SECONDS.length; i++) {
        expect(BACKOFF_SCHEDULE_SECONDS[i]).toBeGreaterThan(BACKOFF_SCHEDULE_SECONDS[i - 1]);
      }
    });

    it("should have backoff schedule matching spec: 1min, 5min, 15min, 1hr, 6hr", () => {
      expect(BACKOFF_SCHEDULE_SECONDS[0]).toBe(60);     // 1 minute
      expect(BACKOFF_SCHEDULE_SECONDS[1]).toBe(300);    // 5 minutes
      expect(BACKOFF_SCHEDULE_SECONDS[2]).toBe(900);    // 15 minutes
      expect(BACKOFF_SCHEDULE_SECONDS[3]).toBe(3600);   // 1 hour
      expect(BACKOFF_SCHEDULE_SECONDS[4]).toBe(21600);  // 6 hours
    });

    it("should have MAX_RETRIES = 5", () => {
      expect(MAX_RETRIES).toBe(5);
    });
  });

  describe("insertDlqEntry — group_id validation", () => {
    it("should reject null group_id", async () => {
      const mockPool = new Pool(); // Won't actually connect

      await expect(
        insertDlqEntry(mockPool, {
          groupId: null as unknown as string,
          originalMetadata: {},
          errorMessage: "test error",
        })
      ).rejects.toThrow();
    });

    it("should reject empty group_id", async () => {
      const mockPool = new Pool();

      await expect(
        insertDlqEntry(mockPool, {
          groupId: "",
          originalMetadata: {},
          errorMessage: "test error",
        })
      ).rejects.toThrow();
    });

    it("should reject group_id without allura- prefix", async () => {
      const mockPool = new Pool();

      await expect(
        insertDlqEntry(mockPool, {
          groupId: "invalid-group",
          originalMetadata: {},
          errorMessage: "test error",
        })
      ).rejects.toThrow();
    });

    it("should reject group_id with uppercase characters", async () => {
      const mockPool = new Pool();

      await expect(
        insertDlqEntry(mockPool, {
          groupId: "allura-TestGroup",
          originalMetadata: {},
          errorMessage: "test error",
        })
      ).rejects.toThrow();
    });
  });

  describe("getRetryableEntries — group_id validation", () => {
    it("should reject invalid group_id", async () => {
      const mockPool = new Pool();

      await expect(
        getRetryableEntries(mockPool, "invalid-group", 10)
      ).rejects.toThrow();
    });
  });

  describe("markEntryRetrying — group_id validation", () => {
    it("should reject invalid group_id", async () => {
      const mockPool = new Pool();

      const result = await markEntryRetrying(mockPool, 1, "invalid-group");
      expect(result.success).toBe(false);
    });
  });

  describe("markEntryCompleted — group_id validation", () => {
    it("should reject invalid group_id", async () => {
      const mockPool = new Pool();

      const result = await markEntryCompleted(mockPool, 1, "invalid-group", "page-123", "https://notion.so/page-123");
      expect(result.success).toBe(false);
    });
  });

  describe("markEntryFailed — group_id validation", () => {
    it("should reject invalid group_id", async () => {
      const mockPool = new Pool();

      const result = await markEntryFailed(mockPool, 1, "invalid-group", "error");
      expect(result.success).toBe(false);
    });
  });

  describe("getDlqStats — group_id validation", () => {
    it("should reject invalid group_id", async () => {
      const mockPool = new Pool();

      await expect(
        getDlqStats(mockPool, "invalid-group")
      ).rejects.toThrow();
    });
  });

  describe("requeueFailedEntry — group_id validation", () => {
    it("should reject invalid group_id", async () => {
      const mockPool = new Pool();

      const result = await requeueFailedEntry(mockPool, 1, "invalid-group");
      expect(result.success).toBe(false);
    });
  });
});

// ── Integration Tests (require DB) ──────────────────────────────────────────

describe.skipIf(!shouldRunE2E)("Notion Sync DLQ — Integration Tests", () => {
  let pgPool: Pool;

  beforeAll(async () => {
    if (!process.env.POSTGRES_PASSWORD) {
      throw new Error("POSTGRES_PASSWORD environment variable is required");
    }

    const databaseUrl = process.env.DATABASE_URL || process.env.POSTGRES_URL;
    if (databaseUrl) {
      pgPool = new Pool({ connectionString: databaseUrl });
    } else {
      pgPool = new Pool({
        host: process.env.POSTGRES_HOST || "localhost",
        port: parseInt(process.env.POSTGRES_PORT || "5432", 10),
        database: process.env.POSTGRES_DB || "memory",
        user: process.env.POSTGRES_USER || "ronin4life",
        password: process.env.POSTGRES_PASSWORD,
        connectionTimeoutMillis: 10000,
        idleTimeoutMillis: 30000,
        max: 10,
      });
    }

    // Verify connection
    await pgPool.query("SELECT 1");
  }, E2E_TIMEOUT);

  afterAll(async () => {
    // Clean up test data
    if (pgPool) {
      await pgPool.query("DELETE FROM notion_sync_dlq WHERE group_id = $1", [GROUP_ID]);
      await pgPool.end();
    }
  }, E2E_TIMEOUT);

  beforeEach(async () => {
    // Clean up before each test
    await pgPool.query("DELETE FROM notion_sync_dlq WHERE group_id = $1", [GROUP_ID]);
  });

  // ── Test 1: Insert DLQ entry ──────────────────────────────────────────────

  it("should insert a DLQ entry for a failed Notion sync", async () => {
    const result = await insertDlqEntry(pgPool, {
      groupId: GROUP_ID,
      originalMetadata: {
        proposal_id: "test-proposal-1",
        content: "Test proposal content",
        score: 0.85,
        tier: "mainstream",
        status: "approved",
      },
      errorMessage: "Notion API returned 500 Internal Server Error",
      errorCode: "NOTION_API_500",
    });

    expect(result.success).toBe(true);
    expect(result.dlqId).toBeDefined();

    // Verify the entry was inserted
    const { rows } = await pgPool.query(
      "SELECT * FROM notion_sync_dlq WHERE id = $1 AND group_id = $2",
      [result.dlqId, GROUP_ID]
    );

    expect(rows).toHaveLength(1);
    expect(rows[0].status).toBe("pending_retry");
    expect(rows[0].retry_count).toBe(0);
    expect(rows[0].max_retries).toBe(5);
    expect(rows[0].error_message).toBe("Notion API returned 500 Internal Server Error");
    expect(rows[0].error_code).toBe("NOTION_API_500");
  }, E2E_TIMEOUT);

  // ── Test 2: Insert with original event reference ──────────────────────────

  it("should insert a DLQ entry with original event and proposal references", async () => {
    // First create an event to reference
    const eventResult = await pgPool.query(
      `INSERT INTO events (group_id, event_type, agent_id, status, metadata)
       VALUES ($1, 'notion_sync_pending', 'curator-approve', 'pending', $2)
       RETURNING id`,
      [GROUP_ID, JSON.stringify({ proposal_id: "test-proposal-2" })]
    );

    const eventId = eventResult.rows[0].id;

    const result = await insertDlqEntry(pgPool, {
      groupId: GROUP_ID,
      originalEventId: eventId,
      proposalId: "test-proposal-2",
      originalMetadata: {
        proposal_id: "test-proposal-2",
        content: "Test with event reference",
      },
      errorMessage: "Network timeout",
    });

    expect(result.success).toBe(true);

    // Verify references
    const { rows } = await pgPool.query(
      "SELECT * FROM notion_sync_dlq WHERE id = $1 AND group_id = $2",
      [result.dlqId, GROUP_ID]
    );

    expect(rows[0].original_event_id).toBe(eventId);
    expect(rows[0].proposal_id).toBe("test-proposal-2");
  }, E2E_TIMEOUT);

  // ── Test 3: Get retryable entries ─────────────────────────────────────────

  it("should fetch retryable entries that are due for retry", async () => {
    // Insert an entry with next_retry_at in the past
    await pgPool.query(
      `INSERT INTO notion_sync_dlq (group_id, original_metadata, error_message, retry_count, max_retries, next_retry_at, status)
       VALUES ($1, $2, 'Test error', 0, 5, NOW() - INTERVAL '1 minute', 'pending_retry')`,
      [GROUP_ID, JSON.stringify({ proposal_id: "retry-test" })]
    );

    const entries = await getRetryableEntries(pgPool, GROUP_ID, 10);

    expect(entries.length).toBeGreaterThanOrEqual(1);
    expect(entries[0].status).toBe("pending_retry");
    expect(entries[0].group_id).toBe(GROUP_ID);
  }, E2E_TIMEOUT);

  // ── Test 4: Entries not yet due should not be returned ─────────────────────

  it("should not fetch entries with future next_retry_at", async () => {
    // Insert an entry with next_retry_at in the future
    await pgPool.query(
      `INSERT INTO notion_sync_dlq (group_id, original_metadata, error_message, retry_count, max_retries, next_retry_at, status)
       VALUES ($1, $2, 'Future retry', 0, 5, NOW() + INTERVAL '1 hour', 'pending_retry')`,
      [GROUP_ID, JSON.stringify({ proposal_id: "future-retry" })]
    );

    const entries = await getRetryableEntries(pgPool, GROUP_ID, 10);

    // Should not include the future entry
    const futureEntries = entries.filter((e) => e.error_message === "Future retry");
    expect(futureEntries).toHaveLength(0);
  }, E2E_TIMEOUT);

  // ── Test 5: Mark entry as retrying ─────────────────────────────────────────

  it("should mark an entry as retrying and increment retry_count", async () => {
    const insertResult = await insertDlqEntry(pgPool, {
      groupId: GROUP_ID,
      originalMetadata: { proposal_id: "retrying-test" },
      errorMessage: "Initial error",
    });

    const dlqId = insertResult.dlqId!;

    const result = await markEntryRetrying(pgPool, dlqId, GROUP_ID);
    expect(result.success).toBe(true);

    // Verify retry_count was incremented
    const { rows } = await pgPool.query(
      "SELECT retry_count, status, last_retry_at FROM notion_sync_dlq WHERE id = $1",
      [dlqId]
    );

    expect(rows[0].retry_count).toBe(1);
    expect(rows[0].status).toBe("retrying");
    expect(rows[0].last_retry_at).toBeDefined();
  }, E2E_TIMEOUT);

  // ── Test 6: Mark entry as completed ────────────────────────────────────────

  it("should mark an entry as completed with Notion page info", async () => {
    const insertResult = await insertDlqEntry(pgPool, {
      groupId: GROUP_ID,
      originalMetadata: { proposal_id: "completed-test" },
      errorMessage: "Temporary error",
    });

    const dlqId = insertResult.dlqId!;

    const result = await markEntryCompleted(
      pgPool,
      dlqId,
      GROUP_ID,
      "notion-page-abc123",
      "https://notion.so/workspace/page-abc123"
    );

    expect(result.success).toBe(true);

    // Verify completion
    const { rows } = await pgPool.query(
      "SELECT status, notion_page_id, notion_page_url FROM notion_sync_dlq WHERE id = $1",
      [dlqId]
    );

    expect(rows[0].status).toBe("completed");
    expect(rows[0].notion_page_id).toBe("notion-page-abc123");
    expect(rows[0].notion_page_url).toBe("https://notion.so/workspace/page-abc123");
  }, E2E_TIMEOUT);

  // ── Test 7: Mark entry as failed (schedules next retry) ────────────────────

  it("should schedule next retry when marking entry as failed", async () => {
    const insertResult = await insertDlqEntry(pgPool, {
      groupId: GROUP_ID,
      originalMetadata: { proposal_id: "failed-retry-test" },
      errorMessage: "First error",
    });

    const dlqId = insertResult.dlqId!;

    // Mark as retrying first (simulates the retry attempt)
    await markEntryRetrying(pgPool, dlqId, GROUP_ID);

    // Now mark as failed (should schedule next retry)
    const result = await markEntryFailed(pgPool, dlqId, GROUP_ID, "Retry failed: timeout");
    expect(result.success).toBe(true);

    // Verify status is back to pending_retry with updated next_retry_at
    const { rows } = await pgPool.query(
      "SELECT status, error_message, next_retry_at FROM notion_sync_dlq WHERE id = $1",
      [dlqId]
    );

    expect(rows[0].status).toBe("pending_retry");
    expect(rows[0].error_message).toBe("Retry failed: timeout");
    // next_retry_at should be in the future
    expect(new Date(rows[0].next_retry_at).getTime()).toBeGreaterThan(Date.now() - 1000);
  }, E2E_TIMEOUT);

  // ── Test 8: Permanent failure after max retries ────────────────────────────

  it("should mark entry as permanently_failed after max retries", async () => {
    // Insert an entry and simulate max retries
    const insertResult = await pgPool.query(
      `INSERT INTO notion_sync_dlq (group_id, original_metadata, error_message, retry_count, max_retries, next_retry_at, status)
       VALUES ($1, $2, 'Max retries reached', 5, 5, NOW(), 'retrying')`,
      [GROUP_ID, JSON.stringify({ proposal_id: "max-retries-test" })]
    );

    const dlqId = insertResult.rows[0].id;

    const result = await markEntryFailed(pgPool, dlqId, GROUP_ID, "Final failure");
    expect(result.success).toBe(true);

    // Verify permanent failure
    const { rows } = await pgPool.query(
      "SELECT status, error_message FROM notion_sync_dlq WHERE id = $1",
      [dlqId]
    );

    expect(rows[0].status).toBe("permanently_failed");
    expect(rows[0].error_message).toBe("Final failure");
  }, E2E_TIMEOUT);

  // ── Test 9: Get permanently failed entries ─────────────────────────────────

  it("should fetch permanently failed entries for alerting", async () => {
    // Insert a permanently failed entry
    await pgPool.query(
      `INSERT INTO notion_sync_dlq (group_id, original_metadata, error_message, retry_count, max_retries, next_retry_at, status)
       VALUES ($1, $2, 'Permanent failure', 5, 5, NOW(), 'permanently_failed')`,
      [GROUP_ID, JSON.stringify({ proposal_id: "alert-test" })]
    );

    const entries = await getPermanentlyFailedEntries(pgPool, GROUP_ID);

    expect(entries.length).toBeGreaterThanOrEqual(1);
    const alertEntry = entries.find((e) => e.error_message === "Permanent failure");
    expect(alertEntry).toBeDefined();
    expect(alertEntry!.status).toBe("permanently_failed");
  }, E2E_TIMEOUT);

  // ── Test 10: DLQ statistics ────────────────────────────────────────────────

  it("should return correct DLQ statistics", async () => {
    // Insert entries in various states
    await pgPool.query(
      `INSERT INTO notion_sync_dlq (group_id, original_metadata, error_message, retry_count, max_retries, next_retry_at, status)
       VALUES
        ($1, $2, 'Pending 1', 0, 5, NOW(), 'pending_retry'),
        ($1, $3, 'Pending 2', 1, 5, NOW(), 'pending_retry'),
        ($1, $4, 'Completed', 1, 5, NOW(), 'completed'),
        ($1, $5, 'Failed', 5, 5, NOW(), 'permanently_failed')`,
      [
        GROUP_ID,
        JSON.stringify({ proposal_id: "stats-1" }),
        JSON.stringify({ proposal_id: "stats-2" }),
        JSON.stringify({ proposal_id: "stats-3" }),
        JSON.stringify({ proposal_id: "stats-4" }),
      ]
    );

    const stats = await getDlqStats(pgPool, GROUP_ID);

    expect(stats.pending_retry).toBeGreaterThanOrEqual(2);
    expect(stats.completed).toBeGreaterThanOrEqual(1);
    expect(stats.permanently_failed).toBeGreaterThanOrEqual(1);
    expect(stats.total).toBeGreaterThanOrEqual(4);
  }, E2E_TIMEOUT);

  // ── Test 11: Requeue permanently failed entry ──────────────────────────────

  it("should requeue a permanently failed entry for immediate retry", async () => {
    // Insert a permanently failed entry
    const insertResult = await pgPool.query(
      `INSERT INTO notion_sync_dlq (group_id, original_metadata, error_message, retry_count, max_retries, next_retry_at, status)
       VALUES ($1, $2, 'Requeue test', 5, 5, NOW(), 'permanently_failed')
       RETURNING id`,
      [GROUP_ID, JSON.stringify({ proposal_id: "requeue-test" })]
    );

    const dlqId = insertResult.rows[0].id;

    const result = await requeueFailedEntry(pgPool, dlqId, GROUP_ID);
    expect(result.success).toBe(true);

    // Verify requeue
    const { rows } = await pgPool.query(
      "SELECT status, retry_count, next_retry_at, last_retry_at FROM notion_sync_dlq WHERE id = $1",
      [dlqId]
    );

    expect(rows[0].status).toBe("pending_retry");
    expect(rows[0].retry_count).toBe(0);
    // next_retry_at should be NOW (immediate retry)
    expect(new Date(rows[0].next_retry_at).getTime()).toBeLessThanOrEqual(Date.now() + 1000);
    expect(rows[0].last_retry_at).toBeNull();
  }, E2E_TIMEOUT);

  // ── Test 12: Requeue should only work on permanently_failed entries ─────────

  it("should not requeue an entry that is not permanently_failed", async () => {
    // Insert a pending_retry entry
    const insertResult = await pgPool.query(
      `INSERT INTO notion_sync_dlq (group_id, original_metadata, error_message, retry_count, max_retries, next_retry_at, status)
       VALUES ($1, $2, 'Active entry', 0, 5, NOW(), 'pending_retry')
       RETURNING id`,
      [GROUP_ID, JSON.stringify({ proposal_id: "active-entry" })]
    );

    const dlqId = insertResult.rows[0].id;

    const result = await requeueFailedEntry(pgPool, dlqId, GROUP_ID);
    expect(result.success).toBe(false);
    expect(result.error).toContain("not permanently_failed");
  }, E2E_TIMEOUT);

  // ── Test 13: Tenant isolation ──────────────────────────────────────────────

  it("should not return entries from other tenants", async () => {
    const OTHER_GROUP = `allura-other-${RUN_ID}`;

    // Insert entry in different group
    await pgPool.query(
      `INSERT INTO notion_sync_dlq (group_id, original_metadata, error_message, retry_count, max_retries, next_retry_at, status)
       VALUES ($1, $2, 'Other tenant', 0, 5, NOW(), 'pending_retry')`,
      [OTHER_GROUP, JSON.stringify({ proposal_id: "other-tenant" })]
    );

    // Query with our group_id
    const entries = await getRetryableEntries(pgPool, GROUP_ID, 10);
    const otherEntries = entries.filter((e) => e.group_id === OTHER_GROUP);
    expect(otherEntries).toHaveLength(0);

    // Clean up
    await pgPool.query("DELETE FROM notion_sync_dlq WHERE group_id = $1", [OTHER_GROUP]);
  }, E2E_TIMEOUT);

  // ── Test 14: processDlqRetries integration ────────────────────────────────

  it("should process DLQ retries and track success/failure counts", async () => {
    // Insert a retryable entry
    await pgPool.query(
      `INSERT INTO notion_sync_dlq (group_id, original_metadata, error_message, retry_count, max_retries, next_retry_at, status)
       VALUES ($1, $2, 'Retry process test', 0, 5, NOW() - INTERVAL '1 minute', 'pending_retry')`,
      [GROUP_ID, JSON.stringify({ proposal_id: "retry-process-test" })]
    );

    // Mock process function that succeeds
    const mockProcessFn = vi.fn().mockResolvedValue({
      success: true,
      pageId: "notion-page-xyz",
      pageUrl: "https://notion.so/workspace/page-xyz",
    });

    const result = await processDlqRetries(GROUP_ID, mockProcessFn);

    expect(result.processed).toBeGreaterThanOrEqual(1);
    expect(result.succeeded).toBeGreaterThanOrEqual(1);
    expect(result.failed).toBe(0);
    expect(result.permanentlyFailed).toBe(0);
  }, E2E_TIMEOUT);

  // ── Test 15: processDlqRetries with failure ───────────────────────────────

  it("should track failures in processDlqRetries", async () => {
    // Insert a retryable entry
    await pgPool.query(
      `INSERT INTO notion_sync_dlq (group_id, original_metadata, error_message, retry_count, max_retries, next_retry_at, status)
       VALUES ($1, $2, 'Retry failure test', 0, 5, NOW() - INTERVAL '1 minute', 'pending_retry')`,
      [GROUP_ID, JSON.stringify({ proposal_id: "retry-failure-test" })]
    );

    // Mock process function that fails
    const mockProcessFn = vi.fn().mockResolvedValue({
      success: false,
      error: "Notion API timeout",
    });

    const result = await processDlqRetries(GROUP_ID, mockProcessFn);

    expect(result.processed).toBeGreaterThanOrEqual(1);
    expect(result.failed).toBeGreaterThanOrEqual(1);
  }, E2E_TIMEOUT);

  // ── Test 16: handleNotionSyncFailure routes to DLQ ────────────────────────

  it("should route failed Notion sync events to the DLQ", async () => {
    const event: NotionSyncEvent = {
      id: "99999",
      group_id: GROUP_ID,
      event_type: "notion_sync_pending",
      agent_id: "curator-approve",
      status: "pending",
      metadata: {
        proposal_id: "dlq-routing-test",
        content: "Test proposal for DLQ routing",
        score: 0.85,
        tier: "mainstream",
        status: "approved",
        curator_id: "brooks-architect",
        decided_at: "2026-04-12T07:30:00Z",
        data_source_id: "42894678-aedb-4c90-9371-6494a9fe5270",
      },
      created_at: "2026-04-12T07:30:00Z",
    };

    const dlqId = await handleNotionSyncFailure(event, "Notion API returned 503 Service Unavailable");

    expect(dlqId).not.toBeNull();

    // Verify the DLQ entry
    const { rows } = await pgPool.query(
      "SELECT * FROM notion_sync_dlq WHERE id = $1 AND group_id = $2",
      [dlqId, GROUP_ID]
    );

    expect(rows).toHaveLength(1);
    expect(rows[0].error_message).toBe("Notion API returned 503 Service Unavailable");
    expect(rows[0].status).toBe("pending_retry");
    expect(rows[0].retry_count).toBe(0);
  }, E2E_TIMEOUT);

  // ── Test 17: Exponential backoff progression ──────────────────────────────

  it("should progress through exponential backoff on repeated failures", async () => {
    const insertResult = await insertDlqEntry(pgPool, {
      groupId: GROUP_ID,
      originalMetadata: { proposal_id: "backoff-test" },
      errorMessage: "Initial failure",
    });

    const dlqId = insertResult.dlqId!;

    // Simulate 5 retry cycles
    for (let i = 0; i < 5; i++) {
      // Mark as retrying
      await markEntryRetrying(pgPool, dlqId, GROUP_ID);

      // Mark as failed (should schedule next retry or permanent failure)
      const failResult = await markEntryFailed(
        pgPool,
        dlqId,
        GROUP_ID,
        `Failure attempt ${i + 1}`
      );
      expect(failResult.success).toBe(true);

      // Check current state
      const { rows } = await pgPool.query(
        "SELECT retry_count, status, next_retry_at FROM notion_sync_dlq WHERE id = $1",
        [dlqId]
      );

      if (i < 4) {
        // Should still be pending_retry
        expect(rows[0].status).toBe("pending_retry");
        expect(rows[0].retry_count).toBe(i + 1);
      } else {
        // After 5 retries, should be permanently_failed
        expect(rows[0].status).toBe("permanently_failed");
      }
    }
  }, E2E_TIMEOUT);
});