# Ralph Foundry Contract Interoperability

> [!NOTE]
> **AI-Assisted Documentation**
> Portions of this document were drafted with the assistance of an AI language model.
> Content has not yet been fully reviewed — this is a working design reference, not a final specification.
> AI-generated content may contain inaccuracies or omissions.
> When in doubt, defer to the source code, JSON schemas, and team consensus.

This document defines the boundary between Ralph Foundry run-level artifacts and the existing harness agent-level audit trail.

## Boundary Rule

Harness events are agent-level. Foundry events are run-level. No 1:1 semantic mapping is implied.

## Foundry Run-Level Events

Foundry events describe the lifecycle of one run:

- `RUN_STARTED`
- `RUN_PROGRESS`
- `RUN_VALIDATED`
- `RUN_REVIEWED`
- `RUN_COMPLETED`

These events are written to `.ralph-runs/<runId>/events.jsonl` and validated by [`ralph-foundry-run-log-event.schema.json`](../../json-schema/ralph-foundry-run-log-event.schema.json). v0.1 defines a file artifact contract only; it does not add these event names to the PostgreSQL `events.event_type` enum.

## Harness Agent-Level Events

Harness events describe agent orchestration and audit behavior, including `TASK_START`, `TASK_COMPLETE`, `AGENT_INVOKED`, `AGENT_COMPLETED`, and `DOC_COMPLIANCE_CHECK`. They remain governed by [`harness-v1.md`](../contracts/harness-v1.md).

## Verification

A reviewer can verify the boundary by checking:

1. Foundry run logs only use the Foundry event enum.
2. Harness audit logs only use the harness event taxonomy.
3. Documentation does not claim a lossless transformation between the two.
4. No v0.1 Foundry document instructs writers to insert `RUN_*` events into PostgreSQL.

See [RALPH-FOUNDRY-HARNESS.md](../../docs/allura/RALPH-FOUNDRY-HARNESS.md) for the run contract.
