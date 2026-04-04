# OpenAgents Control Registry Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build canonical OpenAgents Control registry that syncs local OpenCode agents/skills/commands/workflows to Notion with drift detection and audit trail.

**Architecture:** Extraction scripts parse local sources → Normalization layer builds canonical entities + relations → Sync engine compares with Notion → Upsert changes → Verification checks → Audit logs to Sync Registry database.

**Tech Stack:** TypeScript, Bun, Notion MCP API, CSV parsing, glob patterns

---

## Phase 1: Notion Database Creation

### Task 1.1: Create Agents Database

**Files:**
- Create: Notion database via MCP API

- [ ] **Step 1: Create database with schema**

```typescript
// Use notion-create-database MCP tool
MCP_DOCKER_notion-create-database({
  parent: { page_id: "3371d9be65b38041bc59fd5cf966ff98" },
  title: "Agents",
  description: "OpenCode runtime agents + BMad persona agents",
  schema: `CREATE TABLE (
    "Name" TITLE,
    "Display Name" RICH_TEXT,
    "Persona" RICH_TEXT,
    "Type" SELECT('OpenAgent', 'Specialist', 'Worker', 'BMad Persona', 'WDS Persona'),
    "Category" SELECT('core', 'subagents/core', 'subagents/code', 'subagents/development', 'bmm', 'tea', 'wds'),
    "Status" SELECT('active', 'idle', 'deprecated', 'experimental'),
    "Source Path" RICH_TEXT,
    "Skills" MULTI_SELECT,
    "Commands" MULTI_SELECT,
    "Workflows" MULTI_SELECT,
    "Config File" RICH_TEXT,
    "Group ID" RICH_TEXT,
    "Last Synced" DATE
  )`
})
```

- [ ] **Step 2: Verify database creation**

Run: Check Notion page for embedded Agents database
Expected: Database appears with all 13 properties

- [ ] **Step 3: Create default views**

Create views: `All Agents`, `Active`, `By Type`, `By Category`

- [ ] **Step 4: Commit**

Document database creation in project notes

### Task 1.2: Create Skills Database

**Files:**
- Create: Notion database via MCP API

- [ ] **Step 1: Create database with schema**

```typescript
MCP_DOCKER_notion-create-database({
  parent: { page_id: "3371d9be65b38041bc59fd5cf966ff98" },
  title: "Skills",
  description: "Reusable OpenCode skills",
  schema: `CREATE TABLE (
    "Name" TITLE,
    "Display Name" RICH_TEXT,
    "Category" SELECT('context', 'research', 'writing', 'testing', 'review', 'governance', 'deployment', 'bmad', 'wds', 'tea'),
    "Description" RICH_TEXT,
    "Source Path" RICH_TEXT,
    "Required Tools" MULTI_SELECT('read', 'write', 'edit', 'bash', 'grep', 'task'),
    "Status" SELECT('active', 'deprecated', 'experimental'),
    "Agents" MULTI_SELECT,
    "Usage Count" NUMBER,
    "Last Used" DATE
  )`
})
```

- [ ] **Step 2: Verify database creation**

Run: Check Notion page for embedded Skills database
Expected: Database appears with all 10 properties

- [ ] **Step 3: Create default views**

Create views: `All Skills`, `By Category`, `Active`, `Most Used`

### Task 1.3: Create Commands Database

**Files:**
- Create: Notion database via MCP API

- [ ] **Step 1: Create database with schema**

```typescript
MCP_DOCKER_notion-create-database({
  parent: { page_id: "3371d9be65b38041bc59fd5cf966ff98" },
  title: "Commands",
  description: "OpenCode slash commands",
  schema: `CREATE TABLE (
    "Name" TITLE,
    "Intent" RICH_TEXT,
    "Category" SELECT('memory', 'knowledge', 'tenant', 'audit', 'agent', 'sync'),
    "Source Path" RICH_TEXT,
    "Input Schema" RICH_TEXT,
    "Output Schema" RICH_TEXT,
    "Requires HITL" CHECKBOX,
    "Status" SELECT('active', 'deprecated', 'experimental'),
    "Skills" MULTI_SELECT,
    "Agents" MULTI_SELECT
  )`
})
```

- [ ] **Step 2: Verify database creation**

Run: Check Notion page for embedded Commands database
Expected: Database appears with all 10 properties

- [ ] **Step 3: Create default views**

Create views: `All Commands`, `By Category`, `Active`, `Requires HITL`

### Task 1.4: Create Workflows Database

**Files:**
- Create: Notion database via MCP API

- [ ] **Step 1: Create database with schema**

```typescript
MCP_DOCKER_notion-create-database({
  parent: { page_id: "3371d9be65b38041bc59fd5cf966ff98" },
  title: "Workflows",
  description: "BMad workflows from module-help entries",
  schema: `CREATE TABLE (
    "Code" TITLE,
    "Name" RICH_TEXT,
    "Module" SELECT('bmm', 'tea', 'wds', 'bmb', 'core'),
    "Phase" SELECT('1-analysis', '2-planning', '3-solutioning', '4-implementation', '0-wds-pitch', '1-wds-strategy', '2-wds-design', '3-wds-build'),
    "Description" RICH_TEXT,
    "Agent" MULTI_SELECT,
    "Required" CHECKBOX,
    "Sequence" NUMBER,
    "Source Path" RICH_TEXT,
    "Status" SELECT('active', 'deprecated', 'experimental')
  )`
})
```

- [ ] **Step 2: Verify database creation**

Run: Check Notion page for embedded Workflows database
Expected: Database appears with all 10 properties

- [ ] **Step 3: Create default views**

Create views: `All Workflows`, `By Module`, `By Phase`, `Required`

### Task 1.5: Create Sync Registry Database

**Files:**
- Create: Notion database via MCP API

- [ ] **Step 1: Create database with schema**

```typescript
MCP_DOCKER_notion-create-database({
  parent: { page_id: "3371d9be65b38041bc59fd5cf966ff98" },
  title: "Sync Registry",
  description: "Audit trail of sync runs with drift reports",
  schema: `CREATE TABLE (
    "Run ID" TITLE,
    "Run Date" DATE,
    "Status" SELECT('success', 'partial', 'failed', 'dry-run'),
    "Agents Synced" NUMBER,
    "Skills Synced" NUMBER,
    "Commands Synced" NUMBER,
    "Workflows Synced" NUMBER,
    "Drift Report" RICH_TEXT,
    "Broken Links" NUMBER,
    "Missing Local" NUMBER,
    "Missing Notion" NUMBER
  )`
})
```

- [ ] **Step 2: Verify database creation**

Run: Check Notion page for embedded Sync Registry database
Expected: Database appears with all 11 properties

- [ ] **Step 3: Create default views**

Create views: `All Runs`, `Success`, `Failed`, `Dry-Run`

- [ ] **Step 4: Save database IDs**

```bash
# Create config file to store database IDs
cat > .opencode/config/registry-databases.json << 'EOF'
{
  "hub_page_id": "3371d9be65b38041bc59fd5cf966ff98",
  "agents_db_id": "<from_step_1>",
  "skills_db_id": "<from_step_1>",
  "commands_db_id": "<from_step_1>",
  "workflows_db_id": "<from_step_1>",
  "sync_registry_db_id": "<from_step_1>"
}
EOF
```

- [ ] **Step 5: Commit**

```bash
git add .opencode/config/registry-databases.json
git commit -m "chore: add Notion registry database IDs config"
```

---

## Phase 2: TypeScript Types and Notion Client

### Task 2.1: Define TypeScript Types

**Files:**
- Create: `src/lib/opencode-registry/types.ts`

- [ ] **Step 1: Create types file**

```typescript
// src/lib/opencode-registry/types.ts

export type AgentType = 'OpenAgent' | 'Specialist' | 'Worker' | 'BMad Persona' | 'WDS Persona';
export type AgentCategory = 'core' | 'subagents/core' | 'subagents/code' | 'subagents/development' | 'bmm' | 'tea' | 'wds';
export type EntityStatus = 'active' | 'idle' | 'deprecated' | 'experimental';
export type SkillCategory = 'context' | 'research' | 'writing' | 'testing' | 'review' | 'governance' | 'deployment' | 'bmad' | 'wds' | 'tea';
export type CommandCategory = 'memory' | 'knowledge' | 'tenant' | 'audit' | 'agent' | 'sync';
export type WorkflowModule = 'bmm' | 'tea' | 'wds' | 'bmb' | 'core';
export type WorkflowPhase = '1-analysis' | '2-planning' | '3-solutioning' | '4-implementation' | '0-wds-pitch' | '1-wds-strategy' | '2-wds-design' | '3-wds-build';
export type SyncStatus = 'success' | 'partial' | 'failed' | 'dry-run';
export type RequiredTool = 'read' | 'write' | 'edit' | 'bash' | 'grep' | 'task';

export interface CanonicalAgent {
  id: string;
  displayName: string;
  persona?: string;
  type: AgentType;
  category?: AgentCategory;
  status: EntityStatus;
  sourcePath: string;
  skills: string[];
  commands: string[];
  workflows: string[];
  configFile?: string;
  groupId?: string;
  lastSynced?: Date;
}

export interface CanonicalSkill {
  id: string;
  displayName?: string;
  category?: SkillCategory;
  description?: string;
  sourcePath: string;
  requiredTools?: RequiredTool[];
  status: EntityStatus;
  agents: string[];
  usageCount?: number;
  lastUsed?: Date;
}

export interface CanonicalCommand {
  id: string;
  intent?: string;
  category?: CommandCategory;
  sourcePath: string;
  inputSchema?: string;
  outputSchema?: string;
  requiresHitl?: boolean;
  status: EntityStatus;
  skills: string[];
  agents: string[];
}

export interface CanonicalWorkflow {
  code: string;
  name?: string;
  module?: WorkflowModule;
  phase?: WorkflowPhase;
  description?: string;
  agent?: string;
  required?: boolean;
  sequence?: number;
  sourcePath: string;
  status: EntityStatus;
}

export interface SyncRun {
  runId: string;
  runDate: Date;
  status: SyncStatus;
  agentsSynced: number;
  skillsSynced: number;
  commandsSynced: number;
  workflowsSynced: number;
  driftReport?: string;
  brokenLinks: number;
  missingLocal: number;
  missingNotion: number;
}

export interface DriftReport {
  missingInNotion: string[];
  missingInLocal: string[];
  fieldMismatches: Array<{id: string, field: string, local: any, notion: any}>;
  brokenLinks: Array<{from: string, to: string, relation: string}>;
}
```

- [ ] **Step 2: Verify types compile**

Run: `bun run typecheck`
Expected: No TypeScript errors

- [ ] **Step 3: Commit**

```bash
git add src/lib/opencode-registry/types.ts
git commit -m "feat: add OpenAgents registry TypeScript types"
```

### Task 2.2: Create Notion Client Wrapper

**Files:**
- Create: `src/lib/opencode-registry/notion-client.ts`

- [ ] **Step 1: Create Notion client**

```typescript
// src/lib/opencode-registry/notion-client.ts
import { config } from 'dotenv';
config();

const NOTION_API_KEY = process.env.NOTION_API_KEY;
if (!NOTION_API_KEY) {
  throw new Error('NOTION_API_KEY environment variable is required');
}

export class NotionRegistryClient {
  private agentsDbId: string;
  private skillsDbId: string;
  private commandsDbId: string;
  private workflowsDbId: string;
  private syncRegistryDbId: string;

  constructor(dbConfig: {
    agentsDbId: string;
    skillsDbId: string;
    commandsDbId: string;
    workflowsDbId: string;
    syncRegistryDbId: string;
  }) {
    this.agentsDbId = dbConfig.agentsDbId;
    this.skillsDbId = dbConfig.skillsDbId;
    this.commandsDbId = dbConfig.commandsDbId;
    this.workflowsDbId = dbConfig.workflowsDbId;
    this.syncRegistryDbId = dbConfig.syncRegistryDbId;
  }

  async queryAgents(): Promise<any[]> {
    // Use MCP notion-search or notion-query-database-view
    // Implementation uses MCP_DOCKER tools
    return [];
  }

  async querySkills(): Promise<any[]> {
    return [];
  }

  async queryCommands(): Promise<any[]> {
    return [];
  }

  async queryWorkflows(): Promise<any[]> {
    return [];
  }

  async createAgent(agent: any): Promise<string> {
    // Use MCP_DOCKER_notion-create-pages
    return '';
  }

  async updateAgent(pageId: string, agent: any): Promise<void> {
    // Use MCP_DOCKER_notion-update-page
  }

  async createSkill(skill: any): Promise<string> {
    return '';
  }

  async updateSkill(pageId: string, skill: any): Promise<void> {
    
  }

  // Similar methods for commands, workflows, sync registry...
}
```

- [ ] **Step 2: Write failing test**

```typescript
// tests/opencode-registry/notion-client.test.ts
import { describe, test, expect } from 'bun:test';
import { NotionRegistryClient } from '../../src/lib/opencode-registry/notion-client';

describe('NotionRegistryClient', () => {
  test('should instantiate with database IDs', () => {
    const client = new NotionRegistryClient({
      agentsDbId: 'test-id',
      skillsDbId: 'test-id',
      commandsDbId: 'test-id',
      workflowsDbId: 'test-id',
      syncRegistryDbId: 'test-id'
    });
    expect(client).toBeDefined();
  });
});
```

- [ ] **Step 3: Run test**

Run: `bun test tests/opencode-registry/notion-client.test.ts`
Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add src/lib/opencode-registry/notion-client.ts tests/opencode-registry/notion-client.test.ts
git commit -m "feat: add Notion registry client wrapper"
```

---

## Phase 3: Extraction Scripts

### Task 3.1: Extract Agents

**Files:**
- Create: `scripts/opencode-registry/extract-agents.ts`

- [ ] **Step 1: Create agent extractor**

```typescript
// scripts/opencode-registry/extract-agents.ts
import { readFile } from 'fs/promises';
import { join } from 'path';
import { parse } from 'csv-parse/sync';
import type { CanonicalAgent } from '../../src/lib/opencode-registry/types';

interface AgentMetadata {
  agents: {
    [id: string]: {
      id: string;
      name: string;
      category?: string;
      type?: string;
      persona?: { name?: string };
      dependencies?: string[];
    };
  };
}

interface BMadAgentManifest {
  name: string;
  displayName: string;
  title: string;
  icon: string;
  role: string;
  identity: string;
  communicationStyle: string;
  principles: string;
  module: string;
  path: string;
}

export async function extractAgents(projectRoot: string): Promise<CanonicalAgent[]> {
  const agents: CanonicalAgent[] = [];

  // Extract OpenCode agents
  const metadataPath = join(projectRoot, '.opencode/config/agent-metadata.json');
  const metadataContent = await readFile(metadataPath, 'utf-8');
  const metadata: AgentMetadata = JSON.parse(metadataContent);

  for (const [id, agent] of Object.entries(metadata.agents)) {
    agents.push({
      id,
      displayName: agent.persona?.name || agent.name,
      persona: agent.persona?.name,
      type: mapOpenCodeType(agent.type, agent.category),
      category: agent.category,
      status: 'active',
      sourcePath: metadataPath,
      skills: agent.dependencies?.filter(d => d.startsWith('skill:')) || [],
      commands: [],
      workflows: [],
      configFile: metadataPath,
      groupId: 'roninmemory'
    });
  }

  // Extract BMad agents
  const manifestPath = join(projectRoot, '_bmad/_config/agent-manifest.csv');
  const manifestContent = await readFile(manifestPath, 'utf-8');
  const manifest: BMadAgentManifest[] = parse(manifestContent, {
    columns: true,
    skip_empty_lines: true
  });

  for (const bmadAgent of manifest) {
    agents.push({
      id: bmadAgent.name,
      displayName: bmadAgent.displayName,
      persona: bmadAgent.displayName,
      type: bmadAgent.name.startsWith('wds-') ? 'WDS Persona' : 'BMad Persona',
      category: bmadAgent.module,
      status: 'active',
      sourcePath: join(projectRoot, bmadAgent.path),
      skills: [],
      commands: [],
      workflows: [],
      configFile: manifestPath,
      groupId: 'roninmemory'
    });
  }

  return agents;
}

function mapOpenCodeType(type?: string, category?: string): 'OpenAgent' | 'Specialist' | 'Worker' {
  if (category?.includes('subagents')) return 'Specialist';
  if (type === 'agent') return 'OpenAgent';
  return 'Worker';
}

// CLI entry point
if (import.meta.main) {
  const projectRoot = process.cwd();
  const agents = await extractAgents(projectRoot);
  console.log(JSON.stringify(agents, null, 2));
}
```

- [ ] **Step 2: Write failing test**

```typescript
// tests/opencode-registry/extract-agents.test.ts
import { describe, test, expect } from 'bun:test';
import { extractAgents } from '../../scripts/opencode-registry/extract-agents';

describe('extractAgents', () => {
  test('should extract agents from local sources', async () => {
    const projectRoot = process.cwd();
    const agents = await extractAgents(projectRoot);
    
    expect(agents.length).toBeGreaterThan(0);
    expect(agents.some(a => a.id === 'memory-orchestrator')).toBe(true);
    expect(agents.some(a => a.id === 'bmad-agent-architect')).toBe(true);
  });
});
```

- [ ] **Step 3: Run test**

Run: `bun test tests/opencode-registry/extract-agents.test.ts`
Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add scripts/opencode-registry/extract-agents.ts tests/opencode-registry/extract-agents.test.ts
git commit -m "feat: add agent extraction script"
```

### Task 3.2: Extract Skills

**Files:**
- Create: `scripts/opencode-registry/extract-skills.ts`

- [ ] **Step 1: Create skill extractor**

```typescript
// scripts/opencode-registry/extract-skills.ts
import { glob } from 'glob';
import { readFile } from 'fs/promises';
import { join, basename } from 'path';
import type { CanonicalSkill } from '../../src/lib/opencode-registry/types';

export async function extractSkills(projectRoot: string): Promise<CanonicalSkill[]> {
  const skills: CanonicalSkill[] = [];
  
  const skillFiles = await glob('.opencode/skills/*/SKILL.md', {
    cwd: projectRoot,
    absolute: true
  });

  for (const skillPath of skillFiles) {
    const skillDir = basename(join(skillPath, '..'));
    const content = await readFile(skillPath, 'utf-8');
    
    // Extract frontmatter if present
    const frontmatterMatch = content.match(/^---\n([\s\S]*?)\n---/);
    const frontmatter = frontmatterMatch ? parseFrontmatter(frontmatterMatch[1]) : {};
    
    skills.push({
      id: skillDir,
      displayName: frontmatter.name || skillDir,
      category: mapSkillCategory(skillDir),
      description: frontmatter.description,
      sourcePath: skillPath,
      requiredTools: extractRequiredTools(content),
      status: 'active',
      agents: [],
      usageCount: 0
    });
  }

  return skills;
}

function parseFrontmatter(yaml: string): Record<string, any> {
  const result: Record<string, any> = {};
  const lines = yaml.split('\n');
  for (const line of lines) {
    const match = line.match(/^(\w+):\s*(.+)$/);
    if (match) {
      result[match[1]] = match[2];
    }
  }
  return result;
}

function mapSkillCategory(skillId: string): 'bmad' | 'wds' | 'tea' | 'context' | undefined {
  if (skillId.startsWith('bmad-')) return 'bmad';
  if (skillId.startsWith('wds-')) return 'wds';
  if (skillId.includes('testarch') || skillId.includes('tea')) return 'tea';
  return 'context';
}

function extractRequiredTools(content: string): ('read' | 'write' | 'edit' | 'bash' | 'grep' | 'task')[] {
  const tools: ('read' | 'write' | 'edit' | 'bash' | 'grep' | 'task')[] = [];
  if (content.includes('Read(') || content.includes('read tool')) tools.push('read');
  if (content.includes('Write(') || content.includes('write tool')) tools.push('write');
  if (content.includes('Edit(') || content.includes('edit tool')) tools.push('edit');
  if (content.includes('Bash(') || content.includes('bash tool')) tools.push('bash');
  if (content.includes('Grep(') || content.includes('grep tool')) tools.push('grep');
  if (content.includes('Task(') || content.includes('task tool')) tools.push('task');
  return tools;
}

// CLI entry point
if (import.meta.main) {
  const projectRoot = process.cwd();
  const skills = await extractSkills(projectRoot);
  console.log(JSON.stringify(skills, null, 2));
}
```

- [ ] **Step 2: Write failing test**

```typescript
// tests/opencode-registry/extract-skills.test.ts
import { describe, test, expect } from 'bun:test';
import { extractSkills } from '../../scripts/opencode-registry/extract-skills';

describe('extractSkills', () => {
  test('should extract skills from .opencode/skills', async () => {
    const projectRoot = process.cwd();
    const skills = await extractSkills(projectRoot);
    
    expect(skills.length).toBeGreaterThan(50);
    expect(skills.some(s => s.id === 'bmad-party-mode')).toBe(true);
    expect(skills.some(s => s.id === 'brainstorming')).toBe(true);
  });
});
```

- [ ] **Step 3: Run test**

Run: `bun test tests/opencode-registry/extract-skills.test.ts`
Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add scripts/opencode-registry/extract-skills.ts tests/opencode-registry/extract-skills.test.ts
git commit -m "feat: add skill extraction script"
```

### Task 3.3: Extract Commands

**Files:**
- Create: `scripts/opencode-registry/extract-commands.ts`

- [ ] **Step 1: Create command extractor**

```typescript
// scripts/opencode-registry/extract-commands.ts
import { glob } from 'glob';
import { readFile } from 'fs/promises';
import { join, basename } from 'path';
import type { CanonicalCommand } from '../../src/lib/opencode-registry/types';

export async function extractCommands(projectRoot: string): Promise<CanonicalCommand[]> {
  const commands: CanonicalCommand[] = [];
  
  const commandFiles = await glob('.opencode/command/**/*.md', {
    cwd: projectRoot,
    absolute: true
  });

  for (const cmdPath of commandFiles) {
    const cmdName = basename(cmdPath, '.md');
    const content = await readFile(cmdPath, 'utf-8');
    
    // Extract metadata from markdown
    const titleMatch = content.match(/^#\s+(.+)$/m);
    const usageMatch = content.match(/Usage[\s\S]*?```bash\n([^\n]+)/);
    
    commands.push({
      id: cmdName,
      intent: titleMatch ? titleMatch[1] : undefined,
      category: mapCommandCategory(cmdName),
      sourcePath: cmdPath,
      inputSchema: undefined,
      outputSchema: undefined,
      requiresHitl: content.includes('HITL') || content.includes('human-in-the-loop'),
      status: 'active',
      skills: [],
      agents: []
    });
  }

  return commands;
}

function mapCommandCategory(cmdName: string): 'memory' | 'knowledge' | 'tenant' | 'audit' | 'agent' | 'sync' | undefined {
  if (cmdName.includes('memory') || cmdName.includes('sync')) return 'sync';
  if (cmdName.includes('context')) return 'knowledge';
  if (cmdName.includes('test')) return 'audit';
  if (cmdName.includes('bmad') || cmdName.includes('agent')) return 'agent';
  return 'memory';
}

// CLI entry point
if (import.meta.main) {
  const projectRoot = process.cwd();
  const commands = await extractCommands(projectRoot);
  console.log(JSON.stringify(commands, null, 2));
}
```

- [ ] **Step 2: Write failing test**

```typescript
// tests/opencode-registry/extract-commands.test.ts
import { describe, test, expect } from 'bun:test';
import { extractCommands } from '../../scripts/opencode-registry/extract-commands';

describe('extractCommands', () => {
  test('should extract commands from .opencode/command', async () => {
    const projectRoot = process.cwd();
    const commands = await extractCommands(projectRoot);
    
    expect(commands.length).toBeGreaterThan(15);
    expect(commands.some(c => c.id === 'quickprompt')).toBe(true);
    expect(commands.some(c => c.id === 'bmad')).toBe(true);
  });
});
```

- [ ] **Step 3: Run test**

Run: `bun test tests/opencode-registry/extract-commands.test.ts`
Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add scripts/opencode-registry/extract-commands.ts tests/opencode-registry/extract-commands.test.ts
git commit -m "feat: add command extraction script"
```

### Task 3.4: Extract Workflows

**Files:**
- Create: `scripts/opencode-registry/extract-workflows.ts`

- [ ] **Step 1: Create workflow extractor**

```typescript
// scripts/opencode-registry/extract-workflows.ts
import { glob } from 'glob';
import { readFile } from 'fs/promises';
import { parse } from 'csv-parse/sync';
import { join } from 'path';
import type { CanonicalWorkflow } from '../../src/lib/opencode-registry/types';

interface BMadHelpEntry {
  name: string;
  code: string;
  sequence?: string;
  workflowFile: string;
  agentName?: string;
  required?: string;
  module: string;
}

export async function extractWorkflows(projectRoot: string): Promise<CanonicalWorkflow[]> {
  const workflows: CanonicalWorkflow[] = [];

  // Parse all module-help.csv files
  const helpFiles = await glob('_bmad/*/module-help.csv', {
    cwd: projectRoot,
    absolute: true
  });

  for (const helpPath of helpFiles) {
    const content = await readFile(helpPath, 'utf-8');
    const entries: BMadHelpEntry[] = parse(content, {
      columns: true,
      skip_empty_lines: true
    });

    const moduleName = helpPath.split('/').slice(-2, -1)[0];

    for (const entry of entries) {
      workflows.push({
        code: entry.code,
        name: entry.name,
        module: moduleName as any,
        phase: undefined, // would need to derive from sequence or file path
        description: entry.workflowFile,
        agent: entry.agentName,
        required: entry.required === 'true',
        sequence: entry.sequence ? parseInt(entry.sequence) : undefined,
        sourcePath: helpPath,
        status: 'active'
      });
    }
  }

  return workflows;
}

// CLI entry point
if (import.meta.main) {
  const projectRoot = process.cwd();
  const workflows = await extractWorkflows(projectRoot);
  console.log(JSON.stringify(workflows, null, 2));
}
```

- [ ] **Step 2: Write failing test**

```typescript
// tests/opencode-registry/extract-workflows.test.ts
import { describe, test, expect } from 'bun:test';
import { extractWorkflows } from '../../scripts/opencode-registry/extract-workflows';

describe('extractWorkflows', () => {
  test('should extract workflows from _bmad module-help.csv files', async () => {
    const projectRoot = process.cwd();
    const workflows = await extractWorkflows(projectRoot);
    
    expect(workflows.length).toBeGreaterThan(30);
    expect(workflows.some(w => w.code === 'CP')).toBe(true);
    expect(workflows.some(w => w.module === 'bmm')).toBe(true);
  });
});
```

- [ ] **Step 3: Run test**

Run: `bun test tests/opencode-registry/extract-workflows.test.ts`
Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add scripts/opencode-registry/extract-workflows.ts tests/opencode-registry/extract-workflows.test.ts
git commit -m "feat: add workflow extraction script"
```

---

## Phase 4: Normalization and Relation Graph

### Task 4.1: Build Normalization Layer

**Files:**
- Create: `scripts/opencode-registry/normalize.ts`

- [ ] **Step 1: Create normalizer**

```typescript
// scripts/opencode-registry/normalize.ts
import type { CanonicalAgent, CanonicalSkill, CanonicalCommand, CanonicalWorkflow } from '../../src/lib/opencode-registry/types';

export interface NormalizedRegistry {
  agents: CanonicalAgent[];
  skills: CanonicalSkill[];
  commands: CanonicalCommand[];
  workflows: CanonicalWorkflow[];
  relationGraph: RelationGraph;
}

export interface RelationGraph {
  agentToSkills: Map<string, string[]>;
  agentToCommands: Map<string, string[]>;
  agentToWorkflows: Map<string, string[]>;
  commandToSkills: Map<string, string[]>;
  workflowToAgent: Map<string, string>;
}

export function normalizeRegistry(
  agents: CanonicalAgent[],
  skills: CanonicalSkill[],
  commands: CanonicalCommand[],
  workflows: CanonicalWorkflow[]
): NormalizedRegistry {
  
  const relationGraph: RelationGraph = {
    agentToSkills: new Map(),
    agentToCommands: new Map(),
    agentToWorkflows: new Map(),
    commandToSkills: new Map(),
    workflowToAgent: new Map()
  };

  // Link agents to skills
  for (const agent of agents) {
    if (agent.skills.length > 0) {
      relationGraph.agentToSkills.set(agent.id, agent.skills);
    }
  }

  // Link workflows to agents
  for (const workflow of workflows) {
    if (workflow.agent) {
      relationGraph.workflowToAgent.set(workflow.code, workflow.agent);
      
      // Add reverse relation to agent
      const agentWorkflows = relationGraph.agentToWorkflows.get(workflow.agent) || [];
      agentWorkflows.push(workflow.code);
      relationGraph.agentToWorkflows.set(workflow.agent, agentWorkflows);
    }
  }

  return {
    agents,
    skills,
    commands,
    workflows,
    relationGraph
  };
}
```

- [ ] **Step 2: Write failing test**

```typescript
// tests/opencode-registry/normalize.test.ts
import { describe, test, expect } from 'bun:test';
import { normalizeRegistry } from '../../scripts/opencode-registry/normalize';

describe('normalizeRegistry', () => {
  test('should build relation graph from entities', () => {
    const agents = [{ id: 'memory-orchestrator', skills: ['skill-1'], commands: [], workflows: [], status: 'active', type: 'OpenAgent', sourcePath: '' }];
    const skills = [{ id: 'skill-1', agents: [], status: 'active', sourcePath: '' }];
    const commands = [];
    const workflows = [];

    const normalized = normalizeRegistry(agents, skills, commands, workflows);
    
    expect(normalized.relationGraph.agentToSkills.get('memory-orchestrator')).toEqual(['skill-1']);
  });
});
```

- [ ] **Step 3: Run test**

Run: `bun test tests/opencode-registry/normalize.test.ts`
Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add scripts/opencode-registry/normalize.ts tests/opencode-registry/normalize.test.ts
git commit -m "feat: add normalization layer with relation graph"
```

---

## Phase 5: Sync Engine

### Task 5.1: Build Sync Orchestrator

**Files:**
- Create: `scripts/opencode-registry/sync.ts`

- [ ] **Step 1: Create sync orchestrator**

```typescript
// scripts/opencode-registry/sync.ts
import { extractAgents } from './extract-agents';
import { extractSkills } from './extract-skills';
import { extractCommands } from './extract-commands';
import { extractWorkflows } from './extract-workflows';
import { normalizeRegistry } from './normalize';
import { verifySync, DriftReport } from './verify';
import { logSyncRun } from './sync-registry-logger';
import { NotionRegistryClient } from '../../src/lib/opencode-registry/notion-client';
import { config } from 'dotenv';
config();

interface SyncOptions {
  dryRun?: boolean;
  verbose?: boolean;
}

export async function syncRegistry(options: SyncOptions = {}): Promise<void> {
  const projectRoot = process.cwd();
  
  console.log('Extracting local entities...');
  const agents = await extractAgents(projectRoot);
  const skills = await extractSkills(projectRoot);
  const commands = await extractCommands(projectRoot);
  const workflows = await extractWorkflows(projectRoot);
  
  console.log('Normalizing registry...');
  const normalized = normalizeRegistry(agents, skills, commands, workflows);
  
  console.log('Comparing with Notion...');
  const client = new NotionRegistryClient({
    agentsDbId: process.env.NOTION_AGENTS_DB_ID!,
    skillsDbId: process.env.NOTION_SKILLS_DB_ID!,
    commandsDbId: process.env.NOTION_COMMANDS_DB_ID!,
    workflowsDbId: process.env.NOTION_WORKFLOWS_DB_ID!,
    syncRegistryDbId: process.env.NOTION_SYNC_REGISTRY_DB_ID!
  });
  
  const drift = await verifySync(normalized, client);
  
  if (options.dryRun) {
    console.log('DRY RUN - Would sync:');
    console.log(`  Agents: ${drift.missingInNotion.length} creates, ${drift.fieldMismatches.length} updates`);
    console.log(`  Skills: ${normalized.skills.length} total`);
    console.log(`  Commands: ${normalized.commands.length} total`);
    console.log(`  Workflows: ${normalized.workflows.length} total`);
    console.log(`  Broken Links: ${drift.brokenLinks.length}`);
    return;
  }
  
  console.log('Upserting to Notion...');
  let syncedAgents = 0;
  let syncedSkills = 0;
  let syncedCommands = 0;
  let syncedWorkflows = 0;
  
  // Create missing agents
  for (const agentId of drift.missingInNotion) {
    const agent = normalized.agents.find(a => a.id === agentId);
    if (agent) {
      await client.createAgent(agent);
      syncedAgents++;
    }
  }
  
  // Log sync run
  await logSyncRun(client, {
    runId: `sync-${Date.now()}`,
    runDate: new Date(),
    status: drift.brokenLinks.length > 0 ? 'partial' : 'success',
    agentsSynced: syncedAgents,
    skillsSynced: syncedSkills,
    commandsSynced: syncedCommands,
    workflowsSynced: syncedWorkflows,
    driftReport: JSON.stringify(drift, null, 2),
    brokenLinks: drift.brokenLinks.length,
    missingLocal: drift.missingInLocal.length,
    missingNotion: drift.missingInNotion.length
  });
  
  console.log('Sync complete');
}

// CLI entry point
if (import.meta.main) {
  const args = process.argv.slice(2);
  const dryRun = args.includes('--dry-run');
  
  syncRegistry({ dryRun }).catch(console.error);
}
```

- [ ] **Step 2: Create verification module**

```typescript
// scripts/opencode-registry/verify.ts
import type { NormalizedRegistry } from './normalize';
import type { NotionRegistryClient } from '../../src/lib/opencode-registry/notion-client';

export interface DriftReport {
  missingInNotion: string[];
  missingInLocal: string[];
  fieldMismatches: Array<{id: string, field: string, local: any, notion: any}>;
  brokenLinks: Array<{from: string, to: string, relation: string}>;
}

export async function verifySync(
  local: NormalizedRegistry,
  client: NotionRegistryClient
): Promise<DriftReport> {
  
  const notionAgents = await client.queryAgents();
  const localAgentIds = new Set(local.agents.map(a => a.id));
  const notionAgentIds = new Set(notionAgents.map(a => a.id));
  
  const missingInNotion = [...localAgentIds].filter(id => !notionAgentIds.has(id));
  const missingInLocal = [...notionAgentIds].filter(id => !localAgentIds.has(id));
  
  // Check broken links
  const brokenLinks: Array<{from: string, to: string, relation: string}> = [];
  
  for (const [agentId, skillIds] of local.relationGraph.agentToSkills) {
    for (const skillId of skillIds) {
      const skillExists = local.skills.some(s => s.id === skillId);
      if (!skillExists) {
        brokenLinks.push({from: agentId, to: skillId, relation: 'agent->skill'});
      }
    }
  }
  
  return {
    missingInNotion,
    missingInLocal,
    fieldMismatches: [], // would need field-by-field comparison
    brokenLinks
  };
}
```

- [ ] **Step 3: Create sync registry logger**

```typescript
// scripts/opencode-registry/sync-registry-logger.ts
import type { NotionRegistryClient } from '../../src/lib/opencode-registry/types';
import type { SyncRun } from '../../src/lib/opencode-registry/types';

export async function logSyncRun(client: any, run: SyncRun): Promise<void> {
  await client.createSyncRun(run);
}
```

- [ ] **Step 4: Write integration test (skip in CI)**

```typescript
// tests/opencode-registry/sync.test.ts
import { describe, test, expect } from 'bun:test';

describe.skip('syncRegistry', () => {
  test('should sync local entities to Notion', async () => {
    // Integration test - requires NOTION_API_KEY
  });
});
```

- [ ] **Step 5: Commit**

```bash
git add scripts/opencode-registry/sync.ts scripts/opencode-registry/verify.ts scripts/opencode-registry/sync-registry-logger.ts tests/opencode-registry/sync.test.ts
git commit -m "feat: add sync orchestrator with drift detection"
```

---

## Phase 6: CLI Commands

### Task 6.1: Create Package.json Scripts

**Files:**
- Modify: `package.json`

- [ ] **Step 1: Add registry scripts**

```json
{
  "scripts": {
    "registry:sync": "bun tsx scripts/opencode-registry/sync.ts",
    "registry:dry-run": "bun tsx scripts/opencode-registry/sync.ts --dry-run"
  }
}
```

- [ ] **Step 2: Test dry-run command**

Run: `bun run registry:dry-run`
Expected: Shows counts of entities to sync without making changes

- [ ] **Step 3: Commit**

```bash
git add package.json
git commit -m "feat: add registry sync npm scripts"
```

---

## Verification Checklist

- [ ] All 5 Notion databases created with correct schemas
- [ ] TypeScript types compile without errors
- [ ] Extraction scripts parse all local sources
- [ ] Normalization builds relation graph correctly
- [ ] Sync engine detects drift between local and Notion
- [ ] Dry-run mode shows entities without upserting
- [ ] Full sync creates missing entries in Notion
- [ ] Sync Registry logs audit trail
- [ ] Running sync twice is idempotent (no changes on second run)

---

**Plan complete. Ready for execution.**