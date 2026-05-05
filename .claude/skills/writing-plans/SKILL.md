---
name: writing-plans
description: "Use when you have a spec or requirements for a multi-step task, before touching code. Creates bite-sized TDD implementation plans with doc-update tasks."
allowed-tools: ["Read", "Write", "Edit", "Glob", "Grep", "Bash", "Agent", "allura-brain__memory_search"]
---

# Writing Plans

Write implementation plans assuming the engineer has zero codebase context. Bite-sized tasks. DRY. YAGNI. TDD. Frequent commits.

**Announce at start:** "I'm using the writing-plans skill to create the implementation plan."

**Save plans to:** `docs/superpowers/plans/YYYY-MM-DD-<feature-name>.md`

## Scope Check

If the spec covers multiple independent subsystems, suggest breaking into separate plans — one per subsystem.

## File Structure

Before defining tasks, map which files will be created or modified. Design units with clear boundaries.

## Plan Document Header

Every plan MUST start with:

```markdown
# [Feature Name] Implementation Plan

**Goal:** [One sentence]
**Architecture:** [2-3 sentences]
**Tech Stack:** [Key technologies]
**Spec:** [Link to docs/superpowers/specs/<file>]
**Requirements:** [F# IDs this plan satisfies]

---
```

## Task Granularity

Each step is one action (2-5 minutes):
- "Write the failing test" — step
- "Run it to make sure it fails" — step
- "Implement minimal code to pass" — step
- "Run tests, verify pass" — step
- "Commit" — step

## Task Structure

````markdown
### Task N: [Component Name]

**Files:**
- Create: `exact/path/to/file.ts`
- Modify: `exact/path/to/existing.ts`
- Test: `src/lib/__tests__/file.test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
// exact test code here
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun vitest run src/lib/__tests__/file.test.ts`
Expected: FAIL

- [ ] **Step 3: Write minimal implementation**

```typescript
// exact implementation code here
```

- [ ] **Step 4: Run test to verify it passes**

Run: `bun vitest run src/lib/__tests__/file.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add <files>
git commit -m "feat: add specific feature"
```
````

## MANDATORY: Documentation Update Task (Always Last)

Every plan MUST end with a documentation update task:

````markdown
### Task N (Final): Documentation Updates

**Files:**
- Modify: `docs/allura/REQUIREMENTS-MATRIX.md`
- Modify: `docs/allura/DATA-DICTIONARY.md` (if schema changed)
- Modify: `docs/allura/RISKS-AND-DECISIONS.md` (if new AD/RK)

- [ ] **Step 1: Update Requirements Matrix**

Add/update the "Satisfied by" column for each F# this plan implements:

```markdown
| F12 | <requirement> | `POST /api/memory` · [DESIGN-MEMORY-SYSTEM.md §3.2](../DESIGN-MEMORY-SYSTEM.md#32-write-path) |
```

- [ ] **Step 2: Update Data Dictionary** (if new fields/enums)

Add field entries matching the JSON schema exactly.

- [ ] **Step 3: Update Risks & Decisions** (if new architectural decision)

Add AD-## entry with Status: Decided.

- [ ] **Step 4: Commit doc updates**

```bash
git add docs/allura/REQUIREMENTS-MATRIX.md docs/allura/DATA-DICTIONARY.md
git commit -m "docs: update matrix and dictionary for <feature>"
```
````

## No Placeholders

Never write:
- "TBD", "TODO", "implement later"
- "Add appropriate error handling"
- "Write tests for the above" (without actual test code)
- "Similar to Task N" (repeat the code)

## Allura-Specific Rules

- **Bun only** — all commands use `bun`, never `npm`/`npx`
- **group_id required** — any DB operation in code must include `group_id`
- **Append-only traces** — never UPDATE/DELETE on events table
- **Zod at boundaries** — validate external input with Zod schemas
- **`import type`** — for type-only imports

## Self-Review

After writing the plan:
1. **Spec coverage** — every requirement in the spec has a task
2. **Placeholder scan** — no vague steps
3. **Type consistency** — names match across tasks
4. **Doc task present** — final task updates Matrix/Dictionary

## Execution Handoff

After saving the plan:

> "Plan complete and saved to `docs/superpowers/plans/<file>`. Execute with subagent-driven-development (recommended) or executing-plans (inline)?"
