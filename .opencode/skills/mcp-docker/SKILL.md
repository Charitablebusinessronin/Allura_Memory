---
name: mcp-docker
description: Discover, configure, and manage MCP servers from Docker Hub's MCP Catalog using MCP_DOCKER tools. Use this skill when you need to add new MCP tools like Neo4j, PostgreSQL, GitHub, web search, databases, or any containerized MCP server. This skill provides workflows for finding MCP servers with MCP_DOCKER_mcp-find, configuring them with MCP_DOCKER_mcp-config-set, adding them with MCP_DOCKER_mcp-add, and executing their tools with MCP_DOCKER_mcp-exec.
---

# MCP Docker

## Overview

This skill enables dynamic discovery and management of MCP (Model Context Protocol) servers from Docker Hub's MCP Catalog using the MCP_DOCKER toolset. Rather than pre-installing all possible MCP tools, you can discover, configure, and add MCP servers on-demand during your session.

For memory operations in this repository, **always use native MCP-packaged memory servers only** (no local ad hoc servers). Prefer tools already present in the session first. Use MCP_DOCKER when you need a missing memory capability.

## When to Use This Skill

- **Adding memory capabilities**: Need Neo4j or PostgreSQL access via MCP?
- **Dynamic tool discovery**: Finding the right MCP server for a specific memory task
- **Configuring credentials via environment variables**: Never hardcode secrets
- **Managing MCP servers**: Adding, updating, or removing MCP servers mid-session

## Core Workflow

### Step 1: Find the Right MCP Server

Use `MCP_DOCKER_mcp-find` to search Docker Hub's MCP catalog for memory servers:

```
MCP_DOCKER_mcp-find --query "neo4j memory"
MCP_DOCKER_mcp-find --query "database postgres"
MCP_DOCKER_mcp-find --query "neo4j cypher"
```

### Step 2: Configure the Server Using Environment Variables

Use `MCP_DOCKER_mcp-config-set` to provide connection details. **All configuration must use environment variables** (no hardcoded secrets).

**Environment Variable Mappings for Memory Servers:**

| Server | Environment Variable | Purpose |
|--------|---------------------|---------|
| `neo4j-memory` | `NEO4J_MEMORY_URL` | Connection URL (e.g., `bolt://host.docker.internal:7687` for Docker-side access to host services) |
| `neo4j-memory` | `NEO4J_MEMORY_USERNAME` | Neo4j username |
| `neo4j-memory` | `NEO4J_MEMORY_PASSWORD` | Neo4j password |
| `database-server` | `DATABASE_SERVER_DATABASE_URL` | PostgreSQL URL (format: `postgresql://user:pass@host.docker.internal:5432/db`) |
| `neo4j-cypher` | `NEO4J_CYPER_URL` | Connection URL (e.g., `bolt://host.docker.internal:7687`) |
| `neo4j-cypher` | `NEO4J_CYPER_USERNAME` | Neo4j username |
| `neo4j-cypher` | `NEO4J_CYPER_PASSWORD` | Neo4j password |

```
MCP_DOCKER_mcp-config-set --server neo4j-memory
MCP_DOCKER_mcp-config-set --server database-server
MCP_DOCKER_mcp-config-set --server neo4j-cypher
```

**Security notes:**
- Never hardcode credentials in skill files or committed examples
- Always use environment variable names in documentation
- The config is validated before being applied

### Step 3: Add and Activate

Use `MCP_DOCKER_mcp-add` to register the configured server:

```
MCP_DOCKER_mcp-add --name neo4j-memory --activate
MCP_DOCKER_mcp-add --name database-server --activate
MCP_DOCKER_mcp-add --name neo4j-cypher --activate
```

### Step 4: Use the Activated Tools

Once added, the server's tools usually surface directly in the session. Call the surfaced tool directly.

Use `MCP_DOCKER_mcp-exec` only when a server tool exists in the session but is not exposed in the normal tool list.

## Complete Examples

### Example 1: Native Memory Stack Configuration (Memory Server Order)

**For all memory operations, use this exact order: `neo4j-memory` → `database-server` → `neo4j-cypher`**

```
# 1. Discover memory servers
MCP_DOCKER_mcp-find --query "neo4j memory"
MCP_DOCKER_mcp-find --query "database postgres"

# 2. Configure using environment variables (no secrets in file)
MCP_DOCKER_mcp-config-set --server neo4j-memory
MCP_DOCKER_mcp-config-set --server database-server

# 3. Add servers in priority order
MCP_DOCKER_mcp-add --name neo4j-memory --activate
MCP_DOCKER_mcp-add --name database-server --activate

# 4. Execute memory operations through the native stack
# (tools surface automatically as mcp__neo4j_memory_* and mcp__database_server_*)
```

**Key Points:**
- `database-server` uses `DATABASE_SERVER_DATABASE_URL` (not `connection_string`)
- Always use `host.docker.internal` for Docker-side access to host services
- No secrets are ever hardcoded in configuration

### Example 2: Adding Neo4j via MCP_DOCKER (Legacy Fallback)

**Do not use for memory operations. Only for graph-specific tasks when neo4j-memory is unavailable.**

```
# 1. Find available Neo4j servers
MCP_DOCKER_mcp-find --query "neo4j graph database cypher"

# 2. Configure with environment variable names (never actual secrets)
MCP_DOCKER_mcp-config-set --server neo4j --config '{
  "url": "bolt://host.docker.internal:7687",
  "username": "NEO4J_MEMORY_USERNAME",
  "password": "NEO4J_MEMORY_PASSWORD"
}'

# 3. Add to session
MCP_DOCKER_mcp-add --name neo4j --activate

# 4. Execute Cypher queries
MCP_DOCKER_mcp-exec --name neo4j --tool read_neo4j_cypher --arguments '{
  "query": "MATCH (n) RETURN count(n) as node_count"
}'
```

### Example 3: Web Search with Tavily

```
# Configure Tavily with environment variable for API token
MCP_DOCKER_mcp-config-set --server tavily --config '{
  "api_token": "TAVILY_API_TOKEN"
}'

MCP_DOCKER_mcp-add --name tavily --activate

# Search the web
MCP_DOCKER_mcp-exec --name tavily --tool search --arguments '{
  "query": "OpenCode MCP server announcement",
  "max_results": 5,
  "search_depth": "comprehensive"
}'
```

### Example 4: SQL Access via database-server (PostgreSQL)

**For this repo, always use database-server (not postgres) for PostgreSQL access.**

```
# 1. Configure using DATABASE_SERVER_DATABASE_URL (not connection_string)
MCP_DOCKER_mcp-config-set --server database-server --config '{
  "database_url": "postgresql://user:pass@host.docker.internal:5432/dbname"
}'

# 2. Add the server
MCP_DOCKER_mcp-add --name database-server --activate

# 3. Execute SQL queries (tools surface as mcp__database_server_*)
```

### Example 5: File System Access

```
# Configure filesystem (restrict to project directories)
MCP_DOCKER_mcp-config-set --server filesystem --config '{
  "paths": ["/home/ronin704/projects/memory"]
}'

MCP_DOCKER_mcp-add --name filesystem --activate

# Read a file
MCP_DOCKER_mcp-exec --name filesystem --tool read_file --arguments '{
  "path": "/home/ronin704/projects/memory/README.md"
}'
```

### Example 6: Repo Policy Guardrail

For this repository, do **not** configure or add a local ad hoc memory server through MCP_DOCKER.

Use the **approved MCP-packed memory servers**:

1. `neo4j-memory` — approved insight recall
2. `database-server` — raw trace lookup and SQL evidence (uses `DATABASE_SERVER_DATABASE_URL`)
3. `neo4j-cypher` — targeted graph inspection only when needed

Use `MCP_DOCKER_mcp-find` to discover them first, then configure and add via `mcp-config-set` and `mcp-add`.

## Essential MCP Servers

### Databases & Storage (memory-first order)

| Server | Description | Required Config (Environment Variables) |
|--------|-------------|----------------------------------------|
| `neo4j-memory` | Neo4j packed memory server (primary) | `NEO4J_MEMORY_URL`, `NEO4J_MEMORY_USERNAME`, `NEO4J_MEMORY_PASSWORD` |
| `database-server` | PostgreSQL packed server (trace evidence) | `DATABASE_SERVER_DATABASE_URL` (format: `postgresql://host:port/db`) |
| `neo4j-cypher` | Neo4j packed Cypher server (graph-specific) | `NEO4J_CYPER_URL`, `NEO4J_CYPER_USERNAME`, `NEO4J_CYPER_PASSWORD` |
| `postgres` | PostgreSQL database (fallback only) | `connection_string` |
| `mongodb` | MongoDB & Atlas (non-memory) | `connection_string` |
| `redis` | Redis key-value store (non-memory) | `host`, `port`, `password` |
| `elasticsearch` | Elasticsearch search (non-memory) | `host`, `port`, `username`, `password` |

**⚠️ Memory Operations Rule:** For all memory-related tasks, use `neo4j-memory` → `database-server` → `neo4j-cypher` in that exact order. Never use local ad hoc servers.

### Web & Search

| Server | Description | Required Config (Environment Variable) |
|--------|-------------|---------------------------------------|
| `tavily` | Web search and extraction | `TAVILY_API_TOKEN` |
| `brave` | Brave Search API | `BRAVE_API_KEY` |
| `playwright` | Browser automation | none |
| `firecrawl` | Web scraping | `FIRECRAWL_API_KEY` |

### Developer Tools

| Server | Description | Required Config (Environment Variable) |
|--------|-------------|---------------------------------------|
| `github` | GitHub API operations | `GITHUB_PERSONAL_ACCESS_TOKEN` |
| `docker` | Docker Hub API | none |
| `filesystem` | Local file system access | `paths` (array) |
| `context7` | Code documentation | none |

### Productivity

| Server | Description | Required Config (Environment Variable) |
|--------|-------------|---------------------------------------|
| `notion` | Notion workspace | `NOTION_INTEGRATION_TOKEN` |
| `slack` | Slack workspace | `SLACK_BOT_TOKEN` |

## Tool Reference

### MCP_DOCKER_mcp-find

Search Docker Hub's MCP catalog for available servers.

**Parameters:**
- `query` (string): Search terms (space-separated for OR matching)
- `limit` (number, optional): Maximum results to return

**Returns:** List of matching MCP servers with descriptions.

### MCP_DOCKER_mcp-config-set

Configure an MCP server with connection details. All credentials must reference environment variables.

**Parameters:**
- `server` (string): Server name from mcp-find results
- `config` (string): JSON configuration object
- Environment variable names (e.g., `NEO4J_MEMORY_PASSWORD`) are accepted as string values

**Note:** Must be called before `mcp-add`. Configuration persists for the session.

### MCP_DOCKER_mcp-add

Add and optionally activate an MCP server.

**Parameters:**
- `name` (string): Server name
- `activate` (boolean, optional): Immediately activate server

### MCP_DOCKER_mcp-exec

Execute a tool from a configured MCP server.

**Parameters:**
- `name` (string): Server name
- `tool` (string): Tool name to execute
- `arguments` (string, optional): JSON arguments for the tool

### MCP_DOCKER_mcp-remove

Remove an MCP server from the session.

**Parameters:**
- `name` (string): Server name to remove

## Best Practices

1. **Discover before adding**: Always use `MCP_DOCKER_mcp-find` first to find the right memory server
2. **Use memory-first order**: `neo4j-memory` → `database-server` → `neo4j-cypher`
3. **Use environment variables**: Never hardcode credentials in skills or prompts; always reference env var names
4. **Prefer MCP servers over local**: For this repo, use approved Docker-backed memory servers, not local ad hoc servers
5. **One-time setup**: Configure once per session, reuse multiple times
6. **Clean up**: Remove servers when done if experiencing context bloat: `MCP_DOCKER_mcp-remove --name unused-server`
7. **Check documentation**: Some servers have specific configuration requirements
8. **Verify server identity**: Always confirm server tools are available after `mcp-add`
9. **Use host.docker.internal**: When Docker-side access to host services is needed (e.g., Neo4j running on host)
10. **database-server uses DATABASE_SERVER_DATABASE_URL**: Not `connection_string`

## Troubleshooting

### Server not found
- Check spelling in `MCP_DOCKER_mcp-find` query
- Try broader search terms
- Verify the server exists in Docker Hub MCP catalog

### Configuration fails
- Verify all required environment variables are set
- Check credentials (API keys, passwords)
- Ensure network connectivity to the service
- For Docker-side access, use `host.docker.internal` instead of `localhost`

### Tool execution fails
- Verify server is activated (`--activate` flag)
- Check tool name matches exactly (case-sensitive)
- Review tool-specific parameter requirements

### Context bloat
- Remove unused servers: `MCP_DOCKER_mcp-remove --name server-name`
- Only add servers when needed
- Use `MCP_DOCKER_mcp-find` to preview without adding

### Connection refused (Docker-side access)
- Ensure Docker container has access to host services
- Use `host.docker.internal` as the host in URLs
- Verify the target service is listening on the correct port
- Check Docker network configuration

## Resources

### References

- `@references/docker-mcp-catalog.md` - Full Docker MCP catalog reference with 50+ servers
- `@references/mcp-server-configs.md` - Common configuration patterns

## See Also

- Docker MCP Catalog: https://hub.docker.com/mcp
- MCP Specification: https://modelcontextprotocol.io
- OpenCode Documentation: https://opencode.ai/docs
