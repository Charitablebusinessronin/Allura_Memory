import type { Pool } from "pg";
import { getPool } from "../connection";

/**
 * Event status values (matching insert-trace.ts)
 */
export type EventStatus = "pending" | "completed" | "failed" | "cancelled";

/**
 * Episodic memory query parameters
 * All queries are scoped by group_id for tenant isolation
 */
export interface EpisodicQueryParams {
  /** Required: Tenant isolation identifier */
  group_id: string;
  /** Optional: Filter by agent */
  agent_id?: string;
  /** Optional: Filter by workflow */
  workflow_id?: string;
  /** Optional: Filter by event type */
  event_type?: string;
  /** Optional: Filter by status */
  status?: EventStatus;
  /** Optional: Filter events after this parent (for execution chains) */
  after_event_id?: number;
  /** Optional: Start of time window */
  since?: Date;
  /** Optional: End of time window */
  until?: Date;
  /** Optional: Maximum number of results (default: 100) */
  limit?: number;
  /** Optional: Offset for pagination */
  offset?: number;
}

/**
 * Event summary for episodic memory context
 * Returns structured data suitable for agent consumption
 */
export interface EventSummary {
  id: number;
  group_id: string;
  event_type: string;
  created_at: Date;
  agent_id: string;
  workflow_id: string | null;
  step_id: string | null;
  parent_event_id: number | null;
  status: EventStatus;
  /** Summary of metadata (truncated if large) */
  metadata_summary: Record<string, unknown>;
  /** Summary of outcome (truncated if large) */
  outcome_summary: Record<string, unknown>;
  /** Error message if status is 'failed' */
  error_message: string | null;
  /** Error code if status is 'failed' */
  error_code: string | null;
}

/**
 * Paginated result set
 */
export interface PaginatedResult<T> {
  items: T[];
  total: number;
  limit: number;
  offset: number;
  has_more: boolean;
}

/**
 * Working memory context - recent events for a specific scope
 */
export interface WorkingMemoryContext {
  /** Most recent events for this context */
  recent_events: EventSummary[];
  /** Total events in this context */
  total_count: number;
  /** Time range covered */
  time_range: {
    earliest: Date | null;
    latest: Date | null;
  };
  /** Context identifiers */
  context: {
    group_id: string;
    agent_id?: string;
    workflow_id?: string;
  };
}

/**
 * Query error for validation failures
 */
export class QueryError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "QueryError";
  }
}

/**
 * Default limit for episodic queries
 */
const DEFAULT_LIMIT = 100;

/**
 * Maximum size for JSONB fields before truncation in summary
 */
const MAX_SUMMARY_SIZE = 1000; // characters

/**
 * Truncate large JSON objects for summary display
 * Keeps context windows manageable for agents
 */
function truncateSummary(data: Record<string, unknown>): Record<string, unknown> {
  const jsonStr = JSON.stringify(data);
  if (jsonStr.length <= MAX_SUMMARY_SIZE) {
    return data;
  }

  // Return truncated version with indicator
  return {
    __truncated: true,
    __original_size: jsonStr.length,
    __preview: jsonStr.slice(0, MAX_SUMMARY_SIZE),
  };
}

/**
 * Validate query parameters
 * Ensures group_id is always present for tenant isolation
 */
function validateParams(params: EpisodicQueryParams): void {
  if (!params.group_id || params.group_id.trim().length === 0) {
    throw new QueryError("group_id is required and cannot be empty");
  }

  if (params.limit !== undefined && params.limit < 1) {
    throw new QueryError("limit must be a positive number");
  }

  if (params.offset !== undefined && params.offset < 0) {
    throw new QueryError("offset must be a non-negative number");
  }

  if (params.since && params.until && params.since > params.until) {
    throw new QueryError("since must be before until");
  }
}

/**
 * Build WHERE clause for episodic queries
 * Returns both the clause and parameterized values
 */
function buildWhereClause(
  params: EpisodicQueryParams,
  paramStart: number = 1
): { clause: string; values: unknown[] } {
  const conditions: string[] = ["group_id = $1"];
  const values: unknown[] = [params.group_id];
  let paramIdx = paramStart + 1;

  if (params.agent_id) {
    conditions.push(`agent_id = $${paramIdx}`);
    values.push(params.agent_id);
    paramIdx++;
  }

  if (params.workflow_id) {
    conditions.push(`workflow_id = $${paramIdx}`);
    values.push(params.workflow_id);
    paramIdx++;
  }

  if (params.event_type) {
    conditions.push(`event_type = $${paramIdx}`);
    values.push(params.event_type);
    paramIdx++;
  }

  if (params.status) {
    conditions.push(`status = $${paramIdx}`);
    values.push(params.status);
    paramIdx++;
  }

  if (params.after_event_id) {
    conditions.push(`id > $${paramIdx}`);
    values.push(params.after_event_id);
    paramIdx++;
  }

  if (params.since) {
    conditions.push(`created_at >= $${paramIdx}`);
    values.push(params.since);
    paramIdx++;
  }

  if (params.until) {
    conditions.push(`created_at <= $${paramIdx}`);
    values.push(params.until);
    paramIdx++;
  }

  return {
    clause: conditions.join(" AND "),
    values,
  };
}

/**
 * Get episodic memory - retrieve event summaries with filtering
 * Returns paginated results scoped to the tenant
 *
 * @param params - Query parameters including required group_id
 * @returns Paginated event summaries
 * @throws QueryError if validation fails
 */
export async function getEpisodicMemory(
  params: EpisodicQueryParams
): Promise<PaginatedResult<EventSummary>> {
  validateParams(params);

  const pool = getPool();
  const limit = params.limit ?? DEFAULT_LIMIT;
  const offset = params.offset ?? 0;

  const { clause, values } = buildWhereClause(params);

  // Count query for pagination
  const countQuery = `
    SELECT COUNT(*) as total
    FROM events
    WHERE ${clause}
  `;

  const countResult = await pool.query<{ total: string }>(countQuery, values);
  const total = parseInt(countResult.rows[0].total, 10);

  // Main query with pagination
  const dataQuery = `
    SELECT
      id,
      group_id,
      event_type,
      created_at,
      agent_id,
      workflow_id,
      step_id,
      parent_event_id,
      status,
      metadata,
      outcome,
      error_message,
      error_code
    FROM events
    WHERE ${clause}
    ORDER BY created_at DESC
    LIMIT $${values.length + 1}
    OFFSET $${values.length + 2}
  `;

  const dataValues = [...values, limit, offset];
  const dataResult = await pool.query(dataQuery, dataValues);

  const items: EventSummary[] = dataResult.rows.map((row) => ({
    id: row.id,
    group_id: row.group_id,
    event_type: row.event_type,
    created_at: row.created_at,
    agent_id: row.agent_id,
    workflow_id: row.workflow_id,
    step_id: row.step_id,
    parent_event_id: row.parent_event_id,
    status: row.status,
    metadata_summary: truncateSummary(row.metadata),
    outcome_summary: truncateSummary(row.outcome),
    error_message: row.error_message,
    error_code: row.error_code,
  }));

  return {
    items,
    total,
    limit,
    offset,
    has_more: offset + items.length < total,
  };
}

/**
 * Get working memory context for a specific scope
 * Returns recent events and time range for agent context
 *
 * @param params - Query parameters (group_id required, others optional)
 * @param recentCount - Number of recent events to include (default: 10)
 * @returns Working memory context
 */
export async function getWorkingMemoryContext(
  params: EpisodicQueryParams,
  recentCount: number = 10
): Promise<WorkingMemoryContext> {
  validateParams(params);

  const pool = getPool();
  const { clause, values } = buildWhereClause(params);

  // Get total count and time range
  const statsQuery = `
    SELECT
      COUNT(*) as total,
      MIN(created_at) as earliest,
      MAX(created_at) as latest
    FROM events
    WHERE ${clause}
  `;

  const statsResult = await pool.query<{
    total: string;
    earliest: Date | null;
    latest: Date | null;
  }>(statsQuery, values);

  const { total, earliest, latest } = statsResult.rows[0];

  // Get recent events
  const recentQuery = `
    SELECT
      id,
      group_id,
      event_type,
      created_at,
      agent_id,
      workflow_id,
      step_id,
      parent_event_id,
      status,
      metadata,
      outcome,
      error_message,
      error_code
    FROM events
    WHERE ${clause}
    ORDER BY created_at DESC
    LIMIT $${values.length + 1}
  `;

  const recentValues = [...values, Math.min(recentCount, 100)];
  const recentResult = await pool.query(recentQuery, recentValues);

  const recent_events: EventSummary[] = recentResult.rows.map((row) => ({
    id: row.id,
    group_id: row.group_id,
    event_type: row.event_type,
    created_at: row.created_at,
    agent_id: row.agent_id,
    workflow_id: row.workflow_id,
    step_id: row.step_id,
    parent_event_id: row.parent_event_id,
    status: row.status,
    metadata_summary: truncateSummary(row.metadata),
    outcome_summary: truncateSummary(row.outcome),
    error_message: row.error_message,
    error_code: row.error_code,
  }));

  return {
    recent_events,
    total_count: parseInt(total, 10),
    time_range: {
      earliest,
      latest,
    },
    context: {
      group_id: params.group_id,
      agent_id: params.agent_id,
      workflow_id: params.workflow_id,
    },
  };
}

/**
 * Get events after a specific parent event
 * Useful for following execution chains
 *
 * @param parentId - Parent event ID to follow
 * @param params - Query parameters (group_id required)
 * @param limit - Maximum results
 * @returns Events that occurred after the parent
 */
export async function getEventsAfterParent(
  parentId: number,
  params: Omit<EpisodicQueryParams, "after_event_id">,
  limit: number = 50
): Promise<EventSummary[]> {
  return getEpisodicMemory({
    ...params,
    after_event_id: parentId,
    limit,
  }).then((result) => result.items);
}

/**
 * Get events by time window
 * Retrieves events within a specific time range
 *
 * @param params - Query parameters (group_id required)
 * @param since - Start of time window
 * @param until - End of time window (defaults to now)
 * @param limit - Maximum results
 * @returns Events within the time window
 */
export async function getEventsByTimeWindow(
  params: Omit<EpisodicQueryParams, "since" | "until">,
  since: Date,
  until?: Date,
  limit: number = 100
): Promise<EventSummary[]> {
  return getEpisodicMemory({
    ...params,
    since,
    until: until ?? new Date(),
    limit,
  }).then((result) => result.items);
}

/**
 * Get recent events for a group
 * Convenience function for the most common use case
 *
 * @param groupId - Tenant identifier
 * @param limit - Maximum results (default: 20)
 * @returns Most recent events for the group
 */
export async function getRecentEvents(
  groupId: string,
  limit: number = 20
): Promise<EventSummary[]> {
  return getEpisodicMemory({
    group_id: groupId,
    limit,
  }).then((result) => result.items);
}

/**
 * Get event by ID (with tenant check)
 * Returns null if event not found or doesn't belong to the group
 *
 * @param eventId - Event ID to retrieve
 * @param groupId - Tenant identifier (for isolation)
 * @returns Event summary or null
 */
export async function getEventById(
  eventId: number,
  groupId: string
): Promise<EventSummary | null> {
  const pool = getPool();

  const query = `
    SELECT
      id,
      group_id,
      event_type,
      created_at,
      agent_id,
      workflow_id,
      step_id,
      parent_event_id,
      status,
      metadata,
      outcome,
      error_message,
      error_code
    FROM events
    WHERE id = $1 AND group_id = $2
  `;

  const result = await pool.query(query, [eventId, groupId]);

  if (result.rows.length === 0) {
    return null;
  }

  const row = result.rows[0];
  return {
    id: row.id,
    group_id: row.group_id,
    event_type: row.event_type,
    created_at: row.created_at,
    agent_id: row.agent_id,
    workflow_id: row.workflow_id,
    step_id: row.step_id,
    parent_event_id: row.parent_event_id,
    status: row.status,
    metadata_summary: truncateSummary(row.metadata),
    outcome_summary: truncateSummary(row.outcome),
    error_message: row.error_message,
    error_code: row.error_code,
  };
}