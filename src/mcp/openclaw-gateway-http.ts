/**
 * OpenClaw Gateway - HTTP Server
 * 
 * Exposes Ronin Memory tools via HTTP for integration with external systems.
 * Runs on configurable port (default: 3200) to avoid conflicts.
 */

import { createServer } from "http";
import { parse } from "url";
import { config } from "dotenv";
import { getPort } from "../lib/config/ports";

// Load environment variables
config();

const PORT = getPort("openclaw", "OPENCLAW_PORT");

// Import MCP tools
import { memorySearch, memoryStore, adasRunSearch, adasGetProposals, adasApproveDesign } from "./tools";

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

// Tool registry
const tools: Record<string, (args: unknown) => Promise<unknown>> = {
  memory_search: memorySearch,
  memory_store: memoryStore,
  adas_run_search: adasRunSearch,
  adas_get_proposals: adasGetProposals,
  adas_approve_design: adasApproveDesign,
};

// CORS headers
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

// Health check endpoint
async function healthCheck(): Promise<Response> {
  return {
    status: 200,
    headers: { "Content-Type": "application/json", ...corsHeaders },
    body: JSON.stringify({
      status: "healthy",
      service: "openclaw-gateway",
      version: "1.0.0",
      port: PORT,
      tools: Object.keys(tools),
    }),
  };
}

// List tools endpoint
async function listTools(): Promise<Response> {
  return {
    status: 200,
    headers: { "Content-Type": "application/json", ...corsHeaders },
    body: JSON.stringify({
      tools: Object.keys(tools).map((name) => ({
        name,
        description: `Execute ${name} tool`,
      })),
    }),
  };
}

// Execute tool endpoint
async function executeTool(
  toolName: string,
  args: unknown
): Promise<Response> {
  const tool = tools[toolName];

  if (!tool) {
    return {
      status: 404,
      headers: { "Content-Type": "application/json", ...corsHeaders },
      body: JSON.stringify({ error: `Tool not found: ${toolName}` }),
    };
  }

  try {
    const result = await tool(args);
    return {
      status: 200,
      headers: { "Content-Type": "application/json", ...corsHeaders },
      body: JSON.stringify(result),
    };
  } catch (error) {
    return {
      status: 500,
      headers: { "Content-Type": "application/json", ...corsHeaders },
      body: JSON.stringify({
        error: error instanceof Error ? error.message : "Unknown error",
      }),
    };
  }
}

// Request handler
async function handleRequest(req: Request): Promise<Response> {
  const url = parse(req.url || "/", true);
  const path = url.pathname ?? "/";

  // CORS preflight
  if (req.method === "OPTIONS") {
    return {
      status: 204,
      headers: corsHeaders,
      body: "",
    };
  }

  // Health check
  if (path === "/health" || path === "/api/health") {
    return healthCheck();
  }

  // List tools
  if (path === "/tools" || path === "/api/tools") {
    if (req.method === "GET") {
      return listTools();
    }
  }

  // Execute tool
  const toolMatch = path.match(/^\/tools\/([a-z_]+)$/);
  if (toolMatch && req.method === "POST") {
    return executeTool(toolMatch[1], req.body);
  }

  // API execute tool
  if (path === "/api/execute" && req.method === "POST") {
    const { tool, args } = req.body as { tool: string; args: unknown };
    return executeTool(tool, args);
  }

  // 404
  return {
    status: 404,
    headers: { "Content-Type": "application/json", ...corsHeaders },
    body: JSON.stringify({ error: "Not found" }),
  };
}

// Create HTTP server
const server = createServer(async (req, res) => {
  let body: unknown = undefined;

  // Parse body for POST requests
  if (req.method === "POST") {
    const chunks: Buffer[] = [];
    for await (const chunk of req) {
      chunks.push(chunk);
    }
    const rawBody = Buffer.concat(chunks).toString();
    try {
      body = JSON.parse(rawBody);
    } catch {
      body = rawBody;
    }
  }

  // Handle request
  const request: Request = {
    method: req.method || "GET",
    url: req.url || "/",
    headers: req.headers as Record<string, string>,
    body,
  };

  const response = await handleRequest(request);

  // Send response
  res.writeHead(response.status, response.headers);
  res.end(response.body);
});

// Start server
server.listen(PORT, () => {
  console.log(`🚀 OpenClaw Gateway running on http://localhost:${PORT}`);
  console.log(`📡 Health check: http://localhost:${PORT}/health`);
  console.log(`🔧 Tools endpoint: http://localhost:${PORT}/tools`);
  console.log(`\nAvailable tools:`);
  Object.keys(tools).forEach((name) => {
    console.log(`  - ${name}`);
  });
});

// Graceful shutdown
process.on("SIGTERM", () => {
  console.log("\n🛑 Shutting down OpenClaw Gateway...");
  server.close(() => {
    console.log("✅ Server closed");
    process.exit(0);
  });
});