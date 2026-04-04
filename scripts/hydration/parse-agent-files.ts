// scripts/hydration/parse-agent-files.ts
// Parse agent markdown files and extract metadata from frontmatter

import fs from 'fs';
import path from 'path';
import yaml from 'yaml';
import { AgentSchema } from './notion-client';

export interface ParsedAgent {
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
      description: frontmatter.description || role,
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
    const agentType = agent.mode === 'primary' ? 'OpenAgent' : 'Specialist';

    // Extract skills referenced in permissions.task
    const skills = agent.permissions.task
      ? Object.keys(agent.permissions.task).filter(k => agent.permissions.task![k] === 'allow')
      : [];

    // Validate with Zod
    const agentData = AgentSchema.parse({
      name: agent.name,
      type: agentType,
      status: 'active',
      role: agent.description.substring(0, 100),
      groupId: 'roninmemory',
      skills,
      tokenBudget: agent.temperature === 0 ? 100000 : 200000,
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
