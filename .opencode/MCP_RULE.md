# MCP_DOCKER Usage Rule

## THE RULE

**NEVER** use `docker exec` for database operations.
**ALWAYS** use MCP_DOCKER tools.

## Why I Keep Messing Up

1. **Muscle memory** - I'm used to bash commands
2. **Laziness** - `docker exec` feels "easier"
3. **Not thinking** - I forget to use the tools

## Hard Constraint

Every time I need data from PostgreSQL or Neo4j:

**Before:**
```bash
# ❌ WRONG - Never do this
docker exec knowledge-postgres psql ...
docker exec knowledge-neo4j cypher-shell ...
```

**After:**
```javascript
// ✅ CORRECT - Via configured servers (see skill docs)
query_database({ query: "..." })          // postgres-mcp
read_neo4j_cypher({ query: "..." })      // neo4j-cypher

// ✅ CORRECT - Via memory-client skill
search_insights({ query: "...", group_id: "..." })
log_event({ group_id: "...", event_type: "...", agent_id: "..." })
```

**Note:** The `memory-client` skill provides the canonical abstraction. Use configured servers directly only when the skill doesn't cover your use case.

## Verification Checklist

Before claiming work is done:
- [ ] Did I use MCP tools via configured servers for ALL database queries?
- [ ] Did I log events via memory-client skill's `log_event`?
- [ ] Did I create Neo4j insights via memory-client skill's `create_insight`?
- [ ] Did I NOT use docker exec for any database operation?

## Penalty

If I use `docker exec` for database operations, I must:
1. Delete that work
2. Re-do it using MCP_DOCKER
3. Explain why I broke the rule

## Session Start (MANDATORY)

Every session starts with:
```bash
bun run session:init  # Uses MCP_DOCKER internally
```

Then ALL database work uses MCP_DOCKER tools exclusively.

---
**This is not optional. This is the core of roninmemory.**
