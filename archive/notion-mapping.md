# Notion Mapping Reference

> **Purpose**: Quick reference for Allura Memory Notion workspace structure, local file mappings, and MCP_DOCKER command examples.

---

## Workspace Overview

### Hub Page

**Location**: Notion workspace root or Backend Hub page  
**ID**: `3371d9be-65b3-81a9-b3be-c24275444b68`  
**Name**: `Allura Memory Control Center`

**Contains**:
- Projects database (embedded)
- Tasks database (embedded)
- Frameworks database (embedded)
- Agents database (embedded)
- Skills database (embedded)
- Changes database (embedded)
- Runs database (embedded)
- Insights database (embedded)
- Sync Registry database (embedded)

---

## Database Inventory

| Database | ID | Data Source ID | Purpose | Key Relations |
|----------|-----|----------------|---------|---------------|
| **Projects** | `831770c6ac7f4c4c802bb78be4e9e3eb` | `7a473d1b-ba75-43a0-b3e4-c30506509db6` | Epics, initiatives | → Tasks, → Frameworks, → Changes |
| **Tasks** | `52c1cdfce1d84a1aaee42462ca369f3b` | `6285882c-82a7-4fe2-abc5-7dbeb344b1d4` | Stories, subtasks | → Projects, → Frameworks |
| **Frameworks** | `3c2e0100caa14da19608eed1ba9b2a22` | `9cb07b33-7854-4055-a47f-f22f73e18b91` | Standards, checklists | ← Projects, ← Tasks |
| **Changes** | `7b1a6244347c44fea492f043c947ea4a` | `4fb793a1-4e82-4990-80f6-b1b4e750c630` | HITL governance queue | → Projects |
| **Agents (Registry)** | `ff8686357820465a8e4d1b58257705da` | `64d76811-67fe-4b83-aa4b-cfb01eb69e59` | Agent definitions | → Skills |
| **Agents** | — | `62b4f0ce-1008-496a-9224-3fb712dee689` | Agent instances | — |
| **Skills** | `2015b1a968b9454c82ed6a2afb960954` | `9074224b-4d8f-4ce1-9b08-f7be47039fe8` | Skill definitions | — |
| **Commands** | `d505dbabee7f452c9ac8d886665cbffc` | `53fba8ac-32e8-406e-a62e-63b9d5c9302e` | Slash commands | — |
| **Runs** | `18579617a1524c07b0a74c29b934f1bb` | `c32a2ba1-d2ac-483d-ab3a-e7b5ad2b3a2c` | Execution runs | → Insights |
| **Insights** | `a6e04b3f20e049a6bc00ffcde31d5467` | `9e00d08a-1852-483e-a13d-5d8b1a0a8d1b` | Promoted knowledge | ← Runs |
| **Sync Registry** | `c9c0ef45b3444d57bd39269511c95ef0` | `14e234eb-ba36-4015-9fa5-677f40c7fda4` | Sync audit trail | — |

---

## Local File → Notion Mappings

### 1. Epic → Project

| Local File | Notion Field | Example |
|-----------|-------------|---------|
| File path | `_bmad-output/planning-artifacts/epics-*.md` | |
| `title` | `Name` | "OpenAgents Control Registry" |
| `status` | `Status` | "Active" |
| `priority` | `Priority` | "P0" |
| Frontmatter `type` | `Type` | "Epic" |
| Stories section | Creates linked Tasks | 10 story records |
| Description | `Notes` | First paragraph |

**MCP_DOCKER Command**:
```javascript
// Create project from epic
MCP_DOCKER_notion-create-pages({
  parent: { data_source_id: "PROJECTS_DATA_SOURCE_ID" },
  pages: [{
    properties: {
      "Name": "OpenAgents Control Registry",
      "Status": "Active",
      "Priority": "P0",
      "Type": "Epic"
    },
    content: `
## Overview
Establish canonical operational registry for Allura Memory agents.
...
    `
  }]
})
```

---

### 2. Story → Task

| Local File | Notion Field | Example |
|-----------|-------------|---------|
| File path | `_bmad-output/implementation-artifacts/story-*.md` | |
| `title` | `Name` | "Create Notion database schemas" |
| `status` | `Status` | "Todo" / "In Progress" / "Done" |
| `estimate` | `Estimate (hours)` | 3 |
| Epic frontmatter | `Project` | Relation to parent Project |
| Epic ID | `Epic` | "7" |
| Story number | `Story` | "7.1" |
| Dependencies | `Dependencies` | Relation to other Tasks |

**MCP_DOCKER Command**:
```javascript
// Create task from story
MCP_DOCKER_notion-create-pages({
  parent: { data_source_id: "TASKS_DATA_SOURCE_ID" },
  pages: [{
    properties: {
      "Name": "Create Notion database schemas",
      "Status": "Todo",
      "Priority": "P0",
      "Project": { relation_id: "PROJECT_PAGE_ID" },
      "Epic": "7",
      "Story": "7.1",
      "Type": "Code",
      "Estimate (hours)": 3
    }
  }]
})
```

---

### 3. Agent → Agents Database

| Local File | Notion Field | Example |
|-----------|-------------|---------|
| `.opencode/config/agent-metadata.json` | All agents | 13 agents |
| `.opencode/agent/core/openagent.md` | Primary agent definition | |
| `id` | `Name` | "memory-orchestrator" |
| `displayName` | `Display Name` | "Frederick P. Brooks Jr." |
| `type` | `Type` | "Primary" / "Subagent" / "BMad Persona" |
| `category` | `Category` | "core" / "subagents/code" |
| `status` | `Status` | "Active" |
| Source path | `Source Path` | `.opencode/agent/core/openagent.md` |

**MCP_DOCKER Command**:
```javascript
// Create agent entry
MCP_DOCKER_notion-create-pages({
  parent: { data_source_id: "AGENTS_DATA_SOURCE_ID" },
  pages: [{
    properties: {
      "Name": "memory-orchestrator",
      "Display Name": "Frederick P. Brooks Jr.",
      "Type": "Primary",
      "Category": "core",
      "Status": "Active",
      "Source Path": ".opencode/agent/core/openagent.md"
    }
  }]
})
```

---

### 4. Skill → Skills Database

| Local File | Notion Field | Example |
|-----------|-------------|---------|
| `.opencode/skills/*/SKILL.md` | All skills | 90+ skills |
| `name` (frontmatter) | `Name` | "brainstorming" |
| `description` | `Description` | "Interactive ideation..." |
| `category` | `Category` | "context" / "bmad" / "wds" |
| `required_tools` | `Required Tools` | ["read", "write", "bash"] |

**MCP_DOCKER Command**:
```javascript
// Create skill entry
MCP_DOCKER_notion-create-pages({
  parent: { data_source_id: "SKILLS_DATA_SOURCE_ID" },
  pages: [{
    properties: {
      "Name": "brainstorming",
      "Category": "context",
      "Description": "Interactive ideation and brainstorming sessions",
      "Required Tools": ["read", "write", "bash"],
      "Status": "Active"
    }
  }]
})
```

---

### 5. Workflow → Workflows Database

| Local File | Notion Field | Example |
|-----------|-------------|---------|
| `_bmad/_config/bmad-help.csv` | All workflows | |
| `code` | `Code` | "CP" |
| `name` | `Name` | "Create PRD" |
| `module` | `Module` | "bmm" / "tea" / "wds" |
| `phase` | `Phase` | "1-analysis" |
| `required` | `Required` | true/false |

---

### 6. Session Context → Task Status Updates

| Local File | Notion Field | Trigger |
|-----------|-------------|---------|
| `memory-bank/activeContext.md` | `Status`, `Assignee`, `Notes` | Session start |
| `.tmp/sessions/*/context.md` | `Session ID`, `Progress` | Session runtime |
| `memory-bank/progress.md` | `Completed Date` | Task completion |

**Status Mapping**:
```yaml
Local Marker → Notion Status
"ready-for-dev" → "Todo"
"In Progress" / "📍 Current" → "In Progress"
"Blocked" / "🚧 Blocked" → "Blocked"
"Review" / "🔍 Review" → "Review"
"✅ Completed" → "Done"
```

---

### 7. HITL Approval → Approvals Database

| Source | Notion Field | Value |
|--------|-------------|-------|
| PostgreSQL `adas_promotion_proposals` | Queue source | |
| `proposal_id` | `Approval ID` | UUID |
| `design_id` | `Design ID` | UUID |
| `status` | `Status` | "Pending" / "Approved" / "Rejected" |
| Human decision | `Decision` | "Approved" / "Rejected" |
| Reviewer | `Reviewer` | Person relation |
| Timestamp | `Created` / `Decided` | ISO dates |

---

### 8. Neo4j Insight → Insights Database

| Source | Notion Field | Value |
|--------|-------------|-------|
| Neo4j `Insight` node | Promoted knowledge | |
| `name` | `Name` | "ADR-001: 2-Phase Commit" |
| `type` | `Type` | "ADR" / "Pattern" / "Decision" |
| `confidence` | `Confidence` | 0.0-1.0 |
| `group_id` | `Group ID` | "roninmemory" |
| `created` | `Created` | ISO date |
| Supersedes relation | `Superseded By` | Relation to newer insight |

---

### 9. ADAS Run → Runs Database

| Source | Notion Field | Value |
|--------|-------------|-------|
| PostgreSQL `adas_runs` | Run execution | |
| `run_id` | `Name` | UUID |
| `fitness_score` | `Fitness Score` | 0.0-1.0 |
| `status` | `Status` | "Pending" / "Running" / "Succeeded" / "Failed" |
| `started_at` | `Started` | ISO date |
| `finished_at` | `Finished` | ISO date |
| `promoted` | `Promoted` | true/false |

---

### 10. Sync Run → Sync Registry Database

| Source | Notion Field | Value |
|--------|-------------|-------|
| CLI `bun run registry:sync` | Sync execution | |
| Run ID | `Run ID` | UUID |
| Sync type | `Sync Type` | "Full" / "Agents" / "Skills" / "Workflows" |
| Entities created | `Entities Created` | Number |
| Entities updated | `Entities Updated` | Number |
| Broken links found | `Broken Links` | Number |
| Duration | `Duration (sec)` | Number |
| Status | `Status` | "Success" / "Partial" / "Failed" |

---

## MCP_DOCKER Command Reference

### Creating Databases

```javascript
// Projects Database
MCP_DOCKER_notion-create-database({
  parent: { page_id: "HUB_PAGE_ID" },
  title: "Projects",
  schema: `CREATE TABLE (
    "Name" TITLE,
    "Status" SELECT('Planning', 'Active', 'Blocked', 'Completed'),
    "Priority" SELECT('P0', 'P1', 'P2', 'P3'),
    "Type" SELECT('Epic', 'Initiative', 'Task', 'Maintenance'),
    "Owner" PEOPLE,
    "Target Date" DATE,
    "Estimate (hours)" NUMBER,
    "Progress" NUMBER,
    "Notes" RICH_TEXT
  )`
})

// Tasks Database
MCP_DOCKER_notion-create-database({
  parent: { page_id: "HUB_PAGE_ID" },
  title: "Tasks",
  schema: `CREATE TABLE (
    "Name" TITLE,
    "Status" SELECT('Todo', 'In Progress', 'Blocked', 'Review', 'Done'),
    "Priority" SELECT('P0', 'P1', 'P2', 'P3'),
    "Project" RELATION('PROJECTS_DB_ID'),
    "Epic" RICH_TEXT,
    "Story" RICH_TEXT,
    "Type" SELECT('Code', 'Documentation', 'Test', 'Review', 'Ops'),
    "Estimate (hours)" NUMBER,
    "Assignee" PEOPLE,
    "Due Date" DATE,
    "Started Date" DATE,
    "Completed Date" DATE,
    "Dependencies" MULTI_SELECT,
    "Framework" RELATION('FRAMEWORKS_DB_ID'),
    "GitHub Issue" URL,
    "GitHub PR" URL,
    "Notes" RICH_TEXT,
    "Session ID" RICH_TEXT
  )`
})

// Frameworks Database
MCP_DOCKER_notion-create-database({
  parent: { page_id: "HUB_PAGE_ID" },
  title: "Frameworks",
  schema: `CREATE TABLE (
    "Name" TITLE,
    "Category" SELECT('Documentation', 'Architecture', 'Agent Design', 'Operations', 'Testing'),
    "Type" SELECT('Standard', 'Checklist', 'Pattern', 'Template', 'Convention'),
    "Status" SELECT('Active', 'Draft', 'Deprecated'),
    "Version" RICH_TEXT,
    "Source Path" RICH_TEXT,
    "Description" RICH_TEXT,
    "Checklist" RICH_TEXT
  )`
})

// Approvals Database (HITL Queue)
MCP_DOCKER_notion-create-database({
  parent: { page_id: "HUB_PAGE_ID" },
  title: "Approvals",
  schema: `CREATE TABLE (
    "Name" TITLE,
    "Type" SELECT('ADAS Promotion', 'ADR Decision', 'Sync Approval', 'Config Change'),
    "Status" SELECT('Pending', 'Approved', 'Rejected', 'Implemented'),
    "Requester" PEOPLE,
    "Reviewer" PEOPLE,
    "Created" DATE,
    "Decided" DATE,
    "Decision" RICH_TEXT,
    "Metadata" RICH_TEXT
  )`
})

// Insights Database
MCP_DOCKER_notion-create-database({
  parent: { page_id: "HUB_PAGE_ID" },
  title: "Insights",
  schema: `CREATE TABLE (
    "Name" TITLE,
    "Type" SELECT('ADR', 'Pattern', 'Decision', 'Lesson', 'Fix'),
    "Confidence" NUMBER,
    "Status" SELECT('Proposed', 'Approved', 'Published', 'Superseded'),
    "Group ID" RICH_TEXT,
    "Category" RICH_TEXT,
    "Content" RICH_TEXT,
    "Created" DATE,
    "Superseded By" RELATION('INSIGHTS_DB_ID')
  )`
})

// Runs Database
MCP_DOCKER_notion-create-database({
  parent: { page_id: "HUB_PAGE_ID" },
  title: "Runs",
  schema: `CREATE TABLE (
    "Name" TITLE,
    "Type" SELECT('ADAS', 'Curator', 'Sync', 'Test', 'Migration'),
    "Status" SELECT('Pending', 'Running', 'Succeeded', 'Failed'),
    "Group ID" RICH_TEXT,
    "Started" DATE,
    "Finished" DATE,
    "Duration (min)" NUMBER,
    "Fitness Score" NUMBER,
    "Promoted" CHECKBOX,
    "Logs" URL,
    "Notes" RICH_TEXT
  )`
})

// Sync Registry Database
MCP_DOCKER_notion-create-database({
  parent: { page_id: "HUB_PAGE_ID" },
  title: "Sync Registry",
  schema: `CREATE TABLE (
    "Run ID" TITLE,
    "Sync Type" SELECT('Full', 'Agents', 'Skills', 'Workflows', 'Docs'),
    "Status" SELECT('Success', 'Partial', 'Failed'),
    "Entities Created" NUMBER,
    "Entities Updated" NUMBER,
    "Entities Unchanged" NUMBER,
    "Broken Links" NUMBER,
    "Field Mismatches" NUMBER,
    "Duration (sec)" NUMBER,
    "Timestamp" DATE,
    "Trigger" SELECT('Manual', 'Scheduled', 'Webhook'),
    "Drift Report" RICH_TEXT,
    "Notes" RICH_TEXT
  )`
})
```

---

### Adding Relations

```javascript
// Add Tasks relation to Projects
MCP_DOCKER_notion-update-data-source({
  data_source_id: "PROJECTS_DATA_SOURCE_ID",
  statements: `ADD COLUMN "Tasks" RELATION('TASKS_DB_ID', DUAL 'Projects')`
})

// Add Frameworks relation to Projects
MCP_DOCKER_notion-update-data-source({
  data_source_id: "PROJECTS_DATA_SOURCE_ID",
  statements: `ADD COLUMN "Frameworks" RELATION('FRAMEWORKS_DB_ID')`
})

// Add Insights relation to Runs
MCP_DOCKER_notion-update-data-source({
  data_source_id: "RUNS_DATA_SOURCE_ID",
  statements: `ADD COLUMN "Insights" RELATION('INSIGHTS_DB_ID')`
})
```

---

### Creating Views

```javascript
// Active Sprint View (Tasks)
MCP_DOCKER_notion-create-view({
  database_id: "TASKS_DB_ID",
  data_source_id: "TASKS_DATA_SOURCE_ID",
  name: "Active Sprint",
  type: "board",
  configure: `FILTER "Status" IN ["Todo", "In Progress", "Blocked", "Review"]
              SORT BY "Priority" ASC
              GROUP BY "Status"`
})

// Epic Progress View
MCP_DOCKER_notion-create-view({
  database_id: "TASKS_DB_ID",
  data_source_id: "TASKS_DATA_SOURCE_ID",
  name: "Epic Progress",
  type: "board",
  configure: `GROUP BY "Epic"
              SORT BY "Story" ASC`
})

// HITL Queue View (Approvals)
MCP_DOCKER_notion-create-view({
  database_id: "APPROVALS_DB_ID",
  data_source_id: "APPROVALS_DATA_SOURCE_ID",
  name: "HITL Queue",
  type: "list",
  configure: `FILTER "Status" = "Pending"
              SORT BY "Created" ASC`
})

// Recent Runs View
MCP_DOCKER_notion-create-view({
  database_id: "RUNS_DB_ID",
  data_source_id: "RUNS_DATA_SOURCE_ID",
  name: "Recent Runs",
  type: "list",
  configure: `SORT BY "Started" DESC
              FILTER "Started" >= "date:the_past_week"`
})
```

---

### Querying Data

```javascript
// Get all P0 tasks
MCP_DOCKER_notion-query-database-view({
  view_url: "https://notion.so/workspace/Tasks-DB-abc123?v=def456"
})

// Search for a project by name
MCP_DOCKER_notion-search({
  query: "OpenAgents Control Registry",
  query_type: "internal",
  data_source_url: "collection://PROJECTS_DATA_SOURCE_ID"
})

// Fetch a specific task page
MCP_DOCKER_notion-fetch({
  id: "TASK_PAGE_ID"
})
```

---

### Updating Pages

```javascript
// Update task status to In Progress
MCP_DOCKER_notion-update-page({
  page_id: "TASK_PAGE_ID",
  command: "update_properties",
  properties: {
    "Status": "In Progress",
    "Started Date": { type: "date", start_date: "2026-04-03" }
  }
})

// Add notes to a task
MCP_DOCKER_notion-update-page({
  page_id: "TASK_PAGE_ID",
  command: "update_content",
  content_updates: [{
    old_str: "## Notes",
    new_str: "## Notes\n\n- 2026-04-03: Started implementation\n- Created database schemas for Agents, Skills"
  }]
})
```

---

## Sync Script Reference

### Registry Sync Command

```bash
# Full sync (all entities)
bun run registry:sync

# Verify sync (drift detection)
bun run registry:verify

# Sync specific entity type
bun run registry:sync --type agents
bun run registry:sync --type skills
bun run registry:sync --type workflows
```

### Sync Flow

```
1. Extract from local files
   ├── extract-agents.ts → .opencode/agent/**/*.md + agent-metadata.json
   ├── extract-skills.ts → .opencode/skills/*/SKILL.md
   ├── extract-commands.ts → .opencode/command/**/*.md
   └── extract-workflows.ts → _bmad/_config/*.csv

2. Normalize to canonical format
   └── canonical-agents.ts, canonical-skills.ts, etc.

3. Compare with Notion (diff)
   └── verify.ts → detect broken links, field mismatches

4. Upsert to Notion
   └── sync.ts → MCP_DOCKER_notion-create-pages/update-page

5. Log to Sync Registry
   └── logger.ts → MCP_DOCKER_notion-create-pages(Sync Registry)
```

---

## HITL Flow Reference

```
┌─────────────────────────────────────────────────────────────┐
│ ADAS Run (evolutionary search)                               │
│     ↓                                                        │
│ PostgreSQL: adas_runs (fitness >= 0.7)                       │
│     ↓                                                        │
│ PostgreSQL: adas_promotion_proposals                         │
│     ↓                                                        │
│ Curator: Creates proposal                                    │
│     ↓                                                        │
│ Notion: Approvals DB (Status: "Pending")                     │
│     ↓                                                        │
│ Human: Reviews in Notion dashboard                           │
│     ↓                                                        │
│ Human clicks [Approve] or [Reject]                           │
│     ↓                                                        │
│ Notion: Approvals DB (Status: "Approved" or "Rejected")      │
│     ↓                                                        │
│ Curator: Prometheus polling detects decision                 │
│     ↓                                                        │
│ If Approved:                                                 │
│   - Create Neo4j Insight node                                │
│   - Mirror to Notion: Insights DB                            │
│   - Update PostgreSQL: promoted = true                       │
│ If Rejected:                                                 │
│   - Log rejection reason                                     │
│   - No promotion                                             │
└─────────────────────────────────────────────────────────────┘
```

---

## Dashboard View Structure

### Allura Memory Control Center (Hub Page)

```
┌────────────────────────────────────────────────────────────────┐
│ ALLURA MEMORY CONTROL CENTER                                    │
├────────────────────────────────────────────────────────────────┤
│                                                                 │
│ ┌─ ACTIVE SPRINT ─────────────────────────────────────────┐   │
│ │ [Tasks: Status in Todo/In Progress/Blocked/Review]      │   │
│ │ Board grouped by Status                                  │   │
│ └─────────────────────────────────────────────────────────┘   │
│                                                                 │
│ ┌─ PROJECTS ──────────────┐  ┌─ FRAMEWORKS ──────────────┐    │
│ │ Board: Status groups   │  │ Table: Category, Status   │    │
│ └─────────────────────────┘  └─────────────────────────────┘   │
│                                                                 │
│ ┌─ HITL QUEUE ──────────────────────────────────────────────┐   │
│ │ [Approvals: Status = Pending]                            │   │
│ │ List sorted by Created date                              │   │
│ └─────────────────────────────────────────────────────────┘   │
│                                                                 │
│ ┌─ AGENTS ───────────────────────────────────────────────────┐ │
│ │ Board grouped by Type (Primary/Subagent/BMad/WDS)        │ │
│ └──────────────────────────────────────────────────────────┘ │
│                                                                 │
│ ┌─ SYNC STATUS ──────────────────────────────────────────────┐│
│ │ [Sync Registry: Last 10 runs]                            ││
│ └──────────────────────────────────────────────────────────┘ │
│                                                                 │
└────────────────────────────────────────────────────────────────┘
```

---

## Database IDs Reference

Store in `.opencode/config/registry-databases.json`:

```json
{
  "databases": {
    "projects": "PROJECTS_DATA_SOURCE_ID",
    "tasks": "TASKS_DATA_SOURCE_ID",
    "frameworks": "FRAMEWORKS_DATA_SOURCE_ID",
    "agents": "AGENTS_DATA_SOURCE_ID",
    "skills": "SKILLS_DATA_SOURCE_ID",
    "commands": "COMMANDS_DATA_SOURCE_ID",
    "workflows": "WORKFLOWS_DATA_SOURCE_ID",
    "approvals": "APPROVALS_DATA_SOURCE_ID",
    "insights": "INSIGHTS_DATA_SOURCE_ID",
    "runs": "RUNS_DATA_SOURCE_ID",
    "sync_registry": "SYNC_REGISTRY_DATA_SOURCE_ID"
  },
  "hub_page": "HUB_PAGE_ID"
}
```

---

## Quick Reference Card

### Create Entity

| Entity | Command |
|--------|---------|
| Project | `MCP_DOCKER_notion-create-pages(parent: {data_source_id: "PROJECTS_ID"}, pages: [...])` |
| Task | `MCP_DOCKER_notion-create-pages(parent: {data_source_id: "TASKS_ID"}, pages: [...])` |
| Agent | `MCP_DOCKER_notion-create-pages(parent: {data_source_id: "AGENTS_ID"}, pages: [...])` |

### Update Entity

| Entity | Command |
|--------|---------|
| Status change | `MCP_DOCKER_notion-update-page(page_id: "ID", command: "update_properties", properties: {"Status": "Done"})` |
| Add notes | `MCP_DOCKER_notion-update-page(page_id: "ID", command: "update_content", content_updates: [...])` |

### Query Entity

| Query | Command |
|-------|---------|
| All P0 tasks | `MCP_DOCKER_notion-query-database-view(view_url: "...")` |
| Search by name | `MCP_DOCKER_notion-search(query: "...", data_source_url: "...")` |
| Fetch by ID | `MCP_DOCKER_notion-fetch(id: "...")` |

---

## Related Files

- **Epic/Story Templates**: `_bmad-output/planning-artifacts/`, `_bmad-output/implementation-artifacts/`
- **Agent Config**: `.opencode/config/agent-metadata.json`
- **Registry Config**: `.opencode/config/registry-databases.json`
- **Session Context**: `memory-bank/activeContext.md`
- **HITL Flow**: PostgreSQL `adas_promotion_proposals` → Notion Approvals DB

---

## Maintenance Commands

```bash
# Sync all registries to Notion
bun run registry:sync

# Verify drift between local and Notion
bun run registry:verify

# Sync epic/story progress from memory-bank
bun run sync:progress

# Sync session status to Notion
bun run sync:session
```

---

## Troubleshooting

### Relation not showing in view

**Problem**: Added a relation but can't filter or group by it.  
**Solution**: Use `MCP_DOCKER_notion-create-view` with `GROUP BY "Project"` or `FILTER "Framework" = "..."`.

### Page not updating

**Problem**: `update_content` doesn't change the page.  
**Solution**: Ensure `old_str` exactly matches existing content. Use `fetch` first to see current content.

### Database query returns empty

**Problem**: `query-database-view` returns no results.  
**Solution**: Check the view URL includes `?v=VIEW_ID`. Create a view first with `create-view`.

### Sync fails with broken links

**Problem**: `registry:verify` reports broken links.  
**Solution**: Check `agent-metadata.json` for skill/command IDs that don't exist in `.opencode/skills/` or `.opencode/command/`.

---

## Seed Data (2026-04-04)

### Projects Created

| Project | ID | Priority | Status |
|---------|-----|----------|--------|
| Allura Memory | `3381d9be-65b3-814d-a97e-c7edaf5722f0` | P0 | Active |

### Frameworks Created

| Framework | ID | Category | Version |
|-----------|-----|----------|---------|
| AI-Assisted Documentation | `3381d9be-65b3-813b-83c6-fd6dc6389cc2` | Architecture | 1.0 |
| Memory Bootstrap Protocol | `3381d9be-65b3-81a5-a582-c6ce763d6723` | Architecture | 1.0 |
| Learning System | `3381d9be-65b3-8109-9900-cc208473a8e0` | Agent Design | 1.0 |
| HITL Governance | `3381d9be-65b3-8133-be97-ff6faa3eb65c` | Operations | 1.0 |
| Steel Frame Versioning | `3381d9be-65b3-81f6-9a75-e52651b15292` | Architecture | 1.0 |

### Sync Registry Entries

| Run ID | ID | Sync Type | Status |
|--------|-----|-----------|--------|
| SYNC-001 | `3381d9be-65b3-819f-b824-f7043728387b` | Full | Success |

### Views Created

| Database | View Name | View ID | Configuration |
|----------|-----------|---------|---------------|
| Insights | Recent Insights | `view://3381d9be-65b3-812e-b9c0-cf0b2d6dbbf6` | SORT BY "Created" DESC |
| Sync Registry | Recent Syncs | `view://3381d9be-65b3-81b1-be48-e2b3d8c67a5c` | SORT BY "Timestamp" DESC |
| Runs | Recent Runs | `view://3381d9be-65b3-8191-b9b9-000c2060fe6b` | SORT BY "Started" DESC |

### Relations Established

| From Database | To Database | Relation | Bidirectional |
|---------------|-------------|----------|---------------|
| Projects | Tasks | Projects ↔ Tasks | Yes |
| Projects | Frameworks | Projects ↔ Frameworks | Yes |
| Tasks | Frameworks | Tasks ↔ Frameworks | Yes |
| Projects | Changes | Changes.Project | Yes |
| Runs | Insights | Runs.Insights | Yes |