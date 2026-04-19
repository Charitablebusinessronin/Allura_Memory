# Connected Workflow Protocol — Allura Brain

> **AI-Assisted Documentation**
> Portions of this document were drafted with AI assistance and reviewed against Brooksian principles.
> When in doubt, defer to the source code and team consensus.

**Date:** 2026-04-13
**Decider:** Brooks (Architect)
**ADR:** Team RAM Naming Unification — No Greek Gods
**Status:** Active

---

## The Problem

Agents were treating Allura Brain like a filing cabinet — writing at session end, reading only when stuck. The brain should be the nervous system, not a database you query occasionally.

## The Protocol: Search → Decide → Write → Verify

Every agent interaction follows this loop:

```
┌─────────────────────────────────────────────────┐
│              CONNECTED WORKFLOW                   │
│                                                  │
│  1. SEARCH — Query brain BEFORE deciding         │
│     ├─ Notion (planning surface)                 │
│     ├─ PostgreSQL (episodic traces)              │
│     └─ Neo4j (semantic knowledge)                │
│                                                  │
│  2. THINK — Incorporate brain context             │
│     ├─ What does the brain already know?         │
│     ├─ What decisions were made before?          │
│     └─ What contradictions exist?                │
│                                                  │
│  3. DECIDE — Make the architectural call          │
│     ├─ Build on existing decisions               │
│     ├─ Surface contradictions, don't paper over  │
│     └─ One decision per task, not ten            │
│                                                  │
│  4. WRITE — Log immediately, not at session end  │
│     ├─ PostgreSQL: event trace (append-only)      │
│     ├─ Notion: planning surface update           │
│     └─ Neo4j: promote if score ≥ 0.85            │
│                                                  │
│  5. VERIFY — Confirm the write succeeded         │
│     ├─ Read back from PostgreSQL                 │
│     ├─ Check Notion page exists                  │
│     └─ Search Neo4j for the node                 │
│                                                  │
└─────────────────────────────────────────────────┘
```

## Mandatory Rules

### Rule 1: Search Before Decide
Every agent MUST query Allura Brain before making any architectural decision, design choice, or code change that affects contracts, schemas, or invariants.

**Tools:**
- `mcp__MCP_DOCKER__notion-search` — Planning surface
- `mcp__MCP_DOCKER__execute_sql` — Episodic traces
- `mcp__MCP_DOCKER__read_neo4j_cypher` — Semantic knowledge

### Rule 2: Write Immediately
Every significant action MUST be logged to PostgreSQL immediately, not batched at session end.

**Event types:** `ADR_CREATED`, `INTERFACE_DEFINED`, `TECH_STACK_DECISION`, `TASK_COMPLETE`, `BLOCKED`, `LESSON_LEARNED`

**Tool:** `mcp__MCP_DOCKER__insert_data` or `docker exec knowledge-postgres psql`

### Rule 3: Verify Every Write
After writing to any store, the agent MUST read back to confirm the write succeeded.

**Pattern:**
```
1. Write to PostgreSQL
2. SELECT back the row to confirm
3. If Neo4j: SEARCH for existing node first, then CREATE only if new
4. If Notion: FETCH the page to confirm it exists
```

### Rule 4: Brain Is Mandatory Context
No agent should start a session, make a decision, or implement a feature without first querying the brain for existing context.

**Startup sequence:**
1. `notion-search` for current project context
2. `execute_sql` for last 5 events by agent_id
3. `read_neo4j_cypher` for relevant decisions
4. THEN proceed with work

### Rule 5: Dedup Before Neo4j Write
Every Neo4j write MUST be preceded by a search for existing nodes with the same content. If found, return existing ID instead of creating a duplicate.

## Agent-Specific Brain Usage

| Agent | Search First | Write After | Verify |
|-------|-------------|-------------|--------|
| **Brooks** | Architecture decisions, ADRs, past decisions | ADR_CREATED, INTERFACE_DEFINED | Read back from PG + Notion |
| **Jobs** | Past intent briefs, scope decisions | Scope decisions, acceptance criteria | Read back from PG |
| **Woz** | Code patterns, past implementations | TASK_COMPLETE, build events | Read back from PG |
| **Bellard** | Past benchmarks, performance baselines | Performance findings | Read back from PG |
| **Pike** | Past interface decisions, veto rationale | Interface review results | Read back from PG |
| **Fowler** | Past design drift, refactor plans | Refactor plans | Read back from PG |
| **Scout** | Always read-only | Never writes | N/A |
| **Carmack** | Past optimization patterns | Measurement data | Read back from PG |
| **Knuth** | Past schema decisions, data architecture | Schema insights | Read back from PG + Neo4j |
| **Hightower** | Past infra decisions, deployment configs | Infra events | Read back from PG |

## Anti-Patterns

| Anti-Pattern | Why It's Wrong | What To Do Instead |
|-------------|---------------|-------------------|
| Write at session end | Lose work if session crashes | Write immediately after each decision |
| Read only when stuck | Re-derive patterns the brain already knows | Search first, always |
| Skip verification | Silent write failures corrupt data | Always read back |
| Batch writes | Lose granularity, hard to debug | One event per action |
| Ignore contradictions | Paper over conflicts instead of surfacing them | Flag contradictions, escalate to Brooks |

## Connection to ADR

This protocol is linked to ADR: Team RAM Naming Unification (Notion page: `3411d9be-65b3-8108-a9de-c7a437eb429c`).

The naming unification ensures that every agent in Team RAM uses the same identity consistently across all brain stores — PostgreSQL `agent_id`, Notion `Persona`, and Neo4j node labels.