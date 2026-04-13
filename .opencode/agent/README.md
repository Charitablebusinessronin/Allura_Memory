# Agent Directory

This directory is the canonical home for OpenCode agent definitions in this repo.

## Layout

```
.opencode/agent/
├── core/
│   ├── brooks-architect.md
│   └── jobs-intent-gate.md
└── subagents/
    ├── core/
    │   ├── scout-recon.md
    │   ├── fowler-refactor-gate.md
    │   └── pike-interface-review.md
    ├── code/
    │   ├── bellard-diagnostics-perf.md
    │   └── woz-builder.md
    └── development/
        └── hightower-devops.md
```

## Rules

1. Edit agent definitions here.
2. Do not recreate `.opencode/agents/` as a second live source.
3. Ralph is a tool integration, not an agent file.
4. Hightower is the DevOps/infrastructure specialist (replaces OpenDevopsSpecialist).