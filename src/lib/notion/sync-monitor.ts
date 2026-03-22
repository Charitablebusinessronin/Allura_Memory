/**
 * Sync Drift Detection and Monitoring
 * Story 2.5: Synchronize Best Designs to the Notion Registry
 *
 * Detects and handles sync drift between Neo4j and Notion.
 * Implements AC3: System detects and handles sync drift.
 */

import { readTransaction, type ManagedTransaction } from "../neo4j/connection";
import { getPool } from "../postgres/connection";
import { insertEvent } from "../postgres/queries/insert-trace";
import { getNotionClient } from "./client";
import type { EvaluationMetrics } from "../adas/types";

/**
 * Sync drift status
 */
export type SyncDriftStatus = "synced" | "drift" | "notion_ahead" | "neo4j_ahead" | "missing";

/**
 * Drift detection result for a single design
 */
export interface DriftCheckResult {
  designId: string;
  groupId: string;
  neo4jId: string;
  notionPageId: string | null;
  status: SyncDriftStatus;
  neo4jUpdatedAt: Date | null;
  notionUpdatedAt: Date | null;
  lastSyncedAt: Date | null;
  driftSeconds: number | null;
  message: string;
}

/**
 * Batch drift check result
 */
export interface BatchDriftResult {
  results: DriftCheckResult[];
  syncedCount: number;
  driftedCount: number;
  missingCount: number;
  errorCount: number;
}

/**
 * Sync status from PostgreSQL
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
 * Notion page properties for comparison
 */
interface NotionPageInfo {
  id: string;
  lastEditedTime: Date;
  properties: {
    Design_ID?: { rich_text?: Array<{ text: { content: string } }> };
    Updated_At?: { date: { start: string } };
  };
}

/**
 * Drift resolution action
 */
export type DriftAction = "resync" | "skip" | "notify" | "mark_drift";

/**
 * Drift resolution config
 */
export interface DriftConfig {
  /** Threshold in seconds before considering drift (default: 300 = 5 min) */
  driftThresholdSeconds: number;
  /** Action to take when Neo4j is ahead */
  neo4jAheadAction: DriftAction;
  /** Action to take when Notion is ahead */
  notionAheadAction: DriftAction;
  /** Action to take when sync record is missing */
  missingAction: DriftAction;
  /** Database ID for Notion */
  databaseId: string;
}

const DEFAULT_DRIFT_CONFIG: Omit<DriftConfig, "databaseId"> = {
  driftThresholdSeconds: 300,
  neo4jAheadAction: "resync",
  notionAheadAction: "notify",
  missingAction: "resync",
};

/**
 * Sync Monitor
 * Detects and handles drift between Neo4j and Notion
 */
export class SyncMonitor {
  private readonly config: DriftConfig;

  constructor(config: Partial<DriftConfig> & { databaseId: string }) {
    this.config = {
      ...DEFAULT_DRIFT_CONFIG,
      ...config,
    };
  }

  /**
   * Check drift for a single design
   * AC3: Detects sync drift between systems
   */
  public async checkDrift(
    designId: string,
    groupId: string
  ): Promise<DriftCheckResult> {
    try {
      const neo4jData = await this.getNeo4jDesign(designId, groupId);
      const syncStatus = await this.getSyncStatus(designId, groupId);

      if (!neo4jData) {
        return {
          designId,
          groupId,
          neo4jId: "",
          notionPageId: syncStatus?.notion_page_id ?? null,
          status: "missing",
          neo4jUpdatedAt: null,
          notionUpdatedAt: null,
          lastSyncedAt: syncStatus?.synced_at ?? null,
          driftSeconds: null,
          message: "Design not found in Neo4j",
        };
      }

      if (!syncStatus) {
        return {
          designId,
          groupId,
          neo4jId: neo4jData.id,
          notionPageId: null,
          status: "missing",
          neo4jUpdatedAt: neo4jData.updated_at,
          notionUpdatedAt: null,
          lastSyncedAt: null,
          driftSeconds: null,
          message: "No sync record found - design may not have been synced",
        };
      }

      const notionPage = await this.getNotionPage(syncStatus.notion_page_id);

      if (!notionPage) {
        return {
          designId,
          groupId,
          neo4jId: neo4jData.id,
          notionPageId: syncStatus.notion_page_id,
          status: "missing",
          neo4jUpdatedAt: neo4jData.updated_at,
          notionUpdatedAt: null,
          lastSyncedAt: syncStatus.synced_at,
          driftSeconds: null,
          message: "Notion page not found",
        };
      }

      const neo4jTime = neo4jData.updated_at.getTime();
      const notionTime = notionPage.lastEditedTime.getTime();
      const syncTime = syncStatus.synced_at.getTime();
      const thresholdMs = this.config.driftThresholdSeconds * 1000;

      if (Math.abs(neo4jTime - notionTime) <= thresholdMs) {
        await this.updateSyncStatus(syncStatus, "synced", null);
        return {
          designId,
          groupId,
          neo4jId: neo4jData.id,
          notionPageId: syncStatus.notion_page_id,
          status: "synced",
          neo4jUpdatedAt: neo4jData.updated_at,
          notionUpdatedAt: notionPage.lastEditedTime,
          lastSyncedAt: syncStatus.synced_at,
          driftSeconds: null,
          message: "Systems are in sync",
        };
      }

      if (neo4jTime > notionTime) {
        await this.updateSyncStatus(syncStatus, "drift", "Neo4j is ahead of Notion");
        return {
          designId,
          groupId,
          neo4jId: neo4jData.id,
          notionPageId: syncStatus.notion_page_id,
          status: "neo4j_ahead",
          neo4jUpdatedAt: neo4jData.updated_at,
          notionUpdatedAt: notionPage.lastEditedTime,
          lastSyncedAt: syncStatus.synced_at,
          driftSeconds: Math.floor((neo4jTime - notionTime) / 1000),
          message: "Neo4j has newer updates than Notion",
        };
      }

      await this.updateSyncStatus(syncStatus, "drift", "Notion is ahead of Neo4j");
      return {
        designId,
        groupId,
        neo4jId: neo4jData.id,
        notionPageId: syncStatus.notion_page_id,
        status: "notion_ahead",
        neo4jUpdatedAt: neo4jData.updated_at,
        notionUpdatedAt: notionPage.lastEditedTime,
        lastSyncedAt: syncStatus.synced_at,
        driftSeconds: Math.floor((notionTime - neo4jTime) / 1000),
        message: "Notion has newer updates than Neo4j",
      };
    } catch (error) {
      return {
        designId,
        groupId,
        neo4jId: "",
        notionPageId: null,
        status: "missing",
        neo4jUpdatedAt: null,
        notionUpdatedAt: null,
        lastSyncedAt: null,
        driftSeconds: null,
        message: `Error checking drift: ${error instanceof Error ? error.message : "Unknown error"}`,
      };
    }
  }

  /**
   * Check drift for all synced designs in a group
   */
  public async checkAllDrift(groupId: string): Promise<BatchDriftResult> {
    const syncStatuses = await this.getSyncStatusesByGroup(groupId);

    const results: DriftCheckResult[] = [];
    let syncedCount = 0;
    let driftedCount = 0;
    let missingCount = 0;
    let errorCount = 0;

    for (const status of syncStatuses) {
      const result = await this.checkDrift(status.design_id, groupId);
      results.push(result);

      if (result.status === "synced") {
        syncedCount++;
      } else if (result.status === "neo4j_ahead" || result.status === "notion_ahead") {
        driftedCount++;
      } else if (result.status === "missing") {
        missingCount++;
      } else {
        errorCount++;
      }
    }

    await this.logDriftCheck(groupId, results);

    return {
      results,
      syncedCount,
      driftedCount,
      missingCount,
      errorCount,
    };
  }

  /**
   * Resolve drift by taking configured action
   */
  public async resolveDrift(
    designId: string,
    groupId: string,
    action?: DriftAction
  ): Promise<{ success: boolean; action: DriftAction; message: string }> {
    const driftResult = await this.checkDrift(designId, groupId);

    if (driftResult.status === "synced") {
      return {
        success: true,
        action: "skip",
        message: "No drift detected - systems are in sync",
      };
    }

    const effectiveAction = action ?? this.getEffectiveAction(driftResult.status);
    const syncStatus = await this.getSyncStatus(designId, groupId);

    switch (effectiveAction) {
      case "resync":
        return this.handleResync(designId, groupId, syncStatus);

      case "notify":
        await this.logDriftNotification(designId, groupId, driftResult);
        return {
          success: true,
          action: "notify",
          message: "Drift notification logged",
        };

      case "mark_drift":
        if (syncStatus) {
          await this.updateSyncStatus(syncStatus, "drift", driftResult.message);
        }
        return {
          success: true,
          action: "mark_drift",
          message: "Design marked as drifted",
        };

      case "skip":
      default:
        return {
          success: true,
          action: "skip",
          message: "Drift resolution skipped",
        };
    }
  }

  /**
   * Get effective action for drift status
   */
  private getEffectiveAction(status: SyncDriftStatus): DriftAction {
    switch (status) {
      case "neo4j_ahead":
        return this.config.neo4jAheadAction;
      case "notion_ahead":
        return this.config.notionAheadAction;
      case "missing":
        return this.config.missingAction;
      default:
        return "notify";
    }
  }

  /**
   * Handle resync action
   */
  private async handleResync(
    designId: string,
    groupId: string,
    syncStatus: SyncStatusRecord | null
  ): Promise<{ success: boolean; action: DriftAction; message: string }> {
    try {
      const { createDesignSyncManager } = await import("./design-sync");
      const manager = createDesignSyncManager(this.config.databaseId);

      const result = await manager.syncDesign(designId, groupId);

      if (result.synced) {
        return {
          success: true,
          action: "resync",
          message: "Design resynced successfully",
        };
      }

      return {
        success: false,
        action: "resync",
        message: result.error ?? "Resync failed",
      };
    } catch (error) {
      return {
        success: false,
        action: "resync",
        message: `Resync failed: ${error instanceof Error ? error.message : "Unknown error"}`,
      };
    }
  }

  /**
   * Get design from Neo4j
   */
  private async getNeo4jDesign(
    designId: string,
    groupId: string
  ): Promise<{
    id: string;
    design_id: string;
    version: number;
    updated_at: Date;
  } | null> {
    const query = `
      MATCH (d:AgentDesign {design_id: $design_id, group_id: $group_id})
      RETURN d.id as id, d.design_id as design_id, d.version as version, d.updated_at as updated_at
    `;

    const result = await readTransaction(async (tx: ManagedTransaction) => {
      return tx.run(query, { design_id: designId, group_id: groupId });
    });

    if (result.records.length === 0) {
      return null;
    }

    const record = result.records[0];
    const updatedAt = record.get("updated_at");

    return {
      id: record.get("id") as string,
      design_id: record.get("design_id") as string,
      version: (record.get("version") as { toNumber?: () => number }).toNumber?.() ?? record.get("version") as number,
      updated_at: updatedAt ? new Date(updatedAt.toString()) : new Date(),
    };
  }

  /**
   * Get sync status from PostgreSQL
   */
  private async getSyncStatus(
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
   * Get all sync statuses for a group
   */
  private async getSyncStatusesByGroup(groupId: string): Promise<SyncStatusRecord[]> {
    const pool = getPool();

    const query = `
      SELECT 
        id, design_id, group_id, notion_page_id, notion_page_url,
        neo4j_id, version, synced_at, neo4j_updated_at, status, error_message
      FROM design_sync_status
      WHERE group_id = $1
      ORDER BY synced_at DESC
    `;

    const result = await pool.query(query, [groupId]);

    return result.rows.map((row) => ({
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
    }));
  }

  /**
   * Get Notion page info
   */
  private async getNotionPage(pageId: string): Promise<NotionPageInfo | null> {
    try {
      const client = getNotionClient();
      const page = await client.getPage(pageId);

      return {
        id: page.id,
        lastEditedTime: page.lastEditedTime,
        properties: page.properties as NotionPageInfo["properties"],
      };
    } catch {
      return null;
    }
  }

  /**
   * Update sync status in PostgreSQL
   */
  private async updateSyncStatus(
    status: SyncStatusRecord,
    newStatus: "synced" | "drift" | "error",
    errorMessage: string | null
  ): Promise<void> {
    const pool = getPool();

    await pool.query(
      `
      UPDATE design_sync_status
      SET status = $1, error_message = $2, synced_at = NOW()
      WHERE id = $3
    `,
      [newStatus, errorMessage, status.id]
    );
  }

  /**
   * Log drift check event
   */
  private async logDriftCheck(
    groupId: string,
    results: DriftCheckResult[]
  ): Promise<void> {
    const synced = results.filter((r) => r.status === "synced").length;
    const drifted = results.filter(
      (r) => r.status === "neo4j_ahead" || r.status === "notion_ahead"
    ).length;
    const missing = results.filter((r) => r.status === "missing").length;

    await insertEvent({
      group_id: groupId,
      event_type: "notion_drift_check",
      agent_id: "sync-monitor",
      workflow_id: `drift-check-${Date.now()}`,
      metadata: {
        total: results.length,
        synced,
        drifted,
        missing,
        results: results.map((r) => ({
          designId: r.designId,
          status: r.status,
          driftSeconds: r.driftSeconds,
        })),
      },
      status: "completed",
    });
  }

  /**
   * Log drift notification
   */
  private async logDriftNotification(
    designId: string,
    groupId: string,
    driftResult: DriftCheckResult
  ): Promise<void> {
    await insertEvent({
      group_id: groupId,
      event_type: "notion_drift_notification",
      agent_id: "sync-monitor",
      workflow_id: `drift-notify-${designId}`,
      metadata: {
        designId,
        status: driftResult.status,
        neo4jUpdatedAt: driftResult.neo4jUpdatedAt?.toISOString(),
        notionUpdatedAt: driftResult.notionUpdatedAt?.toISOString(),
        driftSeconds: driftResult.driftSeconds,
        message: driftResult.message,
      },
      status: "completed",
    });
  }
}

/**
 * Create a sync monitor
 */
export function createSyncMonitor(
  databaseId: string,
  options?: Partial<Omit<DriftConfig, "databaseId">>
): SyncMonitor {
  return new SyncMonitor({
    databaseId,
    ...options,
  });
}

/**
 * Convenience function to check drift
 */
export async function checkDrift(
  designId: string,
  groupId: string,
  databaseId: string
): Promise<DriftCheckResult> {
  const monitor = new SyncMonitor({ databaseId });
  return monitor.checkDrift(designId, groupId);
}

/**
 * Convenience function to check all drift
 */
export async function checkAllDrift(
  groupId: string,
  databaseId: string
): Promise<BatchDriftResult> {
  const monitor = new SyncMonitor({ databaseId });
  return monitor.checkAllDrift(groupId);
}

/**
 * Convenience function to resolve drift
 */
export async function resolveDrift(
  designId: string,
  groupId: string,
  databaseId: string,
  action?: DriftAction
): Promise<{ success: boolean; action: DriftAction; message: string }> {
  const monitor = new SyncMonitor({ databaseId });
  return monitor.resolveDrift(designId, groupId, action);
}