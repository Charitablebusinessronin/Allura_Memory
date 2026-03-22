# Story 1.7: automated-knowledge-curation

Status: done

## Story

As an AI engineering team,
I want a Curator agent to automatically propose insights from raw traces,
so that our memory improves without manual data entry.

## Acceptance Criteria

1. Given raw traces exist in PostgreSQL, when the Curator agent identifies a successful Event -> Outcome pattern, then it creates a draft Insight in Neo4j.
2. Given a draft Insight is created, when the curation process completes, then it flags the insight for human approval in the Mission Control workspace.
3. Given the Curator agent runs, when processing traces, then it respects tenant isolation and only proposes insights within the same group_id.

## Tasks / Subtasks

- [x] Task 1: Design Curator agent pattern detection (AC: 1)
  - [x] Define "successful" pattern: events with status='completed' and positive outcomes.
  - [x] Design pattern extraction: Event -> Outcome relationships.
  - [x] Consider frequency: patterns that occur multiple times are more valuable.
- [x] Task 2: Implement trace scanning for patterns (AC: 1)
  - [x] Add `src/lib/curation/pattern-detector.ts` to scan PostgreSQL traces.
  - [x] Query for Event -> Outcome pairs with successful status.
  - [x] Extract common metadata patterns and agent behaviors.
- [x] Task 3: Implement draft insight generation (AC: 1, 3)
  - [x] Add `src/lib/curation/insight-generator.ts` to create draft insights.
  - [x] Generate insight content from pattern analysis.
  - [x] Set confidence score based on pattern frequency and success rate.
  - [x] Store draft with `status='pending_approval'` in Neo4j.
- [x] Task 4: Implement approval workflow integration (AC: 2)
  - [x] Add flagging mechanism for Mission Control workspace.
  - [x] Create notification or webhook for new draft insights.
  - [x] Store approval metadata (requested_by, requested_at).
- [x] Task 5: Add verification coverage (AC: 1, 2, 3)
  - [x] Test pattern detection finds actual successful patterns.
  - [x] Test draft insight generation creates valid Neo4j nodes.
  - [x] Test tenant isolation: curator only processes one group_id at a time.
  - [x] Test approval workflow triggers correctly.

## Dev Notes

- This is the first "agent" story - the Curator is an automated process, not a human.
- Pattern detection can be simple at first: frequency of successful event types.
- More sophisticated ML-based pattern detection can be added later.
- The Curator should run periodically (cron job or scheduled task).
- Consider rate limiting: don't generate too many draft insights at once.

### Project Structure Notes

- Create `src/lib/curation/` directory for curation-related code.
- The Curator can be a standalone script or a service.
- Integration with Mission Control may require API/webhook design.

### References

- PostgreSQL events/outcomes tables: `src/lib/postgres/schema/traces.sql`
- Neo4j insight schema: Story 1.3
- Epic 1 context: `_bmad-output/planning-artifacts/epics.md:252`
- FR8: Knowledge Curator: `epics.md:34`

## Dev Agent Record

### Agent Model Used

ollama-cloud/glm-5

### Debug Log References

- Depends on: Story 1.1 (PostgreSQL), Story 1.3 (Neo4j), Story 1.6 (trace_ref)
- PostgreSQL container: `knowledge-postgres`
- Neo4j container: `knowledge-neo4j`
- Status file: `_bmad-output/implementation-artifacts/sprint-status.yaml`

### Completion Notes List

- [ ] Curator pattern detection designed
- [ ] Trace scanning for patterns implemented
- [ ] Draft insight generation working
- [ ] Approval workflow integration functional
- [ ] All tests passing

### File List

- `src/lib/curation/pattern-detector.ts` - Pattern detection from traces
- `src/lib/curation/pattern-detector.test.ts` - Pattern detection tests
- `src/lib/curation/insight-generator.ts` - Draft insight generation
- `src/lib/curation/insight-generator.test.ts` - Generator tests
- `src/lib/curation/curator.ts` - Main Curator agent orchestration
- `src/lib/curation/curator.test.ts` - Curator integration tests
