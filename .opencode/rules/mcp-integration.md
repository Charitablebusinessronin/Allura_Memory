---
description: MCP server integration patterns
globs: ["src/mcp/**", ".claude/**"]
---

# MCP Integration

## THE RULE
**NEVER `docker exec` for DB operations. ALWAYS use `mcp__MCP_DOCKER__*` tools.**

## Tool Discovery (mcp-find → mcp-add)

The Docker MCP Toolkit is a gateway to 300+ signed, containerized MCP servers.

```
# 1. Find what's available
mcp__MCP_DOCKER__mcp-find("keyword")
→ returns: name, description, required_secrets

# 2. Add it — tools surface immediately
mcp__MCP_DOCKER__mcp-add("server-name")
→ new tools appear as mcp__MCP_DOCKER__<tool_name>

# No required_secrets → add immediately
# Has required_secrets → env vars must be set first
```

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

### Allura Brain (Database)
| Tool | Use |
|------|-----|
| `mcp__MCP_DOCKER__query_database` | NL SQL reads |
| `mcp__MCP_DOCKER__execute_sql` | Raw SQL reads |
| `mcp__MCP_DOCKER__insert_data` | Append events only |
| `mcp__MCP_DOCKER__read_neo4j_cypher` | Neo4j reads |
| `mcp__MCP_DOCKER__write_neo4j_cypher` | Neo4j writes (SUPERSEDES) |

## Server Policy
- `neo4j-memory` is the default safe graph server for most agents.
- `neo4j-cypher` is restricted and should only be loaded for governed graph maintenance.
- Do not configure or load a local `allura-memory` MCP server.

## Settings
Use approved Docker-backed MCP servers only; prefer on-demand activation through MCP Docker Toolkit.
