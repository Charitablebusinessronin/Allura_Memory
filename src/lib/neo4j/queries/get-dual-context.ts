/**
 * Dual-Context Semantic Knowledge Query System
 * Story 1.4: Query Dual Context Memory (Neo4j)
 * 
 * Loads both project-specific and global insights together,
 * preserving scope metadata and version resolution for both scopes.
 */

import { readTransaction, type ManagedTransaction } from "../connection";
import type { InsightRecord, InsightStatus } from "./insert-insight";
import { getInsightById, type QueryError } from "./get-insight";

/**
 * Scope identifiers for dual-context queries
 */
export const GLOBAL_GROUP_ID = "global";

// Use neo4j.int to create proper integers for Cypher queries
const neo4jInt = (value: number) => {
  // Dynamically import neo4j-driver integer function
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const neo4j = require("neo4j-driver");
  return neo4j.int(value);
};

/**
 * Context scope in results
 */
export type ContextScope = "project" | "global";

/**
 * Scoped insight with context metadata
 */
export interface ScopedInsight extends InsightRecord {
  /** Scope identifier */
  scope: ContextScope;
  /** Source group ID */
  source_group_id: string;
}

/**
 * Dual-context query parameters for Neo4j
 */
export interface DualInsightQueryParams {
  /** Required: Project/group ID for local context */
  project_group_id: string;
  /** Optional: Include global context (default: true) */
  include_global?: boolean;
  /** Optional: Filter by status */
  status?: InsightStatus;
  /** Optional: Filter by minimum confidence */
  min_confidence?: number;
  /** Optional: Maximum insights per scope */
  limit_per_scope?: number;
}

/**
 * Dual-context result for semantic memory (Neo4j)
 */
export interface DualContextSemanticResult {
  /** Project-specific insights */
  project_insights: ScopedInsight[];
  /** Global insights (if included) */
  global_insights: ScopedInsight[];
  /** Total insights retrieved */
  total_count: number;
  /** Query metadata */
  metadata: {
    project_group_id: string;
    included_global: boolean;
    retrieved_at: Date;
    project_count: number;
    global_count: number;
  };
}

/**
 * Dual-context query error
 */
export class DualInsightQueryError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "DualInsightQueryError";
  }
}

/**
 * Default limit per scope
 */
const DEFAULT_LIMIT_PER_SCOPE = 20;

/**
 * Convert Neo4j node to ScopedInsight
 */
function neo4jToScopedInsight(
  node: { properties: Record<string, unknown> },
  scope: ContextScope
): ScopedInsight {
  const props = node.properties;
  
  const convertValue = (val: unknown): unknown => {
    if (val === null || val === undefined) return val;
    if (typeof val === "object" && val !== null && "toNumber" in val && typeof (val as { toNumber: () => number }).toNumber === "function") {
      return (val as { toNumber: () => number }).toNumber();
    }
    return val;
  };

  const convertDate = (val: unknown): Date | null => {
    if (val === null || val === undefined) return null;
    if (typeof val === "object" && val !== null && "toString" in val) {
      return new Date((val as { toString: () => string }).toString());
    }
    return new Date(val as string);
  };

  const convertMetadata = (val: unknown): Record<string, unknown> => {
    if (val === null || val === undefined) return {};
    if (typeof val === "string") {
      try {
        return JSON.parse(val);
      } catch {
        return {};
      }
    }
    if (typeof val === "object") {
      const result: Record<string, unknown> = {};
      const obj = val as Record<string, unknown>;
      for (const key of Object.keys(obj)) {
        result[key] = convertValue(obj[key]);
      }
      return result;
    }
    return {};
  };

  return {
    id: props.id as string,
    insight_id: props.insight_id as string,
    version: convertValue(props.version) as number,
    content: props.content as string,
    confidence: convertValue(props.confidence) as number,
    group_id: props.group_id as string,
    source_type: props.source_type as InsightRecord["source_type"],
    source_ref: props.source_ref as string | null,
    created_at: convertDate(props.created_at) as Date,
    created_by: props.created_by as string | null,
    status: props.status as InsightStatus,
    metadata: convertMetadata(props.metadata),
    // Scope metadata
    scope,
    source_group_id: props.group_id as string,
  };
}

/**
 * Validate dual-context query parameters
 */
function validateParams(params: DualInsightQueryParams): void {
  if (!params.project_group_id || params.project_group_id.trim().length === 0) {
    throw new DualInsightQueryError("project_group_id is required and cannot be empty");
  }

  // Prevent using GLOBAL_GROUP_ID as project_group_id
  if (params.project_group_id === GLOBAL_GROUP_ID) {
    throw new DualInsightQueryError(
      `project_group_id cannot be '${GLOBAL_GROUP_ID}'. Use a specific project group ID.`
    );
  }

  if (params.limit_per_scope !== undefined && params.limit_per_scope < 1) {
    throw new DualInsightQueryError("limit_per_scope must be a positive number");
  }

  if (params.min_confidence !== undefined && (params.min_confidence < 0 || params.min_confidence > 1)) {
    throw new DualInsightQueryError("min_confidence must be between 0 and 1");
  }
}

/**
 * Get insights for a specific group
 */
async function getInsightsForGroup(
  groupId: string,
  params: DualInsightQueryParams,
  limit: number
): Promise<ScopedInsight[]> {
  const scope = groupId === GLOBAL_GROUP_ID ? "global" : "project";

  const result = await readTransaction(async (tx: ManagedTransaction) => {
    const statusFilter = params.status ? "AND i.status = $status" : "";
    const confidenceFilter = params.min_confidence !== undefined 
      ? "AND i.confidence >= $min_confidence" 
      : "";

    const query = `
      MATCH (h:InsightHead {group_id: $group_id})
      MATCH (i:Insight {id: h.current_id})
      WHERE 1=1
        ${statusFilter}
        ${confidenceFilter}
      RETURN i
      ORDER BY i.created_at DESC
      LIMIT $limit
    `;

    const queryParams: Record<string, unknown> = {
      group_id: groupId,
      limit: neo4jInt(limit),
    };

    if (params.status) {
      queryParams.status = params.status;
    }

    if (params.min_confidence !== undefined) {
      queryParams.min_confidence = params.min_confidence;
    }

    return await tx.run(query, queryParams);
  });

  return result.records.map((record) => {
    const node = record.get("i");
    return neo4jToScopedInsight(node, scope);
  });
}

/**
 * Get dual-context semantic memory from Neo4j
 * Retrieves both project-specific and global insights
 * 
 * @param params - Query parameters
 * @returns Dual-context result with scoped insights
 */
export async function getDualContextSemanticMemory(
  params: DualInsightQueryParams
): Promise<DualContextSemanticResult> {
  validateParams(params);

  const includeGlobal = params.include_global ?? true;
  const limitPerScope = params.limit_per_scope ?? DEFAULT_LIMIT_PER_SCOPE;

  // Query project insights
  const projectInsights = await getInsightsForGroup(
    params.project_group_id,
    params,
    limitPerScope
  );

  // Query global insights if included
  let globalInsights: ScopedInsight[] = [];
  if (includeGlobal) {
    globalInsights = await getInsightsForGroup(
      GLOBAL_GROUP_ID,
      params,
      limitPerScope
    );
  }

  const totalCount = projectInsights.length + globalInsights.length;

  return {
    project_insights: projectInsights,
    global_insights: globalInsights,
    total_count: totalCount,
    metadata: {
      project_group_id: params.project_group_id,
      included_global: includeGlobal,
      retrieved_at: new Date(),
      project_count: projectInsights.length,
      global_count: globalInsights.length,
    },
  };
}

/**
 * Get merged dual-context insights (project + global combined)
 * Returns insights sorted by confidence DESC with scope metadata preserved
 * 
 * @param params - Query parameters
 * @returns Merged insights sorted by confidence DESC
 */
export async function getMergedDualContextInsights(
  params: DualInsightQueryParams
): Promise<ScopedInsight[]> {
  const result = await getDualContextSemanticMemory(params);

  // Merge and sort by confidence DESC
  const merged = [...result.project_insights, ...result.global_insights];
  merged.sort((a, b) => b.confidence - a.confidence);

  return merged;
}

/**
 * Get working memory context for dual-scope
 * Returns recent insights from both project and global contexts
 * 
 * @param project_group_id - Project group ID
 * @param recentCount - Number of recent insights per scope (default: 10)
 * @returns Working memory context with both scopes
 */
export async function getDualContextWorkingMemory(
  project_group_id: string,
  recentCount: number = 10
): Promise<DualContextSemanticResult> {
  return getDualContextSemanticMemory({
    project_group_id,
    include_global: true,
    status: "active",
    limit_per_scope: recentCount,
  });
}

/**
 * Check if a group ID is allowed for cross-project access
 * 
 * @param groupId - Group ID to check
 * @returns True if the group can be accessed from any project
 */
export function isGlobalContext(groupId: string): boolean {
  return groupId === GLOBAL_GROUP_ID;
}

/**
 * Validate that a query doesn't attempt to access unauthorized groups
 * 
 * @param requesting_group - The group making the request
 * @param target_group - The group being accessed
 * @throws DualInsightQueryError if access is denied
 */
export function validateCrossGroupAccess(
  requesting_group: string,
  target_group: string
): void {
  // Same group is always allowed
  if (requesting_group === target_group) {
    return;
  }

  // Global group is allowed from any project
  if (target_group === GLOBAL_GROUP_ID) {
    return;
  }

  // Any other cross-group access is denied
  throw new DualInsightQueryError(
    `Cross-project access denied: group '${requesting_group}' cannot access group '${target_group}'. ` +
    `Only '${GLOBAL_GROUP_ID}' context is shared across projects.`
  );
}

/**
 * Search insights in dual-context (project + global)
 * 
 * @param search_term - Text to search for in content
 * @param params - Query parameters
 * @returns Matching insights from both scopes
 */
export async function searchDualContextInsights(
  search_term: string,
  params: DualInsightQueryParams
): Promise<DualContextSemanticResult> {
  validateParams(params);

  if (!search_term || search_term.trim().length === 0) {
    throw new DualInsightQueryError("search_term is required and cannot be empty");
  }

  const includeGlobal = params.include_global ?? true;
  const limitPerScope = params.limit_per_scope ?? DEFAULT_LIMIT_PER_SCOPE;
  const scope = "project";

  const projectResult = await readTransaction(async (tx: ManagedTransaction) => {
    const query = `
      MATCH (h:InsightHead {group_id: $group_id})
      MATCH (i:Insight {id: h.current_id, status: 'active'})
      WHERE i.content CONTAINS $search_term
      RETURN i
      ORDER BY i.created_at DESC
      LIMIT $limit
    `;
    return await tx.run(query, {
      group_id: params.project_group_id,
      search_term,
      limit: neo4jInt(limitPerScope),
    });
  });

  const projectInsights = projectResult.records.map((record) => {
    const node = record.get("i");
    return neo4jToScopedInsight(node, scope);
  });

  // Query global insights if included
  let globalInsights: ScopedInsight[] = [];
  if (includeGlobal) {
    const globalResult = await readTransaction(async (tx: ManagedTransaction) => {
      const query = `
        MATCH (h:InsightHead {group_id: $group_id})
        MATCH (i:Insight {id: h.current_id, status: 'active'})
        WHERE i.content CONTAINS $search_term
        RETURN i
        ORDER BY i.created_at DESC
        LIMIT $limit
      `;
      return await tx.run(query, {
        group_id: GLOBAL_GROUP_ID,
        search_term,
        limit: neo4jInt(limitPerScope),
      });
    });

    globalInsights = globalResult.records.map((record) => {
      const node = record.get("i");
      return neo4jToScopedInsight(node, "global");
    });
  }

  return {
    project_insights: projectInsights,
    global_insights: globalInsights,
    total_count: projectInsights.length + globalInsights.length,
    metadata: {
      project_group_id: params.project_group_id,
      included_global: includeGlobal,
      retrieved_at: new Date(),
      project_count: projectInsights.length,
      global_count: globalInsights.length,
    },
  };
}