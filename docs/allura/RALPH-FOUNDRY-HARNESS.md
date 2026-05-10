# Ralph Foundry Harness

> [!NOTE]
> **AI-Assisted Documentation**
> Portions of this document were drafted with the assistance of an AI language model.
> Content has not yet been fully reviewed — this is a working design reference, not a final specification.
> AI-generated content may contain inaccuracies or omissions.
> When in doubt, defer to the source code, JSON schemas, and team consensus.

Ralph Foundry is the minimum contract layer for running one bounded Ralph loop from a planning story to evidence and learning. It does not replace the existing Ralph command or harness contracts; it gives each run a manifest, append-only run events, and a terminal result.

## Relationship to Existing Contracts

- [`.opencode/contracts/harness-v1.md`](../../.opencode/contracts/harness-v1.md) defines DAY_BUILD/NIGHT_BUILD routing, agent-level events, and documentation compliance.
- [`.opencode/contracts/ralph-integration.md`](../../.opencode/contracts/ralph-integration.md) defines when Ralph is appropriate and how it integrates with the harness.
- [`.opencode/command/ralph.md`](../../.opencode/command/ralph.md) remains the execution command surface.
- [RALPH-FOUNDRY-AUTO-LOOP.md](./RALPH-FOUNDRY-AUTO-LOOP.md) defines the goal-level controller above repeated bounded runs.

Foundry wraps those contracts with run-level artifacts. It does not supersede them in v0.1. Team-Gated Autonomous goal loops are a scoped extension above this run contract, not a replacement for the single-run contract.

## Contract Source of Truth

The source-of-truth hierarchy is:

1. JSON schemas for contract shape.
2. Code that implements the schemas.
3. [BLUEPRINT.md](./BLUEPRINT.md) for design intent.
4. Documentation for explanation and governance.

The v0.1 schemas are:

- [ralph-foundry-run-manifest.schema.json](../../json-schema/ralph-foundry-run-manifest.schema.json)
- [ralph-foundry-run-log-event.schema.json](../../json-schema/ralph-foundry-run-log-event.schema.json)
- [ralph-foundry-run-result.schema.json](../../json-schema/ralph-foundry-run-result.schema.json)
- [ralph-foundry-goal-manifest.schema.json](../../json-schema/ralph-foundry-goal-manifest.schema.json)
- [ralph-foundry-goal-result.schema.json](../../json-schema/ralph-foundry-goal-result.schema.json)

## Event Taxonomy Boundary

Harness events are agent-level. Foundry events are run-level. No 1:1 semantic mapping is implied.

Foundry events are written to `.ralph-runs/<runId>/events.jsonl`. They are documentation/runtime artifacts for the Ralph run, not a second PostgreSQL event taxonomy in v0.1. Harness events remain governed by `harness-v1.md` and the PostgreSQL `events` table.

## Loop Contract

```text
run manifest
  -> bounded Ralph execution
  -> append-only run events
  -> terminal run result
  -> learning captured to Allura Brain
```

Each run starts with a manifest, records progress as run-level events, and ends with exactly one terminal result.

## Modes

- `dry-run`: validates the contract flow, context, DoD, and validation commands without intentionally changing application code.
- `real-execution`: executes a bounded story with human-in-the-loop gating for validation evidence, consistent with AD-11 in [RISKS-AND-DECISIONS.md](./RISKS-AND-DECISIONS.md). When a run is a child of a Team-Gated Autonomous goal loop, AD-32 scopes routine approval to Team RAM internal gates instead.

Ralph command modes such as `plan`, `build`, and `plan-work` remain in `.opencode/command/ralph.md`. Foundry `mode` is a run contract property, not a new command family.

## Evidence Rules

- `executed` and `failed` results require non-empty evidence.
- `blocked` and `cancelled` results require a summary and may omit evidence.
- Validation command output, review notes, or artifact paths are valid evidence references.

## Self-Improvement

After each run, the orchestrator writes a concise learning to Allura Brain. The learning should capture what worked, what failed, and what to change before the next run.

## Notion Bridge

Notion remains the planning and architecture source of truth. v0.1 uses a manual bridge: the operator may place a story page URL in `extensions.notionPageUrl` inside the run manifest. Automated Notion sync is explicitly deferred.

## Artifact Layout

```text
.ralph-runs/<runId>/
  manifest.json
  events.jsonl
  result.json
```

The first dry-run artifact set lives under `.ralph-runs/rf-001/`. v0.1 does not introduce a new runtime event plane; these files remain local run artifacts and are not PostgreSQL event types.

## Governance Integration

### Canonical Placement and Naming

The harness document lives in `docs/allura/` because it defines project architecture. Schemas live in `json-schema/` because schemas are canonical contract surfaces. Examples and operator aids live under `.opencode/ralph-foundry/`.

### Existing Contract Compatibility

Foundry extends the existing harness and Ralph integration contracts with run-level artifacts. It does not rename or replace existing agent-level events.

### AI Guidelines Compliance Gate

Before this harness is considered viable, the reviewer must verify:

- AI disclosure notices are present on new Markdown docs.
- [RISKS-AND-DECISIONS.md](./RISKS-AND-DECISIONS.md) includes the Foundry AD/RK entries.
- [REQUIREMENTS-MATRIX.md](./REQUIREMENTS-MATRIX.md) traces Foundry requirements.
- [DATA-DICTIONARY.md](./DATA-DICTIONARY.md) defines Foundry fields and schema references.
- No secrets, credentials, or PII appear in Foundry docs or examples.

## References

- [BLUEPRINT.md](./BLUEPRINT.md)
- [REQUIREMENTS-MATRIX.md](./REQUIREMENTS-MATRIX.md)
- [RISKS-AND-DECISIONS.md](./RISKS-AND-DECISIONS.md)
- [DATA-DICTIONARY.md](./DATA-DICTIONARY.md)
- [RALPH-FOUNDRY-AUTO-LOOP.md](./RALPH-FOUNDRY-AUTO-LOOP.md)
- [Ralph Integration Contract](../../.opencode/contracts/ralph-integration.md)
- [Harness v1 Contract](../../.opencode/contracts/harness-v1.md)
