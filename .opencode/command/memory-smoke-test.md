---
description: "Quick memory stack verification (Neo4j + MCP wiring)"
argument-hint: ""
allowed-tools: ["MCP_DOCKER_mcp-config-set", "MCP_DOCKER_mcp-add", "MCP_DOCKER_read_graph", "MCP_DOCKER_search_memories", "MCP_DOCKER_create_entities", "MCP_DOCKER_create_relations", "MCP_DOCKER_add_observations"]
skill: mcp-docker
global: false
---

# Memory Smoke Test

Run this after environment changes, MCP updates, or connection failures.

## Checks

1. **Connection check** - Neo4j Memory MCP server reachable
2. **Read check** - Can query existing memories
3. **Write check** - Can create entities
4. **Readback verification** - Writes are durable

## Canonical Procedure (Using MCP Neo4j Memory Tools)

```javascript
// 1) Ensure neo4j-memory MCP server is configured
// (Should already be configured in Docker Desktop MCP with:
//  url: bolt://host.docker.internal:7687, username: neo4j, database: neo4j)

// 2) Read graph (connection + read check)
MCP_DOCKER_read_graph({});

// 3) Search for existing memories (read check)
MCP_DOCKER_search_memories({ query: "roninmemory" });

// 4) Write test entity (write check)
const testTimestamp = new Date().toISOString();
MCP_DOCKER_create_entities({
  entities: [{
    name: "Smoke Test " + testTimestamp,
    type: "Test",
    observations: [
      "group_id: roninmemory",
      "source: memory-smoke-test",
      "created: " + testTimestamp
    ]
  }]
});

// 5) Add observation to Memory Master (relation + observation test)
MCP_DOCKER_add_observations({
  observations: [{
    entityName: "Memory Master",
    observations: ["Smoke test passed at " + testTimestamp]
  }]
});

// 6) Readback verification - search for the test entity
MCP_DOCKER_search_memories({ query: "Smoke Test " + testTimestamp });
```

## Expected Outcome

- `read_graph` succeeds and returns entities/relations
- `search_memories` succeeds and returns results
- `create_entities` succeeds and creates test entity
- `add_observations` succeeds and appends to Memory Master
- Readback search finds the newly created test entity

If any step fails, do not proceed with session claims of memory persistence.

## Alternative: Quick Ping Test

For faster validation:

```javascript
// Quick connection test
MCP_DOCKER_read_graph({});

// Quick search test
MCP_DOCKER_search_memories({ query: "Memory Master" });
```

## Never Do This

❌ `MCP_DOCKER_read_neo4j_cypher` (deprecated - use memory tools instead)
❌ `MCP_DOCKER_write_neo4j_cypher` (deprecated - use create_entities instead)
❌ Skip verification step

## Always Do This

✅ Use MCP Neo4j Memory tools exclusively
✅ Verify writes with readback search
✅ Report test timestamp for debugging