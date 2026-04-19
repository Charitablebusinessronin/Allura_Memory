// scripts/hydration/notion-client.ts
// MCP_DOCKER Notion API wrapper with Zod validation
//
// ⛔ DEPRECATED — DO NOT USE IN NEW CODE
//
// Direct Notion REST API calls (api.notion.com) are deprecated.
// All Notion access MUST go through MCP tools:
//   - Production: mcp__claude_ai_Notion__notion-create-pages (via curator pipeline)
//   - Hydration: mcp__MCP_DOCKER__notion-create-pages (via MCP Docker toolkit)
//
// This file exists ONLY for backward compatibility with legacy hydration scripts.
// New code MUST NOT import from this module. See AD-CURATOR-NOTION in
// RISKS-AND-DECISIONS.md for the architectural decision.
//
// No NOTION_API_KEY is required — auth is handled by the remote MCP service.
// The REST calls below will be removed once all hydration scripts are
// migrated to MCP-only paths.

import { z } from 'zod';

import { DEFAULT_NOTION_GROUP_ID } from './agent-identity';

const GROUP_ID = DEFAULT_NOTION_GROUP_ID;

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

import { setTimeout } from 'timers/promises';

const NOTION_API_BASE_URL = 'https://api.notion.com/v1';
const NOTION_API_VERSION = '2022-06-28';

/**
 * Retry wrapper with exponential backoff
 */
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
        console.log(`   ⚠️  Rate limited, retrying in ${delay * (i + 1)}ms...`);
        await setTimeout(delay * (i + 1));
        continue;
      }
      throw error;
    }
  }
  throw new Error('Max retries exceeded');
}

// Type definitions for MCP_DOCKER responses
interface NotionPageResponse {
  id: string;
}

interface NotionDatabaseQueryResponse {
  results?: Array<Record<string, unknown>>;
}

interface NotionDatabaseResponse {
  properties?: Record<string, unknown>;
  url?: string;
}

// Notion access is via mcp__claude_ai_Notion__* MCP tools — no API key needed.
// Direct REST calls below use NOTION_MCP_URL as the gateway base URL.

function getNotionHeaders(): Record<string, string> {
  return {
    'Notion-Version': NOTION_API_VERSION,
    'Content-Type': 'application/json',
  };
}

async function notionRequest<T>(
  path: string,
  init: RequestInit,
): Promise<T> {
  const response = await fetch(`${NOTION_API_BASE_URL}${path}`, {
    ...init,
    headers: {
      ...getNotionHeaders(),
      ...(init.headers ?? {}),
    },
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Notion request failed (${response.status}): ${errorText}`);
  }

  return response.json() as Promise<T>;
}

function extractDatabaseIdFromViewUrl(viewUrl: string): string {
  const match = viewUrl.match(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i);

  if (!match) {
    throw new Error(`Unable to extract database ID from view URL: ${viewUrl}`);
  }

  return match[0];
}

/**
 * @deprecated Use mcp__claude_ai_Notion__notion-create-pages or mcp__MCP_DOCKER__notion-create-pages instead.
 * Create a Notion page in a database using MCP_DOCKER_notion-create-pages
 */
export async function createNotionPage(
  databaseId: string,
  properties: Record<string, unknown>
): Promise<string> {
  const response = await withRetry(() =>
    notionRequest<NotionPageResponse>('/pages', {
      method: 'POST',
      body: JSON.stringify({
        parent: { database_id: databaseId },
        properties,
      }),
    })
  );

  const pageId = response.id;
  if (!pageId) {
    throw new Error('Failed to create Notion page');
  }
  return pageId;
}

/**
 * @deprecated Use mcp__claude_ai_Notion__notion-query-database or mcp__MCP_DOCKER__notion-query-database instead.
 * Query a Notion database using MCP_DOCKER_notion-query-database-view
 */
export async function queryNotionDatabase(
  viewUrl: string
): Promise<Array<Record<string, unknown>>> {
  const databaseId = extractDatabaseIdFromViewUrl(viewUrl);
  const response = await withRetry(() =>
    notionRequest<NotionDatabaseQueryResponse>(`/databases/${databaseId}/query`, {
      method: 'POST',
      body: JSON.stringify({}),
    })
  );
  return response.results || [];
}

/**
 * @deprecated Use mcp__claude_ai_Notion__notion-fetch-database or mcp__MCP_DOCKER__notion-fetch-database instead.
 * Fetch a Notion database schema using MCP_DOCKER_notion-fetch
 */
export async function fetchNotionDatabase(
  databaseId: string
): Promise<{ schema: Record<string, unknown>; dataSources: Array<{ id: string; url: string }> }> {
  const response = await withRetry(() =>
    notionRequest<NotionDatabaseResponse>(`/databases/${databaseId}`, {
      method: 'GET',
    })
  );
  return {
    schema: response.properties || {},
    dataSources: response.url
      ? [{ id: databaseId, url: response.url }]
      : [],
  };
}

export { DATABASE_IDS, GROUP_ID };
