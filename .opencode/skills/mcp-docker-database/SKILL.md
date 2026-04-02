---
description: "[DEPRECATED] Use mcp-docker lifecycle + project-specific configured tools"
argument-hint: ""
allowed-tools: []
---

# MCP Docker Database Operations [DEPRECATED]

> ⚠️ **This skill is deprecated.** Do not use for new work.

## Migration Guide

| Need | Use Instead |
|------|-------------|
| MCP server lifecycle | [`mcp-docker`](https://opencode.ai/skills/mcp-docker) — use `MCP_DOCKER_mcp-find`, `MCP_DOCKER_mcp-config-set`, `MCP_DOCKER_mcp-add`, `MCP_DOCKER_mcp-exec` |
| Database operations | Project-specific configured servers (e.g., `database-server`, `neo4j-cypher`) via `MCP_DOCKER_mcp-exec` |
| Memory behavior | [`mcp-docker`](https://opencode.ai/skills/mcp-docker) |

## Universal Rule (Still Valid)

❌ **NEVER:** `docker exec knowledge-postgres psql ...`  
❌ **NEVER:** `docker exec knowledge-neo4j cypher-shell ...`  
✅ **ALWAYS:** MCP_DOCKER lifecycle + configured servers

## Database Operations via MCP

```typescript
// Find and configure servers
MCP_DOCKER_mcp-find({ query: "postgres" })
MCP_DOCKER_mcp-config-set({ server: "database-server", config: {...} })
MCP_DOCKER_mcp-add({ name: "database-server", activate: true })

// Execute via mcp-exec (no direct tool calls)
MCP_DOCKER_mcp-exec({
  name: "database-server",
  tool: "query",
  arguments: {...}
})

MCP_DOCKER_mcp-exec({
  name: "neo4j-cypher",
  tool: "execute",
  arguments: {...}
})
```

## Legacy Tools

All direct `MCP_DOCKER_*` database operations have been removed.
Use `MCP_DOCKER_mcp-exec` with configured servers instead.

---
*This file is a minimal deprecation wrapper. Migrate to mcp-docker and configured servers.*
