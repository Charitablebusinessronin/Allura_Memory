# Runtime Alignment Validation

## Target

Add a Runtime Alignment Validator that checks each proposed memory operation against the user’s original intent and the accumulated execution trajectory, preventing semantic drift across OpenCode and OpenClaw.

## Current State

- Agents can hydrate and write through the shared MCP memory layer.
- `group_id` is enforced at the data boundary.
- There is no explicit trajectory-level validation before high-risk actions.
- A plan can drift if intermediate steps become over-privileged or contextually unrelated.

## Desired State

- Every candidate action is compared against the original intent and prior steps.
- High-privilege or structurally risky actions require explicit justification.
- Tainted or untrusted context cannot populate critical parameters without interception.
- The validator can block, re-anchor, or request clarification before execution continues.

## User Journey

1. User asks the agent to perform a task in OpenCode.
2. The agent hydrates shared context from roninmemory through MCP.
3. The agent proposes a next step.
4. The Runtime Alignment Validator evaluates the step against:
   - original user intent
   - executed trajectory
   - `group_id` scope
   - taint state of inputs
5. If aligned, the action proceeds.
6. If misaligned, the validator blocks the action and re-anchors the plan.
7. The same behavior applies when the task continues in OpenClaw.

## Success Criteria

- No high-risk action executes without user-visible justification.
- Semantic drift is detected before state-changing operations.
- OpenCode and OpenClaw produce the same validation outcome for the same trajectory.
- Every intercepted action is explainable from the recorded intent history.

## Scope

- **Pages / Views affected:** MCP adapter layer, runtime alignment validator flow, shared memory command path
- **Components touched:** intent tracking, trajectory state, taint propagation, validator gate, memory write wrapper
- **Data changes:** none to storage model; adds validation metadata and decision logging
- **Risk level:** High (behavior change in execution gating)
