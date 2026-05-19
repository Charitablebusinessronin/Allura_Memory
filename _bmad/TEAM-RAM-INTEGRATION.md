# Team RAM BMAD Integration

This document maps the live Team RAM agents into the BMAD planning and execution model.

The source of truth for live agent definitions remains:

```text
.opencode/agent/
```

BMAD consumes this file as the planning roster and workflow bridge. It does not replace the OpenCode agent definitions.

## Operating Model

```text
Intent -> Architecture -> Scout -> Skills -> Build -> Review -> Memory Log
```

Plain English:

- Jobs clarifies what the work is really trying to accomplish.
- Brooks protects architecture and decides the shape of the work.
- Scout loads repository context and Allura Brain memory.
- Woz builds the implementation.
- Pike, Fowler, Knuth, Hightower, Bellard, or Carmack review when their specialty applies.
- Allura Brain stores the result as governed memory.

## Required Gates

| Gate | Owner | Required Output |
| --- | --- | --- |
| Intent Gate | Jobs | Objective, scope, acceptance criteria |
| Architecture Gate | Brooks | Plan, contracts, invariants, routing |
| Context Gate | Scout | Scout Report with local context and memory context |
| Skill Gate | Scout + Brooks | Required skills identified before build |
| Build Gate | Woz | Working change or implementation packet |
| Review Gate | Pike/Fowler/specialist | Interface, refactor, data, infra, or performance review |
| Memory Gate | Scout/Brooks/Woz | Outcome logged to Allura Brain when tools are available |

## Team Roster

| BMAD Role | Team RAM Agent | Live Definition | Primary Skills |
| --- | --- | --- | --- |
| Product / Intent | Jobs | `.opencode/agent/core/jobs.md` | `allura-memory-skill`, `task-management` |
| Architect / Orchestrator | Brooks | `.opencode/agent/core/brooks.md` | `party-mode`, `mcp-harness`, `skill-creator`, `allura-memory-skill` |
| Context Scout | Scout | `.opencode/agent/subagents/core/scout.md` | `allura-memory-skill`, `multi-search`, `context7`, `mcp-docker` |
| Builder | Woz | `.opencode/agent/subagents/code/woz.md` | `frontend-craft`, `task-management`, `varlock`, `code-review` |
| Interface Reviewer | Pike | `.opencode/agent/subagents/review/pike.md` | `code-review`, `allura-memory-skill` |
| Refactor Reviewer | Fowler | `.opencode/agent/subagents/review/fowler.md` | `code-review`, `allura-memory-skill` |
| Data Architect | Knuth | `.opencode/agent/subagents/infrastructure/knuth.md` | `postgres-best-practices`, `allura-memory-skill` |
| Infrastructure | Hightower | `.opencode/agent/subagents/infrastructure/hightower.md` | `mcp-docker`, `mcp-harness`, `varlock` |
| Diagnostics | Bellard | `.opencode/agent/subagents/code/bellard.md` | `systematic-debugging-memory`, `allura-memory-skill` |
| Performance | Carmack | `.opencode/agent/subagents/code/carmack.md` | `systematic-debugging-memory`, `allura-memory-skill` |

## BMAD Artifact Mapping

| Artifact Type | Owner | Target Location |
| --- | --- | --- |
| Product brief | Jobs + Brooks | `_bmad-output/planning-artifacts/product-brief.md` |
| PRD | Jobs + Brooks | `_bmad-output/planning-artifacts/prd.md` |
| Architecture | Brooks | `_bmad-output/planning-artifacts/architecture.md` |
| Epics | Brooks + Woz | `_bmad-output/implementation-artifacts/epics.md` |
| Stories | Woz + Scout | `_bmad-output/implementation-artifacts/stories.md` |
| Risks / decisions | Brooks + Fowler | `_bmad-output/planning-artifacts/risks-and-decisions.md` |
| Data dictionary | Knuth | `_bmad-output/planning-artifacts/data-dictionary.md` |
| Design docs | Pike + Woz | `_bmad-output/planning-artifacts/design.md` |

## Skill Rules

All agents use `allura-memory-skill` for governed memory work.

Use `bmad-agent-builder` when creating, rebuilding, or analyzing Team RAM agent skills.

Use `team-ram-cowork` when Codex/OpenCode/Claude needs to explain or operate the roleplay-based co-work model.

Use `bmad-module-builder` later if Team RAM should ship as a portable BMAD module.

## Allura Rules

Allura Brain is the memory layer. It is not a replacement for repository context or docs.

Default memory tenant:

```text
group_id: allura-system
```

Raw task outcomes are logged first. Durable project truth is promoted only through governance.

