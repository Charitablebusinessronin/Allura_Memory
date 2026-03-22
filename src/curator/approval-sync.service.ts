/**
 * Approval Sync Service
 * 
 * Handles the sync-back from human review in Notion to Neo4j.
 */

import 'dotenv/config';
import { Neo4jClient, NotionClient } from "./curator.service";
import { createPromotionOrchestrator } from "./promotion-orchestrator";
import {
  canBeApproved,
  canBeRejected,
  canBeSuperseded,
  canBeRevoked,
  getValidTransitions,
  type InsightStatus,
} from "./lifecycle-validator";

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`${name} environment variable is required`);
  }
  return value;
}

export class ApprovalSyncService {
  constructor(
    private readonly notionClient: NotionClient,
    private readonly neo4jClient: Neo4jClient
  ) {}

  async approveInsight(sourceInsightId: string, approvedBy: string, notes?: string): Promise<void> {
    console.log(`[ApprovalSync] Approving insight ${sourceInsightId} by ${approvedBy}`);

    const neo4jDriver = require('neo4j-driver');
    const neo4jUri = process.env.NEO4J_URI || 'bolt://localhost:7687';
    const neo4jUser = process.env.NEO4J_USER || 'neo4j';
    const neo4jPassword = requireEnv("NEO4J_PASSWORD");
    const driver = neo4jDriver.driver(
      neo4jUri,
      neo4jDriver.auth.basic(
        neo4jUser,
        neo4jPassword,
      )
    );

    try {
      const session = driver.session();
      let notionPageId: string | null = null;
      let currentPageStatus: InsightStatus | null = null;

      try {
        const result = await session.run(
          `MATCH (i:Insight)
           WHERE i.id = $insightId OR i.insight_id = $insightId
           RETURN i.notion_page_id as pageId, i.status as status`,
          { insightId: sourceInsightId }
        );

        if (result.records.length > 0) {
          notionPageId = result.records[0].get('pageId');
          currentPageStatus = result.records[0].get('status');
        }
      } finally {
        await session.close();
      }

      if (!notionPageId) {
        const page = await this.notionClient.getPageBySourceInsightId(sourceInsightId);
        if (!page) {
          throw new Error(`No Notion page found for source insight ${sourceInsightId}`);
        }
        notionPageId = page.pageId;
        currentPageStatus = page.status;
      }

      if (currentPageStatus && !canBeApproved(currentPageStatus)) {
        const validTargets = getValidTransitions(currentPageStatus);
        throw new Error(
          `Cannot approve insight ${sourceInsightId}: current status is '${currentPageStatus}'. ` +
          `Only 'Pending Review' insights can be approved. ` +
          `Valid transitions from '${currentPageStatus}': ${validTargets.join(", ") || "none (terminal state)"}`
        );
      }

      const supportedProperties = await this.notionClient.getInsightsDatabasePropertyNames();
      const orchestrator = createPromotionOrchestrator();
      await this.notionClient.updatePage(
        orchestrator.buildApprovalUpdatePayload(notionPageId, approvedBy, supportedProperties)
      );

      await this.neo4jClient.markInsightApproved(sourceInsightId, approvedBy);

      console.log(`[ApprovalSync] Insight ${sourceInsightId} approved successfully`);
    } catch (error) {
      const page = await this.notionClient.getPageBySourceInsightId(sourceInsightId);
      if (page) {
        await this.notionClient.updatePage({
          page_id: page.pageId,
          properties: {
            Status: {
              select: { name: "Pending Review" }
            },
            "Review Status": {
              select: { name: "In Progress" }
            },
            "AI Accessible": {
              checkbox: false
            },
            Rationale: {
              rich_text: [{ text: { content: "Approval sync rollback: Neo4j update failed" } }]
            }
          }
        });
      }
      throw error;
    } finally {
      await driver.close();
    }
  }

  async rejectInsight(sourceInsightId: string, reason: string): Promise<void> {
    console.log(`[ApprovalSync] Rejecting insight ${sourceInsightId}: ${reason}`);

    const page = await this.notionClient.getPageBySourceInsightId(sourceInsightId);

    if (!page) {
      throw new Error(`No Notion page found for source insight ${sourceInsightId}`);
    }

    if (!canBeRejected(page.status)) {
      const validTargets = getValidTransitions(page.status);
      throw new Error(
        `Cannot reject insight ${sourceInsightId}: current status is '${page.status}'. ` +
        `Only 'Pending Review' insights can be rejected. ` +
        `Valid transitions from '${page.status}': ${validTargets.join(", ") || "none (terminal state)"}`
      );
    }

    const supportedProperties = await this.notionClient.getInsightsDatabasePropertyNames();
    const orchestrator = createPromotionOrchestrator();
    await this.notionClient.updatePage(
      orchestrator.buildRejectionUpdatePayload(page.pageId, reason, supportedProperties)
    );

    await this.neo4jClient.markInsightRejected(sourceInsightId, reason);

    console.log(`[ApprovalSync] Insight ${sourceInsightId} rejected successfully`);
  }

  async supersedeInsight(
    sourceInsightId: string,
    replacementInsightId: string,
    reason: string
  ): Promise<void> {
    console.log(`[ApprovalSync] Superseding insight ${sourceInsightId} with ${replacementInsightId}`);

    const page = await this.notionClient.getPageBySourceInsightId(sourceInsightId);

    if (!page) {
      throw new Error(`No Notion page found for source insight ${sourceInsightId}`);
    }

    if (!canBeSuperseded(page.status)) {
      const validTargets = getValidTransitions(page.status);
      throw new Error(
        `Cannot supersede insight ${sourceInsightId}: current status is '${page.status}'. ` +
        `Only 'Pending Review' or 'Approved' insights can be superseded. ` +
        `Valid transitions from '${page.status}': ${validTargets.join(", ") || "none (terminal state)"}`
      );
    }

    const replacementPage = await this.notionClient.getPageBySourceInsightId(replacementInsightId);
    const supportedProperties = await this.notionClient.getInsightsDatabasePropertyNames();
    const orchestrator = createPromotionOrchestrator();
    await this.notionClient.updatePage(
      orchestrator.buildSupersedeUpdatePayload(
        page.pageId,
        replacementPage?.pageId || replacementInsightId,
        reason,
        supportedProperties,
      )
    );

    await this.neo4jClient.markInsightSuperseded(sourceInsightId, replacementInsightId, reason);

    console.log(`[ApprovalSync] Insight ${sourceInsightId} superseded successfully`);
  }


  async revokeInsight(sourceInsightId: string, reason: string, revokedBy = "system"): Promise<void> {
    console.log(`[ApprovalSync] Revoking insight ${sourceInsightId}: ${reason}`);

    const page = await this.notionClient.getPageBySourceInsightId(sourceInsightId);

    if (!page) {
      throw new Error(`No Notion page found for source insight ${sourceInsightId}`);
    }

    if (!canBeRevoked(page.status)) {
      const validTargets = getValidTransitions(page.status);
      throw new Error(
        `Cannot revoke insight ${sourceInsightId}: current status is '${page.status}'. ` +
        `Only 'Approved' insights can be revoked. ` +
        `Valid transitions from '${page.status}': ${validTargets.join(", ") || "none (terminal state)"}`
      );
    }

    if (page.aiAccessible !== true) {
      throw new Error(
        `Cannot revoke insight ${sourceInsightId}: ai_accessible is ${page.aiAccessible}. ` +
        `Insight must be AI accessible before revoke.`
      );
    }

    const supportedProperties = await this.notionClient.getInsightsDatabasePropertyNames();
    const orchestrator = createPromotionOrchestrator();
    try {
      await this.notionClient.updatePage(
        orchestrator.buildRevokeUpdatePayload(page.pageId, reason, revokedBy, supportedProperties)
      );

      await this.neo4jClient.markInsightRevoked(sourceInsightId, reason);

      console.log(`[ApprovalSync] Insight ${sourceInsightId} revoked successfully`);
    } catch (error) {
      await this.notionClient.updatePage(
        orchestrator.buildApprovalUpdatePayload(
          page.pageId,
          page.approvedBy || revokedBy,
          supportedProperties,
        )
      );
      throw error;
    }
  }

  async cleanupApprovedDuplicateInsights(): Promise<{
    groupsFound: number;
    archivedCount: number;
    canonicalPageIds: string[];
    archivedPageIds: string[];
    ambiguousRecords: string[];
    failedPageIds: string[];
  }> {
    if (!this.notionClient.cleanupApprovedDuplicates) {
      throw new Error("Notion client does not support duplicate cleanup");
    }

    console.log("[ApprovalSync] Starting approved duplicate cleanup");
    const result = await this.notionClient.cleanupApprovedDuplicates();
    console.log(
      `[ApprovalSync] Duplicate cleanup complete: ${result.groupsFound} groups, ${result.archivedCount} archived`,
    );

    return result;
  }
}