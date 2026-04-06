/**
 * Trace Logger - Unified PostgreSQL Trace Logging with Agent Attribution
 * 
 * Provides structured logging for agent execution traces with:
 * - Group ID enforcement for multi-tenant isolation
 * - Agent attribution for accountability
 * - Confidence scoring for knowledge promotion decisions
 * - Event type classification for filtering
 */

import type { Pool } from "pg";
import { getPool } from "./connection";
import { insertEvent, type EventInsert, type EventRecord } from "./queries/insert-trace";
import { RuVixKernel } from "@/kernel/ruvix";
import type { QueryTracesOptions, QueryTracesResult } from "./types";

// Re-export types for backward compatibility
export type { QueryTracesOptions, QueryTracesResult } from "./types";

/**
 * Trace types for classification
 */
export type TraceType = "contribution" | "decision" | "learning" | "error";

/**
 * Trace log payload for structured logging
 */
export interface TraceLog {
  /** Required: Agent identifier (e.g., 'memory-orchestrator', 'memory-architect') */
  agent_id: string;
  /** Required: Tenant isolation - must use 'allura-*' naming */
  group_id: string;
  /** Required: Trace classification */
  trace_type: TraceType;
  /** Required: Trace content - what happened */
  content: string;
  /** Required: Confidence score (0.0 to 1.0) for knowledge promotion */
  confidence: number;
  /** Optional: Workflow this trace belongs to */
  workflow_id?: string;
  /** Optional: Step within workflow */
  step_id?: string;
  /** Optional: Parent event for execution chains */
  parent_event_id?: number;
  /** Optional: Structured metadata */
  metadata?: Record<string, unknown>;
  /** Optional: Outcome payload */
  outcome?: Record<string, unknown>;
  /** Optional: Evidence reference (file path, URL, document ID) */
  evidence_ref?: string;
}

/**
 * Trace record returned after logging
 */
export interface TraceRecord {
  id: number;
  group_id: string;
  event_type: string;
  agent_id: string;
  workflow_id: string | null;
  step_id: string | null;
  parent_event_id: number | null;
  metadata: Record<string, unknown>;
  outcome: Record<string, unknown>;
  status: string;
  confidence: number | null;
  evidence_ref: string | null;
  created_at: Date;
  inserted_at: Date;
}

/**
 * Validation error for invalid trace payloads
 */
export class TraceValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "TraceValidationError";
  }
}

/**
 * Validate trace log payload
 * Ensures all required fields are present and values are valid
 */
function validateTraceLog(trace: TraceLog): void {
  const errors: string[] = [];

  // Group ID validation (Allura tenant naming convention)
  if (!trace.group_id || trace.group_id.trim().length === 0) {
    errors.push("group_id is required and cannot be empty");
  } else if (!trace.group_id.startsWith("allura-")) {
    // Warn but allow - some legacy groups may not follow convention
    console.warn(
      `[TraceLogger] group_id '${trace.group_id}' does not follow 'allura-*' naming convention`
    );
  }

  // Agent ID validation
  if (!trace.agent_id || trace.agent_id.trim().length === 0) {
    errors.push("agent_id is required and cannot be empty");
  }

  // Trace type validation
  const validTraceTypes: TraceType[] = ["contribution", "decision", "learning", "error"];
  if (!validTraceTypes.includes(trace.trace_type)) {
    errors.push(
      `trace_type must be one of: ${validTraceTypes.join(", ")} (got '${trace.trace_type}')`
    );
  }

  // Content validation
  if (!trace.content || trace.content.trim().length === 0) {
    errors.push("content is required and cannot be empty");
  }

  // Confidence validation (must be between 0.0 and 1.0)
  if (typeof trace.confidence !== "number" || isNaN(trace.confidence)) {
    errors.push("confidence must be a number");
  } else if (trace.confidence < 0 || trace.confidence > 1) {
    errors.push("confidence must be between 0.0 and 1.0 (inclusive)");
  }

  if (errors.length > 0) {
    throw new TraceValidationError(`Trace validation failed: ${errors.join("; ")}`);
  }
}

/**
 * Log a trace via RuVix kernel (proof-gated, append-only)
 * 
 * Story 1.1: This is the NEW implementation using the kernel for:
 * - Proof-of-intent validation (with nonce)
 * - Tenant isolation enforcement (POL-001)
 * - Audit trail requirements (POL-005)
 * - Append-only semantics
 * 
 * @param trace - Trace payload to log
 * @returns The created trace record with assigned ID
 * @throws TraceValidationError if required fields are missing or invalid
 * @throws Error if kernel syscall fails
 */
export async function logTrace(trace: TraceLog): Promise<TraceRecord> {
  // Validate required fields first
  validateTraceLog(trace);

  // Prepare trace data for kernel
  const traceData = {
    table: "events",
    data: {
      agent_id: trace.agent_id,
      trace_type: trace.trace_type,
      content: trace.content,
      confidence: trace.confidence,
      evidence_ref: trace.evidence_ref,
      workflow_id: trace.workflow_id,
      step_id: trace.step_id,
      parent_event_id: trace.parent_event_id,
      metadata: trace.metadata,
      outcome: trace.outcome,
    },
  };

  // Call kernel trace syscall with proof-of-intent
  const result = await RuVixKernel.syscall("trace", traceData, {
    actor: trace.agent_id,
    group_id: trace.group_id,
    permission_tier: "plugin",
    audit_context: {
      trace_type: trace.trace_type,
      content_preview: trace.content.slice(0, 100), // First 100 chars for audit
    },
  });

  if (!result.success) {
    throw new TraceValidationError(`Trace logging failed: ${result.error}`);
  }

  // Map trace_type to event_type for PostgreSQL schema
  const event_type = `trace.${trace.trace_type}`;

  // Build structured metadata with confidence embedded
  const metadata: Record<string, unknown> = {
    ...trace.metadata,
    confidence: trace.confidence,
    logged_at: new Date().toISOString(),
    agent_version: "1.0.0",
    kernel_audit_id: result.auditId, // Track kernel audit ID
  };

  // Build outcome with content
  const outcome: Record<string, unknown> = {
    ...trace.outcome,
    content: trace.content,
  };

  // Create the event insert payload
  const eventInsert: EventInsert = {
    group_id: trace.group_id,
    event_type,
    agent_id: trace.agent_id,
    workflow_id: trace.workflow_id,
    step_id: trace.step_id,
    parent_event_id: trace.parent_event_id,
    metadata,
    outcome,
    status: "completed",
    confidence: trace.confidence,
    evidence_ref: trace.evidence_ref,
  };

  // Insert into PostgreSQL
  const eventRecord = await insertEvent(eventInsert);

  // Return mapped trace record
  return {
    id: eventRecord.id,
    group_id: eventRecord.group_id,
    event_type: eventRecord.event_type,
    agent_id: eventRecord.agent_id,
    workflow_id: eventRecord.workflow_id,
    step_id: eventRecord.step_id,
    parent_event_id: eventRecord.parent_event_id,
    metadata: eventRecord.metadata,
    outcome: eventRecord.outcome,
    status: eventRecord.status,
    confidence: eventRecord.confidence,
    evidence_ref: eventRecord.evidence_ref,
    created_at: eventRecord.created_at,
    inserted_at: eventRecord.inserted_at,
  };
}

/**
 * Get traces by agent ID
 * 
 * Retrieves the most recent traces for a specific agent, useful for:
 * - Agent performance analysis
 * - Debugging agent behavior
 * - Understanding agent contribution patterns
 * 
 * @param agentId - Agent identifier to query
 * @param group_id - Tenant isolation - REQUIRED
 * @param limit - Maximum number of traces to return (default: 10)
 * @returns Array of trace records, ordered by created_at DESC
 */
export async function getTracesByAgent(
  agentId: string,
  group_id: string,
  limit: number = 10
): Promise<TraceRecord[]> {
  // Enforce group_id
  if (!group_id || group_id.trim().length === 0) {
    throw new TraceValidationError("group_id is required for all trace queries");
  }

  const pool = getPool();

  const result = await pool.query<TraceRecord>(
    `
    SELECT 
      id,
      group_id,
      event_type,
      agent_id,
      workflow_id,
      step_id,
      parent_event_id,
      metadata,
      outcome,
      status,
      created_at,
      inserted_at
    FROM events
    WHERE agent_id = $1
      AND group_id = $2
    ORDER BY created_at DESC
    LIMIT $3
    `,
    [agentId, group_id, limit]
  );

  return result.rows;
}

/**
 * Get traces by type
 * 
 * Retrieves traces of a specific type, useful for:
 * - Filtering contributions vs errors
 * - Analyzing decision patterns
 * - Extracting learning moments
 * 
 * @param trace_type - Trace type to filter by
 * @param group_id - Tenant isolation - REQUIRED
 * @param limit - Maximum number of traces to return (default: 10)
 * @returns Array of trace records matching the type
 */
export async function getTracesByType(
  trace_type: TraceType,
  group_id: string,
  limit: number = 10
): Promise<TraceRecord[]> {
  // Enforce group_id
  if (!group_id || group_id.trim().length === 0) {
    throw new TraceValidationError("group_id is required for all trace queries");
  }

  const pool = getPool();

  // Map trace_type to event_type pattern
  const event_type_pattern = `trace.${trace_type}`;

  const result = await pool.query<TraceRecord>(
    `
    SELECT 
      id,
      group_id,
      event_type,
      agent_id,
      workflow_id,
      step_id,
      parent_event_id,
      metadata,
      outcome,
      status,
      created_at,
      inserted_at
    FROM events
    WHERE event_type = $1
      AND group_id = $2
    ORDER BY created_at DESC
    LIMIT $3
    `,
    [event_type_pattern, group_id, limit]
  );

  return result.rows;
}

/**
 * Get trace by ID
 * 
 * Retrieves a specific trace by its ID, enforcing tenant isolation.
 * 
 * @param id - Trace ID
 * @param group_id - Tenant isolation - REQUIRED
 * @returns Trace record if found, null otherwise
 */
export async function getTraceById(
  id: number,
  group_id: string
): Promise<TraceRecord | null> {
  // Enforce group_id
  if (!group_id || group_id.trim().length === 0) {
    throw new TraceValidationError("group_id is required for all trace queries");
  }

  const pool = getPool();

  const result = await pool.query<TraceRecord>(
    `
    SELECT 
      id,
      group_id,
      event_type,
      agent_id,
      workflow_id,
      step_id,
      parent_event_id,
      metadata,
      outcome,
      status,
      created_at,
      inserted_at
    FROM events
    WHERE id = $1
      AND group_id = $2
    `,
    [id, group_id]
  );

  return result.rows[0] || null;
}

/**
 * Count traces for a group
 * 
 * Useful for analytics and monitoring.
 * 
 * @param group_id - Tenant isolation - REQUIRED
 * @returns Number of traces in the group
 */
export async function countTraces(group_id: string): Promise<number> {
  // Enforce group_id
  if (!group_id || group_id.trim().length === 0) {
    throw new TraceValidationError("group_id is required for all trace queries");
  }

  const pool = getPool();

  const result = await pool.query<{ count: string }>(
    `
    SELECT COUNT(*)::text as count
    FROM events
    WHERE group_id = $1
    `,
    [group_id]
  );

  return parseInt(result.rows[0].count, 10);
}

