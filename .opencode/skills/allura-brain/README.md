# Allura Brain — MCP_DOCKER Usage Guide

> **Created:** 2026-04-05
> **Status:** Active
> **Purpose:** Ensure I use MCP_DOCKER tools for ALL database operations

---

## The Rule

**NEVER use `docker exec` for database operations.**
**ALWAYS use MCP_DOCKER tools.**

---

## MCP_DOCKER Tools I Have Access To

| Tool | Purpose |
|------|---------|
| `MCP_DOCKER_mcp-find` | Find MCP servers in catalog |
| `MCP_DOCKER_mcp-add` | Add MCP server to session |
| `MCP_DOCKER_mcp-config-set` | Configure MCP server |
| `MCP_DOCKER_mcp-exec` | Execute MCP tool |
| `MCP_DOCKER_query_database` | Natural language SQL |
| `MCP_DOCKER_execute_sql` | Raw SQL |
| `MCP_DOCKER_read_neo4j_cypher` | Read from Neo4j |
| `MCP_DOCKER_write_neo4j_cypher` | Write to Neo4j |
| `MCP_DOCKER_insert_data` | Log events |
| `MCP_DOCKER_notion-*` | Notion integration |

---

## Universal Workflow

### 1. Session Start
```bash
# Check if memory containers are running
docker ps | grep knowledge-postgres
docker ps | grep knowledge-neo4j

# Run session init (uses MCP_DOCKER internally)
bun run session:init
```

### 2. ALL Database Operations
```javascript
// ✅ CORRECT - Use this everywhere
MCP_DOCKER_query_database({ query: "Get recent events" })
MCP_DOCKER_execute_sql({ sql_query: "SELECT * FROM events" })
MCP_DOCKER_read_neo4j_cypher({ query: "MATCH (n) RETURN n" })
MCP_DOCKER_insert_data({ table_name: "events", columns: "...", values: "..." })
MCP_DOCKER_write_neo4j_cypher({ query: "CREATE (n:Insight ...)" })

// ❌ WRONG - Never do this
docker exec knowledge-postgres psql ...
docker exec knowledge-neo4j cypher-shell ...
```

### 3. Log Everything
```javascript
// Every significant action gets logged
MCP_DOCKER_insert_data({
  table_name: "events",
  columns: "event_type, group_id, agent_id, status, metadata",
  values: "'action_name', 'project-name', 'agent-name', 'completed', '{\"key\": \"value\"}'"
})
```

---

## Hard Enforcement

- [ ] Check: Did I use MCP_DOCKER for ALL database operations?
- [ ] Check: Did I log every significant event?
- [ ] Check: Did I create Neo4j insights for decisions?

**If I break this rule:**
1. Delete the work
2. Re-do with MCP_DOCKER
3. Log the violation as an event

---

## Applies To

- allura-memory project
- faith-meats project  
- Any project with PostgreSQL/Neo4j
- Any OpenCode agent session
- Every single database interaction

---
**This is the OpenCode standard. Use it or delete your work.**