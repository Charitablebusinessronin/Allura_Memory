---
name: bmad-memory-search-insights
description: Search Neo4j insights (Layer 2 - Semantic Memory). Use when user wants to search knowledge graph for insights, entities, or relationships.
---

# Memory Search Insights Skill

Search the knowledge graph (Neo4j) for insights, entities, and relationships. This is Layer 2 of the 4-Layer Memory System.

## When to Use

- User asks to "find", "search", "look for" knowledge or insights
- Agent needs context from previous sessions
- Starting work: "What do we know about X?"
- Decision support: "Find insights about this technology"
- Understanding relationships between concepts

## Usage

```
User: "Search for anything about embeddings"
User: "Find insights about Neo4j"
User: "What do we know about Qwen3?"
User: "Search memories for 'authentication' in roninos project"
```

## MCP Tool

**Tool:** `search_insights`
**Layer:** 2 - Neo4j (Semantic Memory)
**Purpose:** Query the knowledge graph

## Input Parameters

| Parameter | Required | Type | Description | Example |
|-----------|----------|------|-------------|---------|
| query | yes | string | Search terms | `embedding similarity` |
| group_id | yes | string | Tenant/project identifier | `memory`, `roninos` |
| entity_filter | no | array | Filter by entity names | `["Neo4j", "PostgreSQL"]` |
| confidence_min | no | number | Minimum confidence | `0.7` (default: 0.0) |
| limit | no | number | Max results | `20` (default: 10) |
| status | no | string | Filter by status | `active`, `proposed` |
| date_from | no | string | Start date filter | `2024-01-01T00:00:00Z` |
| date_to | no | string | End date filter | `2024-12-31T23:59:59Z` |

## Process

### Step 1: Construct Search Query

Gather parameters:
- **query**: Search terms (supports full-text)
- **group_id**: Required tenant ID
- **filters**: Optional confidence, entity, status filters

### Step 2: Call MCP Tool

Use the `search_insights` MCP tool:

```json
{
  "query": "embedding deduplication",
  "group_id": "memory",
  "confidence_min": 0.7,
  "limit": 10
}
```

### Step 3: Process Results

Results include:
- `insight_id`: Unique identifier
- `summary`: Brief description
- `content`: Full content (if stored)
- `confidence`: Confidence level
- `entities`: Related entities
- `tags`: Categorization tags
- `trace_ref`: Link to evidence

### Step 4: Present Results

```markdown
## Search Results: "embedding deduplication" (8 found, 38ms)

### 1. Qwen3-Embedding-8B uses 4096-dimensional vectors [92% confidence]
**ID:** ins_17540
**Entities:** Qwen3, Embedding, Ollama, 4096
**Tags:** embedding, ollama, local-ai
**Status:** active ✅

**Summary:** Qwen3-Embedding-8B produces 4096-dimensional vectors, larger than OpenAI's 1536.

[Show Full Content]

---

### 2. Embedding deduplication improved recall by 15% [88% confidence]
**ID:** ins_17532
**Entities:** Embedding, Deduplication, Recall
**Tags:** metrics, improvement
**Status:** active ✅

**Summary:** Embedding-based similarity matching improved recall in duplicate detection.

---
```

## Search Tips

### By Confidence

```json
{
  "query": "authentication",
  "group_id": "roninos",
  "confidence_min": 0.8
}
```

### By Entity

```json
{
  "query": "",
  "group_id": "roninos",
  "entity_filter": ["Neo4j", "PostgreSQL"]
}
```

### By Status

```json
{
  "query": "embedding",
  "group_id": "memory",
  "status": "active"
}
```

### By Time Range

```json
{
  "query": "decision",
  "group_id": "memory",
  "date_from": "2024-03-01T00:00:00Z",
  "date_to": "2024-03-31T23:59:59Z"
}
```

### Combined Filters

```json
{
  "query": "pattern",
  "group_id": "memory",
  "confidence_min": 0.7,
  "status": "active",
  "entity_filter": ["Neo4j"],
  "limit": 20
}
```

## Response Format

The `search_insights` tool returns:

```json
{
  "results": [
    {
      "insight_id": "ins_17540",
      "summary": "Qwen3-Embedding-8B uses 4096-dimensional vectors",
      "content": "Full content...",
      "group_id": "memory",
      "confidence": 0.92,
      "status": "active",
      "entities": ["Qwen3", "Embedding", "Ollama", "4096"],
      "tags": ["embedding", "ollama", "local-ai"],
      "trace_ref": "events:evt_17532",
      "created_at": "2024-03-15T14:30:00Z"
    }
  ],
  "total": 8,
  "query_time_ms": 38
}
```

## Output Format

```
🔍 Search: "embedding deduplication"
   Group: memory
   Found: 8 results (38ms)

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

📌 [Insight] ins_17540 - Qwen3-Embedding-8B uses 4096-dimensional vectors
   Confidence: 92% | Status: active ✅
   Entities: Qwen3, Embedding, Ollama, 4096
   Tags: embedding, ollama, local-ai
   Trace: events:evt_17532

   Summary:
   Qwen3-Embedding-8B produces 4096-dimensional vectors,
   larger than OpenAI's 1536, offering better multilingual support.

   [Type 'show' to see full content]

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

📌 [Insight] ins_17532 - Embedding deduplication improved recall by 15%
   Confidence: 88% | Status: active ✅
   Entities: Embedding, Deduplication, Recall
   Tags: metrics, improvement

   Summary:
   Embedding-based similarity matching improved recall
   in duplicate detection tasks.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

## Using Results

### Get Full Content

If summary is insufficient, use the insight_id to retrieve full content:

```json
// Using get_entity MCP tool
{
  "type": "Insight",
  "name": "ins_17540",
  "group_id": "memory"
}
```

### Find Related Insights

Use entity names to find related insights:

```json
{
  "query": "",
  "group_id": "memory",
  "entity_filter": ["Qwen3", "Ollama"]
}
```

### Create Relationships

Link related insights:

```json
// Using create_relation MCP tool
{
  "from_type": "Insight",
  "from_name": "ins_17540",
  "to_type": "Insight",
  "to_name": "ins_17532",
  "relationship": "RELATED_TO",
  "group_id": "memory"
}
```

## Error Handling

| Error | Solution |
|-------|----------|
| `group_id required` | Always provide tenant identifier |
| `No results found` | Try broader query, lower confidence_min |
| `Neo4j connection failed` | Check container: `docker ps` |
| `Query too short` | Provide more descriptive search |

## Layer Relationship

```
Layer 1: log_event (PostgreSQL)
    │
    └─ Events are evidence
         │
         └─ Layer 2: search_insights (Neo4j) ← YOU ARE HERE
              │
              ├─ Find related knowledge
              │
              └─ Use for decision context
                   │
                   └─ Layer 3: log_decision (ADR)
```

## Best Practices

1. **Always include group_id** - Required for multitenancy
2. **Use confidence_min** - Filter to high-confidence insights
3. **Check entities** - Find related concepts
4. **Look at trace_ref** - Follow evidence chain
5. **Note status** - Prefer 'active' insights
6. **Combine with event search** - Layer 1 + Layer 2 = full context

## See Also

- `bmad-memory-create-insight` - Create new insights
- `bmad-memory-search-events` - Search Layer 1 events
- `bmad-memory-log-decision` - Reference insights in decisions
- `get_entity` MCP tool - Get specific entity
- `create_relation` MCP tool - Create relationships