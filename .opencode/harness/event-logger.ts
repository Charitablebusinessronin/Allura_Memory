/**
 * Harness Event Logger — Append-Only Trace Logging
 *
 * Wraps logTrace() to record all harness events (MCP discovery, approval, loading, skill execution)
 * to PostgreSQL with full audit trail.
 *
 * Events logged:
 * - MCP_DISCOVERED: MCP servers discovered
 * - MCP_APPROVED: MCP server approved by Brooks
 * - MCP_LOADED: MCP server loaded and tools activated
 * - SKILL_PROPOSED: Skill proposed to Brooks
 * - SKILL_LOADED: Skill loaded and routed to executor
 * - HARNESS_ERROR: Harness operation failed
 */

import { logTrace, type TraceLog } from "@/lib/postgres/trace-logger";
import type { TraceType } from "@/lib/postgres/trace-logger";

/**
 * Harness event types (mapped to trace_type)
 */
export type HarnessEventType =
  | "MCP_DISCOVERED"
  | "MCP_APPROVED"
  | "MCP_LOADED"
  | "SKILL_PROPOSED"
  | "SKILL_LOADED"
  | "HARNESS_ERROR";

/**
 * Harness event payload
 */
export interface HarnessEvent {
  event_type: HarnessEventType;
  group_id?: string; // Default: "allura-system"
  agent_id?: string; // Default: "brooks"
  description: string; // Human-readable event description
  metadata?: Record<string, unknown>; // Event-specific data
  error?: Error | string; // Optional error details
  confidence?: number; // Default: 1.0
}

/**
 * Map harness event type to trace type
 * All harness events are "contributions" (system activity)
 */
function mapHarnessEventTypeToTraceType(
  _eventType: HarnessEventType
): TraceType {
  return "contribution"; // All harness events are system contributions
}

/**
 * Log a harness event to Postgres
 *
 * Wraps logTrace() and enforces:
 * - group_id = "allura-system"
 * - agent_id = "brooks" (orchestrator)
 * - trace_type = "contribution"
 * - confidence = 1.0 (deterministic)
 * - Append-only semantics (via RuVix kernel)
 *
 * @param event - Harness event to log
 * @returns Promise resolving to the created trace record ID
 */
export async function logHarnessEvent(event: HarnessEvent): Promise<number> {
  const {
    event_type,
    group_id = "allura-system",
    agent_id = "brooks",
    description,
    metadata = {},
    error,
    confidence = 1.0,
  } = event;

  // Build trace log
  const traceLog: TraceLog = {
    agent_id,
    group_id,
    trace_type: mapHarnessEventTypeToTraceType(event_type),
    content: description,
    confidence,
    metadata: {
      ...metadata,
      event_type, // Include harness event type in metadata
      harness_version: "1.0.0",
    },
    evidence_ref: undefined,
  };

  // If there's an error, include it in metadata
  if (error) {
    const errorMessage =
      error instanceof Error ? error.message : String(error);
    traceLog.metadata.error_message = errorMessage;
  }

  try {
    const traceRecord = await logTrace(traceLog);
    return traceRecord.id;
  } catch (err) {
    // If logging fails, log to console but don't crash
    const errorMsg = err instanceof Error ? err.message : String(err);
    console.error(
      `[HarnessEventLogger] Failed to log event ${event_type}: ${errorMsg}`
    );

    // Rethrow after logging
    throw err;
  }
}

/**
 * Convenience: Log MCP discovery event
 */
export async function logMCPDiscovered(
  keyword: string | undefined,
  approvedCount: number,
  pendingCount: number
): Promise<number> {
  return logHarnessEvent({
    event_type: "MCP_DISCOVERED",
    description: `MCP discovery: keyword=${keyword || "all"}, approved=${approvedCount}, pending=${pendingCount}`,
    metadata: {
      keyword,
      approved_count: approvedCount,
      pending_count: pendingCount,
    },
  });
}

/**
 * Convenience: Log MCP approval event
 */
export async function logMCPApproved(
  serverId: string,
  approvedBy: string = "brooks"
): Promise<number> {
  return logHarnessEvent({
    event_type: "MCP_APPROVED",
    description: `MCP server approved: ${serverId} by ${approvedBy}`,
    metadata: {
      server_id: serverId,
      approved_by: approvedBy,
    },
  });
}

/**
 * Convenience: Log MCP load event
 */
export async function logMCPLoaded(serverId: string): Promise<number> {
  return logHarnessEvent({
    event_type: "MCP_LOADED",
    description: `MCP server loaded: ${serverId}`,
    metadata: {
      server_id: serverId,
    },
  });
}

/**
 * Convenience: Log skill proposal event
 */
export async function logSkillProposed(
  skillName: string,
  preferredExecutor?: string
): Promise<number> {
  return logHarnessEvent({
    event_type: "SKILL_PROPOSED",
    description: `Skill proposed: ${skillName}${preferredExecutor ? ` (preferred: @${preferredExecutor})` : ""}`,
    metadata: {
      skill_name: skillName,
      preferred_executor: preferredExecutor,
    },
  });
}

/**
 * Convenience: Log skill load event
 */
export async function logSkillLoaded(
  skillName: string,
  executor: string
): Promise<number> {
  return logHarnessEvent({
    event_type: "SKILL_LOADED",
    description: `Skill loaded: ${skillName} → @${executor}`,
    metadata: {
      skill_name: skillName,
      executor,
    },
  });
}

/**
 * Convenience: Log harness error
 */
export async function logHarnessError(
  operation: string,
  error: Error | string
): Promise<number> {
  return logHarnessEvent({
    event_type: "HARNESS_ERROR",
    description: `Harness error in ${operation}`,
    error,
    metadata: {
      operation,
    },
  });
}
