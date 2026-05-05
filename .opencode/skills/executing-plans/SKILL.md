---
name: executing-plans
description: "Use when you have a written implementation plan to execute. TDD, bite-sized tasks, Brain logging, doc updates."
allowed-tools: ["Read", "Write", "Edit", "Glob", "Grep", "Bash", "Agent", "allura-brain__memory_search", "allura-brain__memory_add"]
---

# Executing Plans

Load plan, review critically, execute all tasks with TDD, report when complete.

**Announce at start:** "I'm using the executing-plans skill to implement this plan."

## The Process

### Step 1: Load and Review Plan

1. Read the plan file
2. Review critically — identify any questions or concerns
3. If concerns: raise them before starting
4. If no concerns: proceed

### Step 2: Hydrate from Brain

```javascript
// Check for prior attempts or related decisions
allura-brain__memory_search({ query: "<feature name>", group_id: "allura-system", limit: 5 })
```

### Step 3: Execute Tasks

For each task:
1. Follow each step exactly (plan has bite-sized steps)
2. Run verifications as specified
3. Use `bun vitest run` for tests (never npm)
4. Commit after each task completes
5. Log significant decisions to Brain:

```javascript
allura-brain__memory_add({
  group_id: "allura-system",
  user_id: "woz",
  content: "Decision: <what and why>. Task N of <plan-name>."
})
```

### Step 4: Documentation Task (Never Skip)

The final task in every plan updates canonical docs. Execute it exactly:
- `REQUIREMENTS-MATRIX.md` — update "Satisfied by" column
- `DATA-DICTIONARY.md` — if fields/enums changed
- `RISKS-AND-DECISIONS.md` — if new AD/RK entries

### Step 5: Validation Gate

Before declaring done:
```bash
bun run typecheck
bun run lint
bun test
```

All must pass.

### Step 6: Brain Reflection

```javascript
allura-brain__memory_add({
  group_id: "allura-system",
  user_id: "woz",
  content: "COMPLETED: <plan-name>. Satisfies F#, F#. Files changed: <list>. Tests: <count> passing. Open: <anything unresolved>."
})
```

## When to Stop and Ask

**STOP immediately when:**
- Test fails repeatedly (3+ attempts)
- Plan has critical gaps
- You don't understand an instruction
- Verification fails and you can't diagnose why

**Ask for clarification rather than guessing.**

## Invariants

- ✅ `group_id` on every DB operation in code
- ✅ Append-only traces (no UPDATE/DELETE)
- ✅ Bun only (never npm/npx)
- ✅ Documentation task is never skipped
- ✅ Typecheck + lint + tests pass before done
- ✅ Never start implementation on main without explicit consent
