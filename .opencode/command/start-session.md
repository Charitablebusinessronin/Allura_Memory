---
description: "Session initialization - MUST run at start of every session"
argument-hint: ""
allowed-tools: ["bash", "read", "MCP_DOCKER_mcp-find", "MCP_DOCKER_mcp-config-set", "MCP_DOCKER_mcp-add", "MCP_DOCKER_read_graph", "MCP_DOCKER_search_memories", "MCP_DOCKER_find_memories_by_name", "MCP_DOCKER_create_entities", "MCP_DOCKER_create_relations", "MCP_DOCKER_add_observations", "MCP_DOCKER_web_search_exa", "MCP_DOCKER_notion-fetch"]
skill: mcp-docker
global: false
---

# Session Start Protocol

**MANDATORY: Run this at the beginning of EVERY session**

This command initializes the memory system, hydrates context from previous work, searches for relevant memories based on what the user is asking, and ensures all MCP tools are ready.

## Usage

```bash
/start-session
```

## What It Does

1. **Health Check** - Verifies PostgreSQL and Neo4j containers are running
2. **MCP Configuration** - Ensures MCP_DOCKER servers are configured
3. **Proactive Memory Search** - Searches for relevant memories based on user's request
4. **Memory Hydration** - Loads recent events and insights
5. **Session Logging** - Records session start
6. **Tool Summary** - Shows available MCP tools

## Connection Standard

- **Primary Neo4j URI:** `bolt://host.docker.internal:7687` (configured in Docker Desktop MCP)
- **Database:** `neo4j`
- **MCP Server:** `neo4j-memory` with 9 tools

## Proactive Memory Search on Boot

**CRITICAL**: At session start, ALWAYS search memories to understand context:

```javascript
// Step 1: Search for relevant memories based on user's request
MCP_DOCKER_search_memories({
  query: "<user's topic or last session keywords>"
})

// Step 2: If you know specific entity names, find them directly
MCP_DOCKER_find_memories_by_name({
  names: ["Entity Name 1", "Entity Name 2"]
})

// Step 3: Read full graph for complete context (optional)
MCP_DOCKER_read_graph({})
```

## Memory Tools Available (via MCP)

Use these **Neo4j Memory MCP tools** for ALL memory operations:

### Read Operations
```javascript
// Read entire knowledge graph
MCP_DOCKER_read_graph({})

// Search memories by query (fulltext search across names, types, observations)
MCP_DOCKER_search_memories({
  query: "roninmemory openclaw"
})

// Find specific entities by exact name
MCP_DOCKER_find_memories_by_name({
  names: ["Memory Master", "OpenClawPaper Stack"]
})
```

### Write Operations
```javascript
// Create new entities
MCP_DOCKER_create_entities({
  entities: [{
    name: "Session Reflection 2026-04-03",
    type: "Reflection",
    observations: [
      "group_id: roninmemory",
      "agent_id: openagent",
      "summary: Fixed Neo4j memory integration"
    ]
  }]
})

// Create relationships between entities
MCP_DOCKER_create_relations({
  relations: [{
    source: "Session Reflection 2026-04-03",
    target: "Memory Master",
    relationType: "PERFORMED_BY"
  }]
})

// Add observations to existing entities
MCP_DOCKER_add_observations({
  observations: [{
    entityName: "Memory Master",
    observations: ["Fixed Neo4j integration on 2026-04-03"]
  }]
})
```

## Never Do This

❌ `MCP_DOCKER_read_neo4j_cypher` (use `search_memories` or `read_graph` instead)
❌ `MCP_DOCKER_write_neo4j_cypher` (use `create_entities`, `add_observations` instead)
❌ Skip memory search at session start
❌ Direct SQL/Cypher without MCP memory tools

## Always Do This

✅ Use MCP Neo4j Memory tools exclusively:
   - `MCP_DOCKER_read_graph`
   - `MCP_DOCKER_search_memories`
   - `MCP_DOCKER_find_memories_by_name`
   - `MCP_DOCKER_create_entities`
   - `MCP_DOCKER_create_relations`
   - `MCP_DOCKER_add_observations`

✅ Search memories BEFORE responding to user
✅ Log every significant action
✅ Create entities for new knowledge
✅ Add observations to existing entities

---

## Debugging with Memory

When user reports issues or asks questions:

1. **Search first**: `MCP_DOCKER_search_memories({ query: "<error or topic>" })`
2. **Check related entities**: Look for Events, Episodes, Outcomes related to the issue
3. **Be proactive**: Suggest related memories before user asks

**Example flow:**
```javascript
// User asks: "What did we do about Neo4j backup issues?"

// Step 1: Search memories
MCP_DOCKER_search_memories({ query: "neo4j backup" })

// Step 2: Found: Event-2026-03-27-Neo4j-Backup-Method-Conflict
// Respond: "I found that on 2026-03-27 we resolved a Neo4j backup issue by 
//           switching from offline dump to APOC logical export..."
```

---

**This ensures memory-first operation - the core goal of roninmemory.**
