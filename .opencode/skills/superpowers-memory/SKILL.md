---
name: superpowers-memory
description: Add memory logging and hydration to Superpowers skills. Use at session start to retrieve context, at session end to log outcomes.
---

# Superpowers Memory Integration

Add persistent memory logging and hydration to Superpowers skills using PostgreSQL (raw events) and Neo4j (curated insights).

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
await logEvent({
  group_id: "roninmemory",
  event_type: "skill:brainstorming:start",
  agent_id: "roninmemory-agent",
  workflow_id: "feature-123",
  status: "pending",
  metadata: { topic: "user request description" }
});

// At skill end
await logEvent({
  group_id: "roninmemory",
  event_type: "skill:brainstorming:end",
  agent_id: "roninmemory-agent",
  workflow_id: "feature-123",
  status: "completed",
  metadata: { spec_path: "docs/superpowers/specs/YYYY-MM-DD-feature.md" }
});
```

### Create Insight

```typescript
await createInsight({
  title: "Design Decision: [Topic]",
  content: "What was decided and why",
  category: "Architecture", // or "Bugfix", "Refactor", "Performance"
  tags: ["superpowers", "brainstorming", "design"],
  sourceEventIds: [123, 124] // Link to events
});
```

### Search Context

```typescript
// Get recent events for this workflow
const recentEvents = await searchEvents({
  query: "roninmemory brainstorming feature-123"
});

// Get related insights
const insights = await searchInsights({
  query: "brainstorming design decisions"
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
| Log event | `MCP_DOCKER_insert_data` on `events` table |
| Create insight | `MCP_DOCKER_create_entities` in Neo4j |
| Link to events | `MCP_DOCKER_create_relations` |
| Search events | `MCP_DOCKER_query_database` with SQL |
| Search insights | `MCP_DOCKER_search_memories` |
| Verify write | `MCP_DOCKER_query_database` by event ID |

## Example: Complete Session Flow

```typescript
// === SESSION START ===
// 1. Hydrate context
const previousWork = await searchEvents({
  query: "roninmemory feature-123 last-7-days"
});

// 2. Log session start
const startEvent = await logEvent({
  group_id: "roninmemory",
  event_type: "skill:brainstorming:start",
  agent_id: "roninmemory-agent",
  workflow_id: "feature-123",
  status: "pending",
  metadata: { previous_work_count: previousWork.length }
});

// === DURING EXECUTION ===
// Log checkpoint
await logEvent({
  group_id: "roninmemory",
  event_type: "decision:approach",
  agent_id: "roninmemory-agent",
  workflow_id: "feature-123",
  status: "completed",
  metadata: { chosen_approach: "option-b", reason: "better testability" }
});

// === SESSION END ===
// Log completion
await logEvent({
  group_id: "roninmemory",
  event_type: "skill:brainstorming:end",
  agent_id: "roninmemory-agent",
  workflow_id: "feature-123",
  status: "completed",
  metadata: { 
    spec_path: "docs/superpowers/specs/2024-01-15-feature-design.md",
    start_event_id: startEvent.eventId
  }
});

// Create insight
await createInsight({
  title: "Design: Feature 123 - Approach Selection",
  content: "Chose option B for better testability...",
  category: "Architecture",
  tags: ["superpowers", "brainstorming", "design"],
  group_id: "roninmemory"
});

// Verify
const verify = await searchEvents({ query: "feature-123" });
console.log(`Logged ${verify.length} events for this workflow`);
```
