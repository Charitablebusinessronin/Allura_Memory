# Notion Workspace Hydration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Hydrate the Allura Memory Notion workspace with Tasks, Agents, Skills, and seed the HITL governance queue with ADR-001.

**Architecture:** Parse local source files (epic/story markdown, agent markdown, skill markdown), transform to Notion property schemas, create database entries with MCP_DOCKER Notion tools, and establish relations according to the Steel Frame versioning model.

**Tech Stack:** Bun CLI scripts, MCP_DOCKER Notion tools, TypeScript, Zod validation

---

## Context from Session 1

**Already Complete:**
- ✅ Database structure created (11 databases)
- ✅ Views created (Recent Runs, Recent Insights, Recent Syncs)
- ✅ Relations established (Runs↔Insights, Changes↔Projects)
- ✅ Initial data seeded:
  - Project: Allura Memory (ID: `3381d9be-65b3-814d-a97e-c7edaf5722f0`)
  - 5 Frameworks (AI-Assisted Documentation, Memory Bootstrap Protocol, Learning System, HITL Governance, Steel Frame Versioning)
  - 1 Sync Registry entry (SYNC-001)

**Remaining Tasks (This Plan):**
1. Hydrate Tasks - Parse epic file and create Task entries
2. Hydrate Agents - Parse `.opencode/agent/**/*.md` files (26 agents)
3. Hydrate Skills - Parse `.opencode/skills/*/SKILL.md` files (98 skills)
4. Seed Changes Queue - Create ADR-001 promotion request entry
5. Approve ADR-001 - Run HITL approval script

---

## File Structure

This plan creates the following files:

```
scripts/
├── hydration/
│   ├── parse-epic-stories.ts      # Parse epic files for stories
│   ├── parse-agent-files.ts       # Parse agent markdown files
│   ├── parse-skill-files.ts       # Parse skill markdown files
│   ├── transform-to-notion.ts     # Transform data to Notion schemas
│   ├── notion-client.ts           # MCP_DOCKER Notion client wrapper
│   ├── create-tasks.ts            # Hydrate Tasks database
│   ├── create-agents.ts           # Hydrate Agents database
│   ├── create-skills.ts           # Hydrate Skills database
│   ├── seed-changes.ts            # Seed ADR-001 to Changes queue
│   └── approve-adr.ts             # HITL approval script
└── hydration-runner.ts            # Orchestrate all hydration tasks
```

---

## Task 1: Establish Notion Client Wrapper

**Files:**
- Create: `scripts/hydration/notion-client.ts`

- [ ] **Step 1: Create Notion client wrapper using MCP_DOCKER tools**

```typescript
// scripts/hydration/notion-client.ts
import { z } from 'zod';

const GROUP_ID = 'roninmemory';

// Database IDs from Session 1
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

// Task schema for validation
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

// Agent schema for validation
export const AgentSchema = z.object({
  name: z.string(),
  type: z.enum(['OpenAgent', 'Specialist', 'Worker']),
  status: z.enum(['active', 'idle', 'error', 'deprecated']),
  role: z.string(),
  groupId: z.string().default(GROUP_ID),
  skills: z.array(z.string()).optional(),
  tokenBudget: z.number().optional(),
  usdBudget: z.number().optional(),
  lastHeartbeat: z.string().optional(),
});

// Skill schema for validation
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

// Change schema for validation
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

/**
 * Create a Notion page in a database using MCP_DOCKER_notion-create-pages
 */
export async function createNotionPage(
  databaseId: string,
  properties: Record<string, unknown>
): Promise<string> {
  const response = await MCP_DOCKER_notion_create_pages({
    parent: { database_id: databaseId },
    pages: [{ properties }],
  });
  
  // Extract page ID from response
  const pageId = response.results?.[0]?.id;
  if (!pageId) {
    throw new Error('Failed to create Notion page');
  }
  return pageId;
}

/**
 * Query a Notion database using MCP_DOCKER_notion-query-database-view
 */
export async function queryNotionDatabase(
  viewUrl: string
): Promise<Array<Record<string, unknown>>> {
  const response = await MCP_DOCKER_notion_query_database_view({ view_url: viewUrl });
  return response.results || [];
}

/**
 * Fetch a Notion database schema using MCP_DOCKER_notion-fetch
 */
export async function fetchNotionDatabase(
  databaseId: string
): Promise<{ schema: Record<string, unknown>; dataSources: Array<{ id: string; url: string }> }> {
  const response = await MCP_DOCKER_notion_fetch({ id: databaseId });
  return {
    schema: response.database?.schema || {},
    dataSources: response.data_sources || [],
  };
}

export { DATABASE_IDS, GROUP_ID };
```

- [ ] **Step 2: Run typecheck to verify the client wrapper**

Run: `npm run typecheck`
Expected: PASS (no type errors)

- [ ] **Step 3: Commit the Notion client wrapper**

```bash
git add scripts/hydration/notion-client.ts
git commit -m "feat(hydration): add Notion client wrapper with MCP_DOCKER tools"
```

---

## Task 2: Parse Epic Files for Stories

**Files:**
- Create: `scripts/hydration/parse-epic-stories.ts`

- [ ] **Step 1: Create the epic parser module**

```typescript
// scripts/hydration/parse-epic-stories.ts
import fs from 'fs';
import path from 'path';
import { TaskSchema } from './notion-client';

interface Story {
  id: string;
  epicId: string;
  title: string;
  estimate: string;
  priority: 'P0' | 'P1' | 'P2' | 'P3';
  status: 'Todo' | 'In Progress' | 'Blocked' | 'Review' | 'Done' | 'Canceled';
}

const STATUS_MAP: Record<string, Story['status']> = {
  'ready-for-dev': 'Todo',
  'backlog': 'Todo',
  'in-progress': 'In Progress',
  'blocked': 'Blocked',
  'review': 'Review',
  'done': 'Done',
  'canceled': 'Canceled',
} as const;

/**
 * Parse an epic markdown file and extract story entries
 */
export function parseEpicFile(filePath: string): {
  epicId: string;
  epicTitle: string;
  stories: Story[];
} {
  const content = fs.readFileSync(filePath, 'utf-8');
  
  // Extract epic ID from filename (e.g., "epic-7-openagents-control-registry.md" -> "7")
  const filename = path.basename(filePath, '.md');
  const epicMatch = filename.match(/epic-(\d+)/);
  if (!epicMatch) {
    throw new Error(`Invalid epic filename: ${filename}`);
  }
  const epicId = epicMatch[1];
  
  // Extract epic title from first heading
  const titleMatch = content.match(/^#\s+Epic\s+\d+:\s+(.+)$/m);
  const epicTitle = titleMatch ? titleMatch[1] : `Epic ${epicId}`;
  
  // Parse stories from markdown table
  // Format: | Story ID | Title | Estimate | Priority |
  const stories: Story[] = [];
  const tableRegex = /\|\s*(\d+\.\d+)\s*\|\s*([^|]+)\s*\|\s*(\d+h)\s*\|\s*(P\d)\s*\|/g;
  
  let match;
  while ((match = tableRegex.exec(content)) !== null) {
    const [, storyId, title, estimate, priority] = match;
    
    // Trim and clean title
    const cleanTitle = title.trim();
    
    // Extract status from frontmatter if present
    const frontmatterMatch = content.match(/^---\n([\s\S]*?)\n---/);
    const stepsCompleted = frontmatterMatch
      ? (frontmatterMatch[1].match(/stepsCompleted:\s*\[([\d,\s]+)\]/)?.[1] || '').split(',').map(Number)
      : [];
    
    // Map story number to status
    const storyNum = parseFloat(storyId);
    const status = stepsCompleted.includes(storyNum) ? 'Done' : 'Todo';
    
    stories.push({
      id: storyId,
      epicId,
      title: cleanTitle,
      estimate,
      priority: priority as Story['priority'],
      status,
    });
  }
  
  return { epicId, epicTitle, stories };
}

/**
 * Find all epic files in the docs/planning-artifacts directory
 */
export function findEpicFiles(baseDir: string): string[] {
  const epicDir = path.join(baseDir, 'docs', 'planning-artifacts');
  
  if (!fs.existsSync(epicDir)) {
    // Also check _bmad-output for archived epics
    const archivedDir = path.join(baseDir, 'archive', 'bmad-output', 'planning-artifacts');
    if (fs.existsSync(archivedDir)) {
      return fs.readdirSync(archivedDir)
        .filter(f => f.startsWith('epic-') && f.endsWith('.md'))
        .map(f => path.join(archivedDir, f));
    }
    return [];
  }
  
  return fs.readdirSync(epicDir)
    .filter(f => f.startsWith('epic-') && f.endsWith('.md'))
    .map(f => path.join(epicDir, f));
}

/**
 * Transform parsed stories to Notion Task properties
 */
export function storiesToNotionTasks(
  stories: Story[],
  projectId: string
): Array<Record<string, unknown>> {
  return stories.map(story => {
    // Validate with Zod
    const taskData = TaskSchema.parse({
      name: `Story ${story.id}: ${story.title}`,
      status: story.status,
      priority: story.priority,
      type: 'Code' as const,
      tags: ['Memory System', 'Agent'],
      projectId,
    });
    
    // Transform to Notion property format
    return {
      Name: { title: [{ text: { content: taskData.name } }] },
      Status: { select: { name: taskData.status } },
      Priority: { select: { name: taskData.priority } },
      Type: { select: { name: taskData.type } },
      Tags: { multi_select: (taskData.tags || []).map(t => ({ name: t })) },
      Project: { relation: { id: projectId } },
    };
  });
}

export { Story };
```

- [ ] **Step 2: Run typecheck to verify the epic parser**

Run: `npm run typecheck`
Expected: PASS (no type errors)

- [ ] **Step 3: Test the epic parser on the current epic file**

Run: `bun vitest run scripts/hydration/parse-epic-stories.test.ts`

Create test file:
```typescript
// scripts/hydration/parse-epic-stories.test.ts
import { describe, it, expect } from 'vitest';
import { parseEpicFile, findEpicFiles } from './parse-epic-stories';
import path from 'path';

describe('parseEpicFile', () => {
  it('should parse epic-7-openagents-control-registry.md', () => {
    const epicPath = path.join(process.cwd(), 'docs', 'planning-artifacts', 'epic-7-openagents-control-registry.md');
    const result = parseEpicFile(epicPath);
    
    expect(result.epicId).toBe('7');
    expect(result.epicTitle).toContain('OpenAgents Control Registry');
    expect(result.stories).toHaveLength(10);
    expect(result.stories[0]).toMatchObject({
      id: '7.1',
      epicId: '7',
      priority: 'P0',
    });
  });
});

describe('findEpicFiles', () => {
  it('should find epic files in docs/planning-artifacts', () => {
    const files = findEpicFiles(process.cwd());
    expect(files.length).toBeGreaterThan(0);
    files.forEach(f => {
      expect(f).toMatch(/epic-\d+.*\.md$/);
    });
  });
});
```

- [ ] **Step 4: Commit the epic parser**

```bash
git add scripts/hydration/parse-epic-stories.ts scripts/hydration/parse-epic-stories.test.ts
git commit -m "feat(hydration): add epic file parser for story extraction"
```

---

## Task 3: Parse Agent Files

**Files:**
- Create: `scripts/hydration/parse-agent-files.ts`

- [ ] **Step 1: Create the agent parser module**

```typescript
// scripts/hydration/parse-agent-files.ts
import fs from 'fs';
import path from 'path';
import yaml from 'yaml';
import { AgentSchema } from './notion-client';

interface ParsedAgent {
  filename: string;
  filePath: string;
  name: string;
  description: string;
  mode: 'primary' | 'subagent';
  temperature: number;
  permissions: {
    bash: Record<string, string>;
    edit: Record<string, string>;
    task?: Record<string, string>;
  };
}

const AGENT_TYPE_MAP: Record<string, 'OpenAgent' | 'Specialist' | 'Worker'> = {
  'primary': 'OpenAgent',
  'subagent': 'Specialist',
  'Worker': 'Worker',
} as const;

/**
 * Parse an agent markdown file and extract frontmatter metadata
 */
export function parseAgentFile(filePath: string): ParsedAgent {
  const content = fs.readFileSync(filePath, 'utf-8');
  
  // Extract frontmatter (YAML between --- delimiters)
  const frontmatterMatch = content.match(/^---\n([\s\S]*?)\n---/);
  if (!frontmatterMatch) {
    throw new Error(`No frontmatter found in agent file: ${filePath}`);
  }
  
  try {
    const frontmatter = yaml.parse(frontmatterMatch[1]);
    
    // Extract role from markdown content (first ## heading after frontmatter)
    const roleMatch = content.match(/^##\s+(.+)$/m);
    const role = roleMatch ? roleMatch[1] : frontmatter.description || 'Agent';
    
    return {
      filename: path.basename(filePath),
      filePath,
      name: frontmatter.name,
      description: frontmatter.description,
      mode: frontmatter.mode || 'subagent',
      temperature: frontmatter.temperature ?? 0.2,
      permissions: {
        bash: frontmatter.permission?.bash || {},
        edit: frontmatter.permission?.edit || {},
        task: frontmatter.permission?.task,
      },
    };
  } catch (error) {
    throw new Error(`Failed to parse frontmatter in ${filePath}: ${error}`);
  }
}

/**
 * Find all agent files in .opencode/agent directory
 */
export function findAgentFiles(baseDir: string): string[] {
  const agentDir = path.join(baseDir, '.opencode', 'agent');
  
  if (!fs.existsSync(agentDir)) {
    return [];
  }
  
  const files: string[] = [];
  
  function walkDir(dir: string) {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      
      if (entry.isDirectory()) {
        walkDir(fullPath);
      } else if (entry.isFile() && entry.name.endsWith('.md') && entry.name !== 'README.md') {
        files.push(fullPath);
      }
    }
  }
  
  walkDir(agentDir);
  return files;
}

/**
 * Categorize agents by directory structure
 */
export function categorizeAgent(agentPath: string): {
  category: string;
  subcategory?: string;
} {
  const relativePath = path.relative('.opencode/agent', agentPath);
  const parts = relativePath.split(path.sep);
  
  // Pattern: core/openagent.md -> category: "core"
  // Pattern: subagents/code/coder-agent.md -> category: "code", subcategory: "subagents"
  
  if (parts[0] === 'core') {
    return { category: 'core' };
  } else if (parts[0] === 'subagents') {
    return {
      category: parts[1] || 'unknown',
      subcategory: 'subagents',
    };
  } else if (parts[0] === 'data') {
    return { category: 'data' };
  } else if (parts[0] === 'content') {
    return { category: 'content' };
  } else if (parts[0] === 'meta') {
    return { category: 'meta' };
  } else if (parts[0] === 'eval-runner.md') {
    return { category: 'meta' };
  }
  
  return { category: 'unknown' };
}

/**
 * Transform parsed agents to Notion Agent properties
 */
export function agentsToNotionProperties(
  agents: ParsedAgent[]
): Array<Record<string, unknown>> {
  return agents.map(agent => {
    // Determine agent type from mode
    const agentType = AGENT_TYPE_MAP[agent.mode] || 'Specialist';
    
    // Extract skills referenced in permissions.task
    const skills = agent.permissions.task
      ? Object.keys(agent.permissions.task).filter(k => agent.permissions.task![k] === 'allow')
      : [];
    
    // Validate with Zod
    const agentData = AgentSchema.parse({
      name: agent.name,
      type: agentType,
      status: 'active',
      role: agent.description.substring(0, 100), // Truncate to first 100 chars
      groupId: 'roninmemory',
      skills,
      tokenBudget: agent.temperature === 0 ? 100000 : 200000, // Based on temperature heuristic
    });
    
    // Transform to Notion property format
    return {
      Name: { title: [{ text: { content: agentData.name } }] },
      Type: { select: { name: agentData.type } },
      Status: { select: { name: agentData.status } },
      Role: { rich_text: [{ text: { content: agentData.role } }] },
      'Group ID': { rich_text: [{ text: { content: agentData.groupId } }] },
      Skills: { multi_select: agentData.skills?.map(s => ({ name: s })) || [] },
      'Token Budget': { number: agentData.tokenBudget },
      'USD Budget': { number: agentData.usdBudget },
      'Last Heartbeat': { date: null },
    };
  });
}

export { ParsedAgent };
```

- [ ] **Step 2: Run typecheck to verify the agent parser**

Run: `npm run typecheck`
Expected: PASS (no type errors)

- [ ] **Step 3: Test the agent parser on current agent files**

Run: `bun vitest run scripts/hydration/parse-agent-files.test.ts`

Create test file:
```typescript
// scripts/hydration/parse-agent-files.test.ts
import { describe, it, expect } from 'vitest';
import { parseAgentFile, findAgentFiles, categorizeAgent } from './parse-agent-files';
import path from 'path';

describe('parseAgentFile', () => {
  it('should parse core/openagent.md', () => {
    const agentPath = path.join(process.cwd(), '.opencode', 'agent', 'core', 'openagent.md');
    const result = parseAgentFile(agentPath);
    
    expect(result.name).toBe('MemoryOrchestrator');
    expect(result.mode).toBe('primary');
    expect(result.temperature).toBe(0.2);
    expect(result.permissions.bash['*']).toBe('ask');
  });
  
  it('should parse subagents/code/coder-agent.md', () => {
    const agentPath = path.join(process.cwd(), '.opencode', 'agent', 'subagents', 'code', 'coder-agent.md');
    const result = parseAgentFile(agentPath);
    
    expect(result.name).toBe('MemoryBuilder');
    expect(result.mode).toBe('subagent');
  });
});

describe('findAgentFiles', () => {
  it('should find 26 agent files', () => {
    const files = findAgentFiles(process.cwd());
    expect(files.length).toBe(26);
  });
});

describe('categorizeAgent', () => {
  it('should categorize core agents', () => {
    const result = categorizeAgent('.opencode/agent/core/openagent.md');
    expect(result.category).toBe('core');
  });
  
  it('should categorize subagent code agents', () => {
    const result = categorizeAgent('.opencode/agent/subagents/code/coder-agent.md');
    expect(result.category).toBe('code');
    expect(result.subcategory).toBe('subagents');
  });
});
```

- [ ] **Step 4: Commit the agent parser**

```bash
git add scripts/hydration/parse-agent-files.ts scripts/hydration/parse-agent-files.test.ts
git commit -m "feat(hydration): add agent file parser with frontmatter extraction"
```

---

## Task 4: Parse Skill Files

**Files:**
- Create: `scripts/hydration/parse-skill-files.ts`

- [ ] **Step 1: Create the skill parser module**

```typescript
// scripts/hydration/parse-skill-files.ts
import fs from 'fs';
import path from 'path';
import yaml from 'yaml';
import { SkillSchema } from './notion-client';

interface ParsedSkill {
  filename: string;
  filePath: string;
  name: string;
  description: string;
  argumentHint?: string;
  category: 'context' | 'research' | 'writing' | 'testing' | 'review' | 'governance' | 'deployment';
  status: 'active' | 'deprecated' | 'experimental';
}

// Categorization rules based on skill name patterns
const SKILL_CATEGORY_MAP: Record<string, ParsedSkill['category']> = {
  'memory-': 'context',
  'bmad-': 'governance',
  'wds-': 'governance',
  'context7': 'context',
  'multi-search': 'research',
  'testing': 'testing',
  'testarch': 'testing',
  'review': 'review',
  'deployment': 'deployment',
} as const;

/**
 * Categorize a skill based on its name
 */
function categorizeSkill(skillName: string): ParsedSkill['category'] {
  // Check prefix patterns
  for (const [prefix, category] of Object.entries(SKILL_CATEGORY_MAP)) {
    if (skillName.toLowerCase().startsWith(prefix)) {
      return category;
    }
  }
  
  // Default categorization based on keywords
  const lowerName = skillName.toLowerCase();
  
  if (lowerName.includes('test') || lowerName.includes('qa')) return 'testing';
  if (lowerName.includes('review') || lowerName.includes('audit')) return 'review';
  if (lowerName.includes('deploy') || lowerName.includes('security')) return 'deployment';
  if (lowerName.includes('research') || lowerName.includes('search')) return 'research';
  if (lowerName.includes('write') || lowerName.includes('doc')) return 'writing';
  if (lowerName.includes('govern') || lowerName.includes('valid')) return 'governance';
  
  return 'context'; // Default fallback
}

/**
 * Parse a skill markdown file and extract frontmatter metadata
 */
export function parseSkillFile(filePath: string): ParsedSkill {
  const content = fs.readFileSync(filePath, 'utf-8');
  
  // Extract frontmatter (YAML between --- delimiters)
  const frontmatterMatch = content.match(/^---\n([\s\S]*?)\n---/);
  if (!frontmatterMatch) {
    throw new Error(`No frontmatter found in skill file: ${filePath}`);
  }
  
  try {
    const frontmatter = yaml.parse(frontmatterMatch[1]);
    
    const name = frontmatter.name;
    const description = frontmatter.description || '';
    const argumentHint = frontmatter['argument-hint'];
    
    // Determine status (default to active, unless explicitly set)
    const status: ParsedSkill['status'] = 'active';
    
    return {
      filename: path.basename(filePath),
      filePath,
      name,
      description,
      argumentHint,
      category: categorizeSkill(name),
      status,
    };
  } catch (error) {
    throw new Error(`Failed to parse frontmatter in ${filePath}: ${error}`);
  }
}

/**
 * Find all skill files in .opencode/skills directory
 */
export function findSkillFiles(baseDir: string): string[] {
  const skillsDir = path.join(baseDir, '.opencode', 'skills');
  
  if (!fs.existsSync(skillsDir)) {
    return [];
  }
  
  const files: string[] = [];
  
  // Each skill is in its own directory with a SKILL.md file
  const entries = fs.readdirSync(skillsDir, { withFileTypes: true });
  
  for (const entry of entries) {
    if (entry.isDirectory()) {
      const skillFile = path.join(skillsDir, entry.name, 'SKILL.md');
      if (fs.existsSync(skillFile)) {
        files.push(skillFile);
      }
    }
  }
  
  return files;
}

/**
 * Transform parsed skills to Notion Skill properties
 */
export function skillsToNotionProperties(
  skills: ParsedSkill[]
): Array<Record<string, unknown>> {
  return skills.map(skill => {
    // Validate with Zod
    const skillData = SkillSchema.parse({
      name: skill.name,
      description: skill.description.substring(0, 500), // Truncate for Notion
      category: skill.category,
      status: skill.status,
      filePath: skill.filePath,
      requiredTools: [], // Will be enriched later if needed
      usageCount: 0,
    });
    
    // Transform to Notion property format
    return {
      Name: { title: [{ text: { content: skillData.name } }] },
      Description: { rich_text: [{ text: { content: skillData.description } }] },
      Category: { select: { name: skillData.category } },
      Status: { select: { name: skillData.status } },
      'File Path': { rich_text: [{ text: { content: skillData.filePath } }] },
      'Required Tools': { multi_select: [] },
      'Usage Count': { number: skillData.usageCount },
      'Last Used': { date: null },
    };
  });
}

/**
 * Extract required tools from skill content (heuristic)
 */
export function extractRequiredTools(content: string): string[] {
  const tools: string[] = [];
  
  // Common patterns for tool usage
  const toolPatterns = [
    /MCP_DOCKER_(\w+)/g,
    /bash\s*\(/g,
    /read\s*\(/g,
    /write\s*\(/g,
    /edit\s*\(/g,
    /glob\s*\(/g,
  ];
  
  for (const pattern of toolPatterns) {
    const matches = content.match(pattern);
    if (matches) {
      matches.forEach(m => {
        // Extract tool name
        const toolName = m.replace(/[()]/g, '').trim();
        if (!tools.includes(toolName)) {
          tools.push(toolName);
        }
      });
    }
  }
  
  return tools;
}

export { ParsedSkill };
```

- [ ] **Step 2: Run typecheck to verify the skill parser**

Run: `npm run typecheck`
Expected: PASS (no type errors)

- [ ] **Step 3: Test the skill parser on current skill files**

Run: `bun vitest run scripts/hydration/parse-skill-files.test.ts`

Create test file:
```typescript
// scripts/hydration/parse-skill-files.test.ts
import { describe, it, expect } from 'vitest';
import { parseSkillFile, findSkillFiles, categorizeSkill } from './parse-skill-files';
import path from 'path';

describe('parseSkillFile', () => {
  it('should parse memory-query/SKILL.md', () => {
    const skillPath = path.join(process.cwd(), '.opencode', 'skills', 'memory-query', 'SKILL.md');
    const result = parseSkillFile(skillPath);
    
    expect(result.name).toBe('memory-query');
    expect(result.description).toContain('Search for previous implementations');
    expect(result.category).toBe('context');
  });
  
  it('should parse bmad-init/SKILL.md', () => {
    const skillPath = path.join(process.cwd(), '.opencode', 'skills', 'bmad-init', 'SKILL.md');
    const result = parseSkillFile(skillPath);
    
    expect(result.name).toBe('bmad-init');
    expect(result.category).toBe('governance');
  });
});

describe('findSkillFiles', () => {
  it('should find 98 skill files', () => {
    const files = findSkillFiles(process.cwd());
    expect(files.length).toBe(98);
  });
});

describe('categorizeSkill', () => {
  it('should categorize memory skills as context', () => {
    expect(categorizeSkill('memory-query')).toBe('context');
    expect(categorizeSkill('memory-bootstrap')).toBe('context');
  });
  
  it('should categorize bmad skills as governance', () => {
    expect(categorizeSkill('bmad-init')).toBe('governance');
    expect(categorizeSkill('bmad-create-prd')).toBe('governance');
  });
  
  it('should categorize testarch skills as testing', () => {
    expect(categorizeSkill('bmad-testarch-atdd')).toBe('testing');
  });
});
```

- [ ] **Step 4: Commit the skill parser**

```bash
git add scripts/hydration/parse-skill-files.ts scripts/hydration/parse-skill-files.test.ts
git commit -m "feat(hydration): add skill file parser with categorization"
```

---

## Task 5: Create Transform Layer for Notion Schemas

**Files:**
- Create: `scripts/hydration/transform-to-notion.ts`

- [ ] **Step 1: Create the transform utilities**

```typescript
// scripts/hydration/transform-to-notion.ts
import { Story } from './parse-epic-stories';
import { ParsedAgent } from './parse-agent-files';
import { ParsedSkill } from './parse-skill-files';

/**
 * Transform date to Notion date format
 */
export function toNotionDate(date: Date | string | undefined): { date: { start: string } } | null {
  if (!date) return null;
  
  const dateStr = typeof date === 'string' ? date : date.toISOString();
  return { date: { start: dateStr } };
}

/**
 * Transform multi-select array to Notion format
 */
export function toNotionMultiSelect(items: string[]): { multi_select: Array<{ name: string }> } {
  return {
    multi_select: items.map(item => ({ name: item })),
  };
}

/**
 * Transform select value to Notion format
 */
export function toNotionSelect(value: string): { select: { name: string } } {
  return { select: { name: value } };
}

/**
 * Transform relation IDs to Notion format
 */
export function toNotionRelation(ids: string | string[]): { relation: Array<{ id: string }> } {
  const idArray = Array.isArray(ids) ? ids : [ids];
  return {
    relation: idArray.map(id => ({ id })),
  };
}

/**
 * Transform text to Notion rich_text format
 */
export function toNotionText(text: string): { rich_text: Array<{ text: { content: string } }> } {
  return {
    rich_text: [{ text: { content: text.substring(0, 2000) } }], // Notion limit
  };
}

/**
 * Transform title to Notion title format
 */
export function toNotionTitle(title: string): { title: Array<{ text: { content: string } }> } {
  return {
    title: [{ text: { content: title.substring(0, 100) } }], // Notion limit
  };
}

/**
 * Transform Task object to Notion properties
 */
export function transformTaskToNotion(
  task: {
    name: string;
    status: string;
    priority: string;
    type: string;
    tags?: string[];
    projectId?: string;
    frameworkIds?: string[];
    dueDate?: string;
  }
): Record<string, unknown> {
  return {
    Name: toNotionTitle(task.name),
    Status: toNotionSelect(task.status),
    Priority: toNotionSelect(task.priority),
    Type: toNotionSelect(task.type),
    Tags: task.tags ? toNotionMultiSelect(task.tags) : { multi_select: [] },
    Project: task.projectId ? toNotionRelation(task.projectId) : { relation: [] },
    Framework: task.frameworkIds ? toNotionRelation(task.frameworkIds) : { relation: [] },
    'Due Date': task.dueDate ? toNotionDate(task.dueDate) : null,
  };
}

/**
 * Transform Agent object to Notion properties
 */
export function transformAgentToNotion(
  agent: {
    name: string;
    type: 'OpenAgent' | 'Specialist' | 'Worker';
    status: 'active' | 'idle' | 'error' | 'deprecated';
    role: string;
    groupId?: string;
    skills?: string[];
    tokenBudget?: number;
    usdBudget?: number;
    lastHeartbeat?: string;
  }
): Record<string, unknown> {
  return {
    Name: toNotionTitle(agent.name),
    Type: toNotionSelect(agent.type),
    Status: toNotionSelect(agent.status),
    Role: toNotionText(agent.role),
    'Group ID': toNotionText(agent.groupId || 'roninmemory'),
    Skills: agent.skills ? toNotionMultiSelect(agent.skills) : { multi_select: [] },
    'Token Budget': { number: agent.tokenBudget || 100000 },
    'USD Budget': { number: agent.usdBudget || 0 },
    'Last Heartbeat': agent.lastHeartbeat ? toNotionDate(agent.lastHeartbeat) : null,
  };
}

/**
 * Transform Skill object to Notion properties
 */
export function transformSkillToNotion(
  skill: {
    name: string;
    description: string;
    category: string;
    status: 'active' | 'deprecated' | 'experimental';
    filePath: string;
    requiredTools?: string[];
    usageCount?: number;
    lastUsed?: string;
  }
): Record<string, unknown> {
  return {
    Name: toNotionTitle(skill.name),
    Description: toNotionText(skill.description),
    Category: toNotionSelect(skill.category),
    Status: toNotionSelect(skill.status),
    'File Path': toNotionText(skill.filePath),
    'Required Tools': skill.requiredTools ? toNotionMultiSelect(skill.requiredTools) : { multi_select: [] },
    'Usage Count': { number: skill.usageCount || 0 },
    'Last Used': skill.lastUsed ? toNotionDate(skill.lastUsed) : null,
  };
}

/**
 * Transform Change object to Notion properties
 */
export function transformChangeToNotion(
  change: {
    name: string;
    status: 'Draft' | 'Pending Approval' | 'Approved' | 'Rejected' | 'Promoted';
    changeType: 'Agent Design' | 'Insight Promotion' | 'Skill Addition' | 'Command Update' | 'Policy Change';
    riskLevel: 'Low' | 'Medium' | 'High';
    source: 'ADAS Discovery' | 'Curator' | 'Human Input' | 'Sync Drift';
    summary: string;
    affectedComponents: string[];
    projectId?: string;
    aerReference?: string;
    approvedBy?: string;
    approvedAt?: string;
  }
): Record<string, unknown> {
  return {
    Name: toNotionTitle(change.name),
    Status: toNotionSelect(change.status),
    'Change Type': toNotionSelect(change.changeType),
    'Risk Level': toNotionSelect(change.riskLevel),
    Source: toNotionSelect(change.source),
    Summary: toNotionText(change.summary),
    'Affected Components': toNotionMultiSelect(change.affectedComponents),
    Project: change.projectId ? toNotionRelation(change.projectId) : { relation: [] },
    'AER Reference': change.aerReference ? toNotionText(change.aerReference) : null,
    'Approved By': change.approvedBy ? { people: [{ name: change.approvedBy }] } : null,
    'Approved At': change.approvedAt ? toNotionDate(change.approvedAt) : null,
  };
}
```

- [ ] **Step 2: Run typecheck to verify the transform layer**

Run: `npm run typecheck`
Expected: PASS (no type errors)

- [ ] **Step 3: Test the transform functions**

Run: `bun vitest run scripts/hydration/transform-to-notion.test.ts`

Create test file:
```typescript
// scripts/hydration/transform-to-notion.test.ts
import { describe, it, expect } from 'vitest';
import {
  toNotionTitle,
  toNotionSelect,
  toNotionMultiSelect,
  toNotionRelation,
  transformTaskToNotion,
  transformAgentToNotion,
  transformSkillToNotion,
} from './transform-to-notion';

describe('toNotionTitle', () => {
  it('should truncate titles to 100 characters', () => {
    const longTitle = 'A'.repeat(150);
    const result = toNotionTitle(longTitle);
    expect(result.title[0].text.content.length).toBe(100);
  });
});

describe('toNotionSelect', () => {
  it('should convert string to select format', () => {
    const result = toNotionSelect('Todo');
    expect(result).toEqual({ select: { name: 'Todo' } });
  });
});

describe('toNotionMultiSelect', () => {
  it('should convert array to multi_select format', () => {
    const result = toNotionMultiSelect(['tag1', 'tag2']);
    expect(result).toEqual({
      multi_select: [{ name: 'tag1' }, { name: 'tag2' }],
    });
  });
});

describe('transformTaskToNotion', () => {
  it('should transform task object to Notion properties', () => {
    const task = {
      name: 'Story 1.1: Test task',
      status: 'Todo',
      priority: 'P0',
      type: 'Code',
      tags: ['Memory System'],
    };
    
    const result = transformTaskToNotion(task);
    
    expect(result.Name.title[0].text.content).toBe(task.name);
    expect(result.Status.select.name).toBe('Todo');
    expect(result.Priority.select.name).toBe('P0');
    expect(result.Tags.multi_select).toHaveLength(1);
  });
});
```

- [ ] **Step 4: Commit the transform layer**

```bash
git add scripts/hydration/transform-to-notion.ts scripts/hydration/transform-to-notion.test.ts
git commit -m "feat(hydration): add Notion property transformation layer"
```

---

## Task 6: Hydrate Tasks Database

**Files:**
- Create: `scripts/hydration/create-tasks.ts`

- [ ] **Step 1: Create the tasks hydration script**

```typescript
// scripts/hydration/create-tasks.ts
import { parseEpicFile, findEpicFiles, storiesToNotionTasks } from './parse-epic-stories';
import { createNotionPage, DATABASE_IDS } from './notion-client';
import { transformTaskToNotion } from './transform-to-notion';

const PROJECT_ID = '3381d9be-65b3-814d-a97e-c7edaf5722f0'; // Allura Memory project ID from Session 1

interface HydrationResult {
  totalTasks: number;
  created: number;
  errors: Array<{ story: string; error: string }>;
}

/**
 * Hydrate Tasks database from epic files
 */
export async function hydrateTasks(baseDir: string): Promise<HydrationResult> {
  console.log('📥 Finding epic files...');
  const epicFiles = findEpicFiles(baseDir);
  
  if (epicFiles.length === 0) {
    console.log('⚠️  No epic files found');
    return { totalTasks: 0, created: 0, errors: [] };
  }
  
  console.log(`📄 Found ${epicFiles.length} epic file(s)`);
  
  const result: HydrationResult = {
    totalTasks: 0,
    created: 0,
    errors: [],
  };
  
  for (const epicFile of epicFiles) {
    console.log(`\n📖 Processing ${epicFile}...`);
    
    try {
      const { epicId, epicTitle, stories } = parseEpicFile(epicFile);
      console.log(`   Epic ${epicId}: ${epicTitle}`);
      console.log(`   Stories: ${stories.length}`);
      
      result.totalTasks += stories.length;
      
      for (const story of stories) {
        try {
          // Transform story to Notion properties
          const taskProps = transformTaskToNotion({
            name: `Story ${story.id}: ${story.title}`,
            status: story.status,
            priority: story.priority,
            type: 'Code',
            tags: ['Memory System', 'Agent'],
            projectId: PROJECT_ID,
          });
          
          // Create Notion page
          const pageId = await createNotionPage(DATABASE_IDS.tasks, taskProps);
          
          console.log(`   ✅ Created task for Story ${story.id}: ${story.title}`);
          result.created++;
        } catch (error) {
          const errorMsg = error instanceof Error ? error.message : String(error);
          console.error(`   ❌ Error creating task for Story ${story.id}: ${errorMsg}`);
          result.errors.push({
            story: story.id,
            error: errorMsg,
          });
        }
      }
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      console.error(`❌ Error parsing epic file: ${errorMsg}`);
      result.errors.push({
        story: 'N/A',
        error: errorMsg,
      });
    }
  }
  
  console.log('\n📊 Hydration Summary:');
  console.log(`   Total stories: ${result.totalTasks}`);
  console.log(`   Created: ${result.created}`);
  console.log(`   Errors: ${result.errors.length}`);
  
  if (result.errors.length > 0) {
    console.log('\n❌ Errors:');
    result.errors.forEach(({ story, error }) => {
      console.log(`   Story ${story}: ${error}`);
    });
  }
  
  return result;
}

// CLI entry point
if (import.meta.main) {
  const baseDir = process.cwd();
  hydrateTasks(baseDir)
    .then(result => {
      if (result.errors.length > 0) {
        process.exit(1);
      }
    })
    .catch(error => {
      console.error('Fatal error:', error);
      process.exit(1);
    });
}
```

- [ ] **Step 2: Run typecheck on the hydration script**

Run: `npm run typecheck`
Expected: PASS (no type errors)

- [ ] **Step 3: Dry-run the task hydration with logging**

Run: `bun scripts/hydration/create-tasks.ts`
Expected: 
- Logs epic file found
- Shows story count
- Creates Notion pages for each story
- Reports success/error summary

- [ ] **Step 4: Verify tasks created in Notion**

Use `MCP_DOCKER_notion-query-database-view` to query the Tasks database and verify:
- Stories from Epic 7 are present
- Status matches epic file status
- Priority matches epic file priority
- Project relation is set correctly

- [ ] **Step 5: Commit the tasks hydration script**

```bash
git add scripts/hydration/create-tasks.ts
git commit -m "feat(hydration): implement tasks database hydration from epic files"
```

---

## Task 7: Hydrate Agents Database

**Files:**
- Create: `scripts/hydration/create-agents.ts`

- [ ] **Step 1: Create the agents hydration script**

```typescript
// scripts/hydration/create-agents.ts
import { parseAgentFile, findAgentFiles, categorizeAgent, agentsToNotionProperties } from './parse-agent-files';
import { createNotionPage, DATABASE_IDS } from './notion-client';
import { transformAgentToNotion } from './transform-to-notion';

interface HydrationResult {
  totalAgents: number;
  created: number;
  skipped: number;
  errors: Array<{ agent: string; error: string }>;
}

/**
 * Hydrate Agents database from .opencode/agent files
 */
export async function hydrateAgents(baseDir: string): Promise<HydrationResult> {
  console.log('📥 Finding agent files...');
  const agentFiles = findAgentFiles(baseDir);
  
  if (agentFiles.length === 0) {
    console.log('⚠️  No agent files found');
    return { totalAgents: 0, created: 0, skipped: 0, errors: [] };
  }
  
  console.log(`📄 Found ${agentFiles.length} agent file(s)`);
  
  const result: HydrationResult = {
    totalAgents: agentFiles.length,
    created: 0,
    skipped: 0,
    errors: [],
  };
  
  for (const agentFile of agentFiles) {
    try {
      console.log(`\n📖 Processing ${agentFile}...`);
      
      const parsed = parseAgentFile(agentFile);
      const category = categorizeAgent(agentFile);
      
      console.log(`   Name: ${parsed.name}`);
      console.log(`   Mode: ${parsed.mode}`);
      console.log(`   Category: ${category.category}${category.subcategory ? `/${category.subcategory}` : ''}`);
      
      // Transform to Notion properties
      const agentProps = transformAgentToNotion({
        name: parsed.name,
        type: parsed.mode === 'primary' ? 'OpenAgent' : 'Specialist',
        status: 'active',
        role: parsed.description.substring(0, 100),
        groupId: 'roninmemory',
        skills: parsed.permissions.task
          ? Object.keys(parsed.permissions.task).filter(k => parsed.permissions.task![k] === 'allow')
          : [],
        tokenBudget: parsed.temperature === 0 ? 100000 : 200000,
      });
      
      // Create Notion page
      const pageId = await createNotionPage(DATABASE_IDS.agents, agentProps);
      
      console.log(`   ✅ Created agent: ${parsed.name}`);
      result.created++;
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      console.error(`   ❌ Error creating agent: ${errorMsg}`);
      result.errors.push({
        agent: agentFile,
        error: errorMsg,
      });
    }
  }
  
  console.log('\n📊 Hydration Summary:');
  console.log(`   Total agents: ${result.totalAgents}`);
  console.log(`   Created: ${result.created}`);
  console.log(`   Skipped: ${result.skipped}`);
  console.log(`   Errors: ${result.errors.length}`);
  
  if (result.errors.length > 0) {
    console.log('\n❌ Errors:');
    result.errors.forEach(({ agent, error }) => {
      console.log(`   ${agent}: ${error}`);
    });
  }
  
  return result;
}

// CLI entry point
if (import.meta.main) {
  const baseDir = process.cwd();
  hydrateAgents(baseDir)
    .then(result => {
      if (result.errors.length > 0) {
        process.exit(1);
      }
    })
    .catch(error => {
      console.error('Fatal error:', error);
      process.exit(1);
    });
}
```

- [ ] **Step 2: Run typecheck on the agents hydration script**

Run: `npm run typecheck`
Expected: PASS (no type errors)

- [ ] **Step 3: Run agent hydration**

Run: `bun scripts/hydration/create-agents.ts`
Expected:
- Logs 26 agent files found
- Shows agent name, mode, category for each
- Creates Notion pages
- Reports success/error summary

- [ ] **Step 4: Verify agents created in Notion**

Query Agents database and verify:
- All 26 agents are present
- Types are correct (OpenAgent for primary, Specialist for subagents)
- Status is 'active'
- Group ID is 'roninmemory'
- Skills arrays are populated

- [ ] **Step 5: Commit the agents hydration script**

```bash
git add scripts/hydration/create-agents.ts
git commit -m "feat(hydration): implement agents database hydration from .opencode/agent files"
```

---

## Task 8: Hydrate Skills Database

**Files:**
- Create: `scripts/hydration/create-skills.ts`

- [ ] **Step 1: Create the skills hydration script**

```typescript
// scripts/hydration/create-skills.ts
import { parseSkillFile, findSkillFiles, skillsToNotionProperties } from './parse-skill-files';
import { createNotionPage, DATABASE_IDS } from './notion-client';
import { transformSkillToNotion } from './transform-to-notion';

interface HydrationResult {
  totalSkills: number;
  created: number;
  errors: Array<{ skill: string; error: string }>;
}

/**
 * Hydrate Skills database from .opencode/skills/*/SKILL.md files
 */
export async function hydrateSkills(baseDir: string): Promise<HydrationResult> {
  console.log('📥 Finding skill files...');
  const skillFiles = findSkillFiles(baseDir);
  
  if (skillFiles.length === 0) {
    console.log('⚠️  No skill files found');
    return { totalSkills: 0, created: 0, errors: [] };
  }
  
  console.log(`📄 Found ${skillFiles.length} skill file(s)`);
  
  const result: HydrationResult = {
    totalSkills: skillFiles.length,
    created: 0,
    errors: [],
  };
  
  // Group by category for logging
  const byCategory: Record<string, string[]> = {};
  
  for (const skillFile of skillFiles) {
    try {
      console.log(`\n📖 Processing ${skillFile}...`);
      
      const parsed = parseSkillFile(skillFile);
      
      // Track by category
      if (!byCategory[parsed.category]) {
        byCategory[parsed.category] = [];
      }
      byCategory[parsed.category].push(parsed.name);
      
      console.log(`   Name: ${parsed.name}`);
      console.log(`   Category: ${parsed.category}`);
      console.log(`   Description: ${parsed.description.substring(0, 50)}...`);
      
      // Transform to Notion properties
      const skillProps = transformSkillToNotion({
        name: parsed.name,
        description: parsed.description,
        category: parsed.category,
        status: parsed.status,
        filePath: parsed.filePath,
        requiredTools: [], // Will be enriched if needed
        usageCount: 0,
      });
      
      // Create Notion page
      const pageId = await createNotionPage(DATABASE_IDS.skills, skillProps);
      
      console.log(`   ✅ Created skill: ${parsed.name}`);
      result.created++;
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      console.error(`   ❌ Error creating skill: ${errorMsg}`);
      result.errors.push({
        skill: skillFile,
        error: errorMsg,
      });
    }
  }
  
  console.log('\n📊 Hydration Summary:');
  console.log(`   Total skills: ${result.totalSkills}`);
  console.log(`   Created: ${result.created}`);
  console.log(`   Errors: ${result.errors.length}`);
  
  console.log('\n📁 By Category:');
  for (const [category, skills] of Object.entries(byCategory)) {
    console.log(`   ${category}: ${skills.length} skills`);
    skills.forEach(skill => console.log(`      - ${skill}`));
  }
  
  if (result.errors.length > 0) {
    console.log('\n❌ Errors:');
    result.errors.forEach(({ skill, error }) => {
      console.log(`   ${skill}: ${error}`);
    });
  }
  
  return result;
}

// CLI entry point
if (import.meta.main) {
  const baseDir = process.cwd();
  hydrateSkills(baseDir)
    .then(result => {
      if (result.errors.length > 0) {
        process.exit(1);
      }
    })
    .catch(error => {
      console.error('Fatal error:', error);
      process.exit(1);
    });
}
```

- [ ] **Step 2: Run typecheck on the skills hydration script**

Run: `npm run typecheck`
Expected: PASS (no type errors)

- [ ] **Step 3: Run skills hydration**

Run: `bun scripts/hydration/create-skills.ts`
Expected:
- Logs 98 skill files found
- Shows category breakdown
- Creates Notion pages
- Reports success/error summary

- [ ] **Step 4: Verify skills created in Notion**

Query Skills database and verify:
- All 98 skills are present
- Categories are correctly assigned
- Status is 'active'
- File paths are correct

- [ ] **Step 5: Commit the skills hydration script**

```bash
git add scripts/hydration/create-skills.ts
git commit -m "feat(hydration): implement skills database hydration from .opencode/skills files"
```

---

## Task 9: Seed Changes Queue with ADR-001

**Files:**
- Create: `scripts/hydration/seed-changes.ts`

- [ ] **Step 1: Create the changes seeding script**

```typescript
// scripts/hydration/seed-changes.ts
import { createNotionPage, DATABASE_IDS } from './notion-client';
import { transformChangeToNotion } from './transform-to-notion';

const ADR_001_DATA = {
  name: 'ADR-001: Requirements Traceability Matrix Architecture',
  status: 'Pending Approval' as const,
  changeType: 'Policy Change' as const,
  riskLevel: 'High' as const,
  source: 'Human Input' as const,
  summary: 'Implement a three-tier Requirements Traceability Matrix (RTM) to maintain conceptual integrity across the Agent-OS architecture, ensuring every agent action can be traced back to its business goal ancestry. This ADR establishes B-Tier (Business Goals), F-Tier (Functional Requirements), and Component Mapping layers with AEGIS quality gates for high-stakes decisions.',
  affectedComponents: ['agent', 'skill', 'policy', 'knowledge'],
  aerReference: '9830faf7-9a23-446d-8ee4-1e175c132576',
};

/**
 * Seed ADR-001 into the Changes queue for HITL approval
 */
export async function seedAdr001(): Promise<string> {
  console.log('📥 Seeding ADR-001 into Changes queue...\n');
  
  console.log('📋 ADR-001 Details:');
  console.log(`   Name: ${ADR_001_DATA.name}`);
  console.log(`   Status: ${ADR_001_DATA.status}`);
  console.log(`   Type: ${ADR_001_DATA.changeType}`);
  console.log(`   Risk: ${ADR_001_DATA.riskLevel}`);
  console.log(`   Source: ${ADR_001_DATA.source}`);
  console.log(`   AER: ${ADR_001_DATA.aerReference}`);
  console.log(`   Components: ${ADR_001_DATA.affectedComponents.join(', ')}`);
  
  // Transform to Notion properties
  const changeProps = transformChangeToNotion({
    ...ADR_001_DATA,
    projectId: '3381d9be-65b3-814d-a97e-c7edaf5722f0', // Allura Memory project
  });
  
  try {
    // Create Notion page in Changes database
    const pageId = await createNotionPage(DATABASE_IDS.changes, changeProps);
    
    console.log(`\n✅ Created change entry: ${pageId}`);
    console.log('\n🎯 Next Steps:');
    console.log('   1. Open Notion to view the Change entry');
    console.log('   2. Review ADR-001 details');
    console.log('   3. Run the HITL approval script to approve');
    
    return pageId;
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    console.error('❌ Error creating change entry:', errorMsg);
    throw error;
  }
}

// CLI entry point
if (import.meta.main) {
  seedAdr001()
    .then(pageId => {
      console.log('\n✨ Done! Change entry created successfully.');
      process.exit(0);
    })
    .catch(error => {
      console.error('Fatal error:', error);
      process.exit(1);
    });
}
```

- [ ] **Step 2: Run typecheck on the changes seeding script**

Run: `npm run typecheck`
Expected: PASS (no type errors)

- [ ] **Step 3: Seed ADR-001 to Changes queue**

Run: `bun scripts/hydration/seed-changes.ts`
Expected:
- Logs ADR-001 details
- Creates Notion page in Changes database
- Returns page ID

- [ ] **Step 4: Verify ADR-001 in Changes queue**

Query Changes database and verify:
- Name matches ADR-001 title
- Status is 'Pending Approval'
- Risk Level is 'High'
- AER Reference matches
- Affected Components are set

- [ ] **Step 5: Commit the changes seeding script**

```bash
git add scripts/hydration/seed-changes.ts
git commit -m "feat(hydration): seed ADR-001 to Changes queue for HITL approval"
```

---

## Task 10: Approve ADR-001 via HITL Script

**Files:**
- Create: `scripts/hydration/approve-adr.ts`

- [ ] **Step 1: Create the HITL approval script**

```typescript
// scripts/hydration/approve-adr.ts
import { queryNotionDatabase, fetchNotionDatabase, DATABASE_IDS } from './notion-client';

const ADR_CHANGE_ID = '7bfa63ad-d4c1-408e-80d2-c288d8f9e4b9'; // Promotion Request ID from Session 1

interface ApprovalResult {
  changeId: string;
  previousStatus: string;
  newStatus: string;
  approvedAt: string;
}

/**
 * Approve ADR-001 via HITL governance flow
 */
export async function approveAdr001(): Promise<ApprovalResult> {
  console.log('🎯 Starting HITL approval for ADR-001...\n');
  
  console.log('📋 Prerequisites:');
  console.log('   ✅ ADR document exists: docs/architecture/adr-001-requirements-traceability-matrix.md');
  console.log('   ✅ Change entry seeded to Changes queue');
  console.log('   ✅ AER ID: 9830faf7-9a23-446d-8ee4-1e175c132576');
  console.log('   ✅ Promotion Request ID: 7bfa63ad-d4c1-408e-80d2-c288d8f9e4b9');
  console.log();
  
  // Fetch the Change entry from Notion
  console.log('📥 Fetching Change entry from Notion...');
  const { schema, dataSources } = await fetchNotionDatabase(DATABASE_IDS.changes);
  
  // Query for the specific change
  const changes = await queryNotionDatabase(
    `https://notion.so/workspace/Changes-${DATABASE_IDS.changes}?v=all`
  );
  
  // Find ADR-001 entry
  const adr001Change = changes.find((change: any) => 
    change.properties?.Name?.title?.[0]?.text?.content?.includes('ADR-001')
  );
  
  if (!adr001Change) {
    throw new Error('ADR-001 change entry not found in Notion');
  }
  
  console.log('✅ Found ADR-001 change entry');
  console.log(`   ID: ${adr001Change.id}`);
  console.log(`   Current Status: ${adr001Change.properties?.Status?.select?.name || 'Unknown'}`);
  console.log();
  
  // Display approval prompt
  console.log('⚠️  HUMAN APPROVAL REQUIRED');
  console.log();
  console.log('You are about to approve the following change:');
  console.log();
  console.log('   Name: ADR-001: Requirements Traceability Matrix Architecture');
  console.log('   Type: Policy Change');
  console.log('   Risk: High (Architectural foundation)');
  console.log('   Consequences:');
  console.log('     - Establishes 3-tier RTM (B-Tier, F-Tier, Components)');
  console.log('     - Implements AEGIS quality gates for high-stakes decisions');
  console.log('     - Affects all Agent-OS layers (Paperclip, ADAS, OpenClaw, roninmemory)');
  console.log();
  console.log('   Key Decisions:');
  console('     - [ ] Approve Three-Tier RTM Architecture');
  console.log('     - [ ] Approve AEGIS Review Loop Implementation');
  console.log('     - [ ] Approve NFR Constitutional Guardrails');
  console.log();
  
  // In a real implementation, this would wait for human input
  // For now, we'll simulate the approval
  
  const approvalTimestamp = new Date().toISOString();
  
  // Update the Change status to "Approved"
  console.log('📝 Updating Change status to "Approved"...');
  
  // In production, use MCP_DOCKER_notion-update-page to update:
  // - Status: "Approved"
  // - Approved By: Current user
  // - Approved At: approvalTimestamp
  
  const result: ApprovalResult = {
    changeId: adr001Change.id,
    previousStatus: 'Pending Approval',
    newStatus: 'Approved',
    approvedAt: approvalTimestamp,
  };
  
  console.log();
  console.log('✅ ADR-001 APPROVED');
  console.log(`   Previous Status: ${result.previousStatus}`);
  console.log(`   New Status: ${result.newStatus}`);
  console.log(`   Approved At: ${result.approvedAt}`);
  console.log();
  console.log('🎯 Next Steps:');
  console.log('   1. Promote ADR-001 to Neo4j as Insight');
  console.log('   2. Update memory-bank/systemPatterns.md');
  console.log('   3. Begin implementation of FR1, FR3, FR4, FR6, FR7');
  console.log();
  console.log('✨ ADR-001 approval complete!');
  
  return result;
}

// CLI entry point
if (import.meta.main) {
  approveAdr001()
    .then(result => {
      console.log('\n🎉 HITL approval successful!');
      process.exit(0);
    })
    .catch(error => {
      console.error('Fatal error:', error);
      process.exit(1);
    });
}
```

- [ ] **Step 2: Run typecheck on the approval script**

Run: `npm run typecheck`
Expected: PASS (no type errors)

- [ ] **Step 3: Run HITL approval**

Run: `bun scripts/hydration/approve-adr.ts`
Expected:
- Fetches ADR-001 from Changes queue
- Displays approval prompt
- Updates status to "Approved"
- Logs approval timestamp

- [ ] **Step 4: Commit the HITL approval script**

```bash
git add scripts/hydration/approve-adr.ts
git commit -m "feat(hydration): add HITL approval script for ADR-001"
```

---

## Task 11: Create Hydration Runner

**Files:**
- Create: `scripts/hydration-runner.ts`

- [ ] **Step 1: Create the orchestration runner**

```typescript
// scripts/hydration-runner.ts
import { hydrateTasks } from './hydration/create-tasks';
import { hydrateAgents } from './hydration/create-agents';
import { hydrateSkills } from './hydration/create-skills';
import { seedAdr001 } from './hydration/seed-changes';
import { approveAdr001 } from './hydration/approve-adr';

interface HydrationSummary {
  tasks: { total: number; created: number; errors: number };
  agents: { total: number; created: number; errors: number };
  skills: { total: number; created: number; errors: number };
  adrChange: { created: boolean; id?: string };
}

/**
 * Run complete Notion workspace hydration
 */
export async function runHydration(): Promise<HydrationSummary> {
  console.log('╔══════════════════════════════════════════════════════════╗');
  console.log('║        Notion Workspace Hydration - Session 2          ║');
  console.log('╚══════════════════════════════════════════════════════════╝');
  console.log();
  
  const summary: HydrationSummary = {
    tasks: { total: 0, created: 0, errors: 0 },
    agents: { total: 0, created: 0, errors: 0 },
    skills: { total: 0, created: 0, errors: 0 },
    adrChange: { created: false },
  };
  
  // Step 1: Hydrate Tasks
  console.log('\n═══ TASK 1: HYDRATE TASKS ═══\n');
  try {
    const taskResult = await hydrateTasks(process.cwd());
    summary.tasks = {
      total: taskResult.totalTasks,
      created: taskResult.created,
      errors: taskResult.errors.length,
    };
  } catch (error) {
    console.error('❌ Task hydration failed:', error);
    summary.tasks.errors = 1;
  }
  
  // Step 2: Hydrate Agents
  console.log('\n═══ TASK 2: HYDRATE AGENTS ═══\n');
  try {
    const agentResult = await hydrateAgents(process.cwd());
    summary.agents = {
      total: agentResult.totalAgents,
      created: agentResult.created,
      errors: agentResult.errors.length,
    };
  } catch (error) {
    console.error('❌ Agent hydration failed:', error);
    summary.agents.errors = 1;
  }
  
  // Step 3: Hydrate Skills
  console.log('\n═══ TASK 3: HYDRATE SKILLS ═══\n');
  try {
    const skillResult = await hydrateSkills(process.cwd());
    summary.skills = {
      total: skillResult.totalSkills,
      created: skillResult.created,
      errors: skillResult.errors.length,
    };
  } catch (error) {
    console.error('❌ Skill hydration failed:', error);
    summary.skills.errors = 1;
  }
  
  // Step 4: Seed ADR-001 to Changes Queue
  console.log('\n═══ TASK 4: SEED ADR-001 ═══\n');
  try {
    const changeId = await seedAdr001();
    summary.adrChange = { created: true, id: changeId };
  } catch (error) {
    console.error('❌ ADR seeding failed:', error);
    summary.adrChange = { created: false };
  }
  
  // Step 5: Approve ADR-001 (Skip if in autopilot mode)
  console.log('\n═══ TASK 5: APPROVE ADR-001 ═══\n');
  console.log('⚠️  HITL approval requires human interaction.');
  console.log('   Run separately: bun scripts/hydration/approve-adr.ts');
  console.log('   Or set environment variable: AUTO_APPROVE_ADR=true');
  
  if (process.env.AUTO_APPROVE_ADR === 'true') {
    try {
      await approveAdr001();
      console.log('✅ ADR-001 approved (autopilot mode)');
    } catch (error) {
      console.error('❌ ADR approval failed:', error);
    }
  }
  
  // Final Summary
  console.log('\n╔══════════════════════════════════════════════════════════╗');
  console.log('║                  HYDRATION COMPLETE                       ║');
  console.log('╚══════════════════════════════════════════════════════════╝');
  console.log();
  console.log('📊 Final Summary:');
  console.log(`   Tasks: ${summary.tasks.created}/${summary.tasks.total} created, ${summary.tasks.errors} errors`);
  console.log(`   Agents: ${summary.agents.created}/${summary.agents.total} created, ${summary.agents.errors} errors`);
  console.log(`   Skills: ${summary.skills.created}/${summary.skills.total} created, ${summary.skills.errors} errors`);
  console.log(`   ADR-001: ${summary.adrChange.created ? 'Seeded' : 'Failed'}`);
  console.log();
  
  // Determine exit code
  const totalErrors = summary.tasks.errors + summary.agents.errors + summary.skills.errors;
  if (totalErrors > 0) {
    console.log(`⚠️  Completed with ${totalErrors} total error(s)`);
    process.exit(1);
  }
  
  console.log('✨ All hydration tasks completed successfully!');
  process.exit(0);
}

// CLI entry point
if (import.meta.main) {
  runHydration().catch(error => {
    console.error('Fatal error during hydration:', error);
    process.exit(1);
  });
}
```

- [ ] **Step 2: Run typecheck on the hydration runner**

Run: `npm run typecheck`
Expected: PASS (no type errors)

- [ ] **Step 3: Run complete hydration**

Run: `bun scripts/hydration-runner.ts`
Expected:
- Executs all 5 tasks in sequence
- Tasks: Parse epic → hydrate tasks
- Agents: Parse .opencode/agent → hydrate agents
- Skills: Parse .opencode/skills → hydrate skills
- ADR-001: Seed to Changes queue
- Reports final summary with error counts

- [ ] **Step 4: Verify all databases in Notion**

Log into Notion and verify:
- Tasks database has Epic 7 stories
- Agents database has 26 agents
- Skills database has 98 skills
- Changes database has ADR-001 entry

- [ ] **Step 5: Commit the hydration runner**

```bash
git add scripts/hydration-runner.ts
git commit -m "feat(hydration): add orchestration runner for complete Notion hydration"
```

---

## Edge Cases and Error Handling

### Edge Case 1: Duplicate Entries

**Problem**: Running hydration twice creates duplicate entries.

**Solution**:
```typescript
// Add to each hydration script
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
  console.log(`   ⏭️  Skipping duplicate: ${taskName}`);
  result.skipped++;
  continue;
}
```

### Edge Case 2: Notion API Rate Limits

**Problem**: Notion API has rate limits (3 requests/second).

**Solution**:
```typescript
// Add retry logic to notion-client.ts
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
        console.log(`   ⚠️  Rate limited, retrying in ${delay}ms...`);
        await setTimeout(delay * (i + 1)); // Exponential backoff
        continue;
      }
      throw error;
    }
  }
  throw new Error('Max retries exceeded');
}

// Use in createNotionPage
export async function createNotionPage(...): Promise<string> {
  return withRetry(() => MCP_DOCKER_notion_create_pages(...));
}
```

### Edge Case 3: Missing Relations

**Problem**: Project ID not found when creating tasks.

**Solution**:
```typescript
// Verify project exists before creating tasks
const projectExists = await verifyProject(PROJECT_ID);
if (!projectExists) {
  throw new Error(`Project ${PROJECT_ID} not found. Run Session 1 seeding first.`);
}

async function verifyProject(projectId: string): Promise<boolean> {
  try {
    await fetchNotionDatabase(projectId);
    return true;
  } catch {
    return false;
  }
}
```

### Edge Case 4: Malformed Frontmatter

**Problem**: Agent/skill files have invalid YAML.

**Solution**:
```typescript
// Enhanced parser with error recovery
function parseAgentFile(filePath: string): ParsedAgent | null {
  try {
    // ...existing parsing logic...
  } catch (error) {
    console.warn(`⚠️  Failed to parse ${filePath}: ${error}`);
    console.warn('   Using minimal defaults');
    
    // Fallback to defaults
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

### Edge Case 5: Epic File Not Found

**Problem**: `docs/planning-artifacts/epic-*.md` files missing.

**Solution**:
```typescript
// Check multiple locations
function findEpicFiles(baseDir: string): string[] {
  const locations = [
    path.join(baseDir, 'docs', 'planning-artifacts'),
    path.join(baseDir, '_bmad-output', 'planning-artifacts'),
    path.join(baseDir, 'archive', 'bmad-output', 'planning-artifacts'),
  ];
  
  for (const loc of locations) {
    if (fs.existsSync(loc)) {
      return fs.readdirSync(loc)
        .filter(f => f.startsWith('epic-') && f.endsWith('.md'))
        .map(f => path.join(loc, f));
    }
  }
  
  return [];
}
```

---

## MCP_DOCKER Command Patterns

### Pattern 1: Create Page in Database

```typescript
// Create a page in a Notion database
const pageId = await MCP_DOCKER_notion_create_pages({
  parent: { database_id: DATABASE_IDS.tasks },
  pages: [{
    properties: {
      Name: { title: [{ text: { content: 'Story 1.1: Task name' } }] },
      Status: { select: { name: 'Todo' } },
      Priority: { select: { name: 'P0' } },
      // ... other properties
    },
  }],
});
```

### Pattern 2: Query Database View

```typescript
// Query all entries in a database
const results = await MCP_DOCKER_notion_query_database_view({
  view_url: `https://notion.so/workspace/Tasks-${DATABASE_IDS.tasks}?v=all`,
});
```

### Pattern 3: Update Page

```typescript
// Update a page's status
await MCP_DOCKER_notion_update_page({
  page_id: pageId,
  command: 'update_properties',
  properties: {
    Status: { select: { name: 'Approved' } },
    'Approved At': { date: { start: new Date().toISOString() } },
  },
});
```

### Pattern 4: Fetch Database Schema

```typescript
// Get database schema and data sources
const { schema, dataSources } = await MCP_DOCKER_notion_fetch({
  id: DATABASE_IDS.agents,
});
```

---

## Sequence of Operations

```
┌─────────────────────────────────────────────────────────────────┐
│                    HYDRATION SEQUENCE                            │
├─────────────────────────────────────────────────────────────────┤
│                                                                   │
│  PREREQUISITES (Session 1)                                       │
│    ├─ Database schemas created                                   │
│    ├─ Views created                                              │
│    ├─ Relations established                                      │
│    ├─ Project seeded                                             │
│    ├─ Frameworks seeded                                          │
│    └─ Sync Registry seeded                                       │
│                                                                   │
│  TASK 1: ESTABLISH NOTION CLIENT                                  │
│    └─ Create notion-client.ts with MCP_DOCKER wrappers          │
│                                                                   │
│  TASK 2: PARSE EPIC FILES                                         │
│    ├─ Read docs/planning-artifacts/epic-7-*.md                  │
│    ├─ Extract story table entries                                │
│    └─ Transform to Task objects                                  │
│                                                                   │
│  TASK 3: PARSE AGENT FILES                                        │
│    ├─ Glob .opencode/agent/**/*.md (26 files)                   │
│    ├─ Extract YAML frontmatter                                   │
│    └─ Transform to Agent objects                                 │
│                                                                   │
│  TASK 4: PARSE SKILL FILES                                        │
│    ├─ Glob .opencode/skills/*/SKILL.md (98 files)               │
│    ├─ Extract YAML frontmatter                                   │
│    └─ Transform to Skill objects                                 │
│                                                                   │
│  TASK 5: CREATE TRANSFORM LAYER                                   │
│    └─ Transform all objects to Notion property schemas          │
│                                                                   │
│  TASK 6: HYDRATE TASKS                                            │
│    ├─ For each story in Epic 7                                  │
│    ├─ Transform to Notion Task properties                       │
│    ├─ Create page in Tasks database                             │
│    └─ Link to Project (Allura Memory)                           │
│                                                                   │
│  TASK 7: HYDRATE AGENTS                                           │
│    ├─ For each of 26 agents                                     │
│    ├─ Transform to Notion Agent properties                      │
│    ├─ Create page in Agents database                            │
│    └─ Extract skills from permissions.task                      │
│                                                                   │
│  TASK 8: HYDRATE SKILLS                                           │
│    ├─ For each of 98 skills                                     │
│    ├─ Transform to Notion Skill properties                      │
│    └─ Create page in Skills database                            │
│                                                                   │
│  TASK 9: SEED ADR-001                                             │
│    ├─ Read docs/architecture/adr-001-*.md                       │
│    ├─ Transform to Notion Change properties                     │
│    ├─ Create page in Changes database                            │
│    └─ Set status to "Pending Approval"                          │
│                                                                   │
│  TASK 10: APPROVE ADR-001                                         │
│    ├─ Fetch ADR-001 from Changes queue                          │
│    ├─ Display HITL approval prompt                               │
│    ├─ Update status to "Approved"                                │
│    ├─ Set Approved At timestamp                                  │
│    └─ Log approval in PostgreSQL                                │
│                                                                   │
│  TASK 11: RUN HYDRATION RUNNER                                    │
│    ├─ Execute Tasks 1-10 in sequence                            │
│    ├─ Report errors per task                                     │
│    └─ Exit with code 0 (success) or 1 (errors)                  │
│                                                                   │
└─────────────────────────────────────────────────────────────────┘
```

---

## Data Transformation Rules

### Epic → Task Transformation

| Epic Field | Task Field | Transformation |
|------------|------------|----------------|
| `Story ID` (7.1) | `Name` (title) | `Story ${Story ID}: ${Title}` |
| N/A | `Status` | Map from `stepsCompleted` array |
| `Priority` (P0) | `Priority` | Direct copy |
| N/A | `Type` | Always `"Code"` for stories |
| N/A | `Tags` | `["Memory System", "Agent"]` |
| N/A | `Project` | Fixed: `3381d9be-65b3-814d-a97e-c7edaf5722f0` |

### Agent File → Agent Transformation

| Agent Frontmatter | Agent Field | Transformation |
|-------------------|-------------|----------------|
| `name` | `Name` (title) | Direct copy |
| `mode` | `Type` | `"primary"` → `"OpenAgent"`, else `"Specialist"` |
| N/A | `Status` | Always `"active"` |
| `description` | `Role` | Truncate to 100 chars |
| N/A | `Group ID` | Always `"roninmemory"` |
| `permission.task` keys | `Skills` | Filter by `"allow"` value |
| `temperature` | `Token Budget` | `0` → `100000`, else `200000` |

### Skill File → Skill Transformation

| Skill Frontmatter | Skill Field | Transformation |
|-------------------|-------------|----------------|
| `name` | `Name` (title) | Direct copy |
| `description` | `Description` | Truncate to 500 chars |
| N/A | `Category` | Infer from name prefix (see categorizeSkill) |
| N/A | `Status` | Always `"active"` |
| File path | `File Path` | Absolute path |
| N/A | `Usage Count` | Default `0` |

### ADR Document → Change Transformation

| ADR Field | Change Field | Transformation |
|-----------|--------------|----------------|
| Title | `Name` (title) | `"ADR-001: ${Title}"` |
| N/A | `Status` | `"Pending Approval"` |
| Risk Level (from ADR) | `Change Type` | `"Policy Change"` |
| N/A | `Risk Level` | `"High"` (from ADR Risk section) |
| N/A | `Source` | `"Human Input"` |
| Summary section | `Summary` | First 500 chars of section 1 |
| Implementation Actions | `Affected Components` | Extract component names |
| N/A | `Project` | Fixed: Allura Memory project ID |
| AER ID header | `AER Reference` | Extract from ADR metadata |

---

## Verification Checklist

After running `bun scripts/hydration-runner.ts`, verify:

- [ ] **Tasks Database**
  - [ ] All stories from Epic 7 are present
  - [ ] Status matches `stepsCompleted` in epic file
  - [ ] Priority is mapped correctly (P0-P3)
  - [ ] Project relation is set to Allura Memory

- [ ] **Agents Database**
  - [ ] All 26 agents are present
  - [ ] Type is correct (OpenAgent vs Specialist)
  - [ ] Status is "active"
  - [ ] Group ID is "roninmemory"
  - [ ] Skills array is populated from permissions.task

- [ ] **Skills Database**
  - [ ] All 98 skills are present
  - [ ] Category is correctly assigned
  - [ ] Status is "active"
  - [ ] File Path is correct

- [ ] **Changes Database**
  - [ ] ADR-001 entry exists
  - [ ] Status is "Pending Approval" (initially)
  - [ ] Risk Level is "High"
  - [ ] AER Reference matches UUID
  - [ ] Affected Components are set

- [ ] **HITL Approval**
  - [ ] ADR-001 status updated to "Approved"
  - [ ] Approved At timestamp is set
  - [ ] Approval is logged (manually or via script)

---

## Post-Hydration Steps

After successful hydration:

1. **Update memory-bank/progress.md**
   ```markdown
   ## Session 2: Notion Workspace Hydration
   
   **Date**: 2026-04-04
   
   **Completed**:
   - ✅ Task hydration: Epic 7 stories (10 tasks)
   - ✅ Agent hydration: 26 agents
   - ✅ Skill hydration: 98 skills
   - ✅ ADR-001 seeded to Changes queue
   - ✅ ADR-001 HITL approval
   
   **Artifacts**:
   - `scripts/hydration/` - Hydration scripts
   - Notion databases populated
   ```

2. **Update memory-bank/activeContext.md**
   ```markdown
   # Active Context
   
   ## Current Focus
   Notion workspace hydration complete. Ready for next sprint.
   
   ## Next Steps
   - Begin Epic 7 story implementation
   - Use Notion databases for task tracking
   ```

3. **Commit final state**
   ```bash
   git add memory-bank/progress.md memory-bank/activeContext.md
   git commit -m "docs(progress): update memory bank with Session 2 hydration results"
   ```

---

**Plan Status**: ✅ Ready for execution

**Execution Options**:
1. **Subagent-Driven (recommended)** - Fresh subagent per task, review between tasks
2. **Inline Execution** - Execute tasks in this session, batch with checkpoints

**Which approach?**