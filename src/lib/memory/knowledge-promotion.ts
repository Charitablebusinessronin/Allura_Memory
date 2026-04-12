/**
 * Knowledge Promotion Infrastructure
 * 
 * Wires Notion Approval Queue → Neo4j Knowledge Graph
 * Implements HITL (Human-in-the-Loop) governance for knowledge promotion.
 * 
 * Flow:
 *   Agent → PostgreSQL (trace) → Notion (Approval Queue)
 *   Human → Notion (Approve) → Neo4j (Knowledge) → Notion (Knowledge Hub)
 * 
 * Steel Frame Versioning: All Neo4j insights use SUPERSEDES relationships
 * Tenant Isolation: All nodes carry group_id = 'allura-default'
 */

import type { Pool } from 'pg';
import { getPool } from '../postgres/connection';
import { createInsight, createInsightVersion, type InsightRecord } from '../neo4j/queries/insert-insight';
import { Neo4jPromotionError } from '../errors/neo4j-errors';
import { insertEvent, type EventRecord } from '../postgres/queries/insert-trace';

// ============================================================================
// Types
// ============================================================================

/**
 * Knowledge insight from Neo4j
 */
export interface KnowledgeInsight {
  /** Stable identifier across versions */
  id: string;
  /** Topic or title of the insight */
  topic: string;
  /** Category for organization */
  category: 'Architecture' | 'Pattern' | 'Decision' | 'Research' | 'Bugfix' | 'Performance';
  /** The insight content (knowledge text) */
  content: string;
  /** Source agent or human */
  source: string;
  /** Confidence score (0.0 to 1.0) */
  confidence: number;
  /** Tenant isolation identifier */
  group_id: string;
  /** Notion page ID in Approval Queue */
  notion_page_id: string;
  /** PostgreSQL trace event ID */
  postgres_trace_id: string;
  /** Optional: Neo4j node ID after promotion */
  neo4j_id?: string;
  /** Optional: Version number */
  version?: number;
  /** Optional: Previous version to supersede */
  supersedes_id?: string;
}

/**
 * Approval queue item from Notion
 * 
 * Status states:
 *   - Pending: Awaiting human review
 *   - Approved: Human approved, ready for Neo4j promotion
 *   - Rejected: Human rejected, not promoted
 */
export interface ApprovalQueueItem {
  /** Notion page ID */
  notion_page_id: string;
  /** Topic or title */
  topic: string;
  /** Content/summary */
  content: string;
  /** Source agent or human */
  source: string;
  /** Current status */
  status: 'Pending' | 'Approved' | 'Rejected';
  /** Confidence score */
  confidence: number;
  /** Tenant group */
  group_id: string;
  /** PostgreSQL trace ID */
  postgres_trace_id: string;
  /** Category */
  category: KnowledgeInsight['category'];
  /** Optional: Previous version to supersede */
  supersedes_id?: string;
  /** Optional: Approver */
  approved_by?: string;
  /** Optional: Approval timestamp */
  approved_at?: string;
}

/**
 * Promotion result
 */
export interface PromotionResult {
  success: boolean;
  neo4j_id?: string;
  notion_page_id?: string;
  error?: string;
}

// ============================================================================
// Notion MCP Helpers
// ============================================================================

/**
 * Query Notion Approval Queue for items with Status = 'Approved'
 * 
 * Uses MCP_DOCKER_notion-query-database-view or notion-search
 * to find approved insights ready for promotion.
 * 
 * @param groupId - Tenant identifier (defaults to 'allura-default')
 * @returns Array of approved items
 */
export async function queryApprovedInsights(
  groupId: string = 'allura-default'
): Promise<ApprovalQueueItem[]> {
  // TODO: Use MCP_DOCKER_notion tools to query Approval Queue
  // For now, return empty array - implementation requires MCP context
  
  console.log('[knowledge-promotion] Querying approved insights for group:', groupId);
  
  // This would be implemented as:
  // 1. Use MCP_DOCKER_notion-query-database-view with Status = 'Approved'
  // 2. Filter by group_id property
  // 3. Map Notion records to ApprovalQueueItem[]
  
  return [];
}

/**
 * Query Notion Knowledge Hub by source insight ID
 * 
 * @param sourceInsightId - Neo4j source insight ID
 * @returns Matching Knowledge Hub item or null
 */
export async function queryKnowledgeHubBySourceId(
  sourceInsightId: string
): Promise<{ notion_page_id: string; neo4j_id: string } | null> {
  // TODO: Use MCP_DOCKER_notion tools to query Knowledge Hub
  // For now, return null - implementation requires MCP context
  
  console.log('[knowledge-promotion] Querying Knowledge Hub for source:', sourceInsightId);
  
  return null;
}

// ============================================================================
// Neo4j Promotion Functions
// ============================================================================

/**
 * Promote an insight to Neo4j knowledge graph
 * 
 * Creates Insight node with Steel Frame versioning:
 *   - If new: Creates version 1 with InsightHead
 *   - If update: Creates new version with SUPERSEDES relationship
 * 
 * @param insight - Knowledge insight to promote
 * @returns Neo4j node ID
 */
export async function promoteToNeo4j(insight: KnowledgeInsight): Promise<string> {
  console.log('[knowledge-promotion] Promoting insight to Neo4j:', {
    id: insight.id,
    topic: insight.topic,
    group_id: insight.group_id,
  });

  // Build Neo4j insight payload
  const insightPayload = {
    insight_id: insight.id,
    group_id: insight.group_id,
    content: insight.content,
    confidence: insight.confidence,
    source_type: 'promotion' as const,
    source_ref: insight.postgres_trace_id,
    created_by: insight.source,
    metadata: {
      topic: insight.topic,
      category: insight.category,
      notion_page_id: insight.notion_page_id,
    },
  };

  let record: InsightRecord;

  try {
    if (insight.supersedes_id) {
      // Create new version (supersedes existing)
      console.log('[knowledge-promotion] Creating new version superseding:', insight.supersedes_id);
      record = await createInsightVersion(
        insight.id,
        insight.content,
        insight.confidence,
        insight.group_id,
        insightPayload.metadata
      );
    } else {
      // Create new insight (version 1)
      console.log('[knowledge-promotion] Creating new insight:', insight.id);
      record = await createInsight(insightPayload);
    }
  } catch (err) {
    if (err instanceof Neo4jPromotionError) throw err;
    throw new Neo4jPromotionError(insight.id, err instanceof Error ? err : new Error(String(err)));
  }

  console.log('[knowledge-promotion] Neo4j promotion complete:', {
    neo4j_id: record.id,
    version: record.version,
    status: record.status,
  });

  return record.id;
}

/**
 * Create CONTRIBUTED relationship between Agent and Insight
 * 
 * Links the agent who proposed this insight to the knowledge node.
 * 
 * @param agentId - Agent ID
 * @param insightId - Neo4j insight ID
 * @param confidence - Confidence score
 * @param groupId - Tenant identifier
 */
export async function linkInsightToAgent(
  agentId: string,
  insightId: string,
  confidence: number,
  groupId: string
): Promise<void> {
  console.log('[knowledge-promotion] Linking insight to agent:', {
    agent_id: agentId,
    insight_id: insightId,
    confidence,
    group_id: groupId,
  });

  // This would use Neo4j writeTransaction to create:
  // MATCH (a:Agent {id: $agentId, group_id: $groupId})
  // MATCH (i:Insight {id: $insightId})
  // CREATE (a)-[:CONTRIBUTED {confidence: $confidence, timestamp: datetime()}]->(i)
  
  // For now, this is a placeholder - implementation requires Neo4j connection context
}

// ============================================================================
// Notion Knowledge Hub Updates
// ============================================================================

/**
 * Update Notion Knowledge Hub page with Neo4j ID
 * 
 * After promoting to Neo4j, sync the Neo4j ID back to Notion
 * so the knowledge hub can link to the graph.
 * 
 * @param notionPageId - Knowledge Hub page ID
 * @param neo4jId - Neo4j node ID
 * @param approvedBy - User who approved
 */
export async function updateNotionWithNeo4jId(
  notionPageId: string,
  neo4jId: string,
  approvedBy: string
): Promise<void> {
  console.log('[knowledge-promotion] Updating Notion Knowledge Hub:', {
    notion_page_id: notionPageId,
    neo4j_id: neo4jId,
    approved_by: approvedBy,
  });

  // This would use MCP_DOCKER_notion-update-page to:
  // 1. Update "Source Insight ID" property with neo4jId
  // 2. Set "Status" to "Published"
  // 3. Set "Published At" to current timestamp
  // 4. Set "Published By" to approvedBy
  
  // For now, this is a placeholder - implementation requires MCP context
}

/**
 * Update Notion Approval Queue item status
 * 
 * After successful promotion, mark the Approval Queue item as complete.
 * 
 * @param notionPageId - Approval Queue page ID
 * @param neo4jId - Neo4j node ID
 * @param approvedBy - User who approved
 */
export async function updateApprovalQueueItem(
  notionPageId: string,
  neo4jId: string,
  approvedBy: string
): Promise<void> {
  console.log('[knowledge-promotion] Updating Approval Queue item:', {
    notion_page_id: notionPageId,
    neo4j_id: neo4jId,
    approved_by: approvedBy,
  });

  // This would use MCP_DOCKER_notion-update-page to:
  // 1. Set "Review Status" to "Completed"
  // 2. Set "Neo4j ID" property with neo4jId
  
  // For now, this is a placeholder - implementation requires MCP context
}

// ============================================================================
// PostgreSQL Audit Logging
// ============================================================================

/**
 * Log promotion event to PostgreSQL
 * 
 * Creates immutable audit trail for knowledge promotion.
 * 
 * @param groupId - Tenant identifier
 * @param agentId - Agent or system performing promotion
 * @param insightId - Insight ID
 * @param neo4jId - Neo4j node ID
 * @param notionPageId - Notion page ID
 * @param status - Promotion status
 */
export async function logPromotionEvent(
  groupId: string,
  agentId: string,
  insightId: string,
  neo4jId: string,
  notionPageId: string,
  status: 'approved' | 'promoted' | 'rejected' | 'failed'
): Promise<EventRecord> {
  console.log('[knowledge-promotion] Logging promotion event:', {
    group_id: groupId,
    agent_id: agentId,
    insight_id: insightId,
    status,
  });

  const event = await insertEvent({
    group_id: groupId,
    event_type: 'knowledge_promotion',
    agent_id: agentId,
    metadata: {
      insight_id: insightId,
      neo4j_id: neo4jId,
      notion_page_id: notionPageId,
    },
    outcome: {
      status,
      promoted_at: new Date().toISOString(),
    },
    status: status === 'failed' ? 'failed' : 'completed',
  });

  return event;
}

// ============================================================================
// Main Promotion Workflow
// ============================================================================

/**
 * Process all approved insights from Notion Approval Queue
 * 
 * Batch processes approved items:
 *   1. Query Notion Approval Queue for Status = 'Approved'
 *   2. For each approved insight:
 *      a. Promote to Neo4j
 *      b. Update Notion Knowledge Hub with Neo4j ID
 *      c. Update Approval Queue item status
 *      d. Create CONTRIBUTED relationship to agent
 *      e. Log promotion event to PostgreSQL
 * 
 * @param groupId - Tenant identifier (default: 'allura-default')
 * @param batchSize - Max items to process in one batch (default: 10)
 * @returns Array of promotion results
 */
export async function processApprovedInsights(
  groupId: string = 'allura-default',
  batchSize: number = 10
): Promise<PromotionResult[]> {
  console.log('[knowledge-promotion] Processing approved insights for group:', groupId);

  // Step 1: Query approved items from Notion
  const approvedItems = await queryApprovedInsights(groupId);
  
  if (approvedItems.length === 0) {
    console.log('[knowledge-promotion] No approved items found');
    return [];
  }

  // Limit batch size
  const itemsToProcess = approvedItems.slice(0, batchSize);
  console.log('[knowledge-promotion] Processing', itemsToProcess.length, 'items');

  const results: PromotionResult[] = [];

  for (const item of itemsToProcess) {
    try {
      console.log('[knowledge-promotion] Processing item:', item.notion_page_id);

      // Step 2: Promote to Neo4j
      const neo4jId = await promoteToNeo4j({
        id: item.postgres_trace_id, // Use trace ID as stable insight ID
        topic: item.topic,
        category: item.category,
        content: item.content,
        source: item.source,
        confidence: item.confidence,
        group_id: item.group_id,
        notion_page_id: item.notion_page_id,
        postgres_trace_id: item.postgres_trace_id,
        supersedes_id: item.supersedes_id,
      });

      // Step 3: Update Notion Knowledge Hub
      await updateNotionWithNeo4jId(item.notion_page_id, neo4jId, item.approved_by || 'system');

      // Step 4: Update Approval Queue item
      await updateApprovalQueueItem(item.notion_page_id, neo4jId, item.approved_by || 'system');

      // Step 5: Create CONTRIBUTED relationship
      await linkInsightToAgent(item.source, neo4jId, item.confidence, item.group_id);

      // Step 6: Log promotion event
      await logPromotionEvent(
        item.group_id,
        item.source,
        item.postgres_trace_id,
        neo4jId,
        item.notion_page_id,
        'promoted'
      );

      results.push({
        success: true,
        neo4j_id: neo4jId,
        notion_page_id: item.notion_page_id,
      });

      console.log('[knowledge-promotion] Successfully promoted:', {
        notion_page_id: item.notion_page_id,
        neo4j_id: neo4jId,
      });

    } catch (error) {
      console.error('[knowledge-promotion] Failed to promote item:', {
        notion_page_id: item.notion_page_id,
        error: error instanceof Error ? error.message : String(error),
      });

      // Log failure event
      await logPromotionEvent(
        item.group_id,
        item.source,
        item.postgres_trace_id,
        '',
        item.notion_page_id,
        'failed'
      );

      results.push({
        success: false,
        notion_page_id: item.notion_page_id,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  console.log('[knowledge-promotion] Batch processing complete:', {
    total: itemsToProcess.length,
    succeeded: results.filter(r => r.success).length,
    failed: results.filter(r => !r.success).length,
  });

  return results;
}

// ============================================================================
// Single Item Promotion
// ============================================================================

/**
 * Promote a single insight by ID
 * 
 * Used for on-demand promotion after HITL approval.
 * 
 * @param notionPageId - Notion Approval Queue page ID
 * @param approvedBy - User who approved
 * @returns Promotion result
 */
export async function promoteSingleInsight(
  notionPageId: string,
  approvedBy: string
): Promise<PromotionResult> {
  console.log('[knowledge-promotion] Promoting single insight:', notionPageId);

  // TODO: Query Notion for the specific page ID
  // This requires MCP_DOCKER_notion-fetch context
  
  // For now, return a placeholder result
  return {
    success: false,
    notion_page_id: notionPageId,
    error: 'Notion MCP context required for single item promotion',
  };
}

// ============================================================================
// Validation Helpers
// ============================================================================

/**
 * Validate that an insight is ready for promotion
 * 
 * Checks all required fields and constraints.
 * 
 * @param insight - Insight to validate
 * @returns True if valid, throws error if invalid
 */
export function validateInsightForPromotion(insight: KnowledgeInsight): boolean {
  if (!insight.id || insight.id.trim().length === 0) {
    throw new Error('Insight ID is required for promotion');
  }

  if (!insight.group_id || insight.group_id.trim().length === 0) {
    throw new Error('group_id is required for promotion');
  }

  if (!insight.content || insight.content.trim().length === 0) {
    throw new Error('Content is required for promotion');
  }

  if (insight.confidence < 0 || insight.confidence > 1) {
    throw new Error('Confidence must be between 0 and 1');
  }

  if (!insight.notion_page_id || insight.notion_page_id.trim().length === 0) {
    throw new Error('Notion page ID is required for promotion');
  }

  if (!insight.postgres_trace_id || insight.postgres_trace_id.trim().length === 0) {
    throw new Error('PostgreSQL trace ID is required for promotion');
  }

  return true;
}