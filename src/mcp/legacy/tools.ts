/**
 * LEGACY — Do not expose to AI agents.
 * 
 * These are legacy MCP tools (memorySearch, memoryStore, ADAS tools).
 * Use src/mcp/canonical-tools.ts for canonical 5-operation memory interface.
 * 
 * Kept for: openclaw-gateway HTTP surface, backward compatibility.
 * Removal target: after consumers are ported to canonical.
 * 
 * Original file: src/mcp/tools.ts (moved to legacy/)
 */

import { z } from "zod";
import { getPool } from "../../lib/postgres/connection.js";

// Tool schemas
const MemorySearchRequest = z.object({
  query: z.string().describe("Search query for full-text search"),
  type: z.enum(["insight", "entity", "decision", "pattern"]).optional(),
  group_id: z.string().describe("Tenant/project identifier"),
  limit: z.number().optional().default(50),
});

const MemoryStoreRequest = z.object({
  topic_key: z.string().describe("Unique identifier for this memory"),
  title: z.string(),
  content: z.string(),
  type: z.enum(["insight", "entity", "decision", "pattern"]),
  group_id: z.string(),
  confidence: z.number().min(0).max(1).optional().default(0.8),
  evidence: z.array(z.string()).optional(),
});

const ADASRunSearchRequest = z.object({
  domain: z.string().describe("Domain to search"),
  objective: z.string().optional().describe("Specific objective"),
  maxIterations: z.number().optional().default(10),
  group_id: z.string(),
});

const ADASGetProposalsRequest = z.object({
  group_id: z.string(),
  status: z.enum(["pending", "approved", "rejected", "all"]).optional().default("pending"),
  limit: z.number().optional().default(20),
});

const ADASApproveDesignRequest = z.object({
  designId: z.string(),
  decision: z.enum(["approve", "reject"]),
  rationale: z.string().describe("Reason for decision"),
  approvedBy: z.string().describe("Person or system making decision"),
  group_id: z.string(),
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
    return {
      error: String(error),
    };
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
    return {
      error: String(error),
    };
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
    return {
      error: String(error),
    };
  }
}

export async function adasApproveDesign(args: unknown) {
  const parsed = ADASApproveDesignRequest.parse(args);
  
  try {
    const pool = getPool();
    
    // Update proposal status
    await pool.query(
      `UPDATE promotion_candidates 
       SET status = $1, reviewed_at = NOW(), reviewed_by = $2
       WHERE id = $3 AND group_id = $4`,
      [parsed.decision === "approve" ? "approved" : "rejected", parsed.approvedBy, parsed.designId, parsed.group_id]
    );
    
    return {
      success: true,
      designId: parsed.designId,
      decision: parsed.decision,
      message: `Design ${parsed.designId} ${parsed.decision}d`,
    };
  } catch (error) {
    return {
      error: String(error),
    };
  }
}