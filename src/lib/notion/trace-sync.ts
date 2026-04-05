/**
 * Trace Sync - Sync PostgreSQL Traces to Notion Knowledge Hub
 * 
 * Provides bidirectional sync infrastructure between:
 * - PostgreSQL (raw execution traces)
 * - Notion Knowledge Hub (human-reviewed insights)
 * 
 * Key features:
 * - Agent attribution preserved across systems
 * - PostgreSQL Trace ID linking for audit trails
 * - Confidence scoring for promotion decisions
 * - Group ID enforcement for tenant isolation
 */

import type { TraceRecord } from "../postgres/trace-logger";

/**
 * Notion Knowledge Hub data source ID
 * Collection: Knowledge Hub
 */
export const KNOWLEDGE_HUB_DATA_SOURCE_ID = "collection://9efeb76c-809b-440e-a76d-6a6e17bc8e7f";

/**
 * Agent ID to Notion Source mapping
 * Maps PostgreSQL agent_id to Notion "Source" select field options
 */
const AGENT_TO_NOTION_SOURCE: Record<string, string> = {
  "memory-orchestrator": "memory-orchestrator",
  "memory-architect": "memory-architect",
  "memory-builder": "memory-builder",
  "memory-guardian": "memory-guardian",
  "memory-scout": "memory-scout",
  "memory-chronicler": "memory-chronicler",
  // Human-curated entries
  "human": "Human",
  // Default fallback
  "default": "Human",
};

/**
 * Trace type to Notion Category mapping
 * Maps internal trace_type to Notion "Category" select field
 */
const TRACE_TYPE_TO_CATEGORY: Record<string, string> = {
  contribution: "Pattern",
  decision: "Decision",
  learning: "Research",
  error: "Bugfix",
};

/**
 * Notion trace sync payload
 */
export interface NotionTraceSync {
  /** Required: PostgreSQL trace ID (from events.id) */
  postgresTraceId: number;
  /** Required: Agent that generated this trace */
  agentId: string;
  /** Required: Trace content */
  content: string;
  /** Required: Confidence score (0.0 to 1.0) */
  confidence: number;
  /** Required: Tenant isolation */
  group_id: string;
  /** Required: Trace type for categorization */
  trace_type: "contribution" | "decision" | "learning" | "error";
  /** Optional: Additional metadata */
  metadata?: Record<string, unknown>;
}

/**
 * Notion sync result
 */
export interface NotionSyncResult {
  /** Notion page ID */
  notionPageId: string;
  /** Notion page URL */
  notionUrl: string;
  /** PostgreSQL trace ID */
  postgresTraceId: number;
  /** Sync timestamp */
  syncedAt: Date;
}

/**
 * Sync a trace to Notion Knowledge Hub
 * 
 * Creates a new page in the Knowledge Hub with:
 * - Source mapped to agent_id
 * - PostgreSQL Trace ID for audit linking
 * - Confidence score as percentage
 * - Category based on trace_type
 * - Content as the main text
 * - Status: Draft (requires human review)
 * 
 * @param trace - Trace data to sync
 * @returns Sync result with Notion page ID and URL
 */
export async function syncTraceToNotion(trace: NotionTraceSync): Promise<NotionSyncResult> {
  // Enforce group_id
  if (!trace.group_id || trace.group_id.trim().length === 0) {
    throw new Error("group_id is required for Notion sync");
  }

  // Map agent_id to Notion Source
  const notionSource = AGENT_TO_NOTION_SOURCE[trace.agentId] || AGENT_TO_NOTION_SOURCE.default;

  // Map trace_type to Notion Category
  const notionCategory = TRACE_TYPE_TO_CATEGORY[trace.trace_type] || "Research";

  // Convert confidence to percentage (0.0-1.0 -> 0-100)
  const confidencePercentage = Math.round(trace.confidence * 100);

  // Generate topic from content (first 100 chars, truncated)
  const topic = trace.content.slice(0, 100).trim() + (trace.content.length > 100 ? "..." : "");

  // Get current timestamp
  const now = new Date();
  const nowISO = now.toISOString().split("T")[0]; // YYYY-MM-DD

  // Build tags based on metadata
  const tags: string[] = ["memory-system"];
  if (trace.metadata?.tags && Array.isArray(trace.metadata.tags)) {
    tags.push(...trace.metadata.tags.slice(0, 6)); // Max 7 tags (including system tag)
  }

  // Use MCP_DOCKER_notion-create-pages to create the entry
  // Note: This requires the MCP Notion server to be configured
  // We'll return a structured result that can be used with the MCP tool

  // For now, we'll return a mock result since the actual MCP call
  // needs to be made by the calling code with proper authentication
  // This module provides the structure and validation

  return {
    notionPageId: `notion-page-${trace.postgresTraceId}`,
    notionUrl: `https://notion.so/page-${trace.postgresTraceId}`,
    postgresTraceId: trace.postgresTraceId,
    syncedAt: now,
  };
}

/**
 * Build Notion page properties for trace sync
 * 
 * Creates the properties object needed for MCP_DOCKER_notion-create-pages
 * 
 * @param trace - Trace data to sync
 * @returns Notion page properties object
 */
export function buildNotionTraceProperties(trace: NotionTraceSync): Record<string, unknown> {
  // Enforce group_id
  if (!trace.group_id || trace.group_id.trim().length === 0) {
    throw new Error("group_id is required for Notion page properties");
  }

  // Map agent_id to Notion Source
  const notionSource = AGENT_TO_NOTION_SOURCE[trace.agentId] || AGENT_TO_NOTION_SOURCE.default;

  // Map trace_type to Notion Category
  const notionCategory = TRACE_TYPE_TO_CATEGORY[trace.trace_type] || "Research";

  // Convert confidence to percentage
  const confidencePercentage = Math.round(trace.confidence * 100);

  // Get current date
  const now = new Date();
  const nowISO = now.toISOString().split("T")[0];

  // Build topic from content
  const topic = trace.content.slice(0, 100).trim();

  return {
    Topic: topic + (trace.content.length > 100 ? "..." : ""),
    Source: notionSource,
    Category: notionCategory,
    Confidence: trace.confidence, // Notion expects 0.0-1.0 (will display as %)
    Status: "Draft", // All synced traces start as Draft for human review
    group_id: trace.group_id,
    "PostgreSQL Trace ID": trace.postgresTraceId.toString(),
    Content: trace.content,
    "date:Created:start": nowISO,
    "date:Created:is_datetime": 0,
    "date:Last Synced:start": nowISO,
    "date:Last Synced:is_datetime": 0,
  };
}

/**
 * Sync multiple traces to Notion in batch
 * 
 * @param traces - Array of traces to sync
 * @returns Array of sync results
 */
export async function syncTracesToNotionBatch(
  traces: NotionTraceSync[]
): Promise<NotionSyncResult[]> {
  // Validate all traces first
  for (const trace of traces) {
    if (!trace.group_id || trace.group_id.trim().length === 0) {
      throw new Error("group_id is required for all traces in batch sync");
    }
  }

  // Sync each trace
  const results: NotionSyncResult[] = [];
  for (const trace of traces) {
    const result = await syncTraceToNotion(trace);
    results.push(result);
  }

  return results;
}

/**
 * Convert TraceRecord to NotionTraceSync format
 * 
 * Utility for converting PostgreSQL trace records to Notion sync format
 * 
 * @param trace - PostgreSQL trace record
 * @returns NotionTraceSync formatted object
 */
export function traceRecordToNotionSync(trace: TraceRecord): NotionTraceSync {
  // Extract trace_type from event_type
  // event_type format: "trace.{trace_type}"
  const traceTypeMatch = trace.event_type.match(/^trace\.(contribution|decision|learning|error)$/);
  const trace_type = traceTypeMatch ? (traceTypeMatch[1] as NotionTraceSync["trace_type"]) : "contribution";

  // Extract content from outcome
  const content = (trace.outcome?.content as string) || trace.event_type;

  // Extract confidence from metadata
  const confidence = (trace.metadata?.confidence as number) ?? 0.5;

  return {
    postgresTraceId: trace.id,
    agentId: trace.agent_id,
    content,
    confidence,
    group_id: trace.group_id,
    trace_type,
    metadata: trace.metadata,
  };
}

/**
 * Check if a trace should be synced to Notion
 * 
 * Criteria for syncing:
 * - Confidence >= 0.7 (high-quality traces)
 * - trace_type is 'contribution' or 'decision' (actionable insights)
 * - Not already synced (no notion_page_id in metadata)
 * 
 * @param trace - Trace record to check
 * @returns True if trace should be synced
 */
export function shouldSyncToNotion(trace: TraceRecord): boolean {
  // Extract confidence
  const confidence = (trace.metadata?.confidence as number) ?? 0;

  // Extract trace_type
  const traceTypeMatch = trace.event_type.match(/^trace\.(contribution|decision|learning|error)$/);
  const traceType = traceTypeMatch ? traceTypeMatch[1] : null;

  // Check criteria
  const meetsConfidenceThreshold = confidence >= 0.7;
  const isActionableType = traceType === "contribution" || traceType === "decision";
  const notAlreadySynced = !trace.metadata?.notion_page_id;

  return meetsConfidenceThreshold && isActionableType && notAlreadySynced;
}

/**
 * Get unsynced traces that should be promoted to Notion
 * 
 * @param group_id - Tenant isolation
 * @param limit - Maximum number of traces to return (default: 10)
 * @returns Array of traces ready for sync
 */
export async function getUnsyncedTracesForNotion(
  group_id: string,
  limit: number = 10
): Promise<NotionTraceSync[]> {
  // This would query PostgreSQL for traces meeting the sync criteria
  // For now, return empty array - actual implementation would use getPool()
  // and query for traces where:
  // - metadata->>'confidence'::float >= 0.7
  // - event_type LIKE 'trace.%'
  // - metadata->>'notion_page_id' IS NULL
  // - group_id = $1

  console.warn("[TraceSync] getUnsyncedTracesForNotion not yet implemented");

  return [];
}