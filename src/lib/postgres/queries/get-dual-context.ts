/**
 * Dual-Context Memory Query System
 * Story 1.4: Query Dual Context Memory
 * 
 * Loads both project-specific and global knowledge together,
 * preserving scope metadata and preventing cross-project leakage.
 */

import type { Pool } from "pg";
import { getPool } from "../connection";
import type { EventSummary } from "./get-episodic-memory";

/**
 * Scope identifiers for dual-context queries
 */
export const GLOBAL_GROUP_ID = "global";

/**
 * Context scope in results
 */
export type ContextScope = "project" | "global";

/**
 * Dual-context query parameters
 */
export interface DualContextQueryParams {
  /** Required: Project/group ID for local context */
  project_group_id: string;
  /** Optional: Include global context (default: true) */
  include_global?: boolean;
  /** Optional: Time window for recent events */
  since?: Date;
  /** Optional: Time window end */
  until?: Date;
  /** Optional: Maximum events per scope */
  limit_per_scope?: number;
}

/**
 * Scoped event summary with context metadata
 */
export interface ScopedEventSummary extends EventSummary {
  /** Scope identifier */
  scope: ContextScope;
  /** Source group ID */
  source_group_id: string;
}

/**
 * Dual-context result for episodic memory (PostgreSQL)
 */
export interface DualContextEpisodicResult {
  /** Project-specific events */
  project_events: ScopedEventSummary[];
  /** Global events (if included) */
  global_events: ScopedEventSummary[];
  /** Total events retrieved */
  total_count: number;
  /** Query metadata */
  metadata: {
    project_group_id: string;
    included_global: boolean;
    retrieved_at: Date;
    project_count: number;
    global_count: number;
  };
}

/**
 * Query error for validation failures
 */
export class DualContextQueryError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "DualContextQueryError";
  }
}

/**
 * Default limit per scope
 */
const DEFAULT_LIMIT_PER_SCOPE = 50;

/**
 * Validate dual-context query parameters
 */
function validateParams(params: DualContextQueryParams): void {
  if (!params.project_group_id || params.project_group_id.trim().length === 0) {
    throw new DualContextQueryError("project_group_id is required and cannot be empty");
  }

  // Prevent using GLOBAL_GROUP_ID as project_group_id
  if (params.project_group_id === GLOBAL_GROUP_ID) {
    throw new DualContextQueryError(
      `project_group_id cannot be '${GLOBAL_GROUP_ID}'. Use a specific project group ID.`
    );
  }

  if (params.limit_per_scope !== undefined && params.limit_per_scope < 1) {
    throw new DualContextQueryError("limit_per_scope must be a positive number");
  }

  if (params.since && params.until && params.since > params.until) {
    throw new DualContextQueryError("since must be before until");
  }
}

/**
 * Build WHERE clause for events query
 */
function buildEventWhereClause(
  groupId: string,
  params: DualContextQueryParams
): { clause: string; values: unknown[] } {
  const conditions: string[] = ["group_id = $1"];
  const values: unknown[] = [groupId];
  let paramIdx = 2;

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
 * Get events for a specific group
 */
async function getEventsForGroup(
  pool: Pool,
  groupId: string,
  params: DualContextQueryParams,
  limit: number
): Promise<ScopedEventSummary[]> {
  const { clause, values } = buildEventWhereClause(groupId, params);

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
    WHERE ${clause}
    ORDER BY created_at DESC
    LIMIT $${values.length + 1}
  `;

  const result = await pool.query(query, [...values, limit]);

  return result.rows.map((row) => ({
    id: row.id,
    group_id: row.group_id,
    event_type: row.event_type,
    created_at: row.created_at,
    agent_id: row.agent_id,
    workflow_id: row.workflow_id,
    step_id: row.step_id,
    parent_event_id: row.parent_event_id,
    status: row.status,
    metadata_summary: row.metadata,
    outcome_summary: row.outcome,
    error_message: row.error_message,
    error_code: row.error_code,
    // Scope metadata
    scope: groupId === GLOBAL_GROUP_ID ? "global" : "project",
    source_group_id: groupId,
  }));
}

/**
 * Get dual-context episodic memory from PostgreSQL
 * Retrieves both project-specific and global events
 * 
 * @param params - Query parameters
 * @returns Dual-context result with scoped events
 */
export async function getDualContextEpisodicMemory(
  params: DualContextQueryParams
): Promise<DualContextEpisodicResult> {
  validateParams(params);

  const pool = getPool();
  const includeGlobal = params.include_global ?? true;
  const limitPerScope = params.limit_per_scope ?? DEFAULT_LIMIT_PER_SCOPE;

  // Query project events
  const projectEvents = await getEventsForGroup(
    pool,
    params.project_group_id,
    params,
    limitPerScope
  );

  // Query global events if included
  let globalEvents: ScopedEventSummary[] = [];
  if (includeGlobal) {
    globalEvents = await getEventsForGroup(
      pool,
      GLOBAL_GROUP_ID,
      params,
      limitPerScope
    );
  }

  const totalCount = projectEvents.length + globalEvents.length;

  return {
    project_events: projectEvents,
    global_events: globalEvents,
    total_count: totalCount,
    metadata: {
      project_group_id: params.project_group_id,
      included_global: includeGlobal,
      retrieved_at: new Date(),
      project_count: projectEvents.length,
      global_count: globalEvents.length,
    },
  };
}

/**
 * Get merged dual-context events (project + global combined)
 * Returns events sorted by created_at with scope metadata preserved
 * 
 * @param params - Query parameters
 * @returns Merged events sorted by created_at DESC
 */
export async function getMergedDualContextEvents(
  params: DualContextQueryParams
): Promise<ScopedEventSummary[]> {
  const result = await getDualContextEpisodicMemory(params);

  // Merge and sort by created_at DESC
  const merged = [...result.project_events, ...result.global_events];
  merged.sort((a, b) => b.created_at.getTime() - a.created_at.getTime());

  return merged;
}

/**
 * Get working memory context for dual-scope
 * Returns recent events from both project and global contexts
 * 
 * @param project_group_id - Project group ID
 * @param recentCount - Number of recent events per scope (default: 10)
 * @returns Working memory context with both scopes
 */
export async function getDualContextWorkingMemory(
  project_group_id: string,
  recentCount: number = 10
): Promise<DualContextEpisodicResult> {
  return getDualContextEpisodicMemory({
    project_group_id,
    include_global: true,
    limit_per_scope: recentCount,
  });
}

/**
 * Check if a group ID is allowed for cross-project access
 * Currently only 'global' is allowed
 * 
 * @param groupId - Group ID to check
 * @returns True if the group can be accessed from any project
 */
export function isGlobalContext(groupId: string): boolean {
  return groupId === GLOBAL_GROUP_ID;
}

/**
 * Validate that a query doesn't attempt to access unauthorized groups
 * 
 * @param requesting_group - The group making the request
 * @param target_group - The group being accessed
 * @throws DualContextQueryError if access is denied
 */
export function validateCrossGroupAccess(
  requesting_group: string,
  target_group: string
): void {
  // Same group is always allowed
  if (requesting_group === target_group) {
    return;
  }

  // Global group is allowed from any project
  if (target_group === GLOBAL_GROUP_ID) {
    return;
  }

  // Any other cross-group access is denied
  throw new DualContextQueryError(
    `Cross-project access denied: group '${requesting_group}' cannot access group '${target_group}'. ` +
    `Only '${GLOBAL_GROUP_ID}' context is shared across projects.`
  );
}