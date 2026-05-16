# Agent Directory

This file defines the **live agent surface** for the Team RAM OpenCode Harness,
restored on the **OAC Core + Allura Overlay** architecture.

## Architecture Principle

> **OAC Core:** Context-first, plan-first, validation-first.
> **Allura Overlay:** Team RAM personas, Brain memory, governance, HITL, Brooks orchestration.
> **Memory supplements context; it does not replace it.**

## Canonical Rule

The nested files in `.opencode/agent/` are the only live agent definitions in this repo.
Structure follows the OAC Core pattern: `core/` for primary orchestrators, `subagents/` for
delegated specialists grouped by domain.

```text
.opencode/agent/
├── core/                          ← Primary orchestrators (mode: primary)
│   ├── brooks.md                  ← Architect + Orchestrator
│   └── jobs.md                    ← Intent Gate
│
└── subagents/                     ← Delegated specialists (mode: subagent)
    ├── code/                      ← Domain: coding & implementation
    │   ├── woz.md                 ← Primary builder
    │   ├── bellard.md             ← Diagnostics + perf
    │   └── carmack.md             ← Performance & optimization
    │
    ├── core/                      ← Domain: cross-cutting services
    │   └── scout.md               ← Recon + discovery (ContextScout)
    │
    ├── review/                    ← Domain: quality gates
    │   ├── pike.md                ← Interface review
    │   └── fowler.md              ← Refactor gate
    │
    └── infrastructure/            ← Domain: infra & data
        ├── knuth.md               ← Data architect
        └── hightower.md           ← DevOps
```

## ContextScout First Gate (MANDATORY)

Every implementation task must follow this execution sequence:

```
User task
  ↓
① Scout loads local .opencode/context files
  ↓
② Scout searches Allura Brain for prior decisions/blockers
  ↓
③ Skill resolver identifies required skills
  ↓
④ Builder executes with loaded context + skills
  ↓
⑤ Validation passes before done
```

**No agent may skip step ①.** Ralph, Woz, and all builders must have Scout context
loaded before writing implementation code.

## Ralph Skill Gate (MANDATORY)

Ralph may not execute unless this gate passes:

```json
{
  "context_loaded": true,
  "context_files": [],
  "brain_memories_checked": true,
  "required_skills": [],
  "skills_loaded": [],
  "validation_commands": []
}
```

**Failure conditions (Ralph MUST refuse):**
- No Scout context loaded
- Missing required skill
- Stale context without acknowledgment
- Missing validation command

## Team RAM

| Agent | Persona | Role | Path |
| --- | --- | --- | --- |
| Brooks | Frederick P. Brooks Jr. | Architecture and orchestration | `core/` |
| Jobs | Steve Jobs | Intent gate and scope owner | `core/` |
| Woz | Steve Wozniak | Primary builder | `subagents/code/` |
| Bellard | Fabrice Bellard | Deep diagnostics | `subagents/code/` |
| Carmack | John Carmack | Performance | `subagents/code/` |
| Scout | Utility role | Discovery and recon (ContextScout) | `subagents/core/` |
| Pike | Rob Pike | Interface simplicity | `subagents/review/` |
| Fowler | Martin Fowler | Refactor safety | `subagents/review/` |
| Knuth | Donald Knuth | Data and schema | `subagents/infrastructure/` |
| Hightower | Kelsey Hightower | Infra and deployment | `subagents/infrastructure/` |

## Team RAM as Overlay

Team RAM personas consume OAC context — they do not replace it.

- **Brooks** = architecture/orchestration (consumes context/system/, context/workflows/)
- **Scout** = ContextScout + Brain retrieval (consumes context/core/, Brain search)
- **Woz** = builder (consumes context/development/, standards/)
- **Pike** = interface review (consumes context/ui/, design-systems/)
- **Fowler** = refactor gate (consumes context/core/workflows/code-review/)
- **Knuth** = data/schema (consumes context/development/data/)
- **Hightower** = infra (consumes context/development/infrastructure/)
- **Bellard/Carmack** = diagnostics/performance (consumes context/core/standards/)

## Skill Assignment Matrix

| Owner / Path | Required skills | Optional / routed skills | Notes |
| --- | --- | --- | --- |
| All agents | `allura-memory-skill` | `systematic-debugging`, `code-review` | Memory governance is mandatory. |
| Brooks | `party-mode`, `skill-creator`, `mcp-harness` | `task-creator`, UI/design skills for routing | Brooks orchestrates; he routes, doesn't hoard. |
| Scout | `allura-memory-skill`, `multi-search`, `perplexica-mcp`, `mcp-docker` | `context7` via MCP Docker | Scout owns Brain/search recon and context discovery. |
| Woz | `frontend-craft`, `shadcn`, `task-management`, `varlock`, `code-review` | `frontend-design` when implementing approved UI | Woz builds with loaded context. |
| Design/UI path | `frontend-design`, `frontend-craft`, `allura-design`, `huashu-design`, `shadcn` | `allura-memory-skill` for brand/context | Applies to UI/design agents. |
| Hightower | `mcp-docker`, `mcp-harness`, `varlock` | `perplexica-mcp` for infra research | Hightower owns deployability and secrets. |

## Execution Rule

**Scout before build. Skills before Ralph. Validate before done.**

## Codex Invocation Gate (MANDATORY)

Codex must run this gate before answering or routing when Ronin invokes Brooks,
Team RAM, Allura, Scout, Woz, Ralph, memory work, architecture work, debugging,
or project-status work.

Codex treats `.opencode/agent/core/brooks.md` as the canonical Brooks behavior.
`.codex/agents/brooks.toml` is only the Codex adapter for that behavior.

Required startup order:

```text
Brooks/Team RAM invoked
  ↓
Apply team-ram-cowork
  ↓
Apply allura-memory-skill
  ↓
Scout local context hydration
  ↓
Allura Brain search with group_id = allura-system
  ↓
RuVix governance receipt
  ↓
Brooks route / answer / build plan
```

Before Brooks answers, Codex must show this receipt shape:

```text
Brooks active.
Skills: team-ram-cowork, allura-memory-skill, <task skills>
Scout hydration:
- Local context: <files checked>
- Brain: <query, group_id, status>
RuVix:
- mutate: <intent/no mutation>
- attest: <evidence>
- verify: <validation path>
- isolate: <group_id/project boundary>
- sandbox: <safe tool path>
- audit: <logging plan>
Route:
- <Brooks decision>
```

RuVix is not optional. The receipt must explicitly cover `mutate`, `attest`,
`verify`, `isolate`, `sandbox`, and `audit`.

Memory claims require real MCP receipts. If Allura Brain tools are unavailable,
Codex must say that plainly and continue with local context only. Codex may say
"Brooks active" only as the repo role chair; it must not claim Scout, Woz,
OpenCode, OpenClaw, Claude, or any runtime subagent actually ran unless a real
tool or subagent invocation happened.

## Team RAM Runtime Bridge

Codex, OpenCode, and Claude do not load agents the same way. This repo bridges
them through `.agents/TEAM-RAM-RUNTIME.md`.

If the user invokes Brooks, Scout, Woz, Team RAM, Ralph, or Allura project work:

```text
Scout → Allura Brain → Skills → Brooks route → Build/review → Log outcome
```

Expected behavior:

- Say which role is active.
- Use `allura-memory-skill` for governed memory work.
- Scout loads local context and searches Allura Brain with `group_id: allura-system`.
- Brooks summarizes status and routes work.
- Woz builds only after Scout context and skills are loaded.
- Important outcomes are logged back to Allura Brain.

## Development Readiness

Before feature development, use `.opencode/DEVELOPMENT-READINESS.md`.

The short gate is:

```text
Brain running → MCP reachable → Scout context loaded → skills resolved → validation chosen
```

## Source of Truth

- `.opencode/manifest.json` — Machine-readable architecture manifest
- `.opencode/SKILL-OWNERSHIP.md` — Skill ownership matrix
- `.opencode/config.json` — Top-level OpenCode configuration
- `.opencode/DEVELOPMENT-READINESS.md` — Pre-development readiness checklist
- `.opencode/agent/` — Active Team RAM agent definitions
- `.opencode/command/` — Reusable workflow commands
- `.opencode/skills/` — Skill definitions and supporting assets
- `.opencode/config/` — Registry and harness metadata
