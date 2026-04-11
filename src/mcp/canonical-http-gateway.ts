/**
 * Canonical HTTP Gateway for Allura Memory MCP
 *
 * Thin HTTP wrapper over canonical 5-operation memory interface.
 * Exposes only canonical tools: memory_add, memory_search, memory_get, memory_list, memory_delete
 *
 * Usage: bun run src/mcp/canonical-http-gateway.ts
 */

import { createServer } from "http";
import { parse } from "url";
import { config } from "dotenv";

config();

const PORT = process.env.CANONICAL_HTTP_PORT || 3201;

// Import canonical tools
import {
  memory_add,
  memory_search,
  memory_get,
  memory_list,
  memory_delete,
} from "./canonical-tools.js";

import type {
  MemoryAddRequest,
  MemorySearchRequest,
  MemoryGetRequest,
  MemoryListRequest,
  MemoryDeleteRequest,
} from "@/lib/memory/canonical-contracts.js";

interface Request {
  method: string;
  url: string;
  headers: Record<string, string>;
  body?: unknown;
}

interface Response {
  status: number;
  headers: Record<string, string>;
  body: string;
}

// CORS headers
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

// Parse request body
async function parseBody(req: Request): Promise<unknown> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    // Note: In a real HTTP server, we'd read from the request stream
    // This is a simplified version for the MCP HTTP gateway
    resolve({});
  });
}

// Tool handlers
const toolHandlers: Record<
  string,
  (args: unknown) => Promise<unknown>
> = {
  memory_add: async (args) => {
    return memory_add(args as MemoryAddRequest);
  },
  memory_search: async (args) => {
    return memory_search(args as MemorySearchRequest);
  },
  memory_get: async (args) => {
    return memory_get(args as MemoryGetRequest);
  },
  memory_list: async (args) => {
    return memory_list(args as MemoryListRequest);
  },
  memory_delete: async (args) => {
    return memory_delete(args as MemoryDeleteRequest);
  },
};

// Tool schemas for discovery
const toolSchemas = [
  {
    name: "memory_add",
    description:
      "Add a memory. Content is scored and either promoted immediately (auto mode) or queued for approval (soc2 mode).",
    inputSchema: {
      type: "object",
      properties: {
        group_id: {
          type: "string",
          pattern: "^allura-[a-z0-9-]+$",
          description: "Tenant namespace (required)",
        },
        user_id: { type: "string", description: "User identifier (required)" },
        content: { type: "string", description: "Memory content text (required)" },
        metadata: {
          type: "object",
          properties: {
            source: { type: "string", enum: ["conversation", "manual"] },
            conversation_id: { type: "string" },
            agent_id: { type: "string" },
          },
        },
        threshold: {
          type: "number",
          minimum: 0,
          maximum: 1,
          description: "Override promotion threshold (default: 0.85)",
        },
      },
      required: ["group_id", "user_id", "content"],
    },
  },
  {
    name: "memory_search",
    description:
      "Search memories across episodic (PostgreSQL) and semantic (Neo4j) stores.",
    inputSchema: {
      type: "object",
      properties: {
        query: { type: "string", description: "Search query (required)" },
        group_id: {
          type: "string",
          pattern: "^allura-[a-z0-9-]+$",
          description: "Tenant namespace (required)",
        },
        user_id: { type: "string", description: "User identifier (optional)" },
        limit: { type: "number", default: 10 },
      },
      required: ["query", "group_id"],
    },
  },
  {
    name: "memory_get",
    description: "Retrieve a single memory by ID.",
    inputSchema: {
      type: "object",
      properties: {
        id: { type: "string", format: "uuid", description: "Memory ID (required)" },
        group_id: {
          type: "string",
          pattern: "^allura-[a-z0-9-]+$",
          description: "Tenant namespace (required)",
        },
      },
      required: ["id", "group_id"],
    },
  },
  {
    name: "memory_list",
    description: "List all memories for a user within a tenant.",
    inputSchema: {
      type: "object",
      properties: {
        group_id: {
          type: "string",
          pattern: "^allura-[a-z0-9-]+$",
          description: "Tenant namespace (required)",
        },
        user_id: { type: "string", description: "User identifier (required)" },
        limit: { type: "number", default: 50 },
        offset: { type: "number", default: 0 },
      },
      required: ["group_id", "user_id"],
    },
  },
  {
    name: "memory_delete",
    description: "Soft-delete a memory (marks as deprecated, does not remove).",
    inputSchema: {
      type: "object",
      properties: {
        id: { type: "string", format: "uuid", description: "Memory ID (required)" },
        group_id: {
          type: "string",
          pattern: "^allura-[a-z0-9-]+$",
          description: "Tenant namespace (required)",
        },
        user_id: { type: "string", description: "User identifier (required)" },
      },
      required: ["id", "group_id", "user_id"],
    },
  },
];

// HTTP server
const server = createServer(async (req, res) => {
  const url = parse(req.url || "/", true);

  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    res.writeHead(204, corsHeaders);
    res.end();
    return;
  }

  try {
    // Parse request body
    let body = {};
    if (req.method === "POST") {
      const chunks: Buffer[] = [];
      for await (const chunk of req) {
        chunks.push(chunk);
      }
      const data = Buffer.concat(chunks).toString();
      body = data ? JSON.parse(data) : {};
    }

    // Route handling
    if (url.pathname === "/tools" && req.method === "GET") {
      // List tools
      res.writeHead(200, { ...corsHeaders, "Content-Type": "application/json" });
      res.end(JSON.stringify({ tools: toolSchemas }));
    } else if (url.pathname === "/tools/call" && req.method === "POST") {
      // Call tool
      const { name, arguments: args } = body as { name: string; arguments?: unknown };

      if (!name || !toolHandlers[name]) {
        res.writeHead(404, { ...corsHeaders, "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: `Unknown tool: ${name}` }));
        return;
      }

      const result = await toolHandlers[name](args || {});
      res.writeHead(200, { ...corsHeaders, "Content-Type": "application/json" });
      res.end(JSON.stringify(result));
    } else if (url.pathname === "/health") {
      // Health check
      res.writeHead(200, { ...corsHeaders, "Content-Type": "application/json" });
      res.end(JSON.stringify({ status: "healthy", timestamp: new Date().toISOString() }));
    } else {
      res.writeHead(404, { ...corsHeaders, "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: "Not found" }));
    }
  } catch (error) {
    console.error("Error handling request:", error);
    res.writeHead(500, { ...corsHeaders, "Content-Type": "application/json" });
    res.end(JSON.stringify({ error: "Internal server error" }));
  }
});

server.listen(PORT, () => {
  console.log(`Canonical HTTP Gateway listening on port ${PORT}`);
  console.log("Available tools: memory_add, memory_search, memory_get, memory_list, memory_delete");
});

// Graceful shutdown
process.on("SIGTERM", () => {
  console.log("Shutting down...");
  server.close(() => {
    process.exit(0);
  });
});
