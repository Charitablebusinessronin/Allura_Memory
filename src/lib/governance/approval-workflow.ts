/**
 * Approval Workflow - HITL Knowledge Promotion
 * Story 3.2: Curator proposes, Auditor approves/rejects
 * 
 * Workflow:
 * 1. Curator proposes insight for promotion (PostgreSQL)
 * 2. Auditor reviews pending approvals (Paperclip Dashboard)
 * 3. Auditor approves/rejects
 * 4. If approved: promote to Neo4j (knowledge graph)
 * 5. If rejected: log reason, keep in PostgreSQL
 */

import type { Pool } from "pg";
import { getPool } from "../postgres/connection";
import { validateTenantGroupId, TENANT_ERROR_CODE } from "../validation/tenant-group-id";
import { insertEvent } from "../postgres/queries/insert-trace";
import { createInsight, type InsightRecord } from "../neo4j/queries/insert-insight";
import { writeTransaction, type ManagedTransaction } from "../neo4j/connection";

/**
 * Promotion request status values
 */
export type PromotionStatus = "pending" | "approved" | "rejected";

/**
 * Promotion request payload
 */
export interface PromotionRequestInsert {
  /** Required: Tenant isolation identifier */
  group_id: string;
  /** Required: The insight content (knowledge text) */
  insight_id: string;
  /** Required: Agent proposing the insight */
  proposed_by: string;
  /** Required: Rationale for promotion */
  rationale: string;
}

/**
 * Promotion request record as stored in PostgreSQL
 */
export interface PromotionRequest {
  id: string;
  group_id: string;
  insight_id: string;
  proposed_by: string;
  status: PromotionStatus;
  rationale: string;
  approved_by: string | null;
  created_at: Date;
  updated_at: Date;
}

/**
 * Validation error for invalid promotion data
 */
export class PromotionValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PromotionValidationError";
  }
}

/**
 * Conflict error for duplicate or invalid operations
 */
export class PromotionConflictError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PromotionConflictError";
  }
}

/**
 * Validate promotion request insert payload
 */
function validatePromotionInsert(request: PromotionRequestInsert): void {
  const errors: string[] = [];

  if (!request.group_id || request.group_id.trim().length === 0) {
    errors.push("group_id is required and cannot be empty");
  }

  if (!request.insight_id || request.insight_id.trim().length === 0) {
    errors.push("insight_id is required and cannot be empty");
  }

  if (!request.proposed_by || request.proposed_by.trim().length === 0) {
    errors.push("proposed_by is required and cannot be empty");
  }

  if (!request.rationale || request.rationale.trim().length === 0) {
    errors.push("rationale is required and cannot be empty");
  }

  if (errors.length > 0) {
    throw new PromotionValidationError(`Promotion validation failed: ${errors.join("; ")}`);
  }
}

/**
 * Generate a UUID for promotion requests
 */
function generateUUID(): string {
  return crypto.randomUUID();
}

/**
 * Propose an insight for promotion to Neo4j knowledge graph
 * Creates a promotion request in PostgreSQL (pending status)
 * 
 * @param params - Promotion request parameters
 * @returns The created promotion request
 * @throws PromotionValidationError if validation fails
 * @throws Error with RK-01 code if group_id validation fails
 */
export async function proposeForPromotion(params: {
  insightId: string;
  proposedBy: string;
  group_id: string;
  rationale: string;
}): Promise<PromotionRequest> {
  // Validate tenant group_id (enforces RK-01 error code)
  const validatedGroupId = validateTenantGroupId(params.group_id);

  // Validate parameters
  const insert: PromotionRequestInsert = {
    group_id: validatedGroupId,
    insight_id: params.insightId,
    proposed_by: params.proposedBy,
    rationale: params.rationale,
  };

  validatePromotionInsert(insert);

  const pool = getPool();
  const id = generateUUID();

  // Insert promotion request
  const query = `
    INSERT INTO promotion_requests (
      id,
      group_id,
      insight_id,
      proposed_by,
      status,
      rationale,
      created_at,
      updated_at
    ) VALUES ($1, $2, $3, $4, $5, $6, NOW(), NOW())
    RETURNING *
  `;

  const values = [
    id,
    insert.group_id,
    insert.insight_id,
    insert.proposed_by,
    "pending",
    insert.rationale,
  ];

  const result = await pool.query<PromotionRequest>(query, values);
  const promotionRequest = result.rows[0];

  // Log event to PostgreSQL
  await insertEvent({
    group_id: validatedGroupId,
    event_type: "promotion_proposed",
    agent_id: params.proposedBy,
    metadata: {
      promotion_request_id: id,
      insight_id: params.insightId,
      rationale: params.rationale,
    },
  });

  return promotionRequest;
}

/**
 * Get pending approval requests for a group
 * 
 * @param params - Query parameters
 * @returns Array of pending promotion requests
 * @throws Error with RK-01 code if group_id validation fails
 */
export async function getPendingApprovals(params: {
  group_id: string;
  limit?: number;
}): Promise<PromotionRequest[]> {
  // Validate tenant group_id
  const validatedGroupId = validateTenantGroupId(params.group_id);

  const pool = getPool();
  const limit = params.limit ?? 50;

  const query = `
    SELECT *
    FROM promotion_requests
    WHERE group_id = $1
      AND status = 'pending'
    ORDER BY created_at ASC
    LIMIT $2
  `;

  const result = await pool.query<PromotionRequest>(query, [
    validatedGroupId,
    limit,
  ]);

  return result.rows;
}

/**
 * Approve a promotion request
 * 1. Updates PostgreSQL promotion_requests status to 'approved'
 * 2. Promotes insight to Neo4j knowledge graph
 * 3. Logs approval event
 * 
 * @param params - Approval parameters
 * @returns The promoted insight record from Neo4j
 * @throws PromotionValidationError if request not found
 * @throws PromotionConflictError if request not in pending state
 * @throws Error with RK-01 code if group_id validation fails
 */
export async function approvePromotion(params: {
  requestId: string;
  approvedBy: string; // human user (auditor)
  group_id: string;
}): Promise<InsightRecord> {
  // Validate tenant group_id
  const validatedGroupId = validateTenantGroupId(params.group_id);

  const pool = getPool();

  // Get the promotion request
  const getRequestQuery = `
    SELECT *
    FROM promotion_requests
    WHERE id = $1
      AND group_id = $2
  `;

  const requestResult = await pool.query<PromotionRequest>(getRequestQuery, [
    params.requestId,
    validatedGroupId,
  ]);

  if (requestResult.rows.length === 0) {
    throw new PromotionValidationError(
      `Promotion request '${params.requestId}' not found in group '${validatedGroupId}'`
    );
  }

  const request = requestResult.rows[0];

  if (request.status !== "pending") {
    throw new PromotionConflictError(
      `Promotion request '${params.requestId}' is not in pending state. ` +
      `Current status: ${request.status}`
    );
  }

  // Start transaction for PostgreSQL + Neo4j sync
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    // Update PostgreSQL status to approved
    const updateQuery = `
      UPDATE promotion_requests
      SET status = 'approved',
          approved_by = $1,
          updated_at = NOW()
      WHERE id = $2
      RETURNING *
    `;

    await client.query(updateQuery, [params.approvedBy, params.requestId]);

    // Promote to Neo4j knowledge graph
    // The insight_id is stable across versions
    const insight = await createInsight({
      insight_id: request.insight_id,
      group_id: validatedGroupId,
      content: request.rationale,
      confidence: 1.0, // Promoted insights get full confidence
      source_type: "promotion",
      created_by: request.proposed_by,
      metadata: {
        promotion_request_id: params.requestId,
        approved_by: params.approvedBy,
      },
    });

    // Log approval event
    await insertEvent({
      group_id: validatedGroupId,
      event_type: "promotion_approved",
      agent_id: params.approvedBy,
      metadata: {
        promotion_request_id: params.requestId,
        insight_id: request.insight_id,
        neo4j_insight_id: insight.id,
      },
    });

    await client.query("COMMIT");

    return insight;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

/**
 * Reject a promotion request
 * 1. Updates PostgreSQL promotion_requests status to 'rejected'
 * 2. Logs rejection reason
 * 3. Keeps in PostgreSQL for audit trail
 * 
 * @param params - Rejection parameters
 * @throws PromotionValidationError if request not found
 * @throws PromotionConflictError if request not in pending state
 * @throws Error with RK-01 code if group_id validation fails
 */
export async function rejectPromotion(params: {
  requestId: string;
  rejectedBy: string;
  group_id: string;
  reason: string;
}): Promise<void> {
  // Validate tenant group_id
  const validatedGroupId = validateTenantGroupId(params.group_id);

  if (!params.reason || params.reason.trim().length === 0) {
    throw new PromotionValidationError("Rejection reason is required");
  }

  const pool = getPool();

  // Get the promotion request
  const getRequestQuery = `
    SELECT *
    FROM promotion_requests
    WHERE id = $1
      AND group_id = $2
  `;

  const requestResult = await pool.query<PromotionRequest>(getRequestQuery, [
    params.requestId,
    validatedGroupId,
  ]);

  if (requestResult.rows.length === 0) {
    throw new PromotionValidationError(
      `Promotion request '${params.requestId}' not found in group '${validatedGroupId}'`
    );
  }

  const request = requestResult.rows[0];

  if (request.status !== "pending") {
    throw new PromotionConflictError(
      `Promotion request '${params.requestId}' is not in pending state. ` +
      `Current status: ${request.status}`
    );
  }

  // Update status to rejected
  const updateQuery = `
    UPDATE promotion_requests
    SET status = 'rejected',
        approved_by = $1,
        updated_at = NOW()
    WHERE id = $2
    RETURNING *
  `;

  await pool.query(updateQuery, [params.rejectedBy, params.requestId]);

  // Log rejection event
  await insertEvent({
    group_id: validatedGroupId,
    event_type: "promotion_rejected",
    agent_id: params.rejectedBy,
    metadata: {
      promotion_request_id: params.requestId,
      insight_id: request.insight_id,
      rejection_reason: params.reason,
    },
  });
}

/**
 * Get all promotion requests for a group (any status)
 * Useful for admin dashboards and audit trails
 * 
 * @param params - Query parameters
 * @returns Array of promotion requests
 * @throws Error with RK-01 code if group_id validation fails
 */
export async function getAllPromotionRequests(params: {
  group_id: string;
  status?: PromotionStatus;
  limit?: number;
}): Promise<PromotionRequest[]> {
  // Validate tenant group_id
  const validatedGroupId = validateTenantGroupId(params.group_id);

  const pool = getPool();
  const limit = params.limit ?? 50;

  let query: string;
  let values: unknown[];

  if (params.status) {
    query = `
      SELECT *
      FROM promotion_requests
      WHERE group_id = $1
        AND status = $2
      ORDER BY created_at DESC
      LIMIT $3
    `;
    values = [validatedGroupId, params.status, limit];
  } else {
    query = `
      SELECT *
      FROM promotion_requests
      WHERE group_id = $1
      ORDER BY created_at DESC
      LIMIT $2
    `;
    values = [validatedGroupId, limit];
  }

  const result = await pool.query<PromotionRequest>(query, values);

  return result.rows;
}

/**
 * Get promotion request by ID
 * 
 * @param params - Query parameters
 * @returns The promotion request or null if not found
 * @throws Error with RK-01 code if group_id validation fails
 */
export async function getPromotionRequestById(params: {
  requestId: string;
  group_id: string;
}): Promise<PromotionRequest | null> {
  // Validate tenant group_id
  const validatedGroupId = validateTenantGroupId(params.group_id);

  const pool = getPool();

  const query = `
    SELECT *
    FROM promotion_requests
    WHERE id = $1
      AND group_id = $2
  `;

  const result = await pool.query<PromotionRequest>(query, [
    params.requestId,
    validatedGroupId,
  ]);

  return result.rows.length > 0 ? result.rows[0] : null;
}