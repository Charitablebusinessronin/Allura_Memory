# Story 3.6: implement-circuit-breakers-for-operational-safety

Status: done

## Story

As a system reliability engineer,
I want circuit breakers to halt the agent if error rates spike,
so that we prevent the system from wasting resources on corrupted sessions.

## Acceptance Criteria

1. Given an agent is executing a multi-step task, when successive tool calls return errors exceeding a defined threshold, then the circuit breaker trips and pauses the agent.
2. Given a circuit breaker trips, when the event occurs, then it is logged and alerted to Mission Control for operator review.
3. Given a circuit breaker is tripped, when the condition resolves, then the system supports manual or automatic reset after review.

## Tasks / Subtasks

- [x] Task 1: Design circuit breaker pattern (AC: 1)
  - [x] Define states: CLOSED (normal), OPEN (tripped), HALF_OPEN (testing).
  - [x] Define error threshold: consecutive errors or error rate percentage.
  - [x] Design recovery strategy: manual reset, timeout-based auto-reset.
- [x] Task 2: Implement circuit breaker core (AC: 1)
  - [x] Add `src/lib/circuit-breaker/breaker.ts` with state machine.
  - [x] Track error counts and success counts.
  - [x] Trip breaker when threshold exceeded.
  - [x] Reject calls when breaker is OPEN.
- [x] Task 3: Implement alerting and logging (AC: 2)
  - [x] Add `src/lib/circuit-breaker/alerting.ts` for Mission Control integration.
  - [x] Log circuit breaker events to PostgreSQL.
  - [x] Send alerts on trip and reset events.
  - [x] Include context: error count, affected agent, time.
- [x] Task 4: Implement reset mechanisms (AC: 3)
  - [x] Support manual reset via API/Mission Control.
  - [x] Support timeout-based auto-reset (HALF_OPEN testing).
  - [x] Validate system health before reset.
  - [x] Log reset actions with operator attribution.
- [x] Task 5: Add verification coverage (AC: 1, 2, 3)
  - [x] Test breaker trips after threshold errors.
  - [x] Test calls rejected when breaker is OPEN.
  - [x] Test alerting triggers on trip.
  - [x] Test reset mechanisms work correctly.

## Dev Notes

- Circuit breakers prevent cascade failures in distributed systems.
- The pattern is from Michael Nygard's "Release It!" book.
- Error threshold should be configurable per-agent or global.
- Manual reset is safer for production - requires human judgment.
- Consider different breakers for different tool types (LLM vs external API).

### Project Structure Notes

- Create `src/lib/circuit-breaker/` directory for circuit breaker implementation.
- Integration with tool calls (via policy gateway) triggers breaker checks.
- State can be stored in-memory or Redis for distributed systems.

### References

- Circuit breaker pattern: https://martinfowler.com/bliki/CircuitBreaker.html
- Epic 3 context: `_bmad-output/planning-artifacts/epics.md:403`

## Dev Agent Record

### Agent Model Used

ollama-cloud/glm-5

### Debug Log References

- Depends on: Story 1.1 (PostgreSQL), Story 3.1 (Policy Gateway)
- Status file: `_bmad-output/implementation-artifacts/sprint-status.yaml`

### Completion Notes List

- [x] Circuit breaker pattern designed
- [x] Circuit breaker core implemented
- [x] Alerting and logging working
- [x] Reset mechanisms functional
- [x] All tests passing

### File List

- `src/lib/circuit-breaker/types.ts` - Circuit breaker type definitions
- `src/lib/circuit-breaker/breaker.ts` - Circuit breaker state machine
- `src/lib/circuit-breaker/breaker.test.ts` - Breaker tests (99 tests passing)
- `src/lib/circuit-breaker/alerting.ts` - Mission Control alerting
- `src/lib/circuit-breaker/alerting.test.ts` - Alerting tests
- `src/lib/circuit-breaker/manager.ts` - Breaker manager with reset mechanisms
- `src/lib/circuit-breaker/manager.test.ts` - Manager tests
- `src/lib/circuit-breaker/index.ts` - Public API exports

### Implementation Summary

**AC1: Circuit Breaker Trips on Error Threshold**
- Three-state machine: CLOSED → OPEN → HALF_OPEN → CLOSED
- Configurable error thresholds: consecutive errors (default 5) and error rate (default 50%)
- State transitions logged with full context
- Calls rejected when breaker is OPEN
- Automatic HALF_OPEN testing after configurable timeout (default 60s)

**AC2: Alerting and Logging**
- Trip events create Mission Control alerts with severity (warning/critical)
- Alerts include full context: breaker name, group ID, error count, error rate, last error
- PostgreSQL event logging for audit trail (circuit_breaker_trip, circuit_breaker_reset)
- Callback system for extensible alert handling
- Alert queue with acknowledgment tracking

**AC3: Manual and Automatic Reset**
- Manual reset with operator attribution and justification
- Health check validation before reset (optional)
- Force reset bypass for emergency situations
- Configurable success threshold for HALF_OPEN → CLOSED transition
- Complete reset event logging with operator tracking

**Integration Points**
- `BreakerManager` singleton for centralized breaker management
- Integration with Policy Gateway for tool call interception
- Per-tenant isolation via group_id
- Configurable health check functions for recovery validation