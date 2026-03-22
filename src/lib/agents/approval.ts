/**
 * Agent Approval Workflow
 * Epic 6, Story 6.9: Require Human Approval for Agent Promotion
 */

import { AgentPostgresClient, getAgentClient, AgentRecord } from './postgres-client';
import { AgentLifecycle, getAgentLifecycle } from './lifecycle';

export type ApprovalStatus = 'pending' | 'approved' | 'rejected';

export interface ApprovalRequest {
  id: string;
  agent_id: string;
  agent_name: string;
  requested_by: string;
  status: ApprovalStatus;
  confidence_score: number;
  reviewed_by?: string;
  reviewed_at?: Date;
  feedback?: string;
  rejection_reason?: string;
  created_at: Date;
}

export interface ApprovalStats {
  pending: number;
  approved: number;
  rejected: number;
  avg_approval_time_ms: number;
}

const APPROVAL_THRESHOLD = 0.7;

// PostgreSQL table for approval requests
const APPROVAL_TABLE_SQL = `
CREATE TABLE IF NOT EXISTS agent_approvals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id TEXT NOT NULL,
  agent_name TEXT NOT NULL,
  requested_by TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  confidence_score DECIMAL(3,2) NOT NULL,
  reviewed_by TEXT,
  reviewed_at TIMESTAMPTZ,
  feedback TEXT,
  rejection_reason TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  FOREIGN KEY (agent_id) REFERENCES agents(agent_id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_approvals_agent_id ON agent_approvals(agent_id);
CREATE INDEX IF NOT EXISTS idx_approvals_status ON agent_approvals(status);
`;

export class AgentApproval {
  private pgClient: AgentPostgresClient;
  private lifecycle: AgentLifecycle;

  constructor(pgClient?: AgentPostgresClient, lifecycle?: AgentLifecycle) {
    this.pgClient = pgClient || getAgentClient();
    this.lifecycle = lifecycle || getAgentLifecycle();
  }

  async initialize(): Promise<void> {
    await (this.pgClient as any).pool.query(APPROVAL_TABLE_SQL);
  }

  async requestApproval(agentId: string, requestedBy: string): Promise<ApprovalRequest> {
    // Get agent
    const agent = await this.pgClient.getAgent(agentId);
    
    if (!agent) {
      throw new Error(`Agent ${agentId} not found`);
    }

    // Check if agent is in Testing state
    if (agent.status !== 'Testing') {
      throw new Error(`Agent ${agentId} must be in Testing state to request approval. Current: ${agent.status}`);
    }

    // Check confidence threshold
    if (agent.confidence_score < APPROVAL_THRESHOLD) {
      throw new Error(`Agent ${agentId} confidence ${agent.confidence_score} below threshold ${APPROVAL_THRESHOLD}`);
    }

    // Check if approval already pending
    const existing = await this.getPendingApproval(agentId);
    if (existing) {
      throw new Error(`Approval request already pending for agent ${agentId}`);
    }

    // Create approval request
    const result = await (this.pgClient as any).pool.query(
      `INSERT INTO agent_approvals (agent_id, agent_name, requested_by, status, confidence_score)
       VALUES ($1, $2, $3, 'pending', $4)
       RETURNING *`,
      [agent.agent_id, agent.name, requestedBy, agent.confidence_score]
    );

    const row = result.rows[0];

    return {
      id: row.id,
      agent_id: row.agent_id,
      agent_name: row.agent_name,
      requested_by: row.requested_by,
      status: row.status,
      confidence_score: parseFloat(row.confence_score),
      created_at: row.created_at
    };
  }

  async approve(agentId: string, reviewedBy: string, feedback?: string): Promise<void> {
    // Get pending approval
    const approval = await this.getPendingApproval(agentId);
    
    if (!approval) {
      throw new Error(`No pending approval for agent ${agentId}`);
    }

    // Update approval status
    await (this.pgClient as any).pool.query(
      `UPDATE agent_approvals 
       SET status = 'approved', reviewed_by = $1, reviewed_at = NOW(), feedback = $2
       WHERE id = $3`,
      [reviewedBy, feedback || null, approval.id]
    );

    // Transition agent to Active
    await this.lifecycle.transition(agentId, 'Active', 'Approved by ' + reviewedBy, reviewedBy);
  }

  async reject(agentId: string, reviewedBy: string, reason: string): Promise<void> {
    // Get pending approval
    const approval = await this.getPendingApproval(agentId);
    
    if (!approval) {
      throw new Error(`No pending approval for agent ${agentId}`);
    }

    // Update approval status
    await (this.pgClient as any).pool.query(
      `UPDATE agent_approvals 
       SET status = 'rejected', reviewed_by = $1, reviewed_at = NOW(), rejection_reason = $2
       WHERE id = $3`,
      [reviewedBy, reason, approval.id]
    );

    // Transition agent back to Draft
    await this.lifecycle.transition(agentId, 'Draft', 'Rejected: ' + reason);
  }

  async getPendingApproval(agentId: string): Promise<ApprovalRequest | null> {
    const result = await (this.pgClient as any).pool.query(
      `SELECT * FROM agent_approvals WHERE agent_id = $1 AND status = 'pending'`,
      [agentId]
    );

    if (result.rows.length === 0) {
      return null;
    }

    return this.rowToApproval(result.rows[0]);
  }

  async getPendingApprovals(): Promise<ApprovalRequest[]> {
    const result = await (this.pgClient as any).pool.query(
      `SELECT * FROM agent_approvals WHERE status = 'pending' ORDER BY created_at ASC`
    );

    return result.rows.map(row => this.rowToApproval(row));
  }

  async getApprovalHistory(agentId: string): Promise<ApprovalRequest[]> {
    const result = await (this.pgClient as any).pool.query(
      `SELECT * FROM agent_approvals WHERE agent_id = $1 ORDER BY created_at DESC`,
      [agentId]
    );

    return result.rows.map(row => this.rowToApproval(row));
  }

  async getApprovalStats(): Promise<ApprovalStats> {
    const result = await (this.pgClient as any).pool.query(
      `SELECT 
        COUNT(*) FILTER (WHERE status = 'pending') as pending,
        COUNT(*) FILTER (WHERE status = 'approved') as approved,
        COUNT(*) FILTER (WHERE status = 'rejected') as rejected,
        AVG(EXTRACT(EPOCH FROM (reviewed_at - created_at)) * 1000) FILTER (WHERE status IN ('approved', 'rejected')) as avg_approval_time_ms
       FROM agent_approvals`
    );

    const row = result.rows[0];

    return {
      pending: parseInt(row.pending) || 0,
      approved: parseInt(row.approved) || 0,
      rejected: parseInt(row.rejected) || 0,
      avg_approval_time_ms: parseFloat(row.avg_approval_time_ms) || 0
    };
  }

  async autoApproveIfNeeded(): Promise<ApprovalRequest[]> {
    // Get all Testing agents with confidence >= threshold that don't have pending approvals
    const result = await (this.pgClient as any).pool.query(
      `SELECT a.* FROM agents a
       WHERE a.status = 'Testing' 
       AND a.confidence_score >= $1
       AND NOT EXISTS (
         SELECT 1 FROM agent_approvals ap 
         WHERE ap.agent_id = a.agent_id AND ap.status = 'pending'
       )`,
      [APPROVAL_THRESHOLD]
    );

    const autoApproved: ApprovalRequest[] = [];

    for (const row of result.rows) {
      // Create approval request
      const approval = await this.requestApproval(row.agent_id, 'system');
      
      // Auto-approve
      await this.approve(row.agent_id, 'system', 'Auto-approved: confidence threshold met');
      
      autoApproved.push(approval);
    }

    return autoApproved;
  }

  private rowToApproval(row: any): ApprovalRequest {
    return {
      id: row.id,
      agent_id: row.agent_id,
      agent_name: row.agent_name,
      requested_by: row.requested_by,
      status: row.status,
      confidence_score: parseFloat(row.confidence_score),
      reviewed_by: row.reviewed_by,
      reviewed_at: row.reviewed_at,
      feedback: row.feedback,
      rejection_reason: row.rejection_reason,
      created_at: row.created_at
    };
  }
}

// Singleton instance
let approvalInstance: AgentApproval | null = null;

export function getAgentApproval(): AgentApproval {
  if (!approvalInstance) {
    approvalInstance = new AgentApproval();
  }
  return approvalInstance;
}