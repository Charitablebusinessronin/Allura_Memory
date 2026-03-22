---
name: bmad-memory-create-insight
description: Create insights in Neo4j (Layer 2 - Semantic Memory). Use when user wants to store learned knowledge, best practices, or patterns.
---

# Memory Create Insight Skill

Create insights in the Neo4j knowledge graph. This is Layer 2 of the 4-Layer Memory System.

## When to Use

- User wants to "save", "store", "remember" knowledge
- Agent learns something worth preserving for future sessions
- Research findings should be captured
- Best practices or patterns discovered
- Decision rationale should be preserved

## Usage

```
User: "Save this insight: Qwen3 embeddings are 4096 dimensions"
User: "Store this finding: Neo4j SUPERSEDES pattern prevents overwrites"
User: "Remember: Always validate group_id before database operations"
```

## MCP Tool

**Tool:** `create_insight`
**Layer:** 2 - Neo4j (Semantic Memory)
**Purpose:** Store learned knowledge with versioning

## Input Parameters

| Parameter | Required | Type | Description | Example |
|-----------|----------|------|-------------|---------|
| summary | yes | string | Brief description | "Qwen3-Embedding-8B uses 4096 dimensions" |
| group_id | yes | string | Tenant/project identifier | `memory`, `roninos` |
| content | no | string | Full detailed content | Extended markdown content |
| confidence | no | number | Confidence level 0.0-1.0 | `0.85` (default: 0.5) |
| entities | no | array | Related entity names | `["Qwen3", "Embedding", "Ollama"]` |
| trace_ref | no | string | Link to PostgreSQL event | `events:evt_17532` |
| status | no | string | Insight status | `proposed`, `active`, `deprecated` |
| tags | no | array | Tag labels | `["embedding", "ollama", "local"]` |

## Process

### Step 1: Check for Duplicates

Before creating, search for similar insights:

```json
{
  "query": "Qwen3 embedding dimensions",
  "group_id": "memory",
  "limit": 5
}
```

If similar exists, consider:
- Updating confidence (if new evidence)
- Using SUPERSEDES to version
- Adding entities/tags to existing

### Step 2: Prepare Insight Content

```json
{
  "summary": "Qwen3-Embedding-8B uses 4096-dimensional vectors",
  "content": "## Technical Details\n\nQwen3-Embedding-8B produces 4096-dimensional embedding vectors. This is larger than OpenAI's text-embedding-3-small (1536) but offers better multilingual support.\n\n## Integration Point\n\nAccess via Ollama's OpenAI-compatible API at `http://localhost:11434/v1/embeddings`.",
  "group_id": "memory",
  "confidence": 0.92,
  "entities": ["Qwen3", "Embedding", "Ollama", "4096"],
  "tags": ["embedding", "ollama", "local-ai"],
  "trace_ref": "events:evt_17532"
}
```

### Step 3: Call MCP Tool

Use the `create_insight` MCP tool with the prepared parameters.

### Step 4: Store Returned Insight ID

The tool returns an `insight_id`. Store for:
- Future reference
- Creating relationships
- Linking to decisions

### Step 5: Report Result

```
✅ Insight Created Successfully

📌 Insight ID: ins_12345
📝 Summary: Qwen3-Embedding-8B uses 4096-dimensional vectors
📊 Confidence: 92%
🏷️ Group: memory
🏷️ Tags: embedding, ollama, local-ai
🔗 Trace: events:evt_17532

💡 Next: Link to related entities or use in decisions
```

## Insight Lifecycle

```
proposed → active → deprecated → archived
              ↓
         revision (creates new version)
              ↓
         SUPERSEDES old version
```

## Examples

### Create Basic Insight

```json
{
  "summary": "Use group_id for all database operations",
  "group_id": "memory",
  "confidence": 0.95,
  "entities": ["group_id", "tenant", "isolation"],
  "tags": ["best-practice", "database"]
}
```

### Create Insight with Full Content

```json
{
  "summary": "SUPERSEDES pattern in Neo4j prevents overwrites",
  "content": "## Pattern Overview\n\nWhen creating a new version of an insight:\n1. Create new insight node\n2. Create SUPERSEDES relationship from new to old\n3. Old insight remains for audit trail\n\n## Benefits\n\n- Complete version history\n- No data loss\n- Traceable changes\n\n## Example\n\n```cypher\nCREATE (new:Insight {...})\nCREATE (old:Insight {...})\nCREATE (new)-[:SUPERSEDES]->(old)\n```",
  "group_id": "memory",
  "confidence": 0.90,
  "entities": ["Neo4j", "SUPERSEDES", "versioning"],
  "tags": ["pattern", "neo4j", "versioning"]
}
```

### Link Insight to Event Evidence

```json
{
  "summary": "Embedding deduplication improved recall by 15%",
  "group_id": "memory",
  "confidence": 0.88,
  "trace_ref": "events:evt_17532",
  "entities": ["Embedding", "Deduplication", "Recall"],
  "tags": ["metrics", "improvement"]
}
```

## Response Format

The `create_insight` tool returns:

```json
{
  "insight_id": "ins_17540",
  "summary": "Qwen3-Embedding-8B uses 4096-dimensional vectors",
  "group_id": "memory",
  "confidence": 0.92,
  "status": "proposed",
  "created_at": "2024-03-15T14:30:00Z",
  "entities": ["Qwen3", "Embedding", "Ollama", "4096"],
  "tags": ["embedding", "ollama", "local-ai"]
}
```

## Creating Relationships

After creating an insight, optionally create relationships:

```json
// Using create_relation MCP tool
{
  "from_type": "Insight",
  "from_name": "ins_17540",
  "to_type": "Entity",
  "to_name": "Qwen3",
  "relationship": "REFERENCES",
  "group_id": "memory"
}
```

## Error Handling

| Error | Solution |
|-------|----------|
| `group_id required` | Always provide tenant identifier |
| `summary required` | Provide brief summary |
| `Neo4j connection failed` | Check container: `docker ps` |
| `Invalid confidence` | Use 0.0 to 1.0 range |
| `Duplicate detected` | Consider SUPERSEDES pattern |

## Layer Relationship

```
Layer 1: log_event (PostgreSQL)
    │
    └─ Event ID: evt_17532
         │
         └─ Layer 2: create_insight (Neo4j) ← YOU ARE HERE
              │
              ├─ trace_ref: "events:evt_17532"  ← Links to evidence
              │
              └─ insight_id: ins_17540
                   │
                   └─ Layer 3: log_decision (ADR)
                        │
                        └─ Can reference ins_17540
```

## Best Practices

1. **Always include group_id** - Required for tenant isolation
2. **Write good summaries** - Enables faster search
3. **Include trace_ref** - Links to evidence in PostgreSQL
4. **Set realistic confidence** - 0.7+ for high confidence
5. **Add relevant entities** - Improves knowledge graph
6. **Use descriptive tags** - Helps categorization

## See Also

- `bmad-memory-search-insights` - Search for insights
- `bmad-memory-log-event` - Create evidence for insights
- `bmad-memory-log-decision` - Reference insights in decisions
- `create_relation` MCP tool - Create relationships between insights