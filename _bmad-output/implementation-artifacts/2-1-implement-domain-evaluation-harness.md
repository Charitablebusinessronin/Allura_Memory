# Story 2.1: implement-domain-evaluation-harness

Status: completed

## Story

As an AI researcher,
I want to define an `evaluate_forward_fn` with objective metrics (accuracy, cost, latency),
so that candidate agent designs can be measured against specific performance thresholds.

## Acceptance Criteria

1. Given a target domain exists, when a candidate agent design is generated, then the harness evaluates it and returns a structured score. ✅
2. Given evaluation metrics are computed, when the evaluation completes, then the metrics are logged to the raw trace layer in PostgreSQL. ✅
3. Given evaluation results exist, when comparing candidates, then the system ranks them by composite score across accuracy, cost, and latency. ✅

## Tasks / Subtasks

- [x] Task 1: Design evaluation harness interface (AC: 1)
  - [x] Define `evaluate_forward_fn` signature: accepts agent design, returns metrics.
  - [x] Design metrics structure: accuracy (0-1), cost (USD), latency (ms), composite score.
  - [x] Support domain-specific evaluation criteria (configurable).
- [x] Task 2: Implement evaluation harness core (AC: 1)
  - [x] Add `src/lib/adas/evaluation-harness.ts` with harness implementation.
  - [x] Support loading candidate agent designs from code or config.
  - [x] Execute candidate in isolated environment (preparation for Story 2.3).
- [x] Task 3: Implement metrics computation (AC: 1, 3)
  - [x] Compute accuracy against ground truth or heuristics.
  - [x] Track token usage and API calls for cost calculation.
  - [x] Measure execution time for latency.
  - [x] Calculate composite score (weighted average of metrics).
- [x] Task 4: Integrate with PostgreSQL trace layer (AC: 2)
  - [x] Log evaluation runs as `adas_runs` records.
  - [x] Store detailed metrics in outcomes linked to run events.
  - [x] Include candidate design reference and evaluation parameters.
- [x] Task 5: Add verification coverage (AC: 1, 2, 3)
  - [x] Test harness evaluates a simple candidate correctly.
  - [x] Test metrics are computed and stored accurately.
  - [x] Test evaluation results are logged to PostgreSQL.
  - [x] Test composite score ranking works correctly.

## Dev Notes

- This is the foundation of the ADAS (Automated Design of Agent Systems) pipeline.
- The harness must be objective and reproducible - same candidate should get same score.
- Cost calculation may require integration with LLM API pricing (OpenAI, Anthropic, etc.).
- Latency should measure end-to-end time, not just model inference time.
- Consider caching evaluation results for identical candidates.

### Project Structure Notes

- Create `src/lib/adas/` directory for ADAS-related code.
- Evaluation harness is the core component - design for extensibility.
- Integration with PostgreSQL uses existing trace insertion functions.

### References

- PostgreSQL adas_runs table: `src/lib/postgres/schema/traces.sql:138`
- FR2: Evaluation harness: `epics.md:22`
- Epic 2 context: `_bmad-output/planning-artifacts/epics.md:269`

## Dev Agent Record

### Agent Model Used

ollama-cloud/glm-5

### Debug Log References

- Depends on: Story 1.1 (PostgreSQL trace layer)
- PostgreSQL container: `knowledge-postgres`
- Status file: `_bmad-output/implementation-artifacts/sprint-status.yaml`

### Completion Notes List

- [x] Evaluation harness interface designed
- [x] Harness core implemented
- [x] Metrics computation working
- [x] PostgreSQL integration complete
- [x] All tests passing

### File List

- `src/lib/adas/evaluation-harness.ts` - Core evaluation harness
- `src/lib/adas/evaluation-harness.test.ts` - Harness tests
- `src/lib/adas/metrics.ts` - Metrics computation utilities
- `src/lib/adas/metrics.test.ts` - Metrics tests
- `src/lib/adas/types.ts` - ADAS type definitions
- `src/lib/adas/index.ts` - Module exports
