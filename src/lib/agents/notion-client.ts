/**
 * Agent Notion Client
 * Epic 6, Story 6.4: Mirror Approved Agents to Notion Registry
 */

import { AgentRecord } from './postgres-client';

const NOTION_DATABASE_ID = '25ba2b95-bf47-4f64-9ce0-7f93065b9414';
const NOTION_API_VERSION = '2022-06-28';

export interface NotionPage {
  id: string;
  url: string;
  properties: {
    Name: { title: { plain_text: string }[] };
    Type: { select: { name: string } | null };
    Module: { select: { name: string } | null };
    Platform: { select: { name: string } | null };
    Status: { select: { name: string } | null };
    Confidence: { number: number | null };
    Function: { rich_text: { plain_text: string }[] };
    'Source Path': { url: string | null };
  };
}

export interface NotionAgent {
  agent_id: string;
  notion_page_id: string;
  notion_url: string;
  last_synced: Date;
}

export class AgentNotionClient {
  private apiKey: string;
  private databaseId: string;

  constructor(apiKey?: string, databaseId?: string) {
    this.apiKey = apiKey || process.env.NOTION_API_KEY || '';
    this.databaseId = databaseId || NOTION_DATABASE_ID;
  }

  private async notionFetch(endpoint: string, method: string = 'GET', body?: object): Promise<any> {
    const response = await fetch(`https://api.notion.com/v1/${endpoint}`, {
      method,
      headers: {
        'Authorization': `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json',
        'Notion-Version': NOTION_API_VERSION
      },
      body: body ? JSON.stringify(body) : undefined
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Notion API error: ${response.status} - ${error}`);
    }

    return response.json();
  }

  async createAgentPage(agent: AgentRecord): Promise<string> {
    const emoji = this.getModuleEmoji(agent.module);
    
    const body = {
      parent: { database_id: this.databaseId },
      icon: { emoji },
      properties: {
        Name: {
          title: [{ text: { content: agent.name } }]
        },
        Type: {
          select: { name: this.mapAgentType(agent) }
        },
        Module: {
          select: { name: agent.module }
        },
        Platform: {
          select: { name: agent.platform }
        },
        Status: {
          select: { name: this.mapStatus(agent.status) }
        },
        Confidence: {
          number: agent.confidence_score
        },
        Function: {
          rich_text: [{ text: { content: agent.description } }]
        },
        'Source Path': {
          url: this.getSourcePath(agent)
        }
      }
    };

    const result = await this.notionFetch('pages', 'POST', body);
    return result.id;
  }

  async updateAgentPage(pageId: string, agent: AgentRecord): Promise<void> {
    const body = {
      properties: {
        Name: {
          title: [{ text: { content: agent.name } }]
        },
        Type: {
          select: { name: this.mapAgentType(agent) }
        },
        Module: {
          select: { name: agent.module }
        },
        Platform: {
          select: { name: agent.platform }
        },
        Status: {
          select: { name: this.mapStatus(agent.status) }
        },
        Confidence: {
          number: agent.confidence_score
        },
        Function: {
          rich_text: [{ text: { content: agent.description } }]
        },
        'Source Path': {
          url: this.getSourcePath(agent)
        }
      }
    };

    await this.notionFetch(`pages/${pageId}`, 'PATCH', body);
  }

  async getAgentPage(agentId: string): Promise<NotionPage | null> {
    // Search for agent by name/title
    const body = {
      filter: {
        property: 'Name',
        title: { contains: agentId }
      }
    };

    const result = await this.notionFetch(`databases/${this.databaseId}/query`, 'POST', body);
    
    if (result.results.length === 0) {
      return null;
    }

    return this.parsePage(result.results[0]);
  }

  async archiveAgentPage(pageId: string): Promise<void> {
    await this.notionFetch(`pages/${pageId}`, 'PATCH', { archived: true });
  }

  async listAgents(filter?: { module?: string; platform?: string; status?: string }): Promise<NotionPage[]> {
    const andFilters: object[] = [];
    
    if (filter?.module) {
      andFilters.push({
        property: 'Module',
        select: { equals: filter.module }
      });
    }
    
    if (filter?.platform) {
      andFilters.push({
        property: 'Platform',
        select: { equals: filter.platform }
      });
    }
    
    if (filter?.status) {
      andFilters.push({
        property: 'Status',
        select: { equals: filter.status }
      });
    }

    const body = andFilters.length > 0 
      ? { filter: { and: andFilters } }
      : {};

    const result = await this.notionFetch(`databases/${this.databaseId}/query`, 'POST', body);
    return result.results.map((page: any) => this.parsePage(page));
  }

  private parsePage(page: any): NotionPage {
    return {
      id: page.id,
      url: page.url,
      properties: {
        Name: { title: page.properties.Name.title },
        Type: { select: page.properties.Type.select },
        Module: { select: page.properties.Module.select },
        Platform: { select: page.properties.Platform.select },
        Status: { select: page.properties.Status.select },
        Confidence: { number: page.properties.Confidence.number },
        Function: { rich_text: page.properties.Function.rich_text },
        'Source Path': { url: page.properties['Source Path'].url }
      }
    };
  }

  private mapAgentType(agent: AgentRecord): string {
    // Map agent to type based on naming convention or metadata
    if (agent.agent_id.includes('persona') || agent.agent_id.includes('assistant')) {
      return 'Persona';
    } else if (agent.agent_id.includes('role') || agent.agent_id.includes('manager')) {
      return 'Role';
    } else if (agent.agent_id.includes('system') || agent.agent_id.includes('service')) {
      return 'System';
    }
    return 'Technical';
  }

  private mapStatus(status: string): string {
    const statusMap: Record<string, string> = {
      'Draft': 'Testing',
      'Testing': 'Testing',
      'Active': 'Active',
      'Deprecated': 'Archived',
      'Archived': 'Archived'
    };
    return statusMap[status] || 'Testing';
  }

  private getModuleEmoji(module: string): string {
    const emojis: Record<string, string> = {
      'Core': '🧙',
      'BMM': '📊',
      'CIS': '🧠',
      'GDS': '🎮',
      'WDS': '🎨',
      'External': '🌐'
    };
    return emojis[module] || '🤖';
  }

  private getSourcePath(agent: AgentRecord): string {
    // Generate source path based on module and agent_id
    const basePath = 'https://github.com/ronin704/sabir-ai-os/blob/main/_bmad';
    return `${basePath}/${agent.module.toLowerCase()}/agents/${agent.agent_id}.md`;
  }
}

// Singleton instance
let clientInstance: AgentNotionClient | null = null;

export function getAgentNotionClient(): AgentNotionClient {
  if (!clientInstance) {
    clientInstance = new AgentNotionClient();
  }
  return clientInstance;
}