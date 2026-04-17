---
name: superpowers-memory
description: Add memory logging and hydration to Superpowers skills using Allura Brain MCP tools. Use at session start to retrieve context, at session end to log outcomes.
---

# Superpowers Memory Integration

Add persistent memory logging and hydration to Superpowers skills using Allura Brain's canonical MCP tools.

## When to Use

- At session start: Retrieve previous context for this group/workflow
- During skill execution: Log key events, decisions, and milestones
- At session end: Log outcomes, create insights, link to source events

## Core Workflow

```
Session Start:
  1. memory_search for group_id + recent events
  2. memory_search for related insights in Neo4j
  3. PRESENT summary to agent

During Execution:
  1. memory_add at each checkpoint (skill:start, decision, completion)
  2. memory_promote for significant decisions or learnings
  3. Log to PostgreSQL events for audit trail

Session End:
  1. memory_add outcome as event
  2. memory_promote summary insight if valuable
  3. VERIFY events were persisted
```

## Canonical MCP Tools

These are the **8 registered tools** in the canonical MCP server (`memory-server-canonical.ts`):

| Tool             | Purpose                                            | Key Params                                           |
| ---------------- | -------------------------------------------------- | ---------------------------------------------------- |
| `memory_add`     | Add a memory (episodic → score → promote/queue)    | group_id, user_id, content, metadata?, threshold?    |
| `memory_search`  | Search memories (federated: PG + Neo4j + RuVector) | query, group_id, user_id?, limit?, min_score?        |
| `memory_get`     | Get a single memory by ID                          | id, group_id                                         |
| `memory_list`    | List all memories for a user                       | group_id, user_id, limit?, offset?, sort?            |
| `memory_delete`  | Soft-delete a memory                               | id, group_id, user_id                                |
| `memory_update`  | Append-only versioned update (SUPERSEDES)          | id, group_id, user_id, content, reason?              |
| `memory_promote` | Request curator promotion (HITL)                   | id, group_id, user_id, curator_id?, rationale?       |
| `memory_export`  | Export memories with canonical filter              | group_id, user_id?, canonical_only?, limit?, offset? |

## Memory Logging Patterns

### Session Start

```javascript
// Hydrate context from Brain
const context = await memory_search({
  query: "last session decisions blockers",
  group_id: "allura-roninmemory",
  limit: 10,
})

// Log session start as event
mcp__MCP_DOCKER__execute_sql({
  sql_query: `INSERT INTO events (event_type, agent_id, group_id, status, metadata, created_at)
    VALUES ('session_start', $1, 'allura-roninmemory', 'pending', $2, NOW())`,
  params: [agent_id, { topic: "user request description" }],
})
```

### During Execution — Log Decision

```javascript
// Store via memory_add (Brain is source of truth)
await memory_add({
  group_id: "allura-roninmemory",
  user_id: agent_id,
  content: "Decision: Use RRF fusion for hybrid search",
  metadata: { source: "manual", agent_id: "brooks" },
})
```

### Session End

```javascript
// Log outcome as event
mcp__MCP_DOCKER__execute_sql({
  sql_query: `INSERT INTO events (event_type, agent_id, group_id, status, metadata, created_at)
    VALUES ('session_complete', $1, 'allura-roninmemory', 'completed', $2, NOW())`,
  params: [agent_id, { spec_path: "docs/...", commit_sha: "abc123" }],
})

// Promote valuable insight
await memory_promote({
  id: memory_id,
  group_id: "allura-roninmemory",
  user_id: agent_id,
  rationale: "Key architecture decision",
})
```

## Event Type Naming

Use consistent prefixes:

- `skill:<name>:start` - Skill invocation start
- `skill:<name>:checkpoint` - Milestone within skill
- `skill:<name>:end` - Skill completion
- `decision:<topic>` - Key decision made
- `error:<category>` - Error or failure
- `BLOCKER` - Critical blocker
- `ARCHITECTURE_DECISION` - Architecture decision (Brooks protocol)
- `ADR_CREATED` - ADR written
- `INTERFACE_DEFINED` - Interface contract defined

## Status Values

PostgreSQL events table constraint requires:

- `pending` - Work in progress
- `completed` - Successfully finished
- `failed` - Error or failure
- `cancelled` - Aborted

**Important**: `in_progress` is NOT valid - use `pending` instead.

## Skill-Specific Patterns

### Brainstorming Skill

**Start:**

- Log `skill:brainstorming:start`
- `memory_search` for previous related work

**During:**

- Log `decision:approach` when approach is selected
- `memory_add` the decision content

**End:**

- Log `skill:brainstorming:end`
- `memory_promote` if decision is significant

### Writing-Plans Skill

**Start:**

- Log `skill:writing-plans:start`
- `memory_search` for spec from previous brainstorming

**End:**

- Log `skill:writing-plans:end`
- `memory_add` the plan content

### Executing-Plans Skill

**Start:**

- Log `skill:executing-plans:start`
- `memory_search` for plan, extract tasks

**Per Task:**

- Log `skill:executing-plans:task-start`
- Log `skill:executing-plans:task-complete`

**End:**

- Log `skill:executing-plans:end`
- `memory_promote` outcome insight

## Key Invariants

- **group_id** always `allura-*` format (never `roninclaw-*` — that's deprecated drift)
- **Append-only events** — no UPDATE/DELETE on PostgreSQL trace rows
- **SUPERSEDES versioning** — never edit Neo4j nodes, always create new version
- **HITL for promotion** — `memory_promote` routes through `canonical_proposals`, not direct Neo4j write
- **Brain is source of truth** — no flat-file memory-bank/ reads or writes
