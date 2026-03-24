# Story 1.5: enforce-tenant-isolation-with-group-ids

Status: done

## Story

As a platform owner,
I want all memory records scoped by `group_id`,
so that project knowledge remains isolated unless explicitly shared.

## Acceptance Criteria

1. Given a trace or insight is created, when it is persisted, then it is stored with a valid `group_id`.
2. Given retrieval logic executes, when querying data, then it prevents cross-project leakage except for approved global context.
3. Given a `group_id` validation mechanism exists, when checking tags, then it normalizes tags and detects orphaned or misspelled `group_id` values.

## Tasks / Subtasks

- [x] Task 1: Implement group_id validation utilities (AC: 1, 3)
  - [x] Add `src/lib/validation/group-id.ts` with validation functions.
  - [x] Enforce lowercase-only group_ids (NFR11 compliance).
  - [x] Validate format: alphanumeric with hyphens/underscores only.
  - [x] Reject empty, whitespace-only, or malformed group_ids.
- [x] Task 2: Add group_id enforcement to PostgreSQL layer (AC: 1, 2)
  - [x] Update insert functions to validate group_id before insertion.
  - [x] Add database-level CHECK constraints (already in schema from Story 1.1).
  - [x] Ensure all queries filter by group_id for tenant isolation.
- [x] Task 3: Add group_id enforcement to Neo4j layer (AC: 1, 2)
  - [x] Update Neo4j insert functions to validate group_id.
  - [x] Add property constraints or validation in Cypher queries.
  - [x] Ensure all Neo4j queries filter by group_id.
- [x] Task 4: Implement group_id governance tools (AC: 3)
  - [x] Add function to detect orphaned group_ids (no recent activity).
  - [x] Add function to detect misspelled/similar group_ids (Levenshtein distance).
  - [x] Create report of group_id usage across the system.
- [x] Task 5: Add verification coverage (AC: 1, 2, 3)
  - [x] Test validation rejects invalid group_ids.
  - [x] Test tenant isolation: queries don't leak across group_ids.
  - [x] Test governance tools detect orphaned/misspelled group_ids.
  - [x] Test lowercase enforcement (NFR11).

## Dev Notes

- NFR11 requires canonical lowercase tags for sync integrity.
- This story is about enforcement, not just storage. Every insert and query must respect group_id.
- The governance tools help maintain data quality over time.
- Consider this a "policy" layer that wraps the raw storage layers.
- Levenshtein distance can detect typos like "my-projct" vs "my-project".

### Project Structure Notes

- Create validation utilities in `src/lib/validation/`.
- Update existing PostgreSQL and Neo4j query functions to use validation.
- Governance tools can be CLI scripts or admin API endpoints.

### References

- PostgreSQL schema: `src/lib/postgres/schema/traces.sql` (group_id constraints)
- NFR11: Tag governance in `epics.md:92`
- Epic 1 context: `_bmad-output/planning-artifacts/epics.md:225`
- Tenant isolation requirements: `epics.md:236`

## Dev Agent Record

### Agent Model Used

ollama-cloud/glm-5

### Debug Log References

- Depends on: Story 1.1 (PostgreSQL), Story 1.3 (Neo4j)
- PostgreSQL container: `knowledge-postgres`
- Neo4j container: `knowledge-neo4j`
- Status file: `_bmad-output/implementation-artifacts/sprint-status.yaml`

### Completion Notes List

- [ ] group_id validation utilities implemented
- [ ] PostgreSQL layer enforces group_id
- [ ] Neo4j layer enforces group_id
- [ ] Governance tools detect orphaned/misspelled group_ids
- [ ] All tests passing

### File List

- `src/lib/validation/group-id.ts` - group_id validation utilities
- `src/lib/validation/group-id.test.ts` - Validation tests
- `src/lib/validation/group-governance.ts` - Governance tools
- `src/lib/validation/group-governance.test.ts` - Governance tests
