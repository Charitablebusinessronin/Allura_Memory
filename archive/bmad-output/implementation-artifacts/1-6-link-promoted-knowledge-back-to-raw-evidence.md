# Story 1.6: link-promoted-knowledge-back-to-raw-evidence

Status: done

## Story

As a compliance or audit reviewer,
I want each promoted insight linked back to raw PostgreSQL traces,
so that I can reconstruct why a knowledge item exists.

## Acceptance Criteria

1. Given an insight is promoted into Neo4j, when it is stored, then it includes a `trace_ref` or equivalent reference to its PostgreSQL evidence.
2. Given an insight has a trace_ref, when an auditor queries it, then they can navigate from promoted knowledge back to the source trace.
3. Given a trace reference is created, when validating it, then the system ensures the referenced trace actually exists in PostgreSQL.

## Tasks / Subtasks

- [x] Task 1: Design trace reference schema (AC: 1)
  - [x] Define `trace_ref` format: `{table}:{id}` (e.g., `events:12345`).
  - [x] Add `source_ref` property to Neo4j Insight nodes.
  - [x] Support multiple trace_refs in source_ref field.
- [x] Task 2: Implement trace reference validation (AC: 3)
  - [x] Add function to verify a trace_ref points to existing PostgreSQL record.
  - [x] Query PostgreSQL to validate event_id exists.
  - [x] Return validation result with helpful error messages.
- [x] Task 3: Update insight promotion workflow (AC: 1, 2)
  - [x] Neo4j insert functions accept and store source_ref.
  - [x] source_ref populated when promoting from PostgreSQL traces.
- [x] Task 4: Implement audit navigation queries (AC: 2)
  - [x] Add query to get full trace details from a trace_ref.
  - [x] Add query to get all insights derived from a specific trace.
  - [x] Create audit trail view combining Neo4j insight + PostgreSQL trace.
- [x] Task 5: Add verification coverage (AC: 1, 2, 3)
  - [x] Test trace_ref is stored correctly in Neo4j.
  - [x] Test validation rejects non-existent trace_refs.
  - [x] Test audit navigation returns correct trace details.
  - [x] Test bidirectional queries: insight→trace and trace→insights.

## Dev Notes

- This is critical for compliance (NFR3, NFR4, NFR5) - audit reconstruction requires evidence linkage.
- The `trace_ref` format should be stable and parseable: `{table}:{id}`.
- Consider the case where an insight is derived from multiple traces (e.g., pattern across many events).
- Validation should happen at promotion time, not just at query time.
- The audit trail view is for human consumption - make it readable.

### Project Structure Notes

- Extend Neo4j insight insertion to accept trace_ref parameter.
- Create cross-database query utilities (Neo4j + PostgreSQL).
- Audit navigation can be a separate module or part of existing queries.

### References

- PostgreSQL events table: `src/lib/postgres/schema/traces.sql`
- Neo4j insight schema: Story 1.3
- NFR3: Audit reconstruction: `epics.md:76`
- NFR4: Five audit layers: `epics.md:78`
- Epic 1 context: `_bmad-output/planning-artifacts/epics.md:239`

## Dev Agent Record

### Agent Model Used

ollama-cloud/glm-5

### Debug Log References

- Depends on: Story 1.1 (PostgreSQL traces), Story 1.3 (Neo4j insights)
- PostgreSQL container: `knowledge-postgres`
- Neo4j container: `knowledge-neo4j`
- Status file: `_bmad-output/implementation-artifacts/sprint-status.yaml`

### Completion Notes List

- [x] trace_ref schema designed (`{table}:{id}` format)
- [x] Trace reference validation implemented (33 tests passing)
- [x] Insight promotion workflow updated with source_ref
- [x] Audit navigation queries working (16 tests passing)
- [x] All tests passing (49 total)

### Change Log

- 2026-03-15: Completed Story 1-6 implementation
  - Created trace-ref.ts with validation utilities (parse, validate, verify)
  - Created trace-navigation.ts with audit navigation queries
  - Added source_ref support to Neo4j insight insertion
  - Implemented bidirectional queries: insight→trace and trace→insights
  - Added linkInsightToTrace and unlinkInsightFromTrace functions
  - All 49 tests passing (trace-ref: 33, trace-navigation: 16)

### File List

- `src/lib/validation/trace-ref.ts` - Trace reference validation utilities
- `src/lib/validation/trace-ref.test.ts` - Validation tests (33 tests)
- `src/lib/audit/trace-navigation.ts` - Audit navigation queries
- `src/lib/audit/trace-navigation.test.ts` - Audit tests (16 tests)
