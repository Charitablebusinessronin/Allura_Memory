/**
 * Notion Sync Dead Letter Queue (DLQ)
 *
 * When Notion page creation fails, events are routed here instead of
 * being silently dropped. The DLQ provides:
 *
 * 1. **Persistence** — Failed events are stored with full context
 * 2. **Exponential backoff** — Retries at 1min, 5min, 15min, 1hr, 6hr
 * 3. **Observability** — Structured logging for every state transition
 * 4. **Permanent failure handling** — After 5 retries, mark for human review
 *
 * ## Architecture Decision (AD-CURATOR-DLQ)
 *
 * The DLQ is append-only for entries (new retry = new row). Status transitions
 * are tracked via the `status` field. The `events` table row is never mutated —
 * only the DLQ entry status changes.
 *
 * ## Invariants
 *
 * - `group_id` on every operation (tenant isolation)
 * - Append-only: DLQ entries are INSERT-only, status updates use UPDATE
 * - After `max_retries` (5) failures, entry becomes `permanently_failed`
 * - Original event data is preserved in `original_metadata` for replay
 */

import { Pool } from "pg";
import { validateGroupId } from "../lib/validation/group-id";

// ── Types ──────────────────────────────────────────────────────────────────

/** Backoff schedule in seconds: 1min, 5min, 15min, 1hr, 6hr */
const BACKOFF_SCHEDULE_SECONDS = [60, 300, 900, 3600, 21600] as const;

/** Maximum retry attempts before permanent failure */
const MAX_RETRIES = 5;

/** DLQ entry status */
export type DlqStatus =
  | "pending_retry"
  | "retrying"
  | "completed"
  | "permanently_failed";

/** DLQ entry as stored in PostgreSQL */
export interface DlqEntry {
  id: number;
  group_id: string;
  original_event_id: number | null;
  proposal_id: string | null;
  original_event_type: string;
  original_metadata: Record<string, unknown>;
  error_message: string;
  error_code: string | null;
  retry_count: number;
  max_retries: number;
  next_retry_at: string;
  last_retry_at: string | null;
  status: DlqStatus;
  backoff_schedule: number[];
  notion_page_id: string | null;
  notion_page_url: string | null;
  created_at: string;
  updated_at: string;
}

/** Parameters for inserting a new DLQ entry */
export interface InsertDlqEntryParams {
  groupId: string;
  originalEventId?: number;
  proposalId?: string;
  originalMetadata: Record<string, unknown>;
  errorMessage: string;
  errorCode?: string;
}

/** Result of a DLQ operation */
export interface DlqOperationResult {
  success: boolean;
  dlqId?: number;
  error?: string;
}

/** Structured log entry for DLQ events */
export interface DlqLogEntry {
  timestamp: string;
  event: string;
  dlqId?: number;
  groupId: string;
  retryCount?: number;
  status?: DlqStatus;
  errorMessage?: string;
  proposalId?: string;
  originalEventId?: number;
}

// ── Structured Logging ──────────────────────────────────────────────────────

/**
 * Emit a structured log entry for DLQ operations.
 *
 * Uses console.error for errors/warnings, console.log for info.
 * All logs include ISO-8601 timestamps and structured fields.
 */
function logDlqEvent(entry: DlqLogEntry): void {
  const prefix = "[notion-sync-dlq]";
  const level = entry.event.includes("error") || entry.event.includes("permanent")
    ? "error"
    : entry.event.includes("retry")
      ? "warn"
      : "info";

  const message = `${prefix} ${entry.event} group=${entry.groupId} dlq_id=${entry.dlqId ?? "n/a"} retry=${entry.retryCount ?? "n/a"} status=${entry.status ?? "n/a"}`;

  if (level === "error") {
    console.error(message, {
      timestamp: entry.timestamp,
      errorMessage: entry.errorMessage,
      proposalId: entry.proposalId,
      originalEventId: entry.originalEventId,
    });
  } else if (level === "warn") {
    console.warn(message, {
      timestamp: entry.timestamp,
      errorMessage: entry.errorMessage,
    });
  } else {
    console.log(message, {
      timestamp: entry.timestamp,
    });
  }
}

// ── Core DLQ Functions ──────────────────────────────────────────────────────

/**
 * Calculate the next retry timestamp based on the current retry count.
 *
 * Uses the exponential backoff schedule:
 * - Attempt 0 → 1 minute
 * - Attempt 1 → 5 minutes
 * - Attempt 2 → 15 minutes
 * - Attempt 3 → 1 hour
 * - Attempt 4 → 6 hours
 *
 * @param retryCount - Current number of failed attempts (0-indexed)
 * @returns ISO-8601 timestamp for next retry
 */
export function calculateNextRetryAt(retryCount: number): string {
  const scheduleIndex = Math.min(retryCount, BACKOFF_SCHEDULE_SECONDS.length - 1);
  const delaySeconds = BACKOFF_SCHEDULE_SECONDS[scheduleIndex];
  const nextRetry = new Date(Date.now() + delaySeconds * 1000);
  return nextRetry.toISOString();
}

/**
 * Insert a failed Notion sync event into the DLQ.
 *
 * This is the primary entry point when a Notion page creation fails.
 * The original event data is preserved for later retry.
 *
 * @param pool - PostgreSQL connection pool
 * @param params - DLQ entry parameters
 * @returns DlqOperationResult with the new DLQ entry ID
 */
export async function insertDlqEntry(
  pool: Pool,
  params: InsertDlqEntryParams
): Promise<DlqOperationResult> {
  const groupId = validateGroupId(params.groupId);

  try {
    const result = await pool.query(
      `INSERT INTO notion_sync_dlq (
        group_id,
        original_event_id,
        proposal_id,
        original_event_type,
        original_metadata,
        error_message,
        error_code,
        retry_count,
        max_retries,
        next_retry_at,
        status
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
      RETURNING id`,
      [
        groupId,
        params.originalEventId ?? null,
        params.proposalId ?? null,
        "notion_sync_pending",
        JSON.stringify(params.originalMetadata),
        params.errorMessage,
        params.errorCode ?? null,
        0, // retry_count starts at 0
        MAX_RETRIES,
        calculateNextRetryAt(0), // first retry in 1 minute
        "pending_retry",
      ]
    );

    const dlqId = result.rows[0]?.id;

    logDlqEvent({
      timestamp: new Date().toISOString(),
      event: "dlq_insert",
      dlqId,
      groupId,
      retryCount: 0,
      status: "pending_retry",
      errorMessage: params.errorMessage,
      proposalId: params.proposalId,
      originalEventId: params.originalEventId,
    });

    return { success: true, dlqId };
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : String(err);
    logDlqEvent({
      timestamp: new Date().toISOString(),
      event: "dlq_insert_error",
      groupId,
      errorMessage,
      proposalId: params.proposalId,
      originalEventId: params.originalEventId,
    });
    return { success: false, error: errorMessage };
  }
}

/**
 * Fetch DLQ entries that are ready for retry.
 *
 * Returns entries where:
 * - status is 'pending_retry' or 'retrying'
 * - next_retry_at <= NOW()
 * - retry_count < max_retries
 * - Scoped to the given group_id
 *
 * @param pool - PostgreSQL connection pool
 * @param groupId - Tenant group_id for isolation
 * @param limit - Maximum entries to fetch (default: 10)
 * @returns Array of DLQ entries ready for retry
 */
export async function getRetryableEntries(
  pool: Pool,
  groupId: string,
  limit: number = 10
): Promise<DlqEntry[]> {
  const validatedGroupId = validateGroupId(groupId);

  const result = await pool.query(
    `SELECT id, group_id, original_event_id, proposal_id,
            original_event_type, original_metadata, error_message,
            error_code, retry_count, max_retries, next_retry_at,
            last_retry_at, status, backoff_schedule,
            notion_page_id, notion_page_url, created_at, updated_at
     FROM notion_sync_dlq
     WHERE group_id = $1
       AND status IN ('pending_retry', 'retrying')
       AND next_retry_at <= NOW()
       AND retry_count < max_retries
     ORDER BY next_retry_at ASC
     LIMIT $2`,
    [validatedGroupId, limit]
  );

  return result.rows as DlqEntry[];
}

/**
 * Mark a DLQ entry as retrying (in-progress).
 *
 * Called when the worker picks up an entry for retry.
 * Increments retry_count and sets last_retry_at.
 *
 * @param pool - PostgreSQL connection pool
 * @param dlqId - DLQ entry ID
 * @param groupId - Tenant group_id for isolation
 * @returns DlqOperationResult
 */
export async function markEntryRetrying(
  pool: Pool,
  dlqId: number,
  groupId: string
): Promise<DlqOperationResult> {
  let validatedGroupId: string;
  try {
    validatedGroupId = validateGroupId(groupId);
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : String(err);
    return { success: false, error: errorMessage };
  }

  try {
    const result = await pool.query(
      `UPDATE notion_sync_dlq
       SET status = 'retrying',
           retry_count = retry_count + 1,
           last_retry_at = NOW(),
           updated_at = NOW()
       WHERE id = $1 AND group_id = $2
       RETURNING id, retry_count`,
      [dlqId, validatedGroupId]
    );

    if (result.rows.length === 0) {
      return { success: false, error: `DLQ entry ${dlqId} not found for group ${validatedGroupId}` };
    }

    const newRetryCount = result.rows[0].retry_count;

    logDlqEvent({
      timestamp: new Date().toISOString(),
      event: "dlq_retry_start",
      dlqId,
      groupId: validatedGroupId,
      retryCount: newRetryCount,
      status: "retrying",
    });

    return { success: true, dlqId };
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : String(err);
    return { success: false, error: errorMessage };
  }
}

/**
 * Mark a DLQ entry as successfully completed.
 *
 * Called when a retry succeeds. Records the Notion page info
 * and updates the original event status.
 *
 * @param pool - PostgreSQL connection pool
 * @param dlqId - DLQ entry ID
 * @param groupId - Tenant group_id for isolation
 * @param notionPageId - Notion page ID from successful creation
 * @param notionPageUrl - Notion page URL from successful creation
 * @returns DlqOperationResult
 */
export async function markEntryCompleted(
  pool: Pool,
  dlqId: number,
  groupId: string,
  notionPageId: string,
  notionPageUrl: string
): Promise<DlqOperationResult> {
  let validatedGroupId: string;
  try {
    validatedGroupId = validateGroupId(groupId);
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : String(err);
    return { success: false, error: errorMessage };
  }

  try {
    const result = await pool.query(
      `UPDATE notion_sync_dlq
       SET status = 'completed',
           notion_page_id = $3,
           notion_page_url = $4,
           updated_at = NOW()
       WHERE id = $1 AND group_id = $2
       RETURNING id`,
      [dlqId, validatedGroupId, notionPageId, notionPageUrl]
    );

    if (result.rows.length === 0) {
      return { success: false, error: `DLQ entry ${dlqId} not found for group ${validatedGroupId}` };
    }

    logDlqEvent({
      timestamp: new Date().toISOString(),
      event: "dlq_completed",
      dlqId,
      groupId: validatedGroupId,
      status: "completed",
    });

    return { success: true, dlqId };
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : String(err);
    return { success: false, error: errorMessage };
  }
}

/**
 * Mark a DLQ entry as failed after a retry attempt.
 *
 * If retry_count >= max_retries, marks as permanently_failed.
 * Otherwise, schedules the next retry with exponential backoff.
 *
 * @param pool - PostgreSQL connection pool
 * @param dlqId - DLQ entry ID
 * @param groupId - Tenant group_id for isolation
 * @param errorMessage - Error from the failed retry
 * @param errorCode - Optional error code classification
 * @returns DlqOperationResult with status indicating permanent failure or retry scheduled
 */
export async function markEntryFailed(
  pool: Pool,
  dlqId: number,
  groupId: string,
  errorMessage: string,
  errorCode?: string
): Promise<DlqOperationResult> {
  let validatedGroupId: string;
  try {
    validatedGroupId = validateGroupId(groupId);
  } catch (err) {
    const errMsg = err instanceof Error ? err.message : String(err);
    return { success: false, error: errMsg };
  }

  try {
    // First, get current retry_count to determine next action
    const current = await pool.query(
      `SELECT retry_count, max_retries FROM notion_sync_dlq WHERE id = $1 AND group_id = $2`,
      [dlqId, validatedGroupId]
    );

    if (current.rows.length === 0) {
      return { success: false, error: `DLQ entry ${dlqId} not found for group ${validatedGroupId}` };
    }

    const { retry_count: currentRetryCount, max_retries: maxRetries } = current.rows[0];

    // Check if we've exhausted retries
    if (currentRetryCount >= maxRetries) {
      // Permanent failure — alert required
      await pool.query(
        `UPDATE notion_sync_dlq
         SET status = 'permanently_failed',
             error_message = $3,
             error_code = COALESCE($4, error_code),
             updated_at = NOW()
         WHERE id = $1 AND group_id = $2`,
        [dlqId, validatedGroupId, errorMessage, errorCode ?? null]
      );

      logDlqEvent({
        timestamp: new Date().toISOString(),
        event: "dlq_permanently_failed",
        dlqId,
        groupId: validatedGroupId,
        retryCount: currentRetryCount,
        status: "permanently_failed",
        errorMessage,
      });

      return { success: true, dlqId };
    }

    // Schedule next retry with exponential backoff
    const nextRetryAt = calculateNextRetryAt(currentRetryCount);

    await pool.query(
      `UPDATE notion_sync_dlq
       SET status = 'pending_retry',
           error_message = $3,
           error_code = COALESCE($4, error_code),
           next_retry_at = $5,
           updated_at = NOW()
       WHERE id = $1 AND group_id = $2`,
      [dlqId, validatedGroupId, errorMessage, errorCode ?? null, nextRetryAt]
    );

    logDlqEvent({
      timestamp: new Date().toISOString(),
      event: "dlq_retry_scheduled",
      dlqId,
      groupId: validatedGroupId,
      retryCount: currentRetryCount,
      status: "pending_retry",
      errorMessage,
    });

    return { success: true, dlqId };
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : String(err);
    return { success: false, error: errorMessage };
  }
}

/**
 * Get permanently failed entries for alerting.
 *
 * Returns all entries with status 'permanently_failed' for a given
 * group_id, ordered by creation date (newest first).
 *
 * @param pool - PostgreSQL connection pool
 * @param groupId - Tenant group_id for isolation
 * @param limit - Maximum entries to return (default: 50)
 * @returns Array of permanently failed DLQ entries
 */
export async function getPermanentlyFailedEntries(
  pool: Pool,
  groupId: string,
  limit: number = 50
): Promise<DlqEntry[]> {
  const validatedGroupId = validateGroupId(groupId);

  const result = await pool.query(
    `SELECT id, group_id, original_event_id, proposal_id,
            original_event_type, original_metadata, error_message,
            error_code, retry_count, max_retries, next_retry_at,
            last_retry_at, status, backoff_schedule,
            notion_page_id, notion_page_url, created_at, updated_at
     FROM notion_sync_dlq
     WHERE group_id = $1
       AND status = 'permanently_failed'
     ORDER BY created_at DESC
     LIMIT $2`,
    [validatedGroupId, limit]
  );

  return result.rows as DlqEntry[];
}

/**
 * Get DLQ statistics for a given group_id.
 *
 * Returns counts by status for monitoring dashboards.
 *
 * @param pool - PostgreSQL connection pool
 * @param groupId - Tenant group_id for isolation
 * @returns Object with counts per status
 */
export async function getDlqStats(
  pool: Pool,
  groupId: string
): Promise<Record<DlqStatus, number> & { total: number }> {
  const validatedGroupId = validateGroupId(groupId);

  const result = await pool.query(
    `SELECT status, COUNT(*) as count
     FROM notion_sync_dlq
     WHERE group_id = $1
     GROUP BY status`,
    [validatedGroupId]
  );

  const stats: Record<string, number> = {
    pending_retry: 0,
    retrying: 0,
    completed: 0,
    permanently_failed: 0,
    total: 0,
  };

  for (const row of result.rows) {
    stats[row.status] = parseInt(row.count, 10);
    stats.total += parseInt(row.count, 10);
  }

  return stats as Record<DlqStatus, number> & { total: number };
}

/**
 * Requeue a permanently failed entry for retry.
 *
 * Resets the retry count and schedules an immediate retry.
 * Used by human operators after investigating the failure.
 *
 * @param pool - PostgreSQL connection pool
 * @param dlqId - DLQ entry ID
 * @param groupId - Tenant group_id for isolation
 * @returns DlqOperationResult
 */
export async function requeueFailedEntry(
  pool: Pool,
  dlqId: number,
  groupId: string
): Promise<DlqOperationResult> {
  let validatedGroupId: string;
  try {
    validatedGroupId = validateGroupId(groupId);
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : String(err);
    return { success: false, error: errorMessage };
  }

  try {
    const result = await pool.query(
      `UPDATE notion_sync_dlq
       SET status = 'pending_retry',
           retry_count = 0,
           next_retry_at = NOW(),
           last_retry_at = NULL,
           updated_at = NOW()
       WHERE id = $1 AND group_id = $2 AND status = 'permanently_failed'
       RETURNING id`,
      [dlqId, validatedGroupId]
    );

    if (result.rows.length === 0) {
      return {
        success: false,
        error: `DLQ entry ${dlqId} not found or not permanently_failed for group ${validatedGroupId}`,
      };
    }

    logDlqEvent({
      timestamp: new Date().toISOString(),
      event: "dlq_requeued",
      dlqId,
      groupId: validatedGroupId,
      retryCount: 0,
      status: "pending_retry",
    });

    return { success: true, dlqId };
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : String(err);
    return { success: false, error: errorMessage };
  }
}

// ── Exports for testing ─────────────────────────────────────────────────────

export { BACKOFF_SCHEDULE_SECONDS, MAX_RETRIES };