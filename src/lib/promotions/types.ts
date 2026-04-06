/**
 * Promotion Proposal Types
 * Story 3-2: Approval Workflow Implementation
 */

import type { ApprovalStatus } from '@/lib/agents/approval';

/**
 * Proposal status for state machine
 */
export type ProposalStatus = 'draft' | 'pending' | 'approved' | 'rejected' | 'superseded' | 'revoked';

/**
 * Valid state transitions
 */
export const VALID_PROPOSAL_TRANSITIONS: Record<ProposalStatus, ProposalStatus[]> = {
  draft: ['pending'],
  pending: ['approved', 'rejected', 'draft'],
  approved: ['superseded', 'revoked'],
  rejected: ['draft'],
  superseded: [],
  revoked: [],
};

/**
 * Actor types for audit trail
 */
export type ActorType = 'human' | 'agent' | 'system';

/**
 * Entity types that can be promoted
 */
export type EntityType = 'agent' | 'insight' | 'design' | 'knowledge';

/**
 * Promotion Proposal
 */
export interface PromotionProposal {
  id: string;
  group_id: string;
  entity_type: EntityType;
  entity_id: string;
  status: ProposalStatus;
  confidence_score: number;
  evidence_refs: string[];
  metadata: Record<string, unknown>;
  proposed_by: string;
  proposed_at: Date;
  reviewed_by?: string;
  reviewed_at?: Date;
  review_notes?: string;
  rejection_reason?: string;
  created_at: Date;
  updated_at: Date;
}

/**
 * Approval Transition (append-only audit trail)
 */
export interface ApprovalTransition {
  id: string;
  group_id: string;
  entity_type: EntityType;
  entity_id: string;
  from_state: ProposalStatus | null;
  to_state: ProposalStatus;
  actor_id: string;
  actor_type: ActorType;
  reason?: string;
  metadata: Record<string, unknown>;
  created_at: Date;
}

/**
 * Notification Event
 */
export interface NotificationEvent {
  id: string;
  group_id: string;
  transition_id?: string;
  event_type: 'proposal_created' | 'proposal_approved' | 'proposal_rejected' | 'proposal_superseded' | 'proposal_revoked';
  entity_type: EntityType;
  entity_id: string;
  channel: 'in_app' | 'email' | 'slack' | 'webhook';
  recipient: string;
  sent_at: Date;
  success: boolean;
  error_message?: string;
  payload: Record<string, unknown>;
}

/**
 * Proposal creation payload
 */
export interface CreateProposalPayload {
  group_id: string;
  entity_type: EntityType;
  entity_id: string;
  confidence_score: number;
  evidence_refs: string[];
  metadata?: Record<string, unknown>;
  proposed_by: string;
}

/**
 * State transition payload
 */
export interface TransitionPayload {
  proposal_id: string;
  group_id: string;
  to_state: ProposalStatus;
  actor_id: string;
  actor_type: ActorType;
  reason?: string;
  metadata?: Record<string, unknown>;
}

/**
 * Audit log query params
 */
export interface AuditLogQuery {
  group_id: string;
  entity_type?: EntityType;
  entity_id?: string;
  actor_id?: string;
  action?: string;
  start_date?: Date;
  end_date?: Date;
  limit?: number;
  offset?: number;
}

/**
 * Audit log entry
 */
export interface AuditLogEntry {
  id: string;
  timestamp: Date;
  actor: string;
  actor_type: ActorType;
  action: string;
  entity_type: EntityType;
  entity_id: string;
  from_state: ProposalStatus | null;
  to_state: ProposalStatus;
  outcome: 'success' | 'failure';
  reason?: string;
  metadata: Record<string, unknown>;
}