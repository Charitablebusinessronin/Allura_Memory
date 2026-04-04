# Task Context: Brooks Orchestrator Sync

Session ID: 2026-04-03-brooks-orchestrator-sync
Created: 2026-04-03T23:59:00Z
Status: in_progress

## Current Request
Update `.opencode` and `_bmad` first so `memory-orchestrator` uses the Frederick P. Brooks Jr. persona, supports dual logging to Neo4j and PostgreSQL, preserves subagents and party mode, and aligns the platform story around multi-organization governance with `organization_id` + `group_id` boundaries.

## Context Files (Standards to Follow)
- .opencode/context/core/standards/code-quality.md
- .opencode/context/core/workflows/component-planning.md
- .opencode/context/core/workflows/task-delegation-basics.md
- .opencode/context/project/bmad-integration.md

## Reference Files (Source Material)
- opencode.json
- .opencode/config/agent-metadata.json
- .opencode/config/memory-contract.md
- .opencode/README.md
- _bmad/_config/ides/opencode.yaml
- _bmad/_config/agent-manifest.csv
- _bmad/_config/skill-manifest.csv
- _bmad/_config/bmad-help.csv
- _bmad/bmm/config.yaml

## External Docs Fetched
- Notion Agents database: `collection://3371d9be-65b3-8182-bfb0-000baf828f22`
- Brooks persona source page: `https://www.notion.so/3181d9be65b3805da320eace4cd56d2b`

## Components
- Orchestrator profile — Brooks-bound `memory-orchestrator`
- Memory contract — dual logging and tenant boundaries
- BMad/OpenCode sync metadata — local source-of-truth bridge
- Docs — README and integration guidance

## Constraints
- Preserve `memory-orchestrator` runtime id for compatibility
- Keep subagents as execution model
- Keep `bmad-party-mode` as optional collaboration path
- Use `organization_id` for business boundary and `group_id` for memory partition
- Update local config/docs first before broader Notion sync

## Exit Criteria
- [ ] Brooks persona documented as the primary orchestrator bound to `memory-orchestrator`
- [ ] Dual logging contract documented in `.opencode/config`
- [ ] `_bmad/_config/ides/opencode.yaml` upgraded from stub to real OpenCode integration metadata
- [ ] `.opencode/README.md` reflects Brooks + subagents + party mode operating model

## Progress
- [x] Session initialized
- [ ] Config/docs updated
- [ ] Verification complete
