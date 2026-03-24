# Story 1.2: retrieve-episodic-memory-from-trace-history

Status: done

## Story

As an agent operator,
I want agents to retrieve prior episodic traces from PostgreSQL,
so that they can use recent execution history as working context.

## Acceptance Criteria

1. Given prior traces exist for a project or agent session, when episodic memory is requested, then the system returns relevant prior trace summaries.
2. Given episodic memory is retrieved, when the results are returned, then they are scoped to the correct tenant or project context.
3. Given a time window is specified, when retrieving episodic memory, then only traces within that window are returned.

## Tasks / Subtasks

- [x] Task 1: Design episodic memory query interface (AC: 1, 2)
  - [x] Define query parameters: group_id, time window, agent_id, event_type filters.
  - [x] Design return format for trace summaries (not full trace data).
  - [x] Consider pagination for large trace histories.
- [x] Task 2: Implement query functions for episodic retrieval (AC: 1, 2, 3)
  - [x] Add `src/lib/postgres/queries/get-episodic-memory.ts` with typed query functions.
  - [x] Support filtering by group_id (tenant isolation), time range, agent_id, workflow_id.
  - [x] Return summary fields: id, event_type, created_at, agent_id, status, metadata summary.
- [x] Task 3: Add time-window based querying (AC: 3)
  - [x] Support `since` and `until` parameters for time-bounded queries.
  - [x] Use `created_at` index for efficient time-range queries.
  - [x] Default to recent N events if no time window specified.
- [x] Task 4: Implement working memory context builder (AC: 1, 2)
  - [x] Create function to fetch last N events for a given context.
  - [x] Support chaining: get events after a specific parent_event_id.
  - [x] Format results for agent consumption (structured, not raw SQL rows).
- [x] Task 5: Add verification coverage (AC: 1, 2, 3)
  - [x] Test tenant isolation: queries only return traces for specified group_id.
  - [x] Test time-window filtering: only traces within range returned.
  - [x] Test pagination: large result sets handled correctly.
  - [x] Test edge cases: no traces found, invalid time ranges, etc.

## Dev Notes

- This story builds on the raw trace layer from Story 1.1. The `events` table already has the necessary indexes for efficient querying.
- Focus on read-only queries - this is about retrieval, not mutation.
- The `idx_events_group_created` index on `(group_id, created_at DESC)` is critical for performance.
- Consider the difference between "episodic" (recent events) and "semantic" (promoted knowledge) memory. This story is purely episodic.
- Return summaries, not full trace data, to keep context windows manageable for agents.
- Time windows should use `TIMESTAMPTZ` comparisons to handle timezone correctly.

### Project Structure Notes

- Create new query file: `src/lib/postgres/queries/get-episodic-memory.ts`
- Create corresponding test file: `src/lib/postgres/queries/get-episodic-memory.test.ts`
- Follow the same patterns as `insert-trace.ts` for consistency.

### References

- Story 1.1 implementation: `src/lib/postgres/queries/insert-trace.ts`
- PostgreSQL schema: `src/lib/postgres/schema/traces.sql`
- Epic 1 context: `_bmad-output/planning-artifacts/epics.md:186`
- Index usage guidance: PostgreSQL query planner docs for multi-column indexes

## Dev Agent Record

### Agent Model Used

ollama-cloud/glm-5

### Debug Log References

- Depends on: Story 1.1 (Record Raw Execution Traces)
- PostgreSQL container: `knowledge-postgres`
- Status file: `_bmad-output/implementation-artifacts/sprint-status.yaml`

### Completion Notes List

- [x] Episodic memory query interface designed
- [x] Query functions implemented with proper typing
- [x] Time-window filtering working
- [x] Working memory context builder functional
- [x] All tests passing

### Change Log

- 2026-03-15: Completed Story 1-2 implementation
  - Created get-episodic-memory.ts with typed query functions
  - Implemented tenant-scoped retrieval with group_id enforcement
  - Added time window filtering (since/until parameters)
  - Created working memory context builder for agent consumption
  - Added convenience functions: getRecentEvents, getEventById, getEventsAfterParent, getEventsByTimeWindow
  - Implemented metadata truncation for agent context windows
  - All 38 tests passing

### File List

- `src/lib/postgres/queries/get-episodic-memory.ts` - Episodic memory query functions
- `src/lib/postgres/queries/get-episodic-memory.test.ts` - Query tests (38 tests)
