/**
 * LEARNED Relationship - Agent Session Learning
 * 
 * Tracks what agents learn during execution sessions.
 * Relationship: (Agent)-[:LEARNED {timestamp, relevance_score}]->(Session)
 * 
 * **Tenant Isolation**: All operations require `group_id` for multi-tenant safety.
 * **Audit Trail**: All operations logged to PostgreSQL events table.
 */

import { writeTransaction, readTransaction, type ManagedTransaction } from "../../neo4j/connection";
import { insertEvent } from "../../postgres/queries/insert-trace";

// Server-only guard: throw if imported in browser environment
if (typeof window !== "undefined") {
  throw new Error("LEARNED relationship module can only be used server-side");
}

/**
 * Relationship type for tracking agent learning
 */
export type RelationshipType = "LEARNED";

/**
 * Session node - represents an agent execution session
 */
export interface SessionNode {
  /** Unique session identifier */
  id: string;
  /** Session identifier for reference */
  session_id: string;
  /** Agent that executed this session */
  agent_id: string;
  /** Tenant isolation identifier */
  group_id: string;
  /** Workflow this session belongs to */
  workflow_id?: string;
  /** Session start timestamp */
  started_at: Date;
  /** Session end timestamp */
  ended_at?: Date;
  /** Session status */
  status: "active" | "completed" | "failed" | "cancelled";
  /** Learning summary */
  summary?: string;
  /** Additional metadata */
  metadata: Record<string, unknown>;
}

/**
 * LEARNED relationship - connects an agent to a session they learned from
 */
export interface LearnedRelationship {
  /** Agent that learned */
  agent_id: string;
  /** Session they learned from */
  session_id: string;
  /** Tenant isolation identifier */
  group_id: string;
  /** When the learning occurred */
  timestamp: Date;
  /** Relevance score of what was learned (0.0 to 1.0) */
  relevance_score: number;
  /** What was learned */
  learning_summary?: string;
  /** Additional properties */
  metadata?: Record<string, unknown>;
}

/**
 * Parameters for creating a LEARNED relationship
 */
export interface CreateLearnedParams {
  /** Required: Agent identifier */
  agent_id: string;
  /** Required: Session identifier */
  session_id: string;
  /** Required: Tenant isolation identifier */
  group_id: string;
  /** Required: Relevance score (0.0 to 1.0) */
  relevance_score: number;
  /** Optional: What was learned */
  learning_summary?: string;
  /** Optional: Additional metadata */
  metadata?: Record<string, unknown>;
}

/**
 * Parameters for querying agent learnings
 */
export interface GetAgentLearningsParams {
  /** Required: Agent identifier */
  agent_id: string;
  /** Required: Tenant isolation identifier */
  group_id: string;
  /** Optional: Maximum number of sessions to return */
  session_limit?: number;
  /** Optional: Minimum relevance score filter */
  min_relevance?: number;
  /** Optional: Filter by workflow */
  workflow_id?: string;
}

/**
 * Validation error for invalid relationship data
 */
export class LearnedValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "LearnedValidationError";
  }
}

/**
 * Query error for invalid query parameters
 */
export class LearnedQueryError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "LearnedQueryError";
  }
}

/**
 * Validate parameters for creating a LEARNED relationship
 */
function validateCreateLearnedParams(params: CreateLearnedParams): void {
  const errors: string[] = [];

  if (!params.agent_id || params.agent_id.trim().length === 0) {
    errors.push("agent_id is required and cannot be empty");
  }

  if (!params.session_id || params.session_id.trim().length === 0) {
    errors.push("session_id is required and cannot be empty");
  }

  if (!params.group_id || params.group_id.trim().length === 0) {
    errors.push("group_id is required and cannot be empty");
  }

  // Enforce allura-* naming convention
  if (params.group_id && !params.group_id.startsWith("allura-")) {
    errors.push(`group_id must use allura-* format (found: ${params.group_id})`);
  }

  if (typeof params.relevance_score !== "number" || isNaN(params.relevance_score)) {
    errors.push("relevance_score must be a number");
  } else if (params.relevance_score < 0 || params.relevance_score > 1) {
    errors.push("relevance_score must be between 0.0 and 1.0 (inclusive)");
  }

  if (errors.length > 0) {
    throw new LearnedValidationError(`LEARNED relationship validation failed: ${errors.join("; ")}`);
  }
}

/**
 * Validate query parameters for getAgentLearnings
 */
function validateGetAgentLearningsParams(params: GetAgentLearningsParams): void {
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

  if (params.session_limit !== undefined && params.session_limit < 0) {
    errors.push("session_limit must be a positive number");
  }

  if (params.min_relevance !== undefined && (params.min_relevance < 0 || params.min_relevance > 1)) {
    errors.push("min_relevance must be between 0.0 and 1.0");
  }

  if (errors.length > 0) {
    throw new LearnedQueryError(`Query validation failed: ${errors.join("; ")}`);
  }
}

/**
 * Convert Neo4j record to SessionNode
 */
function neo4jToSessionNode(record: Record<string, unknown>): SessionNode {
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

  const p = props as {
    id: unknown;
    session_id: unknown;
    agent_id: unknown;
    group_id: unknown;
    workflow_id: unknown;
    started_at: unknown;
    ended_at: unknown;
    status: unknown;
    summary: unknown;
    metadata: unknown;
  };

  return {
    id: p.id as string,
    session_id: p.session_id as string,
    agent_id: p.agent_id as string,
    group_id: p.group_id as string,
    workflow_id: p.workflow_id as string | undefined,
    started_at: convertDate(p.started_at) as Date,
    ended_at: convertDate(p.ended_at) ?? undefined,
    status: p.status as "active" | "completed" | "failed" | "cancelled",
    summary: p.summary as string | undefined,
    metadata: convertMetadata(p.metadata),
  };
}

/**
 * Create a LEARNED relationship between an agent and a session
 * 
 * Tracks what an agent learned during a session with relevance scoring.
 * Logs the operation to PostgreSQL for audit trail.
 * 
 * @param params - Relationship creation parameters
 * @returns The created relationship
 * @throws LearnedValidationError if validation fails
 */
export async function createLearnedRelationship(
  params: CreateLearnedParams
): Promise<LearnedRelationship> {
  validateCreateLearnedParams(params);

  const { agent_id, session_id, group_id, relevance_score, learning_summary, metadata } = params;

  const result = await writeTransaction(async (tx: ManagedTransaction) => {
    // Ensure agent exists
    const agentCheck = await tx.run(
      `MATCH (a:Agent {agent_id: $agent_id, group_id: $group_id}) RETURN a`,
      { agent_id, group_id }
    );

    if (agentCheck.records.length === 0) {
      throw new LearnedValidationError(
        `Agent '${agent_id}' not found in group '${group_id}'. Create agent first.`
      );
    }

    // Ensure session exists (or create if needed)
    const sessionCheck = await tx.run(
      `MATCH (s:Session {session_id: $session_id, group_id: $group_id}) RETURN s`,
      { session_id, group_id }
    );

    if (sessionCheck.records.length === 0) {
      // Create session node if it doesn't exist
      await tx.run(
        `CREATE (s:Session {
          id: randomUUID(),
          session_id: $session_id,
          agent_id: $agent_id,
          group_id: $group_id,
          started_at: datetime(),
          status: 'active',
          metadata: $metadata
        })`,
        {
          session_id,
          agent_id,
          group_id,
          metadata: JSON.stringify(metadata || {}),
        }
      );
    }

    // Create LEARNED relationship (use MERGE to avoid duplicates)
    const query = `
      MATCH (a:Agent {agent_id: $agent_id, group_id: $group_id})
      MATCH (s:Session {session_id: $session_id, group_id: $group_id})
      MERGE (a)-[r:LEARNED {
        group_id: $group_id
      }]->(s)
      SET r.timestamp = datetime(),
          r.relevance_score = $relevance_score,
          r.learning_summary = $learning_summary,
          r.metadata = $metadata
      RETURN r
    `;

    const queryResult = await tx.run(query, {
      agent_id,
      session_id,
      group_id,
      relevance_score,
      learning_summary: learning_summary || null,
      metadata: JSON.stringify(metadata || {}),
    });

    // Increment learning_count on agent
    await tx.run(
      `MATCH (a:Agent {agent_id: $agent_id, group_id: $group_id})
       SET a.learning_count = a.learning_count + 1,
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
      event_type: "relationship.learned.created",
      workflow_id: "memory-relationship",
      metadata: {
        relationship_type: "LEARNED",
        session_id,
        relevance_score,
        learning_summary: learning_summary || null,
      },
      outcome: { status: "success" },
    });
  } catch (error) {
    console.error("[LEARNED Relationship] Failed to log to PostgreSQL:", error);
    // Don't fail the operation if logging fails
  }

  return {
    agent_id,
    session_id,
    group_id,
    timestamp: new Date(relProps.timestamp.toString()),
    relevance_score: relProps.relevance_score as number,
    learning_summary: relProps.learning_summary as string | undefined,
    metadata: metadata,
  };
}

/**
 * Get sessions an agent has learned from
 * 
 * Queries the LEARNED relationships for an agent, returning sessions
 * ordered by relevance score and timestamp.
 * 
 * @param params - Query parameters
 * @returns Array of sessions the agent has learned from
 * @throws LearnedQueryError if validation fails
 */
export async function getAgentLearnings(
  params: GetAgentLearningsParams
): Promise<SessionNode[]> {
  validateGetAgentLearningsParams(params);

  const { agent_id, group_id, session_limit = 10, min_relevance, workflow_id } = params;

  const result = await readTransaction(async (tx: ManagedTransaction) => {
    // Build WHERE clause with filters
    const conditions: string[] = [
      "a.agent_id = $agent_id",
      "a.group_id = $group_id",
    ];

    if (min_relevance !== undefined) {
      conditions.push("r.relevance_score >= $min_relevance");
    }

    const whereClause = conditions.join(" AND ");

    // Build optional workflow filter
    const workflowFilter = workflow_id ? "AND s.workflow_id = $workflow_id" : "";

    const query = `
      MATCH (a:Agent)-[r:LEARNED]->(s:Session)
      WHERE ${whereClause}
      ${workflowFilter}
      RETURN s, r.relevance_score AS relevance_score, r.timestamp AS learned_at
      ORDER BY r.relevance_score DESC, r.timestamp DESC
      LIMIT $limit
    `;

    const queryParams: Record<string, unknown> = {
      agent_id,
      group_id,
      limit: session_limit,
      min_relevance,
      workflow_id,
    };

    return await tx.run(query, queryParams);
  });

  return result.records.map((record) => {
    const sessionNode = neo4jToSessionNode(record.get("s").properties);
    return sessionNode;
  });
}

/**
 * Get all agents that learned from a specific session
 * 
 * Useful for collaboration tracking and knowledge handoff.
 * 
 * @param session_id - Session identifier
 * @param group_id - Tenant isolation identifier
 * @returns Array of agent IDs that learned from this session
 */
export async function getSessionLearners(
  session_id: string,
  group_id: string
): Promise<Array<{ agent_id: string; relevance_score: number; learned_at: Date }>> {
  if (!session_id || !group_id) {
    throw new LearnedQueryError("session_id and group_id are required");
  }

  // Enforce allura-* naming
  if (!group_id.startsWith("allura-")) {
    throw new LearnedQueryError(`group_id must use allura-* format (found: ${group_id})`);
  }

  const result = await readTransaction(async (tx: ManagedTransaction) => {
    const query = `
      MATCH (a:Agent)-[r:LEARNED]->(s:Session {session_id: $session_id, group_id: $group_id})
      RETURN a.agent_id AS agent_id, r.relevance_score AS relevance_score, r.timestamp AS learned_at
      ORDER BY r.relevance_score DESC
    `;

    return await tx.run(query, { session_id, group_id });
  });

  return result.records.map((record) => ({
    agent_id: record.get("agent_id") as string,
    relevance_score: record.get("relevance_score") as number,
    learned_at: new Date(record.get("learned_at").toString()),
  }));
}

/**
 * Delete a LEARNED relationship
 * 
 * @param agent_id - Agent identifier
 * @param session_id - Session identifier
 * @param group_id - Tenant isolation identifier
 * @returns True if relationship was deleted, false if not found
 */
export async function deleteLearnedRelationship(
  agent_id: string,
  session_id: string,
  group_id: string
): Promise<boolean> {
  if (!agent_id || !session_id || !group_id) {
    throw new LearnedQueryError("agent_id, session_id, and group_id are required");
  }

  // Enforce allura-* naming
  if (!group_id.startsWith("allura-")) {
    throw new LearnedQueryError(`group_id must use allura-* format (found: ${group_id})`);
  }

  const result = await writeTransaction(async (tx: ManagedTransaction) => {
    const query = `
      MATCH (a:Agent {agent_id: $agent_id, group_id: $group_id})-[r:LEARNED]->(s:Session {session_id: $session_id, group_id: $group_id})
      DELETE r
      RETURN count(r) AS deleted_count
    `;

    const queryResult = await tx.run(query, { agent_id, session_id, group_id });
    return queryResult;
  });

  const deletedCount = result.records[0]?.get("deleted_count");

  // Log to PostgreSQL
  try {
    await insertEvent({
      group_id,
      agent_id,
      event_type: "relationship.learned.deleted",
      workflow_id: "memory-relationship",
      metadata: {
        relationship_type: "LEARNED",
        session_id,
      },
      outcome: { status: "success", deleted: deletedCount?.toNumber?.() ?? 0 },
    });
  } catch (error) {
    console.error("[LEARNED Relationship] Failed to log deletion to PostgreSQL:", error);
  }

  return deletedCount?.toNumber?.() > 0 ?? false;
}

/**
 * Count learnings for an agent
 * 
 * @param agent_id - Agent identifier
 * @param group_id - Tenant isolation identifier
 * @returns Number of sessions the agent has learned from
 */
export async function countAgentLearnings(
  agent_id: string,
  group_id: string
): Promise<number> {
  if (!agent_id || !group_id) {
    throw new LearnedQueryError("agent_id and group_id are required");
  }

  // Enforce allura-* naming
  if (!group_id.startsWith("allura-")) {
    throw new LearnedQueryError(`group_id must use allura-* format (found: ${group_id})`);
  }

  const result = await readTransaction(async (tx: ManagedTransaction) => {
    const query = `
      MATCH (a:Agent {agent_id: $agent_id, group_id: $group_id})-[r:LEARNED]->(s:Session)
      RETURN count(r) AS learning_count
    `;

    return await tx.run(query, { agent_id, group_id });
  });

  const countValue = result.records[0]?.get("learning_count");
  return countValue?.toNumber?.() ?? 0;
}