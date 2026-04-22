# Agent Directory

This file defines the **live agent surface** for the Team RAM OpenCode Harness.

## Canonical Rule

The flat files in `.opencode/agent/` are the only live agent definitions in this repo.

```text
.opencode/agent/
├── brooks.md
├── jobs.md
├── woz.md
├── scout.md
├── pike.md
├── fowler.md
├── bellard.md
├── carmack.md
├── knuth.md
└── hightower.md
```

## Team RAM

| Agent | Persona | Role |
| --- | --- | --- |
| Brooks | Frederick P. Brooks Jr. | Architecture and orchestration |
| Jobs | Steve Jobs | Intent gate and scope owner |
| Woz | Steve Wozniak | Primary builder |
| Scout | Utility role | Discovery and recon |
| Pike | Rob Pike | Interface simplicity |
| Fowler | Martin Fowler | Refactor safety |
| Bellard | Fabrice Bellard | Deep diagnostics |
| Carmack | John Carmack | Performance |
| Knuth | Donald Knuth | Data and schema |
| Hightower | Kelsey Hightower | Infra and deployment |

## Legacy Rule

Nested agent files under `agent/core/` and `agent/subagents/` are legacy reference material unless explicitly revived.

They are **not** the active harness surface.

## Editing Rules

1. Edit live agent behavior in `.opencode/agent/*.md`.
2. Do not treat nested legacy agent files as active.
3. Do not create a second live naming scheme.
4. Team RAM names are the public surface of the harness.
5. Every live agent file must include an instruction boundary.
