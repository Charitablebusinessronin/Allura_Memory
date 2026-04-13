/**
 * LEGACY — Do not expose to AI agents.
 * 
 * This is the legacy OpenClaw HTTP gateway that exposes mixed tools.
 * Use src/mcp/canonical-http-gateway.ts for canonical memory operations.
 * 
 * Kept for: openclaw-gateway HTTP surface, external integrations.
 * Removal target: after integrations are ported to canonical.
 * 
 * Original file: src/mcp/openclaw-gateway-http.ts (moved to legacy/)
 */


import { createServer } from "http";
import { parse } from "url";
import { config } from "dotenv";
import { getPort } from "../../lib/config/ports.js";
import { corsHeaders as getCorsHeaders, isPreflightRequest, getCorsConfig } from "@/lib/cors/index.js";
import { initSentry, captureException, extractRequestContext, startTransaction } from "@/lib/observability/index.js";
// Load environment variables
config();

// Initialize observability
initSentry();

const PORT = getPort("openclaw", "OPENCLAW_PORT");

// Import MCP tools
import { memorySearch, memoryStore, adasRunSearch, adasGetProposals, adasApproveDesign } from "./tools.js";

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

// CORS headers — resolved per-request via getCorsHeaders()
// In development mode (no ALLURA_CORS_ORIGINS), allows all origins.
// In production mode, validates against the configured allowlist.

/**
 * Resolve CORS headers for a request origin.
 * Uses the dynamic CORS configuration instead of hardcoded wildcard.
 */
function cors(origin?: string): Record<string, string> {
  return getCorsHeaders(origin);
}

// WhatsApp webhook verification token
const WHATSAPP_VERIFY_TOKEN = process.env.WHATSAPP_VERIFY_TOKEN || "test_verify_token";

// Store received messages for testing
const receivedMessages: Array<{
  id: string;
  from: string;
  text: string;
  timestamp: string;
  processed: boolean;
}> = [];

// WhatsApp webhook verification (Meta requires this)
async function verifyWhatsAppWebhook(query: Record<string, unknown>, origin?: string): Promise<Response> {
  const mode = query["hub.mode"] as string;
  const token = query["hub.verify_token"] as string;
  const challenge = query["hub.challenge"] as string;

  if (mode === "subscribe" && token === WHATSAPP_VERIFY_TOKEN) {
    console.log(`✅ WhatsApp webhook verified`);
    return {
      status: 200,
      headers: { "Content-Type": "text/plain", ...cors(origin) },
      body: challenge,
    };
  }

  console.warn(`❌ WhatsApp webhook verification failed`);
  return {
    status: 403,
    headers: { "Content-Type": "application/json", ...cors(origin) },
    body: JSON.stringify({ error: "Verification failed" }),
  };
}

// Process incoming WhatsApp message
async function processWhatsAppMessage(body: unknown, origin?: string): Promise<Response> {
  try {
    const data = body as {
      object?: string;
      entry?: Array<{
        id: string;
        changes: Array<{
          value: {
            messaging_product: string;
            metadata: { display_phone_number: string; phone_number_id: string };
            contacts?: Array<{ wa_id: string; profile: { name: string } }>;
            messages?: Array<{
              id: string;
              from: string;
              timestamp: string;
              type: string;
              text?: { body: string };
            }>;
          };
        }>;
      }>;
    };

    if (data.object !== "whatsapp_business_api") {
      return {
        status: 400,
        headers: { "Content-Type": "application/json", ...cors(origin) },
        body: JSON.stringify({ error: "Invalid object type" }),
      };
    }

    // Process each entry
    for (const entry of data.entry || []) {
      for (const change of entry.changes || []) {
        const value = change.value;
        
        if (value.messages) {
          for (const message of value.messages) {
            if (message.type === "text" && message.text) {
              const msg = {
                id: message.id,
                from: message.from,
                text: message.text.body,
                timestamp: message.timestamp,
                processed: false,
              };
              
              receivedMessages.push(msg);
              console.log(`📱 WhatsApp message received from ${message.from}: ${message.text.body}`);
              
              // TODO: Route to agent system
              // For now, just acknowledge receipt
              msg.processed = true;
            }
          }
        }
      }
    }

    return {
      status: 200,
      headers: { "Content-Type": "application/json", ...cors(origin) },
      body: JSON.stringify({ status: "received" }),
    };
  } catch (error) {
    console.error("Error processing WhatsApp message:", error);
    captureException(error, { tags: { component: "openclaw-gateway", endpoint: "whatsapp" } });
    return {
      status: 500,
      headers: { "Content-Type": "application/json", ...cors(origin) },
      body: JSON.stringify({ error: "Internal server error" }),
    };
  }
}

// Get received messages (for testing)
async function getReceivedMessages(origin?: string): Promise<Response> {
  return {
    status: 200,
    headers: { "Content-Type": "application/json", ...cors(origin) },
    body: JSON.stringify({
      messages: receivedMessages,
      count: receivedMessages.length,
    }),
  };
}

// Send test message (simulates receiving a message)
async function sendTestMessage(body: unknown, origin?: string): Promise<Response> {
  try {
    const { from, text } = body as { from?: string; text?: string };
    
    if (!from || !text) {
      return {
        status: 400,
        headers: { "Content-Type": "application/json", ...cors(origin) },
        body: JSON.stringify({ error: "Missing 'from' or 'text' field" }),
      };
    }

    const msg = {
      id: `test_${Date.now()}`,
      from,
      text,
      timestamp: Date.now().toString(),
      processed: true,
    };
    
    receivedMessages.push(msg);
    console.log(`🧪 Test message received from ${from}: ${text}`);

    return {
      status: 200,
      headers: { "Content-Type": "application/json", ...cors(origin) },
      body: JSON.stringify({ 
        status: "test message received",
        message: msg,
      }),
    };
  } catch (error) {
    return {
      status: 500,
      headers: { "Content-Type": "application/json", ...cors(origin) },
      body: JSON.stringify({ error: "Failed to process test message" }),
    };
  }
}

// Health check endpoint
async function healthCheck(origin?: string): Promise<Response> {
  return {
    status: 200,
    headers: { "Content-Type": "application/json", ...cors(origin) },
    body: JSON.stringify({
      status: "healthy",
      service: "openclaw-gateway",
      version: "1.0.0",
      port: PORT,
      cors_mode: getCorsConfig().isDevelopment ? "development" : "production",
      tools: Object.keys(tools),
    }),
  };
}

// List tools endpoint
async function listTools(origin?: string): Promise<Response> {
  return {
    status: 200,
    headers: { "Content-Type": "application/json", ...cors(origin) },
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
  args: unknown,
  origin?: string
): Promise<Response> {
  const tool = tools[toolName];

  if (!tool) {
    return {
      status: 404,
      headers: { "Content-Type": "application/json", ...cors(origin) },
      body: JSON.stringify({ error: `Tool not found: ${toolName}` }),
    };
  }

  try {
    const result = await tool(args);
    return {
      status: 200,
      headers: { "Content-Type": "application/json", ...cors(origin) },
      body: JSON.stringify(result),
    };
  } catch (error) {
    captureException(error, { tags: { component: "openclaw-gateway", tool: toolName } });
    return {
      status: 500,
      headers: { "Content-Type": "application/json", ...cors(origin) },
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
  const origin = req.headers["origin"];

  // CORS preflight
  if (req.method === "OPTIONS") {
    return {
      status: 204,
      headers: cors(origin),
      body: "",
    };
  }

  // Health check
  if (path === "/health" || path === "/api/health") {
    return healthCheck(origin);
  }

  // List tools
  if (path === "/tools" || path === "/api/tools") {
    if (req.method === "GET") {
      return listTools(origin);
    }
  }

  // Execute tool
  const toolMatch = path.match(/^\/tools\/([a-z_]+)$/);
  if (toolMatch && req.method === "POST") {
    return executeTool(toolMatch[1], req.body, origin);
  }

  // API execute tool
  if (path === "/api/execute" && req.method === "POST") {
    const { tool, args } = req.body as { tool: string; args: unknown };
    return executeTool(tool, args, origin);
  }

  // WhatsApp webhook verification (GET)
  if (path === "/webhook/whatsapp" && req.method === "GET") {
    return verifyWhatsAppWebhook(url.query as Record<string, unknown>, origin);
  }

  // WhatsApp webhook message receiver (POST)
  if (path === "/webhook/whatsapp" && req.method === "POST") {
    return processWhatsAppMessage(req.body, origin);
  }

  // Get received messages (for testing)
  if (path === "/webhook/whatsapp/messages" && req.method === "GET") {
    return getReceivedMessages(origin);
  }

  // Send test message (simulates receiving a message)
  if (path === "/webhook/whatsapp/test" && req.method === "POST") {
    return sendTestMessage(req.body, origin);
  }

  // 404
  return {
    status: 404,
    headers: { "Content-Type": "application/json", ...cors(origin) },
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

  // Start a Sentry performance transaction
  const transaction = startTransaction({
    name: `${req.method ?? "GET"} ${(req.url ?? "/").split("?")[0]}`,
    op: "http.server",
  });

  let response: Response;
  try {
    response = await handleRequest(request);
  } catch (error) {
    captureException(error, extractRequestContext(req as any));
    response = {
      status: 500,
      headers: { "Content-Type": "application/json", ...cors(req.headers["origin"]) },
      body: JSON.stringify({ error: "Internal server error" }),
    };
  } finally {
    transaction.finish();
  }

  // Send response
  res.writeHead(response.status, response.headers);
  res.end(response.body);
});

// Start server
server.listen(PORT, () => {
  console.log(`🚀 OpenClaw Gateway running on http://localhost:${PORT}`);
  console.log(`📡 Health check: http://localhost:${PORT}/health`);
  console.log(`🔧 Tools endpoint: http://localhost:${PORT}/tools`);
  console.log(`📱 WhatsApp webhook: http://localhost:${PORT}/webhook/whatsapp`);
  console.log(`🧪 WhatsApp test: POST http://localhost:${PORT}/webhook/whatsapp/test`);
  console.log(`📨 WhatsApp messages: GET http://localhost:${PORT}/webhook/whatsapp/messages`);
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