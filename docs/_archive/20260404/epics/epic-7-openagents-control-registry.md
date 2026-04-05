---
stepsCompleted: [1, 2, 3, 4]
inputDocuments:
  - Spec: OpenAgents Control Registry Design
  - Plan: 2026-04-03-openagents-control-registry.md
  - Architecture: Canonical registry with dual-source sync
---

# Epic 7: OpenAgents Control Registry

Establish a canonical operational registry for OpenCode agents, skills, commands, and workflows that syncs from local `.opencode/` and `_bmad/` sources to Notion, enabling single-pane-of-glass governance and drift detection.

## Overview

This epic addresses the synchronization gap between local OpenCode/BMad entities and Notion operational databases. Currently:
- Agents exist in `.opencode/config/agent-metadata.json` + `_bmad/_config/agent-manifest.csv`
- Skills exist in `.opencode/skills/*/SKILL.md` (90+ skills)
- Commands exist in `.opencode/command/**/*.md` (20+ commands)
- Workflows exist in `_bmad/_config/bmad-help.csv` + `_bmad/*/module-help.csv` (70+ workflows)

Epic 7 establishes:
1. **Canonical Registry** — Single source of truth for all operational entities
2. **Notion Sync** — Automated upsert from local files to Notion control plane
3. **Drift Detection** — Identify mismatches between local and Notion
4. **Relation Tracking** — Link agents ↔ skills ↔ commands ↔ workflows
5. **Audit Trail** — Sync registry with full run history

## Requirements Inventory

### Functional Requirements

**FR1**: The system must extract agents from `.opencode/config/agent-metadata.json` and `_bmad/_config/agent-manifest.csv` into canonical format.

**FR2**: The system must extract skills from `.opencode/skills/*/SKILL.md` (90+ files) into canonical format.

**FR3**: The system must extract commands from `.opencode/command/**/*.md` (20+ files) into canonical format.

**FR4**: The system must extract workflows from `_bmad/_config/bmad-help.csv` and `_bmad/*/module-help.csv` (70+ entries) into canonical format.

**FR5**: The system must normalize all entities with stable canonical IDs and relation links.

**FR6**: The system must create 5 Notion databases with specified schemas (Agents, Skills, Commands, Workflows, Sync Registry).

**FR7**: The system must sync local entities to Notion with upsert-only operations (no destructive deletes).

**FR8**: The system must detect drift between local and Notion (missing entities, field mismatches, broken links).

**FR9**: The system must log all sync runs to Sync Registry database with audit trail.

**FR10**: The system must provide CLI commands for manual sync (`registry:sync`) and dry-run (`registry:dry-run`).

**FR11**: The system must verify link integrity (every skill reference exists, every agent-workflow link is valid).

**FR12**: The system must support idempotent sync (second run produces no changes if entities unchanged).

### Non-Functional Requirements

**NFR1**: Sync run must complete in <60 seconds for ~200 entities.

**NFR2**: TypeScript strict mode must pass for all code.

**NFR3**: Extraction scripts must handle CSV parsing errors gracefully.

**NFR4**: Notion API errors must be logged with context (entity ID, operation).

**NFR5**: Dry-run mode must show counts without upserting.

**NFR6**: All entities must have canonical ID matching their source path/folder name.

## Stories

| Story ID | Title | Estimate | Priority |
|----------|-------|----------|----------|
| 7.1 | Create Notion database schemas | 3h | P0 |
| 7.2 | Build agent extraction script | 2h | P0 |
| 7.3 | Build skills extraction script | 2h | P0 |
| 7.4 | Build commands extraction script | 1h | P0 |
| 7.5 | Build workflows extraction script | 2h | P0 |
| 7.6 | Build normalization layer | 2h | P1 |
| 7.7 | Build sync orchestrator | 4h | P0 |
| 7.8 | Build drift detection + verification | 3h | P1 |
| 7.9 | Create CLI commands | 1h | P1 |
| 7.10 | End-to-end sync verification | 2h | P0 |

**Total Estimate**: 22 hours (~3 days)

## Success Metrics

- ✅ 100% of local entities reflected in Notion (agents + skills + commands + workflows)
- ✅ 0 broken relation links
- ✅ Idempotent sync (second run = no changes)
- ✅ Drift report empty for critical mismatches
- ✅ All required fields populated
- ✅ Sync run completes in <60 seconds

## Risks

| Risk | Likelihood | Impact | Mitigation |
|------|-------------|--------|------------|
| Notion API rate limits | Medium | Medium | Batch upserts, exponential backoff |
| CSV parsing errors | Low | Low | Graceful error handling + logging |
| Schema drift over time | Medium | Medium | Version lock schema, validation checks |
| Duplicate entity IDs | Low | High | Canonical ID from source path/folder |

## Dependencies

- **Internal**: None (standalone feature)
- **External**: Notion API (already configured via MCP_DOCKER)

## References

- Spec: `docs/superpowers/specs/2026-04-03-openagents-control-registry-design.md`
- Plan: `docs/superpowers/plans/2026-04-03-openagents-control-registry.md`
- Similar Epic: Epic 6 (Agent Persistence) in `archive/bmad-output/planning-artifacts/epic-6-agent-persistence.md`