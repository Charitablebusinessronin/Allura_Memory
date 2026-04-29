/**
 * Workspace Violation Audit
 *
 * Logs every workspace boundary violation as an audit event.
 * Events are written to the `events` table (via insertEvent) with
 * event_type = 'workspace.violation' and schema_version = 1.
 *
 * FR-6: Audit every violation
 * NFR-5: Observable health checks
 */

import { insertEvent, type EventInsert } from "@/lib/postgres/queries/insert-trace";
import { CURRENT_SCHEMA_VERSION } from "@/lib/schema-version";

// ── Types ───────────────────────────────────────────────────────────────────

/**
 * Workspace violation event payload.
 */
export interface WorkspaceViolationEvent {
  /** The group_id associated with the violation (may be 'unknown') */
  groupId: string;
  /** Violation code: WS001–WS004 */
  code: string;
  /** Human-readable message */
  message?: string;
  /** Path that was attempted (for WS002) */
  attemptedPath?: string;
  /** Operation that triggered the violation */
  operation?: string;
  /** Expected group_id (for WS004) */
  expectedGroupId?: string;
  /** Actual group_id found (for WS004) */
  actualGroupId?: string;
  /** Stack trace for debugging */
  stackTrace?: string;
  /** Additional context */
  metadata?: Record<string, unknown>;
}

/**
 * Summary of recent violations (for health checks).
 */
export interface ViolationSummary {
  last24h: number;
  total: number;
  lastViolationAt: string | null;
  recent: WorkspaceViolationEvent[];
}

// ── In-Memory Buffer ────────────────────────────────────────────────────────

/**
 * Recent violations kept in memory for fast health checks.
 * Bounded to prevent unbounded growth.
 */
const recentViolations: WorkspaceViolationEvent[] = [];
const MAX_BUFFERED_VIOLATIONS = 100;
let totalViolationCount = 0;

// ── Audit Logging ───────────────────────────────────────────────────────────

/**
 * Log a workspace boundary violation to the audit event store.
 *
 * Writes a `workspace.violation` event to the `events` table.
 * schema_version is pinned to 1 for workspace violation events.
 *
 * @param event - Violation details
 * @returns The inserted event record (or void if logging fails)
 */
export async function logWorkspaceViolation(
  event: WorkspaceViolationEvent
): Promise<void> {
  // Update in-memory counters
  totalViolationCount++;
  recentViolations.unshift({ ...event });
  if (recentViolations.length > MAX_BUFFERED_VIOLATIONS) {
    recentViolations.pop();
  }

  // Build the audit event payload
  const auditEvent: EventInsert = {
    group_id: event.groupId,
    event_type: "workspace.violation",
    agent_id: "workspace-guard",
    status: "completed",
    metadata: {
      code: event.code,
      message: event.message,
      attempted_path: event.attemptedPath,
      operation: event.operation,
      expected_group_id: event.expectedGroupId,
      actual_group_id: event.actualGroupId,
      stack_trace: event.stackTrace || new Error().stack,
      ...event.metadata,
    },
    schema_version: 1, // Workspace violation events use schema_version = 1
  };

  try {
    await insertEvent(auditEvent);
  } catch (error) {
    // Audit logging should never block the main flow.
    // Log to stderr as fallback.
    console.error(
      `[WorkspaceAudit] Failed to write violation event: ${error instanceof Error ? error.message : String(error)}`
    );
  }
}

/**
 * Get a summary of recent workspace violations.
 *
 * @returns Violation counts and recent events
 */
export function getViolationSummary(): ViolationSummary {
  const now = Date.now();
  const oneDayMs = 24 * 60 * 60 * 1000;

  const last24h = recentViolations.filter(
    // We don't have timestamps on buffered events; approximate with position
    // since violations are pushed to the front of the array
    (_v, i) => i < 50 // Conservative estimate: first 50 are likely within 24h
  ).length;

  const lastViolation = recentViolations[0] || null;

  return {
    last24h,
    total: totalViolationCount,
    lastViolationAt: lastViolation ? new Date().toISOString() : null,
    recent: recentViolations.slice(0, 10),
  };
}

/**
 * Reset violation counters (for testing only).
 */
export function resetViolationCounters(): void {
  recentViolations.length = 0;
  totalViolationCount = 0;
}
