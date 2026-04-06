/**
 * Decision Provenance Service
 * Story 5-1: Audit Query Interface
 * 
 * Traces decision provenance and reconstructs evidence chains
 * Pattern: ARCH-001 (group_id enforcement)
 */

import { getPool } from '@/lib/postgres/connection';
import { validateGroupId } from '@/lib/validation/group-id';
import type { EntityType, ProposalStatus } from '@/lib/promotions/types';

/**
 * Provenance node representing a state or evidence
 */
export interface ProvenanceNode {
  id: string;
  type: 'state' | 'evidence' | 'rule';
  timestamp: Date;
  actor: string;
  actorType: 'human' | 'agent' | 'system';
  data: Record<string, unknown>;
}

/**
 * Provenance edge representing a relationship
 */
export interface ProvenanceEdge {
  from: string;
  to: string;
  relationship: 'TRANSITION' | 'CITES' | 'APPLIES' | 'SUPERSEDES';
  metadata?: Record<string, unknown>;
}

/**
 * Complete provenance graph for a decision
 */
export interface ProvenanceGraph {
  decisionId: string;
  groupId: string;
  nodes: ProvenanceNode[];
  edges: ProvenanceEdge[];
}

/**
 * Rule version information
 */
export interface RuleVersion {
  id: string;
  version: string;
  createdAt: Date;
  createdBy: string;
  description: string;
  isActive: boolean;
  supersededBy?: string;
}

/**
 * Evidence record
 */
export interface EvidenceRecord {
  id: string;
  type: string;
  source: string;
  timestamp: Date;
  description: string;
  metadata: Record<string, unknown>;
}

/**
 * DecisionProvenance
 * 
 * Handles decision lineage and evidence chain reconstruction
 */
export class DecisionProvenance {
  /**
   * Trace full provenance of a decision
   */
  async traceProvenance(decisionId: string): Promise<ProvenanceGraph> {
    const pool = getPool();

    // Get all transitions for this decision
    const transitionsResult = await pool.query(
      `SELECT 
        id,
        group_id,
        created_at,
        actor_id,
        actor_type,
        entity_type,
        entity_id,
        from_state,
        to_state,
        reason,
        metadata
      FROM approval_transitions
      WHERE entity_id = $1
      ORDER BY created_at ASC`,
      [decisionId]
    );

    if (transitionsResult.rows.length === 0) {
      return {
        decisionId,
        groupId: '',
        nodes: [],
        edges: [],
      };
    }

    const groupId = transitionsResult.rows[0].group_id as string;
    const nodes: ProvenanceNode[] = [];
    const edges: ProvenanceEdge[] = [];

    // Create nodes and edges from transitions
    for (const row of transitionsResult.rows) {
      const nodeId = row.id as string;
      const fromState = row.from_state as ProposalStatus | null;
      const toState = row.to_state as ProposalStatus;

      // Create state node
      nodes.push({
        id: nodeId,
        type: 'state',
        timestamp: new Date(row.created_at as Date),
        actor: row.actor_id as string,
        actorType: row.actor_type as 'human' | 'agent' | 'system',
        data: {
          fromState,
          toState,
          reason: row.reason,
        },
      });

      // Create edge from previous state
      if (fromState) {
        const prevTransition = transitionsResult.rows.find(
          (r) => r.to_state === fromState
        );
        if (prevTransition) {
          edges.push({
            from: prevTransition.id as string,
            to: nodeId,
            relationship: 'TRANSITION',
            metadata: { state: fromState },
          });
        }
      }

      // Extract evidence from metadata
      const metadata = typeof row.metadata === 'string' 
        ? JSON.parse(row.metadata) 
        : row.metadata as Record<string, unknown>;
      
      if (metadata?.evidence_refs && Array.isArray(metadata.evidence_refs)) {
        for (const ref of metadata.evidence_refs as string[]) {
          nodes.push({
            id: `evidence-${ref}`,
            type: 'evidence',
            timestamp: new Date(row.created_at as Date),
            actor: row.actor_id as string,
            actorType: row.actor_type as 'human' | 'agent' | 'system',
            data: { reference: ref },
          });

          edges.push({
            from: nodeId,
            to: `evidence-${ref}`,
            relationship: 'CITES',
          });
        }
      }
    }

    return {
      decisionId,
      groupId,
      nodes,
      edges,
    };
  }

  /**
   * Get all versions of a rule
   */
  async getRuleVersions(ruleId: string): Promise<RuleVersion[]> {
    const pool = getPool();

    // Query rule_versions table (assumes standard versioning pattern)
    const result = await pool.query(
      `SELECT 
        id,
        version,
        created_at,
        created_by,
        description,
        is_active,
        superseded_by
      FROM rule_versions
      WHERE id = $1
      ORDER BY created_at DESC`,
      [ruleId]
    );

    return result.rows.map(row => ({
      id: row.id as string,
      version: row.version as string,
      createdAt: new Date(row.created_at as Date),
      createdBy: row.created_by as string,
      description: row.description as string,
      isActive: row.is_active as boolean,
      supersededBy: row.superseded_by as string | undefined,
    }));
  }

  /**
   * Reconstruct complete evidence chain for a decision
   */
  async reconstructEvidenceChain(decisionId: string): Promise<{
    decisionId: string;
    groupId: string;
    evidenceChain: EvidenceRecord[];
    transitions: Array<{
      fromState: ProposalStatus | null;
      toState: ProposalStatus;
      timestamp: Date;
      actor: string;
      reason?: string;
    }>;
  }> {
    const pool = getPool();

    // Get decision transitions
    const transitionsResult = await pool.query(
      `SELECT 
        id,
        group_id,
        created_at,
        actor_id,
        from_state,
        to_state,
        reason,
        metadata
      FROM approval_transitions
      WHERE entity_id = $1
      ORDER BY created_at ASC`,
      [decisionId]
    );

    if (transitionsResult.rows.length === 0) {
      return {
        decisionId,
        groupId: '',
        evidenceChain: [],
        transitions: [],
      };
    }

    const groupId = transitionsResult.rows[0].group_id as string;
    const evidenceMap = new Map<string, EvidenceRecord>();

    // Extract evidence from all transitions
    for (const row of transitionsResult.rows) {
      const metadata = typeof row.metadata === 'string' 
        ? JSON.parse(row.metadata) 
        : row.metadata as Record<string, unknown>;

      if (metadata?.evidence_refs && Array.isArray(metadata.evidence_refs)) {
        for (const ref of metadata.evidence_refs as string[]) {
          if (!evidenceMap.has(ref)) {
            evidenceMap.set(ref, {
              id: ref,
              type: 'reference',
              source: metadata.source as string || 'unknown',
              timestamp: new Date(row.created_at as Date),
              description: `Evidence cited in transition to ${row.to_state}`,
              metadata: {},
            });
          }
        }
      }
    }

    // Try to fetch additional evidence details from evidence table
    try {
      const evidenceIds = Array.from(evidenceMap.keys());
      if (evidenceIds.length > 0) {
        const evidenceResult = await pool.query(
          `SELECT id, type, source, created_at, description, metadata
           FROM evidence
           WHERE id = ANY($1)`,
          [evidenceIds]
        );

        for (const row of evidenceResult.rows) {
          const id = row.id as string;
          if (evidenceMap.has(id)) {
            const existing = evidenceMap.get(id)!;
            evidenceMap.set(id, {
              ...existing,
              type: row.type as string || existing.type,
              source: row.source as string || existing.source,
              description: row.description as string || existing.description,
              metadata: typeof row.metadata === 'string'
                ? JSON.parse(row.metadata)
                : row.metadata as Record<string, unknown> || {},
            });
          }
        }
      }
    } catch {
      // Evidence table may not exist, use extracted evidence
    }

    const transitions = transitionsResult.rows.map(row => ({
      fromState: row.from_state as ProposalStatus | null,
      toState: row.to_state as ProposalStatus,
      timestamp: new Date(row.created_at as Date),
      actor: row.actor_id as string,
      reason: row.reason as string | undefined,
    }));

    return {
      decisionId,
      groupId,
      evidenceChain: Array.from(evidenceMap.values()),
      transitions,
    };
  }
}

/**
 * Singleton instance
 */
let instance: DecisionProvenance | null = null;

export function getDecisionProvenance(): DecisionProvenance {
  if (!instance) {
    instance = new DecisionProvenance();
  }
  return instance;
}