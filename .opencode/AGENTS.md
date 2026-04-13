
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
    │   ├── carmack-performance.md
    │   ├── knuth-data-architect.md
    │   └── woz-builder.md
    └── development/
        └── hightower-devops.md
```

## Team RAM (Real Actual Masters)

| Display Name | Persona | Role |
|-------------|---------|------|
| Architect | Brooks | Orchestrator + Chief Architect |
| Gate | Jobs | Intent Gate + Scope Owner |
| Builder | Wozniak | Primary Builder |
| Performance | Carmack | Performance + Optimization |
| Diagnostics | Bellard | Deep Diagnostics + Measurement |
| Interface | Pike | Simplicity Gate |
| Refactor | Fowler | Maintainability Gate |
| Recon | Scout | Fast Discovery (read-only) |
| Data | Knuth | Data Architect + Schema Specialist |
| DevOps | Hightower | Infrastructure + Deployment |

## Rules

1. Edit agent definitions here.
2. Do not recreate `.opencode/agents/` as a second live source.
3. Ralph is a tool integration, not an agent file.
4. All agents use real-person names (Team RAM), not Greek mythology.
5. Every agent MUST have an INSTRUCTION BOUNDARY block after frontmatter.