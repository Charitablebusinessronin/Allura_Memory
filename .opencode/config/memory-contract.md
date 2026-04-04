# Memory Contract (roninmemory)

This contract defines canonical memory schema conventions and runtime invariants.

## 1) Tenant Scope

- **Memory partition:** `group_id`
- **Relational (PostgreSQL):** `group_id`
- **Graph (Neo4j):** `group_id` (preferred), tolerate legacy `groupId` only when integrating older nodes

All reads/writes must include both tenant keys unless an item is explicitly promoted to a governed global partition. Cross-tenant access is prohibited by default.

## 2) Versioning / Mutability

- Existing knowledge nodes are immutable.
- Updates create a new node and connect via `:SUPERSEDES`.
- No in-place mutation of prior canonical insight content.

## 3) Core Node/Event Shapes

### Reflection (Neo4j)

Required properties:
- `group_id` (string)
- `agent_id` (string)
- `event_type` (string, e.g. `session_complete`)
- `status` (string)
- `timestamp` (datetime)
- `insights` (string)

### Trace/Event (PostgreSQL)

Required columns must include:
- `group_id`
- `event_type`
- `created_at`
- payload/metadata fields per table schema

## 3.1) Dual Logging Policy

- **PostgreSQL** is the append-only operational event log and audit trail.
- **Neo4j** stores semantic insights, patterns, lineage, and reusable memory.
- Significant orchestration and implementation actions should write to both stores when available.
- If one store is unavailable, continue with a warning and log to the available store. Never fabricate a successful write.

## 3.2) OpenAgents Control Registry

The OpenAgents Control Registry (`3371d9be65b38041bc59fd5cf966ff98`) is the canonical operational registry for:
- Agents (`.opencode/config/agent-metadata.json`)
- Skills (`.opencode/skills/*/SKILL.md`)
- Commands (`.opencode/command/**/*.md`)
- Workflows (`_bmad/*/module-help.csv`)
- Sync state (drift detection and sync runs)

Sync via: `bun run registry:sync` or `bun run registry:dry-run`

## 3.3) Notion Surfaces

| Surface | ID | Role |
|---------|-----|------|
| Backend Hub | `6581d9be65b38262a2218102c1e6dd1d` | Structural governance — templates, registries, migrations |
| OpenAgents Control | `3371d9be65b38041bc59fd5cf966ff98` | CLI team registry — agent roster, skills, commands |
| Allura Memory Control Center | `3371d9be65b381a9b3bec24275444b68` | HITL oversight — approvals, sync model |

## 4) Status Taxonomy

Use one of:
- `PLANNED`
- `IN_PROGRESS`
- `COMPLETED`
- `BLOCKED`

Avoid mixed variants (`COMPLETE`, `DONE`, `TBD`) in operational docs.

## 5) Connection Strategy

For MCP runtime connectivity:
- Primary Neo4j URI: `bolt://host.docker.internal:7687`
- Fallback: `bolt://localhost:7687`
- PostgreSQL connection should be sourced from the configured MCP database server using workspace secrets/environment.

## 6) Evidence Rule

Do not claim memory persistence without readback evidence:
- Write operation response
- Follow-up query confirming durable read

## 7) Query Interface Rule

**CRITICAL**: Use MCP Neo4j Memory tools instead of raw Cypher for ALL memory operations.

### ✅ Always Use These Tools (MCP Neo4j Memory Server)

| Tool | Purpose | When to Use |
|------|---------|-------------|
| `MCP_DOCKER_read_graph` | Read entire knowledge graph | Get complete view of all entities and relations |
| `MCP_DOCKER_search_memories` | Fulltext search | Find memories by query (searches names, types, observations) |
| `MCP_DOCKER_find_memories_by_name` | Exact name lookup | When you know specific entity names |
| `MCP_DOCKER_create_entities` | Create new entities | Log new events, episodes, outcomes, insights |
| `MCP_DOCKER_create_relations` | Create relationships | Link entities (e.g., Episode → Outcome) |
| `MCP_DOCKER_add_observations` | Append observations | Add new facts to existing entities |
| `MCP_DOCKER_delete_entities` | Remove entities | Clean up (use sparingly) |
| `MCP_DOCKER_delete_relations` | Remove relationships | Clean up (use sparingly) |
| `MCP_DOCKER_delete_observations` | Remove observations | Clean up (use sparingly) |

### ❌ Never Use for Memory Operations

| Tool | Why Not | What to Use Instead |
|------|---------|---------------------|
| `MCP_DOCKER_read_neo4j_cypher` | Low-level, bypasses memory abstractions | `MCP_DOCKER_search_memories`, `MCP_DOCKER_read_graph` |
| `MCP_DOCKER_write_neo4j_cypher` | Risk of schema drift | `MCP_DOCKER_create_entities`, `MCP_DOCKER_add_observations` |

### When Cypher is Allowed

**Only use Cypher (`MCP_DOCKER_write_neo4j_cypher`) for:**
- Complex custom queries requiring aggregation/computation
- Schema migrations and index creation
- Administrative operations (backup, maintenance)
- Cases where MCP tools don't provide needed functionality

### Standard Usage Patterns

```javascript
// === READ PATTERNS ===

// Get complete graph overview
MCP_DOCKER_read_graph({})

// Search for relevant memories
MCP_DOCKER_search_memories({
  query: "roninmemory openclaw implementation"
})

// Find specific known entities
MCP_DOCKER_find_memories_by_name({
  names: ["Memory Master", "OpenClawPaper Stack"]
})

// === WRITE PATTERNS ===

// Create a new session reflection
const timestamp = new Date().toISOString();
MCP_DOCKER_create_entities({
  entities: [{
    name: "Session Reflection " + timestamp,
    type: "Reflection",
    observations: [
      "group_id: roninmemory",
      "agent_id: openagent",
      "event_type: session_complete",
      "status: completed",
      "timestamp: " + timestamp,
      "insights: Fixed Neo4j memory integration"
    ]
  }]
});

// Record corresponding operational event in PostgreSQL when available
// (tool and table names depend on the configured MCP database server)

// Link reflection to Memory Master
MCP_DOCKER_create_relations({
  relations: [{
    source: "Session Reflection " + timestamp,
    target: "Memory Master",
    relationType: "PERFORMED_BY"
  }]
});

// Add observations to existing entity
MCP_DOCKER_add_observations({
  observations: [{
    entityName: "Memory Master",
    observations: ["Fixed Neo4j integration on " + timestamp]
  }]
});

// === VERIFICATION PATTERN ===

// Always verify writes with readback
MCP_DOCKER_search_memories({
  query: "Session Reflection " + timestamp
});
```

### Proactive Memory Search on Boot

**REQUIRED**: At session start, ALWAYS search memories before responding to user:

```javascript
// Step 1: Search for context based on user's request
MCP_DOCKER_search_memories({
  query: "<organization> <group> <user's topic or keywords>"
});

// Step 2: If relevant entities found, get full details
// (Optional) MCP_DOCKER_find_memories_by_name({ names: ["..."] })

// Step 3: Present memory context to user
// "I found we previously worked on X..."
```

For Brooks-bound orchestration, load both project-scoped context and global patterns:

```javascript
MCP_DOCKER_search_memories({ query: "<group_id> <topic>" });
MCP_DOCKER_search_memories({ query: "global-coding-skills <topic>" });
```
