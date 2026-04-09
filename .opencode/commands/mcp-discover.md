# /mcp-discover

**Discover available MCP servers.**

List all MCP servers (approved + pending) matching a keyword.

## Usage

```bash
/mcp-discover [keyword]
```

## Examples

```bash
# Discover all servers
/mcp-discover

# Discover database servers
/mcp-discover database

# Discover search tools
/mcp-discover search
```

## Output

```
🔍 MCP Discovery Results

Approved (Ready to Load):
  ✅ allura-memory: Allura Memory Server
  ✅ tavily-search: Tavily Search + Research

Pending Approval:
  ⏳ postgresql-mcp: PostgreSQL MCP — Requires DATABASE_URL env var
  ⏳ notion-mcp: Notion MCP — HITL approval required

To request approval: /mcp-approve <server-id>
To load: /mcp-load <server-id>
```

## Workflow

1. **Discover** → See what's available
2. **Request approval** → `/mcp-approve <server-id>`
3. **Brooks approves** → Updates registry
4. **Load** → `/mcp-load <server-id>`
5. **Tools available** → `mcp__MCP_DOCKER__*`

## Implementation

Handler: `.opencode/harness/mcp-plugin-loader.ts`

Registry: `.opencode/plugin/mcp-registry.yaml`
