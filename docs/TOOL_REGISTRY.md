# Allura Brain Tool Registry
## Quick Reference for MCP Tools

### Database Tools (database-server)

| Tool | Purpose | Example Query |
|------|---------|---------------|
| `list_tables` | Show all tables | "What tables are available?" |
| `describe_table` | Get table schema | "Describe the agents table" |
| `query_database` | Natural language queries | "Show me active agents" |
| `execute_sql` | Raw SQL execution | "SELECT * FROM agents LIMIT 5" |
| `connect_to_database` | Switch databases | "Connect to memory database" |

### Neo4j Tools (neo4j-memory)

| Tool | Purpose | Example Query |
|------|---------|---------------|
| `query` | Cypher queries | "MATCH (a:Agent) RETURN a" |
| `create_node` | Create nodes | "Create agent node" |
| `create_relationship` | Create relationships | "Link agent to skill" |
| `update_node` | Update properties | "Update agent status" |

### Notion Tools (notion-remote)

| Tool | Purpose | Example |
|------|---------|---------|
| `fetch` | Get page/database | "Get Agents Registry" |
| `query_database` | Query databases | "List all agents" |
| `create_pages` | Create entries | "Add new agent" |
| `update_page` | Update entries | "Update agent status" |

### Context7 Tools (context7)

| Tool | Purpose | Example |
|------|---------|---------|
| `resolve-library-id` | Find library | "Find OpenCode docs" |
| `get-library-docs` | Get documentation | "Get OpenCode agent config" |

### Exa/Tavily Tools

| Tool | Purpose | Example |
|------|---------|---------|
| `tavily_search` | Web search | "Search for MCP best practices" |
| `tavily_research` | Deep research | "Research agent frameworks" |
| `web_search_exa` | AI search | "Find multi-agent patterns" |

---

## Common Workflows

### 1. Session Start
```
1. Run session bootstrap
2. Load memory-bank
3. Verify database connections
4. Cache warm-up
```

### 2. Agent Discovery
```
1. Query PostgreSQL for agents
2. Query Neo4j for relationships
3. Cross-reference with Notion
4. Display unified view
```

### 3. Knowledge Promotion
```
1. Query raw traces (PostgreSQL)
2. Propose promotion (Curator)
3. Human approval (Notion)
4. Write to Neo4j (curated)
```

### 4. Drift Detection
```
1. Read opencode.json
2. Query Notion registry
3. Compare filesystem
4. Report discrepancies
```

---

## Tool Aliases (Recommended)

Create shortcuts for common operations:

```bash
# Database queries
alias brain-agents="bun run scripts/query-agents.ts"
alias brain-events="bun run scripts/query-events.ts"

# Session management
alias brain-boot="bun run scripts/session-bootstrap-optimized.ts"
alias brain-drift="bun run scripts/drift-detection.ts"

# Neo4j operations
alias brain-graph="docker exec knowledge-neo4j cypher-shell -u neo4j -p 'Kamina2025*'"

# PostgreSQL queries
alias brain-sql="docker exec knowledge-postgres psql -U ronin4life -d memory -c"
```

---

## Performance Tips

1. **Use Materialized Views** - Query `mv_active_agents` instead of `agents`
2. **Cache Warm-up** - Run bootstrap at session start
3. **Index Usage** - All queries should use indexes (check with EXPLAIN)
4. **Connection Pooling** - Reuse database connections
5. **Lazy Loading** - Only load data when needed

---

## Troubleshooting

### MCP Server Not Responding
```bash
# Check if Docker container is running
docker ps | grep mcp

# Restart MCP server
docker restart <container-id>
```

### Database Connection Failed
```bash
# Check PostgreSQL
docker exec knowledge-postgres pg_isready -U ronin4life

# Check Neo4j
curl -s http://localhost:7474 | jq .neo4j_version
```

### Slow Queries
```bash
# Check query plan
docker exec knowledge-postgres psql -U ronin4life -d memory -c "EXPLAIN ANALYZE <query>"

# Refresh materialized views
docker exec knowledge-postgres psql -U ronin4life -d memory -c "SELECT refresh_allura_views();"
```
