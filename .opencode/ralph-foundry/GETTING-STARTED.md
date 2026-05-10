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
python3 -m json.tool .opencode/ralph-foundry/examples/run-manifest.example.json >/dev/null
```

## Dry-Run Flow

1. Copy [run-manifest.example.json](./examples/run-manifest.example.json).
2. Replace `runId`, `epicRef`, `storyRef`, `goal`, `dod`, and `validationCommands`.
3. Run the selected validation commands manually.
4. Record run-level events under `.ralph-runs/<runId>/events.jsonl` when runtime support exists.
5. Write the learning to Allura Brain after review.

See [RALPH-FOUNDRY-HARNESS.md](../../docs/allura/RALPH-FOUNDRY-HARNESS.md) for governance rules.
