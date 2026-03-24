# Story 3.1: mediate-tool-calls-via-policy-gateway

Status: complete

## Story

As a platform owner,
I want all side-effecting tool calls to be intercepted by a mandatory policy gateway,
so that authorization and risk evaluation precede any external interaction.

## Acceptance Criteria

1. Given an agent proposes a tool call, when the action is initiated, then the gateway validates the request against typed contracts, RBAC, and security policies before execution.
2. Given a tool call is validated, when authorized, then the gateway executes the call and returns results to the agent.
3. Given unauthorized or high-risk actions, when validation fails, then the gateway blocks or routes for human approval.

## Tasks / Subtasks

- [x] Task 1: Design policy gateway architecture (AC: 1)
  - [x] Define gateway interface: intercept, validate, execute, return.
  - [x] Design policy specification format (YAML/JSON).
  - [x] Define RBAC model: roles, permissions, resource types.
- [x] Task 2: Implement policy engine (AC: 1)
  - [x] Add `src/lib/policy/engine.ts` with policy evaluation logic.
  - [x] Support allow/deny rules with conditions.
  - [x] Implement RBAC permission checking.
  - [x] Support policy composition (multiple policies applied).
- [x] Task 3: Implement tool call interception (AC: 1, 2)
  - [x] Add `src/lib/policy/gateway.ts` as mandatory interceptor.
  - [x] Wrap tool calls through gateway before execution.
  - [x] Support typed tool contracts (input/output validation).
  - [x] Pass through results from authorized calls.
- [x] Task 4: Implement approval routing (AC: 3)
  - [x] Add `src/lib/policy/approval-router.ts` for human-in-the-loop.
  - [x] Queue blocked actions for Mission Control review.
  - [x] Support approval/denial with justification.
  - [x] Resume execution after approval.
- [x] Task 5: Add verification coverage (AC: 1, 2, 3)
  - [x] Test policy engine evaluates rules correctly.
  - [x] Test RBAC permissions enforced.
  - [x] Test unauthorized calls are blocked.
  - [x] Test approval routing queues actions correctly.

## Dev Notes

- FR17 requires policy gateway mediation for all side-effecting calls.
- NFR14 requires policy checks before external interactions.
- The gateway is a critical security component - must be robust.
- Policy specifications should be human-readable and version-controlled.
- Consider policy hot-reloading without restart.

### Project Structure Notes

- Create `src/lib/policy/` directory for policy gateway code.
- Gateway wraps tool execution - all tools go through it.
- Policy files can be in `config/policies/` or similar.

### References

- FR17: Policy gateway: `epics.md:52`
- NFR14: Policy checks: `epics.md:98`
- Epic 3 context: `_bmad-output/planning-artifacts/epics.md:338`

## Dev Agent Record

### Agent Model Used

ollama-cloud/glm-5

### Debug Log References

- Depends on: Tool definitions (to be created)
- Status file: `_bmad-output/implementation-artifacts/sprint-status.yaml`

### Completion Notes List

- [x] Policy gateway architecture designed
- [x] Policy engine implemented
- [x] Tool call interception working
- [x] Approval routing functional
- [x] All tests passing (67 tests)

### File List

- `src/lib/policy/engine.ts` - Policy evaluation engine
- `src/lib/policy/engine.test.ts` - Engine tests
- `src/lib/policy/gateway.ts` - Tool call gateway
- `src/lib/policy/gateway.test.ts` - Gateway tests
- `src/lib/policy/approval-router.ts` - Human approval routing
- `src/lib/policy/approval-router.test.ts` - Router tests
- `src/lib/policy/types.ts` - Policy type definitions
- `config/policies/default.yaml` - Default policy specification
