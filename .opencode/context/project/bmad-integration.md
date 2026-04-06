<!-- Context: project/bmad-integration | Priority: high | Version: 2.0 | Updated: 2026-04-04 -->

# BMad Integration

Use this file as the OpenCode routing guide for BMad workflows, documentation, and naming.

## Two Worlds Model

> **Crystal Clear Distinction**
> - **OpenCode CLI Agents** (`.opencode/agent/`) = Memory{Role} - Winston's hands
> - **Org/Business Agents** (Paperclip) = {org}-agent - Digital employees

This file documents ONLY the OpenCode CLI agents (7 Memory{Role} agents).

## Source Of Truth

1. Runtime-loadable skills live in `.opencode/skills/<skill>/SKILL.md`.
2. BMad source workflows, manifests, and module docs live under `_bmad/`.
3. Module capability menus live in `_bmad/*/module-help.csv`.
4. Module defaults and output paths live in `_bmad/*/config.yaml`.

Do not invent alternate skill names. Use the exact registered `bmad-*`, `wds-*`, and `bmad-testarch-*` names.

## Canonical OpenCode Agent Names (7 Agents)

### Primary Agents (OpenCode CLI Only) - The Surgical Team

| Name | Path | Role | Status |
|------|------|------|--------|
| `MemoryOrchestrator` | `.opencode/agent/core/openagent.md` | Brooks-bound chief surgeon | ✅ Active |
| `MemoryArchitect` | `.opencode/agent/core/MemoryArchitect.md` | First Assistant - Design | ✅ Active |
| `MemoryBuilder` | `.opencode/agent/core/MemoryBuilder.md` | Builder - Implementation | ✅ Active |
| `MemoryGuardian` | `.opencode/agent/subagents/code/reviewer.md` | Inspector - Validation | ✅ Active |
| `MemoryScout` | `.opencode/agent/subagents/core/contextscout.md` | Scout - Discovery | ✅ Active |
| `MemoryAnalyst` | `.opencode/agent/core/MemoryAnalyst.md` | Analyst - Metrics | ✅ Active |
| `MemoryChronicler` | `.opencode/agent/subagents/core/documentation.md` | Chronicler - Documentation | ✅ Active |

### Archived Agents (Inactive)

| Name | Path | Reason |
|------|------|--------|
| `MemoryCopywriter` | `.opencode/agent/archive/MemoryCopywriter.md` | Consolidated into MemoryChronicler |
| `MemoryRepoManager` | `.opencode/agent/archive/MemoryRepoManager.md` | Git handled by MemoryBuilder |
| `MemoryScribe` | `.opencode/agent/archive/MemoryScribe.md` | Consolidated into MemoryChronicler |

**Note**: These are Winston's hands - how YOU work in OpenCode CLI.

### Org/Business Agents (NOT in .opencode/)

These are digital employees that work FOR clients/orgs:
- `faithmeats-agent` → Runs Faith Meats ops (Paperclip)
- `audits-agent` → Runs mortgage audit checks (Paperclip)
- `crm-agent` → Manages CRM workflows (Paperclip)
- `nonprofit-agent` → Handles grant/donor comms (Paperclip)

**Blocked on**: `groupIdEnforcer.ts` fix

## BMad Persona Map

- `MemoryOrchestrator` → Winston (primary)
- `MemoryArchitect` → Winston (design)
- `MemoryBuilder` → Amelia (implementation)
- `MemoryGuardian` → Quinn (validation)
- `MemoryScout` → Discovery (exempt from approval)
- `MemoryAnalyst` → Metrics (read-only)
- `MemoryChronicler` → Paige (documentation)

## Practical Rules

- For strategy, requirements, architecture, implementation, or sprint workflows, route to BMad skills before inventing a custom process.
- For testing strategy or automation workflows, prefer TEA skills.
- For UX or design-system work, prefer WDS workflows when they match the request.
- Keep OpenCode prompts and metadata aligned to the canonical `Memory{Role}` names above.
- **Never confuse OpenCode agents with Org agents** - they are separate worlds.

## Orchestration Model

- `MemoryOrchestrator` is the primary Brooks-bound planner and governor.
- BMad skills provide workflow orchestration patterns.
- `bmad-party-mode` is an optional collaboration path for multi-agent discussion, not a replacement for subagent delegation.
- Memory hydration should load both project-scoped and global patterns before orchestration.

## Memory System Configuration

All 7 agents use:
- **PostgreSQL**: Raw traces (`DATABASE_URL`)
- **Neo4j**: Curated knowledge (`NEO4J_URI`)
- **Steel Frame**: Enabled with `SUPERSEDES` pattern
- **HITL**: Enabled, required for knowledge promotion
- **behavior_lock**: `"UNPROMOTED"` sentinel value