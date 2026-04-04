# Task Context: Update Core Docs - Brooks Orchestrator Model

Session ID: 2026-04-03-update-core-docs-brooks-orchestrator
Created: 2026-04-03T00:00:00Z
Completed: 2026-04-03T00:30:00Z
Status: completed

## Current Request

Update all docs in `/home/ronin704/Projects/roninmemory/docs/roninmemory/` to reflect:
- Brooks-bound orchestrator model (`memory-orchestrator` with Brooks persona)
- Canonical `memory-*` subagent naming
- Dual logging policy (PostgreSQL for events/audit, Neo4j for insights/patterns)
- Tenant boundaries (`organization_id` = business boundary, `group_id` = memory partition)
- Allura platform narrative
- Notion backend control-plane structure

## Context Files (Standards to Follow)

From prior session work:
- `_bmad/_config/ides/opencode.yaml` — OpenCode integration metadata
- `.opencode/config/agent-metadata.json` — Runtime agent metadata registry
- `.opencode/config/brooks-orchestration-sync.md` — Bridge doc
- `.opencode/config/memory-contract.md` — Memory/audit contract
- `.opencode/context/project/bmad-integration.md` — BMad routing guide
- `.opencode/README.md` — OpenCode runtime README

From AGENTS.md:
- `/home/ronin704/Projects/roninmemory/AGENTS.md`
- `/home/ronin704/Projects/roninmemory/.github/copilot-instructions.md`

## Reference Files (Source Material to Look At)

Documentation to update:
- `docs/roninmemory/PROJECT.md`
- `docs/roninmemory/SOLUTION-ARCHITECTURE.md`
- `docs/roninmemory/BLUEPRINT.md`
- `docs/roninmemory/REQUIREMENTS-MATRIX.md`
- `docs/roninmemory/RISKS-AND-DECISIONS.md`
- `docs/roninmemory/DESIGN.md`

## External Docs Fetched

None needed — all context is local.

## Components

1. **PROJECT.md** — Add orchestrator model, `organization_id`, Allura narrative, Notion control-plane references
2. **SOLUTION-ARCHITECTURE.md** — Add orchestrator/subagent topology diagram
3. **BLUEPRINT.md** — Add orchestrator and tenant boundary concepts
4. **REQUIREMENTS-MATRIX.md** — Add orchestrator-related requirements
5. **RISKS-AND-DECISIONS.md** — Add orchestrator binding decision (AD-14)
6. **DESIGN.md** — Add orchestrator integration surface

## Constraints

- Maintain existing document structure and formatting
- Preserve all existing requirements, decisions, and architectural references
- Add new sections without removing critical content
- Keep AI-assisted documentation disclosure blocks intact
- Follow BMad routing from `.opencode/context/project/bmad-integration.md`

## Exit Criteria

- [x] `PROJECT.md` updated with orchestrator model, organization_id, Allura narrative
- [x] `SOLUTION-ARCHITECTURE.md` updated with orchestrator topology
- [x] `BLUEPRINT.md` updated with tenant boundaries and orchestrator
- [x] `REQUIREMENTS-MATRIX.md` updated with orchestrator requirements
- [x] `RISKS-AND-DECISIONS.md` updated with AD-14 decision
- [x] `DESIGN.md` updated with orchestrator integration surface

## Summary

Successfully updated all core documentation files to reflect:

1. **Brooks-Bound Orchestrator Model**
   - Added `memory-orchestrator` as primary Brooks-bound agent
   - Documented 11 canonical `memory-*` subagents with clear roles
   - Explained Brooks persona principles (conceptual integrity, plan-and-document, surgical team)

2. **Two-Tier Tenant Isolation**
   - Added `organization_id` as business boundary
   - Clarified `group_id` as memory partition within organization
   - Updated all entity definitions to include both fields

3. **Dual Logging Policy**
   - Documented PostgreSQL for events/audit (System of Record for the Present)
   - Documented Neo4j for insights/patterns (System of Reason)
   - Clarified confidence threshold routing (<0.5 vs >=0.5)

4. **Notion Control Plane**
   - Referenced backend hub page URL
   - Documented database purposes (Agents, Skills, Commands, Changes, GitHub Repos)
   - Explained sync model (roninmemory → Notion)

5. **Allura Platform Narrative**
   - Updated title to "roninmemory (Allura Memory)"
   - Added Allura context throughout documentation

All changes preserve existing document structure, formatting, and requirements while adding new architectural context for the orchestrator model.