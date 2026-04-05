# Tech Spec: Notion Workspace Hydration Scripts

**Status**: Ready for Implementation  
**Date**: 2026-04-04  
**Priority**: P0  
**Depends on**: Epic 7 (OpenAgents Control Registry)  
**Blocks**: None  

---

## Technical Overview

This tech spec defines the implementation details for Notion workspace hydration scripts that will populate the Allura Memory Notion databases with Tasks, Agents, Skills, and Changes entries from local source files.

---

## Architecture

### Component Design

```
/scripts/hydration/
├── notion-client.ts          # MCP_DOCKER Notion API wrapper
├── parse-epic-stories.ts     # Epic file parser
├── parse-agent-files.ts      # Agent markdown parser
├── parse-skill-files.ts      # Skill markdown parser
├── transform-to-notion.ts    # Property transformation layer
├── create-tasks.ts           # Tasks database hydration
├── create-agents.ts          # Agents database hydration
├── create-skills.ts           # Skills database hydration
├── seed-changes.ts            # Changes queue seeding (ADR-001)
├── approve-adr.ts             # HITL approval script
└── hydration-runner.ts        # Orchestration runner
```

### Data Flow

```
┌─────────────────────────────────────────────────────────────┐
│                    SOURCE FILES                              │
├─────────────────────────────────────────────────────────────┤
│                                                               │
│  docs/planning-artifacts/epic-7-*.md                         │
│    └─→ parse-epic-stories.ts → stories[]                    │
│                                                               │
│  .opencode/agent/**/*.md (26 files)                          │
│    └─→ parse-agent-files.ts → agents[]                      │
│                                                               │
│  .opencode/skills/*/SKILL.md (98 files)                     │
│    └─→ parse-skill-files.ts → skills[]                      │
│                                                               │
│  docs/architecture/adr-001-*.md                              │
│    └─→ seed-changes.ts → change{}                           │
│                                                               │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                  TRANSFORMATION LAYER                         │
├─────────────────────────────────────────────────────────────┤
│                                                               │
│  transform-to-notion.ts                                      │
│    ├─→ toNotionTitle()                                       │
│    ├─→ toNotionSelect()                                       │
│    ├─→ toNotionMultiSelect()                                  │
│    ├─→ toNotionRelation()                                     │
│    └─→ toNotionDate()                                         │
│                                                               │
│  Validation: Zod schemas (TaskSchema, AgentSchema, etc.)     │
│                                                               │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                  NOTION API LAYER                             │
├─────────────────────────────────────────────────────────────┤
│                                                               │
│  notion-client.ts                                            │
│    ├─→ createNotionPage(database_id, properties)            │
│    ├─→ queryNotionDatabase(view_url)                        │
│    └─→ fetchNotionDatabase(database_id)                     │
│                                                               │
│  Tools: MCP_DOCKER_notion-create-pages                       │
│         MCP_DOCKER_notion-query-database-view                │
│         MCP_DOCKER_notion-fetch                               │
│                                                               │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│              NOTION DATABASES (Session 1 Created)            │
├─────────────────────────────────────────────────────────────┤
│                                                               │
│  Tasks (6285882c-82a7-4fe2-abc5-7dbeb344b1d4)               │
│    └─→ 10 stories from Epic 7                               │
│                                                               │
│  Agents (64d76811-67fe-4b83-aa4b-cfb01eb69e59)              │
│    └─→ 26 agents from .opencode/agent/                      │
│                                                               │
│  Skills (9074224b-4d8f-4ce1-9b08-f7be47039fe8)              │
│    └─→ 98 skills from .opencode/skills/                     │
│                                                               │
│  Changes (4fb793a1-4e82-4990-80f6-b1b4e750c630)             │
│    └─→ ADR-001 promotion request                            │
│                                                               │
│  Projects (3381d9be-65b3-814d-a97e-c7edaf5722f0)            │
│    └─→ Allura Memory (seeded in Session 1)                  │
│                                                               │
└─────────────────────────────────────────────────────────────┘
```

---

## Parser Modules

### 1. Epic Parser (`parse-epic-stories.ts`)

**Purpose**: Extract story entries from epic markdown files.

**Input**: Epic file path (e.g., `docs/planning-artifacts/epic-7-*.md`)

**Output**: Array of `Story` objects

**Algorithm**:
```typescript
1. Read epic file
2. Extract epic ID from filename (epic-7 -> "7")
3. Extract epic title from first heading
4. Parse frontmatter for stepsCompleted array
5. Extract stories from markdown table
   - Pattern: | Story ID | Title | Estimate | Priority |
6. Map story statuses:
   - In stepsCompleted -> "Done"
   - Otherwise -> "Todo"
7. Return { epicId, epicTitle, stories[] }
```

**Status Mapping**:
| File Pattern | Status |
|---------------|--------|
| `stepsCompleted` includes story | "Done" |
| `ready-for-dev` in frontmatter | "Todo" |
| `backlog` in frontmatter | "Todo" |
| `in-progress` in frontmatter | "In Progress" |
| `blocked` in frontmatter | "Blocked" |

### 2. Agent Parser (`parse-agent-files.ts`)

**Purpose**: Extract agent metadata from markdown files with YAML frontmatter.

**Input**: Agent file path (e.g., `.opencode/agent/core/openagent.md`)

**Output**: `ParsedAgent` object

**Algorithm**:
```typescript
1. Read agent file
2. Extract YAML frontmatter between --- delimiters
3. Parse YAML to object
4. Extract role from first ## heading after frontmatter
5. Determine agent type:
   - mode === "primary" -> "OpenAgent"
   - mode === "subagent" -> "Specialist"
   - Otherwise -> "Worker"
6. Extract skills from permissions.task
   - Filter by "allow" value
7. Return ParsedAgent
```

**Categorization**:
| Directory | Category | Subcategory |
|-----------|----------|-------------|
| `core/` | "core" | undefined |
| `subagents/code/` | "code" | "subagents" |
| `subagents/core/` | "core" | "subagents" |
| `subagents/system-builder/` | "system-builder" | "subagents" |
| `subagents/development/` | "development" | "subagents" |
| `subagents/utils/` | "utils" | "subagents" |
| `data/` | "data" | undefined |
| `content/` | "content" | undefined |
| `meta/` | "meta" | undefined |
| `eval-runner.md` | "meta" | undefined |

### 3. Skill Parser (`parse-skill-files.ts`)

**Purpose**: Extract skill metadata from SKILL.md files.

**Input**: Skill file path (e.g., `.opencode/skills/memory-query/SKILL.md`)

**Output**: `ParsedSkill` object

**Algorithm**:
```typescript
1. Read SKILL.md file
2. Extract YAML frontmatter
3. Parse to object
4. Categorize by name pattern:
   - Prefix "memory-" -> "context"
   - Prefix "bmad-" -> "governance"
   - Prefix "wds-" -> "governance"
   - Contains "test" -> "testing"
   - Contains "review" -> "review"
   - Default -> "context"
5. Return ParsedSkill
```

**Category Rules**:
| Pattern | Category |
|---------|----------|
| `memory-*` | "context" |
| `bmad-*` | "governance" |
| `wds-*` | "governance" |
| `testarch-*` | "testing" |
| `*test*` | "testing" |
| `*review*` | "review" |
| `*deploy*` | "deployment" |
| `*search*` | "research" |
| `*write*` | "writing" |
| Default | "context" |

---

## Transformation Layer

### Notion Property Mappers (`transform-to-notion.ts`)

**Title Property**:
```typescript
export function toNotionTitle(title: string) {
  return {
    title: [{ text: { content: title.substring(0, 100) } }]
  };
}
```

**Select Property**:
```typescript
export function toNotionSelect(value: string) {
  return { select: { name: value } };
}
```

**Multi-Select Property**:
```typescript
export function toNotionMultiSelect(items: string[]) {
  return {
    multi_select: items.map(item => ({ name: item }))
  };
}
```

**Relation Property**:
```typescript
export function toNotionRelation(ids: string | string[]) {
  const idArray = Array.isArray(ids) ? ids : [ids];
  return { relation: idArray.map(id => ({ id })) };
}
```

**Date Property**:
```typescript
export function toNotionDate(date: Date | string | undefined) {
  if (!date) return null;
  const dateStr = typeof date === 'string' ? date : date.toISOString();
  return { date: { start: dateStr } };
}
```

---

## Notion Client (`notion-client.ts`)

### Database ID Constants

```typescript
const DATABASE_IDS = {
  projects: '3381d9be-65b3-814d-a97e-c7edaf5722f0',
  tasks: '6285882c-82a7-4fe2-abc5-7dbeb344b1d4',
  agents: '64d76811-67fe-4b83-aa4b-cfb01eb69e59',
  skills: '9074224b-4d8f-4ce1-9b08-f7be47039fe8',
  changes: '4fb793a1-4e82-4990-80f6-b1b4e750c630',
  syncRegistry: '4a893b2c-1234-5678-90ab-cdef12345678',
  runs: '5c904c3d-2345-6789-01bc-def23456789a',
  insights: '6d015d4e-3456-7890-12cd-ef34567890ab',
  frameworks: '7e126f5f-4567-8901-23de-fg45678901bc',
  commands: '8f237g6g-5678-9012-34ef-gh56789012cd',
  workflows: '9a348h7h-6789-0123-45fg-hi67890123de',
} as const;
```

### MCP_DOCKER Integration

```typescript
// Create page wrapper
export async function createNotionPage(
  databaseId: string,
  properties: Record<string, unknown>
): Promise<string> {
  const response = await MCP_DOCKER_notion_create_pages({
    parent: { database_id: databaseId },
    pages: [{ properties }],
  });
  
  const pageId = response.results?.[0]?.id;
  if (!pageId) {
    throw new Error('Failed to create Notion page');
  }
  return pageId;
}

// Query database wrapper
export async function queryNotionDatabase(
  viewUrl: string
): Promise<Array<Record<string, unknown>>> {
  const response = await MCP_DOCKER_notion_query_database_view({ 
    view_url: viewUrl 
  });
  return response.results || [];
}

// Fetch database schema
export async function fetchNotionDatabase(databaseId: string) {
  const response = await MCP_DOCKER_notion_fetch({ id: databaseId });
  return {
    schema: response.database?.schema || {},
    dataSources: response.data_sources || [],
  };
}
```

### Rate Limiting

Notion API rate limit: 3 requests/second

```typescript
import { setTimeout } from 'timers/promises';

async function withRetry<T>(
  fn: () => Promise<T>,
  retries: number = 3,
  delay: number = 1000
): Promise<T> {
  for (let i = 0; i < retries; i++) {
    try {
      return await fn();
    } catch (error: any) {
      if (error.status === 429 && i < retries - 1) {
        await setTimeout(delay * (i + 1)); // Exponential backoff
        continue;
      }
      throw error;
    }
  }
  throw new Error('Max retries exceeded');
}
```

---

## Hydration Scripts

### Tasks Hydration (`create-tasks.ts`)

**Flow**:
```
1. Find epic files (docs/planning-artifacts/epic-*.md)
2. For each epic:
   a. Parse epic file
   b. For each story:
      i. Transform to Notion properties
      ii. Create page in Tasks database
      iii. Link to Project (Allura Memory)
3. Return summary
```

**Error Handling**:
- Duplicate detection (skip existing)
- API retry on rate limit (429)
- Graceful degradation (continue on error)

### Agents Hydration (`create-agents.ts`)

**Flow**:
```
1. Find agent files (.opencode/agent/**/*.md)
2. For each agent:
   a. Parse frontmatter
   b. Categorize by directory
   c. Transform to Notion properties
   d. Create page in Agents database
3. Return summary
```

**Permissions Mapping**:
```typescript
// Extract allowed subagents from permissions.task
const skills = Object.keys(agent.permissions.task || {})
  .filter(k => agent.permissions.task[k] === 'allow');
```

### Skills Hydration (`create-skills.ts`)

**Flow**:
```
1. Find skill files (.opencode/skills/*/SKILL.md)
2. For each skill:
   a. Parse frontmatter
   b. Categorize by name pattern
   c. Transform to Notion properties
   d. Create page in Skills database
3. Group by category for logging
4. Return summary
```

**Category Breakdown**:
```
context: 12 skills (memory-*, context7, multi-search)
governance: 50 skills (bmad-*, wds-*)
testing: 15 skills (testarch-*, *test*)
review: 8 skills (*review*, *audit*)
deployment: 5 skills (*deploy*, *security*)
writing: 5 skills (*write*, *doc*)
research: 3 skills (*search*, *research*)
```

### Changes Seeding (`seed-changes.ts`)

**ADR-001 Data**:
```typescript
const ADR_001_DATA = {
  name: 'ADR-001: Requirements Traceability Matrix Architecture',
  status: 'Pending Approval',
  changeType: 'Policy Change',
  riskLevel: 'High',
  source: 'Human Input',
  summary: 'Implement three-tier RTM to maintain conceptual integrity...',
  affectedComponents: ['agent', 'skill', 'policy', 'knowledge'],
  aerReference: '9830faf7-9a23-446d-8ee4-1e175c132576',
};
```

### HITL Approval (`approve-adr.ts`)

**Flow**:
```
1. Fetch Changes database
2. Find ADR-001 entry
3. Display approval prompt
4. Wait for human confirmation
5. Update status to "Approved"
6. Set Approved At timestamp
7. Log approval event
```

---

## Type Definitions

### Zod Schemas (`notion-client.ts`)

```typescript
import { z } from 'zod';

export const TaskSchema = z.object({
  name: z.string(),
  status: z.enum(['Todo', 'In Progress', 'Blocked', 'Review', 'Done', 'Canceled']),
  priority: z.enum(['P0', 'P1', 'P2', 'P3']),
  type: z.enum(['Documentation', 'Code', 'Test', 'Review', 'Ops', 'Research']),
  tags: z.array(z.string()).optional(),
  projectId: z.string().optional(),
  frameworkIds: z.array(z.string()).optional(),
  dueDate: z.string().optional(),
});

export const AgentSchema = z.object({
  name: z.string(),
  type: z.enum(['OpenAgent', 'Specialist', 'Worker']),
  status: z.enum(['active', 'idle', 'error', 'deprecated']),
  role: z.string(),
  groupId: z.string().default('roninmemory'),
  skills: z.array(z.string()).optional(),
  tokenBudget: z.number().optional(),
  usdBudget: z.number().optional(),
  lastHeartbeat: z.string().optional(),
});

export const SkillSchema = z.object({
  name: z.string(),
  description: z.string(),
  category: z.enum(['context', 'research', 'writing', 'testing', 'review', 'governance', 'deployment']),
  status: z.enum(['active', 'deprecated', 'experimental']),
  filePath: z.string(),
  requiredTools: z.array(z.string()).optional(),
  usageCount: z.number().default(0),
  lastUsed: z.string().optional(),
});

export const ChangeSchema = z.object({
  name: z.string(),
  status: z.enum(['Draft', 'Pending Approval', 'Approved', 'Rejected', 'Promoted']),
  changeType: z.enum(['Agent Design', 'Insight Promotion', 'Skill Addition', 'Command Update', 'Policy Change']),
  riskLevel: z.enum(['Low', 'Medium', 'High']),
  source: z.enum(['ADAS Discovery', 'Curator', 'Human Input', 'Sync Drift']),
  summary: z.string(),
  affectedComponents: z.array(z.string()),
  projectId: z.string().optional(),
  aerReference: z.string().optional(),
  approvedBy: z.string().optional(),
  approvedAt: z.string().optional(),
});
```

---

## Edge Cases & Error Handling

### 1. Duplicate Entries

**Problem**: Running hydration twice creates duplicates.

**Solution**:
```typescript
async function checkDuplicate(name: string, databaseId: string): Promise<boolean> {
  const results = await queryNotionDatabase(
    `https://notion.so/workspace/DB-${databaseId}?v=all`
  );
  return results.some((r: any) => 
    r.properties?.Name?.title?.[0]?.text?.content === name
  );
}

// Before creating
if (await checkDuplicate(taskName, DATABASE_IDS.tasks)) {
  console.log(`Skipping duplicate: ${taskName}`);
  result.skipped++;
  continue;
}
```

### 2. Missing Project

**Problem**: Project ID doesn't exist (Session 1 not run).

**Solution**:
```typescript
async function verifyProject(projectId: string): Promise<boolean> {
  try {
    await fetchNotionDatabase(projectId);
    return true;
  } catch {
    return false;
  }
}

const projectExists = await verifyProject(PROJECT_ID);
if (!projectExists) {
  throw new Error(
    `Project ${PROJECT_ID} not found. Run Session 1 seeding first.`
  );
}
```

### 3. Malformed Frontmatter

**Problem**: YAML parsing fails on malformed frontmatter.

**Solution**:
```typescript
function parseAgentFile(filePath: string): ParsedAgent | null {
  try {
    // Existing parsing logic
  } catch (error) {
    console.warn(`Failed to parse ${filePath}: ${error}`);
    console.warn('Using minimal defaults');
    
    return {
      filename: path.basename(filePath),
      filePath,
      name: path.basename(path.dirname(filePath)),
      description: 'Agent description unavailable',
      mode: 'subagent',
      temperature: 0.2,
      permissions: { bash: {}, edit: {} },
    };
  }
}
```

### 4. Notion API Errors

**Problem**: Rate limits, network errors, malformed requests.

**Solution**:
```typescript
async function createNotionPage(...): Promise<string> {
  return withRetry(
    () => MCP_DOCKER_notion_create_pages(...),
    3,  // retries
    1000  // delay (ms)
  );
}
```

---

## Testing Strategy

### Unit Tests

**Parser Tests** (`parse-epic-stories.test.ts`):
- Parse epic file correctly
- Extract story table
- Map statuses correctly

**Transformer Tests** (`transform-to-notion.test.ts`):
- Title truncation
- Select formatting
- Multi-select formatting
- Relation formatting

### Integration Tests

**Hydration Scripts** (`hydration-runner.test.ts`):
- End-to-end execution
- Error handling
- Duplicate detection
- Rate limit retry

### Test Commands

```bash
# Run all unit tests
bun vitest run scripts/hydration/

# Run specific test
bun vitest run scripts/hydration/parse-epic-stories.test.ts

# Run with coverage
bun vitest run --coverage scripts/hydration/
```

---

## Verification

After running `bun scripts/hydration-runner.ts`:

### Tasks Database
- [ ] All stories from Epic 7 present
- [ ] Status matches `stepsCompleted`
- [ ] Priority mapped correctly
- [ ] Project relation set

### Agents Database
- [ ] All 26 agents present
- [ ] Type correct (OpenAgent vs Specialist)
- [ ] Status is "active"
- [ ] Group ID is "roninmemory"
- [ ] Skills array populated

### Skills Database
- [ ] All 98 skills present
- [ ] Category correctly assigned
- [ ] Status is "active"
- [ ] File path correct

### Changes Database
- [ ] ADR-001 entry exists
- [ ] Status is "Pending Approval" (initially)
- [ ] Risk Level is "High"
- [ ] AER Reference matches
- [ ] Affected Components set

---

## Dependencies

### Runtime Dependencies
- `yaml` - YAML parser for frontmatter
- `zod` - Schema validation
- `@notionhq/client` - Notion API (via MCP_DOCKER)

### Development Dependencies
- `vitest` - Test framework
- `@types/node` - TypeScript types

---

## Execution Sequence

```
bun scripts/hydration-runner.ts

1. Verify prerequisites (Session 1 complete)
2. Hydrate Tasks (Epic 7 stories)
3. Hydrate Agents (26 files)
4. Hydrate Skills (98 files)
5. Seed ADR-001 to Changes
6. Approve ADR-001 (HITL)
7. Report summary
8. Exit with code 0 (success) or 1 (errors)
```

---

**Status**: ✅ Ready for Implementation  
**Next**: Execute implementation plan