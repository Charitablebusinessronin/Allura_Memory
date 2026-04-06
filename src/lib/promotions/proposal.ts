/**
 * Promotion Proposal Manager
 * Story 3-2: Approval Workflow Implementation
 * Epic 3: Human-in-the-Loop (HITL) Governance Interface
 * 
 * Manages promotion proposals with state transitions and audit trail
 * Pattern: ARCH-001 (group_id enforcement)
 */

import { getPool } from '@/lib/postgres/connection';
import { validateGroupId, GroupIdValidationError } from '@/lib/validation/group-id';
import type {
  ProposalStatus,
  EntityType,
  PromotionProposal,
  CreateProposalPayload,
  TransitionPayload,
  ApprovalTransition,
} from './types';
import { VALID_PROPOSAL_TRANSITIONS } from './types';

/**
 * PromotionProposalManager
 * 
 * Handles proposal lifecycle: creation, state transitions, audit trail
 */
export class PromotionProposalManager {
  /**
   * Create a new promotion proposal
   */
  async createProposal(payload: CreateProposalPayload): Promise<PromotionProposal> {
    const groupId = validateGroupId(payload.group_id);
    
    const pool = getPool();
    const result = await pool.query(
      `INSERT INTO promotion_proposals (
        group_id, entity_type, entity_id, status, confidence_score,
        evidence_refs, metadata, proposed_by, proposed_at, created_at, updated_at
      ) VALUES ($1, $2, $3, 'draft', $4, $5, $6, $7, NOW(), NOW(), NOW())
      RETURNING *`,
      [
        groupId,
        payload.entity_type,
        payload.entity_id,
        payload.confidence_score,
        JSON.stringify(payload.evidence_refs),
        JSON.stringify(payload.metadata || {}),
        payload.proposed_by,
      ]
    );
    
    return this.mapRowToProposal(result.rows[0]);
  }

  /**
   * Submit proposal for review (draft → pending)
   */
  async submitForReview(proposalId: string, groupId: string): Promise<PromotionProposal> {
    const validatedGroupId = validateGroupId(groupId);
    
    await this.transitionState({
      proposal_id: proposalId,
      group_id: validatedGroupId,
      to_state: 'pending',
      actor_id: 'system',
      actor_type: 'system',
      reason: 'Submitted for human review',
    });
    
    const proposal = await this.getProposal(proposalId, validatedGroupId);
    if (!proposal) {
      throw new Error(`Proposal ${proposalId} not found after transition`);
    }
    return proposal;
  }

  /**
   * Approve proposal (pending → approved)
   */
  async approveProposal(payload: TransitionPayload): Promise<PromotionProposal> {
    const groupId = validateGroupId(payload.group_id);
    
    await this.transitionState({
      ...payload,
      group_id: groupId,
      to_state: 'approved',
    });
    
    const proposal = await this.getProposal(payload.proposal_id, groupId);
    if (!proposal) {
      throw new Error(`Proposal ${payload.proposal_id} not found after transition`);
    }
    return proposal;
  }

  /**
   * Reject proposal (pending → rejected)
   */
  async rejectProposal(payload: TransitionPayload): Promise<PromotionProposal> {
    const groupId = validateGroupId(payload.group_id);
    
    if (!payload.reason) {
      throw new Error('Rejection reason is required');
    }
    
    await this.transitionState({
      ...payload,
      group_id: groupId,
      to_state: 'rejected',
    });
    
    const proposal = await this.getProposal(payload.proposal_id, groupId);
    if (!proposal) {
      throw new Error(`Proposal ${payload.proposal_id} not found after transition`);
    }
    return proposal;
  }

  /**
   * Supersede approved proposal (approved → superseded)
   */
  async supersedeProposal(payload: TransitionPayload): Promise<PromotionProposal> {
    const groupId = validateGroupId(payload.group_id);
    
    await this.transitionState({
      ...payload,
      group_id: groupId,
      to_state: 'superseded',
    });
    
    const proposal = await this.getProposal(payload.proposal_id, groupId);
    if (!proposal) {
      throw new Error(`Proposal ${payload.proposal_id} not found after transition`);
    }
    return proposal;
  }

  /**
   * Get proposal by ID
   */
  async getProposal(proposalId: string, groupId: string): Promise<PromotionProposal | null> {
    const validatedGroupId = validateGroupId(groupId);
    
    const pool = getPool();
    const result = await pool.query(
      `SELECT * FROM promotion_proposals 
       WHERE id = $1 AND group_id = $2`,
      [proposalId, validatedGroupId]
    );
    
    if (result.rows.length === 0) {
      return null;
    }
    
    return this.mapRowToProposal(result.rows[0]);
  }

  /**
   * Get proposals by status
   */
  async getProposalsByStatus(
    groupId: string,
    status: ProposalStatus,
    limit: number = 50,
    offset: number = 0
  ): Promise<PromotionProposal[]> {
    const validatedGroupId = validateGroupId(groupId);
    
    const pool = getPool();
    const result = await pool.query(
      `SELECT * FROM promotion_proposals 
       WHERE group_id = $1 AND status = $2
       ORDER BY created_at DESC
       LIMIT $3 OFFSET $4`,
      [validatedGroupId, status, limit, offset]
    );
    
    return result.rows.map(row => this.mapRowToProposal(row));
  }

  /**
   * Transition proposal state with audit trail
   */
  private async transitionState(payload: TransitionPayload): Promise<void> {
    const pool = getPool();
    
    // Get current proposal
    const currentResult = await pool.query(
      `SELECT * FROM promotion_proposals WHERE id = $1 AND group_id = $2`,
      [payload.proposal_id, payload.group_id]
    );
    
    if (currentResult.rows.length === 0) {
      throw new Error(`Proposal ${payload.proposal_id} not found`);
    }
    
    const currentProposal = this.mapRowToProposal(currentResult.rows[0]);
    const fromState = currentProposal.status;
    const toState = payload.to_state;
    
    // Validate transition
    if (!VALID_PROPOSAL_TRANSITIONS[fromState].includes(toState)) {
      throw new Error(
        `Invalid transition: ${fromState} → ${toState}. Valid transitions: ${VALID_PROPOSAL_TRANSITIONS[fromState].join(', ')}`
      );
    }
    
    // Insert transition audit record
    await pool.query(
      `INSERT INTO approval_transitions (
        group_id, entity_type, entity_id, from_state, to_state,
        actor_id, actor_type, reason, metadata, created_at
      ) VALUES ($1, 'proposal', $2, $3, $4, $5, $6, $7, $8, NOW())`,
      [
        payload.group_id,
        payload.proposal_id,
        fromState,
        toState,
        payload.actor_id,
        payload.actor_type,
        payload.reason || null,
        JSON.stringify(payload.metadata || {}),
      ]
    );
    
    // Update proposal status
    await pool.query(
      `UPDATE promotion_proposals 
       SET status = $1, updated_at = NOW()
       WHERE id = $2 AND group_id = $3`,
      [toState, payload.proposal_id, payload.group_id]
    );
  }

  /**
   * Map database row to PromotionProposal type
   */
  private mapRowToProposal(row: Record<string, unknown>): PromotionProposal {
    return {
      id: row.id as string,
      group_id: row.group_id as string,
      entity_type: row.entity_type as EntityType,
      entity_id: row.entity_id as string,
      status: row.status as ProposalStatus,
      confidence_score: row.confidence_score as number,
      evidence_refs: JSON.parse(row.evidence_refs as string || '[]'),
      metadata: JSON.parse(row.metadata as string || '{}'),
      proposed_by: row.proposed_by as string,
      proposed_at: row.proposed_at as Date,
      reviewed_by: row.reviewed_by as string | undefined,
      reviewed_at: row.reviewed_at as Date | undefined,
      review_notes: row.review_notes as string | undefined,
      rejection_reason: row.rejection_reason as string | undefined,
      created_at: row.created_at as Date,
      updated_at: row.updated_at as Date,
    };
  }
}

/**
 * Singleton instance
 */
let instance: PromotionProposalManager | null = null;

export function getProposalManager(): PromotionProposalManager {
  if (!instance) {
    instance = new PromotionProposalManager();
  }
  return instance;
}