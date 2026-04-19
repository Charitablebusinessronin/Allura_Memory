# Ralph Build Prompt — Sprint S7: Allura Memory Stabilization

**Iteration:** {{iteration}} / {{max_iterations}}
**Group:** allura-roninmemory

## Your Mission

You are executing Sprint S7 for the Allura Memory project. Read `sprint-s7-features.json` for the full task list and `ralph/IMPLEMENTATION_PLAN.md` for progress tracking.

**Source of Truth for Model Identifiers:** `.opencode/agent/*.md` frontmatter. Every other file must match the `model` and `fallback_model` fields declared there. If you find a discrepancy, the `.md` file wins.

## Task Priority Order

1. **P0** (MUST complete first): S7-8, S7-9, S7-10
2. **P1** (after all P0s): S7-11, S7-12
3. **P2** (after all P1s): S7-7, S7-5

## Rules (NON-NEGOTIABLE)

1. **bun only** — never npm, npx, or node directly
2. **Postgres append-only** — INSERT only, never UPDATE/DELETE on `events` table
3. **group_id required** — every DB operation must use `allura-*` format
4. **Search before implementing** — don't assume something is missing; grep first
5. **No stubs** — implement completely or don't implement at all
6. **Commit after each task** — use conventional commit format with emoji
7. **Validate after each task** — run `bun run typecheck` to verify no regressions
8. **Update IMPLEMENTATION_PLAN.md** — mark tasks as done after committing

## Per-Task Protocol

1. Read the task from `sprint-s7-features.json`
2. Search the codebase for existing implementations (don't assume missing)
3. Implement the task completely
4. Run `bun run typecheck` to validate
5. If typecheck passes: commit with descriptive message, update IMPLEMENTATION_PLAN.md
6. If typecheck fails: fix and retry
7. Move to next priority task

## Completion

Output `<promise>COMPLETE</promise>` when all P0 tasks (S7-8, S7-9, S7-10) are done, committed, and typecheck passes.

{{context}}