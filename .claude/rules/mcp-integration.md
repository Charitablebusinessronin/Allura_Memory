---
description: MCP server integration patterns
globs: ["src/mcp/**", ".claude/**"]
---

# MCP Integration

## THE RULE
**NEVER `docker exec` for DB operations. ALWAYS use `mcp__MCP_DOCKER__*` tools.**

## Security Patterns

**NEVER** expose sensitive information:
- Don't log MCP credentials or API keys
- Don't expose internal error details to users
- Use environment variables for MCP server credentials
- Validate and sanitize all inputs to MCP tools
- Follow principle of least privilege

**Configuration Pattern:**
- Never hardcode secrets or credentials in MCP configs
- Provide sensible defaults
- Validate required configuration on startup
- Document all configuration options
- Use different configs for dev/staging/production

## Error Handling

**ALWAYS** handle errors gracefully:
- Catch specific MCP errors, not generic ones
- Log errors with context (but not credentials)
- Return meaningful error messages
- Don't expose internal implementation details
- Implement circuit breakers for failing MCP servers

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
| `mcp__MCP_DOCKER__perplexica_search` | Self-hosted AI search (no API key) |
| `mcp__MCP_DOCKER__tavily_crawl` | Crawl from root URL (catalog) |
| `mcp__MCP_DOCKER__tavily_extract` | Extract specific URL (catalog) |
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

## Boot Policy — Docker Toolkit On-Demand

> **ADR 2026-04-19b:** Local allura-memory MCP usage is retired. Agents use MCP_DOCKER discovery and approved Docker-backed servers only.

### Default graph surface
| Server | Why |
|--------|-----|
| Allura Brain | Canonical memory search/write surface for this repo. |

### What loads on-demand (via mcp-find → mcp-add)
| Server | Trigger |
|--------|---------|
| `exa` | Web search needed |
| `perplexica` | Web search needed |
| `hyperbrowser` | Browser automation needed |
| `context7` | Live library docs needed |
| `notion` | Notion page read/write needed |

### On-Demand Load Pattern
```
# 1. Find the server
mcp-find("perplexica")

# 2. Add it (tools surface immediately)
mcp-add("perplexica")

# 3. Use the tools
mcp__MCP_DOCKER__perplexica_search("query")
```

## Settings
`.claude/settings.json` should only define approved Docker-backed MCP servers. No local allura-memory MCP server should be configured.
