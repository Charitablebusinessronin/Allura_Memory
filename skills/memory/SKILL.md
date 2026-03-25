---
name: memory
description: Unified memory operations for PostgreSQL (Layer 1 - Raw Memory), Neo4j (Layer 2 - Semantic Memory), and ADR (Layer 3 - Decision Records). Use for all memory operations - events, insights, entities, relations, and decisions.
---

# Memory Skill

Unified interface to the 3-layer memory system. One skill for all memory operations.

## Quick Reference

| Command | Layer | Purpose |
|---------|-------|---------|
| `memory search events "query"` | 1 | Search PostgreSQL traces |
| `memory log event <type> <data>` | 1 | Log event to PostgreSQL |
| `memory search insights "query"` | 2 | Search Neo4j knowledge |
| `memory create insight <summary>` | 2 | Create Neo4j insight |
| `memory create entity <name> <type>` | 2 | Create knowledge graph entity |
| `memory create relation <from> <to> <type>` | 2 | Link entities |
| `memory log decision <title>` | 3 | Log ADR with counterfactuals |
| `memory health` | All | Check system connections |
| `memory graph` | 2 | Read full knowledge graph |

## Layer Architecture

```
┌─────────────────────────────────────────────────────┐
│                 Layer 1: Raw Memory                 │
│                    PostgreSQL                        │
│         Every event, action, mistake logged          │
│                   (append-only)                      │
└─────────────────────────────────────────────────────┘
                         │
                         │ trace_ref
                         ▼
┌─────────────────────────────────────────────────────┐
│              Layer 2: Semantic Memory               │
│                      Neo4j                           │
│       Insights, entities, relationships              │
│              (versioned via SUPERSEDES)              │
└─────────────────────────────────────────────────────┘
                         │
                         │ references
                         ▼
┌─────────────────────────────────────────────────────┐
│              Layer 3: Decision Records               │
│                      Neo4j                           │
│    ADRs with 5-layer audit (action, context,         │
│    reasoning, counterfactuals, oversight)            │
└─────────────────────────────────────────────────────┘
```

---

## Commands

### Layer 1: Raw Memory (PostgreSQL)

#### `memory search events`

Search raw execution traces.

**Parameters:**
| Parameter | Required | Description | Example |
|-----------|----------|-------------|---------|
| query | yes | Search query | `"authentication"` |
| group_id | yes | Tenant/project ID | `"memory"` |
| event_type | no | Filter by type | `"mistake"` |
| agent_id | no | Filter by agent | `"dev-agent"` |
| limit | no | Max results (default: 10) | `20` |

**MCP Tool:** `MCP_DOCKER_search_memories`

**Example:**
```
User: "Search for events about authentication"
User: "Find all mistakes logged yesterday"
User: "What did the dev agent do last session?"
```

**Process:**
1. Parse query and filters from user input
2. Call `MCP_DOCKER_search_memories` with query for event_type content
3. Format results as timeline

**Output:**
```
🔍 Search: "authentication" (15 results, 45ms)

📌 [agent_action] evt_17530
   Agent: dev-agent
   Workflow: feature-auth
   Status: ✅ completed
   Time: 2024-03-15 14:20 UTC
   
   Metadata:
   • action: implemented_login
   • files: ["src/auth/login.ts"]
```

---

#### `memory log event`

Log an event to PostgreSQL.

**Parameters:**
| Parameter | Required | Description | Example |
|-----------|----------|-------------|---------|
| event_type | yes | Type of event | `"agent_action"` |
| agent_id | yes | Agent identifier | `"dev-agent"` |
| group_id | yes | Tenant/project ID | `"memory"` |
| metadata | no | Event details (JSON) | `{"action": "created_file"}` |
| workflow_id | no | Workflow reference | `"epic-1"` |
| status | no | Completion status | `"completed"` |

**MCP Tool:** `unified-memory_log_event`

**Example:**
```
User: "Log that dev-agent implemented login feature"
User: "Record mistake: forgot input validation"
User: "Save this event for the auth workflow"
```

**Process:**
1. Parse event_type, agent_id, and metadata from user input
2. Construct event payload
3. Call `unified-memory_log_event`
4. Return event_id for future reference

**Output:**
```
✅ Event Logged

📌 Event ID: evt_17530
📋 Type: agent_action
👤 Agent: dev-agent
🏷️ Group: memory
⏰ Time: 2024-03-15T14:20:00Z

💡 Use this event_id to link insights later
```

---

### Layer 2: Semantic Memory (Neo4j)

#### `memory search insights`

Search the knowledge graph for insights.

**Parameters:**
| Parameter | Required | Description | Example |
|-----------|----------|-------------|---------|
| query | yes | Search query | `"embedding dimensions"` |
| min_confidence | no | Minimum confidence 0-1 | `0.7` |
| entity_type | no | Filter by entity type | `"Insight"` |
| limit | no | Max results (default: 10) | `20` |

**MCP Tool:** `MCP_DOCKER_search_memories`

**Example:**
```
User: "Search for insights about Neo4j patterns"
User: "Find knowledge about embeddings"
User: "What do we know about authentication?"
```

**Process:**
1. Parse query and filters
2. Call `MCP_DOCKER_search_memories` with query for Insight type
3. Return ranked results by confidence

**Output:**
```
🔍 Knowledge Search: "embedding" (5 results)

📌 ins_17540 [confidence: 92%]
   Summary: Qwen3-Embedding-8B uses 4096-dimensional vectors
   
   Created: 2024-03-15T14:30:00Z
   Trace: events:evt_17532
   
   💡 Related entities: Qwen3, Embedding, Ollama
```

---

#### `memory create insight`

Create a new insight in Neo4j.

**Parameters:**
| Parameter | Required | Description | Example |
|-----------|----------|-------------|---------|
| summary | yes | Brief description | `"Use group_id for all operations"` |
| group_id | yes | Tenant/project ID | `"memory"` |
| confidence | no | Confidence 0-1 (default: 0.5) | `0.85` |
| entities | no | Related entity names | `["Neo4j", "group_id"]` |
| tags | no | Category tags | `["best-practice", "database"]` |
| content | no | Full content (markdown) | Extended details |
| trace_ref | no | Link to event | `"events:evt_17530"` |

**MCP Tool:** `unified-memory_create_insight`

**Example:**
```
User: "Save this insight: Qwen3 embeddings are 4096 dimensions"
User: "Store finding: SUPERSEDES pattern prevents overwrites"
User: "Remember: Always validate group_id before operations"
```

**Process:**
1. First search for similar insights to avoid duplicates
2. If duplicate found, ask user to confirm or use SUPERSEDES
3. Call `unified-memory_create_insight`
4. Return insight_id for reference

**Output:**
```
✅ Insight Created

📌 Insight ID: ins_17540
📝 Summary: Qwen3-Embedding-8B uses 4096-dimensional vectors
📊 Confidence: 92%
🏷️ Group: memory
🏷️ Tags: embedding, ollama, local-ai

💡 Tip: Use insight_id to create relationships
```

---

#### `memory create entity`

Create an entity in the knowledge graph.

**Parameters:**
| Parameter | Required | Description | Example |
|-----------|----------|-------------|---------|
| name | yes | Unique entity name | `"Qwen3"` |
| type | yes | Entity type | `"Model"`, `"Concept"` |
| observations | no | List of facts | `["Local embedding model", "4096 dimensions"]` |

**MCP Tool:** `MCP_DOCKER_create_entities`

**Example:**
```
User: "Create entity Qwen3 as a Model"
User: "Add entity Authentication as a Concept"
```

**Process:**
1. Parse entity name and type
2. Check if entity already exists via `MCP_DOCKER_find_memories_by_name`
3. If exists, offer to add observations instead
4. Call `MCP_DOCKER_create_entities`
5. Return entity confirmation

**Output:**
```
✅ Entity Created

📌 Name: Qwen3
📋 Type: Model
🏷️ Observations:
   • Local embedding model
   • 4096 dimensions
   • Runs via Ollama
```

---

#### `memory create relation`

Create a relationship between entities.

**Parameters:**
| Parameter | Required | Description | Example |
|-----------|----------|-------------|---------|
| from_entity | yes | Source entity name | `"Qwen3"` |
| to_entity | yes | Target entity name | `"Ollama"` |
| relation_type | yes | Relationship type | `"RUNS_ON"` |
| properties | no | Relationship properties | `{"port": 11434}` |

**MCP Tool:** `MCP_DOCKER_create_relations`

**Example:**
```
User: "Create relation: Qwen3 RUNS_ON Ollama"
User: "Link Authentication to User management"
```

**Process:**
1. Parse from/to entities and relationship type
2. Verify both entities exist via `MCP_DOCKER_find_memories_by_name`
3. Call `MCP_DOCKER_create_relations`
4. Return relationship confirmation

**Output:**
```
✅ Relationship Created

📌 (Qwen3)-[RUNS_ON]->(Ollama)
🏷️ Properties:
   • port: 11434
```

---

### Layer 3: Decision Records (ADR)

#### `memory log decision`

Log an Agent Decision Record with counterfactuals.

**Parameters:**
| Parameter | Required | Description | Example |
|-----------|----------|-------------|---------|
| title | yes | Decision summary | `"Use Ollama for embeddings"` |
| action | yes | What was decided | `"Default to Ollama Qwen3-Embedding-8B"` |
| context | yes | Why it matters | `"Reduce API costs and latency"` |
| reasoning | yes | Analysis process | `"Benchmarked OpenAI vs Ollama..."` |
| group_id | yes | Tenant/project ID | `"memory"` |
| alternatives | no | Counterfactuals | `[{decision, rationale}]` |
| trace_ref | no | Evidence reference | `"events:evt_17530"` |
| tags | no | Categories | `["embedding", "architecture"]` |

**MCP Tool:** `unified-memory_log_decision`

**Example:**
```
User: "Log decision: We chose PostgreSQL for traces because it's append-only"
User: "Record that we picked Ollama over OpenAI for embeddings"
```

**Process:**
1. Parse title, action, context, and reasoning from user input
2. Prompt for alternatives if not provided
3. Construct 5-layer ADR
4. Call `unified-memory_log_decision`
5. Return decision_id

**Output:**
```
✅ Decision Logged

📌 Decision ID: adr_embedding_2024_03_15
📝 Title: Use Ollama for local embeddings
🏷️ Group: memory

📋 Action:
Default to Ollama Qwen3-Embedding-8B for all embedding operations

🎯 Context:
Running locally reduces API costs, eliminates external dependencies...

💡 Reasoning:
Evaluated three options: OpenAI API, Ollama local...

🔄 Alternatives Considered:
   1. OpenAI text-embedding-3-small
      - Rejected: Cost and latency concerns
   
   2. Build custom embedding model
      - Rejected: High development effort
```

---

### Utility Commands

#### `memory health`

Check all system connections.

**MCP Tool:** `unified-memory_health_check`

**Process:**
1. Call `unified-memory_health_check`
2. Report status of PostgreSQL, Neo4j, Notion (if configured)

**Output:**
```
🏥 Memory System Health Check

✅ PostgreSQL: Connected (localhost:5432)
✅ Neo4j: Connected (localhost:7687)
⚠️  Notion: Not configured (optional)
```

---

#### `memory graph`

Read the full knowledge graph.

**MCP Tool:** `MCP_DOCKER_read_graph`

**Process:**
1. Call `MCP_DOCKER_read_graph`
2. Return entities and relationships

**Output:**
```
📊 Knowledge Graph Summary

📌 Entities: 45
   • 12 Insights
   • 20 Concepts
   • 8 Models
   • 5 Projects

📌 Relationships: 67
   • 25 REFERENCES
   • 18 USES
   • 12 RUNS_ON
   • 8 SUPERSEDES
   • 4 CREATED_BY
```

---

## Best Practices

### Layer Selection

| Goal | Layer | Command |
|------|-------|---------|
| Debug history | 1 | `memory search events` |
| Learn from past | 2 | `memory search insights` |
| Record knowledge | 2 | `memory create insight` |
| Track decisions | 3 | `memory log decision` |
| Link entities | 2 | `memory create relation` |

### Common Patterns

**Pattern 1: Debug with History**
```
1. memory search events "error"
2. Find relevant event_id
3. memory create insight "Fix for error X"
4. Link via trace_ref
```

**Pattern 2: Build Knowledge**
```
1. memory create entity "Concept" "Authentication"
2. memory create entity "Concept" "JWT"
3. memory create relation "JWT" "USES" "Authentication"
4. memory create insight "JWT best for stateless auth"
```

**Pattern 3: Record Decision Trail**
```
1. memory log event "chose_database"
2. memory log decision with event as trace_ref
3. memory create insight from decision
```

---

## Error Handling

| Error | Solution |
|-------|----------|
| `PostgreSQL connection failed` | Check container: `docker ps` |
| `Neo4j connection failed` | Check container: `docker ps` |
| `group_id required` | Always provide tenant ID |
| `Duplicate insight` | Use SUPERSEDES pattern |
| `Entity not found` | Create entity first |

---

## Integration with bmad-master

When invoked from bmad-master:
- `[MS]` → `memory search insights`
- `[ME]` → `memory search events`
- `[MC]` → `memory create insight`
- `[ML]` → `memory log event`
- `[MD]` → `memory log decision`

---

## See Also

- `bmad-master` agent - Orchestrates memory operations
- `MCP_DOCKER_*` tools - Underlying MCP operations
- `unified-memory_*` tools - Unified memory interface