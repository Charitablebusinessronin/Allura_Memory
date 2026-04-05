/**
 * PostgreSQL Types for Trace Logging
 * 
 * Type definitions for trace log queries and results.
 */

import type { TraceType } from "./trace-logger";

/**
 * Options for querying traces
 * 
 * All queries are tenant-scoped (group_id is required)
 */
export interface QueryTracesOptions {
  /** Required: Tenant isolation - filters to specific group */
  group_id: string;
  
  /** Optional: Filter by agent */
  agent_id?: string;
  
  /** Optional: Filter by trace type */
  trace_type?: TraceType;
  
  /** Optional: Filter by workflow */
  workflow_id?: string;
  
  /** Optional: Filter by start time */
  startTime?: Date;
  
  /** Optional: Filter by end time */
  endTime?: Date;
  
  /** Optional: Maximum results to return (default: 100) */
  limit?: number;
  
  /** Optional: Offset for pagination */
  offset?: number;
}

/**
 * Result of querying traces
 */
export interface QueryTracesResult {
  /** Matching traces */
  traces: TraceRecord[];
  
  /** Total count matching query (ignores limit/offset) */
  total: number;
  
  /** Whether there are more results */
  hasMore: boolean;
}

/**
 * Trace record returned from queries
 * 
 * Note: This extends the trace-logger TraceRecord with query-specific fields
 */
export interface TraceRecord {
  /** Auto-generated ID */
  id: number;
  
  /** Tenant isolation */
  group_id: string;
  
  /** Event type (mapped from trace_type) */
  event_type: string;
  
  /** Agent that created the trace */
  agent_id: string;
  
  /** Optional workflow context */
  workflow_id: string | null;
  
  /** Optional step within workflow */
  step_id: string | null;
  
  /** Optional parent event for chaining */
  parent_event_id: number | null;
  
  /** Structured metadata including confidence */
  metadata: Record<string, unknown>;
  
  /** Outcome payload including content */
  outcome: Record<string, unknown>;
  
  /** Event status (pending/completed/failed) */
  status: string;
  
  /** When the event was created */
  created_at: Date;
  
  /** When the event was inserted into database */
  inserted_at: Date;
}
