---
name: subagent-driven-development
description: "Use when executing plans with independent tasks. Dispatches fresh subagent per task with two-stage review (spec compliance, then code quality)."
allowed-tools: ["Read", "Write", "Edit", "Glob", "Grep", "Bash", "Agent", "allura-brain__memory_search", "allura-brain__memory_add"]
---

# Subagent-Driven Development

Execute plan by dispatching fresh subagent per task, with two-stage review after each.

**Announce at start:** "I'm using subagent-driven-development to execute this plan."

**Core principle:** Fresh subagent per task + two-stage review (spec then quality) = high quality, fast iteration.

## When to Use

- Have an implementation plan (from writing-plans)
- Tasks are mostly independent
- Want fast iteration without human-in-loop between tasks

## The Process

### 1. Load Plan

Read the plan file. Extract all tasks with full text and context.

### 2. Hydrate from Brain

```javascript
allura-brain__memory_search({ query: "<feature>", group_id: "allura-system", limit: 5 })
```

### 3. Per Task

For each task:

**a) Dispatch Implementer (subagent)**

Provide:
- Full task text (don't make them read the plan file)
- Relevant context (file contents, conventions)
- Allura invariants: group_id, append-only, Bun only, Zod at boundaries

**b) Spec Compliance Review (subagent)**

Does the implementation match the spec exactly?
- Missing requirements? → fix
- Extra features not in spec? → remove
- Names match Data Dictionary? → verify

**c) Code Quality Review (subagent)**

- Tests pass? Clean code? No security issues?
- Follows existing patterns in the codebase?
- No OWASP vulnerabilities introduced?

**d) Mark Complete**

After both reviews pass, move to next task.

### 4. Documentation Task

The final task is ALWAYS doc updates. Never skip it:
- `REQUIREMENTS-MATRIX.md` — "Satisfied by" column
- `DATA-DICTIONARY.md` — if schema changed
- `RISKS-AND-DECISIONS.md` — if new decisions

### 5. Final Validation

```bash
bun run typecheck
bun run lint
bun test
```

### 6. Brain Reflection

```javascript
allura-brain__memory_add({
  group_id: "allura-system",
  user_id: "brooks",
  content: "COMPLETED: <plan>. F# satisfied: <list>. Tasks: <N>/<N>. Docs updated: <which>."
})
```

## Handling Subagent Status

| Status | Action |
|--------|--------|
| **DONE** | Proceed to spec review |
| **DONE_WITH_CONCERNS** | Read concerns, address if correctness-related |
| **NEEDS_CONTEXT** | Provide missing context, re-dispatch |
| **BLOCKED** | Assess: context problem → provide more; too complex → break down; plan wrong → escalate |

## Continuous Execution

Do not pause between tasks. The only reasons to stop:
- BLOCKED status you cannot resolve
- Ambiguity that prevents progress
- All tasks complete

## Red Flags (Never Do)

- Skip reviews (spec OR quality)
- Proceed with unfixed issues
- Dispatch parallel implementation subagents (conflicts)
- Start on main without explicit consent
- Skip the documentation update task
- Let subagent use npm/npx (Bun only)
- Write code without group_id on DB operations

## Integration

**Required workflow:**
1. `brainstorming` → produces spec with F# traceability
2. `writing-plans` → produces plan with doc-update task
3. `subagent-driven-development` → executes plan (this skill)
4. Validation gate → typecheck + lint + tests
