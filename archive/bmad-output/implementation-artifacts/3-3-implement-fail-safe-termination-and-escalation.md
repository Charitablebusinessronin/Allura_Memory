# Story 3.3: implement-fail-safe-termination-and-escalation

Status: complete

## Story

As a developer,
I want a fail-safe return path that summarizes progress when limits are hit,
so that I can understand why an agent stopped and take over manually in Mission Control.

## Acceptance Criteria

1. Given a session has hit a budget limit or failed a policy check, when the loop terminates, then the system generates a progress summary report with bottlenecks and attempted steps.
2. Given a summary is generated, when the process completes, then the summary is persisted with trace linkage and escalated to Mission Control for human intervention.
3. Given escalation occurs, when a human reviews the case, then they have sufficient context to take over or restart the task.

## Tasks / Subtasks

- [x] Task 1: Design progress summary format (AC: 1)
  - [x] Define summary sections: goal, progress, bottlenecks, attempted steps, partial results.
  - [x] Design bottleneck detection heuristics.
  - [x] Create human-readable formatting.
- [x] Task 2: Implement progress tracking (AC: 1)
  - [x] Add `src/lib/termination/progress-tracker.ts` to capture execution history.
  - [x] Track attempted steps and their outcomes.
  - [x] Identify stuck patterns (repeated failures, no progress).
  - [x] Capture partial results and intermediate state.
- [x] Task 3: Implement summary generation (AC: 1, 2)
  - [x] Add `src/lib/termination/summary-generator.ts` for report creation.
  - [x] Generate bottleneck analysis.
  - [x] Format for human readability.
  - [x] Include actionable recommendations.
- [x] Task 4: Implement Mission Control escalation (AC: 2, 3)
  - [x] Add `src/lib/termination/escalation.ts` for Mission Control integration.
  - [x] Create escalation ticket with summary and trace_ref.
  - [x] Support notification (email, Slack, in-app).
  - [x] Provide "take over" and "restart" actions.
- [x] Task 5: Add verification coverage (AC: 1, 2, 3)
  - [x] Test progress tracking captures execution history.
  - [x] Test summary generation identifies bottlenecks.
  - [x] Test escalation creates correct tickets.
  - [x] Test human can understand and take over.

## Dev Notes

- NFR8 requires graceful degradation and escalation.
- The summary must be actionable - not just "it failed" but "here's why and what to do".
- Bottleneck detection can be heuristic: repeated errors, no progress metric improvement, etc.
- Mission Control integration may require API/webhook design.

### Project Structure Notes

- Create `src/lib/termination/` directory for fail-safe handling.
- Integration with budget enforcer (Story 3.2) triggers termination.
- Escalation may be async - don't block on notification.

### References

- NFR8: Fail safely: `epics.md:86`
- Budget enforcement: Story 3.2
- Epic 3 context: `_bmad-output/planning-artifacts/epics.md:364`

## Dev Agent Record

### Agent Model Used

ollama-cloud/glm-5

### Debug Log References

- Depends on: Story 1.1 (PostgreSQL), Story 3.2 (Budget enforcement)
- Status file: `_bmad-output/implementation-artifacts/sprint-status.yaml`

### Completion Notes List

- [x] Progress summary format designed
- [x] Progress tracking implemented
- [x] Summary generation working
- [x] Mission Control escalation functional
- [x] All tests passing

### File List

- `src/lib/termination/types.ts` - Type definitions for termination module
- `src/lib/termination/progress-tracker.ts` - Execution tracking and stuck pattern detection
- `src/lib/termination/progress-tracker.test.ts` - 28 passing tests for tracker
- `src/lib/termination/summary-generator.ts` - Report generation with human-readable formats
- `src/lib/termination/summary-generator.test.ts` - 29 passing tests for generator
- `src/lib/termination/escalation.ts` - Mission Control escalation with notifications
- `src/lib/termination/escalation.test.ts` - 35 passing tests for escalation
- `src/lib/termination/index.ts` - Module exports

### Implementation Summary

**AC1 - Progress Summary with Bottlenecks:**
- `ProgressTracker` captures execution history, attempted steps, and stuck patterns
- `StuckPattern` detection for: repeated_action, no_progress, circular_reasoning, tool_failure_loop, policy_rejection_loop
- `Bottleneck` identification from failed steps, policy denials, timeouts
- `AttemptedStep` records with outcome classification (success, failure, policy_denied, etc.)

**AC2 - Persistence and Escalation:**
- `SummaryGenerator` creates `ProgressSummary` with goal, progress, bottlenecks, attempted steps, and recommendations
- PostgreSQL persistence for summaries with trace_ref linkage
- `EscalationService` creates `EscalationTicket` with priority (low/medium/high/critical)
- Notification channels: in_app, email, Slack, webhook (async, non-blocking)

**AC3 - Human Context for Takeover/Restart:**
- `canTakeOver()` and `canRestart()` methods with policy-aware logic
- `getRecommendedActions()` provides actionable next steps based on halt reason
- Human-readable summaries in markdown, text, and one-liner formats
- Suggested actions tailored to halt cause (budget limits vs policy violations vs errors)