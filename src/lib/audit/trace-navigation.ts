/**
 * Audit Navigation Queries
 * Story 1.6: Link Promoted Knowledge Back to Raw Evidence
 * 
 * Navigate between Neo4j insights and PostgreSQL traces.
 */

import type { Pool } from "pg";
import { getPool } from "../postgres/connection";
import { getDriver } from "../neo4j/connection";
import { readTransaction, writeTransaction, type ManagedTransaction } from "../neo4j/connection";
import { parseTraceRef, formatTraceRef, verifyTraceRefExists, isSupportedTraceTable } from "../validation/trace-ref";

/**
 * Audit trail record combining insight and trace details
 */
export interface AuditTrailRecord {
  /** Insight ID */
  insight_id: string;
  /** Insight version */
  version: number;
  /** Insight content */
  content: string;
  /** Trace reference */
  trace_ref: string;
  /** Source table */
  trace_table: string;
  /** Source record ID */
  trace_id: number | string;
  /** Event type (if from events table) */
  event_type?: string;
  /** Created timestamp */
  created_at: Date;
  /** Agent that created the insight */
  created_by: string | null;
  /** Confidence score */
  confidence: number;
  /** Group ID */
  group_id: string;
}

/**
 * Trace details from PostgreSQL
 */
export interface TraceDetails {
  /** Table name */
  table: string;
  /** Record ID */
  id: number;
  /** Group ID (tenant) */
  group_id: string;
  /** Event type (for events) */
  event_type?: string;
  /** Agent ID */
  agent_id?: string;
  /** Workflow ID */
  workflow_id?: string | null;
  /** Status */
  status?: string;
  /** Created timestamp */
  created_at: Date;
  /** Metadata */
  metadata?: Record<string, unknown>;
  /** Outcome */
  outcome?: Record<string, unknown>;
  /** Error message */
  error_message?: string | null;
}

/**
 * Insight summary from Neo4j
 */
export interface InsightSummary {
  /** Insight ID */
  id: string;
  /** Stable insight_id */
  insight_id: string;
  /** Version */
  version: number;
  /** Content */
  content: string;
  /** Confidence */
  confidence: number;
  /** Group ID */
  group_id: string;
  /** Trace references */
  trace_refs: string[];
  /** Created at */
  created_at: Date;
  /** Created by */
  created_by: string | null;
  /** Status */
  status: string;
}

/**
 * Audit navigation error
 */
export class AuditNavigationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AuditNavigationError";
  }
}

/**
 * Get full trace details from PostgreSQL
 * 
 * @param traceRef - The trace_ref to look up
 * @returns Trace details or null if not found
 */
export async function getTraceDetails(traceRef: string): Promise<TraceDetails | null> {
  const validation = await verifyTraceRefExists(traceRef);

  if (!validation.valid || !validation.trace_ref || !validation.exists) {
    return null;
  }

  const parsed = validation.trace_ref;
  const pool = getPool();

  switch (parsed.table) {
    case "events": {
      const result = await pool.query<{
        id: number;
        group_id: string;
        event_type: string;
        agent_id: string;
        workflow_id: string | null;
        status: string;
        created_at: Date;
        metadata: Record<string, unknown>;
        outcome: Record<string, unknown>;
        error_message: string | null;
      }>(
        "SELECT * FROM events WHERE id = $1",
        [parsed.id]
      );

      if (result.rows.length === 0) {
        return null;
      }

      const row = result.rows[0];
      return {
        table: "events",
        id: row.id,
        group_id: row.group_id,
        event_type: row.event_type,
        agent_id: row.agent_id,
        workflow_id: row.workflow_id,
        status: row.status,
        created_at: row.created_at,
        metadata: row.metadata,
        outcome: row.outcome,
        error_message: row.error_message,
      };
    }

    case "artifacts": {
      const result = await pool.query<{
        id: string;
        run_id: string;
        type: string;
        content: string;
        created_at: Date;
      }>(
        "SELECT * FROM artifacts WHERE id = $1",
        [parsed.id]
      );

      if (result.rows.length === 0) {
        return null;
      }

      const row = result.rows[0];
      return {
        table: "artifacts",
        id: row.id as unknown as number,
        group_id: "unknown", // Artifacts don't have group_id directly
        created_at: row.created_at,
        metadata: { type: row.type, content: row.content },
      };
    }

    case "task_run": {
      const result = await pool.query<{
        id: string;
        task_key: string;
        created_at: Date;
      }>(
        "SELECT * FROM task_run WHERE id = $1",
        [parsed.id]
      );

      if (result.rows.length === 0) {
        return null;
      }

      const row = result.rows[0];
      return {
        table: "task_run",
        id: row.id as unknown as number,
        group_id: "unknown",
        created_at: row.created_at,
      };
    }

    case "source_refs": {
      const result = await pool.query<{
        id: string;
        url: string;
        title: string | null;
        created_at: Date;
      }>(
        "SELECT * FROM source_refs WHERE id = $1",
        [parsed.id]
      );

      if (result.rows.length === 0) {
        return null;
      }

      const row = result.rows[0];
      return {
        table: "source_refs",
        id: row.id as unknown as number,
        group_id: "unknown",
        created_at: row.created_at,
        metadata: { url: row.url, title: row.title },
      };
    }

    default:
      return null;
  }
}

/**
 * Get all insights derived from a specific trace
 * 
 * @param traceRef - The trace_ref to search for
 * @param groupId - Optional group_id filter
 * @returns Array of insight summaries
 */
export async function getInsightsByTraceRef(
  traceRef: string,
  groupId?: string
): Promise<InsightSummary[]> {
  const parsed = parseTraceRef(traceRef);
  const formattedRef = formatTraceRef(parsed.table, parsed.id);

  const result = await readTransaction(async (tx: ManagedTransaction) => {
    let query = `
      MATCH (i:Insight)
      WHERE i.source_ref = $trace_ref
    `;

    const params: Record<string, unknown> = {
      trace_ref: formattedRef,
    };

    if (groupId) {
      query += " AND i.group_id = $group_id";
      params.group_id = groupId;
    }

    query += " RETURN i ORDER BY i.created_at DESC";

    return await tx.run(query, params);
  });

  return result.records.map((record) => {
    const node = record.get("i");
    const props = node.properties;

    return {
      id: props.id as string,
      insight_id: props.insight_id as string,
      version: typeof props.version === "object" && "toNumber" in props.version
        ? props.version.toNumber()
        : props.version as number,
      content: props.content as string,
      confidence: typeof props.confidence === "object" && "toNumber" in props.confidence
        ? props.confidence.toNumber()
        : props.confidence as number,
      group_id: props.group_id as string,
      trace_refs: props.source_ref ? [props.source_ref as string] : [],
      created_at: new Date(props.created_at.toString()),
      created_by: props.created_by as string | null,
      status: props.status as string,
    };
  });
}

/**
 * Get audit trail for an insight
 * Returns the insight with its source trace details
 * 
 * @param insightId - The insight_id (not the node ID)
 * @param groupId - Group ID for tenant isolation
 * @returns Audit trail record or null
 */
export async function getAuditTrailForInsight(
  insightId: string,
  groupId: string
): Promise<AuditTrailRecord | null> {
  // Get the current version of the insight
  const insightResult = await readTransaction(async (tx: ManagedTransaction) => {
    const query = `
      MATCH (h:InsightHead {insight_id: $insight_id, group_id: $group_id})
      MATCH (i:Insight {id: h.current_id})
      RETURN i
    `;
    return await tx.run(query, { insight_id: insightId, group_id: groupId });
  });

  if (insightResult.records.length === 0) {
    return null;
  }

  const insightNode = insightResult.records[0].get("i");
  const insight = insightNode.properties;

  // Parse trace_ref
  const traceRef = insight.source_ref as string | null;
  if (!traceRef) {
    return null;
  }

  const parsed = parseTraceRef(traceRef);

  // Get trace details from PostgreSQL
  const traceDetails = await getTraceDetails(traceRef);

  return {
    insight_id: insight.insight_id as string,
    version: typeof insight.version === "object" && "toNumber" in insight.version
      ? insight.version.toNumber()
      : insight.version as number,
    content: insight.content as string,
    trace_ref: traceRef,
    trace_table: parsed.table,
    trace_id: parsed.id,
    event_type: traceDetails?.event_type,
    created_at: new Date(insight.created_at.toString()),
    created_by: insight.created_by as string | null,
    confidence: typeof insight.confidence === "object" && "toNumber" in insight.confidence
      ? insight.confidence.toNumber()
      : insight.confidence as number,
    group_id: insight.group_id as string,
  };
}

/**
 * Create a comprehensive audit report for a group
 * Lists all insights with their source traces
 * 
 * @param groupId - Group ID to generate report for
 * @returns Array of audit trail records
 */
export async function generateAuditReport(groupId: string): Promise<AuditTrailRecord[]> {
  // Get all insights for the group
  const insightsResult = await readTransaction(async (tx: ManagedTransaction) => {
    const query = `
      MATCH (h:InsightHead {group_id: $group_id})
      MATCH (i:Insight {id: h.current_id})
      RETURN i
      ORDER BY i.created_at DESC
    `;
    return await tx.run(query, { group_id: groupId });
  });

  const records: AuditTrailRecord[] = [];

  for (const record of insightsResult.records) {
    const insight = record.get("i").properties;
    const traceRef = insight.source_ref as string | null;

    if (!traceRef) {
      continue;
    }

    try {
      const parsed = parseTraceRef(traceRef);
      const traceDetails = await getTraceDetails(traceRef);

      // Skip if trace details not found
      if (!traceDetails) {
        continue;
      }

      records.push({
        insight_id: insight.insight_id as string,
        version: typeof insight.version === "object" && "toNumber" in insight.version
          ? insight.version.toNumber()
          : insight.version as number,
        content: insight.content as string,
        trace_ref: traceRef,
        trace_table: parsed.table,
        trace_id: parsed.id,
        event_type: traceDetails?.event_type,
        created_at: new Date(insight.created_at.toString()),
        created_by: insight.created_by as string | null,
        confidence: typeof insight.confidence === "object" && "toNumber" in insight.confidence
          ? insight.confidence.toNumber()
          : insight.confidence as number,
        group_id: insight.group_id as string,
      });
    } catch {
      // Skip invalid trace_refs
      continue;
    }
  }

  return records;
}

/**
 * Link an insight to a trace reference
 * Updates the source_ref property on the insight
 * 
 * @param insightId - The insight's stable ID
 * @param groupId - Group ID for tenant isolation
 * @param traceRef - The trace reference to link
 * @returns True if linked successfully
 */
export async function linkInsightToTrace(
  insightId: string,
  groupId: string,
  traceRef: string
): Promise<boolean> {
  // Verify trace_ref exists
  const validation = await verifyTraceRefExists(traceRef);

  if (!validation.valid || !validation.exists) {
    throw new AuditNavigationError(
      `Cannot link: trace_ref '${traceRef}' does not exist or is invalid`
    );
  }

  const formattedRef = formatTraceRef(validation.trace_ref!.table, validation.trace_ref!.id);

  // Update the insight
  await writeTransaction(async (tx: ManagedTransaction) => {
    const query = `
      MATCH (h:InsightHead {insight_id: $insight_id, group_id: $group_id})
      MATCH (i:Insight {id: h.current_id})
      SET i.source_ref = $trace_ref
      RETURN i
    `;
    await tx.run(query, {
      insight_id: insightId,
      group_id: groupId,
      trace_ref: formattedRef,
    });
  });

  return true;
}

/**
 * Unlink an insight from its trace reference
 * Clears the source_ref property
 * 
 * @param insightId - The insight's stable ID
 * @param groupId - Group ID for tenant isolation
 * @returns True if unlinked successfully
 */
export async function unlinkInsightFromTrace(
  insightId: string,
  groupId: string
): Promise<boolean> {
  await writeTransaction(async (tx: ManagedTransaction) => {
    const query = `
      MATCH (h:InsightHead {insight_id: $insight_id, group_id: $group_id})
      MATCH (i:Insight {id: h.current_id})
      REMOVE i.source_ref
      RETURN i
    `;
    await tx.run(query, {
      insight_id: insightId,
      group_id: groupId,
    });
  });

  return true;
}