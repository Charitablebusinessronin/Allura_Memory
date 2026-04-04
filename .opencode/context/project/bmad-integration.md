<!-- Context: project/bmad-integration | Priority: high | Version: 1.0 | Updated: 2026-04-03 -->

# BMad Integration

Use this file as the OpenCode routing guide for BMad workflows, documentation, and naming.

## Source Of Truth

1. Runtime-loadable skills live in `.opencode/skills/<skill>/SKILL.md`.
2. BMad source workflows, manifests, and module docs live under `_bmad/`.
3. Module capability menus live in `_bmad/*/module-help.csv`.
4. Module defaults and output paths live in `_bmad/*/config.yaml`.

Do not invent alternate skill names. Use the exact registered `bmad-*`, `wds-*`, and `bmad-testarch-*` names.

## Workflow Routing

- Core writing and review utilities: `_bmad/core/`
- BMad Builder setup and workflow/agent builders: `_bmad/bmb/`
- Product, planning, architecture, story, and implementation workflows: `_bmad/bmm/`
- Test architecture and QA workflows: `_bmad/tea/`
- WDS discovery, UX, design system, and product evolution workflows: `_bmad/wds/`

## Documentation Lookup Order

1. Read the relevant `_bmad/*/module-help.csv` entry to identify the exact workflow or agent.
2. Read `_bmad/*/config.yaml` to understand project-specific output folders and defaults.
3. Read the matching `_bmad/**/SKILL.md`, `workflow.md`, `workflow.yaml`, or referenced step files.
4. Load the runtime skill from `.opencode/skills/` when execution requires the OpenCode `skill` tool.

## Canonical OpenCode Agent Names

### Primary Agents

- `memory-orchestrator` -> `.opencode/agent/core/openagent.md` (Brooks-bound primary orchestrator and planner)
- `memory-architect` -> `.opencode/agent/core/opencoder.md`
- `roninmemory-project` -> compatibility alias for `memory-orchestrator`

### Subagents

- `memory-scout` -> `.opencode/agent/subagents/core/contextscout.md`
- `memory-archivist` -> `.opencode/agent/subagents/core/externalscout.md`
- `memory-curator` -> `.opencode/agent/subagents/core/task-manager.md`
- `memory-chronicler` -> `.opencode/agent/subagents/core/documentation.md`
- `memory-builder` -> `.opencode/agent/subagents/code/coder-agent.md`
- `memory-tester` -> `.opencode/agent/subagents/code/test-engineer.md`
- `memory-guardian` -> `.opencode/agent/subagents/code/reviewer.md`
- `memory-validator` -> `.opencode/agent/subagents/code/build-agent.md`
- `memory-organizer` -> `.opencode/agent/subagents/system-builder/context-organizer.md`
- `memory-interface` -> `.opencode/agent/subagents/development/frontend-specialist.md`
- `memory-infrastructure` -> `.opencode/agent/subagents/development/devops-specialist.md`

Prefer the canonical `memory-*` names in prompts, docs, and configuration.

## BMad Persona Map

- `bmad-agent-analyst` -> Mary
- `bmad-agent-architect` -> Winston
- `bmad-agent-pm` -> John
- `bmad-agent-sm` -> Bob
- `bmad-agent-dev` -> Amelia
- `bmad-agent-qa` -> Quinn
- `bmad-agent-tech-writer` -> Paige
- `bmad-agent-ux-designer` -> Sally
- `bmad-agent-quick-flow-solo-dev` -> Barry
- `bmad-tea` -> Murat
- `wds-agent-saga-analyst` -> Saga
- `wds-agent-freya-ux` -> Freya

When WDS is installed, prefer `wds-agent-saga-analyst` over Mary for WDS discovery and `wds-agent-freya-ux` over Sally for WDS UX and design work.

## Practical Rules

- For strategy, requirements, architecture, implementation, or sprint workflows, route to BMad skills before inventing a custom process.
- For testing strategy or automation workflows, prefer TEA skills.
- For UX or design-system work, prefer WDS workflows when they match the request.
- Keep OpenCode prompts and metadata aligned to the canonical names above.

## Orchestration Model

- `memory-orchestrator` is the primary Brooks-bound planner and governor.
- `memory-*` subagents remain the execution layer.
- `bmad-party-mode` is an optional collaboration path for multi-agent discussion, not a replacement for subagent delegation.
- Memory hydration should load both project-scoped and global patterns before orchestration.

## Custom BMad Manifest Bridge

The roninmemory custom agents are bridged to BMad discovery through manifest files in `_bmad/_config/custom/`.

### Bridge Files

1. **Agent Manifest**: `_bmad/_config/custom/agent-manifest.csv`
   - Maps 13 custom agents (2 primary + 11 subagents)
   - Includes Brooksian principles and surgical team roles
   - References `.opencode/agent/` paths

2. **Skill Manifest**: `_bmad/_config/custom/skill-manifest.csv`
   - Maps 10 custom memory-aware skills
   - Includes bootstrap, query, log, orchestrate, plan, build, test, review, validate
   - References `.opencode/skills/` paths

3. **Help Manifest**: `_bmad/_config/custom/bmad-help.csv`
   - Provides BMad-style help entries for custom capabilities
   - Enables discovery through `_bmad/<module>/module-help.csv` pattern

4. **Module Config**: `_bmad/_config/custom/config.yaml`
   - Defines the `roninmemory` module
   - Maps agent and skill paths
   - Configures hybrid mode settings

### Hybrid Mode Benefits

- **Agents live in `.opencode/agent/`** — Standard OpenCode location
- **BMad discovers via manifests** — Integration without duplication
- **Skills remain in `.opencode/skills/`** — Runtime-loadable by OpenCode
- **Clear separation of concerns** — BMad for discovery, OpenCode for execution

### Memory System Configuration

The custom module config includes:

- **PostgreSQL**: Enabled for raw traces (`DATABASE_URL`)
- **Neo4j**: Enabled for curated knowledge (`NEO4J_URI`)
- **Steel Frame**: Enabled with `SUPERSEDES` pattern
- **HITL**: Enabled, required for knowledge promotion
