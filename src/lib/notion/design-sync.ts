/**
 * Design Synchronization to Notion
 * Story 2.5: Synchronize Best Designs to the Notion Registry
 *
 * Mirrors AgentDesign nodes to Notion knowledge base.
 * Implements AC1: Syncs designs with confidence >= 0.7 after approval.
 * Implements AC2: Adds trace_ref link to PostgreSQL evidence.
 */

import { readTransaction, writeTransaction, type ManagedTransaction } from "../neo4j/connection";
import { getPool } from "../postgres/connection";
import { insertEvent } from "../postgres/queries/insert-trace";
import {
  getNotionClient,
  type CreatePageResult,
  type UpdatePageResult,
  type QueryDatabaseResult,
} from "./client";
import {
  buildDesignPageTemplate,
  buildMinimalPageTemplate,
  type AgentDesignSummary,
  type DesignPageTemplate,
  type NotionBlock,
} from "./templates";
import type { EvaluationMetrics } from "../adas/types";
import { randomUUID } from "crypto";

/**
 * Sync configuration
 */
export interface SyncConfig {
  /** Notion database ID for designs */
  databaseId: string;
  /** Minimum confidence score to sync (default: 0.7) */
  minConfidence: number;
  /** Only sync approved designs */
  requireApproval: boolean;
  /** Generate evidence URL from PostgreSQL trace_ref */
  evidenceBaseUrl: string;
}

/**
 * Default sync configuration
 */
const DEFAULT_SYNC_CONFIG: Omit<SyncConfig, "databaseId"> = {
  minConfidence: 0.7,
  requireApproval: true,
  evidenceBaseUrl: process.env.EVIDENCE_BASE_URL ?? "http://localhost:3000/evidence",
};

/**
 * Sync result for a single design
 */
export interface DesignSyncResult {
  designId: string;
  neo4jId: string;
  notionPageId: string | null;
  notionPageUrl: string | null;
  synced: boolean;
  error?: string;
  syncedAt: Date;
}

/**
 * Batch sync result
 */
export interface BatchSyncResult {
  results: DesignSyncResult[];
  syncedCount: number;
  failedCount: number;
  skippedCount: number;
}

/**
 * Sync status record (stored in PostgreSQL)
 */
export interface SyncStatusRecord {
  id: string;
  design_id: string;
  group_id: string;
  notion_page_id: string;
  notion_page_url: string;
  neo4j_id: string;
  version: number;
  synced_at: Date;
  neo4j_updated_at: Date;
  status: "synced" | "drift" | "error";
  error_message: string | null;
}

/**
 * Design sync manager
 * Handles mirroring AgentDesign nodes to Notion
 */
export class DesignSyncManager {
  private readonly config: SyncConfig;

  constructor(config: Partial<SyncConfig> & { databaseId: string }) {
    this.config = {
      ...DEFAULT_SYNC_CONFIG,
      ...config,
    };
  }

  /**
   * Sync a single design to Notion
   * AC1: Syncs designs with high confidence and approval
   * AC2: Adds trace_ref link
   */
  public async syncDesign(designId: string, groupId: string): Promise<DesignSyncResult> {
    const startTime = Date.now();

    try {
      await this.ensureSyncTablesExist();

      const design = await this.getApprovedDesign(designId, groupId);

      if (!design) {
        return {
          designId,
          neo4jId: "",
          notionPageId: null,
          notionPageUrl: null,
          synced: false,
          error: "Design not found or not approved",
          syncedAt: new Date(),
        };
      }

      if (!this.meetsSyncCriteria(design)) {
        return {
          designId,
          neo4jId: design.id,
          notionPageId: null,
          notionPageUrl: null,
          synced: false,
          error: `Design does not meet sync criteria (score: ${design.score}, status: ${design.status})`,
          syncedAt: new Date(),
        };
      }

      const existingSync = await this.getExistingSync(designId, groupId);

      const notionClient = getNotionClient();

      const evidenceUrl = this.buildEvidenceUrl(design.evidence_ref);
      const neo4jId = design.id;
      const designSummary = this.agentDesignToSummary(design);

      let notionPageId: string;
      let notionPageUrl: string;

      if (existingSync) {
        const updateResult = await this.updateNotionPage(
          notionClient,
          existingSync.notion_page_id,
          designSummary,
          evidenceUrl,
          neo4jId
        );
        notionPageId = updateResult.id;
        notionPageUrl = updateResult.url;
      } else {
        const createResult = await this.createNotionPage(
          notionClient,
          designSummary,
          evidenceUrl,
          neo4jId
        );
        notionPageId = createResult.id;
        notionPageUrl = createResult.url;
      }

      await this.saveSyncStatus({
        id: randomUUID(),
        design_id: designId,
        group_id: groupId,
        notion_page_id: notionPageId,
        notion_page_url: notionPageUrl,
        neo4j_id: neo4jId,
        version: design.version,
        synced_at: new Date(),
        neo4j_updated_at: design.updated_at,
        status: "synced",
        error_message: null,
      });

      await this.logSyncToPostgreSQL(groupId, designId, neo4jId, notionPageId, "success");

      return {
        designId,
        neo4jId: neo4jId,
        notionPageId,
        notionPageUrl,
        synced: true,
        syncedAt: new Date(),
      };
    } catch (error) {
      await this.logSyncToPostgreSQL(groupId, designId, "", "", "error", error);

      return {
        designId,
        neo4jId: "",
        notionPageId: null,
        notionPageUrl: null,
        synced: false,
        error: error instanceof Error ? error.message : "Unknown error",
        syncedAt: new Date(),
      };
    }
  }

  /**
   * Sync all approved designs for a group
   */
  public async syncAllApproved(groupId: string): Promise<BatchSyncResult> {
    await this.ensureSyncTablesExist();

    const designs = await this.listApprovedDesigns(groupId);

    const results: DesignSyncResult[] = [];
    let syncedCount = 0;
    let failedCount = 0;
    let skippedCount = 0;

    for (const design of designs) {
      if (!this.meetsSyncCriteria(design)) {
        skippedCount++;
        continue;
      }

      const result = await this.syncDesign(design.design_id, groupId);
      results.push(result);

      if (result.synced) {
        syncedCount++;
      } else {
        failedCount++;
      }
    }

    return {
      results,
      syncedCount,
      failedCount,
      skippedCount,
    };
  }

  /**
   * Check if design meets sync criteria
   * AC1: Score >= 0.7 and approved
   */
  private meetsSyncCriteria(design: AgentDesignNode): boolean {
    if (design.score < this.config.minConfidence) {
      return false;
    }

    if (this.config.requireApproval && design.status !== "approved") {
      return false;
    }

    return true;
  }

  /**
   * Get approved design from Neo4j
   */
  private async getApprovedDesign(
    designId: string,
    groupId: string
  ): Promise<AgentDesignNode | null> {
    const query = `
      MATCH (d:AgentDesign {design_id: $design_id, group_id: $group_id})
      RETURN d
    `;

    const result = await readTransaction(async (tx: ManagedTransaction) => {
      return tx.run(query, { design_id: designId, group_id: groupId });
    });

    if (result.records.length === 0) {
      return null;
    }

    const node = result.records[0].get("d").properties;
    return this.neo4jToAgentDesignNode(node);
  }

  /**
   * List all approved designs for a group
   */
  private async listApprovedDesigns(groupId: string): Promise<AgentDesignNode[]> {
    const query = `
      MATCH (d:AgentDesign {group_id: $group_id, status: 'approved'})
      WHERE d.score >= $min_score
      RETURN d
      ORDER BY d.score DESC
    `;

    const result = await readTransaction(async (tx: ManagedTransaction) => {
      return tx.run(query, {
        group_id: groupId,
        min_score: this.config.minConfidence,
      });
    });

    return result.records.map((record) => {
      const node = record.get("d").properties;
      return this.neo4jToAgentDesignNode(node);
    });
  }

  /**
   * Get existing sync status from PostgreSQL
   */
  private async getExistingSync(
    designId: string,
    groupId: string
  ): Promise<SyncStatusRecord | null> {
    const pool = getPool();

    const query = `
      SELECT 
        id, design_id, group_id, notion_page_id, notion_page_url,
        neo4j_id, version, synced_at, neo4j_updated_at, status, error_message
      FROM design_sync_status
      WHERE design_id = $1 AND group_id = $2
      ORDER BY synced_at DESC
      LIMIT 1
    `;

    const result = await pool.query(query, [designId, groupId]);

    if (result.rows.length === 0) {
      return null;
    }

    const row = result.rows[0];
    return {
      id: row.id,
      design_id: row.design_id,
      group_id: row.group_id,
      notion_page_id: row.notion_page_id,
      notion_page_url: row.notion_page_url,
      neo4j_id: row.neo4j_id,
      version: row.version,
      synced_at: row.synced_at,
      neo4j_updated_at: row.neo4j_updated_at,
      status: row.status,
      error_message: row.error_message,
    };
  }

  /**
   * Convert AgentDesignNode to AgentDesignSummary
   */
  private agentDesignToSummary(node: AgentDesignNode): AgentDesignSummary {
    return {
      designId: node.design_id,
      name: node.name,
      version: node.version,
      domain: node.domain,
      description: node.description,
      score: node.score,
      metrics: node.metrics,
      status: node.status,
      groupId: node.group_id,
      createdAt: node.created_at,
      updatedAt: node.updated_at,
      evidenceRef: node.evidence_ref,
      adasRunId: node.adas_run_id,
      config: node.config,
    };
  }

  /**
   * Create Notion page
   */
  private async createNotionPage(
    client: ReturnType<typeof getNotionClient>,
    design: AgentDesignSummary,
    evidenceUrl: string | null,
    neo4jId: string
  ): Promise<CreatePageResult> {
    const template = buildDesignPageTemplate(
      design,
      neo4jId,
      evidenceUrl
    );

    return client.createPage({
      parent: { database_id: this.config.databaseId },
      properties: template.properties as unknown as Record<string, unknown>,
      children: template.blocks as Array<{ object: "block"; type: string; [key: string]: unknown }>,
    });
  }

  /**
   * Update existing Notion page
   */
  private async updateNotionPage(
    client: ReturnType<typeof getNotionClient>,
    pageId: string,
    design: AgentDesignSummary,
    evidenceUrl: string | null,
    neo4jId: string
  ): Promise<UpdatePageResult> {
    const template = buildDesignPageTemplate(
      design,
      neo4jId,
      evidenceUrl
    );

    await client.appendBlocks({
      blockId: pageId,
      children: template.blocks as Array<{ object: "block"; type: string; [key: string]: unknown }>,
    });

    return client.updatePage({
      pageId,
      properties: template.properties as unknown as Record<string, unknown>,
    });
  }

  /**
   * Build evidence URL from trace_ref
   * AC2: Link to PostgreSQL evidence
   */
  private buildEvidenceUrl(traceRef: string | null): string | null {
    if (!traceRef) {
      return null;
    }

    const parts = traceRef.split(":");
    if (parts.length !== 2) {
      return null;
    }

    const [table, id] = parts;
    return `${this.config.evidenceBaseUrl}/${table}/${id}`;
  }

  /**
   * Save sync status to PostgreSQL
   */
  private async saveSyncStatus(record: SyncStatusRecord): Promise<void> {
    const pool = getPool();

    await pool.query(
      `
      INSERT INTO design_sync_status (
        id, design_id, group_id, notion_page_id, notion_page_url,
        neo4j_id, version, synced_at, neo4j_updated_at, status, error_message
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
    `,
      [
        record.id,
        record.design_id,
        record.group_id,
        record.notion_page_id,
        record.notion_page_url,
        record.neo4j_id,
        record.version,
        record.synced_at,
        record.neo4j_updated_at,
        record.status,
        record.error_message,
      ]
    );
  }

  /**
   * Ensure sync tables exist in PostgreSQL
   */
  private async ensureSyncTablesExist(): Promise<void> {
    const pool = getPool();

    await pool.query(`
      CREATE TABLE IF NOT EXISTS design_sync_status (
        id VARCHAR(255) PRIMARY KEY,
        design_id VARCHAR(255) NOT NULL,
        group_id VARCHAR(255) NOT NULL,
        notion_page_id VARCHAR(255) NOT NULL,
        notion_page_url TEXT,
        neo4j_id VARCHAR(255) NOT NULL,
        version INTEGER NOT NULL,
        synced_at TIMESTAMPTZ NOT NULL,
        neo4j_updated_at TIMESTAMPTZ NOT NULL,
        status VARCHAR(50) NOT NULL,
        error_message TEXT,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);

    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_design_sync_status_design 
      ON design_sync_status(design_id, synced_at DESC)
    `);

    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_design_sync_status_group 
      ON design_sync_status(group_id, synced_at DESC)
    `);
  }

  /**
   * Log sync event to PostgreSQL
   */
  private async logSyncToPostgreSQL(
    groupId: string,
    designId: string,
    neo4jId: string,
    notionPageId: string,
    status: "success" | "error",
    error?: unknown
  ): Promise<void> {
    await insertEvent({
      group_id: groupId,
      event_type: "notion_sync",
      agent_id: "design-sync-manager",
      workflow_id: `sync-${designId}`,
      metadata: {
        designId,
        neo4jId,
        notionPageId,
        status,
        error: error instanceof Error ? error.message : null,
      },
      status: status === "success" ? "completed" : "failed",
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
      source: node.source as "adas" | "manual" | "export",
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
 * Promotion status type
 */
type PromotionStatus = "pending_approval" | "approved" | "rejected";

/**
 * Agent design node type (from promotion-proposal.ts)
 */
interface AgentDesignNode {
  id: string;
  design_id: string;
  name: string;
  version: number;
  domain: string;
  description: string;
  config: Record<string, unknown>;
  source: "adas" | "manual" | "export" | "import";
  adas_run_id: string | null;
  score: number;
  metrics: EvaluationMetrics;
  group_id: string;
  status: PromotionStatus;
  evidence_ref: string | null;
  approved_by: string | null;
  approved_at: Date | null;
  rejection_reason: string | null;
  created_at: Date;
  updated_at: Date;
}

/**
 * Create a design sync manager
 */
export function createDesignSyncManager(
  databaseId: string,
  options?: Partial<Omit<SyncConfig, "databaseId">>
): DesignSyncManager {
  return new DesignSyncManager({
    databaseId,
    ...options,
  });
}

/**
 * Convenience function to sync a design
 */
export async function syncDesignToNotion(
  designId: string,
  groupId: string,
  databaseId: string,
  options?: Partial<Omit<SyncConfig, "databaseId">>
): Promise<DesignSyncResult> {
  const manager = new DesignSyncManager({
    databaseId,
    ...options,
  });
  return manager.syncDesign(designId, groupId);
}

/**
 * Convenience function to sync all approved designs
 */
export async function syncAllApprovedDesigns(
  groupId: string,
  databaseId: string,
  options?: Partial<Omit<SyncConfig, "databaseId">>
): Promise<BatchSyncResult> {
  const manager = new DesignSyncManager({
    databaseId,
    ...options,
  });
  return manager.syncAllApproved(groupId);
}