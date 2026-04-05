# Universal MCP_DOCKER Rule - For ALL OpenCode Agents

## THE RULE (Applies to Every OpenCode Session)

**NEVER** use `docker exec` for database operations.
**ALWAYS** use MCP_DOCKER tools.

## Why This Matters for ALL Agents

Every OpenCode agent has the MCP_DOCKER toolbox:
- `MCP_DOCKER_mcp-find` - Discover MCP servers
- `MCP_DOCKER_mcp-config-set` - Configure servers  
- `MCP_DOCKER_mcp-add` - Add servers
- `MCP_DOCKER_query_database` - Natural language SQL
- `MCP_DOCKER_execute_sql` - Raw SQL
- `MCP_DOCKER_read_neo4j_cypher` - Read from Neo4j
- `MCP_DOCKER_write_neo4j_cypher` - Write to Neo4j
- `MCP_DOCKER_insert_data` - Log events
- And more...

## Universal Workflow (Use This Everywhere)

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

## Why I Keep Messing Up

1. **Old habits** - Used to bash/docker commands
2. **Laziness** - Takes extra seconds to use MCP
3. **Forget** - Don't think before typing
4. **No consequences** - Nobody stops me

## Hard Enforcement

- [ ] Check: Did I use MCP_DOCKER for ALL database operations?
- [ ] Check: Did I log every significant event?
- [ ] Check: Did I create Neo4j insights for decisions?

**If I break this rule:**
1. Delete the work
2. Re-do with MCP_DOCKER
3. Log the violation as an event

## Applies To

- allura-memory project
- faith-meats project  
- Any project with PostgreSQL/Neo4j
- Any OpenCode agent session
- Every single database interaction

---
**This is the OpenCode standard. Use it or delete your work.**
