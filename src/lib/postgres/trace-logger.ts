/**
 * Trace Logger - Unified PostgreSQL Trace Logging with Agent Attribution
 * Story 1.1: Record Raw Execution Traces with ARCH-001 Integration
 * 
 * Provides structured logging for agent execution traces with:
 * - Group ID enforcement via validateTenantGroupId (RK-01 tenant isolation)
 * - Agent attribution for accountability
 * - Confidence scoring for knowledge promotion decisions
 * - Event type classification for filtering
 */

import type { Pool } from "pg";
import { getPool } from "./connection";
import { insertEvent, type EventInsert, type EventRecord } from "./queries/insert-trace";
import { validateTenantGroupId, TENANT_ERROR_CODE } from "../validation/tenant-group-id";
import { GroupIdValidationError } from "../validation/group-id";

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
  created_at: Date;
  inserted_at: Date;
}

/**
 * Validation error for invalid trace payloads
 * RK-01: Tenant Isolation Violation
 */
export class TraceValidationError extends Error {
  public readonly code: string = TENANT_ERROR_CODE;
  
  constructor(message: string) {
    super(message);
    this.name = "TraceValidationError";
  }
}

/**
 * Validate trace log payload
 * Ensures all required fields are present and values are valid
 * RK-01: Enforces allura-{org} naming convention for tenant isolation
 */
function validateTraceLog(trace: TraceLog): void {
  const errors: string[] = [];

  // Group ID validation - RK-01: Enforce allura-{org} naming convention
  // Using validateTenantGroupId from ARCH-001
  try {
    validateTenantGroupId(trace.group_id);
  } catch (error) {
    if (error instanceof GroupIdValidationError) {
      // Re-throw with RK-01 code included
      throw new TraceValidationError(
        `RK-01: ${error.message}`
      );
    }
    throw error;
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
    throw new TraceValidationError(`RK-01: Trace validation failed: ${errors.join("; ")}`);
  }
}

/**
 * Log a trace to PostgreSQL
 * 
 * Creates an append-only trace record with:
 * - Agent attribution (who generated this trace?)
 * - Group isolation (which tenant does this belong to?)
 * - Confidence scoring (how confident is this insight?)
 * - Event classification (what type of trace is this?)
 * 
 * @param trace - Trace payload to log
 * @returns The created trace record with assigned ID
 * @throws TraceValidationError if required fields are missing or invalid
 */
export async function logTrace(trace: TraceLog): Promise<TraceRecord> {
  // Validate required fields
  validateTraceLog(trace);

  // Map trace_type to event_type for PostgreSQL schema
  // The events table uses 'event_type' but we expose 'trace_type' for clarity
  const event_type = `trace.${trace.trace_type}`;

  // Build structured metadata with confidence embedded
  const metadata: Record<string, unknown> = {
    ...trace.metadata,
    confidence: trace.confidence,
    logged_at: new Date().toISOString(),
    agent_version: "1.0.0", // Could be extended to track agent versions
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
    status: "completed", // Traces are logged as completed events
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
 * RK-01: Enforces tenant isolation via validateTenantGroupId
 * 
 * @param agentId - Agent identifier to query
 * @param group_id - Tenant isolation - REQUIRED (must match allura-{org} pattern)
 * @param limit - Maximum number of traces to return (default: 10)
 * @returns Array of trace records, ordered by created_at DESC
 * @throws TraceValidationError (RK-01) if group_id is invalid
 */
export async function getTracesByAgent(
  agentId: string,
  group_id: string,
  limit: number = 10
): Promise<TraceRecord[]> {
  // RK-01: Validate group_id with tenant naming enforcement
  try {
    validateTenantGroupId(group_id);
  } catch (error) {
    if (error instanceof GroupIdValidationError) {
      throw new TraceValidationError(`RK-01: ${error.message}`);
    }
    throw error;
  }

  if (!agentId || agentId.trim().length === 0) {
    throw new TraceValidationError("RK-01: agent_id is required for trace queries");
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
 * RK-01: Enforces tenant isolation via validateTenantGroupId
 * 
 * @param trace_type - Trace type to filter by
 * @param group_id - Tenant isolation - REQUIRED (must match allura-{org} pattern)
 * @param limit - Maximum number of traces to return (default: 10)
 * @returns Array of trace records matching the type
 * @throws TraceValidationError (RK-01) if group_id is invalid
 */
export async function getTracesByType(
  trace_type: TraceType,
  group_id: string,
  limit: number = 10
): Promise<TraceRecord[]> {
  // RK-01: Validate group_id with tenant naming enforcement
  try {
    validateTenantGroupId(group_id);
  } catch (error) {
    if (error instanceof GroupIdValidationError) {
      throw new TraceValidationError(`RK-01: ${error.message}`);
    }
    throw error;
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
 * RK-01: Enforces tenant isolation via validateTenantGroupId
 * 
 * @param id - Trace ID
 * @param group_id - Tenant isolation - REQUIRED (must match allura-{org} pattern)
 * @returns Trace record if found, null otherwise
 * @throws TraceValidationError (RK-01) if group_id is invalid
 */
export async function getTraceById(
  id: number,
  group_id: string
): Promise<TraceRecord | null> {
  // RK-01: Validate group_id with tenant naming enforcement
  try {
    validateTenantGroupId(group_id);
  } catch (error) {
    if (error instanceof GroupIdValidationError) {
      throw new TraceValidationError(`RK-01: ${error.message}`);
    }
    throw error;
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
 * RK-01: Enforces tenant isolation via validateTenantGroupId
 * 
 * @param group_id - Tenant isolation - REQUIRED (must match allura-{org} pattern)
 * @returns Number of traces in the group
 * @throws TraceValidationError (RK-01) if group_id is invalid
 */
export async function countTraces(group_id: string): Promise<number> {
  // RK-01: Validate group_id with tenant naming enforcement
  try {
    validateTenantGroupId(group_id);
  } catch (error) {
    if (error instanceof GroupIdValidationError) {
      throw new TraceValidationError(`RK-01: ${error.message}`);
    }
    throw error;
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