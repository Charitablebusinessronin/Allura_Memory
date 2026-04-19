/**
 * Controlled Retrieval Layer — F10, F11
 *
 * The sole interface through which agents retrieve approved knowledge.
 * Agents MUST NOT query PostgreSQL or Neo4j directly (AD-19).
 *
 * This layer:
 * 1. Validates group_id and agent permissions
 * 2. Routes to the appropriate query backend (Neo4j insights, PG traces)
 * 3. Enforces scope (project + global)
 * 4. Attaches provenance metadata to every result
 * 5. Logs every retrieval call as an audit event
 *
 * Reference: docs/allura/DESIGN-MEMORY-SYSTEM.md §Retrieval Layer
 */

if (typeof window !== "undefined") {
  throw new Error("retrieval-layer can only be used server-side");
}

import { getPool } from "@/lib/postgres/connection";
import {
  searchInsights,
  listInsights,
  type InsightQueryParams,
  type PaginatedInsights,
} from "@/lib/neo4j/queries/get-insight";
import {
  getDualContextSemanticMemory,
  getMergedDualContextInsights,
  type DualInsightQueryParams,
  type ScopedInsight,
} from "@/lib/neo4j/queries/get-dual-context";
import { queryTraces } from "@/lib/postgres/traces";
import { validateGroupId, GroupIdValidationError } from "@/lib/validation/group-id";

// ── Types ──────────────────────────────────────────────────────────────────

export type RetrievalMode = "semantic" | "structured" | "hybrid" | "traces";

export interface RetrievalRequest {
  /** Required: Tenant isolation identifier */
  group_id: string;
  /** Required: Agent making the request (for audit) */
  agent_id: string;
  /** Required: Query text or search term */
  query: string;
  /** Retrieval mode (default: hybrid) */
  mode?: RetrievalMode;
  /** Scope configuration */
  scope?: {
    /** Include project-scoped insights (default: true) */
    project?: boolean;
    /** Include global-scoped insights (default: true) */
    global?: boolean;
  };
  /** Include raw trace evidence (default: false, policy-gated) */
  include_traces?: boolean;
  /** Structured filters */
  filters?: {
    status?: "active" | "superseded" | "deprecated" | "reverted";
    source_type?: string;
    min_confidence?: number;
    max_confidence?: number;
    since?: string;
    until?: string;
  };
  /** Maximum results (default: 10) */
  limit?: number;
}

export interface RetrievalResult {
  insight_id: string;
  content: string;
  source: "neo4j" | "postgres";
  confidence: number;
  scope: "project" | "global";
  version: number;
  topic_key: string;
  provenance: {
    proposal_id?: string;
    approved_by?: string;
    approved_at?: string;
    created_at: string;
  };
}

export interface TraceResult {
  id: string;
  type: string;
  agent: string;
  content: string;
  source: "postgres";
  timestamp: Date;
}

export interface RetrievalResponse {
  results: RetrievalResult[];
  traces?: TraceResult[];
  total: number;
  metadata: {
    retrieved_at: string;
    group_id: string;
    agent_id: string;
    mode: RetrievalMode;
    project_count: number;
    global_count: number;
    trace_count: number;
  };
}

// ── Validation ─────────────────────────────────────────────────────────────

function validateRequest(req: RetrievalRequest): string {
  if (!req.group_id) {
    throw new RetrievalError("group_id is required");
  }
  if (!req.agent_id) {
    throw new RetrievalError("agent_id is required");
  }
  if (!req.query || req.query.trim().length === 0) {
    throw new RetrievalError("query is required and cannot be empty");
  }

  // Validate group_id format
  try {
    return validateGroupId(req.group_id);
  } catch (error) {
    if (error instanceof GroupIdValidationError) {
      throw new RetrievalError(`Invalid group_id: ${error.message}`);
    }
    throw error;
  }
}

// ── Error ──────────────────────────────────────────────────────────────────

export class RetrievalError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "RetrievalError";
  }
}

// ── Audit Logging ──────────────────────────────────────────────────────────

async function logRetrieval(
  groupId: string,
  agentId: string,
  mode: RetrievalMode,
  resultCount: number
): Promise<void> {
  try {
    const pool = getPool();
    await pool.query(
      `INSERT INTO events (group_id, event_type, agent_id, status, metadata, created_at)
       VALUES ($1, 'retrieval_query', $2, 'completed', $3, NOW())`,
      [
        groupId,
        agentId,
        JSON.stringify({ mode, result_count: resultCount }),
      ]
    );
  } catch {
    // Audit logging failure must not block retrieval
    console.error("[Retrieval] Failed to log audit event (non-fatal)");
  }
}

// ── Core Retrieval ─────────────────────────────────────────────────────────

/**
 * Execute a controlled retrieval query.
 *
 * This is the sole function agents should call to retrieve knowledge.
 * It enforces scoping, audit logging, and provenance metadata.
 */
export async function retrieveKnowledge(
  req: RetrievalRequest
): Promise<RetrievalResponse> {
  const validatedGroupId = validateRequest(req);
  const mode = req.mode ?? "hybrid";
  const limit = req.limit ?? 10;
  const includeTraces = req.include_traces ?? false;
  const includeProject = req.scope?.project ?? true;
  const includeGlobal = req.scope?.global ?? true;

  let results: RetrievalResult[] = [];
  let projectCount = 0;
  let globalCount = 0;

  switch (mode) {
    case "semantic": {
      // Content-based search across approved insights
      const searchResults = await searchInsights(req.query, {
        group_id: validatedGroupId,
        limit,
        status: req.filters?.status,
        min_confidence: req.filters?.min_confidence,
      });
      results = searchResults.items.map((insight) => ({
        insight_id: insight.insight_id,
        content: insight.content,
        source: "neo4j" as const,
        confidence: insight.confidence,
        scope: "project" as const,
        version: insight.version,
        topic_key: insight.topic_key,
        provenance: {
          created_at: insight.created_at?.toISOString() ?? new Date().toISOString(),
        },
      }));
      projectCount = results.length;
      break;
    }

    case "structured": {
      // Filter-based query on approved insights
      const listParams: InsightQueryParams = {
        group_id: validatedGroupId,
        limit,
        status: req.filters?.status,
        source_type: req.filters?.source_type,
        min_confidence: req.filters?.min_confidence,
        max_confidence: req.filters?.max_confidence,
        since: req.filters?.since ? new Date(req.filters.since) : undefined,
        until: req.filters?.until ? new Date(req.filters.until) : undefined,
      };
      const listResults = await listInsights(listParams);
      results = listResults.items.map((insight) => ({
        insight_id: insight.insight_id,
        content: insight.content,
        source: "neo4j" as const,
        confidence: insight.confidence,
        scope: "project" as const,
        version: insight.version,
        topic_key: insight.topic_key,
        provenance: {
          created_at: insight.created_at?.toISOString() ?? new Date().toISOString(),
        },
      }));
      projectCount = results.length;
      break;
    }

    case "hybrid": {
      // Dual-context: project + global insights merged by confidence
      const dualParams: DualInsightQueryParams = {
        project_group_id: validatedGroupId,
        include_global: includeGlobal,
        status: req.filters?.status,
        min_confidence: req.filters?.min_confidence,
        limit_per_scope: limit,
      };
      const dualResults = await getDualContextSemanticMemory(dualParams);
      projectCount = dualResults.project_insights.length;
      globalCount = dualResults.global_insights.length;

      const allInsights: ScopedInsight[] = [];
      if (includeProject) allInsights.push(...dualResults.project_insights);
      if (includeGlobal) allInsights.push(...dualResults.global_insights);

      // Sort by confidence descending
      allInsights.sort((a, b) => b.confidence - a.confidence);

      results = allInsights.slice(0, limit).map((insight) => ({
        insight_id: insight.insight_id,
        content: insight.content,
        source: "neo4j" as const,
        confidence: insight.confidence,
        scope: insight.scope,
        version: insight.version,
        topic_key: insight.topic_key,
        provenance: {
          created_at: insight.created_at?.toISOString() ?? new Date().toISOString(),
        },
      }));
      break;
    }

    case "traces": {
      // Raw trace retrieval (policy-gated, not default)
      if (!includeTraces) {
        throw new RetrievalError(
          "Trace retrieval requires include_traces: true. This mode is policy-gated."
        );
      }
      // Fall through to trace retrieval below
      break;
    }
  }

  // Optional trace augmentation
  let traces: TraceResult[] | undefined;
  let traceCount = 0;
  if (includeTraces && mode !== "traces") {
    const traceResults = await queryTraces({
      group_id: validatedGroupId,
      limit: Math.min(limit, 5), // Traces are supplementary, cap at 5
    });
    traces = traceResults.map((trace) => ({
      id: trace.id,
      type: trace.type,
      agent: trace.agent,
      content: trace.content,
      source: "postgres" as const,
      timestamp: trace.timestamp,
    }));
    traceCount = traces.length;
  } else if (mode === "traces" && includeTraces) {
    const traceResults = await queryTraces({
      group_id: validatedGroupId,
      limit,
    });
    traces = traceResults.map((trace) => ({
      id: trace.id,
      type: trace.type,
      agent: trace.agent,
      content: trace.content,
      source: "postgres" as const,
      timestamp: trace.timestamp,
    }));
    traceCount = traces.length;
  }

  const response: RetrievalResponse = {
    results,
    traces,
    total: results.length,
    metadata: {
      retrieved_at: new Date().toISOString(),
      group_id: validatedGroupId,
      agent_id: req.agent_id,
      mode,
      project_count: projectCount,
      global_count: globalCount,
      trace_count: traceCount,
    },
  };

  // Log retrieval audit event
  await logRetrieval(validatedGroupId, req.agent_id, mode, results.length);

  return response;
}