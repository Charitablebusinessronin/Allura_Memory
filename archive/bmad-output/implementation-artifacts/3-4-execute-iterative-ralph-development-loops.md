# Story 3.4: execute-iterative-ralph-development-loops

Status: complete

## Story

As an AI engineer,
I want the agent to use a self-referential Ralph loop with completion promises,
so that it can autonomously fix its own bugs and iterate until requirements are met.

## Acceptance Criteria

1. Given a task description and a specific completion promise exist, when the Ralph loop is initiated, then the agent continues to refine its output despite setbacks.
2. Given the Ralph loop executes, when checking for completion, then the loop terminates only when the exact promise string is detected or `Kmax` is reached.
3. Given setbacks occur during execution, when errors happen, then the agent self-corrects and retries with modified approach.

## Tasks / Subtasks

- [x] Task 1: Design Ralph loop architecture (AC: 1)
  - [x] Define completion promise format: specific string or condition.
  - [x] Design self-correction strategy: error analysis, plan modification, retry.
  - [x] Define loop structure: Perceive -> Plan -> Act -> Check -> Adapt.
- [x] Task 2: Implement completion promise detection (AC: 2)
  - [x] Add `src/lib/ralph/completion-detector.ts` for promise checking.
  - [x] Support exact string matching.
  - [x] Support condition functions (e.g., tests pass).
  - [x] Integrate with budget enforcer for Kmax check.
- [x] Task 3: Implement self-correction logic (AC: 1, 3)
  - [x] Add `src/lib/ralph/self-corrector.ts` for error handling.
  - [x] Analyze failures to identify root cause.
  - [x] Generate modified plan based on error type.
  - [x] Implement retry with backoff.
- [x] Task 4: Implement Ralph loop orchestration (AC: 1, 2, 3)
  - [x] Add `src/lib/ralph/loop.ts` as main loop controller.
  - [x] Orchestrate Perceive-Plan-Act-Check-Adapt cycle.
  - [x] Track iteration count and history.
  - [x] Integrate with policy gateway (Story 3.1) and budget enforcer (Story 3.2).
- [x] Task 5: Add verification coverage (AC: 1, 2, 3)
  - [x] Test loop continues until completion promise met.
  - [x] Test Kmax terminates loop even if promise not met.
  - [x] Test self-correction recovers from errors.
  - [x] Test setbacks trigger plan modification.

## Dev Notes

- The "Ralph Wiggum" pattern is about persistence despite setbacks.
- Completion promise must be specific and verifiable.
- Self-correction requires error classification and strategy selection.
- The loop is the core execution engine - must be robust.

### Project Structure Notes

- Create `src/lib/ralph/` directory for Ralph loop implementation.
- Integration with policy gateway and budget enforcer is critical.
- The loop may call tools, so tool integration is needed.

### References

- FR14: ReAct execution: `epics.md:46`
- FR15: State machines: `epics.md:48`
- Ralph pattern: Architecture addendum (Making a Cognitive Kernel)
- Epic 3 context: `_bmad-output/planning-artifacts/epics.md:377`

## Dev Agent Record

### Agent Model Used

ollama-cloud/glm-5

### Debug Log References

- Depends on: Story 3.1 (Policy Gateway), Story 3.2 (Budget Enforcement)
- Status file: `_bmad-output/implementation-artifacts/sprint-status.yaml`

### Completion Notes List

- [x] Ralph loop architecture designed
- [x] Completion promise detection implemented
- [x] Self-correction logic working
- [x] Loop orchestration functional
- [x] All tests passing

### File List

- `src/lib/ralph/types.ts` - Ralph type definitions
- `src/lib/ralph/completion-detector.ts` - Promise detection
- `src/lib/ralph/completion-detector.test.ts` - Detector tests
- `src/lib/ralph/self-corrector.ts` - Error recovery
- `src/lib/ralph/self-corrector.test.ts` - Corrector tests
- `src/lib/ralph/loop.ts` - Main loop controller
- `src/lib/ralph/loop.test.ts` - Loop tests
- `src/lib/ralph/index.ts` - Module exports

### Implementation Summary

**Completion Promise Detection (`completion-detector.ts`)**
- Exact string matching for completion promises
- Regex pattern matching support
- Condition function support for custom completion logic
- Multi-promise support (all must match)
- Kmax integration for bounded iterations

**Self-Correction Logic (`self-corrector.ts`)**
- Error classification: timeout, resource_exhausted, policy_denied, budget_exceeded, invalid_input, dependency_error, critical_error, transient, unknown_error
- Correction strategies: retry_same, retry_with_backoff, modify_input, try_alternative, simplify_plan, escalate, abort
- Stuck pattern detection: repeated_error, no_progress, oscillation, diminishing_returns
- Exponential/linear/constant backoff with jitter
- Adaptation generation for stuck patterns

**Loop Orchestration (`loop.ts`)**
- Perceive -> Plan -> Act -> Check -> Adapt cycle
- Iteration tracking with currentPhase state
- Integration with SessionId for budget tracking
- External halt support
- Callback support: onProgress, onError, onCorrection, onCompletion, onHalt
- Run function convenience wrapper

**All 78 tests pass:**
- CompletionDetector: 26 tests
- SelfCorrector: 21 tests
- RalphLoop: 31 tests (covering AC1, AC2, AC3)