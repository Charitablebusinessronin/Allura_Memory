/**
 * Audit Log Utilities
 * Story 3-2: Task 6 - Build Audit Trail Viewer
 * Epic 3: Human-in-the-Loop (HITL) Governance Interface
 * 
 * Query utilities for approval audit trail
 * Pattern: ARCH-001 (group_id enforcement)
 */

import { getPool } from '@/lib/postgres/connection';
import { validateGroupId } from '@/lib/validation/group-id';
import type { AuditLogEntry, AuditLogQuery, EntityType, ProposalStatus } from './types';

/**
 * Query audit log entries
 */
export async function queryAuditLog(query: AuditLogQuery): Promise<AuditLogEntry[]> {
  const groupId = validateGroupId(query.group_id);
  
  const conditions: string[] = ['group_id = $1'];
  const params: unknown[] = [groupId];
  let paramIndex = 2;
  
  if (query.entity_type) {
    conditions.push(`entity_type = $${paramIndex}`);
    params.push(query.entity_type);
    paramIndex++;
  }
  
  if (query.entity_id) {
    conditions.push(`entity_id = $${paramIndex}`);
    params.push(query.entity_id);
    paramIndex++;
  }
  
  if (query.actor_id) {
    conditions.push(`actor_id = $${paramIndex}`);
    params.push(query.actor_id);
    paramIndex++;
  }
  
  if (query.start_date) {
    conditions.push(`created_at >= $${paramIndex}`);
    params.push(query.start_date);
    paramIndex++;
  }
  
  if (query.end_date) {
    conditions.push(`created_at <= $${paramIndex}`);
    params.push(query.end_date);
    paramIndex++;
  }
  
  const limit = query.limit || 50;
  const offset = query.offset || 0;
  
  params.push(limit, offset);
  
  const pool = getPool();
  const result = await pool.query(
    `SELECT 
      id,
      created_at as timestamp,
      actor_id as actor,
      actor_type,
      to_state as action,
      entity_type,
      entity_id,
      from_state,
      to_state,
      'success' as outcome,
      reason,
      metadata
     FROM approval_transitions
     WHERE ${conditions.join(' AND ')}
     ORDER BY created_at DESC
     LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`,
    params
  );
  
  return result.rows.map(row => mapRowToAuditEntry(row));
}

/**
 * Get audit entry by ID
 */
export async function getAuditEntry(
  entryId: string,
  groupId: string
): Promise<AuditLogEntry | null> {
  const validatedGroupId = validateGroupId(groupId);
  
  const pool = getPool();
  const result = await pool.query(
    `SELECT 
      id,
      created_at as timestamp,
      actor_id as actor,
      actor_type,
      to_state as action,
      entity_type,
      entity_id,
      from_state,
      to_state,
      'success' as outcome,
      reason,
      metadata
     FROM approval_transitions
     WHERE id = $1 AND group_id = $2`,
    [entryId, validatedGroupId]
  );
  
  if (result.rows.length === 0) {
    return null;
  }
  
  return mapRowToAuditEntry(result.rows[0]);
}

/**
 * Get audit summary for entity
 */
export async function getEntityAuditSummary(
  entityType: EntityType,
  entityId: string,
  groupId: string
): Promise<{
  totalTransitions: number;
  currentState: string;
  lastActor: string | null;
  lastTransition: Date | null;
}> {
  const validatedGroupId = validateGroupId(groupId);
  
  const pool = getPool();
  const result = await pool.query(
    `SELECT 
      COUNT(*) as total_transitions,
      to_state as current_state,
      actor_id as last_actor,
      created_at as last_transition
     FROM approval_transitions
     WHERE entity_type = $1 AND entity_id = $2 AND group_id = $3
     ORDER BY created_at DESC
     LIMIT 1`,
    [entityType, entityId, validatedGroupId]
  );
  
  if (result.rows.length === 0) {
    return {
      totalTransitions: 0,
      currentState: 'draft',
      lastActor: null,
      lastTransition: null,
    };
  }
  
  const row = result.rows[0];
  return {
    totalTransitions: parseInt(row.total_transitions || '0'),
    currentState: row.current_state || 'draft',
    lastActor: row.last_actor,
    lastTransition: row.last_transition,
  };
}

/**
 * Map database row to AuditLogEntry
 */
function mapRowToAuditEntry(row: Record<string, unknown>): AuditLogEntry {
  return {
    id: row.id as string,
    timestamp: row.timestamp as Date,
    actor: row.actor as string,
    actor_type: row.actor_type as 'human' | 'agent' | 'system',
    action: row.action as string,
    entity_type: row.entity_type as EntityType,
    entity_id: row.entity_id as string,
    from_state: row.from_state as ProposalStatus | null,
    to_state: row.to_state as ProposalStatus,
    outcome: row.outcome as 'success' | 'failure',
    reason: row.reason as string | undefined,
    metadata: JSON.parse(row.metadata as string || '{}'),
  };
}