---
name: allura-memory
description: |
  Allura's Memory — persistent AI knowledge system via Docker MCP Gateway.
  Provides access to PostgreSQL (raw traces), Neo4j (semantic knowledge graph),
  and decision records. Use this skill for all memory read/write operations.
  
  When to use:
  - Searching past events and execution traces
  - Querying or creating knowledge graph insights
  - Creating entities and relationships in Neo4j
  - Logging architectural decisions (ADRs)
  - Checking memory system health
---

Persistent AI memory system accessed via the **ronin-memory** MCP server.

## Prerequisites

The `ronin-memory` server must be enabled in `opencode.json`. It runs containerized and connects to the PostgreSQL and Neo4j instances.

---

## Architecture

```
┌──────────────────────────────────────────────────────┐
│              Layer 1: Raw Memory                     │
│                 PostgreSQL                            │
│      Every event, action, mistake logged             │
│                (append-only)                          │
└──────────────────────────────────────────────────────┘
                         │
                         │ trace_ref
                         ▼
┌──────────────────────────────────────────────────────┐
│            Layer 2: Semantic Memory                  │
│                   Neo4j                               │
│     Insights, entities, relationships                │
│           (versioned via SUPERSEDES)                  │
└──────────────────────────────────────────────────────┘
                         │
                         │ references
                         ▼
┌──────────────────────────────────────────────────────┐
│            Layer 3: Decision Records                 │
│                   Neo4j                               │
│  ADRs with 5-layer audit (action, context,           │
│  reasoning, counterfactuals, oversight)              │
└──────────────────────────────────────────────────────┘
                         │
                         │ discovery
                         ▼
┌──────────────────────────────────────────────────────┐
│            Layer 4: ADAS (Agent Design)              │
│                 Search Loop                           │
│  Automated discovery and promotion of agent designs   │
└──────────────────────────────────────────────────────┘
```

---

## Tool Reference

All tools are provided by the `ronin-memory` server.

### Unified Search & Query

**Search raw events (episodic memory):**
```
mcp_exec  name="search_events"  arguments={"query": "your query"}
```

**Search insights (semantic memory):**
```
mcp_exec  name="search_insights"  arguments={"query": "your query"}
```

**Dual context search (Episodic + Semantic):**
```
mcp_exec  name="query_dual_context"  arguments={"query": "your query"}
```

### Writing Memory

**Log a raw event:**
```
mcp_exec  name="log_event"  arguments={"group_id": "...", "event_type": "...", "agent_id": "...", "metadata": {}}
```

**Create an insight:**
```
mcp_exec  name="create_insight"  arguments={"group_id": "...", "summary": "...", "confidence": 0.8}
```

**Log an ADR (Decision Record):**
```
mcp_exec  name="log_decision"  arguments={"group_id": "...", "decision_id": "...", "action": "...", "decision_made": "..."}
```

### ADAS (Automated Design of Agent Systems)

**Run an evolutionary agent search:**
```
mcp_exec  name="mcp__adas__run_search"  arguments={"domain": "code", "group_id": "your-project-id"}
```

**List pending proposals:**
```
mcp_exec  name="mcp__adas__get_proposals"  arguments={"group_id": "your-project-id"}
```

**Approve a proposal:**
```
mcp_exec  name="mcp__adas__approve_proposal"  arguments={"proposal_id": "...", "decision": "approved"}
```

### Knowledge Curation & Notion Sync

**Run the curator pipeline:**
```
mcp_exec  name="run_curation"  arguments={"batch_size": 20}
```

**Check for duplicates:**
```
mcp_exec  name="check_duplicate_insight"  arguments={"canonical_tag": "...", "summary": "..."}
```

**Sync to Notion:**
```
mcp_exec  name="promote_insight_to_notion"  arguments={"insight_id": "...", "group_id": "..."}
```

---

## Critical Rules

### group_id Isolation
Every memory operation MUST include a `group_id` for tenant isolation. Valid project slugs (canonical tags) include:
- `faith-meats`
- `difference-driven`
- `patriot-awning`
- `global`

### SUPERSEDES Versioning
Never edit Insight nodes. Create a new version linked via a `SUPERSEDES` edge to maintain history and audit trail.

---

## Common Patterns

### Pattern 1: Evolutionary Discovery
1. Use `mcp__adas__run_search` to find the best agent architecture for a task.
2. Review the `mcp__adas__get_proposals` in Mission Control.
3. Call `mcp__adas__approve_proposal` to promote the best design.

### Pattern 2: Multi-Layer Context
1. Call `get_agent_context` to load an agent's assigned knowledge and past decisions.
2. Enrich current work with `query_dual_context` to see both what we *did* (traces) and what we *know* (insights).
3. Log final decisions using `log_decision`.

---

## Troubleshooting

| Error | Solution |
|-------|----------|
| `Server ronin-memory not found` | Check `opencode.json` configuration |
| `Postgres unavailable` | Ensure `knowledge-postgres` container is running |
| `Invalid tag` | Use a canonical slug (e.g., `faith-meats`, not "Faith Meats") |
| `Confidence too low` | Promotion tools require confidence >= 0.7 |
