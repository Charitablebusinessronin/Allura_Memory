/**
 * Agent Discovery Search
 * Epic 6, Story 6.8: Implement Agent Discovery Search
 */

import { AgentPostgresClient, getAgentClient, AgentRecord } from './postgres-client';
import { AgentNeo4jClient, getAgentNeo4jClient, AgentNode } from './neo4j-client';

export interface SearchFilters {
  module?: string;
  platform?: string;
  status?: string;
  capability?: string;
  min_confidence?: number;
  limit?: number;
}

export interface SearchResult {
  agent: AgentRecord;
  score: number;
  matched_fields: string[];
  similarity: number;
}

export interface RecommendationContext {
  task: string;
  module?: string;
  platform?: string;
  capabilities?: string[];
}

export class AgentDiscovery {
  private pgClient: AgentPostgresClient;
  private neo4jClient: AgentNeo4jClient;

  constructor(pgClient?: AgentPostgresClient, neo4jClient?: AgentNeo4jClient) {
    this.pgClient = pgClient || getAgentClient();
    this.neo4jClient = neo4jClient || getAgentNeo4jClient();
  }

  async search(query: string, filters?: SearchFilters): Promise<SearchResult[]> {
    // Get candidates from PostgreSQL
    const candidates = await this.pgClient.listAgents({
      module: filters?.module,
      platform: filters?.platform,
      status: (filters?.status || 'Active') as 'Draft' | 'Testing' | 'Active' | 'Deprecated' | 'Archived',
      min_confidence: filters?.min_confidence,
      limit: filters?.limit || 100
    });

    // If query is empty, just return sorted by confidence
    if (!query || query.trim() === '') {
      return candidates.map(agent => ({
        agent,
        score: agent.confidence_score,
        matched_fields: [],
        similarity: 1
      }));
    }

    // Calculate similarity for each candidate
    const results: SearchResult[] = [];
    const queryLower = query.toLowerCase();
    const queryTerms = queryLower.split(/\s+/);

    for (const agent of candidates) {
      const { similarity, matchedFields } = this.calculateSimilarity(agent, queryTerms);
      
      // Calculate combined score
      const score = (similarity * 0.4) + (agent.confidence_score * 0.4) + (this.usageFactor(agent) * 0.2);

      results.push({
        agent,
        score,
        matched_fields: matchedFields,
        similarity
      });
    }

    // Sort by score descending
    results.sort((a, b) => b.score - a.score);

    // Apply limit
    return results.slice(0, filters?.limit || 10);
  }

  async findByCapability(capability: string, filters?: SearchFilters): Promise<AgentRecord[]> {
    // Search in Neo4j for agents with this capability
    const agents = await this.neo4jClient.searchAgents({
      capability,
      ...filters
    });

    // Get full records from PostgreSQL
    const records: AgentRecord[] = [];
    for (const node of agents) {
      const record = await this.pgClient.getAgent(node.agent_id);
      if (record) {
        records.push(record);
      }
    }

    return records;
  }

  async findByModule(module: string): Promise<AgentRecord[]> {
    return this.pgClient.listAgents({ module, status: 'Active' });
  }

  async findByPlatform(platform: string): Promise<AgentRecord[]> {
    return this.pgClient.listAgents({ platform, status: 'Active' });
  }

  async getRecommendations(context: RecommendationContext): Promise<SearchResult[]> {
    // Build query from context
    const queryParts: string[] = [];
    
    if (context.task) {
      queryParts.push(context.task);
    }
    
    if (context.capabilities) {
      queryParts.push(...context.capabilities);
    }

    const query = queryParts.join(' ');

    // Search with filters
    const results = await this.search(query, {
      module: context.module,
      platform: context.platform,
      min_confidence: 0.5,
      limit: 5
    });

    return results;
  }

  async getSimilarAgents(agentId: string, limit: number = 5): Promise<SearchResult[]> {
    // Get the agent
    const agent = await this.pgClient.getAgent(agentId);
    
    if (!agent) {
      return [];
    }

    // Build query from agent properties
    const query = [agent.name, agent.description, ...agent.capabilities].join(' ');

    // Search for similar agents
    const results = await this.search(query, {
      module: agent.module,
      platform: agent.platform,
      limit: limit + 1 // +1 to exclude self
    });

    // Exclude the agent itself
    return results.filter(r => r.agent.agent_id !== agentId).slice(0, limit);
  }

  async getAgentStats(): Promise<{
    total: number;
    by_module: Record<string, number>;
    by_platform: Record<string, number>;
    by_status: Record<string, number>;
    avg_confidence: number;
  }> {
    const agents = await this.pgClient.listAgents({});

    const stats = {
      total: agents.length,
      by_module: {} as Record<string, number>,
      by_platform: {} as Record<string, number>,
      by_status: {} as Record<string, number>,
      avg_confidence: 0
    };

    let totalConfidence = 0;

    for (const agent of agents) {
      // Count by module
      stats.by_module[agent.module] = (stats.by_module[agent.module] || 0) + 1;

      // Count by platform
      stats.by_platform[agent.platform] = (stats.by_platform[agent.platform] || 0) + 1;

      // Count by status
      stats.by_status[agent.status] = (stats.by_status[agent.status] || 0) + 1;

      // Sum confidence
      totalConfidence += agent.confidence_score;
    }

    stats.avg_confidence = agents.length > 0 ? totalConfidence / agents.length : 0;

    return stats;
  }

  private calculateSimilarity(agent: AgentRecord, queryTerms: string[]): {
    similarity: number;
    matchedFields: string[];
  } {
    let matchedTerms = 0;
    const matchedFields: string[] = [];

    // Check name
    const nameLower = agent.name.toLowerCase();
    for (const term of queryTerms) {
      if (nameLower.includes(term)) {
        matchedTerms++;
        if (!matchedFields.includes('name')) {
          matchedFields.push('name');
        }
      }
    }

    // Check description
    const descLower = agent.description?.toLowerCase() || '';
    for (const term of queryTerms) {
      if (descLower.includes(term)) {
        matchedTerms++;
        if (!matchedFields.includes('description')) {
          matchedFields.push('description');
        }
      }
    }

    // Check capabilities
    for (const cap of agent.capabilities || []) {
      const capLower = cap.toLowerCase();
      for (const term of queryTerms) {
        if (capLower.includes(term)) {
          matchedTerms++;
          if (!matchedFields.includes('capabilities')) {
            matchedFields.push('capabilities');
          }
        }
      }
    }

    // Calculate similarity as fraction of query terms matched
    const similarity = queryTerms.length > 0 ? matchedTerms / queryTerms.length : 0;

    return { similarity, matchedFields };
  }

  private usageFactor(agent: AgentRecord): number {
    // This would ideally use actual usage data
    // For now, use confidence as a proxy
    return agent.confidence_score > 0.7 ? 1.0 : agent.confidence_score > 0.5 ? 0.5 : 0.2;
  }
}

// Singleton instance
let discoveryInstance: AgentDiscovery | null = null;

export function getAgentDiscovery(): AgentDiscovery {
  if (!discoveryInstance) {
    discoveryInstance = new AgentDiscovery();
  }
  return discoveryInstance;
}