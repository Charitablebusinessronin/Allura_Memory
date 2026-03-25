"use server";

import { getSession, writeTransaction, readTransaction } from "@/lib/neo4j/connection";
import type { AgentConfig } from "../config/schema";

/**
 * Agent status values following the lifecycle
 */
export type AgentStatus =
  | "Pending"
  | "Running"
  | "Stopped"
  | "Error"
  | "Approved"
  | "Rejected";

/**
 * Agent type from config schema
 */
export type AgentType =
  | "knowledge-curator"
  | "memory-promotion"
  | "adas-search"
  | "custom-task";

/**
 * Stored agent node from Neo4j
 */
export interface Agent {
  id: string;
  name: string;
  type: AgentType;
  status: AgentStatus;
  group_id: string;
  enabled: boolean;
  config_hash: string;
  restart_policy: string;
  schedule_type: "cron" | "interval" | "continuous";
  schedule_cron?: string;
  schedule_interval?: number;
  memory_mb: number;
  cpu_percent: number;
  timeout_seconds: number;
  notion_sync: boolean;
  notion_database_id?: string;
  created_at: string;
  updated_at: string;
  last_run_at?: string;
  next_run_at?: string;
  success_rate?: number;
  error_count: number;
}

/**
 * Agent run record
 */
export interface AgentRun {
  run_id: string;
  agent_id: string;
  started_at: string;
  ended_at?: string;
  duration_ms?: number;
  success: boolean;
  exit_code?: number;
  error_message?: string;
}

/**
 * Input for recording an agent run
 */
export interface AgentRunInput {
  success: boolean;
  duration_ms?: number;
  exit_code?: number;
  error_message?: string;
}

/**
 * Agent registry for managing persistent autonomous agents in Neo4j
 */
export class AgentRegistry {
  /**
   * Generate a unique agent ID
   */
  private generateAgentId(name: string, group_id: string): string {
    return `agent-${name}-${group_id}`;
  }

  /**
   * Compute config hash from agent config
   * Simple JSON serialization for now
   */
  private computeConfigHash(config: AgentConfig): string {
    return Buffer.from(JSON.stringify(config)).toString("base64").slice(0, 32);
  }

  /**
   * Extract schedule type and values from AgentConfig
   */
  private extractSchedule(
    config: AgentConfig
  ): { type: "cron" | "interval" | "continuous"; cron?: string; interval?: number } {
    if (config.schedule.cron) {
      return { type: "cron", cron: config.schedule.cron };
    }
    if (config.schedule.interval_seconds) {
      return { type: "interval", interval: config.schedule.interval_seconds };
    }
    return { type: "continuous" };
  }

  /**
   * Create a new agent node in Neo4j
   * Initial status is "Pending" awaiting human approval
   */
  async createAgent(config: AgentConfig, group_id: string): Promise<Agent> {
    const id = this.generateAgentId(config.name, group_id);
    const configHash = this.computeConfigHash(config);
    const schedule = this.extractSchedule(config);

    return await writeTransaction(async (tx) => {
      // Check if agent already exists
      const existingResult = await tx.run(
        `
        MATCH (a:Agent {id: $id})
        RETURN a.id as existing_id
        `,
        { id }
      );

      if (existingResult.records.length > 0) {
        throw new Error(`Agent already exists: ${config.name} in group ${group_id}`);
      }

      // Create the agent node with all properties
      const result = await tx.run(
        `
        CREATE (a:Agent {
          id: $id,
          name: $name,
          type: $type,
          status: 'Pending',
          group_id: $group_id,
          enabled: $enabled,
          config_hash: $config_hash,
          restart_policy: $restart_policy,
          schedule_type: $schedule_type,
          schedule_cron: $schedule_cron,
          schedule_interval: $schedule_interval,
          memory_mb: $memory_mb,
          cpu_percent: $cpu_percent,
          timeout_seconds: $timeout_seconds,
          notion_sync: $notion_sync,
          notion_database_id: $notion_database_id,
          created_at: datetime(),
          updated_at: datetime(),
          error_count: 0
        })
        RETURN a
        `,
        {
          id,
          name: config.name,
          type: config.type,
          group_id,
          enabled: config.enabled,
          config_hash: configHash,
          restart_policy: config.restart_policy,
          schedule_type: schedule.type,
          schedule_cron: schedule.cron || null,
          schedule_interval: schedule.interval || null,
          memory_mb: config.resources.memory_mb,
          cpu_percent: config.resources.cpu_percent,
          timeout_seconds: config.resources.timeout_seconds,
          notion_sync: config.notion.sync,
          notion_database_id: config.notion.database_id || null,
        }
      );

      const record = result.records[0];
      if (!record) {
        throw new Error("Failed to create agent");
      }

      const agent = record.get("a");
      return this.neo4jAgentToAgent(agent);
    });
  }

  /**
   * Get an agent by name and group_id
   */
  async getAgent(name: string, group_id: string): Promise<Agent | null> {
    const id = this.generateAgentId(name, group_id);

    return await readTransaction(async (tx) => {
      const result = await tx.run(
        `
        MATCH (a:Agent {id: $id})
        RETURN a
        `,
        { id }
      );

      const record = result.records[0];
      if (!record) {
        return null;
      }

      return this.neo4jAgentToAgent(record.get("a"));
    });
  }

  /**
   * List all agents for a group
   */
  async listAgents(group_id: string): Promise<Agent[]> {
    return await readTransaction(async (tx) => {
      const result = await tx.run(
        `
        MATCH (a:Agent {group_id: $group_id})
        RETURN a
        ORDER BY a.name
        `,
        { group_id }
      );

      return result.records.map((record) => this.neo4jAgentToAgent(record.get("a")));
    });
  }

  /**
   * Update agent status
   */
  async updateAgentStatus(
    name: string,
    group_id: string,
    status: AgentStatus
  ): Promise<void> {
    const id = this.generateAgentId(name, group_id);

    await writeTransaction(async (tx) => {
      const result = await tx.run(
        `
        MATCH (a:Agent {id: $id})
        SET a.status = $status,
            a.updated_at = datetime()
        RETURN a
        `,
        { id, status }
      );

      if (result.records.length === 0) {
        throw new Error(`Agent not found: ${name} in group ${group_id}`);
      }
    });
  }

  /**
   * Delete an agent and all its runs
   */
  async deleteAgent(name: string, group_id: string): Promise<void> {
    const id = this.generateAgentId(name, group_id);

    await writeTransaction(async (tx) => {
      await tx.run(
        `
        MATCH (a:Agent {id: $id})
        OPTIONAL MATCH (a)<-[:RUN_OF]-(r:AgentRun)
        DETACH DELETE r, a
        `,
        { id }
      );
    });
  }

  /**
   * Record an agent run
   */
  async recordAgentRun(
    name: string,
    group_id: string,
    run: AgentRunInput
  ): Promise<AgentRun> {
    const agentId = this.generateAgentId(name, group_id);
    const runId = `run-${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;

    return await writeTransaction(async (tx) => {
      const result = await tx.run(
        `
        MATCH (a:Agent {id: $agent_id})
        CREATE (r:AgentRun {
          run_id: $run_id,
          started_at: datetime(),
          ended_at: datetime(),
          duration_ms: $duration_ms,
          success: $success,
          exit_code: $exit_code,
          error_message: $error_message
        })
        CREATE (r)-[:RUN_OF]->(a)
        
        // Update agent stats
        WITH a, r
        SET a.last_run_at = datetime(),
            a.error_count = CASE WHEN $success = false THEN a.error_count + 1 ELSE a.error_count END,
            a.success_rate = (
              CASE 
                WHEN a.success_rate IS NULL THEN CASE WHEN $success THEN 1.0 ELSE 0.0 END
                ELSE (a.success_rate * (a.error_count + 1) + CASE WHEN $success THEN 1.0 ELSE 0.0 END) / (a.error_count + 2)
              END
            )
        RETURN r
        `,
        {
          agent_id: agentId,
          run_id: runId,
          duration_ms: run.duration_ms || null,
          success: run.success,
          exit_code: run.exit_code || null,
          error_message: run.error_message || null,
        }
      );

      const record = result.records[0];
      if (!record) {
        throw new Error("Failed to record agent run");
      }

      return this.neo4jRunToAgentRun(record.get("r"));
    });
  }

  /**
   * Get runs for an agent
   */
  async getAgentRuns(name: string, group_id: string, limit = 100): Promise<AgentRun[]> {
    const agentId = this.generateAgentId(name, group_id);

    return await readTransaction(async (tx) => {
      const result = await tx.run(
        `
        MATCH (r:AgentRun)-[:RUN_OF]->(a:Agent {id: $agent_id})
        RETURN r
        ORDER BY r.started_at DESC
        LIMIT $limit
        `,
        { agent_id: agentId, limit }
      );

      return result.records.map((record) => this.neo4jRunToAgentRun(record.get("r")));
    });
  }

  /**
   * Convert Neo4j agent node to Agent interface
   */
  private neo4jAgentToAgent(node: {
    properties: Record<string, unknown>;
  }): Agent {
    const p = node.properties;
    return {
      id: String(p.id),
      name: String(p.name),
      type: String(p.type) as AgentType,
      status: String(p.status) as AgentStatus,
      group_id: String(p.group_id),
      enabled: Boolean(p.enabled),
      config_hash: String(p.config_hash),
      restart_policy: String(p.restart_policy),
      schedule_type: String(p.schedule_type) as "cron" | "interval" | "continuous",
      schedule_cron: p.schedule_cron ? String(p.schedule_cron) : undefined,
      schedule_interval: p.schedule_interval ? Number(p.schedule_interval) : undefined,
      memory_mb: Number(p.memory_mb),
      cpu_percent: Number(p.cpu_percent),
      timeout_seconds: Number(p.timeout_seconds),
      notion_sync: Boolean(p.notion_sync),
      notion_database_id: p.notion_database_id ? String(p.notion_database_id) : undefined,
      created_at: String(p.created_at),
      updated_at: String(p.updated_at),
      last_run_at: p.last_run_at ? String(p.last_run_at) : undefined,
      next_run_at: p.next_run_at ? String(p.next_run_at) : undefined,
      success_rate: p.success_rate ? Number(p.success_rate) : undefined,
      error_count: Number(p.error_count) || 0,
    };
  }

  /**
   * Convert Neo4j run node to AgentRun interface
   */
  private neo4jRunToAgentRun(node: {
    properties: Record<string, unknown>;
  }): AgentRun {
    const p = node.properties;
    return {
      run_id: String(p.run_id),
      agent_id: String(p.agent_id || ""),
      started_at: String(p.started_at),
      ended_at: p.ended_at ? String(p.ended_at) : undefined,
      duration_ms: p.duration_ms ? Number(p.duration_ms) : undefined,
      success: Boolean(p.success),
      exit_code: p.exit_code ? Number(p.exit_code) : undefined,
      error_message: p.error_message ? String(p.error_message) : undefined,
    };
  }
}
