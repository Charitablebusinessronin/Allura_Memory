# Phase 5: Sync Contract Implementation — BRIEF

## Objective
Implement auto-linking of newly promoted canonical memories to Agent and Project nodes in Neo4j. The current `approve` route creates `:Insight` nodes (not `:Memory` yet — migration pending), and the existing `linkMemoryContext` already handles both `:Memory` and `:Insight`. This task wires up the **creation** of `:Agent` and `:Project` nodes when they don't exist, and changes the relationship from best-effort (skips if missing) to **guarantee** (creates if missing).

## Key Findings

1. **Current state in `src/app/api/curator/approve/route.ts`:**
   - After `createInsight()`, it calls `adapter.linkMemoryContext()` which is **best-effort** — it does `OPTIONAL MATCH` and skips if Agent/Project nodes don't exist.
   - `agent_id` falls back to `proposal.created_by ?? curator_id ?? null`.
   - `project_id` is hardcoded to `null` with a TODO.

2. **`linkMemoryContext` in `src/lib/graph-adapter/neo4j-adapter.ts`:**
   - Uses `OPTIONAL MATCH (a:Agent)` and `FOREACH ... WHEN a IS NOT NULL` — meaning it silently skips if the Agent node doesn't exist.
   - Same pattern for `:Project`.

3. **No `:Project` node creation logic exists anywhere in the codebase** — only `:Agent` nodes via `agent-nodes.ts`.

4. **Tests:** The existing `curator-approve.test.ts` is an E2E test (skipped unless `RUN_E2E_TESTS=true`) that only tests PostgreSQL state changes, not Neo4j graph state.

## Architecture Decisions

1. **Create `upsertAgentNode` and `upsertProjectNode` helpers** in a new file `src/lib/neo4j/queries/upsert-context-nodes.ts`.
2. **Modify `linkMemoryContext`** to call `MERGE (a:Agent {id, group_id})` instead of `OPTIONAL MATCH` — this auto-creates the Agent node with a minimal label/name.
3. **Same for `:Project`** — `MERGE (p:Project {id, group_id})` with a minimal name.
4. **Modify `approve/route.ts`** to:
   - Import the new helpers
   - Resolve project_id from `metadata.project` (if available) or default to `validatedGroupId`
   - Call the updated `linkMemoryContext` which guarantees creation
5. **Tests in `src/__tests__/sync-contract.test.ts`** — unit tests that mock the Neo4j adapter and verify:
   - `linkMemoryContext` is called with correct params
   - When Agent doesn't exist, it gets created
   - When Project doesn't exist, it gets created
   - Relationships are wired correctly

## Verification Steps

1. `bun test src/__tests__/sync-contract.test.ts` — passes
2. `bun run build` — passes (no type errors)
3. Neo4j query: `MATCH (m:Insight)-[:AUTHORED_BY]->(a:Agent) RETURN count(m)` — > 0 after approval

## Files to Touch
- `src/lib/graph-adapter/neo4j-adapter.ts` — change `linkMemoryContext` to MERGE instead of OPTIONAL MATCH
- `src/app/api/curator/approve/route.ts` — add project_id resolution
- `src/__tests__/sync-contract.test.ts` — new test file
