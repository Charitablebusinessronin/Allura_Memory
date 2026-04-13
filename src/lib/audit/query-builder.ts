/**
 * Audit Query Builder
 *
 * Builds parameterized SQL queries for audit event retrieval.
 * Enforces group_id on every query (tenant isolation invariant).
 * Supports date range, agent_id, and event_type filters.
 *
 * Phase 7: SOC2 Compliance — Audit Log CSV Export
 */

if (typeof window !== "undefined") {
  throw new Error("This module can only be used server-side");
}

import { getPool } from "@/lib/postgres/connection";
import { z } from "zod";

// ─────────────────────────────────────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Audit event record from the events table.
 * Maps to the PostgreSQL `events` table schema.
 */
export interface AuditEventRecord {
  id: number;
  group_id: string;
  agent_id: string;
  event_type: string;
  status: string;
  created_at: Date;
  metadata: Record<string, unknown>;
}

/**
 * Parameters for audit event queries.
 * All queries require group_id for tenant isolation.
 */
export interface AuditQueryParams {
  /** Required: Tenant isolation identifier (format: allura-*) */
  group_id: string;
  /** Optional: Filter by start date (ISO 8601) */
  from?: string;
  /** Optional: Filter by end date (ISO 8601) */
  to?: string;
  /** Optional: Filter by agent identifier */
  agent_id?: string;
  /** Optional: Filter by event type */
  event_type?: string;
  /** Maximum rows to return (default: 1000, max: 10000) */
  limit?: number;
  /** Pagination offset */
  offset?: number;
}

/**
 * Result of an audit query with pagination metadata.
 */
export interface AuditQueryResult {
  events: AuditEventRecord[];
  total: number;
  limit: number;
  offset: number;
  has_more: boolean;
}

// ─────────────────────────────────────────────────────────────────────────────
// VALIDATION
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Zod schema for audit query parameter validation.
 * Enforces group_id requirement and safe defaults.
 */
export const auditQuerySchema = z.object({
  group_id: z.string().min(1, "group_id is required"),
  from: z.string().datetime({ offset: true }).optional().or(z.string().date().optional()),
  to: z.string().datetime({ offset: true }).optional().or(z.string().date().optional()),
  agent_id: z.string().min(1).optional(),
  event_type: z.string().min(1).optional(),
  limit: z.coerce.number().int().min(1).max(10000).default(1000),
  offset: z.coerce.number().int().min(0).default(0),
});

export type AuditQueryInput = z.infer<typeof auditQuerySchema>;

// ─────────────────────────────────────────────────────────────────────────────
// QUERY BUILDER
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Build a parameterized SQL query for audit events.
 *
 * Always includes group_id filter for tenant isolation.
 * Uses $N parameterized placeholders — never string interpolation.
 *
 * @param params - Validated query parameters
 * @returns Object with query text and parameter values
 */
export function buildAuditQuery(params: AuditQueryInput): {
  query: string;
  values: unknown[];
  countQuery: string;
  countValues: unknown[];
} {
  const conditions: string[] = ["group_id = $1"];
  const values: unknown[] = [params.group_id];
  let paramIndex = 2;

  // Date range: from (inclusive)
  if (params.from) {
    conditions.push(`created_at >= $${paramIndex}`);
    values.push(params.from);
    paramIndex++;
  }

  // Date range: to (inclusive)
  if (params.to) {
    conditions.push(`created_at <= $${paramIndex}`);
    values.push(params.to);
    paramIndex++;
  }

  // Agent filter
  if (params.agent_id) {
    conditions.push(`agent_id = $${paramIndex}`);
    values.push(params.agent_id);
    paramIndex++;
  }

  // Event type filter
  if (params.event_type) {
    conditions.push(`event_type = $${paramIndex}`);
    values.push(params.event_type);
    paramIndex++;
  }

  const whereClause = conditions.join(" AND ");

  // Main query — select specific columns for audit export
  const query = `
    SELECT
      id,
      group_id,
      agent_id,
      event_type,
      status,
      created_at,
      metadata
    FROM events
    WHERE ${whereClause}
    ORDER BY created_at DESC
    LIMIT $${paramIndex}
    OFFSET $${paramIndex + 1}
  `;

  const limitValue = params.limit;
  const offsetValue = params.offset;

  // Count query — same filters, no pagination
  const countQuery = `
    SELECT COUNT(*)::int AS total
    FROM events
    WHERE ${whereClause}
  `;

  return {
    query,
    values: [...values, limitValue, offsetValue],
    countQuery,
    countValues: [...values],
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// QUERY EXECUTION
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Execute an audit event query with pagination metadata.
 *
 * @param params - Validated query parameters
 * @returns Query result with events and pagination metadata
 */
export async function queryAuditEvents(
  params: AuditQueryInput
): Promise<AuditQueryResult> {
  const pool = getPool();
  const { query, values, countQuery, countValues } = buildAuditQuery(params);

  // Run both queries in parallel
  const [eventsResult, countResult] = await Promise.all([
    pool.query<AuditEventRecord>(query, values),
    pool.query<{ total: number }>(countQuery, countValues),
  ]);

  const total = countResult.rows[0]?.total ?? 0;
  const hasMore = params.offset + eventsResult.rows.length < total;

  return {
    events: eventsResult.rows,
    total,
    limit: params.limit,
    offset: params.offset,
    has_more: hasMore,
  };
}

/**
 * Create an async generator that yields audit events row by row.
 *
 * Use this for CSV streaming — avoids buffering all rows in memory.
 * Each yielded row is an array of values matching the CSV header order.
 *
 * @param params - Validated query parameters
 * @yields Arrays of values for each event row
 */
export async function* streamAuditEvents(
  params: AuditQueryInput
): AsyncGenerator<AuditEventRecord, void, unknown> {
  const pool = getPool();
  const { query, values } = buildAuditQuery(params);

  const result = await pool.query<AuditEventRecord>(query, values);

  for (const row of result.rows) {
    yield row;
  }
}