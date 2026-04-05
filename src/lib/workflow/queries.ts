/**
 * Workflow State Queries
 * 
 * PostgreSQL queries for workflow state management.
 * All operations follow append-only semantics with explicit transition events.
 * 
 * @module workflow/queries
 */

import { getPool } from '../postgres/connection';
import type { Pool, PoolClient } from 'pg';
import type {
  WorkflowState,
  WorkflowStateTransition,
  WorkflowCurrentState,
  WorkflowCheckpointData,
  WorkflowStateQueryOptions,
  WorkflowStateQueryResult,
  WorkflowStateHistory,
  StateTransitionEvent,
} from './types';

/**
 * Create a new workflow state transition
 * This is the ONLY way to change workflow state (append-only)
 * 
 * @param params - Transition parameters
 * @returns The created transition record
 * @throws If database operation fails
 */
export async function createStateTransition(params: {
  group_id: string;
  workflow_id: string;
  state: WorkflowState;
  checkpoint_data?: WorkflowCheckpointData;
  retry_safe?: boolean;
}): Promise<WorkflowStateTransition> {
  const pool = getPool();
  
  const query = `
    INSERT INTO workflow_states (
      id,
      group_id,
      workflow_id,
      state,
      checkpoint_data,
      retry_safe,
      created_at,
      updated_at
    ) VALUES (
      gen_random_uuid(),
      $1,
      $2,
      $3,
      $4,
      $5,
      NOW(),
      NOW()
    )
    RETURNING 
      id::text,
      group_id,
      workflow_id,
      state,
      checkpoint_data,
      retry_safe,
      created_at,
      updated_at
  `;
  
  const values = [
    params.group_id,
    params.workflow_id,
    params.state,
    JSON.stringify(params.checkpoint_data ?? {}),
    params.retry_safe ?? true,
  ];
  
  const result = await pool.query(query, values);
  const row = result.rows[0];
  
  return {
    id: row.id,
    group_id: row.group_id,
    workflow_id: row.workflow_id,
    state: row.state as WorkflowState,
    checkpoint_data: row.checkpoint_data as WorkflowCheckpointData,
    retry_safe: row.retry_safe,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

/**
 * Get the current state of a workflow
 * Returns the most recent transition for the workflow
 * 
 * @param workflow_id - Workflow identifier
 * @param group_id - Tenant group identifier
 * @returns Current state or null if workflow not found
 */
export async function getCurrentState(
  workflow_id: string,
  group_id: string
): Promise<WorkflowCurrentState | null> {
  const pool = getPool();
  
  const query = `
    SELECT 
      id::text as transition_id,
      group_id,
      workflow_id,
      state,
      checkpoint_data,
      retry_safe,
      created_at,
      COUNT(*) OVER (PARTITION BY workflow_id) as transition_count
    FROM workflow_states
    WHERE workflow_id = $1
      AND group_id = $2
    ORDER BY created_at DESC
    LIMIT 1
  `;
  
  const result = await pool.query(query, [workflow_id, group_id]);
  
  if (result.rows.length === 0) {
    return null;
  }
  
  const row = result.rows[0];
  
  return {
    transition_id: row.transition_id,
    group_id: row.group_id,
    workflow_id: row.workflow_id,
    state: row.state as WorkflowState,
    checkpoint_data: row.checkpoint_data as WorkflowCheckpointData,
    retry_safe: row.retry_safe,
    entered_at: row.created_at,
    transition_count: parseInt(row.transition_count, 10),
  };
}

/**
 * Get all transitions for a workflow (state history)
 * Ordered chronologically (oldest first)
 * 
 * @param workflow_id - Workflow identifier
 * @param group_id - Tenant group identifier
 * @returns Array of transitions
 */
export async function getWorkflowHistory(
  workflow_id: string,
  group_id: string
): Promise<WorkflowStateTransition[]> {
  const pool = getPool();
  
  const query = `
    SELECT 
      id::text,
      group_id,
      workflow_id,
      state,
      checkpoint_data,
      retry_safe,
      created_at,
      updated_at
    FROM workflow_states
    WHERE workflow_id = $1
      AND group_id = $2
    ORDER BY created_at ASC
  `;
  
  const result = await pool.query(query, [workflow_id, group_id]);
  
  return result.rows.map(row => ({
    id: row.id,
    group_id: row.group_id,
    workflow_id: row.workflow_id,
    state: row.state as WorkflowState,
    checkpoint_data: row.checkpoint_data as WorkflowCheckpointData,
    retry_safe: row.retry_safe,
    created_at: row.created_at,
    updated_at: row.updated_at,
  }));
}

/**
 * Get complete workflow state history including current state
 * 
 * @param workflow_id - Workflow identifier
 * @param group_id - Tenant group identifier
 * @returns Complete history object
 */
export async function getWorkflowStateHistory(
  workflow_id: string,
  group_id: string
): Promise<WorkflowStateHistory | null> {
  const [transitions, currentState] = await Promise.all([
    getWorkflowHistory(workflow_id, group_id),
    getCurrentState(workflow_id, group_id),
  ]);
  
  if (!currentState || transitions.length === 0) {
    return null;
  }
  
  return {
    workflow_id,
    group_id,
    transitions,
    current_state: currentState,
  };
}

/**
 * Query workflows by various criteria
 * Always filtered by group_id for tenant isolation
 * 
 * @param options - Query options
 * @returns Query result with pagination
 */
export async function queryWorkflowStates(
  options: WorkflowStateQueryOptions
): Promise<WorkflowStateQueryResult> {
  const pool = getPool();
  const { group_id, workflow_id, state, retry_safe, limit = 100, offset = 0 } = options;
  
  // Build WHERE clause dynamically
  const conditions: string[] = ['group_id = $1'];
  const params: (string | boolean | number)[] = [group_id];
  let paramIndex = 2;
  
  if (workflow_id) {
    conditions.push(`workflow_id = $${paramIndex++}`);
    params.push(workflow_id);
  }
  
  if (state) {
    conditions.push(`state = $${paramIndex++}`);
    params.push(state);
  }
  
  if (retry_safe !== undefined) {
    conditions.push(`retry_safe = $${paramIndex++}`);
    params.push(retry_safe);
  }
  
  const whereClause = conditions.join(' AND ');
  
  // Get transitions
  const query = `
    SELECT 
      id::text,
      group_id,
      workflow_id,
      state,
      checkpoint_data,
      retry_safe,
      created_at,
      updated_at,
      COUNT(*) OVER() as total_count
    FROM workflow_states
    WHERE ${whereClause}
    ORDER BY created_at DESC
    LIMIT $${paramIndex++}
    OFFSET $${paramIndex++}
  `;
  
  params.push(limit, offset);
  
  const result = await pool.query(query, params);
  
  const total = result.rows.length > 0 ? parseInt(result.rows[0].total_count, 10) 
    : 0;
  
  const transitions = result.rows.map(row => ({
    id: row.id,
    group_id: row.group_id,
    workflow_id: row.workflow_id,
    state: row.state as WorkflowState,
    checkpoint_data: row.checkpoint_data as WorkflowCheckpointData,
    retry_safe: row.retry_safe,
    created_at: row.created_at,
    updated_at: row.updated_at,
  }));
  
  return {
    transitions,
    total,
    has_more: offset + transitions.length < total,
  };
}

/**
 * Get the most recent transition event for event sourcing
 * Useful for change data capture and audit trails
 * 
 * @param since - Only return events after this timestamp
 * @param limit - Maximum events to return
 * @returns Array of transition events
 */
export async function getTransitionEvents(
  since?: Date,
  limit: number = 100
): Promise<StateTransitionEvent[]> {
  const pool = getPool();
  
  let query = `
    SELECT 
      id::text as transition_id,
      workflow_id,
      group_id,
      state as to_state,
      checkpoint_data,
      retry_safe,
      created_at as timestamp,
      LAG(state) OVER (PARTITION BY workflow_id ORDER BY created_at) as from_state
    FROM workflow_states
  `;
  
  const params: (Date | number)[] = [];
  
  if (since) {
    query += ' WHERE created_at > $1';
    params.push(since);
  }
  
  query += `
    ORDER BY created_at DESC
    LIMIT $${params.length + 1}
  `;
  
  params.push(limit);
  
  const result = await pool.query(query, params);
  
  return result.rows.map(row => ({
    transition_id: row.transition_id,
    workflow_id: row.workflow_id,
    group_id: row.group_id,
    from_state: row.from_state as WorkflowState | null,
    to_state: row.to_state as WorkflowState,
    checkpoint_data: row.checkpoint_data as WorkflowCheckpointData,
    retry_safe: row.retry_safe,
    timestamp: row.timestamp,
  }));
}

/**
 * Initialize a new workflow with 'planned' state
 * Convenience method for creating workflows
 * 
 * @param workflow_id - Unique workflow identifier
 * @param group_id - Tenant group identifier
 * @param initial_checkpoint - Optional initial checkpoint data
 * @returns The created transition
 */
export async function initializeWorkflow(
  workflow_id: string,
  group_id: string,
  initial_checkpoint?: WorkflowCheckpointData
): Promise<WorkflowStateTransition> {
  return createStateTransition({
    group_id,
    workflow_id,
    state: 'planned',
    checkpoint_data: initial_checkpoint,
    retry_safe: true,
  });
}

/**
 * Check if a workflow exists
 * 
 * @param workflow_id - Workflow identifier
 * @param group_id - Tenant group identifier
 * @returns True if workflow exists
 */
export async function workflowExists(
  workflow_id: string,
  group_id: string
): Promise<boolean> {
  const pool = getPool();
  
  const query = `
    SELECT EXISTS (
      SELECT 1 FROM workflow_states 
      WHERE workflow_id = $1 
        AND group_id = $2 
      LIMIT 1
    )
  `;
  
  const result = await pool.query(query, [workflow_id, group_id]);
  return result.rows[0].exists;
}

/**
 * Get workflows in a specific state
 * Tenant-scoped query
 * 
 * @param state - Target state
 * @param group_id - Tenant group identifier
 * @param limit - Maximum results
 * @returns Array of current states
 */
export async function getWorkflowsByState(
  state: WorkflowState,
  group_id: string,
  limit: number = 100
): Promise<WorkflowCurrentState[]> {
  const pool = getPool();
  
  const query = `
    WITH latest_transitions AS (
      SELECT DISTINCT ON (workflow_id)
        id::text as transition_id,
        group_id,
        workflow_id,
        state,
        checkpoint_data,
        retry_safe,
        created_at,
        COUNT(*) OVER (PARTITION BY workflow_id) as transition_count
      FROM workflow_states
      WHERE group_id = $1
      ORDER BY workflow_id, created_at DESC
    )
    SELECT *
    FROM latest_transitions
    WHERE state = $2
    LIMIT $3
  `;
  
  const result = await pool.query(query, [group_id, state, limit]);
  
  return result.rows.map(row => ({
    transition_id: row.transition_id,
    group_id: row.group_id,
    workflow_id: row.workflow_id,
    state: row.state as WorkflowState,
    checkpoint_data: row.checkpoint_data as WorkflowCheckpointData,
    retry_safe: row.retry_safe,
    entered_at: row.created_at,
    transition_count: parseInt(row.transition_count, 10),
  }));
}

/**
 * Get retry-safe workflows that can be resumed
 * Useful for crash recovery
 * 
 * @param group_id - Tenant group identifier
 * @param limit - Maximum results
 * @returns Array of retry-safe workflow states
 */
export async function getRetrySafeWorkflows(
  group_id: string,
  limit: number = 100
): Promise<WorkflowCurrentState[]> {
  const pool = getPool();
  
  const query = `
    WITH latest_transitions AS (
      SELECT DISTINCT ON (workflow_id)
        id::text as transition_id,
        group_id,
        workflow_id,
        state,
        checkpoint_data,
        retry_safe,
        created_at,
        COUNT(*) OVER (PARTITION BY workflow_id) as transition_count
      FROM workflow_states
      WHERE group_id = $1
        AND retry_safe = true
      ORDER BY workflow_id, created_at DESC
    )
    SELECT *
    FROM latest_transitions
    LIMIT $2
  `;
  
  const result = await pool.query(query, [group_id, limit]);
  
  return result.rows.map(row => ({
    transition_id: row.transition_id,
    group_id: row.group_id,
    workflow_id: row.workflow_id,
    state: row.state as WorkflowState,
    checkpoint_data: row.checkpoint_data as WorkflowCheckpointData,
    retry_safe: row.retry_safe,
    entered_at: row.created_at,
    transition_count: parseInt(row.transition_count, 10),
  }));
}