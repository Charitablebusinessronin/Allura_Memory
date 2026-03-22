# Story 4.4: automate-the-insight-lifecycle

Status: backlog

## Story

As an AI engineering team,
I want the system to periodically review the health of insights based on confidence and age,
so that agents are not distracted by stale or discredited knowledge.

## Acceptance Criteria

1. Given versioned insights exist in Neo4j, when the cleanup query runs, then it transitions insights to degraded, expired, or superseded states according to policy.
2. Given lifecycle transitions occur, when updating states, then immutable history is preserved rather than overwriting prior knowledge states.
3. Given an insight expires, when querying for active knowledge, then the system excludes expired insights from results.

## Tasks / Subtasks

- [ ] Task 1: Design insight lifecycle states (AC: 1)
  - [ ] Define states: Active, Degraded, Expired, Superseded, Deprecated, Reverted.
  - [ ] Design state transition rules: age, confidence, manual override.
  - [ ] Define policies: auto-expire after N days, degrade if confidence drops.
- [ ] Task 2: Implement lifecycle state machine (AC: 1)
  - [ ] Add `src/lib/lifecycle/state-machine.ts` for state management.
  - [ ] Implement transition validation (allowed transitions only).
  - [ ] Support manual and automatic transitions.
  - [ ] Record transition reasons.
- [ ] Task 3: Implement lifecycle policies (AC: 1, 2)
  - [ ] Add `src/lib/lifecycle/policies.ts` for policy evaluation.
  - [ ] Evaluate age-based expiration.
  - [ ] Evaluate confidence-based degradation.
  - [ ] Support custom policies per group_id.
- [ ] Task 4: Implement history preservation (AC: 2)
  - [ ] Add `src/lib/lifecycle/history.ts` for audit trail.
  - [ ] Create state transition events as separate nodes.
  - [ ] Link transitions to triggering events.
  - [ ] Support querying full lifecycle history.
- [ ] Task 5: Add verification coverage (AC: 1, 2, 3)
  - [ ] Test state transitions follow rules.
  - [ ] Test policies trigger correct transitions.
  - [ ] Test history captures all transitions.
  - [ ] Test expired insights excluded from queries.

## Dev Notes

- FR11 requires insight lifecycle state management.
- States must be immutable - don't mutate nodes, create state events.
- Policies should be configurable: default vs custom per project.
- History preservation is critical for audit and debugging.

### Project Structure Notes

- Create `src/lib/lifecycle/` directory for lifecycle management.
- State transitions use Neo4j relationships (e.g., `[:TRANSITIONED_TO]`).
- Policies can be YAML/JSON configuration.

### References

- FR11: Insight lifecycle: `epics.md:40`
- Neo4j versioning: Story 1.3
- Epic 4 context: `_bmad-output/planning-artifacts/epics.md:459`

## Dev Agent Record

### Agent Model Used

ollama-cloud/glm-5

### Debug Log References

- Depends on: Story 1.3 (Neo4j insights)
- Neo4j container: `knowledge-neo4j`
- Status file: `_bmad-output/implementation-artifacts/sprint-status.yaml`

### Completion Notes List

- [ ] Insight lifecycle states designed
- [ ] State machine implemented
- [ ] Lifecycle policies working
- [ ] History preservation functional
- [ ] All tests passing

### File List

- `src/lib/lifecycle/state-machine.ts` - State management
- `src/lib/lifecycle/state-machine.test.ts` - State machine tests
- `src/lib/lifecycle/policies.ts` - Policy evaluation
- `src/lib/lifecycle/policies.test.ts` - Policy tests
- `src/lib/lifecycle/history.ts` - Audit trail
- `src/lib/lifecycle/history.test.ts` - History tests
- `config/lifecycle-policies.yaml` - Default policies
