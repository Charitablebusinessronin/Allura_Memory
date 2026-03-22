import { readTransaction, type ManagedTransaction } from "../connection";
import type { InsightRecord, InsightStatus } from "./insert-insight";

// Use neo4j.int to create proper integers for Cypher queries
const neo4jInt = (value: number) => {
  // Dynamically import neo4j-driver integer function
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const neo4j = require("neo4j-driver");
  return neo4j.int(value);
};

/**
 * Query parameters for listing insights
 */
export interface InsightQueryParams {
  /** Required: Tenant isolation identifier */
  group_id: string;
  /** Optional: Filter by status */
  status?: InsightStatus;
  /** Optional: Filter by source type */
  source_type?: string;
  /** Optional: Filter by minimum confidence */
  min_confidence?: number;
  /** Optional: Filter by maximum confidence */
  max_confidence?: number;
  /** Optional: Filter by created_at after this date */
  since?: Date;
  /** Optional: Filter by created_at before this date */
  until?: Date;
  /** Optional: Maximum results to return */
  limit?: number;
  /** Optional: Offset for pagination */
  offset?: number;
}

/**
 * Paginated result set
 */
export interface PaginatedInsights {
  items: InsightRecord[];
  total: number;
  limit: number;
  offset: number;
  has_more: boolean;
}

/**
 * Version history entry
 */
export interface VersionHistoryEntry {
  insight: InsightRecord;
  superseded_by: InsightRecord | null;
  supersedes: InsightRecord | null;
}

/**
 * Query error
 */
export class QueryError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "QueryError";
  }
}

/**
 * Validate query parameters
 */
function validateParams(params: InsightQueryParams): void {
  if (!params.group_id || params.group_id.trim().length === 0) {
    throw new QueryError("group_id is required and cannot be empty");
  }

  if (params.limit !== undefined && params.limit < 1) {
    throw new QueryError("limit must be a positive number");
  }

  if (params.offset !== undefined && params.offset < 0) {
    throw new QueryError("offset must be a non-negative number");
  }

  if (params.since && params.until && params.since > params.until) {
    throw new QueryError("since must be before until");
  }

  if (params.min_confidence !== undefined && (params.min_confidence < 0 || params.min_confidence > 1)) {
    throw new QueryError("min_confidence must be between 0 and 1");
  }

  if (params.max_confidence !== undefined && (params.max_confidence < 0 || params.max_confidence > 1)) {
    throw new QueryError("max_confidence must be between 0 and 1");
  }
}

/**
 * Convert Neo4j record to InsightRecord
 */
function neo4jToRecord(node: { properties: Record<string, unknown> } | Record<string, unknown>): InsightRecord {
  // Extract properties from Neo4j node
  const props = ("properties" in node && node.properties) ? node.properties : node;
  
  const convertValue = (val: unknown): unknown => {
    if (val === null || val === undefined) return val;
    // Handle Neo4j Integer
    if (typeof val === "object" && val !== null && "toNumber" in val && typeof (val as { toNumber: () => number }).toNumber === "function") {
      return (val as { toNumber: () => number }).toNumber();
    }
    return val;
  };

  const convertDate = (val: unknown): Date | null => {
    if (val === null || val === undefined) return null;
    // Handle Neo4j DateTime
    if (typeof val === "object" && val !== null) {
      const dateTime = val as { toString?: () => string; year?: { toNumber?: () => number }; month?: { toNumber?: () => number }; day?: { toNumber?: () => number } };
      if (typeof dateTime.toString === "function") {
        return new Date(dateTime.toString());
      }
      // Handle Neo4j Date object
      if (dateTime.year && dateTime.month && dateTime.day) {
        const y = typeof dateTime.year === "object" && "toNumber" in dateTime.year ? dateTime.year.toNumber() : dateTime.year;
        const m = typeof dateTime.month === "object" && "toNumber" in dateTime.month ? dateTime.month.toNumber() : dateTime.month;
        const d = typeof dateTime.day === "object" && "toNumber" in dateTime.day ? dateTime.day.toNumber() : dateTime.day;
        return new Date(y, m - 1, d);
      }
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
    // Neo4j stores maps as objects
    if (typeof val === "object") {
      // Convert any Neo4j integers in the object
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
  };
}

/**
 * Get current (latest active) version of an insight
 * 
 * @param insight_id - The stable insight identifier
 * @param group_id - Tenant identifier
 * @returns The current insight version, or null if not found
 */
export async function getCurrentInsight(
  insight_id: string,
  group_id: string
): Promise<InsightRecord | null> {
  if (!insight_id || insight_id.trim().length === 0) {
    throw new QueryError("insight_id is required");
  }

  if (!group_id || group_id.trim().length === 0) {
    throw new QueryError("group_id is required");
  }

  const result = await readTransaction(async (tx: ManagedTransaction) => {
    const query = `
      MATCH (h:InsightHead {insight_id: $insight_id, group_id: $group_id})
      MATCH (i:Insight {id: h.current_id})
      RETURN i
    `;
    return await tx.run(query, { insight_id, group_id });
  });

  if (result.records.length === 0) {
    return null;
  }

  const node = result.records[0].get("i");
  return neo4jToRecord(node.properties);
}

/**
 * Get a specific version of an insight
 * 
 * @param insight_id - The stable insight identifier
 * @param version - The version number
 * @param group_id - Tenant identifier
 * @returns The specific insight version, or null if not found
 */
export async function getInsightVersion(
  insight_id: string,
  version: number,
  group_id: string
): Promise<InsightRecord | null> {
  if (!insight_id || insight_id.trim().length === 0) {
    throw new QueryError("insight_id is required");
  }

  if (!group_id || group_id.trim().length === 0) {
    throw new QueryError("group_id is required");
  }

  if (version < 1) {
    throw new QueryError("version must be >= 1");
  }

  const result = await readTransaction(async (tx: ManagedTransaction) => {
    const query = `
      MATCH (i:Insight {insight_id: $insight_id, version: $version, group_id: $group_id})
      RETURN i
    `;
    return await tx.run(query, { insight_id, version, group_id });
  });

  if (result.records.length === 0) {
    return null;
  }

  const node = result.records[0].get("i");
  return neo4jToRecord(node.properties);
}

/**
 * Get full version history for an insight
 * 
 * @param insight_id - The stable insight identifier
 * @param group_id - Tenant identifier
 * @returns Array of version history entries, ordered by version descending
 */
export async function getInsightHistory(
  insight_id: string,
  group_id: string
): Promise<VersionHistoryEntry[]> {
  if (!insight_id || insight_id.trim().length === 0) {
    throw new QueryError("insight_id is required");
  }

  if (!group_id || group_id.trim().length === 0) {
    throw new QueryError("group_id is required");
  }

  const result = await readTransaction(async (tx: ManagedTransaction) => {
    const query = `
      MATCH (h:InsightHead {insight_id: $insight_id, group_id: $group_id})
      MATCH (i:Insight)-[:VERSION_OF]->(h)
      OPTIONAL MATCH (i)-[:SUPERSEDES]->(prev:Insight)
      OPTIONAL MATCH (next:Insight)-[:SUPERSEDES]->(i)
      RETURN i, prev, next
      ORDER BY i.version DESC
    `;
    return await tx.run(query, { insight_id, group_id });
  });

  return result.records.map((record) => {
    const insightNode = record.get("i");
    const insight = neo4jToRecord(insightNode.properties);
    
    const prevObj = record.get("prev");
    const nextObj = record.get("next");

    const superseded_by = nextObj && nextObj.properties ? neo4jToRecord(nextObj.properties) : null;
    const supersedes = prevObj && prevObj.properties ? neo4jToRecord(prevObj.properties) : null;

    return {
      insight,
      superseded_by,
      supersedes,
    };
  });
}

/**
 * List all current active insights for a group
 * 
 * @param params - Query parameters
 * @returns Paginated list of insights
 */
export async function listInsights(params: InsightQueryParams): Promise<PaginatedInsights> {
  validateParams(params);

  const limit = params.limit ?? 100;
  const offset = params.offset ?? 0;

  // Build WHERE clauses
  const whereClauses: string[] = ["h.group_id = $group_id"];
  const queryParams: Record<string, unknown> = {
    group_id: params.group_id,
    limit: neo4jInt(limit),
    offset: neo4jInt(offset),
  };

  if (params.status) {
    whereClauses.push("i.status = $status");
    queryParams.status = params.status;
  }

  if (params.source_type) {
    whereClauses.push("i.source_type = $source_type");
    queryParams.source_type = params.source_type;
  }

  if (params.min_confidence !== undefined) {
    whereClauses.push("i.confidence >= $min_confidence");
    queryParams.min_confidence = params.min_confidence;
  }

  if (params.max_confidence !== undefined) {
    whereClauses.push("i.confidence <= $max_confidence");
    queryParams.max_confidence = params.max_confidence;
  }

  if (params.since) {
    whereClauses.push("i.created_at >= datetime($since)");
    queryParams.since = params.since.toISOString();
  }

  if (params.until) {
    whereClauses.push("i.created_at <= datetime($until)");
    queryParams.until = params.until.toISOString();
  }

  const whereClause = whereClauses.join(" AND ");

  const countResult = await readTransaction(async (tx: ManagedTransaction) => {
    const query = `
      MATCH (h:InsightHead {group_id: $group_id})
      MATCH (i:Insight {id: h.current_id})
      WHERE 1=1 ${params.status ? " AND i.status = $status" : ""}
        ${params.source_type ? " AND i.source_type = $source_type" : ""}
        ${params.min_confidence !== undefined ? " AND i.confidence >= $min_confidence" : ""}
        ${params.max_confidence !== undefined ? " AND i.confidence <= $max_confidence" : ""}
        ${params.since ? " AND i.created_at >= datetime($since)" : ""}
        ${params.until ? " AND i.created_at <= datetime($until)" : ""}
      RETURN COUNT(i) as total
    `;
    return await tx.run(query, queryParams);
  });

  const total = typeof countResult.records[0].get("total") === "object" &&
    "toNumber" in (countResult.records[0].get("total") as object)
    ? (countResult.records[0].get("total") as { toNumber: () => number }).toNumber()
    : (countResult.records[0].get("total") as number);

  const dataResult = await readTransaction(async (tx: ManagedTransaction) => {
    const query = `
      MATCH (h:InsightHead {group_id: $group_id})
      MATCH (i:Insight {id: h.current_id})
      WHERE 1=1 ${params.status ? " AND i.status = $status" : ""}
        ${params.source_type ? " AND i.source_type = $source_type" : ""}
        ${params.min_confidence !== undefined ? " AND i.confidence >= $min_confidence" : ""}
        ${params.max_confidence !== undefined ? " AND i.confidence <= $max_confidence" : ""}
        ${params.since ? " AND i.created_at >= datetime($since)" : ""}
        ${params.until ? " AND i.created_at <= datetime($until)" : ""}
      RETURN i
      ORDER BY i.created_at DESC
      SKIP $offset
      LIMIT $limit
    `;
    return await tx.run(query, queryParams);
  });

  const items = dataResult.records.map((record) => {
    const node = record.get("i");
    return neo4jToRecord(node.properties);
  });

  return {
    items,
    total,
    limit,
    offset,
    has_more: offset + items.length < total,
  };
}

/**
 * Search insights by content
 * 
 * @param search_term - Text to search for in content
 * @param params - Query parameters (group_id required)
 * @returns Matching insights
 */
export async function searchInsights(
  search_term: string,
  params: InsightQueryParams
): Promise<PaginatedInsights> {
  validateParams(params);

  if (!search_term || search_term.trim().length === 0) {
    throw new QueryError("search_term is required and cannot be empty");
  }

  const limit = params.limit ?? 100;
  const offset = params.offset ?? 0;

  const result = await readTransaction(async (tx: ManagedTransaction) => {
    const query = `
      MATCH (h:InsightHead {group_id: $group_id})
      MATCH (i:Insight {id: h.current_id, status: 'active'})
      WHERE i.content CONTAINS $search_term
      RETURN i
      ORDER BY i.created_at DESC
      SKIP $offset
      LIMIT $limit
    `;
    return await tx.run(query, {
      group_id: params.group_id,
      search_term,
      limit: neo4jInt(limit),
      offset: neo4jInt(offset),
    });
  });

  // For simplicity, we don't do a separate count query for search
  // In production, you'd want to use a proper search index
  const items = result.records.map((record) => {
    const node = record.get("i");
    return neo4jToRecord(node.properties);
  });

  return {
    items,
    total: items.length,
    limit,
    offset,
    has_more: false,
  };
}

/**
 * Get insight by ID
 * 
 * @param id - The insight's unique ID (not insight_id)
 * @param group_id - Tenant identifier
 * @returns The insight, or null if not found
 */
export async function getInsightById(
  id: string,
  group_id: string
): Promise<InsightRecord | null> {
  if (!id || id.trim().length === 0) {
    throw new QueryError("id is required");
  }

  if (!group_id || group_id.trim().length === 0) {
    throw new QueryError("group_id is required");
  }

  const result = await readTransaction(async (tx: ManagedTransaction) => {
    const query = `
      MATCH (i:Insight {id: $id, group_id: $group_id})
      RETURN i
    `;
    return await tx.run(query, { id, group_id });
  });

  if (result.records.length === 0) {
    return null;
  }

  const node = result.records[0].get("i");
  return neo4jToRecord(node.properties);
}

/**
 * Get count of active insights for a group
 * 
 * @param group_id - Tenant identifier
 * @returns Count of active insights
 */
export async function getActiveInsightCount(group_id: string): Promise<number> {
  const result = await readTransaction(async (tx: ManagedTransaction) => {
    const query = `
      MATCH (h:InsightHead {group_id: $group_id})
      MATCH (i:Insight {id: h.current_id, status: 'active'})
      RETURN COUNT(i) as count
    `;
    return await tx.run(query, { group_id });
  });

  const count = result.records[0].get("count");
  return typeof count === "object" && "toNumber" in count
    ? (count as { toNumber: () => number }).toNumber()
    : (count as number);
}