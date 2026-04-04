# OpenAgents Control — Canonical Registry Design

> **Created:** 2026-04-03
> **Status:** Approved
> **Target:** Rebuild OpenAgents Control as canonical operational registry

---

## Overview

Rebuild `OpenAgents Control` Notion page as the canonical operational registry for OpenCode agents, skills, commands, and workflows. Replace Prompt Library focus with linked operational databases that sync from local `.opencode/` and `_bmad/` sources.

---

## Architecture

### Hub Page
- **Location**: `https://www.notion.so/3371d9be65b38041bc59fd5cf966ff98`
- **Purpose**: Single pane of glass for all OpenCode operational entities
- **Structure**: Navigation + Control Plane + Databases embeds

### Source of Truth
- **Local Files**: `.opencode/agent/**`, `.opencode/skills/**`, `.opencode/command/**`, `_bmad/_config/`
- **Notion Role**: Readable mirror + governance UI + review surface
- **Sync Direction**: Local → Notion only (upsert-only, no destructive ops without explicit approval)

---

## Database Schema

### 1. Agents Database

**Purpose**: Track OpenCode runtime agents + BMad persona agents

| Property | Type | Required | Description |
|----------|------|----------|-------------|
| Name | title | Yes | Canonical ID (e.g., `memory-orchestrator`, `bmad-agent-architect`) |
| Display Name | text | Yes | Human name (e.g., "Frederick P. Brooks Jr.", "Winston") |
| Persona | text | No | Persona/binding notes |
| Type | select | Yes | Options: `OpenAgent`, `Specialist`, `Worker`, `BMad Persona`, `WDS Persona` |
| Category | select | No | Options: `core`, `subagents/core`, `subagents/code`, `subagents/development`, `bmm`, `tea`, `wds` |
| Status | select | Yes | Options: `active`, `idle`, `deprecated`, `experimental` |
| Source Path | text | No | Local file path (e.g., `.opencode/agent/core/openagent.md`) |
| Skills | relation | No | → Skills database (multi-select) |
| Commands | relation | No | → Commands database (multi-select) |
| Workflows | relation | No | → Workflows database (multi-select) |
| Config File | text | No | Config source (e.g., `.opencode/config/agent-metadata.json`) |
| Group ID | text | No | Tenant partition (e.g., `roninmemory`) |
| Last Synced | date | No | Last successful sync timestamp |

**Source Mapping**:
- OpenCode agents: `.opencode/config/agent-metadata.json`
- BMad personas: `_bmad/_config/agent-manifest.csv`
- Agent files: `.opencode/agent/**/*.md`

---

### 2. Skills Database

**Purpose**: Track reusable OpenCode skills

| Property | Type | Required | Description |
|----------|------|----------|-------------|
| Name | title | Yes | Skill ID (e.g., `bmad-party-mode`, `brainstorming`) |
| Display Name | text | No | Human name (e.g., "Party Mode", "Brainstorming") |
| Category | select | No | Options: `context`, `research`, `writing`, `testing`, `review`, `governance`, `deployment`, `bmad`, `wds`, `tea` |
| Description | text | No | What this skill does |
| Source Path | text | No | Local path (e.g., `.opencode/skills/bmad-party-mode/SKILL.md`) |
| Required Tools | multi_select | No | Options: `read`, `write`, `edit`, `bash`, `grep`, `task` |
| Status | select | Yes | Options: `active`, `deprecated`, `experimental` |
| Agents | relation | No | ← Agents database (reverse relation) |
| Usage Count | number | No | Times invoked |
| Last Used | date | No | Most recent invocation |

**Source Mapping**:
- `.opencode/skills/*/SKILL.md`

---

### 3. Commands Database

**Purpose**: Track OpenCode slash commands

| Property | Type | Required | Description |
|----------|------|----------|-------------|
| Name | title | Yes | Command name (e.g., `quickprompt`, `bmad`) |
| Intent | text | No | What it does |
| Category | select | No | Options: `memory`, `knowledge`, `tenant`, `audit`, `agent`, `sync` |
| Source Path | text | No | Local path (e.g., `.opencode/command/quickprompt.md`) |
| Input Schema | text | No | Expected inputs |
| Output Schema | text | No | Expected outputs |
| Requires HITL | checkbox | No | Human-in-the-loop flag |
| Status | select | Yes | Options: `active`, `deprecated`, `experimental` |
| Skills | relation | No | → Skills database (multi-select) |
| Agents | relation | No | ← Agents database (reverse relation) |

**Source Mapping**:
- `.opencode/command/**/*.md`

---

### 4. Workflows Database

**Purpose**: Track BMad workflows from module-help entries

| Property | Type | Required | Description |
|----------|------|----------|-------------|
| Code | title | Yes | Workflow code (e.g., `CP` for Create PRD) |
| Name | text | No | Full name (e.g., "Create PRD") |
| Module | select | No | Options: `bmm`, `tea`, `wds`, `bmb`, `core` |
| Phase | select | No | Options: `1-analysis`, `2-planning`, `3-solutioning`, `4-implementation`, `0-wds-pitch`, `1-wds-strategy`, etc. |
| Description | text | No | What workflow does |
| Agent | relation | No | → Agents database (single) |
| Required | checkbox | No | Required for project |
| Sequence | number | No | Execution order |
| Source Path | text | No | Reference to `_bmad/*/module-help.csv` + workflow file |
| Status | select | Yes | Options: `active`, `deprecated`, `experimental` |

**Source Mapping**:
- `_bmad/_config/bmad-help.csv`
- `_bmad/*/module-help.csv`

---

### 5. Sync Registry Database

**Purpose**: Audit trail of sync runs with drift reports

| Property | Type | Required | Description |
|----------|------|----------|-------------|
| Run ID | title | Yes | Unique sync run identifier |
| Run Date | date | Yes | When sync executed |
| Status | select | Yes | Options: `success`, `partial`, `failed`, `dry-run` |
| Agents Synced | number | No | Count of agents upserted |
| Skills Synced | number | No | Count of skills upserted |
| Commands Synced | number | No | Count of commands upserted |
| Workflows Synced | number | No | Count of workflows upserted |
| Drift Report | text | No | JSON/text report of mismatches |
| Broken Links | number | No | Count of broken relations |
| Missing Local | number | No | Items in Notion but not local |
| Missing Notion | number | No | Items local but not in Notion |

---

## Relations Map

```
Agents ←→ Skills (many-to-many)
Agents ←→ Commands (many-to-many)
Agents ←→ Workflows (many-to-many)
Commands ←→ Skills (many-to-many)
Workflows ←→ Agents (many-to-one)

All entities ←→ Source Path (local file reference)
All entities ←→ Last Synced (sync tracking)
```

---

## Sync Process

### Phase 1: Extract
1. Parse `.opencode/config/agent-metadata.json` for OpenCode agents
2. Parse `_bmad/_config/agent-manifest.csv` for BMad personas
3. Parse `.opencode/skills/*/SKILL.md` for skills
4. Parse `.opencode/command/**/*.md` for commands
5. Parse `_bmad/_config/bmad-help.csv` + `_bmad/*/module-help.csv` for workflows

### Phase 2: Normalize
1. Generate canonical IDs for each entity
2. Build relation graph from dependencies and manifest links
3. Map local fields to Notion schema columns

### Phase 3: Compare
1. Query existing Notion entries
2. Identify creates/updates/deletes (deletes require approval)
3. Generate drift report

### Phase 4: Upsert
1. Create missing entries
2. Update existing entries (field-by-field comparison)
3. Resolve relation links
4. Log to Sync Registry

### Phase 5: Verify
1. Count parity check per entity type
2. Required field parity checks
3. Link integrity checks
4. Generate final drift report

---

## Notion Page Layout

### OpenAgents Control Hub

**Navigation Plane**:
- Quick links to Agents/Skills/Commands/Workflows databases

**Control Plane Status**:
- Last sync run summary
- Sync status indicator (in-sync/out-of-sync)
- Quick actions: `Sync Now`, `Dry Run`, `View Drift Report`

**Active Registries**:
- Live counts: X Agents, Y Skills, Z Commands, W Workflows
- Active vs deprecated breakdown

**Review Queue**:
- Items requiring human review
- Broken links alert
- Missing local/Notion items

---

## Views Per Database

### Agents
- `All Agents` — table view, all records
- `Active` — filter Status = active
- `By Type` — grouped by Type select
- `By Category` — grouped by Category select

### Skills
- `All Skills` — table view, all records
- `By Category` — grouped by Category select
- `Active` — filter Status = active
- `Most Used` — sorted by Usage Count desc

### Commands
- `All Commands` — table view, all records
- `By Category` — grouped by Category select
- `Active` — filter Status = active
- `Requires HITL` — filter Requires HITL = true

### Workflows
- `All Workflows` — table view, all records
- `By Module` — grouped by Module select
- `By Phase` — grouped by Phase select
- `Required` — filter Required = true

### Sync Registry
- `All Runs` — table view, all records desc by Run Date
- `Success` — filter Status = success
- `Failed` — filter Status = failed
- `Dry-Run` — filter Status = dry-run

---

## Implementation Checklist

### Phase 1: Notion Setup
- [ ] Create 5 databases under OpenAgents Control page
- [ ] Configure schema properties exactly as specified
- [ ] Create relation properties
- [ ] Build default views for each database

### Phase 2: Extraction Scripts
- [ ] Build agent extractor (parse agent-metadata.json + agent-manifest.csv)
- [ ] Build skill extractor (glob SKILL.md files)
- [ ] Build command extractor (glob .md files in .opencode/command/)
- [ ] Build workflow extractor (parse CSVs)

### Phase 3: Normalization Layer
- [ ] Map BMad personas to canonical format
- [ ] Map OpenCode agents to canonical format
- [ ] Build relation graph

### Phase 4: Sync Engine
- [ ] Build Notion query layer
- [ ] Build drift detection logic
- [ ] Build upsert logic (create/update)
- [ ] Build Sync Registry logger

### Phase 5: Verification
- [ ] Build count parity check
- [ ] Build required field check
- [ ] Build link integrity check
- [ ] Build drift report generator

### Phase 6: CLI Integration
- [ ] Create `sync:registry` command
- [ ] Create `sync:registry --dry-run` command
- [ ] Create `sync:status` command
- [ ] Schedule weekly audit runs

---

## Success Metrics

- ✅ 100% of local agents/skills/commands/workflows in Notion
- ✅ 0 broken relation links
- ✅ Idempotent sync (second run = no changes)
- ✅ Drift report empty for critical mismatches
- ✅ All required fields populated
- ✅ Sync run completes in <60 seconds

---

## Risks & Mitigations

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| Notion API rate limits | Medium | Batch upserts, exponential backoff |
| Schema drift over time | Medium | Version lock schema, validation checks |
| Broken relation links | Low | Pre-validation before upsert |
| Local source changes | Medium | Lock canonical IDs, path changes require review |
| Duplicate entries | Low | Match by canonical ID + source path |

---

## Next Steps

1. Create 5 Notion databases with specified schemas
2. Build extraction + normalization scripts
3. Implement sync engine with drift detection
4. Create CLI commands for manual sync
5. Verify end-to-end sync flow
6. Schedule recurring sync runs

---

**Approved by:** User
**Ready for:** Implementation planning (writing-plans skill)