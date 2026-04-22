/**
 * Canonical HTTP Gateway for Allura Memory MCP
 *
 * Exposes the canonical 5-operation memory interface via MCP Streamable HTTP:
 * - Primary transport: /mcp endpoint (native MCP protocol via MCP SDK)
 *
 * This is the single integration path for all MCP-compatible clients:
 * - OpenAI Agents SDK (`hostedMcpTool()` / `MCPServerStreamableHttp`)
 * - Any MCP client speaking the Streamable HTTP protocol
 *
 * No REST bridge. No OpenAPI schema. The MCP protocol handles discovery.
 *
 * Usage: bun run src/mcp/canonical-http-gateway.ts
 * Env:   ALLURA_MCP_HTTP_PORT  (default: 3201)
 *        ALLURA_MCP_AUTH_TOKEN  (optional Bearer token for /mcp endpoint)
 */

import { createServer, type IncomingMessage, type ServerResponse } from "http";
import { parse } from "url";
import { randomUUID } from "crypto";
import { config } from "dotenv";
import { applyCors, corsHeaders, isPreflightRequest, getCorsConfig } from "@/lib/cors/index.js";
import { initSentry, captureException, extractRequestContext, startTransaction } from "@/lib/observability/index.js";
import { checkReadiness, markMcpInitialized } from "@/lib/health/probes";
import { collectMetrics, recordHttpRequest, ensureMetricsInitialized } from "@/lib/health/metrics";

// MCP SDK imports for Streamable HTTP transport
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";

config();

// ── Port Resolution ─────────────────────────────────────────────────────────

function resolveHttpPort(): { port: number; source: string; warnings: string[] } {
  const warnings: string[] = [];

  if (process.env.ALLURA_MCP_HTTP_PORT) {
    return {
      port: parseInt(process.env.ALLURA_MCP_HTTP_PORT, 10),
      source: "ALLURA_MCP_HTTP_PORT",
      warnings,
    };
  }

  if (process.env.CANONICAL_HTTP_PORT) {
    warnings.push("CANONICAL_HTTP_PORT is deprecated; use ALLURA_MCP_HTTP_PORT");
    return {
      port: parseInt(process.env.CANONICAL_HTTP_PORT, 10),
      source: "CANONICAL_HTTP_PORT",
      warnings,
    };
  }

  if (process.env.OPENCLAW_PORT) {
    warnings.push("OPENCLAW_PORT is deprecated for canonical MCP HTTP; use ALLURA_MCP_HTTP_PORT");
    return {
      port: parseInt(process.env.OPENCLAW_PORT, 10),
      source: "OPENCLAW_PORT",
      warnings,
    };
  }

  if (process.env.PORT) {
    warnings.push("PORT is deprecated for canonical MCP HTTP; use ALLURA_MCP_HTTP_PORT");
    return {
      port: parseInt(process.env.PORT, 10),
      source: "PORT",
      warnings,
    };
  }

  return { port: 3201, source: "default", warnings };
}

const HTTP_PORT = resolveHttpPort();
const PORT = HTTP_PORT.port;

// ── Auth Configuration ───────────────────────────────────────────────────────

const AUTH_TOKEN = process.env.ALLURA_MCP_AUTH_TOKEN || "";

/**
 * Validate Bearer token at the transport layer.
 * If ALLURA_MCP_AUTH_TOKEN is not set, auth is disabled (dev mode).
 * Uses timing-safe comparison to prevent timing attacks.
 */
function validateBearerAuth(req: IncomingMessage): boolean {
  // If no token configured, auth is disabled (development mode)
  if (!AUTH_TOKEN) return true;

  const authHeader = req.headers["authorization"];
  if (!authHeader || !authHeader.startsWith("Bearer ")) return false;

  const token = authHeader.slice(7);
  // Timing-safe comparison
  const expected = Buffer.from(AUTH_TOKEN, "utf-8");
  const provided = Buffer.from(token, "utf-8");
  if (expected.length !== provided.length) return false;
  return expected.equals(provided);
}

// ── Canonical Tool Imports ───────────────────────────────────────────────────

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

// ── MCP Server Setup (Streamable HTTP) ───────────────────────────────────────

const mcpServer = new Server(
  {
    name: "allura-memory-canonical",
    version: "1.0.0",
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

// ── MCP Tool Handlers (Streamable HTTP) ──────────────────────────────────────

// List tools handler
mcpServer.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [
      {
        name: "memory_add",
        description:
          "Add a memory for a user. Writes to PostgreSQL (episodic), scores content, and conditionally promotes to Neo4j (semantic) based on PROMOTION_MODE.",
        inputSchema: {
          type: "object",
          properties: {
            group_id: { type: "string", description: "Required: Tenant namespace (format: allura-*)" },
            user_id: { type: "string", description: "Required: User identifier within tenant" },
            content: { type: "string", description: "Required: Memory content text" },
            metadata: {
              type: "object",
              description: "Optional: Metadata (source, conversation_id, agent_id)",
              properties: {
                source: { type: "string", enum: ["conversation", "manual"] },
                conversation_id: { type: "string" },
                agent_id: { type: "string" },
              },
            },
            threshold: { type: "number", description: "Optional: Override promotion threshold (default: 0.85)" },
          },
          required: ["group_id", "user_id", "content"],
        },
      },
      {
        name: "memory_search",
        description:
          "Search memories across both stores (PostgreSQL + Neo4j). Federated search with results merged by relevance.",
        inputSchema: {
          type: "object",
          properties: {
            query: { type: "string", description: "Required: Search query" },
            group_id: { type: "string", description: "Required: Tenant namespace (format: allura-*)" },
            user_id: { type: "string", description: "Optional: User identifier (scope to user)" },
            limit: { type: "number", description: "Optional: Maximum results (default: 10)" },
            min_score: { type: "number", description: "Optional: Minimum confidence filter" },
            include_global: { type: "boolean", description: "Optional: Include global memories (default: true)" },
          },
          required: ["query", "group_id"],
        },
      },
      {
        name: "memory_get",
        description: "Retrieve a single memory by ID. Returns from either store (episodic or semantic).",
        inputSchema: {
          type: "object",
          properties: {
            id: { type: "string", description: "Required: Memory identifier" },
            group_id: { type: "string", description: "Required: Tenant namespace (format: allura-*)" },
          },
          required: ["id", "group_id"],
        },
      },
      {
        name: "memory_list",
        description: "List all memories for a user within a tenant. Returns from both stores, merged and sorted.",
        inputSchema: {
          type: "object",
          properties: {
            group_id: { type: "string", description: "Required: Tenant namespace (format: allura-*)" },
            user_id: { type: "string", description: "Required: User identifier" },
            limit: { type: "number", description: "Optional: Maximum results (default: 50)" },
            offset: { type: "number", description: "Optional: Pagination offset" },
            sort: {
              type: "string",
              enum: ["created_at_desc", "created_at_asc", "score_desc", "score_asc"],
              description: "Optional: Sort order (default: created_at_desc)",
            },
          },
          required: ["group_id", "user_id"],
        },
      },
      {
        name: "memory_delete",
        description: "Soft-delete a memory. Appends deletion event to PostgreSQL and marks Neo4j node as deprecated.",
        inputSchema: {
          type: "object",
          properties: {
            id: { type: "string", description: "Required: Memory identifier" },
            group_id: { type: "string", description: "Required: Tenant namespace (format: allura-*)" },
            user_id: { type: "string", description: "Required: User identifier (for authorization)" },
          },
          required: ["id", "group_id", "user_id"],
        },
      },
    ],
  };
});

// Tool execution handler
mcpServer.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  try {
    let result: unknown;
    switch (name) {
      case "memory_add":
        result = await memory_add(args as unknown as MemoryAddRequest);
        break;
      case "memory_search":
        result = await memory_search(args as unknown as MemorySearchRequest);
        break;
      case "memory_get":
        result = await memory_get(args as unknown as MemoryGetRequest);
        break;
      case "memory_list":
        result = await memory_list(args as unknown as MemoryListRequest);
        break;
      case "memory_delete":
        result = await memory_delete(args as unknown as MemoryDeleteRequest);
        break;
      default:
        return {
          content: [{ type: "text" as const, text: JSON.stringify({ error: `Unknown tool: ${name}` }) }],
          isError: true,
        };
    }
    return {
      content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }],
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    return {
      content: [{ type: "text" as const, text: JSON.stringify({ error: errorMessage }) }],
      isError: true,
    };
  }
});

// Create Streamable HTTP transport (stateless mode for simplicity)
const mcpTransport = new StreamableHTTPServerTransport({
  sessionIdGenerator: undefined, // Stateless — no session affinity required
});

// Connect the MCP server to the transport
await mcpServer.connect(mcpTransport);

// ── Initialize Observability ──────────────────────────────────────────────────

initSentry();

// ── Initialize Health Probes and Metrics ─────────────────────────────────────

markMcpInitialized();
ensureMetricsInitialized();

const server = createServer(async (req: IncomingMessage, res: ServerResponse) => {
  const url = parse(req.url || "/", true);

  // ── Apply CORS middleware ──────────────────────────────────────────────────
  // Handles preflight (OPTIONS) requests and sets CORS headers on all responses.
  // In development mode (no ALLURA_CORS_ORIGINS), allows all origins.
  // In production mode, validates against the configured allowlist.
  const corsResult = applyCors(req, res);
  if (corsResult.isPreflight) {
    // Preflight was handled by CORS middleware (204 or 403)
    return;
  }

  // Start a Sentry performance transaction for all requests
  const transaction = startTransaction({
    name: `${req.method ?? "GET"} ${url.pathname ?? "/"}`,
    op: "http.server",
  });

  // Record request start time for metrics
  const requestStartTime = Date.now();

  // ── MCP Streamable HTTP endpoint ──────────────────────────────────────────
  // Route: POST /mcp, GET /mcp, DELETE /mcp
  // This is the primary integration path for OpenAI Agents SDK and any
  // MCP-compatible client using the Streamable HTTP transport.
  if (url.pathname === "/mcp" || url.pathname === "/mcp/") {
    // Bearer token auth at the transport layer
    if (!validateBearerAuth(req)) {
      res.writeHead(401, {
        ...corsHeaders(req.headers["origin"]),
        "Content-Type": "application/json",
        "WWW-Authenticate": 'Bearer realm="Allura Memory MCP"',
      });
      res.end(JSON.stringify({ error: "Unauthorized: Invalid or missing Bearer token" }));
      transaction.finish();
      return;
    }

    try {
      // Delegate to the MCP Streamable HTTP transport
      // The transport handles JSON-RPC message parsing, session management,
      // and SSE streaming per the MCP Streamable HTTP specification.
      await mcpTransport.handleRequest(req, res);
    } catch (error) {
      console.error("[mcp-streamable-http] Error handling request:", error);
      captureException(error, extractRequestContext(req));
      if (!res.headersSent) {
        res.writeHead(500, { ...corsHeaders(req.headers["origin"]), "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: "Internal server error" }));
      }
    }
    transaction.finish();
    return;
  }

  // ── Health endpoint (advertising only streamable-http transport) ───────────
  const requestOrigin = req.headers["origin"];
  if (url.pathname === "/health" || url.pathname === "/api/health") {
    // Health check
    res.writeHead(200, { ...corsHeaders(requestOrigin), "Content-Type": "application/json" });
    res.end(
      JSON.stringify({
        status: "healthy",
        mode: "http",
        interface: "mcp-http",
        transports: ["streamable-http"],
        mcp_endpoint: "/mcp",
        port: PORT,
        port_source: HTTP_PORT.source,
        auth_enabled: !!AUTH_TOKEN,
        cors_mode: getCorsConfig().isDevelopment ? "development" : "production",
        warnings: HTTP_PORT.warnings,
        timestamp: new Date().toISOString(),
      })
    );
    transaction.finish();
    return;
  }

  // ── Readiness probe — checks PostgreSQL, Neo4j, MCP initialization ────────
  if (url.pathname === "/ready" || url.pathname === "/api/ready") {
    const result = await checkReadiness();
    const statusCode = result.ready ? 200 : 503;
    res.writeHead(statusCode, { ...corsHeaders(requestOrigin), "Content-Type": "application/json" });
    res.end(JSON.stringify(result));
    transaction.finish();
    return;
  }

  // ── Liveness probe — simple process heartbeat ─────────────────────────────
  if (url.pathname === "/live" || url.pathname === "/api/live") {
    const uptime = process.uptime();
    res.writeHead(200, { ...corsHeaders(requestOrigin), "Content-Type": "application/json" });
    res.end(JSON.stringify({ alive: true, uptime, timestamp: new Date().toISOString() }));
    transaction.finish();
    return;
  }

  // ── Prometheus metrics — requires auth (same as MCP endpoint) ─────────────
  if (url.pathname === "/metrics" || url.pathname === "/api/metrics") {
    if (!validateBearerAuth(req)) {
      res.writeHead(401, {
        ...corsHeaders(req.headers["origin"]),
        "Content-Type": "text/plain",
        "WWW-Authenticate": 'Bearer realm="Allura Memory Metrics"',
      });
      res.end("Unauthorized\n");
      transaction.finish();
      return;
    }
    const metricsText = collectMetrics();
    res.writeHead(200, {
      ...corsHeaders(req.headers["origin"]),
      "Content-Type": "text/plain; version=0.0.4; charset=utf-8",
      "Cache-Control": "no-cache, no-store, must-revalidate",
    });
    res.end(metricsText);
    transaction.finish();
    return;
  }

  // ── 404 for unknown routes ────────────────────────────────────────────────
  res.writeHead(404, { ...corsHeaders(requestOrigin), "Content-Type": "application/json" });
  res.end(JSON.stringify({ error: "Not found" }));
  transaction.finish();
});

server.listen(PORT, () => {
  console.log(`Allura Memory Canonical HTTP Gateway listening on port ${PORT}`);
  console.log(`Port source: ${HTTP_PORT.source}`);
  for (const warning of HTTP_PORT.warnings) {
    console.warn(`[deprecated-port-contract] ${warning}`);
  }
  console.log("");
  console.log("Transports:");
  console.log("  MCP Streamable HTTP:  POST/GET/DELETE /mcp  (primary — OpenAI Agents SDK compatible)");
  console.log("  Health:                GET /health");
  console.log("  Readiness:            GET /ready  (checks PostgreSQL, Neo4j, MCP)");
  console.log("  Liveness:             GET /live   (process heartbeat)");
  console.log("  Metrics:              GET /metrics (Prometheus format, auth required)");
  console.log("");
  console.log(`Auth: ${AUTH_TOKEN ? "Bearer token required" : "No auth token set (development mode)"}`);
  console.log("");
  console.log("Available tools: memory_add, memory_search, memory_get, memory_list, memory_delete");
});

// Graceful shutdown
process.on("SIGTERM", () => {
  console.log("Shutting down...");
  server.close(() => {
    mcpTransport.close().then(() => {
      process.exit(0);
    });
  });
});

process.on("SIGINT", () => {
  console.log("Interrupted, shutting down...");
  server.close(() => {
    mcpTransport.close().then(() => {
      process.exit(0);
    });
  });
});
