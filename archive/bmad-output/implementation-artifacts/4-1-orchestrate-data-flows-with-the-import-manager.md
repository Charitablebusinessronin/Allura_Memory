# Story 4.1: orchestrate-data-flows-with-the-import-manager

Status: backlog

## Story

As a data engineer,
I want an import manager to orchestrate movement of data from PostgreSQL to Neo4j,
so that we have a scalable, observable pipeline for knowledge creation.

## Acceptance Criteria

1. Given new execution traces exist in PostgreSQL, when the scheduled import process triggers, then it extracts Event -> Outcome pairs.
2. Given extraction completes, when the transformation phase runs, then it passes extracted data to the mapping service for normalization.
3. Given the pipeline runs, when monitoring the process, then the system provides observability: logs, metrics, and error tracking.

## Tasks / Subtasks

- [ ] Task 1: Design import pipeline architecture (AC: 1, 2, 3)
  - [ ] Define pipeline stages: Extract -> Transform -> Load (ETL).
  - [ ] Design orchestration: scheduler, workers, queues.
  - [ ] Define observability: logging, metrics, alerting.
- [ ] Task 2: Implement extraction from PostgreSQL (AC: 1)
  - [ ] Add `src/lib/import/extractor.ts` to read Event -> Outcome pairs.
  - [ ] Support incremental extraction (only new records since last run).
  - [ ] Handle large datasets with pagination.
  - [ ] Track extraction state (watermark/offset).
- [ ] Task 3: Implement pipeline orchestration (AC: 2)
  - [ ] Add `src/lib/import/orchestrator.ts` for workflow management.
  - [ ] Coordinate extraction, transformation, and loading.
  - [ ] Support retry logic for failed stages.
  - [ ] Implement checkpointing for resume capability.
- [ ] Task 4: Implement observability (AC: 3)
  - [ ] Add `src/lib/import/observability.ts` for monitoring.
  - [ ] Log pipeline events: start, stage complete, errors.
  - [ ] Track metrics: records processed, latency, error rates.
  - [ ] Integrate with alerting on failures.
- [ ] Task 5: Add verification coverage (AC: 1, 2, 3)
  - [ ] Test extraction reads correct Event -> Outcome pairs.
  - [ ] Test orchestration coordinates stages correctly.
  - [ ] Test observability captures metrics accurately.
  - [ ] Test retry and checkpointing work correctly.

## Dev Notes

- FR8 mentions Apache NiFi as a potential import manager - but we can build a custom solution first.
- The pipeline must be reliable: resume from failures, don't lose data.
- Incremental extraction is critical for performance - don't reprocess old data.
- Observability is essential for production operations.

### Project Structure Notes

- Create `src/lib/import/` directory for import pipeline.
- The orchestrator can use a job queue (Bull, Agenda) or simple cron.
- State tracking requires persistent storage (PostgreSQL or Redis).

### References

- PostgreSQL events/outcomes: `src/lib/postgres/schema/traces.sql`
- FR8: Knowledge Curator: `epics.md:34`
- Epic 4 context: `_bmad-output/planning-artifacts/epics.md:420`

## Dev Agent Record

### Agent Model Used

ollama-cloud/glm-5

### Debug Log References

- Depends on: Story 1.1 (PostgreSQL)
- PostgreSQL container: `knowledge-postgres`
- Status file: `_bmad-output/implementation-artifacts/sprint-status.yaml`

### Completion Notes List

- [ ] Import pipeline architecture designed
- [ ] Extraction from PostgreSQL implemented
- [ ] Pipeline orchestration working
- [ ] Observability functional
- [ ] All tests passing

### File List

- `src/lib/import/extractor.ts` - PostgreSQL extraction
- `src/lib/import/extractor.test.ts` - Extraction tests
- `src/lib/import/orchestrator.ts` - Pipeline orchestration
- `src/lib/import/orchestrator.test.ts` - Orchestrator tests
- `src/lib/import/observability.ts` - Monitoring and metrics
- `src/lib/import/observability.test.ts` - Observability tests
- `src/lib/import/types.ts` - Import pipeline types
