---
name: superpowers-memory
description: Add memory logging and hydration to Superpowers skills. Use at session start to retrieve context, at session end to log outcomes.
---

# Superpowers Memory Integration

Add persistent memory logging and hydration to Superpowers skills using PostgreSQL (raw events) and Neo4j (curated insights).

Canonical defaults for this repo:
- `group_id`: `allura-roninmemory`
- status values: `pending`, `completed`, `failed`, `cancelled`
- prefer `allura-brain_*` tools for memory search and logging

## When to Use

- At session start: Retrieve previous context for this group/workflow
- During skill execution: Log key events, decisions, and milestones
- At session end: Log outcomes, create insights, link to source events

## Core Workflow

```
Session Start:
  1. SEARCH events for group_id + workflow_id (last 7 days)
  2. SEARCH insights for related knowledge
  3. PRESENT summary to agent

During Execution:
  1. LOG event at each checkpoint (skill:start, decision, completion)
  2. CREATE insight for significant decisions or learnings
  3. LINK insight to source events

Session End:
  1. LOG outcome event
  2. CREATE summary insight if valuable
  3. VERIFY events were persisted
```

## Memory Logging Commands

### Log Event

```typescript
// At skill start
await alluraBrain.memory_add({
  group_id: "allura-roninmemory",
  user_id: "brooks",
  content: "skill:brainstorming:start workflow=feature-123 topic=user request description",
  metadata: { source: "conversation", conversation_id: "<id>", agent_id: "brooks" }
});

// At skill end
await alluraBrain.memory_add({
  group_id: "allura-roninmemory",
  user_id: "brooks",
  content: "skill:brainstorming:end workflow=feature-123 spec=docs/superpowers/specs/YYYY-MM-DD-feature.md",
  metadata: { source: "conversation", conversation_id: "<id>", agent_id: "brooks" }
});
```

### Create Insight

```typescript
await alluraBrain.memory_add({
  group_id: "allura-roninmemory",
  user_id: "brooks",
  content: "Design Decision: [Topic]. What was decided and why.",
  metadata: { source: "conversation", conversation_id: "<id>", agent_id: "brooks" }
});
```

### Search Context

```typescript
// Get recent events for this workflow
const recentEvents = await alluraBrain.memory_search({
  query: "skill brainstorming feature-123",
  group_id: "allura-roninmemory"
});

// Get related insights
const insights = await alluraBrain.memory_search({
  query: "brainstorming design decisions",
  group_id: "allura-roninmemory"
});
```

## Event Type Naming

Use consistent prefixes:

- `skill:<name>:start` - Skill invocation start
- `skill:<name>:checkpoint` - Milestone within skill
- `skill:<name>:end` - Skill completion
- `decision:<topic>` - Key decision made
- `error:<category>` - Error or failure
- `insight:created` - New insight created
- `outcome:<result>` - Final outcome logged

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
- Search for previous related work

**During:**
- Log `decision:approach` when approach is selected
- Log `decision:design` when design is approved

**End:**
- Log `skill:brainstorming:end` with spec path
- Create insight: "Design: [Feature Name]"
- Link insight to all decision events

### Writing-Plans Skill

**Start:**
- Log `skill:writing-plans:start`
- Load spec from previous brainstorming

**End:**
- Log `skill:writing-plans:end` with plan path
- Create insight: "Implementation Plan: [Feature]"

### Executing-Plans Skill

**Start:**
- Log `skill:executing-plans:start`
- Load plan, extract tasks

**Per Task:**
- Log `skill:executing-plans:task-start` with task name
- Log `skill:executing-plans:task-complete` with commit SHA

**End:**
- Log `skill:executing-plans:end`
- Create outcome insight

### Subagent-Driven-Development Skill

**Start:**
- Log `skill:subagent-driven:start`
- Load plan, create TodoWrite

**Per Task:**
- Log `skill:subagent:implementer-dispatch` with task ID
- Log `skill:subagent:review-complete` with review results

**End:**
- Log `skill:subagent-driven:end`
- Create insight: "Subagent Run: [Feature] - [N] tasks, [M] review loops"

## Implementation Templates

Add this block to each Superpowers skill SKILL.md:

```markdown
## Memory Integration

At session start:
1. Search events: `group_id={group}` AND `event_type LIKE 'skill:%'` (last 7 days)
2. Search insights for related knowledge
3. Summarize context for agent

During execution:
1. Log event at each checkpoint
2. Create insight for significant decisions

At session end:
1. Log outcome event with results
2. Create summary insight
3. Verify database write
```

## MCP Tool Mapping

| Action | MCP Tool |
|--------|----------|
| Log event / summary | `allura-brain_memory_add` |
| Search events / insights | `allura-brain_memory_search` |
| Deep SQL verification | `MCP_DOCKER_execute_sql` |
| Deep graph verification | `MCP_DOCKER_read_neo4j_cypher` |
| Request promotion | `allura-brain_memory_promote` |

## Example: Complete Session Flow

```typescript
// === SESSION START ===
// 1. Hydrate context
const previousWork = await alluraBrain.memory_search({
  query: "feature-123 last-7-days",
  group_id: "allura-roninmemory"
});

// 2. Log session start
await alluraBrain.memory_add({
  group_id: "allura-roninmemory",
  user_id: "brooks",
  content: "skill:brainstorming:start workflow=feature-123 previous_work_count=" + previousWork.length,
  metadata: { source: "conversation", conversation_id: "<id>", agent_id: "brooks" }
});

// === DURING EXECUTION ===
// Log checkpoint
await alluraBrain.memory_add({
  group_id: "allura-roninmemory",
  user_id: "brooks",
  content: "decision:approach workflow=feature-123 chosen_approach=option-b reason=better testability",
  metadata: { source: "conversation", conversation_id: "<id>", agent_id: "brooks" }
});

// === SESSION END ===
// Log completion
await alluraBrain.memory_add({
  group_id: "allura-roninmemory",
  user_id: "brooks",
  content: "skill:brainstorming:end workflow=feature-123 spec=docs/superpowers/specs/2024-01-15-feature-design.md",
  metadata: { source: "conversation", conversation_id: "<id>", agent_id: "brooks" }
});

// Create insight
await alluraBrain.memory_add({
  group_id: "allura-roninmemory",
  user_id: "brooks",
  content: "Design: Feature 123 - Approach Selection. Chose option B for better testability.",
  metadata: { source: "conversation", conversation_id: "<id>", agent_id: "brooks" }
});

// Verify
const verify = await alluraBrain.memory_search({ query: "feature-123", group_id: "allura-roninmemory" });
console.log(`Logged ${verify.length} events for this workflow`);
```
