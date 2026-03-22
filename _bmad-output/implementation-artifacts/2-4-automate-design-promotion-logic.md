# Story 2.4: automate-design-promotion-logic

Status: complete

## Story

As a system architect,
I want discovered designs that meet a confidence score of 0.7 or higher to be flagged for promotion,
so that we can transition successful research into production-ready insights.

## Acceptance Criteria

1. Given an ADAS run result exists, when the performance metric exceeds the defined acceptance threshold (0.7), then the system creates a candidate versioned Insight or AgentDesign proposal with linked evidence.
2. Given a candidate design is flagged for promotion, when the promotion process initiates, then the insight becomes active only after human approval in Mission Control.
3. Given promotion candidates exist, when querying for high-confidence designs, then the system returns only those meeting the threshold with proper evidence linkage.

## Tasks / Subtasks

- [x] Task 1: Design promotion criteria and workflow (AC: 1)
  - [x] Define confidence threshold: 0.7 (configurable).
  - [x] Design promotion state machine: candidate -> pending_approval -> approved/rejected.
  - [x] Define required evidence: evaluation metrics, trace_ref, design code.
- [x] Task 2: Implement promotion candidate detection (AC: 1)
  - [x] Add `src/lib/adas/promotion-detector.ts` to scan ADAS runs.
  - [x] Query PostgreSQL for runs with score >= 0.7.
  - [x] Verify evidence completeness before flagging.
- [x] Task 3: Implement promotion proposal creation (AC: 1, 3)
  - [x] Add `src/lib/adas/promotion-proposal.ts` to create Neo4j proposals.
  - [x] Create `AgentDesign` node with version and metadata.
  - [x] Link to PostgreSQL evidence via `trace_ref`.
  - [x] Set initial status: `pending_approval`.
- [x] Task 4: Implement approval workflow (AC: 2)
  - [x] Add approval API for Mission Control integration.
  - [x] Support approve/reject actions with reason.
  - [x] Update Neo4j status on approval: `active` or `rejected`.
  - [x] Notify relevant parties on approval status change.
- [x] Task 5: Add verification coverage (AC: 1, 2, 3)
  - [x] Test promotion detection finds qualifying designs.
  - [x] Test proposals created with correct evidence linkage.
  - [x] Test approval workflow state transitions.
  - [x] Test rejection path works correctly.

## Dev Notes

- FR4 requires confidence threshold of 0.7 for mirroring to Notion.
- Promotion is the bridge between ADAS research and production knowledge.
- Human approval is mandatory - no auto-promotion to production.
- The `AgentDesign` node in Neo4j should be versioned (Story 1.3 patterns).
- Consider audit trail for approval decisions (who, when, why).

### Project Structure Notes

- Extend `src/lib/adas/` with promotion modules.
- Integration with Neo4j uses insight insertion patterns from Story 1.3.
- Mission Control integration may require API/webhook design.

### References

- Neo4j insight versioning: Story 1.3
- PostgreSQL ADAS runs: `src/lib/postgres/schema/traces.sql:138`
- FR3: Versioned insights: `epics.md:24`
- FR4: Confidence threshold: `epics.md:26`
- Epic 2 context: `_bmad-output/planning-artifacts/epics.md:308`

## Dev Agent Record

### Agent Model Used

ollama-cloud/glm-5

### Debug Log References

- Depends on: Story 1.3 (Neo4j insights), Story 1.6 (trace_ref), Story 2.1 (Evaluation)
- PostgreSQL container: `knowledge-postgres`
- Neo4j container: `knowledge-neo4j`
- Status file: `_bmad-output/implementation-artifacts/sprint-status.yaml`

### Completion Notes List

- [x] Promotion criteria and workflow designed
- [x] Promotion candidate detection implemented
- [x] Promotion proposal creation working
- [x] Approval workflow functional
- [x] All tests passing

### File List

- `src/lib/adas/promotion-detector.ts` - Candidate detection
- `src/lib/adas/promotion-detector.test.ts` - Detection tests
- `src/lib/adas/promotion-proposal.ts` - Proposal creation
- `src/lib/adas/promotion-proposal.test.ts` - Proposal tests
- `src/lib/adas/approval-workflow.ts` - Approval handling
- `src/lib/adas/approval-workflow.test.ts` - Workflow tests
