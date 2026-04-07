---
description: MCP Builder skill for creating MCP servers. Use when building new MCP tools, integrating external APIs, or extending the MCP protocol.
mode: subagent
temperature: 0.3
permissions:
  read: allow
  edit: allow
  bash:
    "bun *": allow
    "npm *": deny
    "*": ask
---

# MCP Builder Skill

Build MCP (Model Context Protocol) servers to integrate external APIs and services.

## MCP Server Structure

```typescript
// src/mcp/my-server.ts
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";

const server = new Server(
  { name: "my-server", version: "1.0.0" },
  { capabilities: { tools: {} } }
);

server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: [
    {
      name: "my_tool",
      description: "What this tool does",
      inputSchema: {
        type: "object",
        properties: {
          param1: { type: "string" }
        },
        required: ["param1"]
      }
    }
  ]
}));

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  if (request.params.name === "my_tool") {
    const { param1 } = request.params.arguments;
    // Implementation
    return {
      content: [{ type: "text", text: result }]
    };
  }
});

const transport = new StdioServerTransport();
await server.connect(transport);
```

## Tool Schema Guidelines

1. **Clear naming**: `service_action` (e.g., `postgres_query`)
2. **Description**: Explain what it does and when to use it
3. **Parameters**: Define types and requirements
4. **Error handling**: Return structured errors

## Integration Pattern

```json
// .opencode/mcp.json
{
  "mcpServers": {
    "my-server": {
      "command": "bun",
      "args": ["run", "src/mcp/my-server.ts"]
    }
  }
}
```

## Security

- NEVER pass credentials in tool schemas
- Use environment variables for secrets
- Validate all inputs before execution
- Log tool calls for audit
