/**
 * Memory Store Functions
 * 
 * Store and version memories in Neo4j knowledge graph
 * with PostgreSQL trace evidence linkage.
 */

import {
  CreateMemoryRequest,
  CreateMemoryResponse,
  InsightStatus,
} from "./types";
import { writeTransaction } from "../neo4j/connection";
import { insertEvent } from "../postgres/queries/insert-trace";
import {
  isRuVectorEnabled,
  getRuVectorPool,
} from "../ruvector/connection";
import { Neo4jError } from "../errors/neo4j-errors";

type Neo4jIntegerLike = {
  toNumber?: () => number;
};

function asNumber(value: unknown, fallback: number): number {
  if (typeof value === "number") {
    return value;
  }

  if (
    typeof value === "object" &&
    value !== null &&
    "toNumber" in value &&
    typeof (value as Neo4jIntegerLike).toNumber === "function"
  ) {
    return (value as Neo4jIntegerLike).toNumber!();
  }

  return fallback;
}

/**
 * Store a new memory in the knowledge graph
 * 
 * Follows Steel Frame model:
 * - Creates new version rather than mutating
 * - If superseded_id provided, creates SUPERSEDES relationship
 * - Links to PostgreSQL trace evidence via trace_ref
 * 
 * @param request - Memory creation parameters
 * @returns Created memory metadata
 */
export async function storeMemory(
  request: CreateMemoryRequest
): Promise<CreateMemoryResponse> {
  const {
    type,
    topic_key,
    title,
    summary,
    content,
    confidence = 0.5,
    group_id,
    status = "draft",
    tags = [],
    metadata = {},
    superseded_id,
    trace_ref,
  } = request;

  // Generate version number (1 for new, increment for updates)
  let version = 1;

  if (superseded_id) {
    // Get current version of the memory being superseded
    const versionCypher = `
      MATCH (old {topic_key: $superseded_id})
      RETURN old.version AS current_version
    `;

    const versionResult = await writeTransaction(async (tx) => {
      const result = await tx.run(versionCypher, { superseded_id });
      return asNumber(result.records[0]?.get("current_version"), 0);
    });

    version = versionResult + 1;
  }

  // Create the memory node
  const createCypher = `
    CREATE (m:${type} {
      topic_key: $topic_key,
      group_id: $group_id,
      title: $title,
      summary: $summary,
      content: $content,
      confidence: $confidence,
      status: $status,
      version: $version,
      created_at: datetime(),
      updated_at: datetime(),
      tags: $tags,
      metadata: $metadata,
      trace_ref: $trace_ref
    })
    ${superseded_id ? `
      WITH m
      MATCH (old {topic_key: $superseded_id})
      CREATE (m)-[:SUPERSEDES]->(old)
    ` : ""}
    RETURN m.topic_key AS id, m.version AS version, m.created_at AS created_at, m.status AS status
  `;

  let result: { id: string; version: number; created_at: string; status: InsightStatus };
  let store: "neo4j" | "ruvector" = "neo4j";

  try {
    result = await writeTransaction(async (tx) => {
      const res = await tx.run(createCypher, {
        topic_key,
        group_id,
        title: title || null,
        summary: summary || null,
        content,
        confidence,
        status,
        version,
        tags,
        metadata: JSON.stringify(metadata),
        trace_ref: trace_ref || null,
        superseded_id: superseded_id || null,
      });

      const record = res.records[0];
      return {
        id: record.get("id"),
        version: asNumber(record.get("version"), version),
        created_at: record.get("created_at").toString(),
        status: record.get("status") as InsightStatus,
      };
    });
  } catch (neo4jErr) {
    // Neo4j unavailable — attempt ruvector fallback if enabled
    if (!isRuVectorEnabled()) {
      throw neo4jErr instanceof Neo4jError
        ? neo4jErr
        : new Neo4jError("Neo4j write failed and ruvector fallback is disabled", neo4jErr instanceof Error ? neo4jErr : undefined);
    }

    console.warn("[Memory Store] Neo4j unavailable — falling back to ruvector", {
      topic_key,
      group_id,
      error: neo4jErr instanceof Error ? neo4jErr.message : String(neo4jErr),
    });

    const pool = getRuVectorPool();
    const fallbackId = `rv_${topic_key}_${Date.now()}`;
    const now = new Date().toISOString();

    await pool.query(
      `INSERT INTO ruvector_memory_fallback
         (id, group_id, topic_key, content, summary, confidence, status, version, tags, metadata, trace_ref, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10::jsonb, $11, NOW())
       ON CONFLICT (topic_key, group_id) DO NOTHING`,
      [
        fallbackId,
        group_id,
        topic_key,
        content,
        summary || null,
        confidence,
        status,
        version,
        JSON.stringify(tags),
        JSON.stringify(metadata),
        trace_ref || null,
      ]
    );

    store = "ruvector";
    result = {
      id: fallbackId,
      version,
      created_at: now,
      status: status as InsightStatus,
    };
  }

  // Log trace event for audit (server-side only)
  if (typeof window === "undefined") {
    try {
      await logMemoryCreation({ ...request, version }, result.id);
    } catch (error) {
      console.error("[Memory Store] Failed to log trace event:", error);
      // Don't fail the operation if trace logging fails
    }
  }

  if (store === "ruvector") {
    console.warn(`[Memory Store] Stored ${topic_key} in ruvector fallback (Neo4j degraded)`);
  }

  return {
    id: result.id,
    type,
    topic_key,
    created_at: result.created_at,
    version: result.version,
    status: result.status,
  };
}

/**
 * Log memory creation event to PostgreSQL trace store
 */
async function logMemoryCreation(
  request: CreateMemoryRequest & { version: number },
  memoryId: string
): Promise<void> {
  const { group_id, type, topic_key, version, confidence } = request;

  // Generate a deterministic agent_id for system operations
  const agentId = "memory-system";

  await insertEvent({
    group_id,
    agent_id: agentId,
    event_type: "memory_created",
    workflow_id: "memory-store",
    metadata: {
      memory_id: memoryId,
      memory_type: type,
      topic_key,
      version,
      confidence,
    },
    outcome: { status: "success" },
  });
}

/**
 * Promote a memory from draft to active status
 * Requires human approval for production use
 * 
 * @param topic_key - Memory identifier
 * @param group_id - Tenant/group identifier
 * @param approvedBy - Approver identifier (for audit)
 * @param rationale - Approval rationale
 */
export async function promoteMemory(
  topic_key: string,
  group_id: string,
  approvedBy: string,
  rationale: string
): Promise<{ success: boolean; status: string }> {
  const cypher = `
    MATCH (m {topic_key: $topic_key, group_id: $group_id})
    SET m.status = 'active',
        m.approved_by = $approvedBy,
        m.approved_at = datetime(),
        m.approval_rationale = $rationale,
        m.updated_at = datetime()
    RETURN m.status AS status
  `;

  const result = await writeTransaction(async (tx) => {
    const res = await tx.run(cypher, {
      topic_key,
      group_id,
      approvedBy,
      rationale,
    });

    return res.records[0]?.get("status") || "unknown";
  });

  // Log promotion event
  if (typeof window === "undefined") {
    try {
      await insertEvent({
        group_id,
        agent_id: "memory-system",
        event_type: "memory_promoted",
        workflow_id: "memory-promote",
        metadata: {
          topic_key,
          promoted_by: approvedBy,
          rationale,
        },
        outcome: { status: "success" },
      });
    } catch (error) {
      console.error("[Memory Store] Failed to log promotion event:", error);
    }
  }

  return {
    success: true,
    status: result as string,
  };
}

/**
 * Deprecate a memory (mark as deprecated)
 * 
 * @param topic_key - Memory identifier
 * @param group_id - Tenant/group identifier
 * @param reason - Deprecation reason
 */
export async function deprecateMemory(
  topic_key: string,
  group_id: string,
  reason: string
): Promise<{ success: boolean; status: string }> {
  const cypher = `
    MATCH (m {topic_key: $topic_key, group_id: $group_id})
    SET m.status = 'deprecated',
        m.deprecation_reason = $reason,
        m.deprecated_at = datetime(),
        m.updated_at = datetime()
    RETURN m.status AS status
  `;

  const result = await writeTransaction(async (tx) => {
    const res = await tx.run(cypher, {
      topic_key,
      group_id,
      reason,
    });

    return res.records[0]?.get("status") || "unknown";
  });

  return {
    success: true,
    status: result as string,
  };
}

/**
 * Archive a memory (mark as archived)
 * 
 * @param topic_key - Memory identifier  
 * @param group_id - Tenant/group identifier
 */
export async function archiveMemory(
  topic_key: string,
  group_id: string
): Promise<{ success: boolean; status: string }> {
  const cypher = `
    MATCH (m {topic_key: $topic_key, group_id: $group_id})
    SET m.status = 'archived',
        m.archived_at = datetime(),
        m.updated_at = datetime()
    RETURN m.status AS status
  `;

  const result = await writeTransaction(async (tx) => {
    const res = await tx.run(cypher, {
      topic_key,
      group_id,
    });

    return res.records[0]?.get("status") || "unknown";
  });

  return {
    success: true,
    status: result as string,
  };
}
