/**
 * Promotion Proposal Creation for ADAS
 * Story 2.4: Automate Design Promotion Logic
 *
 * Creates Neo4j AgentDesign proposals for high-confidence designs.
 * Implements AC1: Creates candidate versioned Insight/AgentDesign with linked evidence
 */

import { writeTransaction, type ManagedTransaction } from "../neo4j/connection";
import {
  createInsight,
  type InsightRecord,
  type InsightStatus,
} from "../neo4j/queries/insert-insight";
import { getPool } from "../postgres/connection";
import { insertEvent, insertOutcome } from "../postgres/queries/insert-trace";
import type { PromotionCandidate, PromotionStatus } from "./promotion-detector";
import type { AgentDesign, EvaluationMetrics } from "./types";
import { randomUUID } from "crypto";

/**
 * AgentDesign node type
 * Stored in Neo4j for versioned agent designs
 */
export interface AgentDesignNode {
  /** Unique identifier */
  id: string;
  /** Stable design ID (same across versions) */
  design_id: string;
  /** Human-readable name */
  name: string;
  /** Version number */
  version: number;
  /** Domain this design is for */
  domain: string;
  /** Description of the agent architecture */
  description: string;
  /** Configuration JSON */
  config: Record<string, unknown>;
  /** Source of this design (adas, manual, import) */
  source: "adas" | "manual" | "import";
  /** ADAS run ID (if source is adas) */
  adas_run_id: string | null;
  /** Score from evaluation */
  score: number;
  /** Metrics from evaluation */
  metrics: EvaluationMetrics;
  /** Tenant isolation */
  group_id: string;
  /** Current status */
  status: PromotionStatus;
  /** Reference to PostgreSQL evidence */
  evidence_ref: string | null;
  /** Approval metadata */
  approved_by: string | null;
  approved_at: Date | null;
  rejection_reason: string | null;
  /** Timestamps */
  created_at: Date;
  updated_at: Date;
}

/**
 * AgentDesign head node (tracks current version)
 */
export interface AgentDesignHead {
  design_id: string;
  group_id: string;
  current_version: number;
  current_id: string;
  created_at: Date;
  updated_at: Date;
}

/**
 * Proposal creation payload
 */
export interface CreateProposalPayload {
  /** Promotion candidate */
  candidate: PromotionCandidate;
  /** Group ID */
  groupId: string;
  /** Custom description */
  description?: string;
  /** Additional metadata */
  metadata?: Record<string, unknown>;
}

/**
 * Proposal creation result
 */
export interface CreateProposalResult {
  success: boolean;
  designId: string;
  neo4jId: string;
  version: number;
  status: PromotionStatus;
  evidenceRef: string;
  createdAt: Date;
}

/**
 * Approval action payload
 */
export interface ApprovalAction {
  /** Design ID */
  designId: string;
  /** Group ID */
  groupId: string;
  /** Approver user ID */
  approverId: string;
  /** Approval reason */
  reason?: string;
}

/**
 * Rejection action payload
 */
export interface RejectionAction {
  /** Design ID */
  designId: string;
  /** Group ID */
  groupId: string;
  /** Rejector user ID */
  rejectorId: string;
  /** Rejection reason (required) */
  reason: string;
}

/**
 * Approval history record
 */
export interface ApprovalHistoryRecord {
  id: string;
  design_id: string;
  group_id: string;
  action: "created" | "approved" | "rejected";
  actor: string;
  reason: string | null;
  previous_status: PromotionStatus | null;
  new_status: PromotionStatus;
  created_at: Date;
}

/**
 * Promotion Proposal Manager
 * Creates and manages AgentDesign proposals in Neo4j
 */
export class PromotionProposalManager {
  /**
   * Create a promotion proposal from a candidate
   * Implements AC1: Creates candidate AgentDesign node with linked evidence
   */
  async createProposal(payload: CreateProposalPayload): Promise<CreateProposalResult> {
    const { candidate, groupId, description, metadata } = payload;

    await this.ensureProposalTablesExist();

    const designId = candidate.designId;
    const evidenceRef = candidate.evidenceRef;

    const result = await writeTransaction(async (tx: ManagedTransaction) => {
      const checkQuery = `
        MATCH (d:AgentDesign {design_id: $design_id, group_id: $group_id})
        RETURN d
      `;

      const checkResult = await tx.run(checkQuery, {
        design_id: designId,
        group_id: groupId,
      });

      if (checkResult.records.length > 0) {
        const existing = checkResult.records[0];
        const existingNode = existing.get("d").properties;

        return {
          neo4jId: existingNode.id as string,
          designId: designId,
          version: existingNode.version as number,
          status: existingNode.status as PromotionStatus,
          evidenceRef: existingNode.evidence_ref as string,
          createdAt: new Date(existingNode.created_at as string),
        };
      }

      const versionQuery = `
        MATCH (h:AgentDesignHead {design_id: $design_id, group_id: $group_id})
        RETURN h.current_version as current_version
      `;

      const versionResult = await tx.run(versionQuery, {
        design_id: designId,
        group_id: groupId,
      });

      const currentVersion = versionResult.records.length > 0
        ? (versionResult.records[0].get("current_version") as { toNumber?: () => number } | number)
        : 0;

      const version = typeof currentVersion === "object" && currentVersion.toNumber
        ? currentVersion.toNumber() + 1
        : (currentVersion as number) + 1;

      const insertQuery = `
        CREATE (d:AgentDesign {
          id: randomUUID(),
          design_id: $design_id,
          name: $name,
          version: $version,
          domain: $domain,
          description: $description,
          config: $config,
          source: 'adas',
          adas_run_id: $adas_run_id,
          score: $score,
          metrics: $metrics,
          group_id: $group_id,
          status: 'pending_approval',
          evidence_ref: $evidence_ref,
          approved_by: null,
          approved_at: null,
          rejection_reason: null,
          created_at: datetime(),
          updated_at: datetime()
        })
        WITH d
        MERGE (h:AgentDesignHead {design_id: $design_id, group_id: $group_id})
        ON CREATE SET 
          h.group_id = $group_id,
          h.created_at = datetime()
        SET 
          h.current_version = $version,
          h.current_id = d.id,
          h.updated_at = datetime()
        CREATE (d)-[:VERSION_OF]->(h)
        RETURN d
      `;

      const insertResult = await tx.run(insertQuery, {
        design_id: designId,
        name: `adas-promotion-${designId}`,
        version: version,
        domain: candidate.domain,
        description: description ?? candidate.design.description ?? "ADAS-generated design",
        config: JSON.stringify(candidate.design.config),
        adas_run_id: candidate.runId,
        score: candidate.score,
        metrics: JSON.stringify(candidate.metrics),
        group_id: groupId,
        evidence_ref: evidenceRef,
      });

      const node = insertResult.records[0].get("d").properties;

      return {
        neo4jId: node.id as string,
        designId: designId,
        version: version,
        status: node.status as PromotionStatus,
        evidenceRef: node.evidence_ref as string,
        createdAt: new Date(node.created_at as string),
      };
    });

    await this.logProposalCreation(groupId, candidate, result);

    await this.createApprovalHistoryEntry({
      id: randomUUID(),
      design_id: designId,
      group_id: groupId,
      action: "created",
      actor: "adas-promotion-system",
      reason: null,
      previous_status: null,
      new_status: "pending_approval",
      created_at: new Date(),
    });

    return {
      success: true,
      designId: result.designId,
      neo4jId: result.neo4jId,
      version: result.version,
      status: result.status,
      evidenceRef: result.evidenceRef,
      createdAt: result.createdAt,
    };
  }

  /**
   * Get all pending proposals
   * Used by Mission Control to show proposals requiring approval
   */
  async getPendingProposals(groupId: string): Promise<AgentDesignNode[]> {
    const query = `
      MATCH (d:AgentDesign {group_id: $group_id, status: 'pending_approval'})
      RETURN d
      ORDER BY d.created_at DESC
    `;

    const result = await writeTransaction(async (tx: ManagedTransaction) => {
      return tx.run(query, { group_id: groupId });
    });

    return result.records.map((record) => {
      const node = record.get("d").properties;
      return this.neo4jToAgentDesignNode(node);
    });
  }

  /**
   * Get proposal by design ID
   */
  async getProposal(designId: string, groupId: string): Promise<AgentDesignNode | null> {
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
   * Ensure PostgreSQL proposal tables exist
   */
  private async ensureProposalTablesExist(): Promise<void> {
    const pool = getPool();

    await pool.query(`
      CREATE TABLE IF NOT EXISTS promotion_candidates (
        id SERIAL PRIMARY KEY,
        design_id VARCHAR(255) NOT NULL,
        run_id VARCHAR(255) NOT NULL,
        group_id VARCHAR(255) NOT NULL,
        domain VARCHAR(255) NOT NULL,
        score DECIMAL(10, 6) NOT NULL,
        design_data JSONB DEFAULT '{}'::jsonb,
        metrics JSONB DEFAULT '{}'::jsonb,
        evidence_ref TEXT,
        status VARCHAR(50) NOT NULL DEFAULT 'candidate',
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        UNIQUE(design_id, group_id)
      )
    `);

    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_promotion_candidates_status 
      ON promotion_candidates(status, created_at DESC)
    `);

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
   * Log proposal creation to PostgreSQL
   */
  private async logProposalCreation(
    groupId: string,
    candidate: PromotionCandidate,
    result: { designId: string; neo4jId: string; version: number }
  ): Promise<void> {
    await insertEvent({
      group_id: groupId,
      event_type: "promotion_proposal_created",
      agent_id: "promotion-proposal-manager",
      workflow_id: candidate.runId,
      metadata: {
        designId: result.designId,
        neo4jId: result.neo4jId,
        version: result.version,
        runId: candidate.runId,
        score: candidate.score,
        domain: candidate.domain,
      },
      status: "completed",
    });

    await insertOutcome({
      group_id: groupId,
      event_id: 0,
      outcome_type: "promotion_result",
      confidence: candidate.score,
      data: {
        designId: result.designId,
        status: "pending_approval",
        threshold: 0.7,
        passed: true,
      },
    });
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
 * Create a promotion proposal manager
 */
export function createPromotionProposalManager(): PromotionProposalManager {
  return new PromotionProposalManager();
}

/**
 * Convenience function to create a proposal
 */
export async function createPromotionProposal(
  candidate: PromotionCandidate,
  groupId: string,
  options: { description?: string; metadata?: Record<string, unknown> } = {}
): Promise<CreateProposalResult> {
  const manager = new PromotionProposalManager();
  return manager.createProposal({
    candidate,
    groupId,
    description: options.description,
    metadata: options.metadata,
  });
}

/**
 * Convenience function to get pending proposals
 */
export async function getPendingProposals(groupId: string): Promise<AgentDesignNode[]> {
  const manager = new PromotionProposalManager();
  return manager.getPendingProposals(groupId);
}