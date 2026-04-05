/**
 * CONTRIBUTED Relationship - Agent Knowledge Contributions
 * 
 * Tracks agent contributions to the knowledge graph.
 * Relationship: (Agent)-[:CONTRIBUTED {timestamp, confidence, action}]->(Insight)
 * 
 * **Tenant Isolation**: All operations require `group_id` for multi-tenant safety.
 * **Audit Trail**: All operations logged to PostgreSQL events table.
 */

import { writeTransaction, readTransaction, type ManagedTransaction } from "../../neo4j/connection";
import { insertEvent } from "../../postgres/queries/insert-trace";

// Server-only guard: throw if imported in browser environment
if (typeof window !== "undefined") {
  throw new Error("CONTRIBUTED relationship module can only be used server-side");
}

/**
 * Relationship type for tracking agent contributions
 */
export type RelationshipType = "CONTRIBUTED";

/**
 * Action types for contributions
 */
export type ContributionAction = "created" | "modified" | "validated";

/**
 * Insight node - represents knowledge in the graph
 */
export interface InsightNode {
  /** Unique insight identifier */
  id: string;
  /** Topic key for categorization */
  topic_key: string;
  /** Tenant isolation identifier */
  group_id: string;
  /** Insight title */
  title?: string;
  /** Insight summary */
  summary?: string;
  /** Insight content */
  content: string;
  /** Confidence score (0.0 to 1.0) */
  confidence: number;
  /** Current status */
  status: "draft" | "testing" | "active" | "deprecated" | "archived";
  /** Creation timestamp */
  created_at: Date;
  /** Last update timestamp */
  updated_at: Date;
  /** Version number */
  version: number;
  /** Additional metadata */
  metadata?: Record<string, unknown>;
}

/**
 * CONTRIBUTED relationship - connects an agent to an insight they contributed to
 */
export interface ContributedRelationship {
  /** Agent that contributed */
  agent_id: string;
  /** Insight they contributed to */
  insight_id: string;
  /** Tenant isolation identifier */
  group_id: string;
  /** When the contribution occurred */
  timestamp: Date;
  /** Confidence score of the contribution (0.0 to 1.0) */
  confidence: number;
  /** Action type (created, modified, validated) */
  action: ContributionAction;
  /** Additional properties */
  metadata?: Record<string, unknown>;
}

/**
 * Parameters for creating a CONTRIBUTED relationship
 */
export interface CreateContributedParams {
  /** Required: Agent identifier */
  agent_id: string;
  /** Required: Insight identifier */
  insight_id: string;
  /** Required: Tenant isolation identifier */
  group_id: string;
  /** Required: Confidence score (0.0 to 1.0) */
  confidence: number;
  /** Required: Action type */
  action: ContributionAction;
  /** Optional: Additional metadata */
  metadata?: Record<string, unknown>;
}

/**
 * Parameters for querying agent contributions
 */
export interface GetAgentContributionsParams {
  /** Required: Agent identifier */
  agent_id: string;
  /** Required: Tenant isolation identifier */
  group_id: string;
  /** Optional: Time range filter */
  timeRange?: { start: Date; end: Date };
  /** Optional: Maximum number of insights to return */
  limit?: number;
  /** Optional: Minimum confidence filter */
  minConfidence?: number;
  /** Optional: Filter by action type */
  actionFilter?: ContributionAction;
}

/**
 * Validation error for invalid relationship data
 */
export class ContributedValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ContributedValidationError";
  }
}

/**
 * Query error for invalid query parameters
 */
export class ContributedQueryError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ContributedQueryError";
  }
}

/**
 * Validate parameters for creating a CONTRIBUTED relationship
 */
function validateCreateContributedParams(params: CreateContributedParams): void {
  const errors: string[] = [];

  if (!params.agent_id || params.agent_id.trim().length === 0) {
    errors.push("agent_id is required and cannot be empty");
  }

  if (!params.insight_id || params.insight_id.trim().length === 0) {
    errors.push("insight_id is required and cannot be empty");
  }

  if (!params.group_id || params.group_id.trim().length === 0) {
    errors.push("group_id is required and cannot be empty");
  }

  // Enforce allura-* naming convention
  if (params.group_id && !params.group_id.startsWith("allura-")) {
    errors.push(`group_id must use allura-* format (found: ${params.group_id})`);
  }

  if (typeof params.confidence !== "number" || isNaN(params.confidence)) {
    errors.push("confidence must be a number");
  } else if (params.confidence < 0 || params.confidence > 1) {
    errors.push("confidence must be between 0.0 and 1.0 (inclusive)");
  }

  const validActions: ContributionAction[] = ["created", "modified", "validated"];
  if (!validActions.includes(params.action)) {
    errors.push(`action must be one of: ${validActions.join(", ")} (got '${params.action}')`);
  }

  if (errors.length > 0) {
    throw new ContributedValidationError(`CONTRIBUTED relationship validation failed: ${errors.join("; ")}`);
  }
}

/**
 * Validate query parameters for getAgentContributions
 */
function validateGetAgentContributionsParams(params: GetAgentContributionsParams): void {
  const errors: string[] = [];

  if (!params.agent_id || params.agent_id.trim().length === 0) {
    errors.push("agent_id is required and cannot be empty");
  }

  if (!params.group_id || params.group_id.trim().length === 0) {
    errors.push("group_id is required and cannot be empty");
  }

  // Enforce allura-* naming convention
  if (params.group_id && !params.group_id.startsWith("allura-")) {
    errors.push(`group_id must use allura-* format (found: ${params.group_id})`);
  }

  if (params.limit !== undefined && params.limit < 0) {
    errors.push("limit must be a positive number");
  }

  if (params.minConfidence !== undefined && (params.minConfidence < 0 || params.minConfidence > 1)) {
    errors.push("minConfidence must be between 0.0 and 1.0");
  }

  if (params.timeRange) {
    if (params.timeRange.start > params.timeRange.end) {
      errors.push("timeRange.start must be before timeRange.end");
    }
  }

  if (errors.length > 0) {
    throw new ContributedQueryError(`Query validation failed: ${errors.join("; ")}`);
  }
}

/**
 * Convert Neo4j record to InsightNode
 */
function neo4jToInsightNode(record: Record<string, unknown>): InsightNode {
  const props = record.properties || record;

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
    if (typeof val === "object" && val !== null) {
      const dateTime = val as { toString?: () => string };
      if (typeof dateTime.toString === "function") {
        return new Date(dateTime.toString());
      }
    }
    return new Date(val as string);
  };

  const convertMetadata = (val: unknown): Record<string, unknown> | undefined => {
    if (val === null || val === undefined) return undefined;
    if (typeof val === "string") {
      try {
        return JSON.parse(val);
      } catch {
        return undefined;
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
    return undefined;
  };

  const p = props as {
    id: unknown;
    topic_key: unknown;
    group_id: unknown;
    title: unknown;
    summary: unknown;
    content: unknown;
    confidence: unknown;
    status: unknown;
    created_at: unknown;
    updated_at: unknown;
    version: unknown;
    metadata: unknown;
  };

  return {
    id: p.id as string,
    topic_key: p.topic_key as string,
    group_id: p.group_id as string,
    title: p.title as string | undefined,
    summary: p.summary as string | undefined,
    content: p.content as string,
    confidence: typeof p.confidence === "object" && p.confidence !== null && "toNumber" in p.confidence
      ? (p.confidence as { toNumber: () => number }).toNumber()
      : (p.confidence as number),
    status: p.status as "draft" | "testing" | "active" | "deprecated" | "archived",
    created_at: convertDate(p.created_at) as Date,
    updated_at: convertDate(p.updated_at) as Date,
    version: typeof p.version === "object" && p.version !== null && "toNumber" in p.version
      ? (p.version as { toNumber: () => number }).toNumber()
      : (p.version as number),
    metadata: convertMetadata(p.metadata),
  };
}

/**
 * Create a CONTRIBUTED relationship between an agent and an insight
 * 
 * Tracks agent contributions to the knowledge graph with confidence scoring.
 * Logs the operation to PostgreSQL for audit trail.
 * 
 * @param params - Relationship creation parameters
 * @returns The created relationship
 * @throws ContributedValidationError if validation fails
 */
export async function createContributedRelationship(
  params: CreateContributedParams
): Promise<ContributedRelationship> {
  validateCreateContributedParams(params);

  const { agent_id, insight_id, group_id, confidence, action, metadata } = params;

  const result = await writeTransaction(async (tx: ManagedTransaction) => {
    // Ensure agent exists
    const agentCheck = await tx.run(
      `MATCH (a:Agent {agent_id: $agent_id, group_id: $group_id}) RETURN a`,
      { agent_id, group_id }
    );

    if (agentCheck.records.length === 0) {
      throw new ContributedValidationError(
        `Agent '${agent_id}' not found in group '${group_id}'. Create agent first.`
      );
    }

    // Ensure insight exists (or create if needed)
    const insightCheck = await tx.run(
      `MATCH (i:Insight {id: $insight_id, group_id: $group_id}) RETURN i`,
      { insight_id, group_id }
    );

    if (insightCheck.records.length === 0) {
      // Create insight node if it doesn't exist
      await tx.run(
        `CREATE (i:Insight {
          id: $insight_id,
          topic_key: $topic_key,
          group_id: $group_id,
          confidence: $confidence,
          status: 'draft',
          version: 1,
          created_at: datetime(),
          updated_at: datetime(),
          metadata: $metadata
        })`,
        {
          insight_id,
          topic_key: `insight.${insight_id}`,
          group_id,
          confidence,
          metadata: JSON.stringify(metadata || {}),
        }
      );
    }

    // Create CONTRIBUTED relationship (use MERGE to avoid duplicates)
    const query = `
      MATCH (a:Agent {agent_id: $agent_id, group_id: $group_id})
      MATCH (i:Insight {id: $insight_id, group_id: $group_id})
      MERGE (a)-[r:CONTRIBUTED {
        group_id: $group_id
      }]->(i)
      SET r.timestamp = datetime(),
          r.confidence = $confidence,
          r.action = $action,
          r.metadata = $metadata
      RETURN r
    `;

    const queryResult = await tx.run(query, {
      agent_id,
      insight_id,
      group_id,
      confidence,
      action,
      metadata: JSON.stringify(metadata || {}),
    });

    // Increment contribution_count on agent
    await tx.run(
      `MATCH (a:Agent {agent_id: $agent_id, group_id: $group_id})
       SET a.contribution_count = coalesce(a.contribution_count, 0) + 1,
           a.last_active = datetime()`,
      { agent_id, group_id }
    );

    return queryResult;
  });

  // Extract relationship properties
  const relationship = result.records[0].get("r");
  const relProps = relationship.properties;

  // Log to PostgreSQL
  try {
    await insertEvent({
      group_id,
      agent_id,
      event_type: "relationship.contributed.created",
      workflow_id: "memory-relationship",
      metadata: {
        relationship_type: "CONTRIBUTED",
        insight_id,
        confidence,
        action,
      },
      outcome: { status: "success" },
    });
  } catch (error) {
    console.error("[CONTRIBUTED Relationship] Failed to log to PostgreSQL:", error);
    // Don't fail the operation if logging fails
  }

  return {
    agent_id,
    insight_id,
    group_id,
    timestamp: new Date(relProps.timestamp.toString()),
    confidence: relProps.confidence as number,
    action: relProps.action as ContributionAction,
    metadata: metadata,
  };
}

/**
 * Get insights an agent has contributed to
 * 
 * Queries the CONTRIBUTED relationships for an agent, returning insights
 * ordered by confidence and timestamp.
 * 
 * @param params - Query parameters
 * @returns Array of insights the agent has contributed to
 * @throws ContributedQueryError if validation fails
 */
export async function getAgentContributions(
  params: GetAgentContributionsParams
): Promise<InsightNode[]> {
  validateGetAgentContributionsParams(params);

  const { agent_id, group_id, limit = 10, minConfidence, actionFilter, timeRange } = params;

  const result = await readTransaction(async (tx: ManagedTransaction) => {
    // Build WHERE clause with filters
    const conditions: string[] = [
      "a.agent_id = $agent_id",
      "a.group_id = $group_id",
    ];

    if (minConfidence !== undefined) {
      conditions.push("r.confidence >= $minConfidence");
    }

    if (actionFilter) {
      conditions.push("r.action = $actionFilter");
    }

    if (timeRange) {
      conditions.push("r.timestamp >= $start_time AND r.timestamp <= $end_time");
    }

    const whereClause = conditions.join(" AND ");

    const query = `
      MATCH (a:Agent)-[r:CONTRIBUTED]->(i:Insight)
      WHERE ${whereClause}
      RETURN i, r.confidence AS confidence, r.timestamp AS contributed_at, r.action AS action
      ORDER BY r.confidence DESC, r.timestamp DESC
      LIMIT $limit
    `;

    const queryParams: Record<string, unknown> = {
      agent_id,
      group_id,
      limit,
      minConfidence,
      actionFilter,
      start_time: timeRange?.start?.toISOString(),
      end_time: timeRange?.end?.toISOString(),
    };

    return await tx.run(query, queryParams);
  });

  return result.records.map((record) => {
    const insightNode = neo4jToInsightNode(record.get("i").properties);
    return insightNode;
  });
}

/**
 * Get all agents that contributed to a specific insight
 * 
 * Useful for attribution and collaboration tracking.
 * 
 * @param insight_id - Insight identifier
 * @param group_id - Tenant isolation identifier
 * @returns Array of agent IDs that contributed to this insight
 */
export async function getInsightContributors(
  insight_id: string,
  group_id: string
): Promise<Array<{ agent_id: string; confidence: number; action: ContributionAction; contributed_at: Date }>> {
  if (!insight_id || !group_id) {
    throw new ContributedQueryError("insight_id and group_id are required");
  }

  // Enforce allura-* naming
  if (!group_id.startsWith("allura-")) {
    throw new ContributedQueryError(`group_id must use allura-* format (found: ${group_id})`);
  }

  const result = await readTransaction(async (tx: ManagedTransaction) => {
    const query = `
      MATCH (a:Agent)-[r:CONTRIBUTED]->(i:Insight {id: $insight_id, group_id: $group_id})
      RETURN a.agent_id AS agent_id, r.confidence AS confidence, r.action AS action, r.timestamp AS contributed_at
      ORDER BY r.confidence DESC
    `;

    return await tx.run(query, { insight_id, group_id });
  });

  return result.records.map((record) => ({
    agent_id: record.get("agent_id") as string,
    confidence: record.get("confidence") as number,
    action: record.get("action") as ContributionAction,
    contributed_at: new Date(record.get("contributed_at").toString()),
  }));
}

/**
 * Delete a CONTRIBUTED relationship
 * 
 * @param agent_id - Agent identifier
 * @param insight_id - Insight identifier
 * @param group_id - Tenant isolation identifier
 * @returns True if relationship was deleted, false if not found
 */
export async function deleteContributedRelationship(
  agent_id: string,
  insight_id: string,
  group_id: string
): Promise<boolean> {
  if (!agent_id || !insight_id || !group_id) {
    throw new ContributedQueryError("agent_id, insight_id, and group_id are required");
  }

  // Enforce allura-* naming
  if (!group_id.startsWith("allura-")) {
    throw new ContributedQueryError(`group_id must use allura-* format (found: ${group_id})`);
  }

  const result = await writeTransaction(async (tx: ManagedTransaction) => {
    const query = `
      MATCH (a:Agent {agent_id: $agent_id, group_id: $group_id})-[r:CONTRIBUTED]->(i:Insight {id: $insight_id, group_id: $group_id})
      DELETE r
      RETURN count(r) AS deleted_count
    `;

    const queryResult = await tx.run(query, { agent_id, insight_id, group_id });
    return queryResult;
  });

  const deletedCount = result.records[0]?.get("deleted_count");

  // Log to PostgreSQL
  try {
    await insertEvent({
      group_id,
      agent_id,
      event_type: "relationship.contributed.deleted",
      workflow_id: "memory-relationship",
      metadata: {
        relationship_type: "CONTRIBUTED",
        insight_id,
      },
      outcome: { status: "success", deleted: deletedCount?.toNumber?.() ?? 0 },
    });
  } catch (error) {
    console.error("[CONTRIBUTED Relationship] Failed to log deletion to PostgreSQL:", error);
  }

  return deletedCount?.toNumber?.() > 0 ?? false;
}

/**
 * Count contributions for an agent
 * 
 * @param agent_id - Agent identifier
 * @param group_id - Tenant isolation identifier
 * @returns Number of insights the agent has contributed to
 */
export async function countAgentContributions(
  agent_id: string,
  group_id: string
): Promise<number> {
  if (!agent_id || !group_id) {
    throw new ContributedQueryError("agent_id and group_id are required");
  }

  // Enforce allura-* naming
  if (!group_id.startsWith("allura-")) {
    throw new ContributedQueryError(`group_id must use allura-* format (found: ${group_id})`);
  }

  const result = await readTransaction(async (tx: ManagedTransaction) => {
    const query = `
      MATCH (a:Agent {agent_id: $agent_id, group_id: $group_id})-[r:CONTRIBUTED]->(i:Insight)
      RETURN count(r) AS contribution_count
    `;

    return await tx.run(query, { agent_id, group_id });
  });

  const countValue = result.records[0]?.get("contribution_count");
  return countValue?.toNumber?.() ?? 0;
}

/**
 * Get contribution statistics for an agent
 * 
 * @param agent_id - Agent identifier
 * @param group_id - Tenant isolation identifier
 * @returns Statistics about agent contributions
 */
export async function getAgentContributionStats(
  agent_id: string,
  group_id: string
): Promise<{
  total: number;
  created: number;
  modified: number;
  validated: number;
  avg_confidence: number;
}> {
  if (!agent_id || !group_id) {
    throw new ContributedQueryError("agent_id and group_id are required");
  }

  // Enforce allura-* naming
  if (!group_id.startsWith("allura-")) {
    throw new ContributedQueryError(`group_id must use allura-* format (found: ${group_id})`);
  }

  const result = await readTransaction(async (tx: ManagedTransaction) => {
    const query = `
      MATCH (a:Agent {agent_id: $agent_id, group_id: $group_id})-[r:CONTRIBUTED]->(i:Insight)
      RETURN 
        count(r) AS total,
        sum(CASE WHEN r.action = 'created' THEN 1 ELSE 0 END) AS created,
        sum(CASE WHEN r.action = 'modified' THEN 1 ELSE 0 END) AS modified,
        sum(CASE WHEN r.action = 'validated' THEN 1 ELSE 0 END) AS validated,
        avg(r.confidence) AS avg_confidence
    `;

    return await tx.run(query, { agent_id, group_id });
  });

  const record = result.records[0];

  return {
    total: record.get("total")?.toNumber?.() ?? 0,
    created: record.get("created")?.toNumber?.() ?? 0,
    modified: record.get("modified")?.toNumber?.() ?? 0,
    validated: record.get("validated")?.toNumber?.() ?? 0,
    avg_confidence: record.get("avg_confidence") ?? 0,
  };
}