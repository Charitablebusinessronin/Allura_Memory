/**
 * Agent Promotion Pipeline
 * Epic 6, Story 6.3: Promote Agent Metadata to Neo4j
 */

import { AgentPostgresClient, getAgentClient } from './postgres-client';
import { AgentNeo4jClient, getAgentNeo4jClient } from './neo4j-client';
import { AgentRecord } from './postgres-client';

export interface PromotionResult {
  agent_id: string;
  status: 'created' | 'updated' | 'skipped';
  neo4j_id: string;
  capabilities_linked: number;
  module_linked: boolean;
  platform_linked: boolean;
}

export class AgentPromotionPipeline {
  private pgClient: AgentPostgresClient;
  private neo4jClient: AgentNeo4jClient;

  constructor(pgClient?: AgentPostgresClient, neo4jClient?: AgentNeo4jClient) {
    this.pgClient = pgClient || getAgentClient();
    this.neo4jClient = neo4jClient || getAgentNeo4jClient();
  }

  async promoteAgent(agentId: string): Promise<PromotionResult> {
    // 1. Get agent from PostgreSQL
    const pgAgent = await this.pgClient.getAgent(agentId);
    
    if (!pgAgent) {
      throw new Error(`Agent ${agentId} not found in PostgreSQL`);
    }

    // 2. Check if agent exists in Neo4j
    const existingAgent = await this.neo4jClient.getAgent(agentId);

    let status: 'created' | 'updated' | 'skipped';
    let neo4jNode;

    // 3. Create or update agent node
    if (existingAgent) {
      neo4jNode = await this.neo4jClient.updateAgent(agentId, {
        name: pgAgent.name,
        description: pgAgent.description,
        persona: pgAgent.persona,
        version: pgAgent.version,
        status: pgAgent.status,
        confidence_score: pgAgent.confidence_score
      });
      status = 'updated';
    } else {
      neo4jNode = await this.neo4jClient.createAgent(pgAgent);
      status = 'created';
    }

    // 4. Link to module
    await this.neo4jClient.linkToModule(agentId, pgAgent.module);

    // 5. Link to platform
    await this.neo4jClient.linkToPlatform(agentId, pgAgent.platform);

    // 6. Link capabilities
    let capabilitiesLinked = 0;
    for (const capability of pgAgent.capabilities) {
      await this.neo4jClient.linkToCapability(agentId, capability);
      capabilitiesLinked++;
    }

    return {
      agent_id: agentId,
      status,
      neo4j_id: neo4jNode.agent_id,
      capabilities_linked: capabilitiesLinked,
      module_linked: true,
      platform_linked: true
    };
  }

  async promoteAllAgents(): Promise<PromotionResult[]> {
    const agents = await this.pgClient.listAgents({ status: 'Active' });
    const results: PromotionResult[] = [];

    for (const agent of agents) {
      try {
        const result = await this.promoteAgent(agent.agent_id);
        results.push(result);
      } catch (error) {
        console.error(`Failed to promote agent ${agent.agent_id}:`, error);
      }
    }

    return results;
  }

  async createLineage(oldAgentId: string, newAgentId: string): Promise<void> {
    // Verify both agents exist
    const oldAgent = await this.pgClient.getAgent(oldAgentId);
    const newAgent = await this.pgClient.getAgent(newAgentId);

    if (!oldAgent) {
      throw new Error(`Old agent ${oldAgentId} not found`);
    }
    if (!newAgent) {
      throw new Error(`New agent ${newAgentId} not found`);
    }

    // Promote both agents to Neo4j if not already
    await this.promoteAgent(oldAgentId);
    await this.promoteAgent(newAgentId);

    // Create lineage relationship
    await this.neo4jClient.createLineage(oldAgentId, newAgentId);

    // Update old agent status to Deprecated in PostgreSQL
    await this.pgClient.updateAgent(oldAgentId, { status: 'Deprecated' });
  }

  async syncAgentToNeo4j(agentId: string): Promise<PromotionResult> {
    return this.promoteAgent(agentId);
  }
}

// Singleton instance
let pipelineInstance: AgentPromotionPipeline | null = null;

export function getPromotionPipeline(): AgentPromotionPipeline {
  if (!pipelineInstance) {
    pipelineInstance = new AgentPromotionPipeline();
  }
  return pipelineInstance;
}