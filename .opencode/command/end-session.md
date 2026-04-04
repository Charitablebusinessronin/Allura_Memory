---
description: "Session finalization - MUST run at end of every session"
argument-hint: "<summary>"
allowed-tools: ["read", "MCP_DOCKER_create_entities", "MCP_DOCKER_create_relations", "MCP_DOCKER_add_observations", "MCP_DOCKER_search_memories", "MCP_DOCKER_read_graph", "MCP_DOCKER_mcp-config-set", "MCP_DOCKER_mcp-add"]
skill: mcp-docker
global: false
---

# Session End Protocol

**MANDATORY: Run this at the end of EVERY session**

This command persists a durable session reflection and verifies write success using MCP Neo4j Memory tools.

## Usage

```bash
/end-session Completed Epic docs cleanup and memory hardening updates.
```

## Required Steps

1. Ensure Neo4j Memory MCP server is configured (`neo4j-memory` active)
2. Create a Reflection entity scoped to `group_id='roninmemory'`
3. Read back to prove durability

## Canonical Write Template (Using MCP Memory Tools)

```javascript
// Step 1: Create Reflection entity
MCP_DOCKER_create_entities({
  entities: [{
    name: "Session Reflection " + new Date().toISOString(),
    type: "Reflection",
    observations: [
      "group_id: roninmemory",
      "agent_id: openagent",
      "event_type: session_complete",
      "status: completed",
      "timestamp: " + new Date().toISOString(),
      "insights: " + summary
    ]
  }]
});

// Step 2: Link to Memory Master (optional)
MCP_DOCKER_create_relations({
  relations: [{
    source: "Session Reflection " + new Date().toISOString(),
    target: "Memory Master",
    relationType: "PERFORMED_BY"
  }]
});

// Step 3: Verify by searching
MCP_DOCKER_search_memories({
  query: "Session Reflection"
});
```

## Success Criteria

- Reflection entity is created
- Search returns the newly written record
- Summary includes what changed + why

## Alternative: Add to Memory Master

Instead of creating new Reflection entities, you can add observations to Memory Master:

```javascript
MCP_DOCKER_add_observations({
  observations: [{
    entityName: "Memory Master",
    observations: [
      "2026-04-03: Completed session - Fixed Neo4j memory integration"
    ]
  }]
});
```

## Never Do This

❌ `MCP_DOCKER_write_neo4j_cypher` (use `create_entities` instead)
❌ Skip verification step

## Always Do This

✅ Use MCP Neo4j Memory tools: `MCP_DOCKER_create_entities`, `MCP_DOCKER_add_observations`
✅ Verify by searching or reading back
✅ Include timestamp and group_id in observations