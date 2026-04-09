---
description: "Session finalization - persist a durable session reflection to Neo4j memory"
allowed-tools: ["mcp__MCP_DOCKER__write_neo4j_cypher", "mcp__MCP_DOCKER__read_neo4j_cypher", "mcp__MCP_DOCKER__insert_data", "mcp__MCP_DOCKER__execute_sql"]
---

# Session End Protocol

**Usage:** `/end-session <summary of what was accomplished>`

Persists a session reflection entity to Neo4j and verifies write success.

## Required Steps

### Step 1: Create Reflection Entity in Neo4j

```javascript
mcp__MCP_DOCKER__write_neo4j_cypher({
  query: `
    CREATE (r:Reflection {
      reflection_id: 'refl_' + randomUUID(),
      name: 'Session Reflection ' + datetime(),
      group_id: 'allura-roninmemory',
      agent_id: 'brooks',
      event_type: 'session_complete',
      status: 'completed',
      timestamp: datetime(),
      summary: $summary
    })
    RETURN r
  `,
  parameters: { summary: "$ARGUMENTS" }
})
```

### Step 2: Log to PostgreSQL (Append-Only)

```javascript
mcp__MCP_DOCKER__insert_data({
  table_name: "events",
  columns: "event_type, group_id, agent_id, status, metadata",
  values: "'SESSION_COMPLETE', 'allura-roninmemory', 'brooks', 'completed', '{\"summary\": \"$ARGUMENTS\"}'"
})
```

### Step 3: Verify Write (Read Back)

```javascript
mcp__MCP_DOCKER__execute_sql({
  sql_query: "SELECT * FROM events WHERE event_type = 'SESSION_COMPLETE' ORDER BY created_at DESC LIMIT 1"
})
```

---

**Invoke with:** `/end-session <summary>`

Confirm the new entity appears in results.

### Step 4: Update Memory Bank

Update `memory-bank/progress.md` with what was completed this session.
Update `memory-bank/activeContext.md` with the current state and next steps.

## Success Criteria

- Reflection entity created with `group_id: allura-roninmemory`
- Search returns the newly written record
- Memory bank files updated

## Never Do This

- Use `write_neo4j_cypher` directly (use `create_entities` instead)
- Skip the verification read-back step
- Omit `group_id` from observations
