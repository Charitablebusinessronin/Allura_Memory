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
import { getPort } from "../../lib/config/ports";

// Load environment variables
config();

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

// CORS headers
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

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
async function verifyWhatsAppWebhook(query: Record<string, unknown>): Promise<Response> {
  const mode = query["hub.mode"] as string;
  const token = query["hub.verify_token"] as string;
  const challenge = query["hub.challenge"] as string;

  if (mode === "subscribe" && token === WHATSAPP_VERIFY_TOKEN) {
    console.log(`✅ WhatsApp webhook verified`);
    return {
      status: 200,
      headers: { "Content-Type": "text/plain", ...corsHeaders },
      body: challenge,
    };
  }

  console.warn(`❌ WhatsApp webhook verification failed`);
  return {
    status: 403,
    headers: { "Content-Type": "application/json", ...corsHeaders },
    body: JSON.stringify({ error: "Verification failed" }),
  };
}

// Process incoming WhatsApp message
async function processWhatsAppMessage(body: unknown): Promise<Response> {
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
        headers: { "Content-Type": "application/json", ...corsHeaders },
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
      headers: { "Content-Type": "application/json", ...corsHeaders },
      body: JSON.stringify({ status: "received" }),
    };
  } catch (error) {
    console.error("Error processing WhatsApp message:", error);
    return {
      status: 500,
      headers: { "Content-Type": "application/json", ...corsHeaders },
      body: JSON.stringify({ error: "Internal server error" }),
    };
  }
}

// Get received messages (for testing)
async function getReceivedMessages(): Promise<Response> {
  return {
    status: 200,
    headers: { "Content-Type": "application/json", ...corsHeaders },
    body: JSON.stringify({
      messages: receivedMessages,
      count: receivedMessages.length,
    }),
  };
}

// Send test message (simulates receiving a message)
async function sendTestMessage(body: unknown): Promise<Response> {
  try {
    const { from, text } = body as { from?: string; text?: string };
    
    if (!from || !text) {
      return {
        status: 400,
        headers: { "Content-Type": "application/json", ...corsHeaders },
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
      headers: { "Content-Type": "application/json", ...corsHeaders },
      body: JSON.stringify({ 
        status: "test message received",
        message: msg,
      }),
    };
  } catch (error) {
    return {
      status: 500,
      headers: { "Content-Type": "application/json", ...corsHeaders },
      body: JSON.stringify({ error: "Failed to process test message" }),
    };
  }
}

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

  // WhatsApp webhook verification (GET)
  if (path === "/webhook/whatsapp" && req.method === "GET") {
    return verifyWhatsAppWebhook(url.query as Record<string, unknown>);
  }

  // WhatsApp webhook message receiver (POST)
  if (path === "/webhook/whatsapp" && req.method === "POST") {
    return processWhatsAppMessage(req.body);
  }

  // Get received messages (for testing)
  if (path === "/webhook/whatsapp/messages" && req.method === "GET") {
    return getReceivedMessages();
  }

  // Send test message (simulates receiving a message)
  if (path === "/webhook/whatsapp/test" && req.method === "POST") {
    return sendTestMessage(req.body);
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