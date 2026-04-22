# /mcp-load

Load an approved MCP server and activate its tools.

## Usage

```
/mcp-load <server-id>
```

## Examples

```
/mcp-load allura-memory         # Load local Allura memory engine
/mcp-load tavily                # Load Tavily web search + crawl
/mcp-load postgresql            # Load PostgreSQL client (if approved)
```

## How It Works

1. Validates server is in approved list
2. Checks environment variables (if required)
3. Invokes `mcp_add(server-id)` via MCP Docker Toolkit
4. Logs `MCP_LOADED` event to PostgreSQL
5. New tools become available immediately

## Prerequisites

- Server must be approved (via `/mcp-approve` or already in approved list)
- Environment variables must be set (if required)
- Example: `export TAVILY_API_TOKEN=...`

## Result

```json
{
  "event": "MCP_LOADED",
  "server_id": "tavily",
  "tools_available": [
    "mcp__MCP_DOCKER__tavily_search",
    "mcp__MCP_DOCKER__tavily_research",
    "mcp__MCP_DOCKER__tavily_crawl"
  ]
}
```

**Note:** Loading is idempotent (safe to repeat).
