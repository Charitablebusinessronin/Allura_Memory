# Story 2.3: integrate-sandboxed-execution-for-adas

Status: complete

## Story

As a security officer,
I want untrusted, model-generated candidate code to run in an isolated sandbox,
so that we prevent destructive actions during the automated search process.

## Acceptance Criteria

1. Given a model-generated agent candidate exists, when the evaluation harness runs the candidate code, then the execution occurs in a Docker container with restricted network and file access.
2. Given sandboxed execution is active, when the process exceeds safety, budget, or `Kmax` constraints, then the process is terminated.
3. Given sandboxed execution completes, when returning results, then the system captures stdout, stderr, and exit code for evaluation.

## Tasks / Subtasks

- [x] Task 1: Design sandbox environment (AC: 1)
  - [x] Define Docker container specification for agent execution.
  - [x] Configure network restrictions: no outbound internet by default.
  - [x] Configure filesystem restrictions: read-only base, ephemeral writes.
  - [x] Define resource limits: CPU, memory, disk.
- [x] Task 2: Implement sandbox execution service (AC: 1)
  - [x] Add `src/lib/adas/sandbox.ts` for Docker-based execution.
  - [x] Support running arbitrary code in isolated container.
  - [x] Mount candidate code and input data as volumes.
  - [x] Handle container lifecycle: create, start, wait, destroy.
- [x] Task 3: Implement safety and budget enforcement (AC: 2)
  - [x] Add timeout enforcement (hard limit on execution time).
  - [x] Monitor resource usage (CPU, memory) and kill if exceeded.
  - [x] Implement Kmax step counting for multi-step agents.
  - [x] Graceful termination with results capture on timeout.
- [x] Task 4: Integrate with evaluation harness (AC: 1, 3)
  - [x] Update evaluation harness to use sandbox for candidate execution.
  - [x] Capture stdout/stderr for result parsing.
  - [x] Handle exit codes: success (0), failure (non-zero), timeout (killed).
- [x] Task 5: Add verification coverage (AC: 1, 2, 3)
  - [x] Test sandbox isolates code from host system.
  - [x] Test network restrictions prevent outbound connections.
  - [x] Test timeout enforcement kills long-running processes.
  - [x] Test resource limits are enforced.

## Dev Notes

- NFR6 requires sandboxed Ubuntu Docker environments for high-risk code.
- The sandbox must be secure: no container escapes, no host access.
- Consider using gVisor or similar for additional isolation (future enhancement).
- Resource monitoring requires Docker stats API or cgroup monitoring.
- Timeout handling must be reliable - use Docker's built-in timeout or external watchdog.

### Project Structure Notes

- Extend `src/lib/adas/` with sandbox module.
- Docker integration requires dockerode or similar Node.js Docker client.
- Consider security audit of sandbox implementation.

### References

- Evaluation harness: Story 2.1
- Search loop: Story 2.2
- NFR6: Sandboxed execution: `epics.md:82`
- NFR7: Bounded autonomy: `epics.md:84`
- Epic 2 context: `_bmad-output/planning-artifacts/epics.md:295`

## Dev Agent Record

### Agent Model Used

ollama-cloud/glm-5

### Debug Log References

- Depends on: Story 2.1 (Evaluation Harness), Story 2.2 (Search Loop)
- Docker daemon must be accessible
- Status file: `_bmad-output/implementation-artifacts/sprint-status.yaml`

### Completion Notes List

- [x] Sandbox environment designed
- [x] Sandbox execution service implemented
- [x] Safety and budget enforcement working
- [x] Evaluation harness integrated with sandbox
- [x] All tests passing (178 tests)

### File List

- `src/lib/adas/sandbox.ts` - Docker sandbox execution
- `src/lib/adas/sandbox.test.ts` - Sandbox tests (20 tests)
- `src/lib/adas/safety-monitor.ts` - Resource monitoring
- `src/lib/adas/safety-monitor.test.ts` - Monitor tests (24 tests)
- `src/lib/adas/sandboxed-evaluation.ts` - Sandbox integration with evaluation harness
- `src/lib/adas/sandboxed-evaluation.test.ts` - Integration tests (17 tests)
- `docker/adas-sandbox/Dockerfile` - Sandbox container image
- `docker/adas-sandbox/runner.js` - Runner script for agent execution
- `src/lib/adas/index.ts` - Updated exports for sandbox modules
