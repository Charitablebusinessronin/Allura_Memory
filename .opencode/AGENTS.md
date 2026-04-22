# Agent Directory

This file defines the **live agent surface** for the Team RAM OpenCode Harness.

## Canonical Rule

The flat files in `.opencode/agent/` are the only live agent definitions in this repo.

```text
.opencode/agent/
├── brooks.md
├── jobs.md
├── woz.md
├── norvig.md
├── hassabis.md
├── scout.md
├── pike.md
├── bellard.md
├── fowler.md
├── carmack.md
├── knuth.md
├── hightower.md
├── karpathy.md
├── jim-simons.md
├── fei-fei-li-vision.md
├── sutskever.md
├── torvalds.md
└── operator.md
```

## Team RAM — Full Roster

### Original Team (Allura Brain–specific, no OMO equivalent)

| Agent | Persona | Role | OMO Equivalent |
| --- | --- | --- | --- |
| Brooks | Frederick P. Brooks Jr. | Architecture + orchestration | sisyphus |
| Jobs | Steve Jobs | Intent gate + scope owner | *(unique)* |
| Woz | Steve Wozniak | Primary builder | hephaestus |
| Pike | Rob Pike | Interface simplicity | *(unique)* |
| Bellard | Fabrice Bellard | Deep diagnostics | *(unique)* |
| Fowler | Martin Fowler | Refactor safety | *(unique)* |
| Carmack | John Carmack | Performance | *(unique)* |
| Knuth | Donald Knuth | Data + schema | *(unique)* |
| Hightower | Kelsey Hightower | Infra + deployment | *(unique)* |

### OMO-Mapped Specialists

| Agent | Persona | Role | OMO Equivalent |
| --- | --- | --- | --- |
| Scout | Utility | Recon + discovery | explore |
| Norvig | Peter Norvig | Reasoning + planning | prometheus |
| Hassabis | Demis Hassabis | Context + big picture | atlas |
| Karpathy | Andrej Karpathy | Knowledge + AI expertise | oracle |
| Jim Simons | Jim Simons | Memory + data patterns | librarian |
| Fei-Fei Li Vision | Fei-Fei Li | Vision + multimodal | multimodal-looker |
| Sutskever | Ilya Sutskever | Strategy + alignment | metis |
| Torvalds | Linus Torvalds | Critique + validation | momus |
| Operator | *(none)* | Subtask helper | sisyphus-junior |

## OMO Mapping

The OMO→Team RAM mapping is defined in `.opencode/config/omo-mapping.json`.
The OMO framework provides the base capability model; all naming, routing, and behavior is project-scoped.

## Legacy Rule

Nested agent files under `agent/core/` and `agent/subagents/` are legacy reference material unless explicitly revived.