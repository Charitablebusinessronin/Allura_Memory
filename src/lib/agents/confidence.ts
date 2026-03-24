/**
 * Agent Confidence Tracking
 * Epic 6, Story 6.6: Track Agent Confidence and Usage
 */

import { AgentPostgresClient, getAgentClient, AgentRecord } from './postgres-client';

export interface ConfidenceRecord {
  agent_id: string;
  confidence_score: number;
  success_rate: number;
  usage_factor: number;
  feedback_factor: number;
  total_executions: number;
  successful_executions: number;
  avg_feedback: number;
  calculated_at: Date;
}

export interface ExecutionLog {
  agent_id: string;
  success: boolean;
  duration_ms?: number;
  error_message?: string;
  feedback_score?: number; // -1 (thumbs down) to 1 (thumbs up)
  created_at: Date;
}

export class AgentConfidence {
  private pgClient: AgentPostgresClient;

  constructor(pgClient?: AgentPostgresClient) {
    this.pgClient = pgClient || getAgentClient();
  }

  async recordExecution(
    agentId: string,
    success: boolean,
    options?: {
      durationMs?: number;
      errorMessage?: string;
      feedbackScore?: number;
    }
  ): Promise<void> {
    // Record usage in agent_usage table
    await this.pgClient.recordUsage({
      agent_id: agentId,
      success,
      duration_ms: options?.durationMs,
      error_message: options?.errorMessage,
      feedback_score: options?.feedbackScore
    });

    // Recalculate confidence after each execution
    await this.calculateConfidence(agentId);
  }

  async calculateConfidence(agentId: string): Promise<number> {
    // Get usage stats
    const stats = await this.pgClient.getUsageStats(agentId);
    
    // Calculate success rate (0-1)
    const successRate = stats.total_executions > 0
      ? stats.successful_executions / stats.total_executions
      : 0;

    // Calculate usage factor (log scale, max 1.0 at 100 executions)
    const usageFactor = Math.min(stats.total_executions / 100, 1.0);

    // Calculate feedback factor (normalize -1..1 to 0..1)
    const feedbackFactor = stats.avg_feedback !== null
      ? (stats.avg_feedback + 1) / 2
      : 0.5; // Default neutral if no feedback

    // Weighted combination
    const confidence = (successRate * 0.5) + (usageFactor * 0.3) + (feedbackFactor * 0.2);

    // Round to 2 decimal places
    const roundedConfidence = Math.round(confidence * 100) / 100;

    // Update agent record
    await this.pgClient.updateAgent(agentId, {
      confidence_score: roundedConfidence
    });

    return roundedConfidence;
  }

  async recalculateAllConfidence(): Promise<ConfidenceRecord[]> {
    const results: ConfidenceRecord[] = [];
    
    // Get all agents
    const agents = await this.pgClient.listAgents({});

    for (const agent of agents) {
      const stats = await this.pgClient.getUsageStats(agent.agent_id);
      
      const successRate = stats.total_executions > 0
        ? stats.successful_executions / stats.total_executions
        : 0;

      const usageFactor = Math.min(stats.total_executions / 100, 1.0);
      
      const feedbackFactor = stats.avg_feedback !== null
        ? (stats.avg_feedback + 1) / 2
        : 0.5;

      const confidence = (successRate * 0.5) + (usageFactor * 0.3) + (feedbackFactor * 0.2);
      const roundedConfidence = Math.round(confidence * 100) / 100;

      await this.pgClient.updateAgent(agent.agent_id, {
        confidence_score: roundedConfidence
      });

      results.push({
        agent_id: agent.agent_id,
        confidence_score: roundedConfidence,
        success_rate: Math.round(successRate * 100) / 100,
        usage_factor: Math.round(usageFactor * 100) / 100,
        feedback_factor: Math.round(feedbackFactor * 100) / 100,
        total_executions: stats.total_executions,
        successful_executions: stats.successful_executions,
        avg_feedback: stats.avg_feedback || 0,
        calculated_at: new Date()
      });
    }

    return results;
  }

  async getConfidenceHistory(agentId: string): Promise<ConfidenceRecord[]> {
    // Get agent_versions table which tracks confidence changes
    const result = await (this.pgClient as any).pool.query(
      `SELECT * FROM agent_versions 
       WHERE agent_id = $1 
       ORDER BY created_at DESC 
       LIMIT 100`,
      [agentId]
    );

    return result.rows.map((row: Record<string, unknown>) => ({
      agent_id: row.agent_id,
      confidence_score: parseFloat(row.confidence_score as string),
      success_rate: 0, // Not stored in versions table
      usage_factor: 0,
      feedback_factor: 0,
      total_executions: 0,
      successful_executions: 0,
      avg_feedback: 0,
      calculated_at: row.created_at
    }));
  }

  async getTopAgents(limit: number = 10): Promise<AgentRecord[]> {
    const agents = await this.pgClient.listAgents({
      status: 'Active',
      limit
    });

    // Sort by confidence_score descending (already done in query)
    return agents;
  }

  async getAgentsNeedingFeedback(limit: number = 10): Promise<AgentRecord[]> {
    // Agents with recent executions but no feedback
    const result = await (this.pgClient as any).pool.query(
      `SELECT DISTINCT a.* 
       FROM agents a
       JOIN agent_usage u ON a.agent_id = u.agent_id
       WHERE u.feedback_score IS NULL
       AND u.executed_at > NOW() - INTERVAL '7 days'
       ORDER BY a.confidence_score DESC
       LIMIT $1`,
      [limit]
    );

    return result.rows;
  }

  async getConfidenceDistribution(): Promise<{
    high: number;    // 0.7 - 1.0
    medium: number;  // 0.4 - 0.7
    low: number;     // 0.0 - 0.4
  }> {
    const agents = await this.pgClient.listAgents({});

    let high = 0;
    let medium = 0;
    let low = 0;

    for (const agent of agents) {
      if (agent.confidence_score >= 0.7) {
        high++;
      } else if (agent.confidence_score >= 0.4) {
        medium++;
      } else {
        low++;
      }
    }

    return { high, medium, low };
  }
}

// Singleton instance
let confidenceInstance: AgentConfidence | null = null;

export function getAgentConfidence(): AgentConfidence {
  if (!confidenceInstance) {
    confidenceInstance = new AgentConfidence();
  }
  return confidenceInstance;
}