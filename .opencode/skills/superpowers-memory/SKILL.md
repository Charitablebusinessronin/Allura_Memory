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

### Log Event (Store Memory)

```typescript
// At skill start
await allura-brain_memory_add({
  group_id: "allura-system",
  user_id: "roninmemory-agent",
  content: "Skill brainstorming started for feature-123",
  metadata: { source: "session", workflow_id: "feature-123" }
});

// At skill end
await allura-brain_memory_add({
  group_id: "allura-system",
  user_id: "roninmemory-agent",
  content: "Skill brainstorming completed with spec: docs/superpowers/specs/YYYY-MM-DD-feature.md",
  metadata: { source: "session", workflow_id: "feature-123" }
});
```

### Create Insight (Promote to Canonical)

```typescript
await allura-brain_memory_add({
  group_id: "allura-system",
  user_id: "roninmemory-agent",
  content: "Design Decision: [Topic]",
  metadata: {
    source: "manual",
    tags: ["superpowers", "brainstorming", "design"],
    category: "Architecture"
  }
});

// If this meets policy, promote to canonical:
await allura-brain_memory_promote({
  id: "<memory-id>",
  group_id: "allura-system",
  user_id: "roninmemory-agent",
  rationale: "Valid design decision with consensus"
});
```

### Search Context

```typescript
// Get recent events for this workflow
const recentEvents = await allura-brain_memory_search({
  query: "feature-123",
  group_id: "allura-system"
});

// Get related insights (canonical)
const insights = await allura-brain_memory_search({
  query: "design decisions",
  group_id: "allura-system",
  min_score: 0.85
});
```

## Event Type Naming

Use consistent prefixes with `allura-brain_memory_add` metadata:

- `skill:<name>:start` - Skill invocation start
- `skill:<name>:checkpoint` - Milestone within skill
- `skill:<name>:end` - Skill completion
- `decision:<topic>` - Key decision made
- `error:<category>` - Error or failure
- `insight:created` - New insight created
- `outcome:<result>` - Final outcome logged

Store these as `content` in `allura-brain_memory_add`, with `event_type` in metadata.

## Status Values

PostgreSQL events table constraint requires status metadata values:
- `pending` - Work in progress
- `completed` - Successfully finished
- `failed` - Error or failure
- `cancelled` - Aborted

**Important**: `in_progress` is NOT valid - use `pending` instead.

For `allura-brain_memory_add`, include status in metadata:
```typescript
await allura-brain_memory_add({
  group_id: "allura-system",
  user_id: "roninmemory-agent",
  content: "Status: pending",
  metadata: { status: "pending" }
});
```

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
| Store memory (session events, decisions) | `allura-brain_memory_add` |
| Search memories | `allura-brain_memory_search` |
| Get single memory | `allura-brain_memory_get` |
| List memories | `allura-brain_memory_list` |
| Update memory | `allura-brain_memory_update` |
| Delete memory | `allura-brain_memory_delete` |
| Promote raw trace to insight | `allura-brain_memory_promote` |
| Export memories | `allura-brain_memory_export` |

## Example: Complete Session Flow

```typescript
// === SESSION START ===
// 1. Hydrate context from previous sessions
const previousWork = await allura-brain_memory_search({
  query: "feature-123 last-7-days",
  group_id: "allura-system"
});

// 2. Log session start
await allura-brain_memory_add({
  group_id: "allura-system",
  user_id: "roninmemory-agent",
  content: "Skill brainstorming started for feature-123",
  metadata: {
    source: "session",
    workflow_id: "feature-123",
    status: "pending",
    previous_work_count: previousWork.length
  }
});

// === DURING EXECUTION ===
// Log checkpoint
await allura-brain_memory_add({
  group_id: "allura-system",
  user_id: "roninmemory-agent",
  content: "Decision: selected option B",
  metadata: {
    source: "session",
    workflow_id: "feature-123",
    status: "completed",
    decision: "chosen_approach: option-b",
    reason: "better testability"
  }
});

// === SESSION END ===
// Log completion
await allura-brain_memory_add({
  group_id: "allura-system",
  user_id: "roninmemory-agent",
  content: "Skill brainstorming completed",
  metadata: {
    source: "session",
    workflow_id: "feature-123",
    status: "completed",
    spec_path: "docs/superpowers/specs/2024-01-15-feature-design.md"
  }
});

// Create insight (promote if policy approves)
await allura-brain_memory_add({
  group_id: "allura-system",
  user_id: "roninmemory-agent",
  content: "Design: Feature 123 - Approach Selection",
  metadata: {
    source: "manual",
    category: "Architecture",
    tags: ["superpowers", "brainstorming", "design"]
  }
});

// Verify
const verify = await allura-brain_memory_search({ 
  query: "feature-123",
  group_id: "allura-system" 
});
console.log(`Logged ${verify.length} memories for this workflow`);
```
