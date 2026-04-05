---
description: "Session finalization - persist a durable session reflection to Neo4j memory"
allowed-tools: ["mcp__MCP_DOCKER__notion-fetch"]
---

# Session End Protocol

**Usage:** `/end-session <summary of what was accomplished>`

Persists a session reflection entity to Neo4j and verifies write success.

## Required Steps

### Step 1: Create Reflection Entity

```javascript
mcp__MCP_DOCKER__create_entities({
  entities: [{
    name: "Session Reflection " + new Date().toISOString(),
    type: "Reflection",
    observations: [
      "group_id: allura-roninmemory",
      "agent_id: claude-code",
      "event_type: session_complete",
      "status: completed",
      "timestamp: " + new Date().toISOString(),
      "summary: $ARGUMENTS"
    ]
  }]
})
```

### Step 2: Link to Memory Master

```javascript
mcp__MCP_DOCKER__create_relations({
  relations: [{
    source: "Session Reflection " + new Date().toISOString(),
    target: "Memory Master",
    relationType: "PERFORMED_BY"
  }]
})
```

### Step 3: Verify Write (Read Back)

```javascript
mcp__MCP_DOCKER__search_memories({ query: "Session Reflection" })
```

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
