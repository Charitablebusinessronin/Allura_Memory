/**
 * State Capture for Forensic Review
 * Story 3.2: Preserve session state on halt for forensic analysis
 */

import type { Pool } from "pg";
import { getPool } from "../postgres/connection";
import type {
  BudgetConsumptionReport,
  ForensicSnapshot,
  HaltReason,
  SessionId,
  SessionState,
} from "./types";

/**
 * State capture configuration
 */
export interface StateCaptureConfig {
  /** Maximum reasoning steps to capture */
  maxReasoningSteps: number;
  /** Maximum tool call history to capture */
  maxToolCallHistory: number;
  /** Enable PostgreSQL persistence */
  enablePersistence: boolean;
  /** Table name for forensic snapshots */
  tableName: string;
}

/**
 * In-memory snapshot store (for testing)
 */
const snapshotStore: Map<string, ForensicSnapshot> = new Map();

/**
 * Default state capture configuration
 */
const DEFAULT_CONFIG: StateCaptureConfig = {
  maxReasoningSteps: 100,
  maxToolCallHistory: 1000,
  enablePersistence: true,
  tableName: "forensic_snapshots",
};

/**
 * State Capture - Preserves session state for forensic review
 * Stores complete session state to PostgreSQL when execution halts
 */
export class StateCapture {
  private config: StateCaptureConfig;
  private pool: Pool | null = null;

  constructor(config?: Partial<StateCaptureConfig>) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * Capture session state for forensic review
   */
  async captureState(state: SessionState): Promise<ForensicSnapshot> {
    const snapshot = this.createSnapshot(state);

    if (this.config.enablePersistence && typeof window === "undefined") {
      await this.persistSnapshot(snapshot);
    } else {
      // Store in memory for testing
      const key = this.snapshotKey(state.id);
      snapshotStore.set(key, snapshot);
    }

    return snapshot;
  }

  /**
   * Retrieve a forensic snapshot by session ID
   */
  async getSnapshot(sessionId: SessionId): Promise<ForensicSnapshot | null> {
    if (!this.config.enablePersistence) {
      const key = this.snapshotKey(sessionId);
      return snapshotStore.get(key) ?? null;
    }

    return this.loadSnapshot(sessionId);
  }

  /**
   * List all snapshots for a group (tenant)
   */
  async listSnapshots(groupId: string, limit: number = 100): Promise<ForensicSnapshot[]> {
    if (!this.config.enablePersistence) {
      const results: ForensicSnapshot[] = [];
      for (const snapshot of Array.from(snapshotStore.values())) {
        if (snapshot.groupId === groupId) {
          results.push(snapshot);
        }
      }
      return results.slice(0, limit);
    }

    return this.loadSnapshotsByGroup(groupId, limit);
  }

  /**
   * Create budget consumption report from session state
   */
  createBudgetReport(state: SessionState): BudgetConsumptionReport {
    const { limits, consumption } = state.budgetStatus;

    // Count tool calls by name
    const toolCallCounts: Record<string, number> = {};
    let successfulCalls = 0;
    for (const call of state.toolCallHistory) {
      toolCallCounts[call.toolName] = (toolCallCounts[call.toolName] ?? 0) + 1;
      if (call.success) successfulCalls++;
    }

    // Calculate success rate
    const successRate = state.toolCallHistory.length > 0
      ? successfulCalls / state.toolCallHistory.length
      : 1.0;

    // Time breakdown by phase
    const timeBreakdown: Record<string, number> = {};
    for (const call of state.toolCallHistory) {
      const phase = `tool_${call.toolName}`;
      timeBreakdown[phase] = (timeBreakdown[phase] ?? 0) + call.durationMs;
    }

    return {
      tokens: {
        input: estimateInputTokens(state),
        output: estimateOutputTokens(state),
        total: consumption.tokens,
        percentUtilized: (consumption.tokens / limits.maxTokens) * 100,
      },
      toolCalls: {
        total: consumption.toolCalls,
        byTool: toolCallCounts,
        successRate,
      },
      time: {
        totalMs: consumption.timeMs,
        breakdownByPhase: timeBreakdown,
      },
      cost: {
        totalUsd: consumption.costUsd,
        breakdownByModel: {}, // Populated by monitor
      },
      steps: {
        total: consumption.steps,
        limit: limits.maxSteps,
        percentUtilized: (consumption.steps / limits.maxSteps) * 100,
      },
    };
  }

  /**
   * Generate forensic summary for debugging
   */
  generateSummary(state: SessionState): string {
    const lines: string[] = [
      `=== Forensic Summary ===`,
      `Session: ${state.id.groupId}/${state.id.agentId}/${state.id.sessionId}`,
      `Started: ${state.startedAt.toISOString()}`,
      state.haltedAt ? `Halted: ${state.haltedAt.toISOString()}` : "",
      `Steps: ${state.currentStep}`,
      ``,
      `Budget Status:`,
      `  Tokens: ${state.budgetStatus.consumption.tokens}/${state.budgetStatus.limits.maxTokens} (${state.budgetStatus.utilization.tokens.toFixed(1)}%)`,
      `  Tool Calls: ${state.budgetStatus.consumption.toolCalls}/${state.budgetStatus.limits.maxToolCalls} (${state.budgetStatus.utilization.toolCalls.toFixed(1)}%)`,
      `  Time: ${state.budgetStatus.consumption.timeMs}ms/${state.budgetStatus.limits.maxTimeMs}ms (${state.budgetStatus.utilization.timeMs.toFixed(1)}%)`,
      `  Cost: $${state.budgetStatus.consumption.costUsd.toFixed(4)}/$${state.budgetStatus.limits.maxCostUsd.toFixed(2)} (${state.budgetStatus.utilization.costUsd.toFixed(1)}%)`,
      `  Steps: ${state.budgetStatus.consumption.steps}/${state.budgetStatus.limits.maxSteps} (${state.budgetStatus.utilization.steps.toFixed(1)}%)`,
    ];

    if (state.haltReason) {
      lines.push(``, `Halt Reason: ${state.haltReason.type}`);
      if (state.haltReason.type === "kmax_exceeded") {
        lines.push(`  Max Steps: ${state.haltReason.maxSteps}, Current: ${state.haltReason.currentStep}`);
      } else if (state.haltReason.type === "token_limit") {
        lines.push(`  Limit: ${state.haltReason.limit}, Consumed: ${state.haltReason.consumed}`);
      } else if (state.haltReason.type === "critical_error") {
        lines.push(`  Error: ${state.haltReason.error}`);
      }
    }

    if (state.lastError) {
      lines.push(``, `Last Error (Step ${state.lastError.step}):`);
      lines.push(`  ${state.lastError.message}`);
      if (state.lastError.stack) {
        lines.push(`  Stack: ${state.lastError.stack.slice(0, 200)}...`);
      }
    }

    if (state.toolCallHistory.length > 0) {
      lines.push(``, `Last 5 Tool Calls:`);
      const last5 = state.toolCallHistory.slice(-5);
      for (const call of last5) {
        lines.push(`  [${call.step}] ${call.toolName} (${call.durationMs}ms) ${call.success ? "✓" : "✗"}`);
      }
    }

    if (state.reasoningHistory.length > 0) {
      lines.push(``, `Last 3 Reasoning Steps:`);
      const last3 = state.reasoningHistory.slice(-3);
      for (const step of last3) {
        lines.push(`  [${step.step}] ${step.thought.slice(0, 100)}...`);
      }
    }

    return lines.join("\n");
  }

  // Private methods

  private createSnapshot(state: SessionState): ForensicSnapshot {
    const snapshotId = this.generateSnapshotId();

    return {
      id: snapshotId,
      sessionId: state.id,
      createdAt: new Date(),
      haltReason: state.haltReason ?? { type: "critical_error", error: "No halt reason recorded" },
      stateJson: JSON.stringify(state),
      budgetReport: this.createBudgetReport(state),
      groupId: state.id.groupId,
    };
  }

  private generateSnapshotId(): number {
    return Date.now() ^ Math.floor(Math.random() * 10000);
  }

  private snapshotKey(sessionId: SessionId): string {
    return `${sessionId.groupId}:${sessionId.agentId}:${sessionId.sessionId}`;
  }

  private async getPoolConnection(): Promise<Pool> {
    if (!this.pool) {
      this.pool = getPool();
    }
    return this.pool;
  }

  private async persistSnapshot(snapshot: ForensicSnapshot): Promise<void> {
    try {
      const pool = await this.getPoolConnection();

      const query = `
        INSERT INTO ${this.config.tableName} (
          group_id,
          session_id,
          created_at,
          halt_reason,
          state_json,
          budget_report
        ) VALUES ($1, $2, $3, $4, $5, $6)
        RETURNING id
      `;

      const values = [
        snapshot.groupId,
        this.snapshotKey(snapshot.sessionId),
        snapshot.createdAt,
        JSON.stringify(snapshot.haltReason),
        snapshot.stateJson,
        JSON.stringify(snapshot.budgetReport),
      ];

      await pool.query(query, values);
    } catch (error) {
      // Log but don't throw - state capture should not crash the session
      console.error("[StateCapture] Failed to persist snapshot:", error);
    }
  }

  private async loadSnapshot(sessionId: SessionId): Promise<ForensicSnapshot | null> {
    try {
      const pool = await this.getPoolConnection();

      const query = `
        SELECT id, group_id, session_id, created_at, halt_reason, state_json, budget_report
        FROM ${this.config.tableName}
        WHERE session_id = $1
        ORDER BY created_at DESC
        LIMIT 1
      `;

      const values = [this.snapshotKey(sessionId)];
      const result = await pool.query(query, values);

      if (result.rows.length === 0) {
        return null;
      }

      const row = result.rows[0];
      return {
        id: row.id,
        sessionId: sessionId,
        createdAt: row.created_at,
        haltReason: row.halt_reason as HaltReason,
        stateJson: row.state_json,
        budgetReport: row.budget_report as BudgetConsumptionReport,
        groupId: row.group_id,
      };
    } catch (error) {
      console.error("[StateCapture] Failed to load snapshot:", error);
      return null;
    }
  }

  private async loadSnapshotsByGroup(groupId: string, limit: number): Promise<ForensicSnapshot[]> {
    try {
      const pool = await this.getPoolConnection();

      const query = `
        SELECT id, group_id, session_id, created_at, halt_reason, state_json, budget_report
        FROM ${this.config.tableName}
        WHERE group_id = $1
        ORDER BY created_at DESC
        LIMIT $2
      `;

      const result = await pool.query(query, [groupId, limit]);

      return result.rows.map((row) => ({
        id: row.id,
        sessionId: this.parseSessionId(row.session_id),
        createdAt: row.created_at,
        haltReason: row.halt_reason as HaltReason,
        stateJson: row.state_json,
        budgetReport: row.budget_report as BudgetConsumptionReport,
        groupId: row.group_id,
      }));
    } catch (error) {
      console.error("[StateCapture] Failed to load snapshots:", error);
      return [];
    }
  }

  private parseSessionId(key: string): SessionId {
    const parts = key.split(":");
    return {
      groupId: parts[0] ?? "",
      agentId: parts[1] ?? "",
      sessionId: parts[2] ?? "",
    };
  }
}

/**
 * Create a state capture instance
 */
export function createStateCapture(config?: Partial<StateCaptureConfig>): StateCapture {
  return new StateCapture(config);
}

/**
 * Helper to estimate input tokens (rough estimate)
 */
function estimateInputTokens(state: SessionState): number {
  // Rough estimate: ~4 chars per token
  let input = 0;
  for (const step of state.reasoningHistory) {
    input += Math.ceil(step.thought.length / 4);
    if (step.decision) {
      input += Math.ceil(step.decision.length / 4);
    }
  }
  return input;
}

/**
 * Helper to estimate output tokens (rough estimate)
 */
function estimateOutputTokens(state: SessionState): number {
  // Rough estimate: ~4 chars per token
  let output = 0;
  for (const call of state.toolCallHistory) {
    if (call.output) {
      output += Math.ceil(JSON.stringify(call.output).length / 4);
    }
  }
  return output;
}