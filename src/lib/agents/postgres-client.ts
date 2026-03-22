/**
 * Agent PostgreSQL Client
 * Epic 6, Story 6.2: Persist Agent Definitions to PostgreSQL
 */

import { Pool, QueryResult } from 'pg';
import { getPool } from '../postgres/connection';

export type AgentStatus = 'Draft' | 'Testing' | 'Active' | 'Deprecated' | 'Archived';

export interface AgentRecord {
  id: string;
  agent_id: string;
  name: string;
  description: string;
  persona: string;
  module: string;
  platform: string;
  version: string;
  status: AgentStatus;
  confidence_score: number;
  source_files: string[];
  capabilities: string[];
  created_by: string;
  created_at: Date;
  updated_at: Date;
  group_id: string;
}

export interface AgentFilters {
  module?: string;
  platform?: string;
  status?: AgentStatus;
  min_confidence?: number;
  search?: string;
  limit?: number;
  offset?: number;
}

export interface AgentUsageRecord {
  agent_id: string;
  success: boolean;
  duration_ms?: number;
  error_message?: string;
  feedback_score?: number;
}

export class AgentPostgresClient {
  private pool: Pool;

  constructor(pool?: Pool) {
    this.pool = pool || getPool();
  }

  async createAgent(input: Partial<AgentRecord>): Promise<AgentRecord> {
    const result = await this.pool.query<AgentRecord>(
      `INSERT INTO agents (
        agent_id, name, description, persona, module, platform, version,
        status, confidence_score, source_files, capabilities, created_by, group_id
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
      RETURNING *`,
      [
        input.agent_id,
        input.name || input.agent_id,
        input.description || '',
        input.persona || '',
        input.module,
        input.platform,
        input.version || '1.0.0',
        input.status || 'Draft',
        input.confidence_score || 0.0,
        JSON.stringify(input.source_files || []),
        JSON.stringify(input.capabilities || []),
        input.created_by || 'system',
        input.group_id || 'default'
      ]
    );
    return this.rowToAgent(result.rows[0]);
  }

  async getAgent(agentId: string): Promise<AgentRecord | null> {
    const result = await this.pool.query<AgentRecord>(
      'SELECT * FROM agents WHERE agent_id = $1',
      [agentId]
    );
    return result.rows[0] ? this.rowToAgent(result.rows[0]) : null;
  }

  async updateAgent(agentId: string, updates: Partial<AgentRecord>): Promise<AgentRecord> {
    const fields: string[] = [];
    const values: any[] = [];
    let paramIndex = 1;

    const allowedFields = ['name', 'description', 'persona', 'version', 'status', 
                          'confidence_score', 'source_files', 'capabilities'];
    
    for (const [key, value] of Object.entries(updates)) {
      if (allowedFields.includes(key)) {
        fields.push(`${key} = $${paramIndex}`);
        if (key === 'source_files' || key === 'capabilities') {
          values.push(JSON.stringify(value));
        } else {
          values.push(value);
        }
        paramIndex++;
      }
    }

    if (fields.length === 0) {
      throw new Error('No valid fields to update');
    }

    values.push(agentId);
    const result = await this.pool.query<AgentRecord>(
      `UPDATE agents SET ${fields.join(', ')} WHERE agent_id = $${paramIndex} RETURNING *`,
      values
    );

    if (result.rows.length === 0) {
      throw new Error(`Agent ${agentId} not found`);
    }

    return this.rowToAgent(result.rows[0]);
  }

  async listAgents(filters?: AgentFilters): Promise<AgentRecord[]> {
    const conditions: string[] = ['1=1'];
    const values: any[] = [];
    let paramIndex = 1;

    if (filters?.module) {
      conditions.push(`module = $${paramIndex}`);
      values.push(filters.module);
      paramIndex++;
    }

    if (filters?.platform) {
      conditions.push(`platform = $${paramIndex}`);
      values.push(filters.platform);
      paramIndex++;
    }

    if (filters?.status) {
      conditions.push(`status = $${paramIndex}`);
      values.push(filters.status);
      paramIndex++;
    }

    if (filters?.min_confidence !== undefined) {
      conditions.push(`confidence_score >= $${paramIndex}`);
      values.push(filters.min_confidence);
      paramIndex++;
    }

    if (filters?.search) {
      conditions.push(`(name ILIKE $${paramIndex} OR description ILIKE $${paramIndex})`);
      values.push(`%${filters.search}%`);
      paramIndex++;
    }

    const limit = filters?.limit || 100;
    const offset = filters?.offset || 0;

    const result = await this.pool.query<AgentRecord>(
      `SELECT * FROM agents WHERE ${conditions.join(' AND ')}
       ORDER BY confidence_score DESC, created_at DESC
       LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`,
      [...values, limit, offset]
    );

    return result.rows.map(row => this.rowToAgent(row));
  }

  async deleteAgent(agentId: string): Promise<void> {
    await this.pool.query('DELETE FROM agents WHERE agent_id = $1', [agentId]);
  }

  async recordUsage(usage: AgentUsageRecord): Promise<void> {
    await this.pool.query(
      `INSERT INTO agent_usage (agent_id, success, duration_ms, error_message, feedback_score)
       VALUES ($1, $2, $3, $4, $5)`,
      [usage.agent_id, usage.success, usage.duration_ms || null, 
       usage.error_message || null, usage.feedback_score || null]
    );
  }

  async getUsageStats(agentId: string): Promise<{
    total_executions: number;
    successful_executions: number;
    avg_duration_ms: number;
    avg_feedback: number;
  }> {
    const result = await this.pool.query(
      `SELECT 
         COUNT(*) as total_executions,
         COUNT(*) FILTER (WHERE success = true) as successful_executions,
         AVG(duration_ms) as avg_duration_ms,
         AVG(feedback_score) as avg_feedback
       FROM agent_usage WHERE agent_id = $1`,
      [agentId]
    );

    const row = result.rows[0];
    return {
      total_executions: parseInt(row.total_executions) || 0,
      successful_executions: parseInt(row.successful_executions) || 0,
      avg_duration_ms: parseFloat(row.avg_duration_ms) || 0,
      avg_feedback: parseFloat(row.avg_feedback) || 0
    };
  }

  async updateConfidence(agentId: string): Promise<number> {
    // Calculate confidence based on usage
    const stats = await this.getUsageStats(agentId);
    
    // Confidence formula: success_rate * 0.5 + usage_frequency_factor * 0.3 + feedback * 0.2
    const successRate = stats.total_executions > 0 
      ? stats.successful_executions / stats.total_executions 
      : 0;
    
    const usageFactor = Math.min(stats.total_executions / 100, 1); // Max at 100 executions
    const feedbackFactor = (stats.avg_feedback + 1) / 2; // Normalize -1..1 to 0..1
    
    const confidence = (successRate * 0.5) + (usageFactor * 0.3) + (feedbackFactor * 0.2);
    
    await this.updateAgent(agentId, { confidence_score: Math.round(confidence * 100) / 100 });
    
    return confidence;
  }

  private rowToAgent(row: any): AgentRecord {
    return {
      id: row.id,
      agent_id: row.agent_id,
      name: row.name,
      description: row.description || '',
      persona: row.persona || '',
      module: row.module,
      platform: row.platform,
      version: row.version,
      status: row.status,
      confidence_score: parseFloat(row.confidence_score),
      source_files: typeof row.source_files === 'string' 
        ? JSON.parse(row.source_files) 
        : row.source_files,
      capabilities: typeof row.capabilities === 'string'
        ? JSON.parse(row.capabilities)
        : row.capabilities,
      created_by: row.created_by,
      created_at: row.created_at,
      updated_at: row.updated_at,
      group_id: row.group_id
    };
  }
}

// Singleton instance
let clientInstance: AgentPostgresClient | null = null;

export function getAgentClient(): AgentPostgresClient {
  if (!clientInstance) {
    clientInstance = new AgentPostgresClient();
  }
  return clientInstance;
}