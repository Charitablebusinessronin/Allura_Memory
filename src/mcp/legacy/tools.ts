/**
 * LEGACY — Do not expose to AI agents.
 * 
 * These are legacy MCP tools (memorySearch, memoryStore, ADAS tools).
 * Use src/mcp/canonical-tools.ts for canonical 5-operation memory interface.
 * 
 * Kept for: openclaw-gateway HTTP surface, backward compatibility.
 * Removal target: after consumers are ported to canonical.
 * 
 * Issue #7 fixes:
 * - adasApproveDesign: replaced UPDATE with append-only INSERT to events
 * - All handlers: throw errors instead of returning { error: String(error) }
 * - group_id validation: Zod schemas already enforce ^allura- pattern
 * 
 * Original file: src/mcp/tools.ts (moved to legacy/)
 */

import { z } from "zod";
import { getPool } from "@/lib/postgres/connection";
import { randomUUID } from "crypto";
import {
  DatabaseUnavailableError,
  DatabaseQueryError,
  classifyPostgresError,
} from "@/lib/errors/database-errors";

// Tool schemas
const MemorySearchRequest = z.object({
  query: z.string().describe("Search query for full-text search"),
  type: z.enum(["insight", "entity", "decision", "pattern"]).optional(),
  group_id: z.string().regex(/^allura-[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/, 'group_id must match pattern: allura-* (e.g. allura-myproject)').describe("Tenant/project identifier"),
  limit: z.number().optional().default(50),
});

const MemoryStoreRequest = z.object({
  topic_key: z.string().describe("Unique identifier for this memory"),
  title: z.string(),
  content: z.string(),
  type: z.enum(["insight", "entity", "decision", "pattern"]),
  group_id: z.string().regex(/^allura-[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/, 'group_id must match pattern: allura-* (e.g. allura-myproject)'),
  confidence: z.number().min(0).max(1).optional().default(0.8),
  evidence: z.array(z.string()).optional(),
});

const ADASRunSearchRequest = z.object({
  domain: z.string().describe("Domain to search"),
  objective: z.string().optional().describe("Specific objective"),
  maxIterations: z.number().optional().default(10),
  group_id: z.string().regex(/^allura-[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/, 'group_id must match pattern: allura-* (e.g. allura-myproject)'),
});

const ADASGetProposalsRequest = z.object({
  group_id: z.string().regex(/^allura-[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/, 'group_id must match pattern: allura-* (e.g. allura-myproject)'),
  status: z.enum(["pending", "approved", "rejected", "all"]).optional().default("pending"),
  limit: z.number().optional().default(20),
});

const ADASApproveDesignRequest = z.object({
  designId: z.string(),
  decision: z.enum(["approve", "reject"]),
  rationale: z.string().describe("Reason for decision"),
  approvedBy: z.string().describe("Person or system making decision"),
  group_id: z.string().regex(/^allura-[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/, 'group_id must match pattern: allura-* (e.g. allura-myproject)'),
});

// Tool handlers
export async function memorySearch(args: unknown) {
  const parsed = MemorySearchRequest.parse(args);
  
  try {
    const pool = getPool();
    const result = await pool.query(
      `SELECT * FROM events 
       WHERE group_id = $1 
       AND content ILIKE $2
       ORDER BY created_at DESC
       LIMIT $3`,
      [parsed.group_id, `%${parsed.query}%`, parsed.limit]
    );
    
    return {
      count: result.rows.length,
      memories: result.rows,
    };
  } catch (error) {
    // Issue #7: Propagate errors instead of swallowing them.
    // Callers need to distinguish "empty result" from "DB is down".
    if (error instanceof DatabaseUnavailableError || error instanceof DatabaseQueryError) {
      throw error;
    }
    if (error instanceof Error && (error as Error & { code?: string }).code) {
      throw classifyPostgresError(error, "memorySearch", "SELECT events ILIKE");
    }
    throw error;
  }
}

export async function memoryStore(args: unknown) {
  const parsed = MemoryStoreRequest.parse(args);
  
  try {
    const pool = getPool();
    await pool.query(
      `INSERT INTO events (group_id, content, created_at)
       VALUES ($1, $2, NOW())`,
      [parsed.group_id, JSON.stringify(parsed)]
    );
    
    return {
      success: true,
      topic_key: parsed.topic_key,
      message: `Memory stored: ${parsed.title}`,
    };
  } catch (error) {
    if (error instanceof DatabaseUnavailableError || error instanceof DatabaseQueryError) {
      throw error;
    }
    if (error instanceof Error && (error as Error & { code?: string }).code) {
      throw classifyPostgresError(error, "memoryStore", "INSERT events");
    }
    throw error;
  }
}

export async function adasRunSearch(args: unknown) {
  const parsed = ADASRunSearchRequest.parse(args);
  
  // Placeholder - would integrate with ADAS search loop
  return {
    status: "not_implemented",
    message: "ADAS search integration pending",
    domain: parsed.domain,
    group_id: parsed.group_id,
  };
}

export async function adasGetProposals(args: unknown) {
  const parsed = ADASGetProposalsRequest.parse(args);
  
  try {
    const pool = getPool();
    let query = `SELECT * FROM promotion_candidates WHERE group_id = $1`;
    const params: unknown[] = [parsed.group_id];
    
    if (parsed.status !== "all") {
      query += ` AND status = $2`;
      params.push(parsed.status);
    }
    
    query += ` ORDER BY confidence DESC LIMIT $${params.length + 1}`;
    params.push(parsed.limit);
    
    const result = await pool.query(query, params);
    
    return {
      count: result.rows.length,
      proposals: result.rows,
    };
  } catch (error) {
    if (error instanceof DatabaseUnavailableError || error instanceof DatabaseQueryError) {
      throw error;
    }
    if (error instanceof Error && (error as Error & { code?: string }).code) {
      throw classifyPostgresError(error, "adasGetProposals", "SELECT promotion_candidates");
    }
    throw error;
  }
}

export async function adasApproveDesign(args: unknown) {
  const parsed = ADASApproveDesignRequest.parse(args);
  
  try {
    const pool = getPool();
    const eventId = randomUUID();
    const status = parsed.decision === "approve" ? "approved" : "rejected";
    
    // Issue #7: Append-only — INSERT review event instead of UPDATE.
    // The promotion_candidates row is NOT mutated. The review decision
    // is recorded as a new event in the append-only events table.
    // Consumers read the latest event for a given design_id to determine
    // current status.
    await pool.query(
      `INSERT INTO events (id, group_id, event_type, content, metadata, created_at)
       VALUES ($1, $2, 'design_review', $3, $4, NOW())`,
      [
        eventId,
        parsed.group_id,
        `Design ${parsed.designId} ${status}`,
        JSON.stringify({
          design_id: parsed.designId,
          decision: parsed.decision,
          rationale: parsed.rationale,
          reviewed_by: parsed.approvedBy,
          status,
        }),
      ]
    );
    
    return {
      success: true,
      designId: parsed.designId,
      decision: parsed.decision,
      event_id: eventId,
      message: `Design ${parsed.designId} ${status} (event: ${eventId})`,
    };
  } catch (error) {
    if (error instanceof DatabaseUnavailableError || error instanceof DatabaseQueryError) {
      throw error;
    }
    if (error instanceof Error && (error as Error & { code?: string }).code) {
      throw classifyPostgresError(error, "adasApproveDesign", "INSERT events (design_review)");
    }
    throw error;
  }
}