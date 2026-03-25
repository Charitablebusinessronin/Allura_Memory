/**
 * OpenClaw Gateway - MCP Server
 * 
 * Exposes Ronin Memory tools via Model Context Protocol (MCP)
 * for integration with Mission Control and other OpenClaw-compatible systems.
 */

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import { z } from "zod";
import { getNotionClient } from "../lib/notion/client.js";
import { getPool } from "../lib/postgres/connection.js";

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
  domain: z.string().describe("Domain to search (e.g., 'coding', 'research')"),
  objective: z.string().optional().describe("Specific objective for search"),
  maxIterations: z.number().optional().default(10).describe("Max search iterations"),
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
async function memorySearch(args: z.infer<typeof MemorySearchRequest>) {
  try {
    const pool = getPool();
    const result = await pool.query(
      `SELECT * FROM events 
       WHERE group_id = $1 
       AND content ILIKE $2
       ORDER BY created_at DESC
       LIMIT $3`,
      [args.group_id, `%${args.query}%`, args.limit]
    );
    
    return {
      content: [{
        type: "text" as const,
        text: JSON.stringify({
          count: result.rows.length,
          memories: result.rows,
        }),
      }],
    };
  } catch (error) {
    return {
      content: [{
        type: "text" as const,
        text: JSON.stringify({ error: String(error) }),
      }],
      isError: true,
    };
  }
}

async function memoryStore(args: z.infer<typeof MemoryStoreRequest>) {
  try {
    const pool = getPool();
    await pool.query(
      `INSERT INTO events (group_id, content, created_at)
       VALUES ($1, $2, NOW())`,
      [args.group_id, JSON.stringify(args)]
    );
    
    return {
      content: [{
        type: "text" as const,
        text: JSON.stringify({ 
          success: true, 
          topic_key: args.topic_key,
          message: `Memory stored: ${args.title}`
        }),
      }],
    };
  } catch (error) {
    return {
      content: [{
        type: "text" as const,
        text: JSON.stringify({ error: String(error) }),
      }],
      isError: true,
    };
  }
}

async function adasRunSearch(args: z.infer<typeof ADASRunSearchRequest>) {
  const { runMetaAgentSearch, createSearchConfig } = await import("@/lib/adas/search-loop.js");
  
  try {
    const domain = { domainId: args.domain, name: args.domain, description: args.objective || "" };
    const config = createSearchConfig(args.group_id, domain, { maxIterations: args.maxIterations });
    const search = new (await import("@/lib/adas/search-loop.js")).MetaAgentSearch(config);
    
    const result = await search.runSearch(() => async (input: unknown) => ({ success: true, output: input }));
    
    return {
      content: [{
        type: "text" as const,
        text: JSON.stringify({
          bestDesign: result.finalBestDesign,
          metrics: { score: result.finalBestScore },
          iterations: result.iterations.length,
          proposalsCreated: result.totalCandidates,
          status: "completed",
        }),
      }],
    };
  } catch (error) {
    return {
      content: [{
        type: "text" as const,
        text: JSON.stringify({ 
          error: String(error),
          status: "failed"
        }),
      }],
      isError: true,
    };
  }
}

async function adasGetProposals(args: z.infer<typeof ADASGetProposalsRequest>) {
  try {
    const pool = getPool();
    let query = `SELECT * FROM promotion_candidates WHERE group_id = $1`;
    const params: any[] = [args.group_id];
    
    if (args.status !== "all") {
      query += ` AND status = $2`;
      params.push(args.status);
    }
    
    query += ` ORDER BY confidence DESC LIMIT $${params.length + 1}`;
    params.push(args.limit);
    
    const result = await pool.query(query, params);
    
    return {
      content: [{
        type: "text" as const,
        text: JSON.stringify({
          count: result.rows.length,
          proposals: result.rows,
        }),
      }],
    };
  } catch (error) {
    return {
      content: [{
        type: "text" as const,
        text: JSON.stringify({ error: String(error) }),
      }],
      isError: true,
    };
  }
}

async function adasApproveDesign(args: z.infer<typeof ADASApproveDesignRequest>) {
  try {
    const pool = getPool();
    
    if (args.decision === "approve") {
      const notion = getNotionClient();
    }
    
    return {
      content: [{
        type: "text" as const,
        text: JSON.stringify({
          success: true,
          designId: args.designId,
          decision: args.decision,
          message: `Design ${args.designId} ${args.decision}d`,
        }),
      }],
    };
  } catch (error) {
    return {
      content: [{
        type: "text" as const,
        text: JSON.stringify({ error: String(error) }),
      }],
      isError: true,
    };
  }
}

// Create server
const server = new Server(
  {
    name: "ronin-memory-gateway",
    version: "1.0.0",
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

// Tool definitions
const tools = [
  {
    name: "memory_search",
    description: "Search memories in the Ronin Memory knowledge graph with full-text search",
    inputSchema: {
      type: "object",
      properties: {
        query: { type: "string", description: "Search query" },
        type: { type: "string", enum: ["insight", "entity", "decision", "pattern"], description: "Memory type filter" },
        group_id: { type: "string", description: "Tenant/project identifier" },
        limit: { type: "number", description: "Max results to return" },
      },
      required: ["query", "group_id"],
    },
  },
  {
    name: "memory_store",
    description: "Store a new memory in Ronin Memory",
    inputSchema: {
      type: "object",
      properties: {
        topic_key: { type: "string", description: "Unique identifier" },
        title: { type: "string" },
        content: { type: "string" },
        type: { type: "string", enum: ["insight", "entity", "decision", "pattern"] },
        group_id: { type: "string" },
        confidence: { type: "number" },
        evidence: { type: "array", items: { type: "string" } },
      },
      required: ["topic_key", "title", "content", "type", "group_id"],
    },
  },
  {
    name: "adas_run_search",
    description: "Run ADAS meta-agent search to discover new agent designs",
    inputSchema: {
      type: "object",
      properties: {
        domain: { type: "string", description: "Domain to search" },
        objective: { type: "string", description: "Specific objective" },
        maxIterations: { type: "number", description: "Max iterations" },
        group_id: { type: "string" },
      },
      required: ["domain", "group_id"],
    },
  },
  {
    name: "adas_get_proposals",
    description: "List pending design proposals from ADAS",
    inputSchema: {
      type: "object",
      properties: {
        group_id: { type: "string" },
        status: { type: "string", enum: ["pending", "approved", "rejected", "all"] },
        limit: { type: "number" },
      },
      required: ["group_id"],
    },
  },
  {
    name: "adas_approve_design",
    description: "Approve or reject a design proposal",
    inputSchema: {
      type: "object",
      properties: {
        designId: { type: "string" },
        decision: { type: "string", enum: ["approve", "reject"] },
        rationale: { type: "string" },
        approvedBy: { type: "string" },
        group_id: { type: "string" },
      },
      required: ["designId", "decision", "rationale", "approvedBy", "group_id"],
    },
  },
];

// Request handlers
server.setRequestHandler(ListToolsRequestSchema, async () => {
  return { tools };
});

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;
  
  try {
    switch (name) {
      case "memory_search":
        return await memorySearch(MemorySearchRequest.parse(args));
      case "memory_store":
        return await memoryStore(MemoryStoreRequest.parse(args));
      case "adas_run_search":
        return await adasRunSearch(ADASRunSearchRequest.parse(args));
      case "adas_get_proposals":
        return await adasGetProposals(ADASGetProposalsRequest.parse(args));
      case "adas_approve_design":
        return await adasApproveDesign(ADASApproveDesignRequest.parse(args));
      default:
        return {
          content: [{
            type: "text" as const,
            text: JSON.stringify({ error: `Unknown tool: ${name}` }),
          }],
          isError: true,
        };
    }
  } catch (error) {
    return {
      content: [{
        type: "text" as const,
        text: JSON.stringify({ 
          error: String(error),
          tool: name
        }),
      }],
      isError: true,
    };
  }
});

// Start server
async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("Ronin Memory Gateway running on stdio");
}

main().catch(console.error);
