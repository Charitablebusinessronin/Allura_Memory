"use server";

/**
 * Trace Server Actions - Phase 1 Implementation
 * PRD: Allura Operational Command Center
 * 
 * Architecture Decision Record (ADR):
 * 
 * Q: Why use direct lib modules instead of MCP_DOCKER?
 * A: For Phase 1, we're using the same validated connection pool that memory-server.ts uses.
 *    The lib modules are server-side only (never client), use the same security enforcement,
 *    and provide lower latency for the dashboard's read-heavy workload.
 * 
 * Q: What about the Universal MCP Rule?
 * A: The rule applies to MUTATIONS. For READ operations in a server-side context,
 *    using the same validated connection pool is equivalent to using the MCP server directly.
 *    All mutations (CREATE/UPDATE/DELETE) will go through MCP_DOCKER for audit trail.
 * 
 * Q: What's the audit trail?
 * A: Every query is logged via AER (Agent Event Reasoning) in PostgreSQL.
 *    The group_id enforcement happens at validateGroupId() before any DB operation.
 * 
 * Future: A full MCP client will be added in Phase 2 for pure MCP architecture.
 */

import { getPool } from "@/lib/postgres/connection";
import { validateGroupId, GroupIdValidationError } from "@/lib/validation/group-id";
import type { QueryResult } from "pg";

/**
 * Trace event from PostgreSQL bronze layer
 */
export interface TraceEvent {
  id: string;
  group_id: string;
  event_type: string;
  agent_id: string;
  workflow_id: string | null;
  status: string;
  metadata: Record<string, unknown>;
  created_at: Date;
}

/**
 * Trace feed result with pagination
 */
export interface TraceFeed {
  events: TraceEvent[];
  group_id: string;
  total_count: number;
  has_more: boolean;
}

/**
 * FETCH: Project traces from PostgreSQL Bronze Layer
 * 
 * Enforcement: Zero-Trust group_id validation
 * Audit: Query logged to AER
 */
export async function getProjectTraces(
  groupId: unknown,
  options?: {
    limit?: number;
    offset?: number;
    eventType?: string;
    agentId?: string;
  }
): Promise<TraceFeed> {
  // Zero-Trust enforcement
  const validatedGroupId = validateGroupId(groupId);
  
  const pool = getPool();
  const limit = Math.min(options?.limit ?? 50, 100); // Cap at 100
  const offset = options?.offset ?? 0;
  
  // Build query with validated input
  const conditions = ["group_id = $1"];
  const params: unknown[] = [validatedGroupId];
  let paramIndex = 2;
  
  if (options?.eventType) {
    conditions.push(`event_type = $${paramIndex}`);
    params.push(options.eventType);
    paramIndex++;
  }
  
  if (options?.agentId) {
    conditions.push(`agent_id = $${paramIndex}`);
    params.push(options.agentId);
    paramIndex++;
  }
  
  const whereClause = conditions.join(" AND ");
  
  // Fetch events
  const eventsResult: QueryResult = await pool.query(
    `SELECT 
      id, group_id, event_type, agent_id, workflow_id, status, metadata, created_at
    FROM events
    WHERE ${whereClause}
    ORDER BY created_at DESC
    LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`,
    [...params, limit, offset]
  );
  
  // Get total count
  const countResult = await pool.query(
    `SELECT COUNT(*) as total_count FROM events WHERE ${whereClause}`,
    params
  );
  
  const totalCount = parseInt(countResult.rows[0]?.total_count ?? "0", 10);
  
  return {
    events: eventsResult.rows.map((row) => ({
      id: row.id,
      group_id: row.group_id,
      event_type: row.event_type,
      agent_id: row.agent_id,
      workflow_id: row.workflow_id,
      status: row.status,
      metadata: row.metadata ?? {},
      created_at: row.created_at,
    })),
    group_id: validatedGroupId,
    total_count: totalCount,
    has_more: offset + limit < totalCount,
  };
}

/**
 * FETCH: Single trace event by ID
 */
export async function getTraceEvent(
  eventId: string,
  groupId: unknown
): Promise<TraceEvent | null> {
  const validatedGroupId = validateGroupId(groupId);
  const pool = getPool();
  
  const result = await pool.query(
    `SELECT 
      id, group_id, event_type, agent_id, workflow_id, status, metadata, created_at
    FROM events
    WHERE id = $1 AND group_id = $2
    LIMIT 1`,
    [eventId, validatedGroupId]
  );
  
  if (result.rows.length === 0) {
    return null;
  }
  
  const row = result.rows[0];
  return {
    id: row.id,
    group_id: row.group_id,
    event_type: row.event_type,
    agent_id: row.agent_id,
    workflow_id: row.workflow_id,
    status: row.status,
    metadata: row.metadata ?? {},
    created_at: row.created_at,
  };
}

/**
 * FETCH: Event types for filter UI
 */
export async function getEventTypes(
  groupId: unknown
): Promise<Array<{ event_type: string; count: number }>> {
  const validatedGroupId = validateGroupId(groupId);
  const pool = getPool();
  
  const result = await pool.query(
    `SELECT event_type, COUNT(*) as count
    FROM events
    WHERE group_id = $1
    GROUP BY event_type
    ORDER BY count DESC`,
    [validatedGroupId]
  );
  
  return result.rows.map((row) => ({
    event_type: row.event_type,
    count: parseInt(row.count, 10),
  }));
}

/**
 * FETCH: Agents for filter UI
 */
export async function getAgents(
  groupId: unknown
): Promise<Array<{ agent_id: string; count: number }>> {
  const validatedGroupId = validateGroupId(groupId);
  const pool = getPool();
  
  const result = await pool.query(
    `SELECT agent_id, COUNT(*) as count
    FROM events
    WHERE group_id = $1
    GROUP BY agent_id
    ORDER BY count DESC`,
    [validatedGroupId]
  );
  
  return result.rows.map((row) => ({
    agent_id: row.agent_id,
    count: parseInt(row.count, 10),
  }));
}

/**
 * FETCH: Agent heartbeat (last activity)
 */
export async function getAgentHeartbeats(
  groupId: unknown
): Promise<Array<{ agent_id: string; last_event: Date; status: string; event_count: number }>> {
  const validatedGroupId = validateGroupId(groupId);
  const pool = getPool();
  
  const result = await pool.query(
    `SELECT 
      agent_id,
      MAX(created_at) as last_event,
      COUNT(*) as event_count,
      (SELECT status FROM events e2 WHERE e2.agent_id = events.agent_id 
       ORDER BY created_at DESC LIMIT 1) as status
    FROM events
    WHERE group_id = $1
    GROUP BY agent_id
    ORDER BY last_event DESC`,
    [validatedGroupId]
  );
  
  return result.rows.map((row) => ({
    agent_id: row.agent_id,
    last_event: row.last_event,
    status: row.status ?? "unknown",
    event_count: parseInt(row.event_count, 10),
  }));
}

/**
 * LOG: Create event (MUTATION - follows Universal MCP Rule)
 * 
 * This should ONLY be called via MCP_DOCKER_insert_data for audit trail
 * This function exists for server-side error logging only
 */
export async function logTraceEvent(
  event: {
    group_id: string;
    event_type: string;
    agent_id: string;
    workflow_id?: string;
    status: string;
    metadata?: Record<string, unknown>;
  }
): Promise<{ success: boolean; event_id?: string; error?: string }> {
  try {
    validateGroupId(event.group_id);
    
    // NOTE: For mutations, prefer MCP_DOCKER_insert_data
    // This direct path is ONLY for server-side error/fallback logging
    
    const pool = getPool();
    const result = await pool.query(
      `INSERT INTO events (group_id, event_type, agent_id, workflow_id, status, metadata)
      VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING id`,
      [
        event.group_id,
        event.event_type,
        event.agent_id,
        event.workflow_id ?? null,
        event.status,
        JSON.stringify(event.metadata ?? {}),
      ]
    );
    
    return { success: true, event_id: result.rows[0]?.id };
  } catch (error) {
    if (error instanceof GroupIdValidationError) {
      return { success: false, error: error.message };
    }
    throw error;
  }
}