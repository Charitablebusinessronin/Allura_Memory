/**
 * Agent Retirement and Archival
 * Epic 6, Story 6.10: Support Agent Retirement and Archival
 */

import { AgentPostgresClient, getAgentClient, AgentRecord } from './postgres-client';
import { AgentNeo4jClient, getAgentNeo4jClient } from './neo4j-client';
import { AgentLifecycle, getAgentLifecycle } from './lifecycle';
import { AgentNotionClient, getAgentNotionClient } from './notion-client';

export interface ArchiveResult {
  agent_id: string;
  status: 'archived' | 'restored';
  archived_at?: Date;
  restored_at?: Date;
  notion_archived: boolean;
  neo4j_preserved: boolean;
  postgres_preserved: boolean;
}

export interface ArchiveStats {
  total_archived: number;
  by_module: Record<string, number>;
  by_platform: Record<string, number>;
  avg_age_days: number;
}

const ARCHIVAL_THRESHOLD_DAYS = 90;

export class AgentArchive {
  private pgClient: AgentPostgresClient;
  private neo4jClient: AgentNeo4jClient;
  private lifecycle: AgentLifecycle;
  private notionClient: AgentNotionClient;

  constructor(
    pgClient?: AgentPostgresClient,
    neo4jClient?: AgentNeo4jClient,
    lifecycle?: AgentLifecycle,
    notionClient?: AgentNotionClient
  ) {
    this.pgClient = pgClient || getAgentClient();
    this.neo4jClient = neo4jClient || getAgentNeo4jClient();
    this.lifecycle = lifecycle || getAgentLifecycle();
    this.notionClient = notionClient || getAgentNotionClient();
  }

  async archiveAgent(agentId: string): Promise<ArchiveResult> {
    // Get agent
    const agent = await this.pgClient.getAgent(agentId);
    
    if (!agent) {
      throw new Error(`Agent ${agentId} not found`);
    }

    // Check if already archived
    if (agent.status === 'Archived') {
      throw new Error(`Agent ${agentId} is already archived`);
    }

    // Check if deprecated long enough
    if (agent.status !== 'Deprecated') {
      // If not deprecated, need to deprecate first
      if (agent.status === 'Active') {
        await this.lifecycle.transition(agentId, 'Deprecated', 'Preparing for archival');
      }
    }

    // Get final usage stats
    const usageStats = await this.pgClient.getUsageStats(agentId);

    // Transition to Archived
    await this.pgClient.updateAgent(agentId, { status: 'Archived' });

    // Update Neo4j (preserve as read-only)
    await this.neo4jClient.updateAgent(agentId, { status: 'Archived' });

    // Archive in Notion (move to Archive database)
    let notionArchived = false;
    try {
      const notionPage = await this.notionClient.getAgentPage(agentId);
      if (notionPage) {
        await this.notionClient.archiveAgentPage(notionPage.id);
        notionArchived = true;
      }
    } catch (e) {
      console.warn(`Failed to archive in Notion: ${e}`);
    }

    // Log final statistics
    await this.logArchiveStats(agentId, usageStats);

    return {
      agent_id: agentId,
      status: 'archived',
      archived_at: new Date(),
      notion_archived: notionArchived,
      neo4j_preserved: true,
      postgres_preserved: true
    };
  }

  async restoreAgent(agentId: string): Promise<ArchiveResult> {
    // Get agent
    const agent = await this.pgClient.getAgent(agentId);
    
    if (!agent) {
      throw new Error(`Agent ${agentId} not found`);
    }

    // Check if currently archived
    if (agent.status !== 'Archived') {
      throw new Error(`Agent ${agentId} is not archived (status: ${agent.status})`);
    }

    // Transition to Testing (requires re-approval)
    await this.pgClient.updateAgent(agentId, { status: 'Testing', confidence_score: 0.0 });

    // Update Neo4j
    await this.neo4jClient.updateAgent(agentId, { status: 'Testing' });

    // Restore in Notion (create new page)
    let notionRestored = false;
    try {
      await this.notionClient.createAgentPage(agent);
      notionRestored = true;
    } catch (e) {
      console.warn(`Failed to restore in Notion: ${e}`);
    }

    return {
      agent_id: agentId,
      status: 'restored',
      restored_at: new Date(),
      notion_archived: false,
      neo4j_preserved: true,
      postgres_preserved: true
    };
  }

  async getArchivedAgents(): Promise<AgentRecord[]> {
    return this.pgClient.listAgents({ status: 'Archived' });
  }

  async getAgentsReadyForArchive(): Promise<AgentRecord[]> {
    // Get deprecated agents
    const deprecatedAgents = await this.pgClient.listAgents({ status: 'Deprecated' });

    // Filter by age
    const thresholdDate = new Date(Date.now() - ARCHIVAL_THRESHOLD_DAYS * 24 * 60 * 60 * 1000);

    return deprecatedAgents.filter(agent => {
      const updatedDate = new Date(agent.updated_at);
      return updatedDate < thresholdDate;
    });
  }

  async runArchivalJob(): Promise<ArchiveResult[]> {
    const agentsToArchive = await this.getAgentsReadyForArchive();
    const results: ArchiveResult[] = [];

    for (const agent of agentsToArchive) {
      try {
        const result = await this.archiveAgent(agent.agent_id);
        results.push(result);
      } catch (e) {
        console.error(`Failed to archive ${agent.agent_id}:`, e);
      }
    }

    return results;
  }

  async getArchiveStats(): Promise<ArchiveStats> {
    const archivedAgents = await this.getArchivedAgents();

    const stats: ArchiveStats = {
      total_archived: archivedAgents.length,
      by_module: {},
      by_platform: {},
      avg_age_days: 0
    };

    let totalAge = 0;

    for (const agent of archivedAgents) {
      // Count by module
      stats.by_module[agent.module] = (stats.by_module[agent.module] || 0) + 1;

      // Count by platform
      stats.by_platform[agent.platform] = (stats.by_platform[agent.platform] || 0) + 1;

      // Calculate age
      const createdDate = new Date(agent.created_at);
      const ageMs = Date.now() - createdDate.getTime();
      totalAge += ageMs / (24 * 60 * 60 * 1000);
    }

    stats.avg_age_days = archivedAgents.length > 0 ? totalAge / archivedAgents.length : 0;

    return stats;
  }

  async isArchived(agentId: string): Promise<boolean> {
    const agent = await this.pgClient.getAgent(agentId);
    return agent?.status === 'Archived';
  }

  async purgeAgent(agentId: string): Promise<void> {
    // WARNING: This permanently deletes the agent
    // Only use for GDPR/right-to-forget requests

    const agent = await this.pgClient.getAgent(agentId);
    
    if (!agent) {
      throw new Error(`Agent ${agentId} not found`);
    }

    if (agent.status !== 'Archived') {
      throw new Error(`Agent ${agentId} must be archived before purging`);
    }

    // Delete from Neo4j
    await this.neo4jClient.deleteAgent(agentId);

    // Delete from PostgreSQL (cascades to agent_versions, agent_usage)
    await this.pgClient.deleteAgent(agentId);

    // Note: Notion pages are archived, not deleted
  }

  private async logArchiveStats(
    agentId: string,
    stats: { total_executions: number; successful_executions: number; avg_duration_ms: number }
  ): Promise<void> {
    // Log to agent_versions
    await (this.pgClient as any).pool.query(
      `INSERT INTO agent_versions (agent_id, version, status, confidence_score, notes)
       VALUES ($1, 'archived', 'Archived', 0, $2)`,
      [agentId, `Final stats: ${stats.total_executions} executions, ${stats.successful_executions} successful, avg ${stats.avg_duration_ms}ms`]
    );
  }
}

// Singleton instance
let archiveInstance: AgentArchive | null = null;

export function getAgentArchive(): AgentArchive {
  if (!archiveInstance) {
    archiveInstance = new AgentArchive();
  }
  return archiveInstance;
}