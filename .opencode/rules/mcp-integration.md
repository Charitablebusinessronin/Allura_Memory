---
description: MCP server integration patterns
globs: ["src/mcp/**", ".claude/**"]
---

# MCP Integration

## THE RULE
**NEVER `docker exec` for DB operations. ALWAYS use `mcp__MCP_DOCKER__*` tools.**

## Native Memory Stack

Use native MCP_DOCKER memory servers for database and graph access:

| Server | Use | Required config |
|------|-----|------------------|
| `neo4j-memory` | Primary memory/graph server | `url`, `username`, `database`, secret `password` |
| `database-server` | PostgreSQL / SQL access | `database_url` |
| `neo4j-cypher` | Fallback direct Cypher access | `url`, `username`, `database`, secret `password` |

## Boot Sequence (mcp-find → mcp-config-set → mcp-add)

The Docker MCP Toolkit is a gateway to 300+ signed, containerized MCP servers.

```
# 1. Find what's available
mcp__MCP_DOCKER__mcp-find("keyword")
→ returns: name, description, required_secrets

# 2. Configure it
mcp__MCP_DOCKER__mcp-config-set("server-name")

# 3. Add it — tools surface immediately
mcp__MCP_DOCKER__mcp-add("server-name")
→ new tools appear as mcp__MCP_DOCKER__<tool_name>

# Preferred order: neo4j-memory → database-server → neo4j-cypher
```

## Connectivity

- If the MCP server runs in Docker and needs to reach services on the host, prefer `host.docker.internal`.
- Use `localhost` only when the target is reachable from the same network namespace as the MCP server.
- This matters most for `neo4j-memory`, `database-server`, and `neo4j-cypher` connection URLs.

## Active Tool Stack

### Web Research
| Tool | Use |
|------|-----|
| `mcp__MCP_DOCKER__tavily_search` | Fast current search |
| `mcp__MCP_DOCKER__tavily_research` | Deep multi-source |
| `mcp__MCP_DOCKER__tavily_crawl` | Crawl from root URL |
| `mcp__MCP_DOCKER__tavily_extract` | Extract specific URL |
| `mcp__MCP_DOCKER__web_search_exa` | Neural/semantic search |

### Browser Automation (HyperBrowser)
| Tool | Use |
|------|-----|
| `mcp__MCP_DOCKER__scrape_webpage` | Single page content |
| `mcp__MCP_DOCKER__crawl_webpages` | Multi-page crawl |
| `mcp__MCP_DOCKER__extract_structured_data` | JSON via schema |
| `mcp__MCP_DOCKER__browser_use_agent` | Explicit tasks (cheapest) |
| `mcp__MCP_DOCKER__claude_computer_use_agent` | Complex cloud browser |
| `mcp__MCP_DOCKER__openai_computer_use_agent` | General cloud browser |

### Live Docs (Context7)
| Tool | Use |
|------|-----|
| `mcp__MCP_DOCKER__resolve-library-id` | Library → Context7 ID |
| `mcp__MCP_DOCKER__get-library-docs` | Fetch live docs |

### Native Memory Servers
| Tool | Use |
|------|-----|
| `neo4j-memory` tools | Primary memory retrieval and graph operations |
| `database-server` tools | PostgreSQL reads/writes and SQL operations |
| `neo4j-cypher` tools | Direct Cypher reads/writes when needed |

## Server Policy
- MCP_DOCKER native memory servers are the canonical memory surface for this repo.
- Default stack: `neo4j-memory` first, `database-server` second, `neo4j-cypher` only when direct Cypher is required.
- Configure servers before activation; keep secrets out of files and plain text.

## Settings
Use approved Docker-backed MCP servers only; prefer on-demand activation through MCP Docker Toolkit.
