/**
 * Audit Query Service
 * Story 5-1: Audit Query Interface
 * 
 * Provides query and export functionality for audit trail
 * Pattern: ARCH-001 (group_id enforcement)
 */

import { getPool } from '@/lib/postgres/connection';
import { validateGroupId } from '@/lib/validation/group-id';
import type { AuditLogEntry, EntityType, ProposalStatus } from '@/lib/promotions/types';

/**
 * Query parameters for audit trail
 */
export interface AuditQueryParams {
  group_id: string;
  start_date?: Date;
  end_date?: Date;
  agent_id?: string;
  decision_id?: string;
  entity_type?: EntityType;
  limit?: number;
  offset?: number;
}

/**
 * Export options
 */
export interface ExportOptions {
  format: 'csv' | 'json';
  includeMetadata?: boolean;
}

/**
 * AuditQueryService
 * 
 * Handles querying and exporting audit trail data
 */
export class AuditQueryService {
  /**
   * Query audit entries by date range
   */
  async queryByDateRange(
    from: Date,
    to: Date,
    groupId: string
  ): Promise<AuditLogEntry[]> {
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
      WHERE group_id = $1
        AND created_at >= $2
        AND created_at <= $3
      ORDER BY created_at DESC`,
      [validatedGroupId, from, to]
    );

    return result.rows.map(row => this.mapRowToAuditEntry(row));
  }

  /**
   * Query audit entries by agent
   */
  async queryByAgent(
    agentId: string,
    groupId: string
  ): Promise<AuditLogEntry[]> {
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
      WHERE group_id = $1
        AND actor_id = $2
      ORDER BY created_at DESC`,
      [validatedGroupId, agentId]
    );

    return result.rows.map(row => this.mapRowToAuditEntry(row));
  }

  /**
   * Query audit entries by decision (proposal)
   */
  async queryByDecision(
    decisionId: string,
    groupId: string
  ): Promise<AuditLogEntry[]> {
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
      WHERE group_id = $1
        AND entity_id = $2
      ORDER BY created_at DESC`,
      [validatedGroupId, decisionId]
    );

    return result.rows.map(row => this.mapRowToAuditEntry(row));
  }

  /**
   * Query evidence chain for a decision
   * Returns the full chain of state transitions for a proposal
   */
  async queryEvidenceChain(decisionId: string): Promise<{
    decision: AuditLogEntry[];
    evidence: Array<{
      id: string;
      type: string;
      timestamp: Date;
      description: string;
    }>;
  }> {
    const pool = getPool();

    // Get all transitions for this decision ordered chronologically
    const transitionsResult = await pool.query(
      `SELECT 
        id,
        group_id,
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
      WHERE entity_id = $1
      ORDER BY created_at ASC`,
      [decisionId]
    );

    const decision = transitionsResult.rows.map(row => this.mapRowToAuditEntry(row));

    // Extract evidence from metadata
    const evidence: Array<{
      id: string;
      type: string;
      timestamp: Date;
      description: string;
    }> = [];

    for (const transition of transitionsResult.rows) {
      if (transition.metadata && typeof transition.metadata === 'object') {
        const metadata = transition.metadata as Record<string, unknown>;
        if (metadata.evidence_refs && Array.isArray(metadata.evidence_refs)) {
          for (const ref of metadata.evidence_refs as string[]) {
            evidence.push({
              id: ref,
              type: 'reference',
              timestamp: new Date(transition.created_at),
              description: `Evidence reference: ${ref}`,
            });
          }
        }
      }
    }

    return { decision, evidence };
  }

  /**
   * Export audit query results as CSV
   */
  async exportCSV(query: AuditQueryParams): Promise<string> {
    const entries = await this.executeQuery(query);

    const headers = [
      'ID',
      'Timestamp',
      'Actor',
      'Actor Type',
      'Action',
      'Entity Type',
      'Entity ID',
      'From State',
      'To State',
      'Outcome',
      'Reason',
    ];

    const rows = entries.map(entry => [
      entry.id,
      entry.timestamp.toISOString(),
      entry.actor,
      entry.actor_type,
      entry.action,
      entry.entity_type,
      entry.entity_id,
      entry.from_state || '',
      entry.to_state,
      entry.outcome,
      entry.reason || '',
    ]);

    // Escape CSV fields
    const escapeCSV = (field: string): string => {
      if (field.includes(',') || field.includes('"') || field.includes('\n')) {
        return `"${field.replace(/"/g, '""')}"`;
      }
      return field;
    };

    const csvLines = [
      headers.map(escapeCSV).join(','),
      ...rows.map(row => row.map(escapeCSV).join(',')),
    ];

    return csvLines.join('\n');
  }

  /**
   * Export audit query results as JSON
   */
  async exportJSON(query: AuditQueryParams): Promise<string> {
    const entries = await this.executeQuery(query);
    return JSON.stringify(entries, null, 2);
  }

  /**
   * Execute audit query with all parameters
   */
  private async executeQuery(query: AuditQueryParams): Promise<AuditLogEntry[]> {
    const validatedGroupId = validateGroupId(query.group_id);

    const conditions: string[] = ['group_id = $1'];
    const params: unknown[] = [validatedGroupId];
    let paramIndex = 2;

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

    if (query.agent_id) {
      conditions.push(`actor_id = $${paramIndex}`);
      params.push(query.agent_id);
      paramIndex++;
    }

    if (query.decision_id) {
      conditions.push(`entity_id = $${paramIndex}`);
      params.push(query.decision_id);
      paramIndex++;
    }

    if (query.entity_type) {
      conditions.push(`entity_type = $${paramIndex}`);
      params.push(query.entity_type);
      paramIndex++;
    }

    const limit = query.limit || 100;
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

    return result.rows.map(row => this.mapRowToAuditEntry(row));
  }

  /**
   * Map database row to AuditLogEntry
   */
  private mapRowToAuditEntry(row: Record<string, unknown>): AuditLogEntry {
    return {
      id: row.id as string,
      timestamp: new Date(row.timestamp as Date),
      actor: row.actor as string,
      actor_type: row.actor_type as 'human' | 'agent' | 'system',
      action: row.action as string,
      entity_type: row.entity_type as EntityType,
      entity_id: row.entity_id as string,
      from_state: row.from_state as ProposalStatus | null,
      to_state: row.to_state as ProposalStatus,
      outcome: row.outcome as 'success' | 'failure',
      reason: row.reason as string | undefined,
      metadata: typeof row.metadata === 'string' 
        ? JSON.parse(row.metadata) 
        : row.metadata as Record<string, unknown> || {},
    };
  }
}

/**
 * Singleton instance
 */
let instance: AuditQueryService | null = null;

export function getAuditQueryService(): AuditQueryService {
  if (!instance) {
    instance = new AuditQueryService();
  }
  return instance;
}