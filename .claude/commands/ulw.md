---
description: "ULW (Ultra-Learning Workflow) — Self-referential autonomous loop that doesn't stop until 100% done"
allowed-tools: ["Read", "Bash", "Glob", "Grep", "Edit", "Write", "mcp__MCP_DOCKER__*"]
---

You are now operating in **ULW (Ultra-Learning Workflow)** mode — a self-referential autonomous loop that dispatches Team RAM agents and doesn't stop until IMPLEMENTATION_PLAN.md shows 100% complete.

## Mode: `$ARGUMENTS`

Parse the arguments. Default mode is **ulw**.

- `ulw` (default) — Execute one iteration: read plan, dispatch agent, implement task, validate, update plan
- `plan` — Planning mode: gap analysis, generate/update plan only, NO implementation
- `status` — Show current ULW status (run `./ralph/ulw-loop.sh --status` via Bash)

## Protocol

### If Mode is `ulw` (default)

1. **Read** `ralph/PROMPT_ulw.md` — follow instructions exactly (Team RAM routing, Allura rules)
2. **Read** `ralph/IMPLEMENTATION_PLAN.md` — find the first unfinished [ ] task
3. **Classify task type** and assume appropriate Team RAM persona:
   - Architecture → Brooks (`.opencode/agent/brooks.md`)
   - Code implementation → Woz (`.opencode/agent/woz.md`)
   - Refactoring → Fowler (`.opencode/agent/fowler.md`)
   - Performance diagnostics → Bellard (`.opencode/agent/bellard.md`)
   - Performance optimization → Carmack (`.opencode/agent/carmack.md`)
   - Database/schema → Knuth (`.opencode/agent/knuth.md`)
   - DevOps/infra → Hightower (`.opencode/agent/hightower.md`)
   - API/interface → Pike (`.opencode/agent/pike.md`)
   - Scope/acceptance → Jobs (`.opencode/agent/jobs.md`)
   - Discovery → Scout (`.opencode/agent/scout.md`)
4. **Search codebase** before implementing — don't assume something is missing
5. **Implement task completely** — no stubs, no placeholders
6. **Validate:** `bun run typecheck && bun test`
7. **If validation passes:**
   - Commit with conventional commit + emoji format
   - Update IMPLEMENTATION_PLAN.md: change [ ] to [x] for completed task
   - Log to Brain: INSERT INTO events (event_type, group_id, agent_id, status, metadata, created_at) VALUES ('ULW_TASK_COMPLETE', 'allura-system', '<agent_id>', 'completed', '{"task_id":"<id>","iteration":1}', NOW())
8. **If validation fails:** fix and retry (max 3 attempts, then mark ⚠️ blocker)
9. **Output:** `<promise>TASK_COMPLETE</promise>` if more tasks remain, `<promise>COMPLETE</promise>` if all done

### If Mode is `plan`

1. Read `ralph/PROMPT_ulw.md` for planning instructions
2. Study current state of codebase vs IMPLEMENTATION_PLAN.md
3. Update plan with any missing tasks or blockers
4. Do NOT implement anything
5. Output plan summary

### If Mode is `status`

1. Run `./ralph/ulw-loop.sh --status` via Bash
2. Read `ralph/IMPLEMENTATION_PLAN.md` and summarize progress
3. Show: tasks complete / total, current blockers, next task

## Allura Rules (NON-NEGOTIABLE)

These rules apply in ALL modes:

1. **bun only** — never npm, npx, or node directly
2. **Postgres append-only** — INSERT only, never UPDATE/DELETE on `events` table
3. **group_id required** — every DB operation must use `allura-*` format
4. **MCP_DOCKER tools only** — never docker exec for database operations
5. **TypeScript strict** — all code must pass `tsc --noEmit`
6. **Tests must pass** — 60+ test files, 0 failures
7. **No stubs** — implement completely or don't implement at all
8. **Self-correct** — read git history and previous failures, adjust approach

## Key Principles

- **One task per invocation** — do the most important thing, validate, commit, stop
- **Team RAM routing** — classify task type, assume appropriate agent persona
- **Self-referential** — loop reads its own previous work and self-corrects
- **100% complete** — loop doesn't stop until IMPLEMENTATION_PLAN.md shows all [x]
- **Capture the why** — documentation explains reasoning, not just what

## For Headless Multi-Iteration Runs

This command runs a SINGLE iteration. For autonomous multi-iteration loops:

```bash
./ralph/ulw-loop.sh              # ulw mode, unlimited iterations
./ralph/ulw-loop.sh 20           # ulw mode, max 20 iterations
./ralph/ulw-loop.sh plan           # plan mode, unlimited
./ralph/ulw-loop.sh plan 5         # plan mode, max 5 iterations
```

The ULW loop script:
1. Reads IMPLEMENTATION_PLAN.md
2. Checks if 100% complete (Status: 100% Complete or all [x])
3. If complete → exits
4. If incomplete → dispatches to appropriate Team RAM agent
5. Agent executes task, validates, commits, updates plan
6. Loop repeats

## Self-Correction

If an iteration fails validation:

1. Read the error and test output
2. Check git diff to see what changed
3. Adjust approach and retry
4. If stuck 3+ iterations on same task:
   - Mark as ⚠️ blocker in IMPLEMENTATION_PLAN.md
   - Move to next task and return later
   - Log blocker to Brain for human review

## Completion

Output `<promise>COMPLETE</promise>` only when:
- ALL tasks in IMPLEMENTATION_PLAN.md are marked [x]
- All validations pass (typecheck, tests)
- Plan file shows "Status: 100% Complete"

If one task completes but others remain, output `<promise>TASK_COMPLETE</promise>` so the loop can continue.

{{context}}