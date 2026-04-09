# MCP Docker Plugin for OpenCode

> [!NOTE]
> **AI-Assisted Documentation**
> Portions of this document were drafted with the assistance of an AI language model.
> Content has been reviewed against Brooksian architectural principles.
> When in doubt, defer to code, schemas, and team consensus.

## Overview

Wraps the MCP Docker Toolkit as an OpenCode plugin. Provides:
- `mcp_find(keyword)` — Discover available MCP servers
- `mcp_add(server_name)` — Load a server (tools become available immediately)
- `mcp_config_set(server, config)` — Configure server settings

## Why This Plugin?

The MCP Docker Toolkit already provides 300+ signed, containerized MCP servers. Instead of maintaining a separate registry, we wrap the toolkit directly:

```
mcp_find("database")
  ↓
Returns: [{name: "postgresql-mcp", description: "..."}, ...]
  ↓
mcp_add("postgresql-mcp")
  ↓
Tools available: mcp__MCP_DOCKER__postgresql_mcp__*
```

## Installation

Add to `.opencode/config.json`:

```json
{
  "plugin": ["mcp-docker"],
  "mcpServers": {
    "docker": {
      "command": ["docker", "run", "-i", "--rm", "mcp/docker-toolkit"],
      "env": {
        "DOCKER_HOST": "${DOCKER_HOST}"
      }
    }
  }
}
```

## Available Tools

### Discovery
| Tool | Purpose |
|------|---------|
| `mcp__MCP_DOCKER__mcp-find` | Search catalog by keyword |
| `mcp__MCP_DOCKER__mcp-add` | Add server to session |
| `mcp__MCP_DOCKER__mcp-remove` | Remove server from session |
| `mcp__MCP_DOCKER__mcp-config-set` | Configure server settings |

### Web Research
| Tool | Purpose |
|------|---------|
| `mcp__MCP_DOCKER__tavily_search` | Fast web search |
| `mcp__MCP_DOCKER__tavily_research` | Deep multi-source research |
| `mcp__MCP_DOCKER__tavily_crawl` | Crawl from root URL |
| `mcp__MCP_DOCKER__tavily_extract` | Extract from specific URL |
| `mcp__MCP_DOCKER__web_search_exa` | Neural/semantic search |

### Browser Automation
| Tool | Purpose |
|------|---------|
| `mcp__MCP_DOCKER__scrape_webpage` | Single page → markdown |
| `mcp__MCP_DOCKER__crawl_webpages` | Multi-page crawl |
| `mcp__MCP_DOCKER__extract_structured_data` | JSON via schema |
| `mcp__MCP_DOCKER__browser_use_agent` | Explicit browser tasks |
| `mcp__MCP_DOCKER__claude_computer_use_agent` | Complex cloud browser |

### Database
| Tool | Purpose |
|------|---------|
| `mcp__MCP_DOCKER__query_database` | Natural language SQL |
| `mcp__MCP_DOCKER__execute_sql` | Raw SQL reads |
| `mcp__MCP_DOCKER__insert_data` | Append events only |
| `mcp__MCP_DOCKER__read_neo4j_cypher` | Neo4j reads |
| `mcp__MCP_DOCKER__write_neo4j_cypher` | Neo4j writes (SUPERSEDES) |

### Notion
| Tool | Purpose |
|------|---------|
| `mcp__MCP_DOCKER__notion-search` | Search workspace |
| `mcp__MCP_DOCKER__notion-fetch` | Get page/database |
| `mcp__MCP_DOCKER__notion-create-pages` | Create pages |
| `mcp__MCP_DOCKER__notion-update-page` | Update pages |

## Governance

### Explicit Approval (Brooksian)

The plugin enforces **explicit approval** before loading new servers:

```typescript
// In harness/mcp-plugin-loader.ts
async loadServer(serverId: string): Promise<LoadResult> {
  // Step 1: Check registry for approval
  const server = this.registry.find(s => s.id === serverId);
  
  if (!server || !server.approved) {
    return { 
      success: false, 
      message: "Server not approved. Use mcp-approve first." 
    };
  }
  
  // Step 2: Call MCP Docker toolkit
  await mcp_add(serverId);
  
  // Step 3: Log to Postgres
  await this.logEvent({
    event_type: "MCP_LOADED",
    agent_id: "brooks",
    metadata: { server: serverId }
  });
  
  return { success: true };
}
```

### Registry vs. Plugin

| Approach | Pros | Cons |
|----------|------|------|
| **Registry only** | Full control, explicit approval | Manual curation |
| **Plugin only** | Auto-discovery, 300+ servers | No governance |
| **Plugin + Registry** | Discovery + approval | Two layers |

**Recommendation**: Keep the registry for governance, but use the plugin for discovery.

## Workflow

```
# Discover
mcp_find("database")
  → Returns: postgresql-mcp, neo4j-cypher, etc.

# Approve (Brooks decision)
mcp-approve postgresql-mcp
  → Updates registry: approved: true

# Load
mcp_add("postgresql-mcp")
  → Tools available: mcp__MCP_DOCKER__postgresql_mcp__*
```

## Integration with Allura Memory

The `allura-memory` MCP server is already approved and loaded:

```yaml
# In mcp-registry.yaml
- id: "allura-memory"
  name: "Allura Memory Server"
  source: "local"
  command: ["bun", "run", "src/mcp/memory-server.ts"]
  approved: true
```

This provides:
- `memory_retrieve` — Query past decisions
- `memory_write` — Log events
- `memory_propose_insight` — Promote to knowledge graph

## Next Steps

1. **Wire Postgres logging** — Connect `logEvent()` to `mcp__MCP_DOCKER__insert_data`
2. **Add approval flow** — Route `/mcp-approve` through the harness
3. **Test discovery** — Verify `mcp_find` returns catalog
4. **Document servers** — Add usage notes for each approved server