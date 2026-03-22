/**
 * Neo4j Client
 * 
 * Integration layer for Neo4j insight queries.
 */

import { Neo4jInsight } from "../curator/types";
import neo4j from "neo4j-driver";

let driver: neo4j.Driver | null = null;

function getDriver(): neo4j.Driver {
  if (!driver) {
    const uri = process.env.NEO4J_URI || "bolt://localhost:7687";
    const user = process.env.NEO4J_USER || "neo4j";
    const password = process.env.NEO4J_PASSWORD || "password";

    driver = neo4j.driver(uri, neo4j.auth.basic(user, password));
  }
  return driver;
}

const INSIGHT_MATCH_CLAUSE = "MATCH (i:Insight) WHERE i.id = $insightId OR i.insight_id = $insightId";

export interface Neo4jClient {
  getPromotableInsights(limit?: number): Promise<Neo4jInsight[]>;
  markInsightPromoted(insightId: string, notionPageId: string): Promise<void>;
  markInsightApproved(insightId: string, approvedBy: string): Promise<void>;
  markInsightRejected(insightId: string, reason: string): Promise<void>;
  markInsightSuperseded(insightId: string, replacementInsightId: string, reason: string): Promise<void>;
  markInsightRevoked(insightId: string, reason: string): Promise<void>;
}

export class Neo4jClientImpl implements Neo4jClient {
  async getPromotableInsights(limit = 50): Promise<Neo4jInsight[]> {
    const session = getDriver().session();

    try {
      const result = await session.run(
        `
        MATCH (i:Insight)
        WHERE i.status = 'Proposed'
          AND i.confidence >= 0.7
          AND (i.promoted_to_notion IS NULL OR i.promoted_to_notion = false)
          AND i.summary IS NOT NULL
          AND size(i.summary) >= 40
          AND i.canonical_tag IS NOT NULL
        RETURN i
        ORDER BY i.confidence DESC
        LIMIT $limit
        `,
        { limit: neo4j.int(limit) }
      );

      return result.records.map((r) => {
        const props = r.get('i').properties;
        return {
          id: props.id || props.insight_id,
          title: props.title || props.summary?.substring(0, 100) || '',
          summary: props.summary,
          confidence: props.confidence,
          canonicalTag: props.canonical_tag,
          displayTag: props.display_tag,
          sourceProject: props.source_project || props.canonical_tag,
          status: props.status,
          promotedToNotion: props.promoted_to_notion,
          notionPageId: props.notion_page_id,
          promotedAt: props.promoted_at,
          createdAt: props.created_at,
          updatedAt: props.updated_at,
        };
      });
    } finally {
      await session.close();
    }
  }

  async markInsightPromoted(insightId: string, notionPageId: string): Promise<void> {
    const session = getDriver().session();

    try {
      await session.run(
        `
        ${INSIGHT_MATCH_CLAUSE}
        SET i.promoted_to_notion = true,
            i.notion_page_id = $notionPageId,
            i.promotion_status = 'pending_review',
            i.promoted_at = datetime()
        `,
        { insightId, notionPageId }
      );
    } finally {
      await session.close();
    }
  }

  async markInsightApproved(insightId: string, approvedBy: string): Promise<void> {
    const session = getDriver().session();

    try {
      await session.run(
        `
        ${INSIGHT_MATCH_CLAUSE}
        SET i.status = 'Approved',
            i.approved_by = $approvedBy,
            i.approved_at = datetime(),
            i.ai_accessible = true,
            i.usable_for_agents = true
        `,
        { insightId, approvedBy }
      );
    } finally {
      await session.close();
    }
  }

  async markInsightRejected(insightId: string, reason: string): Promise<void> {
    const session = getDriver().session();

    try {
      await session.run(
        `
        ${INSIGHT_MATCH_CLAUSE}
        SET i.status = 'Rejected',
            i.rejection_reason = $reason,
            i.rejected_at = datetime(),
            i.ai_accessible = false,
            i.usable_for_agents = false
        `,
        { insightId, reason }
      );
    } finally {
      await session.close();
    }
  }

  async markInsightSuperseded(
    insightId: string,
    replacementInsightId: string,
    reason: string,
  ): Promise<void> {
    const session = getDriver().session();

    try {
      await session.run(
        `
        MATCH (old:Insight), (replacement:Insight)
        WHERE (old.id = $insightId OR old.insight_id = $insightId)
          AND (replacement.id = $replacementInsightId OR replacement.insight_id = $replacementInsightId)
        SET old.status = 'Superseded',
            old.superseded_by = $replacementInsightId,
            old.superseded_at = datetime(),
            old.supersede_reason = $reason,
            old.ai_accessible = false,
            old.usable_for_agents = false,
            replacement.status = CASE WHEN replacement.status = 'Proposed' THEN 'Approved' ELSE replacement.status END,
            replacement.updated_at = datetime()
        MERGE (replacement)-[r:SUPERSEDES]->(old)
        SET r.reason = $reason,
            r.created_at = datetime()
        `,
        { insightId, replacementInsightId, reason }
      );
    } finally {
      await session.close();
    }
  }

  async markInsightRevoked(insightId: string, reason: string): Promise<void> {
    const session = getDriver().session();

    try {
      await session.run(
        `
        ${INSIGHT_MATCH_CLAUSE}
        SET i.status = 'Revoked',
            i.revoked_reason = $reason,
            i.revoked_at = datetime(),
            i.ai_accessible = false,
            i.usable_for_agents = false
        `,
        { insightId, reason }
      );
    } finally {
      await session.close();
    }
  }
}
