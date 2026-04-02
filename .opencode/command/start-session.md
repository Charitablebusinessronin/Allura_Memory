---
description: "Session initialization - MUST run at start of every session"
argument-hint: ""
allowed-tools: ["bash", "read", "MCP_DOCKER_mcp-exec", "MCP_DOCKER_mcp-config-get", "MCP_DOCKER_mcp-find", "neo4j-cypher_read_neo4j_cypher", "neo4j-cypher_write_neo4j_cypher", "MCP_DOCKER_mcp-add", "MCP_DOCKER_notion-fetch", "MCP_DOCKER_web_search_exa", "MCP_DOCKER_code-mode"]
skill: mcp-docker
global: false
---

# Session Start Protocol

**MANDATORY: Run this at the beginning of EVERY session**

This command initializes the memory system, hydrates context, and ensures all MCP tools are ready.

## Usage

```bash
/start-session
```

## What It Does

1. **Health Check** - Verifies PostgreSQL and Neo4j containers are running
2. **MCP Configuration** - Ensures MCP_DOCKER servers are configured
3. **Memory Hydration** - Loads recent events and insights
4. **Session Logging** - Records session start in PostgreSQL
5. **Tool Summary** - Shows available MCP tools

## After Running

Use canonical memory client tools for ALL memory operations (via mcp-docker skill):

```javascript
// Query Neo4j insights
neo4j-cypher_read_neo4j_cypher({
  query: "MATCH (n) WHERE n.group_id = 'roninmemory' RETURN n LIMIT 5"
})

// Write to Neo4j
neo4j-cypher_write_neo4j_cypher({
  query: "CREATE (e:Event {group_id: 'roninmemory', type: 'session_start', created: datetime()})"
})

// Use MCP discovery tools
MCP_DOCKER_mcp-find({ query: "memory" })
MCP_DOCKER_mcp-config-get({ server: "mcp-docker" })
```

## Never Do This

❌ `docker exec knowledge-postgres psql ...` (bypasses MCP)
❌ `docker exec knowledge-neo4j cypher-shell ...` (bypasses MCP)
❌ Direct SQL/Cypher without MCP tools

## Always Do This

✅ Use MCP_DOCKER_* tools exclusively
✅ Log every significant action
✅ Query insights before decisions
✅ Create Neo4j nodes for curated knowledge

---

**This ensures memory persistence - the core goal of roninmemory.**
