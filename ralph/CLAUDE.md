# Ralph Agent Instructions — Allura Memory Engine

You are an autonomous coding agent completing Epic 1 of the Allura Memory Engine.

## Your Task

1. Read the PRD at `ralph/prd.json`
2. Read the progress log at `ralph/progress.txt` (check Codebase Patterns section first)
3. Check you're on branch `ralph/epic-1-complete`. If not, create it from new-main.
4. Pick the **highest priority** user story where `passes: false`
5. Implement that single user story fully against its acceptance criteria
6. Run quality checks: `bun run typecheck && bun test`
7. If checks pass, commit ALL changes: `feat: [Story ID] - [Story Title]`
8. Update `ralph/prd.json` to set `passes: true` for the completed story
9. Append progress to `ralph/progress.txt`

## Allura-Specific Rules (NON-NEGOTIABLE)

- **bun only** — never npm, npx, or node directly
- **Postgres is append-only** — INSERT only, never UPDATE/DELETE on events table
- **group_id required** — every DB operation must include group_id with allura-* format
- **Kernel routing** — trace writes go through RuVixKernel.syscall('trace'), not direct inserts
- **Neo4j versioning** — use SUPERSEDES relationships, never edit existing nodes
- **HITL** — never autonomously promote to Neo4j without going through curator flow
- **MCP_DOCKER tools only** — never docker exec for database operations

## Key Files

- `src/lib/memory/writer.ts` — memory() wrapper (Neo4j write interface)
- `src/lib/postgres/trace-logger.ts` — trace logging with RuVix kernel integration
- `src/lib/mcp/trace-middleware.ts` — MCP tool call tracing (42 tests)
- `src/kernel/ruvix.ts` — RuVix kernel (6 primitives: mutate, attest, verify, isolate, sandbox, audit)
- `src/kernel/syscalls.ts` — syscall implementations including 'trace'
- `_bmad-output/implementation-artifacts/stories/tech-spec-1-1-record-raw-traces.md` — Story 1.1 full spec

## Quality Requirements

- Zero TypeScript errors (`bun run typecheck`)
- All tests pass (`bun test`)
- Do NOT commit broken code
- Keep changes minimal and focused on the story ACs

## Progress Report Format

APPEND to ralph/progress.txt:
```
## [Date] - [Story ID] - [Story Title]
- What was implemented
- Files changed
- **Learnings for future iterations:**
  - Patterns discovered
  - Gotchas
---
```

## Stop Condition

After completing a story, check if ALL stories have `passes: true`.

If ALL complete: reply with <promise>COMPLETE</promise>

Otherwise end normally — next iteration picks up the next story.

## Important

- ONE story per iteration
- Read Codebase Patterns in progress.txt before starting
- `bun run typecheck && bun test` must pass before committing
