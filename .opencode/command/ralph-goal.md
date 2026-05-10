---
description: "Ralph Foundry autonomous goal loop — Team RAM gated, self-learning execution"
allowed-tools: ["Read", "Bash", "Glob", "Grep", "Edit", "Write", "mcp__MCP_DOCKER__*", "allura-brain_memory_*"]
---

You are operating the **Ralph Foundry Goal Loop**. This command runs goal-level autonomous execution over repeated bounded Ralph Foundry runs.

## Mode: `$ARGUMENTS`

Parse the arguments. Default mode is **run**.

- `plan <goal>` — create or update a goal manifest only; do not execute runs.
- `run <goal-manifest-path>` — execute the Team-Gated Autonomous loop until success or hard stop.
- `status <goalId>` — summarize goal progress from `.ralph-runs/goals/<goalId>/` and child run artifacts.

## Required Gate Before Execution

The loop MUST NOT execute unless this gate passes:

```json
{
  "context_loaded": true,
  "brain_memories_checked": true,
  "goal_manifest_valid": true,
  "allowed_paths_declared": true,
  "blocked_paths_declared": true,
  "validation_commands_identified": true,
  "learning_writeback_available": true
}
```

On gate failure, write a terminal goal result with `status = "escalated"` or `status = "abandoned"` and stop. Escalated results must include `stopConditionHit` and non-empty `evidence` so they validate against `json-schema/ralph-foundry-goal-result.schema.json`.

## Tool Safety Preflight

Before any `Bash`, `Edit`, or `Write` action:

1. Check the target path against the goal manifest.
2. If the path matches `blockedPaths`, stop with `stopConditionHit = "blocked-path-touched"`.
3. If the path does not match `allowedPaths`, stop with `stopConditionHit = "blocked-path-touched"`.
4. If the action would read or write secrets (`.env`, credentials, tokens, private keys), stop with `stopConditionHit = "secret-or-destructive-action-required"`.
5. If the command deploys, publishes, pushes, force-pushes, deletes, resets, drops data, changes infrastructure, or mutates external services, stop with `stopConditionHit = "deploy-action-required"` or `stopConditionHit = "secret-or-destructive-action-required"`.
6. If validation commands cannot be run exactly as declared, stop with `stopConditionHit = "validation-unavailable"`.

Blocked paths take precedence over allowed paths. Paths are repo-relative normalized prefixes; absolute paths and `..` segments are invalid.

## Loop Protocol

1. Load the goal manifest and validate it against `json-schema/ralph-foundry-goal-manifest.schema.json`.
2. Dispatch Scout context loading and Allura Brain search for prior blockers, decisions, and patterns.
3. Select the smallest proving run that advances one or more success criteria.
4. Create `.ralph-runs/<runId>/manifest.json` using `ralph-foundry-run-manifest.schema.json`.
5. Execute one bounded Ralph Foundry run through the existing Ralph command contract.
6. Write append-only `.ralph-runs/<runId>/events.jsonl` entries.
7. Write `.ralph-runs/<runId>/result.json`.
8. Route relevant specialist gates:
   - Pike for interface/command surface drift.
   - Fowler for maintainability/refactor risk.
   - Knuth for schema/data contract drift.
   - Hightower for secrets/deploy/destructive action risk.
   - Bellard/Carmack for diagnostics/performance only when relevant.
9. Judge whether success criteria are met, a stop condition fired, or another run is warranted.
10. Write learning to Allura Brain after each run.
11. Continue until a terminal goal result is written.

## Hard Stops

Stop immediately on:

- `max-runs-reached`
- `same-validation-failure-twice`
- `three-failed-fixes-same-issue`
- `blocked-path-touched`
- `secret-or-destructive-action-required`
- `deploy-action-required`
- `architecture-decision-required`
- `validation-unavailable`
- `success-criteria-not-objective`

## Principle

No routine human approval is required between runs. Team RAM is the control system. Human escalation is reserved for hard stops.
