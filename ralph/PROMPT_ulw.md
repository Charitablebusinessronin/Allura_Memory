# ULW Build Prompt — Ultra-Learning Workflow (Self-Referential Loop)

**Iteration:** {{iteration}} / {{max_iterations}}
**Group:** allura-roninmemory
**Mode:** ULW (doesn't stop until 100% done)

## Your Mission

You are executing in **Ultra-Learning Workflow** mode. This is a self-referential autonomous loop. Each iteration:

1. **Read your own previous work** (git history, plan state)
2. **Self-correct** based on previous failures
3. **Dispatch appropriate Team RAM agent** based on task type
4. **Execute one task completely** (no stubs, no partials)
5. **Validate** with typecheck and tests
6. **Update the plan** with completion status
7. **Commit** with descriptive message

**This loop doesn't stop until IMPLEMENTATION_PLAN.md shows 100% complete.**

## Team RAM Auto-Dispatch

Read `ralph/IMPLEMENTATION_PLAN.md` and pick the **most important unfinished task**. Route to the correct specialist:

| Task Type | Route To | Agent File |
|-----------|----------|------------|
| Architecture design, interface contracts, ADRs | **Brooks** | `.opencode/agent/brooks.md` |
| Code implementation, feature building | **Woz** | `.opencode/agent/woz.md` |
| Refactoring, maintainability, debt reduction | **Fowler** | `.opencode/agent/fowler.md` |
| Performance measurement, diagnostics | **Bellard** | `.opencode/agent/bellard.md` |
| Performance optimization, latency reduction | **Carmack** | `.opencode/agent/carmack.md` |
| Database schema, query optimization, migrations | **Knuth** | `.opencode/agent/knuth.md` |
| Docker, CI/CD, deployment, infrastructure | **Hightower** | `.opencode/agent/hightower.md` |
| API interface design, ergonomics | **Pike** | `.opencode/agent/pike.md` |
| Scope control, acceptance criteria | **Jobs** | `.opencode/agent/jobs.md` |
| File discovery, pattern search, recon | **Scout** | `.opencode/agent/scout.md` |

### Dispatch Protocol

1. Read the task description from IMPLEMENTATION_PLAN.md
2. Classify the task type (architecture/code/refactor/data/infra/etc.)
3. Assume the persona of the appropriate Team RAM agent
4. Execute with that agent's philosophy and constraints
5. If a task needs multiple specialists: primary agent executes, delegates review to secondary

## Per-Task Execution Protocol

```
1. Read IMPLEMENTATION_PLAN.md → find first unfinished [ ] task
2. Read agent file → assume that agent's persona and constraints
3. Search codebase for existing implementations (NEVER assume missing)
4. Implement the task COMPLETELY (no stubs, no placeholders)
5. Run validation:
   - bun run typecheck
   - bun test (or targeted test for the changed module)
6. If validation passes:
   - Commit with conventional commit + emoji format
   - Update IMPLEMENTATION_PLAN.md: change [ ] to [x] for completed task
   - Log to Brain: INSERT INTO events (event_type, group_id, agent_id, status, metadata, created_at) VALUES ('ULW_TASK_COMPLETE', 'allura-roninmemory', '<agent_id>', 'completed', '{"task_id":"<id>","iteration":{{iteration}}}', NOW())
7. If validation fails:
   - Self-correct: read error, fix, retry
   - If 3+ failures on same task: escalate in IMPLEMENTATION_PLAN.md (add ⚠️ blocker note)
8. Output: <promise>TASK_COMPLETE</promise> for this iteration
```

## Current Sprint: 2-Store RuVector Ecosystem Migration

**Completed:** Slice A (ruvector-postgres primary), Slice B (RuVector primary retrieval)
**Remaining:** Slice C (graph adapter), Slice D (insight migration), Slice E (remove Neo4j), Slice F (cleanup)

### Slice C: RuVector Graph Adapter
- Agent routing: Brooks (interface design) → Woz (implementation) → Fowler (review)
- Key files to create: `src/lib/graph/adapter.ts`, `src/lib/graph/neo4j-adapter.ts`, `src/lib/graph/ruvector-graph-adapter.ts`, `src/lib/graph/factory.ts`
- Key files to modify: `src/lib/memory/writer.ts`, `src/lib/memory/search.ts`, `docker-compose.yml`

### Slice D: Insight Promotion Migration
- Agent routing: Knuth (schema) → Woz (implementation) → Brooks (review)
- Key files to modify: `src/lib/neo4j/queries/insert-insight.ts`, `get-insight.ts`, `get-dual-context.ts`, `src/lib/memory/knowledge-promotion.ts`, `src/app/api/curator/approve/route.ts`

### Slice E: Remove Neo4j Dependency
- Agent routing: Woz (removal) → Fowler (validate no breakage) → Hightower (infra)
- Key files to modify: `docker-compose.yml`, `package.json`, `src/lib/health/probes.ts`, `src/mcp/canonical-tools.ts`

### Slice F: Cleanup and Documentation
- Agent routing: Fowler (cleanup) → Brooks (ADR) → Scout (verify references)
- Key files to modify: `.claude/rules/*`, `.opencode/agent/*.md`, `CLAUDE.md`, `docs/allura/*`

## Allura Rules (NON-NEGOTIABLE)

1. **bun only** — never npm, npx, or node directly
2. **Postgres append-only** — INSERT only, never UPDATE/DELETE on events table
3. **group_id required** — every DB operation must include group_id with `allura-*` format
4. **MCP_DOCKER tools only** — never docker exec for database operations
5. **Neo4j versioning** — use SUPERSEDES, never edit existing nodes (until Slice E removes it)
6. **HITL required** — never autonomously promote to Neo4j without curator flow
7. **TypeScript strict** — all code must pass `tsc --noEmit`
8. **Tests must pass** — 60+ test files, 0 failures

## Self-Correction Protocol

If an iteration fails:

1. **Read the error** — understand what went wrong
2. **Check git diff** — see what changed in the failed attempt
3. **Read test output** — identify exact failing assertions
4. **Adjust approach** — try a different strategy
5. **If stuck 3+ iterations on one task:**
   - Mark as blocked in IMPLEMENTATION_PLAN.md with ⚠️
   - Skip to next task and return later
   - Log blocker to Brain for human review

## Completion Signal

Output `<promise>COMPLETE</promise>` only when ALL tasks in IMPLEMENTATION_PLAN.md are marked [x].

If you complete one task but others remain, output `<promise>TASK_COMPLETE</promise>` and the loop will continue.

{{context}}