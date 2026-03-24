/**
 * Agent Lineage and Versioning
 * Epic 6, Story 6.7: Support Agent Lineage and Versioning
 */

import { AgentPostgresClient, getAgentClient, AgentRecord } from './postgres-client';
import { AgentNeo4jClient, getAgentNeo4jClient, AgentNode } from './neo4j-client';

export interface VersionRecord {
  agent_id: string;
  version: string;
  status: string;
  confidence_score: number;
  created_at: Date;
  notes: string;
}

export interface LineageNode {
  current: AgentNode;
  superseded: AgentNode | null;
  predecessors: AgentNode[];
  successors: AgentNode[];
}

export class AgentLineage {
  private pgClient: AgentPostgresClient;
  private neo4jClient: AgentNeo4jClient;

  constructor(pgClient?: AgentPostgresClient, neo4jClient?: AgentNeo4jClient) {
    this.pgClient = pgClient || getAgentClient();
    this.neo4jClient = neo4jClient || getAgentNeo4jClient();
  }

  async createVersion(
    oldAgentId: string,
    newAgentId: string,
    version: string,
    notes?: string
  ): Promise<void> {
    // 1. Get old agent
    const oldAgent = await this.pgClient.getAgent(oldAgentId);
    if (!oldAgent) {
      throw new Error(`Old agent ${oldAgentId} not found`);
    }

    // 2. Get new agent
    const newAgent = await this.pgClient.getAgent(newAgentId);
    if (!newAgent) {
      throw new Error(`New agent ${newAgentId} not found`);
    }

    // 3. Update new agent version
    await this.pgClient.updateAgent(newAgentId, { version });

    // 4. Create SUPERSEDES relationship in Neo4j
    // Ensure old agent exists in Neo4j
    let oldNode = await this.neo4jClient.getAgent(oldAgentId);
    if (!oldNode) {
      oldNode = await this.neo4jClient.createAgent(oldAgent);
    }
    
    // Ensure new agent exists in Neo4j
    let newNode = await this.neo4jClient.getAgent(newAgentId);
    if (!newNode) {
      newNode = await this.neo4jClient.createAgent(newAgent);
    }
    
    await this.neo4jClient.createLineage(oldAgentId, newAgentId);

    // 5. Update both agents in Neo4j
    await this.neo4jClient.updateAgent(oldAgentId, { status: 'Deprecated' });
    await this.neo4jClient.updateAgent(newAgentId, { status: oldAgent.status });

    // 6. Update old agent status in PostgreSQL
    await this.pgClient.updateAgent(oldAgentId, { status: 'Deprecated' });

    // 7. Log version change
    await this.logVersionChange(newAgentId, version, `Supersedes ${oldAgentId}`, notes);
  }

  async getLineage(agentId: string): Promise<LineageNode> {
    const current = await this.neo4jClient.getAgent(agentId);
    
    if (!current) {
      throw new Error(`Agent ${agentId} not found in Neo4j`);
    }

    // Get predecessors (agents this one supersedes)
    const predecessors = await this.neo4jClient.getAgentLineage(agentId);

    // Get successors (agents that supersede this one)
    const successors = await this.getSuccessors(agentId);

    // Get directly superseded agent
    const superseded = predecessors.length > 0 ? predecessors[0] : null;

    return {
      current,
      superseded,
      predecessors,
      successors
    };
  }

  async getLatestVersion(baseAgentId: string): Promise<AgentNode> {
    // Follow SUPERSEDES chain forward to find latest version
    const successors = await this.getSuccessors(baseAgentId);
    
    if (successors.length === 0) {
      // This is the latest
      const current = await this.neo4jClient.getAgent(baseAgentId);
      if (!current) {
        throw new Error(`Agent ${baseAgentId} not found`);
      }
      return current;
    }

    // Recursively find the latest
    const latestSuccessor = successors[successors.length - 1];
    return this.getLatestVersion(latestSuccessor.agent_id);
  }

  async getVersionHistory(agentId: string): Promise<VersionRecord[]> {
    const result = await (this.pgClient as any).pool.query(
      `SELECT * FROM agent_versions 
       WHERE agent_id = $1 
       ORDER BY created_at DESC`,
      [agentId]
    );

    return result.rows.map((row: Record<string, unknown>) => ({
      agent_id: row.agent_id,
      version: row.version,
      status: row.status,
      confidence_score: parseFloat(row.confidence_score as string),
      created_at: row.created_at,
      notes: row.notes || ''
    }));
  }

  async rollback(agentId: string, targetVersion: string): Promise<AgentRecord> {
    // 1. Get current agent
    const currentAgent = await this.pgClient.getAgent(agentId);
    if (!currentAgent) {
      throw new Error(`Agent ${agentId} not found`);
    }

    // 2. Find version history
    const history = await this.getVersionHistory(agentId);
    const targetRecord = history.find(h => h.version === targetVersion);

    if (!targetRecord) {
      throw new Error(`Version ${targetVersion} not found for agent ${agentId}`);
    }

    // 3. Create new version with rolled-back state
    const rollbackVersion = this.incrementVersion(currentAgent.version, 'patch');
    const rollbackId = `${agentId}-rollback-${Date.now()}`;

    // 4. Create new agent record
    const rolledBackAgent = await this.pgClient.createAgent({
      agent_id: rollbackId,
      name: `${currentAgent.name} (rolled back to ${targetVersion})`,
      description: currentAgent.description,
      persona: currentAgent.persona,
      module: currentAgent.module,
      platform: currentAgent.platform,
      version: rollbackVersion,
      status: 'Testing', // Rollback goes to Testing for validation
      confidence_score: targetRecord.confidence_score,
      source_files: currentAgent.source_files,
      capabilities: currentAgent.capabilities
    });

    // 5. Create lineage relationship
    await this.neo4jClient.createAgent(rolledBackAgent);
    await this.neo4jClient.createLineage(agentId, rollbackId);

    // 6. Log rollback
    await this.logVersionChange(rollbackId, rollbackVersion, 
      `Rollback from ${currentAgent.version} to ${targetVersion}`,
      'Rolled back via rollback operation');

    return rolledBackAgent;
  }

  async compareVersions(agentId: string, version1: string, version2: string): Promise<{
    version1: VersionRecord;
    version2: VersionRecord;
    differences: string[];
  }> {
    const history = await this.getVersionHistory(agentId);
    
    const v1 = history.find(h => h.version === version1);
    const v2 = history.find(h => h.version === version2);

    if (!v1 || !v2) {
      throw new Error(`One or both versions not found: ${version1}, ${version2}`);
    }

    const differences: string[] = [];
    
    if (v1.status !== v2.status) {
      differences.push(`Status: ${v1.status} → ${v2.status}`);
    }
    if (v1.confidence_score !== v2.confidence_score) {
      differences.push(`Confidence: ${v1.confidence_score} → ${v2.confidence_score}`);
    }

    return { version1: v1, version2: v2, differences };
  }

  private async getSuccessors(agentId: string): Promise<AgentNode[]> {
    // Query Neo4j for agents that have SUPERSEDES relationship TO this agent
    const session = (this.neo4jClient as any).driver.session();
    
    try {
      const result = await session.run(
        `MATCH (new:AIAgent)-[:SUPERSEDES]->(old:AIAgent {agent_id: $agent_id})
         RETURN new
         ORDER BY new.created_at DESC`,
        { agent_id: agentId }
      );

      return result.records.map((record: { get: (key: string) => { properties: Record<string, unknown> } }) => {
        const node = record.get('new');
        return {
          agent_id: node.properties.agent_id,
          name: node.properties.name,
          description: node.properties.description || '',
          persona: node.properties.persona || '',
          module: node.properties.module,
          platform: node.properties.platform,
          version: node.properties.version,
          status: node.properties.status,
          confidence_score: typeof node.properties.confidence_score === 'object'
            ? (node.properties.confidence_score as { toNumber: () => number }).toNumber()
            : parseFloat(node.properties.confidence_score as string),
          created_at: new Date(node.properties.created_at as string),
          updated_at: new Date(node.properties.updated_at as string)
        };
      });
    } finally {
      await session.close();
    }
  }

  private incrementVersion(version: string, type: 'major' | 'minor' | 'patch'): string {
    const [major, minor, patch] = version.split('.').map(Number);

    switch (type) {
      case 'major':
        return `${major + 1}.0.0`;
      case 'minor':
        return `${major}.${minor + 1}.0`;
      case 'patch':
        return `${major}.${minor}.${patch + 1}`;
    }
  }

  private async logVersionChange(
    agentId: string,
    version: string,
    reason: string,
    notes?: string
  ): Promise<void> {
    await (this.pgClient as any).pool.query(
      `INSERT INTO agent_versions (agent_id, version, status, confidence_score, notes)
       SELECT agent_id, $2, status, confidence_score, $3
       FROM agents WHERE agent_id = $1`,
      [agentId, version, notes || reason]
    );
  }
}

// Singleton instance
let lineageInstance: AgentLineage | null = null;

export function getAgentLineage(): AgentLineage {
  if (!lineageInstance) {
    lineageInstance = new AgentLineage();
  }
  return lineageInstance;
}