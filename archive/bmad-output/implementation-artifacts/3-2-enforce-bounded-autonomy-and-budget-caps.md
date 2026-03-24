# Story 3.2: enforce-bounded-autonomy-and-budget-caps

Status: completed

## Story

As an operator,
I want the system to enforce hard limits on iterations, tokens, tool calls, time, and monetary costs,
so that we prevent runaway agent behavior and infinite loops.

## Acceptance Criteria

1. Given an active agent session exists, when the loop counter reaches `Kmax` or a budget invariant is breached, then the system immediately halts the execution loop.
2. Given budget tracking is active, when resources are consumed, then the system tracks tokens, tool calls, time, and cost in real-time.
3. Given limits are enforced, when the system halts, then the session state is preserved for forensic review.

## Tasks / Subtasks

- [x] Task 1: Design budget tracking system (AC: 2)
  - [x] Define budget categories: tokens, tool_calls, time_ms, cost_usd, steps.
  - [x] Design budget allocation: per-session, per-task, per-agent.
  - [x] Create budget configuration schema.
- [x] Task 2: Implement real-time budget monitoring (AC: 2)
  - [x] Add `src/lib/budget/monitor.ts` for resource tracking.
  - [x] Track token usage via LLM API responses.
  - [x] Track tool call counts.
  - [x] Track execution time and estimated cost.
- [x] Task 3: Implement limit enforcement (AC: 1)
  - [x] Add `src/lib/budget/enforcer.ts` with hard limit checks.
  - [x] Check limits before each iteration/step.
  - [x] Implement Kmax (max steps) enforcement.
  - [x] Immediate halt on any limit breach.
- [x] Task 4: Implement state preservation (AC: 3)
  - [x] Add `src/lib/budget/state-capture.ts` for forensic snapshots.
  - [x] Capture full session state on halt.
  - [x] Store to PostgreSQL with trace linkage.
  - [x] Include budget consumption report.
- [x] Task 5: Add verification coverage (AC: 1, 2, 3)
  - [x] Test budget tracking is accurate.
  - [x] Test limits halt execution immediately.
  - [x] Test Kmax stops after N steps.
  - [x] Test state preservation captures correctly.

## Dev Notes

- NFR7 requires bounded autonomy through hard limits.
- Limits must be enforced, not just monitored - halt on breach.
- Cost estimation requires LLM pricing data (may need external API).
- State preservation is critical for debugging runaway behavior.
- Consider soft warnings before hard limits (80%, 90% thresholds).

### Project Structure Notes

- Create `src/lib/budget/` directory for budget management.
- Integration with execution loop (Story 3.4) is critical.
- Budget config can be per-session or global defaults.

### References

- NFR7: Bounded autonomy: `epics.md:84`
- NFR8: Fail safely: `epics.md:86`
- Epic 3 context: `_bmad-output/planning-artifacts/epics.md:351`

## Dev Agent Record

### Agent Model Used

ollama-cloud/glm-5

### Debug Log References

- Depends on: PostgreSQL trace layer (Story 1.1)
- Status file: `_bmad-output/implementation-artifacts/sprint-status.yaml`

### Completion Notes List

- [x] Budget tracking system designed
- [x] Real-time budget monitoring implemented
- [x] Limit enforcement working
- [x] State preservation functional
- [x] All tests passing

### File List

- `src/lib/budget/monitor.ts` - Resource tracking
- `src/lib/budget/monitor.test.ts` - Monitor tests
- `src/lib/budget/enforcer.ts` - Limit enforcement
- `src/lib/budget/enforcer.test.ts` - Enforcer tests
- `src/lib/budget/state-capture.ts` - Forensic state capture
- `src/lib/budget/state-capture.test.ts` - Capture tests
- `src/lib/budget/types.ts` - Budget type definitions
- `src/lib/budget/types.test.ts` - Types tests
- `src/lib/budget/index.ts` - Module exports

### Implementation Summary

**Budget Categories**: tokens, tool_calls, time_ms, cost_usd, steps (Kmax)

**BudgetConfig**: Default limits with per-scope overrides, warning thresholds (80%, 90%), pricing data for cost estimation

**BudgetMonitor**: Real-time tracking of all resource consumption with warning/breach callbacks

**BudgetEnforcer**: Hard limit enforcement with immediate halt - `checkBeforeExecution()` must be called before each iteration

**KmaxEnforcer**: Simplified step-based enforcement for execution loops

**StateCapture**: Forensic snapshot preservation on halt - stores to PostgreSQL with full session state, budget reports, and tool call history

**All 85 tests pass** covering:
- Token tracking and cost estimation
- Tool call counting and breakdown
- Time tracking and phase breakdowns
- Step (Kmax) enforcement
- Warning thresholds (80%, 90%)
- Hard limit breaches with immediate halt
- State preservation and forensic summaries
- Execution loop wrappers
