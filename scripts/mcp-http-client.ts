#!/usr/bin/env bun
/**
 * MCP HTTP Client — bridges stdio (Claude Code) to the HTTP gateway
 * Allows Claude Code to connect to the Docker-based MCP server via HTTP
 *
 * Usage: bun run scripts/mcp-http-client.ts
 * Configured in: ~/.claude/settings.json (mcpServers.allura-memory)
 */

import { EventEmitter } from "node:events";

const HTTP_GATEWAY = process.env.ALLURA_MCP_HTTP || "http://localhost:5888/mcp";

interface JSONRPCRequest {
  jsonrpc: "2.0";
  id: string | number | null;
  method: string;
  params?: unknown;
}

interface JSONRPCResponse {
  jsonrpc: "2.0";
  id: string | number | null;
  result?: unknown;
  error?: {
    code: number;
    message: string;
    data?: unknown;
  };
}

class MCPHTTPClient extends EventEmitter {
  private stdout: NodeJS.WritableStream;
  private nextId = 1;

  constructor() {
    super();
    this.stdout = process.stdout;

    // Handle stdin for incoming JSON-RPC messages
    process.stdin.on("data", (chunk) => this.handleInput(chunk));
    process.stdin.on("end", () => this.handleClose());
  }

  private async handleInput(chunk: Buffer) {
    const lines = chunk.toString().split("\n").filter((line) => line.trim());

    for (const line of lines) {
      try {
        const request = JSON.parse(line) as JSONRPCRequest;
        await this.forwardRequest(request);
      } catch (error) {
        const errorMsg =
          error instanceof Error ? error.message : String(error);
        const response: JSONRPCResponse = {
          jsonrpc: "2.0",
          id: null,
          error: {
            code: -32700,
            message: "Parse error",
            data: errorMsg,
          },
        };
        this.send(response);
      }
    }
  }

  private async forwardRequest(request: JSONRPCRequest) {
    try {
      const response = await fetch(HTTP_GATEWAY, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(request),
      });

      if (!response.ok) {
        throw new Error(
          `HTTP ${response.status}: ${response.statusText}`
        );
      }

      const data = (await response.json()) as JSONRPCResponse;
      this.send(data);
    } catch (error) {
      const errorMsg =
        error instanceof Error ? error.message : String(error);
      const response: JSONRPCResponse = {
        jsonrpc: "2.0",
        id: request.id,
        error: {
          code: -32603,
          message: "Internal error",
          data: errorMsg,
        },
      };
      this.send(response);
    }
  }

  private send(response: JSONRPCResponse) {
    this.stdout.write(JSON.stringify(response) + "\n");
  }

  private handleClose() {
    process.exit(0);
  }
}

// Start the client
new MCPHTTPClient();

// Health check: verify gateway is reachable
(async () => {
  try {
    const health = await fetch(`${HTTP_GATEWAY.replace("/mcp", "")}/health`);
    if (health.ok) {
      const data = (await health.json()) as Record<string, unknown>;
      console.error(`[MCP] Connected to gateway: ${JSON.stringify(data)}`);
    }
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error(`[MCP] Warning: Could not reach gateway — ${msg}`);
  }
})();
