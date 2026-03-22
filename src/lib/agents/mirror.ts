/**
 * Agent Mirroring Pipeline
 * Epic 6, Story 6.4: Mirror Approved Agents to Notion Registry
 */

import { AgentPostgresClient, getAgentClient, AgentRecord } from './postgres-client';
import { AgentNotionClient, getAgentNotionClient } from './notion-client';

export interface MirrorResult {
  agent_id: string;
  status: 'created' | 'updated' | 'skipped' | 'archived';
  notion_page_id: string | null;
  notion_url: string | null;
  reason?: string;
}

export interface MirrorOptions {
  min_confidence?: number;
  status_filter?: string[];
  dry_run?: boolean;
}

const DEFAULT_MIN_CONFIDENCE = 0.7;
const APPROVED_STATUSES = ['Active', 'Testing'];

// SQLite/PostgreSQL table for tracking Notion mappings
const CREATE_MIRROR_TABLE = `
CREATE TABLE IF NOT EXISTS agent_notion_mapping (
  agent_id TEXT PRIMARY KEY,
  notion_page_id TEXT NOT NULL,
  notion_url TEXT,
  last_synced TIMESTAMPTZ DEFAULT NOW()
);
`;

export class AgentMirrorPipeline {
  private pgClient: AgentPostgresClient;
  private notionClient: AgentNotionClient;
  private minConfidence: number;

  constructor(pgClient?: AgentPostgresClient, notionClient?: AgentNotionClient, minConfidence?: number) {
    this.pgClient = pgClient || getAgentClient();
    this.notionClient = notionClient || getAgentNotionClient();
    this.minConfidence = minConfidence || DEFAULT_MIN_CONFIDENCE;
  }

  async mirrorAgent(agentId: string, options?: MirrorOptions): Promise<MirrorResult> {
    const minConf = options?.min_confidence ?? this.minConfidence;

    // 1. Get agent from PostgreSQL
    const agent = await this.pgClient.getAgent(agentId);
    
    if (!agent) {
      return {
        agent_id: agentId,
        status: 'skipped',
        notion_page_id: null,
        notion_url: null,
        reason: 'Agent not found in PostgreSQL'
      };
    }

    // 2. Check confidence threshold
    if (agent.confidence_score < minConf) {
      return {
        agent_id: agentId,
        status: 'skipped',
        notion_page_id: null,
        notion_url: null,
        reason: `Confidence ${agent.confidence_score} below threshold ${minConf}`
      };
    }

    // 3. Check if agent status is approved
    const approvedStatuses = options?.status_filter || APPROVED_STATUSES;
    if (!approvedStatuses.includes(agent.status)) {
      return {
        agent_id: agentId,
        status: 'skipped',
        notion_page_id: null,
        notion_url: null,
        reason: `Status ${agent.status} not in approved list: ${approvedStatuses.join(', ')}`
      };
    }

    // 4. Dry run check
    if (options?.dry_run) {
      return {
        agent_id: agentId,
        status: 'skipped',
        notion_page_id: null,
        notion_url: null,
        reason: 'Dry run - no changes made'
      };
    }

    // 5. Check if agent already exists in Notion
    const existingPage = await this.notionClient.getAgentPage(agentId);

    let pageId: string;
    let status: 'created' | 'updated' | 'archived';

    // 6. Handle archived status
    if (agent.status === 'Archived' || agent.status === 'Deprecated') {
      if (existingPage) {
        await this.notionClient.archiveAgentPage(existingPage.id);
        return {
          agent_id: agentId,
          status: 'archived',
          notion_page_id: existingPage.id,
          notion_url: existingPage.url
        };
      }
      return {
        agent_id: agentId,
        status: 'skipped',
        notion_page_id: null,
        notion_url: null,
        reason: 'Agent is archived and not in Notion'
      };
    }

    // 7. Create or update Notion page
    if (existingPage) {
      await this.notionClient.updateAgentPage(existingPage.id, agent);
      pageId = existingPage.id;
      status = 'updated';
    } else {
      pageId = await this.notionClient.createAgentPage(agent);
      status = 'created';
    }

    // 8. Store mapping (would need database call here)
    // For now, we just return the result

    return {
      agent_id: agentId,
      status,
      notion_page_id: pageId,
      notion_url: `https://notion.so/${pageId.replace(/-/g, '')}`
    };
  }

  async mirrorAllAgents(options?: MirrorOptions): Promise<MirrorResult[]> {
    const minConf = options?.min_confidence ?? this.minConfidence;
    const statuses = options?.status_filter || APPROVED_STATUSES;

    // Get all agents matching criteria
    const agents = await this.pgClient.listAgents({
      min_confidence: minConf
    });

    // Filter by status
    const filteredAgents = agents.filter(a => statuses.includes(a.status));

    const results: MirrorResult[] = [];

    for (const agent of filteredAgents) {
      try {
        const result = await this.mirrorAgent(agent.agent_id, options);
        results.push(result);
      } catch (error) {
        results.push({
          agent_id: agent.agent_id,
          status: 'skipped',
          notion_page_id: null,
          notion_url: null,
          reason: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    }

    return results;
  }

  async syncAgentToNotion(agentId: string): Promise<MirrorResult> {
    return this.mirrorAgent(agentId, {
      min_confidence: 0, // Override confidence check for explicit sync
      status_filter: ['Draft', 'Testing', 'Active', 'Deprecated', 'Archived']
    });
  }
}

// Singleton instance
let pipelineInstance: AgentMirrorPipeline | null = null;

export function getMirrorPipeline(): AgentMirrorPipeline {
  if (!pipelineInstance) {
    pipelineInstance = new AgentMirrorPipeline();
  }
  return pipelineInstance;
}