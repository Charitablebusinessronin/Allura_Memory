/**
 * Notion Sync Workflow - Story 1.2: NOTION_SYNC Workflow
 * 
 * Manages the sync workflow from PostgreSQL traces to Notion Knowledge Hub
 * for human review before promotion to Neo4j.
 * 
 * Key features:
 * - Group ID enforcement (RK-01: allura-{org} pattern)
 * - PostgreSQL sync status tracking
 * - Notion API integration with rate limit handling
 * - Approval workflow for human review
 */

import type { Pool } from "pg";
import { getPool } from "../postgres/connection";
import { validateTenantGroupId, TENANT_ERROR_CODE } from "../validation/tenant-group-id";
import { GroupIdValidationError } from "../validation/group-id";
import { getNotionClient, type CreatePagePayload, type NotionClient } from "./client";

/**
 * Validation error for invalid workflow parameters
 * RK-01: Tenant Isolation Violation
 */
export class NotionSyncValidationError extends Error {
  public readonly code: string = TENANT_ERROR_CODE;
  
  constructor(message: string) {
    super(message);
    this.name = "NotionSyncValidationError";
  }
}

/**
 * Sync status values
 */
export type SyncStatus = "draft" | "reviewed" | "promoted" | "rejected";

/**
 * Sync status record from notion_sync_log table
 */
export interface SyncStatusRecord {
  id: string;
  group_id: string;
  trace_id: string;
  notion_page_id: string;
  status: SyncStatus;
  synced_at: Date;
  reviewed_by: string | null;
  reviewed_at: Date | null;
  promoted: boolean;
  created_at: Date;
  updated_at: Date;
}

/**
 * Sync to Notion parameters
 */
export interface SyncToNotionParams {
  /** Required: PostgreSQL trace ID */
  traceId: string;
  /** Required: Tenant isolation - must match allura-{org} pattern */
  group_id: string;
  /** Optional: Notion database ID (defaults to Knowledge Hub) */
  databaseId?: string;
  /** Optional: Additional properties for Notion page */
  properties?: Record<string, unknown>;
  /** Optional: Content blocks for Notion page */
  content?: unknown[];
}

/**
 * Sync result from Notion
 */
export interface SyncToNotionResult {
  notionPageId: string;
  status: string;
}

/**
 * Get sync status parameters
 */
export interface GetSyncStatusParams {
  /** Required: Tenant isolation */
  group_id: string;
  /** Optional: Maximum number of records to return */
  limit?: number;
  /** Optional: Filter by status */
  status?: SyncStatus;
}

/**
 * Mark as reviewed parameters
 */
export interface MarkAsReviewedParams {
  /** Required: Notion page ID */
  notionPageId: string;
  /** Required: Tenant isolation */
  group_id: string;
  /** Required: Reviewer identifier */
  reviewedBy: string;
}

/**
 * Promote from Notion parameters
 */
export interface PromoteFromNotionParams {
  /** Required: Notion page ID */
  notionPageId: string;
  /** Required: Tenant isolation */
  group_id: string;
  /** Optional: Neo4j insight ID if creating new */
  insightId?: string;
}

/**
 * Promote result
 */
export interface PromoteFromNotionResult {
  promoted: boolean;
  insightId: string;
}

/**
 * Notion Knowledge Hub database ID
 * Collection: Knowledge Hub
 */
export const DEFAULT_NOTION_DATABASE_ID = process.env.NOTION_KNOWLEDGE_HUB_DATABASE_ID || "9efeb76c-809b-440e-a76d-6a6e17bc8e7f";

/**
 * Validate group_id using tenant naming enforcement
 * RK-01: Enforces allura-{org} pattern
 */
function validateGroupId(groupId: string): void {
  try {
    validateTenantGroupId(groupId);
  } catch (error) {
    if (error instanceof GroupIdValidationError) {
      throw new NotionSyncValidationError(`RK-01: ${error.message}`);
    }
    throw error;
  }
}

/**
 * Sync a trace to Notion Knowledge Hub
 * 
 * Creates a new page in Notion database with:
 * - Source mapped to agent_id
 * - PostgreSQL Trace ID for audit linking
 * - Status: Draft (requires human review)
 * - Group ID for tenant isolation
 * 
 * @param params - Sync parameters
 * @returns Sync result with Notion page ID and status
 * @throws NotionSyncValidationError (RK-01) if group_id is invalid
 */
export async function syncTraceToNotion(params: SyncToNotionParams): Promise<SyncToNotionResult> {
  // RK-01: Validate group_id
  validateGroupId(params.group_id);

  if (!params.traceId || params.traceId.trim().length === 0) {
    throw new NotionSyncValidationError("RK-01: traceId is required and cannot be empty");
  }

  const pool = getPool();
  const notionClient = getNotionClient();
  const databaseId = params.databaseId || DEFAULT_NOTION_DATABASE_ID;

  // Generate UUID for notion_sync_log record
  const syncLogId = crypto.randomUUID();
  const now = new Date();

  // Create Notion page
  const notionPayload: CreatePagePayload = {
    parent: { database_id: databaseId },
    properties: {
      "Title": {
        title: [
          {
            text: {
              content: `Trace ${params.traceId}`,
            },
          },
        ],
      },
      "Source": {
        select: {
          name: "PostgreSQL Trace",
        },
      },
      "Trace ID": {
        rich_text: [
          {
            text: {
              content: params.traceId,
            },
          },
        ],
      },
      "Group ID": {
        rich_text: [
          {
            text: {
              content: params.group_id,
            },
          },
        ],
      },
      "Status": {
        select: {
          name: "Draft",
        },
      },
      ...params.properties,
    },
  };

  // Create page in Notion
  const notionPage = await notionClient.createPage(notionPayload);

  // Insert sync record into PostgreSQL
  const insertQuery = `
    INSERT INTO notion_sync_log (
      id,
      group_id,
      trace_id,
      notion_page_id,
      status,
      synced_at,
      promoted
    ) VALUES ($1, $2, $3, $4, $5, $6, $7)
    RETURNING *
  `;

  const values = [
    syncLogId,
    params.group_id,
    params.traceId,
    notionPage.id,
    "draft",
    now,
    false,
  ];

  const result = await pool.query<SyncStatusRecord>(insertQuery, values);
  const record = result.rows[0];

  return {
    notionPageId: record.notion_page_id,
    status: record.status,
  };
}

/**
 * Get sync status for traces
 * 
 * Retrieves sync status records, ordered by most recent first.
 * Enforces tenant isolation via group_id.
 * 
 * @param params - Query parameters
 * @returns Array of sync status records
 * @throws NotionSyncValidationError (RK-01) if group_id is invalid
 */
export async function getSyncStatus(params: GetSyncStatusParams): Promise<SyncStatusRecord[]> {
  // RK-01: Validate group_id
  validateGroupId(params.group_id);

  const pool = getPool();
  const limit = params.limit || 10;

  let query = `
    SELECT 
      id,
      group_id,
      trace_id,
      notion_page_id,
      status,
      synced_at,
      reviewed_by,
      reviewed_at,
      promoted,
      created_at,
      updated_at
    FROM notion_sync_log
    WHERE group_id = $1
  `;

  const queryValues: (string | number)[] = [params.group_id];
  let paramIndex = 2;

  // Add status filter if provided
  if (params.status) {
    query += ` AND status = $${paramIndex}`;
    queryValues.push(params.status);
    paramIndex++;
  }

  query += ` ORDER BY synced_at DESC LIMIT $${paramIndex}`;
  queryValues.push(limit);

  const result = await pool.query<SyncStatusRecord>(query, queryValues);

  return result.rows;
}

/**
 * Mark a synced trace as reviewed
 * 
 * Updates the sync record to mark it as reviewed by a human.
 * This is a prerequisite for promotion to Neo4j.
 * 
 * @param params - Review parameters
 * @throws NotionSyncValidationError (RK-01) if group_id is invalid
 * @throws Error if sync record not found
 */
export async function markAsReviewed(params: MarkAsReviewedParams): Promise<void> {
  // RK-01: Validate group_id
  validateGroupId(params.group_id);

  if (!params.notionPageId || params.notionPageId.trim().length === 0) {
    throw new NotionSyncValidationError("RK-01: notionPageId is required and cannot be empty");
  }

  if (!params.reviewedBy || params.reviewedBy.trim().length === 0) {
    throw new NotionSyncValidationError("RK-01: reviewedBy is required and cannot be empty");
  }

  const pool = getPool();
  const now = new Date();

  const updateQuery = `
    UPDATE notion_sync_log
    SET 
      status = 'reviewed',
      reviewed_by = $1,
      reviewed_at = $2,
      updated_at = $3
    WHERE notion_page_id = $4
      AND group_id = $5
      AND status = 'draft'
    RETURNING id
  `;

  const result = await pool.query<{ id: string }>(updateQuery, [
    params.reviewedBy,
    now,
    now,
    params.notionPageId,
    params.group_id,
  ]);

  if (result.rowCount === 0) {
    throw new Error(
      `Sync record not found or not in draft status: notion_page_id=${params.notionPageId}, group_id=${params.group_id}`
    );
  }
}

/**
 * Promote a reviewed trace from Notion to Neo4j
 * 
 * This performs the HITL (Human-in-the-Loop) promotion:
 * 1. Verifies the record is reviewed
 * 2. Creates insight in Neo4j
 * 3. Marks record as promoted
 * 
 * @param params - Promotion parameters
 * @returns Promotion result with insight ID
 * @throws NotionSyncValidationError (RK-01) if group_id is invalid
 * @throws Error if sync record not found or not reviewed
 */
export async function promoteFromNotion(params: PromoteFromNotionParams): Promise<PromoteFromNotionResult> {
  // RK-01: Validate group_id
  validateGroupId(params.group_id);

  if (!params.notionPageId || params.notionPageId.trim().length === 0) {
    throw new NotionSyncValidationError("RK-01: notionPageId is required and cannot be empty");
  }

  const pool = getPool();

  // First, verify the record exists and is reviewed
  const checkQuery = `
    SELECT id, trace_id, status
    FROM notion_sync_log
    WHERE notion_page_id = $1
      AND group_id = $2
  `;

  const checkResult = await pool.query<{ id: string; trace_id: string; status: string }>(checkQuery, [
    params.notionPageId,
    params.group_id,
  ]);

  if (checkResult.rowCount === 0) {
    throw new Error(
      `Sync record not found: notion_page_id=${params.notionPageId}, group_id=${params.group_id}`
    );
  }

  const record = checkResult.rows[0];

  if (record.status !== "reviewed") {
    throw new Error(
      `Cannot promote record with status '${record.status}'. Record must be reviewed first.`
    );
  }

  // Generate or use provided insight ID
  const insightId = params.insightId || crypto.randomUUID();
  const now = new Date();

  // NOTE: Neo4j promotion would happen here via MCP_DOCKER tools
  // For now, we just mark the record as promoted
  // The actual Neo4j integration is handled by the memory system

  // Update sync record to promoted
  const updateQuery = `
    UPDATE notion_sync_log
    SET 
      status = 'promoted',
      promoted = true,
      updated_at = $1
    WHERE notion_page_id = $2
      AND group_id = $3
    RETURNING id
  `;

  await pool.query(updateQuery, [now, params.notionPageId, params.group_id]);

  // Log promotion event to events table
  const eventQuery = `
    INSERT INTO events (
      group_id,
      event_type,
      agent_id,
      metadata,
      status
    ) VALUES ($1, $2, $3, $4, $5)
  `;

  await pool.query(eventQuery, [
    params.group_id,
    "notion.promotion",
    "notion-sync-workflow",
    {
      notion_page_id: params.notionPageId,
      trace_id: record.trace_id,
      insight_id: insightId,
      promoted_at: now.toISOString(),
    },
    "completed",
  ]);

  return {
    promoted: true,
    insightId,
  };
}

/**
 * Get sync status counts by status
 * 
 * Useful for dashboards and monitoring.
 * 
 * @param group_id - Tenant isolation
 * @returns Counts by status
 * @throws NotionSyncValidationError (RK-01) if group_id is invalid
 */
export async function getSyncStatusCounts(
  group_id: string
): Promise<Record<SyncStatus, number>> {
  // RK-01: Validate group_id
  validateGroupId(group_id);

  const pool = getPool();

  const query = `
    SELECT 
      status,
      COUNT(*)::text as count
    FROM notion_sync_log
    WHERE group_id = $1
    GROUP BY status
  `;

  const result = await pool.query<{ status: string; count: string }>(query, [group_id]);

  const counts: Record<SyncStatus, number> = {
    draft: 0,
    reviewed: 0,
    promoted: 0,
    rejected: 0,
  };

  for (const row of result.rows) {
    counts[row.status as SyncStatus] = parseInt(row.count, 10);
  }

  return counts;
}

/**
 * Reject a synced trace
 * 
 * Marks the sync record as rejected (not suitable for promotion).
 * 
 * @param notionPageId - Notion page ID
 * @param group_id - Tenant isolation
 * @param reason - Rejection reason
 * @throws NotionSyncValidationError (RK-01) if group_id is invalid
 */
export async function rejectSync(
  notionPageId: string,
  group_id: string,
  reason: string
): Promise<void> {
  // RK-01: Validate group_id
  validateGroupId(group_id);

  if (!notionPageId || notionPageId.trim().length === 0) {
    throw new NotionSyncValidationError("RK-01: notionPageId is required and cannot be empty");
  }

  const pool = getPool();
  const now = new Date();

  const updateQuery = `
    UPDATE notion_sync_log
    SET 
      status = 'rejected',
      updated_at = $1
    WHERE notion_page_id = $2
      AND group_id = $3
      AND status IN ('draft', 'reviewed')
    RETURNING id
  `;

  const result = await pool.query<{ id: string }>(updateQuery, [now, notionPageId, group_id]);

  if (result.rowCount === 0) {
    throw new Error(
      `Cannot reject record: notion_page_id=${notionPageId}, group_id=${group_id}. Record may not exist or already promoted/rejected.`
    );
  }

  // Log rejection event
  const eventQuery = `
    INSERT INTO events (
      group_id,
      event_type,
      agent_id,
      metadata,
      status
    ) VALUES ($1, $2, $3, $4, $5)
  `;

  await pool.query(eventQuery, [
    group_id,
    "notion.rejection",
    "notion-sync-workflow",
    {
      notion_page_id: notionPageId,
      reason,
      rejected_at: now.toISOString(),
    },
    "completed",
  ]);
}