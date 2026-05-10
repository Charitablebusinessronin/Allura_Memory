# Ralph Foundry Getting Started

> [!NOTE]
> **AI-Assisted Documentation**
> Portions of this document were drafted with the assistance of an AI language model.
> Content has not yet been fully reviewed — this is a working design reference, not a final specification.
> AI-generated content may contain inaccuracies or omissions.
> When in doubt, defer to the source code, JSON schemas, and team consensus.

Ralph Foundry provides a small contract for running one bounded Ralph loop with a manifest, run log, and terminal result.

## Prerequisites

- OpenCode project context loaded.
- Ralph command available through [`.opencode/command/ralph.md`](../command/ralph.md).
- Allura Brain memory tools available for post-run learning capture.
- Project validation commands available, especially `bun run typecheck`.

## Validate the Contract Files

```bash
python3 -m json.tool json-schema/ralph-foundry-run-manifest.schema.json >/dev/null
python3 -m json.tool json-schema/ralph-foundry-run-log-event.schema.json >/dev/null
python3 -m json.tool json-schema/ralph-foundry-run-result.schema.json >/dev/null
python3 -m json.tool json-schema/ralph-foundry-goal-manifest.schema.json >/dev/null
python3 -m json.tool json-schema/ralph-foundry-goal-result.schema.json >/dev/null
python3 -m json.tool .opencode/ralph-foundry/examples/run-manifest.example.json >/dev/null
python3 -m json.tool .opencode/ralph-foundry/examples/goal-manifest.example.json >/dev/null
```

These commands verify JSON syntax for the contract files. Full JSON Schema validation is a future automation slice; until then, Knuth review remains the schema gate.

## Dry-Run Flow

1. Copy [run-manifest.example.json](./examples/run-manifest.example.json).
2. Replace `runId`, `epicRef`, `storyRef`, `goal`, `dod`, and `validationCommands`.
3. Run the selected validation commands manually.
4. Record run-level events under `.ralph-runs/<runId>/events.jsonl` when runtime support exists.
5. Write the learning to Allura Brain after review.

See [RALPH-FOUNDRY-HARNESS.md](../../docs/allura/RALPH-FOUNDRY-HARNESS.md) for governance rules.

## Autonomous Goal Flow

1. Copy [goal-manifest.example.json](./examples/goal-manifest.example.json).
2. Replace `goalId`, `goal`, `sourceRef`, `successCriteria`, path boundaries, and validation commands.
3. Confirm `stopConditions` contains the full required hard-stop set.
4. Run `ralph-goal run <goal-manifest-path>` only after the goal gate passes.
5. Stop immediately if a blocked path, deploy action, secret, destructive action, unavailable validation, or architecture decision is encountered.

See [RALPH-FOUNDRY-AUTO-LOOP.md](../../docs/allura/RALPH-FOUNDRY-AUTO-LOOP.md) for the Team-Gated Autonomous controller.
