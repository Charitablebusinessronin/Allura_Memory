---
name: bmad-memory-log-decision
description: Log ADR (Agent Decision Record) with counterfactuals (Layer 3). Use when user wants to record decisions with reasoning and alternatives.
---

# Memory Log Decision Skill

Log Agent Decision Records (ADR) with counterfactuals for the 5-layer audit trail. This is Layer 3 of the 4-Layer Memory System.

## When to Use

- User makes an important decision
- Agent chooses between alternatives
- Architectural choices are made
- User asks to "record this decision"
- Need to preserve reasoning for future reference

## Usage

```
User: "Log this decision: We'll use Ollama for embeddings by default"
User: "Record that we chose Qwen3 over OpenAI for local inference"
User: "Save decision: PostgreSQL for append-only traces, Neo4j for insights"
```

## MCP Tool

**Tool:** `log_decision`
**Layer:** 3 - ADR (Decision Records)
**Purpose:** Capture decisions with reasoning and alternatives

## The Five-Layer ADR

Every decision includes:

| Layer | Purpose | Example |
|-------|---------|---------|
| 1. Action | What was decided | "Use Ollama embeddings by default" |
| 2. Context | Why it matters | "Local embeddings reduce API costs and latency" |
| 3. Reasoning | How we analyzed | "Evaluated OpenAI, Ollama, and custom models" |
| 4. Counterfactuals | What else we considered | Alternative options and why rejected |
| 5. Oversight | Approval status | "Approved by user, validated by benchmark" |

## Input Parameters

| Parameter | Required | Type | Description | Example |
|-----------|----------|------|-------------|---------|
| decision_id | no | string | Unique identifier | `adr_embedding_2024_03_15` |
| title | yes | string | Decision summary | "Use Ollama for embeddings" |
| action | yes | string | What was decided | "Default to Ollama Qwen3-Embedding-8B" |
| context | yes | string | Why this matters | "Reduce API costs and latency" |
| reasoning | yes | string | Analysis process | "Benchmarked OpenAI vs Ollama..." |
| group_id | yes | string | Tenant identifier | `memory`, `roninos` |
| alternatives | no | array | Counterfactuals | `[{decision, rationale}]` |
| trace_ref | no | string | Evidence reference | `events:evt_17532` |
| tags | no | array | Categorization | `["embedding", "ollama", "architecture"]` |

## Process

### Step 1: Frame the Decision

Capture the key components:
- **Action**: What exactly was decided?
- **Context**: Why does this matter?
- **Reasoning**: How did we arrive at this?

### Step 2: Document Alternatives

For each alternative considered:

```json
{
  "alternatives": [
    {
      "decision": "Use OpenAI text-embedding-3-small",
      "rationale": "Well-documented but requires API key and has per-call costs"
    },
    {
      "decision": "Build custom embedding model",
      "rationale": "Maximum control but high development effort"
    }
  ]
}
```

### Step 3: Call MCP Tool

Use the `log_decision` MCP tool:

```json
{
  "title": "Use Ollama for local embeddings",
  "action": "Default to Ollama Qwen3-Embedding-8B for all embedding operations",
  "context": "Running locally reduces API costs, eliminates external dependencies, and provides better latency for real-time operations",
  "reasoning": "Evaluated three options: OpenAI API, Ollama local, and custom model. Ollama provides best balance of quality (4096 dimensions, multilingual support) and operational simplicity (OpenAI-compatible API on localhost:11434). Benchmark showed 95% quality parity with OpenAI at essentially zero marginal cost.",
  "group_id": "memory",
  "alternatives": [
    {
      "decision": "Use OpenAI text-embedding-3-small",
      "rationale": "Industry standard, well-documented, but costs $0.02 per 1K tokens and requires external API. Rejected due to cost and latency concerns for high-volume operations."
    },
    {
      "decision": "Build custom embedding model",
      "rationale": "Maximum control over dimensions and training. Rejected due to high development effort and maintenance overhead for marginal quality improvement."
    }
  ],
  "trace_ref": "events:evt_17532",
  "tags": ["embedding", "ollama", "architecture", "cost-optimization"]
}
```

### Step 4: Store Decision ID

The tool returns a `decision_id`. Use for:
- Future reference
- Linking to implementation events
- Audit trail navigation

### Step 5: Report Result

```
✅ Decision Logged Successfully

📌 Decision ID: adr_embedding_2024_03_15
📝 Title: Use Ollama for local embeddings
🏷️ Group: memory
⏰ Timestamp: 2024-03-15T14:30:00Z

📋 Action:
Default to Ollama Qwen3-Embedding-8B for all embedding operations

🎯 Context:
Running locally reduces API costs, eliminates external...

💡 Reasoning:
Evaluated three options: OpenAI API, Ollama local...

🔄 Alternatives Considered:
   1. OpenAI text-embedding-3-small
      - Rejected: Cost and latency concerns
   
   2. Build custom embedding model
      - Rejected: High development effort

🔗 Trace: events:evt_17532
🏷️ Tags: embedding, ollama, architecture
```

## Examples

### Simple Decision

```json
{
  "title": "Use PostgreSQL for append-only traces",
  "action": "Store all execution traces in PostgreSQL with event_id primary key",
  "context": "Traces are write-heavy, append-only data that benefits from relational structure",
  "reasoning": "PostgreSQL provides ACID guarantees and efficient querying for trace lookup",
  "group_id": "memory",
  "alternatives": [
    {
      "decision": "Use MongoDB",
      "rationale": "Document store flexibility, but we need relational joins for trace chains"
    }
  ]
}
```

### Complex Decision with Full Trail

```json
{
  "title": "Implement 4-layer memory system",
  "action": "PostgreSQL for raw traces, Neo4j for insights, ADR layer for decisions, Ralph loops for control",
  "context": "AI agents need both detailed execution history and learned knowledge with full auditability",
  "reasoning": "Studied patterns from cognitive architectures: raw memory (episodic) + semantic memory + decision records + control flow. Each layer serves distinct purpose and they're linked via trace_ref and entity relationships.",
  "group_id": "memory",
  "alternatives": [
    {
      "decision": "Single database (PostgreSQL only)",
      "rationale": "Simpler architecture but loses graph relationships and query efficiency for knowledge"
    },
    {
      "decision": "Single database (Neo4j only)",
      "rationale": "Good for knowledge but poor for high-volume write traces and lacks relational constraints"
    },
    {
      "decision": "Event sourcing with Kafka",
      "rationale": "Excellent for event streams but adds infrastructure complexity for our scale"
    }
  ],
  "trace_ref": "events:evt_17000",
  "tags": ["architecture", "database", "memory-system"]
}
```

### Linking to Previous Insights

```json
{
  "title": "Use SUPERSEDES pattern for versioning",
  "action": "Create new version nodes with SUPERSEDES relationships instead of mutating existing nodes",
  "context": "Insights evolve over time and we need complete version history for audit trails",
  "reasoning": "See insight ins_17450 which documents this pattern in detail. SUPERSEDES relationships create an immutable version chain.",
  "group_id": "memory",
  "alternatives": [
    {
      "decision": "Update-in-place with version field",
      "rationale": "Simpler write but loses history and makes audit impossible"
    }
  ],
  "trace_ref": "insight:ins_17450",
  "tags": ["pattern", "neo4j", "versioning"]
}
```

## Response Format

The `log_decision` tool returns:

```json
{
  "decision_id": "adr_embedding_2024_03_15",
  "title": "Use Ollama for local embeddings",
  "group_id": "memory",
  "created_at": "2024-03-15T14:30:00Z",
  "status": "active",
  "layers": {
    "action": "Default to Ollama Qwen3-Embedding-8B...",
    "context": "Running locally reduces API costs...",
    "reasoning": "Evaluated three options...",
    "counterfactuals": [
      {
        "decision": "Use OpenAI...",
        "rationale": "Cost and latency concerns..."
      }
    ]
  }
}
```

## Counterfactual Best Practices

Good counterfactuals include:

1. **Viable alternatives** - Real options that were considered
2. **Clear rationale** - Why each was rejected
3. **Trade-offs** - What you gain/lose with each option
4. **Context fit** - Why the chosen option fits better

Example format:

```json
{
  "decision": "Use SQLite",
  "rationale": "Lightweight but doesn't scale to our expected volume. Rejected for production use."
}
```

## Error Handling

| Error | Solution |
|-------|----------|
| `group_id required` | Always provide tenant identifier |
| `title required` | Provide decision summary |
| `action required` | Document what was decided |
| `context required` | Explain why it matters |
| `reasoning required` | Show analysis process |
| `Neo4j connection failed` | Check container: `docker ps` |

## Layer Relationship

```
Layer 1: log_event (PostgreSQL)
    │
    └─ Events provide evidence
         │
         └─ Layer 2: create_insight (Neo4j)
              │
              └─ Insights inform decisions
                   │
                   └─ Layer 3: log_decision (ADR) ← YOU ARE HERE
                        │
                        ├─ trace_ref links to events
                        └─ References insights for reasoning
```

## Best Practices

1. **Always include counterfactuals** - Decision quality shows in alternatives
2. **Link to evidence** - Use `trace_ref` to connect to events/insights
3. **Be specific in action** - What exactly was decided?
4. **Document context** - Future readers need to understand relevance
5. **Show reasoning** - How did you analyze the options?
6. **Use descriptive tags** - Helps future searching

## Querying Decisions

Use `search_decisions` MCP tool:

```json
{
  "query": "embedding",
  "group_id": "memory",
  "limit": 10
}
```

Use `get_decision` MCP tool:

```json
{
  "decision_id": "adr_embedding_2024_03_15",
  "group_id": "memory"
}
```

## See Also

- `bmad-memory-log-event` - Create evidence events (Layer 1)
- `bmad-memory-create-insight` - Create insights for context (Layer 2)
- `get_decision` MCP tool - Retrieve specific decision
- `search_decisions` MCP tool - Search decision records