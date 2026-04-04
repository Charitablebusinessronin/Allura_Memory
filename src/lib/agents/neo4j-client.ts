/**
 * Agent Neo4j Client
 * Epic 6, Story 6.3: Promote Agent Metadata to Neo4j
 */

import neo4j, { Driver, Session } from 'neo4j-driver';
import { AgentRecord } from './postgres-client';

export interface AgentNode {
  agent_id: string;
  name: string;
  description: string;
  persona: string;
  module: string;
  platform: string;
  version: string;
  status: string;
  confidence_score: number;
  created_at: Date;
  updated_at: Date;
}

export interface AgentSearchQuery {
  search?: string;
  module?: string;
  platform?: string;
  capability?: string;
  status?: string;
  min_confidence?: number;
  limit?: number;
}

let driver: Driver | null = null;

function getDriver(): Driver {
  if (!driver) {
    const uri = process.env.NEO4J_URI || 'bolt://localhost:7687';
    const user = process.env.NEO4J_USER || 'neo4j';
    const password = process.env.NEO4J_PASSWORD;
    if (!password) {
      throw new Error("NEO4J_PASSWORD environment variable is required");
    }
    
    driver = neo4j.driver(uri, neo4j.auth.basic(user, password));
  }
  return driver;
}

export class AgentNeo4jClient {
  private driver: Driver;

  constructor(driver?: Driver) {
    this.driver = driver || getDriver();
  }

  async createAgent(agent: AgentRecord): Promise<AgentNode> {
    const session = this.driver.session();
    
    try {
      const result = await session.run(
        `MERGE (a:AIAgent {agent_id: $agent_id})
         SET a.name = $name,
             a.description = $description,
             a.persona = $persona,
             a.module = $module,
             a.platform = $platform,
             a.version = $version,
             a.status = $status,
             a.confidence_score = $confidence_score,
             a.created_at = datetime($created_at),
             a.updated_at = datetime($updated_at)
         RETURN a`,
        {
          agent_id: agent.agent_id,
          name: agent.name,
          description: agent.description || '',
          persona: agent.persona || '',
          module: agent.module,
          platform: agent.platform,
          version: agent.version,
          status: agent.status,
          confidence_score: agent.confidence_score,
          created_at: agent.created_at.toISOString(),
          updated_at: agent.updated_at.toISOString()
        }
      );

      return this.nodeToAgent(result.records[0].get('a'));
    } finally {
      await session.close();
    }
  }

  async getAgent(agentId: string): Promise<AgentNode | null> {
    const session = this.driver.session();
    
    try {
      const result = await session.run(
        `MATCH (a:AIAgent {agent_id: $agent_id}) RETURN a`,
        { agent_id: agentId }
      );

      if (result.records.length === 0) {
        return null;
      }

      return this.nodeToAgent(result.records[0].get('a'));
    } finally {
      await session.close();
    }
  }

  async updateAgent(agentId: string, updates: Partial<AgentRecord>): Promise<AgentNode> {
    const session = this.driver.session();
    
    try {
      const setClauses: string[] = [];
      const params: Record<string, any> = { agent_id: agentId };

      const allowedFields = ['name', 'description', 'persona', 'version', 'status', 'confidence_score'];
      
      for (const [key, value] of Object.entries(updates)) {
        if (allowedFields.includes(key)) {
          setClauses.push(`a.${key} = $${key}`);
          params[key] = value;
        }
      }

      if (setClauses.length === 0) {
        throw new Error('No valid fields to update');
      }

      setClauses.push('a.updated_at = datetime($updated_at)');
      params.updated_at = new Date().toISOString();

      const result = await session.run(
        `MATCH (a:AIAgent {agent_id: $agent_id})
         SET ${setClauses.join(', ')}
         RETURN a`,
        params
      );

      if (result.records.length === 0) {
        throw new Error(`Agent ${agentId} not found`);
      }

      return this.nodeToAgent(result.records[0].get('a'));
    } finally {
      await session.close();
    }
  }

  async deleteAgent(agentId: string): Promise<void> {
    const session = this.driver.session();
    
    try {
      await session.run(
        `MATCH (a:AIAgent {agent_id: $agent_id})
         DETACH DELETE a`,
        { agent_id: agentId }
      );
    } finally {
      await session.close();
    }
  }

  async linkToModule(agentId: string, module: string): Promise<void> {
    const session = this.driver.session();
    
    try {
      await session.run(
        `MATCH (a:AIAgent {agent_id: $agent_id})
         MERGE (m:Module {name: $module})
         MERGE (a)-[:BELONGS_TO]->(m)`,
        { agent_id: agentId, module: module }
      );
    } finally {
      await session.close();
    }
  }

  async linkToPlatform(agentId: string, platform: string): Promise<void> {
    const session = this.driver.session();
    
    try {
      await session.run(
        `MATCH (a:AIAgent {agent_id: $agent_id})
         MERGE (p:Platform {name: $platform})
         MERGE (a)-[:SUPPORTS]->(p)`,
        { agent_id: agentId, platform: platform }
      );
    } finally {
      await session.close();
    }
  }

  async linkToCapability(agentId: string, capability: string): Promise<void> {
    const session = this.driver.session();
    
    try {
      await session.run(
        `MATCH (a:AIAgent {agent_id: $agent_id})
         MERGE (c:Capability {name: $capability})
         MERGE (a)-[:HAS_CAPABILITY]->(c)`,
        { agent_id: agentId, capability: capability }
      );
    } finally {
      await session.close();
    }
  }

  async createLineage(oldAgentId: string, newAgentId: string): Promise<void> {
    const session = this.driver.session();
    
    try {
      await session.run(
        `MATCH (old:AIAgent {agent_id: $old_agent_id})
         MATCH (new:AIAgent {agent_id: $new_agent_id})
         MERGE (new)-[:SUPERSEDES]->(old)`,
        { old_agent_id: oldAgentId, new_agent_id: newAgentId }
      );
    } finally {
      await session.close();
    }
  }

  async searchAgents(query: AgentSearchQuery): Promise<AgentNode[]> {
    const session = this.driver.session();
    
    try {
      const conditions: string[] = ['1=1'];
      const params: Record<string, any> = {};

      if (query.module) {
        conditions.push('a.module = $module');
        params.module = query.module;
      }

      if (query.platform) {
        conditions.push('a.platform = $platform');
        params.platform = query.platform;
      }

      if (query.status) {
        conditions.push('a.status = $status');
        params.status = query.status;
      }

      if (query.min_confidence !== undefined) {
        conditions.push('a.confidence_score >= $min_confidence');
        params.min_confidence = query.min_confidence;
      }

      if (query.search) {
        conditions.push('(a.name CONTAINS $search OR a.description CONTAINS $search)');
        params.search = query.search;
      }

      if (query.capability) {
        conditions.push('EXISTS { MATCH (a)-[:HAS_CAPABILITY]->(c:Capability {name: $capability}) }');
        params.capability = query.capability;
      }

      const limit = query.limit || 100;

      const result = await session.run(
        `MATCH (a:AIAgent)
         WHERE ${conditions.join(' AND ')}
         RETURN a
         ORDER BY a.confidence_score DESC, a.created_at DESC
         LIMIT $limit`,
        { ...params, limit: neo4j.int(limit) }
      );

      return result.records.map(record => this.nodeToAgent(record.get('a')));
    } finally {
      await session.close();
    }
  }

  async getAgentCapabilities(agentId: string): Promise<string[]> {
    const session = this.driver.session();
    
    try {
      const result = await session.run(
        `MATCH (a:AIAgent {agent_id: $agent_id})-[:HAS_CAPABILITY]->(c:Capability)
         RETURN c.name as capability`,
        { agent_id: agentId }
      );

      return result.records.map(record => record.get('capability'));
    } finally {
      await session.close();
    }
  }

  async getAgentsByModule(module: string): Promise<AgentNode[]> {
    return this.searchAgents({ module });
  }

  async getAgentsByPlatform(platform: string): Promise<AgentNode[]> {
    return this.searchAgents({ platform });
  }

  async getAgentLineage(agentId: string): Promise<AgentNode[]> {
    const session = this.driver.session();
    
    try {
      const result = await session.run(
        `MATCH (a:AIAgent {agent_id: $agent_id})-[:SUPERSEDES*]->(old:AIAgent)
         RETURN old
         ORDER BY old.version DESC`,
        { agent_id: agentId }
      );

      return result.records.map(record => this.nodeToAgent(record.get('old')));
    } finally {
      await session.close();
    }
  }

  private nodeToAgent(node: any): AgentNode {
    const props = node.properties;
    return {
      agent_id: props.agent_id,
      name: props.name,
      description: props.description || '',
      persona: props.persona || '',
      module: props.module,
      platform: props.platform,
      version: props.version,
      status: props.status,
      confidence_score: typeof props.confidence_score === 'object' 
        ? props.confidence_score.toNumber() 
        : parseFloat(props.confidence_score),
      created_at: new Date(props.created_at),
      updated_at: new Date(props.updated_at)
    };
  }
}

// Singleton instance
let clientInstance: AgentNeo4jClient | null = null;

export function getAgentNeo4jClient(): AgentNeo4jClient {
  if (!clientInstance) {
    clientInstance = new AgentNeo4jClient();
  }
  return clientInstance;
}