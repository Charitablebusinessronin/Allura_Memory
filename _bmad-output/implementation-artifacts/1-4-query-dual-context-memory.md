# Story 1.4: query-dual-context-memory

Status: done

## Story

As an agent,
I want to load both project-specific and global knowledge together,
so that I can reason with local context and shared best practices at the same time.

## Acceptance Criteria

1. Given project knowledge and global knowledge both exist, when the agent builds its context, then the system loads both scopes in one retrieval flow.
2. Given dual context is retrieved, when the results are returned, then they remain clearly scoped by `group_id`.
3. Given a query for dual context, when executing, then the system prevents cross-project leakage except for approved global context.

## Tasks / Subtasks

- [x] Task 1: Design dual-context query interface (AC: 1, 2)
  - [x] Define "global" context: insights with `group_id = 'global'` or explicitly shared.
  - [x] Design query interface that accepts `project_group_id` and returns merged results.
  - [x] Define result format that preserves scope information (project vs global).
- [x] Task 2: Implement dual-context retrieval from PostgreSQL (AC: 1, 2)
  - [x] Add `src/lib/postgres/queries/get-dual-context.ts` for raw trace context.
  - [x] Query both project traces and global traces in parallel.
  - [x] Merge results with scope metadata preserved.
- [x] Task 3: Implement dual-context retrieval from Neo4j (AC: 1, 2)
  - [x] Add `src/lib/neo4j/queries/get-dual-context.ts` for semantic knowledge.
  - [x] Query both project insights and global insights.
  - [x] Handle version resolution for both scopes.
- [x] Task 4: Implement tenant isolation enforcement (AC: 3)
  - [x] Ensure global context is explicitly approved/whitelisted.
  - [x] Prevent leakage from other projects not marked as global.
  - [x] Add validation for `group_id` permissions.
- [x] Task 5: Add verification coverage (AC: 1, 2, 3)
  - [x] Test dual-context retrieval returns both project and global results.
  - [x] Test scope metadata is preserved in results.
  - [x] Test tenant isolation: cannot access other projects' non-global data.
  - [x] Test performance: dual queries execute efficiently.

## Dev Notes

- "Global" knowledge is insights/traces with a special `group_id` (e.g., 'global') or explicit sharing flags.
- This story combines PostgreSQL (episodic) and Neo4j (semantic) retrieval.
- The challenge is merging results while preserving scope and preventing leakage.
- Consider caching global context since it's shared across many requests.
- Result format should make it easy for agents to distinguish project vs global knowledge.

### Project Structure Notes

- Create dual-context query modules in both PostgreSQL and Neo4j libraries.
- Consider a unified interface that abstracts the dual-query pattern.
- Follow existing patterns for typed queries and comprehensive tests.

### References

- PostgreSQL query patterns: `src/lib/postgres/queries/insert-trace.ts`
- Neo4j query patterns: Story 1.3 (Store Versioned Semantic Insights)
- Epic 1 context: `_bmad-output/planning-artifacts/epics.md:212`
- Tenant isolation requirements: `epics.md:225`

## Dev Agent Record

### Agent Model Used

ollama-cloud/glm-5

### Debug Log References

- Depends on: Story 1.2 (episodic retrieval), Story 1.3 (Neo4j insights)
- PostgreSQL container: `knowledge-postgres`
- Neo4j container: `knowledge-neo4j`
- Status file: `_bmad-output/implementation-artifacts/sprint-status.yaml`

### Completion Notes List

- [x] Dual-context query interface designed
- [x] PostgreSQL dual-context retrieval implemented (22 tests passing)
- [x] Neo4j dual-context retrieval implemented (27 tests passing)
- [x] Tenant isolation enforcement working
- [x] All tests passing (49 total)

### Change Log

- 2026-03-15: Completed Story 1-4 implementation
  - Created PostgreSQL get-dual-context.ts with dual-context episodic memory queries
  - Created Neo4j get-dual-context.ts with dual-context semantic memory queries
  - Implemented GLOBAL_GROUP_ID = "global" for shared context
  - Added validateCrossGroupAccess for tenant isolation enforcement
  - Added merged result helpers for combined project+global context
  - All 49 tests passing (PostgreSQL: 22, Neo4j: 27)

### File List

- `src/lib/postgres/queries/get-dual-context.ts` - PostgreSQL dual-context queries
- `src/lib/postgres/queries/get-dual-context.test.ts` - PostgreSQL tests (22 tests)
- `src/lib/neo4j/queries/get-dual-context.ts` - Neo4j dual-context queries
- `src/lib/neo4j/queries/get-dual-context.test.ts` - Neo4j tests (27 tests)
