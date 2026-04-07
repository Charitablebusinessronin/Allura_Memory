/**
 * Approval Workflow for ADAS Promotion
 * Story 2.4: Automate Design Promotion Logic
 *
 * Manages approval/rejection of promotion proposals.
 * Implements AC2: Insight becomes active only after human approval in Mission Control
 */

import { writeTransaction, type ManagedTransaction } from "../neo4j/connection";
import {
  createInsight,
  createInsightVersion,
  type InsightRecord,
} from "../neo4j/queries/insert-insight";
import { getPool } from "../postgres/connection";
import { insertEvent } from "../postgres/queries/insert-trace";
import type {
  ApprovalAction,
  RejectionAction,
  AgentDesignNode,
  ApprovalHistoryRecord,
} from "./promotion-proposal";
import type { PromotionStatus } from "./promotion-detector";
import { randomUUID } from "crypto";

/**
 * Approval result
 */
export interface ApprovalResult {
  success: boolean;
  designId: string;
  status: PromotionStatus;
  approvedBy: string;
  approvedAt: Date;
  insightId?: string;
}

/**
 * Rejection result
 */
export interface RejectionResult {
  success: boolean;
  designId: string;
  status: PromotionStatus;
  rejectedBy: string;
  reason: string;
}

/**
 * Approval status check result
 */
export interface ApprovalStatus {
  designId: string;
  groupId: string;
  status: PromotionStatus;
  canApprove: boolean;
  canReject: boolean;
  approvedBy: string | null;
  approvedAt: Date | null;
  rejectionReason: string | null;
  history: ApprovalHistoryRecord[];
}

/**
 * Approval Workflow Manager
 * Handles approve/reject actions with audit trail
 */
export class ApprovalWorkflowManager {
  /**
   * Approve a promotion proposal
   * Implements AC2: Insight becomes active after approval
   */
  async approveProposal(action: ApprovalAction): Promise<ApprovalResult> {
    const { designId, groupId, approverId, reason } = action;

    const proposal = await this.getProposalForApproval(designId, groupId);

    if (!proposal) {
      throw new Error(`Proposal with design_id '${designId}' not found in group '${groupId}'`);
    }

    if (proposal.status !== "pending_approval") {
      throw new Error(
        `Proposal '${designId}' has status '${proposal.status}', cannot approve. Only 'pending_approval' proposals can be approved.`
      );
    }

    await this.ensureApprovalTablesExist();

    const updatedNode = await writeTransaction(async (tx: ManagedTransaction) => {
      const updateQuery = `
        MATCH (d:AgentDesign {design_id: $design_id, group_id: $group_id, status: 'pending_approval'})
        SET d.status = 'approved',
            d.approved_by = $approver_id,
            d.approved_at = datetime(),
            d.updated_at = datetime(),
            d.approval_reason = $reason
        RETURN d
      `;

      const result = await tx.run(updateQuery, {
        design_id: designId,
        group_id: groupId,
        approver_id: approverId,
        reason: reason ?? null,
      });

      if (result.records.length === 0) {
        throw new Error(`Failed to update proposal '${designId}' - may have been modified by another process`);
      }

      const node = result.records[0].get("d").properties;
      return this.neo4jToAgentDesignNode(node);
    });

    const insightRecord = await this.createActiveInsight(updatedNode, groupId, approverId);

    await this.createApprovalHistoryEntry({
      id: randomUUID(),
      design_id: designId,
      group_id: groupId,
      action: "approved",
      actor: approverId,
      reason: reason ?? null,
      previous_status: "pending_approval",
      new_status: "approved",
      created_at: new Date(),
    });

    await this.logApprovalToPostgreSQL(groupId, designId, approverId, reason);

    return {
      success: true,
      designId: designId,
      status: "approved",
      approvedBy: approverId,
      approvedAt: new Date(),
      insightId: insightRecord?.insight_id,
    };
  }

  /**
   * Reject a promotion proposal
   * Implements AC2: Rejected designs do not become active
   */
  async rejectProposal(action: RejectionAction): Promise<RejectionResult> {
    const { designId, groupId, rejectorId, reason } = action;

    if (!reason || reason.trim().length === 0) {
      throw new Error("Rejection reason is required");
    }

    const proposal = await this.getProposalForApproval(designId, groupId);

    if (!proposal) {
      throw new Error(`Proposal with design_id '${designId}' not found in group '${groupId}'`);
    }

    if (proposal.status !== "pending_approval") {
      throw new Error(
        `Proposal '${designId}' has status '${proposal.status}', cannot reject. Only 'pending_approval' proposals can be rejected.`
      );
    }

    await this.ensureApprovalTablesExist();

    await writeTransaction(async (tx: ManagedTransaction) => {
      const updateQuery = `
        MATCH (d:AgentDesign {design_id: $design_id, group_id: $group_id, status: 'pending_approval'})
        SET d.status = 'rejected',
            d.rejected_by = $rejector_id,
            d.rejection_reason = $reason,
            d.rejected_at = datetime(),
            d.updated_at = datetime()
        RETURN d
      `;

      const result = await tx.run(updateQuery, {
        design_id: designId,
        group_id: groupId,
        rejector_id: rejectorId,
        reason: reason,
      });

      if (result.records.length === 0) {
        throw new Error(`Failed to reject proposal '${designId}' - may have been modified by another process`);
      }
    });

    await this.createApprovalHistoryEntry({
      id: randomUUID(),
      design_id: designId,
      group_id: groupId,
      action: "rejected",
      actor: rejectorId,
      reason: reason,
      previous_status: "pending_approval",
      new_status: "rejected",
      created_at: new Date(),
    });

    await this.logRejectionToPostgreSQL(groupId, designId, rejectorId, reason);

    return {
      success: true,
      designId: designId,
      status: "rejected",
      rejectedBy: rejectorId,
      reason: reason,
    };
  }

  /**
   * Get approval status for a proposal
   */
  async getApprovalStatus(designId: string, groupId: string): Promise<ApprovalStatus | null> {
    const query = `
      MATCH (d:AgentDesign {design_id: $design_id, group_id: $group_id})
      RETURN d
    `;

    const result = await writeTransaction(async (tx: ManagedTransaction) => {
      return tx.run(query, { design_id: designId, group_id: groupId });
    });

    if (result.records.length === 0) {
      return null;
    }

    const node = result.records[0].get("d").properties;
    const proposal = this.neo4jToAgentDesignNode(node);

    const history = await this.getApprovalHistory(designId, groupId);

    return {
      designId: proposal.design_id,
      groupId: proposal.group_id,
      status: proposal.status,
      canApprove: proposal.status === "pending_approval",
      canReject: proposal.status === "pending_approval",
      approvedBy: proposal.approved_by,
      approvedAt: proposal.approved_at,
      rejectionReason: proposal.rejection_reason,
      history: history,
    };
  }

  /**
   * Auto-approve a proposal when its Harbor benchmark score meets a threshold.
   * Used by ADAS self-improvement loop to bypass HITL for benchmark runs.
   *
   * If score >= threshold: approves with actor 'system:harbor-auto-approve'
   * and a machine-generated reason. Full audit trail is preserved.
   *
   * If score < threshold: returns null — human review remains required.
   *
   * The existing HITL path (approveProposal) is unchanged for all non-Harbor flows.
   */
  async autoApproveIfThresholdMet(
    designId: string,
    groupId: string,
    score: number,
    threshold: number
  ): Promise<ApprovalResult | null> {
    if (score < threshold) {
      return null;
    }

    const reason =
      `Harbor benchmark auto-approval: score ${score.toFixed(4)} >= threshold ${threshold.toFixed(4)}. ` +
      `Approved by system at ${new Date().toISOString()}.`;

    return this.approveProposal({
      designId,
      groupId,
      approverId: "system:harbor-auto-approve",
      reason,
    });
  }

  /**
   * Get approval history for a proposal
   */
  async getApprovalHistory(designId: string, groupId: string): Promise<ApprovalHistoryRecord[]> {
    const pool = getPool();

    const query = `
      SELECT 
        id, design_id, group_id, action, actor, reason,
        previous_status, new_status, created_at
      FROM approval_history
      WHERE design_id = $1 AND group_id = $2
      ORDER BY created_at DESC
    `;

    const result = await pool.query(query, [designId, groupId]);

    return result.rows.map((row) => ({
      id: row.id,
      design_id: row.design_id,
      group_id: row.group_id,
      action: row.action,
      actor: row.actor,
      reason: row.reason,
      previous_status: row.previous_status as PromotionStatus | null,
      new_status: row.new_status as PromotionStatus,
      created_at: row.created_at,
    }));
  }

  /**
   * List all proposals by status
   */
  async listProposalsByStatus(
    groupId: string,
    status: PromotionStatus
  ): Promise<AgentDesignNode[]> {
    const query = `
      MATCH (d:AgentDesign {group_id: $group_id, status: $status})
      RETURN d
      ORDER BY d.created_at DESC
    `;

    const result = await writeTransaction(async (tx: ManagedTransaction) => {
      return tx.run(query, { group_id: groupId, status: status });
    });

    return result.records.map((record) => {
      const node = record.get("d").properties;
      return this.neo4jToAgentDesignNode(node);
    });
  }

  /**
   * Get proposal for approval (private helper)
   */
  private async getProposalForApproval(
    designId: string,
    groupId: string
  ): Promise<AgentDesignNode | null> {
    const query = `
      MATCH (d:AgentDesign {design_id: $design_id, group_id: $group_id})
      RETURN d
    `;

    const result = await writeTransaction(async (tx: ManagedTransaction) => {
      return tx.run(query, { design_id: designId, group_id: groupId });
    });

    if (result.records.length === 0) {
      return null;
    }

    const node = result.records[0].get("d").properties;
    return this.neo4jToAgentDesignNode(node);
  }

  /**
   * Create active Insight from approved AgentDesign
   * This satisfies AC2: the insight becomes active after approval
   */
  private async createActiveInsight(
    proposal: AgentDesignNode,
    groupId: string,
    approverId: string
  ): Promise<InsightRecord | null> {
    try {
      const insightContent = `ADAS Design: ${proposal.name}

Domain: ${proposal.domain}
Score: ${proposal.score.toFixed(4)}
Source: ADAS Run ${proposal.adas_run_id}

Description: ${proposal.description}

Configuration:
${JSON.stringify(proposal.config, null, 2)}

Metrics:
- Accuracy: ${(proposal.metrics.accuracy * 100).toFixed(2)}%
- Cost: $${proposal.metrics.cost.toFixed(6)}
- Latency: ${proposal.metrics.latency.toFixed(2)}ms
- Composite Score: ${(proposal.metrics.composite * 100).toFixed(2)}%`;

      const insight = await createInsight({
        insight_id: `adas-${proposal.design_id}`,
        group_id: groupId,
        content: insightContent,
        confidence: proposal.score,
        source_type: "promotion",
        source_ref: proposal.evidence_ref ?? undefined,
        created_by: `approver:${approverId}`,
        metadata: {
          design_id: proposal.design_id,
          adas_run_id: proposal.adas_run_id,
          domain: proposal.domain,
          approved_by: approverId,
          approved_at: new Date().toISOString(),
          metrics: proposal.metrics,
        },
      });

      return insight;
    } catch (error) {
      console.error("[ApprovalWorkflow] Failed to create insight:", error);
      return null;
    }
  }

  /**
   * Ensure approval tables exist in PostgreSQL
   */
  private async ensureApprovalTablesExist(): Promise<void> {
    const pool = getPool();

    await pool.query(`
      CREATE TABLE IF NOT EXISTS approval_history (
        id VARCHAR(255) PRIMARY KEY,
        design_id VARCHAR(255) NOT NULL,
        group_id VARCHAR(255) NOT NULL,
        action VARCHAR(50) NOT NULL,
        actor VARCHAR(255) NOT NULL,
        reason TEXT,
        previous_status VARCHAR(50),
        new_status VARCHAR(50) NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);

    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_approval_history_design 
      ON approval_history(design_id, created_at DESC)
    `);
  }

  /**
   * Create approval history entry
   */
  private async createApprovalHistoryEntry(entry: ApprovalHistoryRecord): Promise<void> {
    const pool = getPool();

    await pool.query(
      `
      INSERT INTO approval_history (
        id, design_id, group_id, action, actor, reason,
        previous_status, new_status, created_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
    `,
      [
        entry.id,
        entry.design_id,
        entry.group_id,
        entry.action,
        entry.actor,
        entry.reason,
        entry.previous_status,
        entry.new_status,
        entry.created_at,
      ]
    );
  }

  /**
   * Log approval to PostgreSQL
   */
  private async logApprovalToPostgreSQL(
    groupId: string,
    designId: string,
    approverId: string,
    reason?: string
  ): Promise<void> {
    await insertEvent({
      group_id: groupId,
      event_type: "promotion_approved",
      agent_id: "approval-workflow",
      workflow_id: `approval-${designId}`,
      metadata: {
        designId,
        approverId,
        reason: reason ?? null,
        timestamp: new Date().toISOString(),
      },
      status: "completed",
    });
  }

  /**
   * Log rejection to PostgreSQL
   */
  private async logRejectionToPostgreSQL(
    groupId: string,
    designId: string,
    rejectorId: string,
    reason: string
  ): Promise<void> {
    await insertEvent({
      group_id: groupId,
      event_type: "promotion_rejected",
      agent_id: "approval-workflow",
      workflow_id: `rejection-${designId}`,
      metadata: {
        designId,
        rejectorId,
        reason,
        timestamp: new Date().toISOString(),
      },
      status: "completed",
    });
  }

  /**
   * Convert Neo4j node to AgentDesignNode
   */
  private neo4jToAgentDesignNode(node: Record<string, unknown>): AgentDesignNode {
    const convertNumber = (val: unknown): number => {
      if (typeof val === "object" && val !== null && "toNumber" in val) {
        return (val as { toNumber: () => number }).toNumber();
      }
      return val as number;
    };

    const convertDate = (val: unknown): Date => {
      if (val === null || val === undefined) return new Date();
      if (typeof val === "object" && val !== null) {
        const dt = val as { toString?: () => string };
        if (typeof dt.toString === "function") {
          return new Date(dt.toString());
        }
      }
      return new Date(val as string);
    };

    return {
      id: node.id as string,
      design_id: node.design_id as string,
      name: node.name as string,
      version: convertNumber(node.version),
      domain: node.domain as string,
      description: node.description as string,
      config: JSON.parse((node.config as string) ?? "{}"),
      source: node.source as "adas",
      adas_run_id: node.adas_run_id as string | null,
      score: convertNumber(node.score),
      metrics: JSON.parse((node.metrics as string) ?? "{}"),
      group_id: node.group_id as string,
      status: node.status as PromotionStatus,
      evidence_ref: node.evidence_ref as string | null,
      approved_by: node.approved_by as string | null,
      approved_at: node.approved_at ? convertDate(node.approved_at) : null,
      rejection_reason: node.rejection_reason as string | null,
      created_at: convertDate(node.created_at),
      updated_at: convertDate(node.updated_at),
    };
  }
}

/**
 * Create an approval workflow manager
 */
export function createApprovalWorkflowManager(): ApprovalWorkflowManager {
  return new ApprovalWorkflowManager();
}

/**
 * Convenience function to approve a proposal
 */
export async function approveProposal(
  designId: string,
  groupId: string,
  approverId: string,
  reason?: string
): Promise<ApprovalResult> {
  const manager = new ApprovalWorkflowManager();
  return manager.approveProposal({
    designId,
    groupId,
    approverId,
    reason,
  });
}

/**
 * Convenience function to reject a proposal
 */
export async function rejectProposal(
  designId: string,
  groupId: string,
  rejectorId: string,
  reason: string
): Promise<RejectionResult> {
  const manager = new ApprovalWorkflowManager();
  return manager.rejectProposal({
    designId,
    groupId,
    rejectorId,
    reason,
  });
}

/**
 * Convenience function to get approval status
 */
export async function getApprovalStatus(
  designId: string,
  groupId: string
): Promise<ApprovalStatus | null> {
  const manager = new ApprovalWorkflowManager();
  return manager.getApprovalStatus(designId, groupId);
}

/**
 * Convenience function to list proposals by status
 */
export async function listProposalsByStatus(
  groupId: string,
  status: PromotionStatus
): Promise<AgentDesignNode[]> {
  const manager = new ApprovalWorkflowManager();
  return manager.listProposalsByStatus(groupId, status);
}

/**
 * Convenience function for Harbor benchmark auto-approval.
 * Returns ApprovalResult if score >= threshold, null otherwise.
 */
export async function autoApproveIfThresholdMet(
  designId: string,
  groupId: string,
  score: number,
  threshold: number
): Promise<ApprovalResult | null> {
  const manager = new ApprovalWorkflowManager();
  return manager.autoApproveIfThresholdMet(designId, groupId, score, threshold);
}