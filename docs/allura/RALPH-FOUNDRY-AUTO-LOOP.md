# Ralph Foundry Auto Loop

> [!NOTE]
> **AI-Assisted Documentation**
> Portions of this document were drafted with the assistance of an AI language model.
> Content has not yet been fully reviewed — this is a working design reference, not a final specification.
> AI-generated content may contain inaccuracies or omissions.
> When in doubt, defer to the source code, JSON schemas, and team consensus.

Ralph Foundry Auto Loop is the goal-level controller above one bounded Ralph Foundry run. It converts a planning goal into repeated run manifests, executes the most useful next proving slice, records evidence, and writes learning back to Allura Brain until the goal is achieved or a hard stop condition fires.

The recommended autonomy mode is **Team-Gated Autonomous**: no routine human approval between runs, but Team RAM internal gates control scope, quality, and learning. This is not a no-brakes loop. It is a surgical team loop.

## Relationship to Existing Contracts

- [RALPH-FOUNDRY-HARNESS.md](./RALPH-FOUNDRY-HARNESS.md) defines one bounded run.
- [ralph-foundry-run-manifest.schema.json](../../json-schema/ralph-foundry-run-manifest.schema.json), [ralph-foundry-run-log-event.schema.json](../../json-schema/ralph-foundry-run-log-event.schema.json), and [ralph-foundry-run-result.schema.json](../../json-schema/ralph-foundry-run-result.schema.json) remain the source of truth for run-level artifacts.
- [ralph-foundry-goal-manifest.schema.json](../../json-schema/ralph-foundry-goal-manifest.schema.json) and [ralph-foundry-goal-result.schema.json](../../json-schema/ralph-foundry-goal-result.schema.json) define the goal-level controller contract.
- [`.opencode/command/ralph.md`](../../.opencode/command/ralph.md) remains the single-run command surface.
- [`.opencode/command/ralph-goal.md`](../../.opencode/command/ralph-goal.md) defines the autonomous goal-loop command surface.

## Contract Source of Truth

The source-of-truth hierarchy is unchanged:

1. JSON schemas for contract shape.
2. Code or command files that implement the schemas.
3. [BLUEPRINT.md](./BLUEPRINT.md) for design intent.
4. Documentation for explanation and governance.

## Loop Contract

```text
goal manifest
  -> Scout context and Brain hydration
  -> judge selects next bounded run
  -> Woz executes run manifest
  -> specialist gate reviews relevant risk
  -> run result and events are written
  -> learning is written to Allura Brain
  -> judge decides continue / redirect / stop
  -> terminal goal result
```

The loop may continue without human approval only while it remains inside the goal manifest's path boundaries, validation commands remain available, and Team RAM or control gates do not identify a hard stop. Blocked paths take precedence over allowed paths.

## Team RAM Gates

| Gate | Responsibility | Stop Power |
|------|----------------|------------|
| Scout | Load local context, search Allura Brain, identify prior blockers and contracts. | Stops if context is stale or missing. |
| Woz | Execute the bounded implementation or documentation slice. | Stops if implementation cannot be completed cleanly. |
| Pike | Review interface and command surface simplicity. | Stops on unclear contracts or surface-area sprawl. |
| Fowler | Review maintainability, reversibility, and refactor safety. | Stops on accidental complexity or unsafe refactor. |
| Knuth | Review schemas, data contracts, and traceability. | Stops on schema drift or data ambiguity. |
| Hightower | Review runtime, deployability, secrets, and destructive action risk. | Stops on secret, deploy, or destructive action requirement. |
| Bellard/Carmack | Review diagnostics or performance only when relevant. | Stops on unmeasured performance claims. |
| Judge | Non-agent control phase owned by Brooks/Jobs. Decide whether evidence proves progress and select the next run. | Stops on repeated failure, objective ambiguity, or architecture decision need. |
| Learning | Non-agent control phase. Write concise outcomes to Allura Brain and update next manifest constraints. | Stops if learning cannot be recorded. |

## Hard Stop Conditions

The goal loop stops or escalates when any of these conditions occur:

- `goal-achieved` — all success criteria are objectively met.
- `max-runs-reached` — the goal manifest's `maxRuns` limit is reached.
- `same-validation-failure-twice` — the same validation failure appears twice without new evidence.
- `three-failed-fixes-same-issue` — Brooksian rule: three failed fixes means the architecture is wrong, not the patch.
- `blocked-path-touched` — any path under `blockedPaths` is modified.
- `secret-or-destructive-action-required` — a secret, destructive command, or privileged action is needed.
- `deploy-action-required` — a local, staging, production, or external deployment action is needed.
- `architecture-decision-required` — progress requires a new ADR or contract decision.
- `validation-unavailable` — declared validation cannot be run.
- `success-criteria-not-objective` — the goal cannot be judged from observable evidence.

## Artifact Layout

```text
.ralph-runs/
  goals/
    <goalId>/
      manifest.json
      result.json
  <runId>/
    manifest.json
    events.jsonl
    result.json
```

v0.1 may create run artifacts before goal runtime automation exists. Goal artifacts are the target layout for the next runtime slice.

## Governance Integration

- Goal and run contracts are file-level artifacts, not PostgreSQL event types.
- All durable learning goes through Allura Brain with `group_id = allura-system` and the responsible agent identity.
- Notion remains the planning source of truth. v0.1 uses a manual bridge through `extensions.notionPageUrl` on both goal and run manifests.
- Human approval is not required between routine runs, but hard stops escalate rather than allowing the loop to improvise architecture, secrets, or deployment behavior.

## References

- [RALPH-FOUNDRY-HARNESS.md](./RALPH-FOUNDRY-HARNESS.md)
- [REQUIREMENTS-MATRIX.md](./REQUIREMENTS-MATRIX.md)
- [RISKS-AND-DECISIONS.md](./RISKS-AND-DECISIONS.md)
- [DATA-DICTIONARY.md](./DATA-DICTIONARY.md)
- [Ralph Integration Contract](../../.opencode/contracts/ralph-integration.md)
- [Harness v1 Contract](../../.opencode/contracts/harness-v1.md)
