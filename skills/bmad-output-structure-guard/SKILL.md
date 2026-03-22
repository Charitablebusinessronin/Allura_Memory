---
name: bmad-output-structure-guard
description: Enforce BMAD output file placement. Use when generating or reorganizing planning/implementation/test/ops artifacts so markdown files do not end up randomly in _bmad-output root.
---

Enforce strict `_bmad-output` placement rules.

## Rules

- Keep `_bmad-output/INDEX.md` at root.
- Place planning docs in `planning-artifacts/`.
- Place implementation docs in `implementation-artifacts/`.
- Place test evidence in `test-artifacts/`.
- Place deployment/run docs in `ops-artifacts/`.
- Do not leave random `.md` files at `_bmad-output` root.

## Execution

Run:

```bash
scripts/enforce_output_structure.sh <bmad-output-path>
```

Examples:

```bash
scripts/enforce_output_structure.sh /home/ronin704/dev/projects/openclaw/_bmad-output
scripts/enforce_output_structure.sh /home/ronin704/dev/projects/roninos/_bmad-output
```

## Classification heuristics

The script classifies markdown files by filename patterns:
- planning: `PRD`, `PLAN`, `BACKLOG`, `ARCHITECTURE`, `SPRINT`, `RISK`, `INDEX`, `README-runtime`, `RUNBOOK`, `WORKFLOW`
- implementation: `SCHEMA`, `MIGRATION`, `IMPLEMENT`, `CODE`, `MEMORY-DATABASE-LOAD`
- test: `TEST`, `EVIDENCE`, `VALIDATION`, `INCIDENT`, `QA`
- ops: `DEPLOY`, `DOCKER`, `ENV`, `OPS`

If uncertain, default to `planning-artifacts/`.
