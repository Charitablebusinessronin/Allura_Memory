# Notion Integration for Allura Memory

> [!NOTE]
> **AI-Assisted Documentation**
> This document maps your local Allura Memory project to Notion workspaces using MCP_DOCKER tools.

## Overview

Your Allura project has a sophisticated Notion integration already designed. Here's how to use it:

### Notion Workspace Structure

**Hub Page**: `Allura Memory Control Center` (ID: `3371d9be-65b3-81a9-b3be-c24275444b68`)

**Databases**:
| Database | Purpose | Local Mapping |
|----------|---------|---------------|
| **Projects** | Epics & initiatives | `_bmad-output/planning-artifacts/epics-*.md` |
| **Tasks** | Stories & subtasks | `_bmad-output/implementation-artifacts/story-*.md` |
| **Frameworks** | Standards & patterns | `.claude/rules/*.md` |
| **Agents** | Agent definitions | `.opencode/agent/**/*.md` |
| **Skills** | Skill definitions | `.opencode/skills/**/SKILL.md` |
| **Changes** | HITL governance queue | PostgreSQL `adas_promotion_proposals` |
| **Runs** | Execution tracking | PostgreSQL `adas_runs` |
| **Insights** | Promoted knowledge | Neo4j `Insight` nodes |
| **Sync Registry** | Sync audit trail | Sync operations log |

---

## MCP_DOCKER Notion Tools Available

### Core Operations (22 tools total)

| Tool | Purpose |
|------|---------|
| `mcp__MCP_DOCKER__notion-create-page` | Create new pages |
| `mcp__MCP_DOCKER__notion-create-database` | Create databases |
| `mcp__MCP_DOCKER__notion-query-database` | Query databases |
| `mcp__MCP_DOCKER__notion-update-page` | Update existing pages |
| `mcp__MCP_DOCKER__notion-delete-page` | Delete pages |
| `mcp__MCP_DOCKER__notion-retrieve-page` | Get page details |
| `mcp__MCP_DOCKER__notion-retrieve-block` | Get block content |
| `mcp__MCP_DOCKER__notion-search` | Search across workspace |
| `mcp__MCP_DOCKER__notion-create-database-item` | Add items to databases |
| `mcp__MCP_DOCKER__notion-update-database-item` | Update database items |
| `mcp__MCP_DOCKER__notion-delete-database-item` | Remove database items |
| `mcp__MCP_DOCKER__notion-query-database-item` | Query specific items |
| `mcp__MCP_DOCKER__notion-retrieve-database` | Get database schema |
| `mcp__MCP_DOCKER__notion-retrieve-user` | Get user info |
| `mcp__MCP_DOCKER__notion-list-users` | List workspace users |
| `mcp__MCP_DOCKER__notion-retrieve-comments` | Get page comments |
| `mcp__MCP_DOCKER__notion-create-comment` | Add comments |
| `mcp__MCP_DOCKER__notion-update-comment` | Edit comments |
| `mcp__MCP_DOCKER__notion-retrieve-a-block` | Get specific block |
| `mcp__MCP_DOCKER__notion-update-a-block` | Update blocks |
| `mcp__MCP_DOCKER__notion-delete-a-block` | Remove blocks |

---

## Common Workflows

### 1. Sync Epic to Notion Project

```javascript
// Read local epic file
const epicContent = await readFile('_bmad-output/planning-artifacts/epics-07.md');

// Create Notion project
mcp__MCP_DOCKER__notion-create-page({
  parent: { database_id: "831770c6-ac7f-4c4c-802b-b78b-e4e9e3eb" },
  properties: {
    "Name": { title: [{ text: { content: "OpenAgents Control Registry" } }] },
    "Status": { select: { name: "Active" } },
    "Priority": { select: { name: "P0" } },
    "Type": { select: { name: "Epic" } }
  },
  children: [
    {
      object: "block",
      type: "paragraph",
      paragraph: {
        rich_text: [{ text: { content: epicContent } }]
      }
    }
  ]
})
```

### 2. Query Tasks by Status

```javascript
// Get all "In Progress" tasks
mcp__MCP_DOCKER__notion-query-database({
  database_id: "52c1cdfc-e1d8-4a1a-aee4-2462-ca369f3b",
  filter: {
    property: "Status",
    select: { equals: "In Progress" }
  }
})
```

### 3. Update Task Status

```javascript
// Mark task as completed
mcp__MCP_DOCKER__notion-update-page({
  page_id: "TASK_PAGE_ID",
  properties: {
    "Status": { select: { name: "Done" } },
    "Completed Date": { date: { start: new Date().toISOString() } }
  }
})
```

### 4. Search for Insights

```javascript
// Find promoted insights
mcp__MCP_DOCKER__notion-search({
  query: "ADR pattern architecture",
  filter: {
    property: "object",
    value: "page"
  }
})
```

### 5. Create HITL Approval Entry

```javascript
// Add to Changes database
mcp__MCP_DOCKER__notion-create-page({
  parent: { database_id: "7b1a6244-347c-44fe-a492-f043c947ea4a" },
  properties: {
    "Name": { title: [{ text: { content: "Proposal: ADR-042 Update" } }] },
    "Status": { select: { name: "Pending" } },
    "Type": { select: { name: "Knowledge Promotion" } },
    "Priority": { select: { name: "P1" } }
  }
})
```

---

## Database Schemas

### Projects Database
```javascript
{
  "Name": "title",
  "Status": "select['Planning', 'Active', 'Blocked', 'Completed']",
  "Priority": "select['P0', 'P1', 'P2', 'P3']",
  "Type": "select['Epic', 'Initiative', 'Task', 'Maintenance']",
  "Owner": "people",
  "Target Date": "date",
  "Estimate (hours)": "number",
  "Progress": "number",
  "Notes": "rich_text"
}
```

### Tasks Database
```javascript
{
  "Name": "title",
  "Status": "select['Todo', 'In Progress', 'Blocked', 'Review', 'Done']",
  "Priority": "select['P0', 'P1', 'P2', 'P3']",
  "Project": "relation[Projects]",
  "Epic": "rich_text",
  "Story": "rich_text",
  "Type": "select['Code', 'Docs', 'Test', 'Review']",
  "Estimate (hours)": "number",
  "Dependencies": "relation[Tasks]"
}
```

### Insights Database
```javascript
{
  "Name": "title",
  "Type": "select['ADR', 'Pattern', 'Decision', 'Lesson']",
  "Confidence": "number",
  "Group ID": "rich_text",
  "Source": "rich_text",
  "Superseded By": "relation[Insights]",
  "Content": "rich_text"
}
```

---

## Integration with Memory Graph

### Sync Memory → Notion

```javascript
// 1. Query memory graph
const memoryResults = await mcp__MCP_DOCKER__search_nodes({ 
  query: "architecture decision" 
});

// 2. Create Notion insight for each
for (const entity of memoryResults.entities) {
  await mcp__MCP_DOCKER__notion-create-page({
    parent: { database_id: "INSIGHTS_DB_ID" },
    properties: {
      "Name": { title: [{ text: { content: entity.name } }] },
      "Type": { select: { name: "Pattern" } },
      "Content": { 
        rich_text: [{ 
          text: { content: entity.observations.join("\n") } 
        }] 
      }
    }
  });
}
```

### Sync Notion → Memory

```javascript
// 1. Query approved changes
const approvedChanges = await mcp__MCP_DOCKER__notion-query-database({
  database_id: "CHANGES_DB_ID",
  filter: {
    property: "Status",
    select: { equals: "Approved" }
  }
});

// 2. Store in memory graph
for (const change of approvedChanges.results) {
  await mcp__MCP_DOCKER__create_entities({
    entities: [{
      name: change.properties.Name.title[0].text.content,
      entityType: "Approved Change",
      observations: [
        `Approved on: ${change.properties['Decision Date'].date.start}`,
        `Type: ${change.properties.Type.select.name}`
      ]
    }]
  });
}
```

---

## Tag Governance

**CRITICAL**: Your project uses canonical tag governance:

```typescript
// canonical_tag = system slug (Neo4j, PostgreSQL, group_id)
// display_tag = human label (Notion multi-select)

const TAG_MAPPINGS = [
  { canonical: "difference-driven", display: "Difference driven", project: "Difference Driven" },
  { canonical: "faith-meats", display: "Faith meats", project: "Faith Meats" },
  { canonical: "patriot-awning", display: "patriot-awning", project: "Patriot Awning" },
  { canonical: "global-coding-skills", display: "global-coding-skills", project: "Global Coding Skills" }
];
```

**Rule**: NEVER use spaces in canonical tags. ALWAYS derive display from canonical.

---

## Environment Setup

Required environment variables:
```bash
NOTION_KNOWLEDGE_DB_ID=your-knowledge-db-id
NOTION_INSIGHTS_DB_ID=your-insights-db-id
NOTION_INTERNAL_INTEGRATION_TOKEN=secret_xxx
```

Add to MCP settings:
```json
{
  "mcpServers": {
    "notion": {
      "command": "npx",
      "args": ["-y", "@notionhq/notion-mcp-server"],
      "env": {
        "NOTION_INTERNAL_INTEGRATION_TOKEN": "${NOTION_INTERNAL_INTEGRATION_TOKEN}"
      }
    }
  }
}
```

---

## Quick Reference

### Status Mappings

| Local | Notion |
|-------|--------|
| `ready-for-dev` | `Todo` |
| `📍 Current` / `In Progress` | `In Progress` |
| `🚧 Blocked` | `Blocked` |
| `🔍 Review` | `Review` |
| `✅ Completed` | `Done` |

### Priority Mappings

| Local | Notion |
|-------|--------|
| `P0` / `Critical` | `P0` |
| `P1` / `High` | `P1` |
| `P2` / `Medium` | `P2` |
| `P3` / `Low` | `P3` |

---

## Best Practices

1. **Always use canonical tags** in code, derive display for Notion
2. **Sync bidirectionally**: Memory ↔ Notion ↔ PostgreSQL/Neo4j
3. **HITL required**: Never auto-promote to Notion without approval
4. **Log sync operations**: Track in Sync Registry database
5. **Group isolation**: Always include `group_id` in database queries

---

*Generated from archive/notion-mapping.md and src/mcp/memory-server.ts*
