/**
 * Summary Generator - Progress Report Creation
 * Story 3.3: Implement Fail-Safe Termination and Escalation
 */

import type { Pool } from "pg";
import { getPool } from "../postgres/connection";
import type {
  ProgressSummary,
  HumanReadableSummary,
  Bottleneck,
  SummaryGenerationOptions,
  AttemptedStep,
  PartialResult,
  StuckPattern,
} from "./types";
import { DEFAULT_SUMMARY_OPTIONS } from "./types";
import type { SessionState, HaltReason, SessionId } from "../budget/types";
import { ProgressTracker } from "./progress-tracker";
import { formatTraceRef } from "../validation/trace-ref";

/**
 * Summary generator configuration
 */
export interface SummaryGeneratorConfig {
  /** PostgreSQL table for summaries */
  summaryTable: string;
  /** Enable persistence */
  enablePersistence: boolean;
  /** Max text length for summaries */
  maxTextLength: number;
}

/**
 * Default summary generator configuration
 */
const DEFAULT_GENERATOR_CONFIG: SummaryGeneratorConfig = {
  summaryTable: "termination_summaries",
  enablePersistence: true,
  maxTextLength: 10000,
};

/**
 * In-memory summary store (for testing)
 */
const summaryStore: Map<string, ProgressSummary> = new Map();

/**
 * Summary Generator - Creates human-readable progress reports
 */
export class SummaryGenerator {
  private config: SummaryGeneratorConfig;
  private pool: Pool | null = null;

  constructor(config?: Partial<SummaryGeneratorConfig>) {
    this.config = { ...DEFAULT_GENERATOR_CONFIG, ...config };
  }

  /**
   * Generate a progress summary from session state
   */
  async generateSummary(
    state: SessionState,
    haltReason: HaltReason,
    tracker: ProgressTracker,
    options?: Partial<SummaryGenerationOptions>,
  ): Promise<ProgressSummary> {
    const opts = { ...DEFAULT_SUMMARY_OPTIONS, ...options };
    const id = this.generateSummaryId();

    // Get execution data from tracker
    const steps = tracker.getSteps();
    const stuckPatterns = tracker.getStuckPatterns();
    const partialResults = tracker.getPartialResults();
    const goal = tracker.getGoal();
    const bottlenecks = tracker.identifyBottlenecks();

    // Build the progress summary
    const summary: ProgressSummary = {
      id,
      sessionId: {
        groupId: state.id.groupId,
        agentId: state.id.agentId,
        sessionId: state.id.sessionId,
      },
      generatedAt: new Date(),

      goal: {
        description: goal.description || "Unknown task",
        type: goal.type || "unknown",
        successCriteria: goal.successCriteria,
        constraints: goal.constraints,
      },

      progress: {
        stepsCompleted: state.currentStep,
        stepBudget: state.budgetStatus.limits.maxSteps,
        percentComplete: this.calculatePercentComplete(state),
        tokensUsed: state.budgetStatus.consumption.tokens,
        tokenBudget: state.budgetStatus.limits.maxTokens,
        timeElapsedMs: state.budgetStatus.consumption.timeMs,
        timeBudgetMs: state.budgetStatus.limits.maxTimeMs,
        budgetUtilization: {
          tokens: state.budgetStatus.utilization.tokens,
          toolCalls: state.budgetStatus.utilization.toolCalls,
          time: state.budgetStatus.utilization.timeMs,
          cost: state.budgetStatus.utilization.costUsd,
          steps: state.budgetStatus.utilization.steps,
        },
      },

      bottlenecks,

      attemptedSteps: opts.includeFullHistory
        ? steps
        : steps.slice(-50), // Last 50 steps by default

      stuckPatterns,

      partialResults,

      termination: {
        reason: haltReason,
        expected: this.isExpectedTermination(haltReason),
        resumable: this.isResumable(haltReason),
        explanation: this.explainTermination(haltReason, state),
      },

      recommendations: this.generateRecommendations(haltReason, bottlenecks, stuckPatterns, state),

      traceRef: "", // Will be set after persistence

      groupId: state.id.groupId,
    };

    // Persist if enabled
    if (this.config.enablePersistence && typeof window === "undefined") {
      summary.traceRef = await this.persistSummary(summary);
    } else {
      // Store in memory for testing
      summaryStore.set(summary.id, summary);
      summary.traceRef = formatTraceRef("termination_summaries", summary.id);
    }

    return summary;
  }

  /**
   * Generate human-readable formats
   */
  formatSummary(
    summary: ProgressSummary,
    options?: Partial<SummaryGenerationOptions>,
  ): HumanReadableSummary {
    const opts = { ...DEFAULT_SUMMARY_OPTIONS, ...options };

    const markdown = this.generateMarkdown(summary);
    const text = this.generateText(summary);

    return {
      markdown,
      text: text.slice(0, this.config.maxTextLength),
      json: summary,
      oneLiner: this.generateOneLiner(summary),
    };
  }

  /**
   * Retrieve a summary by ID
   */
  async getSummary(summaryId: string): Promise<ProgressSummary | null> {
    if (!this.config.enablePersistence) {
      return summaryStore.get(summaryId) ?? null;
    }

    return this.loadSummary(summaryId);
  }

  /**
   * List summaries for a group
   */
  async listSummaries(groupId: string, limit: number = 50): Promise<ProgressSummary[]> {
    if (!this.config.enablePersistence) {
      return Array.from(summaryStore.values())
        .filter(s => s.groupId === groupId)
        .slice(0, limit);
    }

    return this.loadSummariesByGroup(groupId, limit);
  }

  /**
   * Analyze bottlenecks for patterns
   */
  analyzeBottlenecks(bottlenecks: Bottleneck[]): {
    primary: Bottleneck | null;
    secondary: Bottleneck[];
    severity: number;
  } {
    if (bottlenecks.length === 0) {
      return { primary: null, secondary: [], severity: 0 };
    }

    const sorted = [...bottlenecks].sort((a, b) => {
      // Sort by recoverable (false first) and then by recency
      if (a.recoverable !== b.recoverable) {
        return a.recoverable ? 1 : -1;
      }
      return b.step - a.step;
    });

    return {
      primary: sorted[0] ?? null,
      secondary: sorted.slice(1),
      severity: this.calculateBottleneckSeverity(sorted),
    };
  }

  // Private methods

  private calculatePercentComplete(state: SessionState): number {
    const { steps, tokens, toolCalls, timeMs } = state.budgetStatus.consumption;
    const { maxSteps, maxTokens, maxToolCalls, maxTimeMs } = state.budgetStatus.limits;

    // Weighted average of resource utilization
    const stepProgress = (steps / maxSteps) * 100;
    const tokenProgress = (tokens / maxTokens) * 100;
    const callProgress = (toolCalls / maxToolCalls) * 100;
    const timeProgress = (timeMs / maxTimeMs) * 100;

    // Give more weight to steps
    const weighted = (stepProgress * 0.4) + (tokenProgress * 0.2) + (callProgress * 0.2) + (timeProgress * 0.2);
    return Math.min(100, Math.round(weighted));
  }

  private isExpectedTermination(haltReason: HaltReason): boolean {
    if (haltReason.type === "kmax_exceeded") return true;
    if (haltReason.type === "time_limit") return true;
    if (haltReason.type === "critical_error") return false;
    if (haltReason.type === "policy_violation") return false;
    return true;
  }

  private isResumable(haltReason: HaltReason): boolean {
    if (haltReason.type === "critical_error") {
      return false;
    }
    if (haltReason.type === "policy_violation") {
      return false; // Policy violations need human review
    }
    return true;
  }

  private explainTermination(haltReason: HaltReason, state: SessionState): string {
    const baseInfo = `Session terminated at step ${state.currentStep}`;

    switch (haltReason.type) {
      case "kmax_exceeded":
        return `${baseInfo}: Exceeded maximum step limit (${haltReason.maxSteps} steps). Task may require more iterations or the goal needs to be broken into smaller subtasks.`;
      
      case "token_limit":
        return `${baseInfo}: Exceeded token budget (${haltReason.consumed.toLocaleString()} / ${haltReason.limit.toLocaleString()} tokens). Consider increasing the token limit or optimizing prompts.`;
      
      case "tool_call_limit":
        return `${baseInfo}: Exceeded tool call limit (${haltReason.consumed} / ${haltReason.limit} calls). Task may need to be simplified or limit increased.`;
      
      case "time_limit":
        return `${baseInfo}: Exceeded time limit (${Math.round(haltReason.elapsedMs / 1000)}s / ${Math.round(haltReason.limitMs / 1000)}s). Task took longer than allowed duration.`;
      
      case "cost_limit":
        return `${baseInfo}: Exceeded cost limit ($${haltReason.consumedUsd.toFixed(2)} / $${haltReason.limitUsd.toFixed(2)}). Consider using cheaper models or optimizing token usage.`;
      
      case "policy_violation":
        return `${baseInfo}: Policy violation detected - ${haltReason.reason}. Manual review required before resuming.`;
      
      case "critical_error":
        return `${baseInfo}: Critical error encountered - ${haltReason.error}. Session terminated unexpectedly. Investigation required.`;
      
      default:
        return `${baseInfo}: Unknown termination reason. Manual review recommended.`;
    }
  }

  private generateRecommendations(
    haltReason: HaltReason,
    bottlenecks: Bottleneck[],
    stuckPatterns: StuckPattern[],
    state: SessionState,
  ): string[] {
    const recommendations: string[] = [];

    // Halt reason recommendations
    if (haltReason.type === "kmax_exceeded") {
      recommendations.push("Increase Kmax step limit for complex tasks");
      recommendations.push("Break task into smaller sub-tasks");
    } else if (haltReason.type === "token_limit") {
      recommendations.push("Increase token budget");
      recommendations.push("Optimize prompt length");
    } else if (haltReason.type === "policy_violation") {
      recommendations.push("Review policy constraints in Mission Control");
      recommendations.push("Check if action aligns with security requirements");
    } else if (haltReason.type === "critical_error") {
      recommendations.push("Investigate error in detail before resuming");
      recommendations.push("Check external service availability");
    }

    // Bottleneck recommendations
    for (const bottleneck of bottlenecks) {
      if (bottleneck.resolution) {
        recommendations.push(bottleneck.resolution);
      }
    }

    // Stuck pattern recommendations
    for (const pattern of stuckPatterns) {
      recommendations.push(pattern.suggestedResolution);
    }

    // Budget recommendations
    if (state.budgetStatus.utilization.steps > 90) {
      recommendations.push("Consider task decomposition for future runs");
    }
    if (state.budgetStatus.utilization.tokens > 90) {
      recommendations.push("Review context window usage and prune unnecessary history");
    }

    // Deduplicate
    return [...new Set(recommendations)].slice(0, 10);
  }

  private generateMarkdown(summary: ProgressSummary): string {
    const lines: string[] = [
      `# Termination Summary`,
      ``,
      `**Session:** ${summary.sessionId.groupId}/${summary.sessionId.agentId}/${summary.sessionId.sessionId}`,
      `**Generated:** ${summary.generatedAt.toISOString()}`,
      `**Trace Reference:** ${summary.traceRef}`,
      ``,
      `## Goal`,
      ``,
      `**Task:** ${summary.goal.description}`,
      ``,
      `**Type:** ${summary.goal.type}`,
      ``,
    ];

    if (summary.goal.successCriteria.length > 0) {
      lines.push(`**Success Criteria:**`);
      for (const criterion of summary.goal.successCriteria) {
        lines.push(`- ${criterion}`);
      }
      lines.push(``);
    }

    if (summary.goal.constraints.length > 0) {
      lines.push(`**Constraints:**`);
      for (const constraint of summary.goal.constraints) {
        lines.push(`- ${constraint}`);
      }
      lines.push(``);
    }

    lines.push(`## Progress`);
    lines.push(``);
    lines.push(`| Metric | Used | Budget | Utilization |`);
    lines.push(`|--------|------|--------|-------------|`);
    lines.push(`| Steps | ${summary.progress.stepsCompleted} | ${summary.progress.stepBudget} | ${summary.progress.budgetUtilization.steps.toFixed(1)}% |`);
    lines.push(`| Tokens | ${summary.progress.tokensUsed.toLocaleString()} | ${summary.progress.tokenBudget.toLocaleString()} | ${summary.progress.budgetUtilization.tokens.toFixed(1)}% |`);
    lines.push(`| Time | ${Math.round(summary.progress.timeElapsedMs / 1000)}s | ${Math.round(summary.progress.timeBudgetMs / 1000)}s | ${summary.progress.budgetUtilization.time.toFixed(1)}% |`);
    lines.push(`| Tool Calls | - | - | ${summary.progress.budgetUtilization.toolCalls.toFixed(1)}% |`);
    lines.push(`| Cost | - | - | ${summary.progress.budgetUtilization.cost.toFixed(1)}% |`);
    lines.push(``);
    lines.push(`**Overall Progress:** ${summary.progress.percentComplete}%`);
    lines.push(``);

    // Termination
    lines.push(`## Termination`);
    lines.push(``);
    lines.push(`**Reason:** ${summary.termination.reason.type}`);
    lines.push(``);
    lines.push(summary.termination.explanation);
    lines.push(``);
    lines.push(`**Expected:** ${summary.termination.expected ? "Yes" : "No"}`);
    lines.push(`**Resumable:** ${summary.termination.resumable ? "Yes" : "No"}`);
    lines.push(``);

    // Bottlenecks
    if (summary.bottlenecks.length > 0) {
      lines.push(`## Bottlenecks`);
      lines.push(``);
      for (const b of summary.bottlenecks) {
        lines.push(`### ${b.type}`);
        lines.push(`- **Affected:** ${b.affected}`);
        lines.push(`- **Description:** ${b.description}`);
        lines.push(`- **Recoverable:** ${b.recoverable ? "Yes" : "No"}`);
        if (b.resolution) {
          lines.push(`- **Resolution:** ${b.resolution}`);
        }
        lines.push(``);
      }
    }

    // Stuck Patterns
    if (summary.stuckPatterns.length > 0) {
      lines.push(`## Stuck Patterns`);
      lines.push(``);
      for (const p of summary.stuckPatterns) {
        lines.push(`- **${p.type}** (Severity ${p.severity}): ${p.description}`);
        lines.push(`  - Resolution: ${p.suggestedResolution}`);
      }
      lines.push(``);
    }

    // Recommendations
    if (summary.recommendations.length > 0) {
      lines.push(`## Recommendations`);
      lines.push(``);
      for (const r of summary.recommendations) {
        lines.push(`- ${r}`);
      }
      lines.push(``);
    }

    // Partial Results
    if (summary.partialResults.length > 0) {
      lines.push(`## Partial Results`);
      lines.push(``);
      for (const pr of summary.partialResults) {
        lines.push(`- **${pr.type}:** ${pr.description} (${pr.completionPercent}% complete)`);
      }
      lines.push(``);
    }

    // Recent Steps (last 10)
    if (summary.attemptedSteps.length > 0) {
      lines.push(`## Recent Steps`);
      lines.push(``);
      const recentSteps = summary.attemptedSteps.slice(-10);
      for (const s of recentSteps) {
        const status = s.outcome === "success" ? "✓" : s.outcome === "failure" ? "✗" : "⚠";
        lines.push(`${status} Step ${s.step}: ${s.action} (${s.durationMs}ms) - ${s.outcome}`);
      }
      lines.push(``);
    }

    return lines.join("\n");
  }

  private generateText(summary: ProgressSummary): string {
    const lines: string[] = [
      `TERMINATION SUMMARY`,
      `Session: ${summary.sessionId.sessionId}`,
      `Generated: ${summary.generatedAt.toISOString()}`,
      ``,
      `GOAL: ${summary.goal.description}`,
      ``,
      `PROGRESS: ${summary.progress.percentComplete}% complete`,
      `- Steps: ${summary.progress.stepsCompleted}/${summary.progress.stepBudget} (${summary.progress.budgetUtilization.steps.toFixed(1)}%)`,
      `- Tokens: ${summary.progress.tokensUsed.toLocaleString()}/${summary.progress.tokenBudget.toLocaleString()} (${summary.progress.budgetUtilization.tokens.toFixed(1)}%)`,
      ``,
      `TERMINATION: ${summary.termination.reason.type}`,
      summary.termination.explanation,
      ``,
    ];

    if (summary.bottlenecks.length > 0) {
      lines.push(`BOTTLENECKS (${summary.bottlenecks.length}):`);
      for (const b of summary.bottlenecks) {
        lines.push(`- ${b.type}: ${b.description}`);
      }
      lines.push(``);
    }

    if (summary.stuckPatterns.length > 0) {
      lines.push(`STUCK PATTERNS (${summary.stuckPatterns.length}):`);
      for (const p of summary.stuckPatterns) {
        lines.push(`- ${p.type}: ${p.description}`);
      }
      lines.push(``);
    }

    if (summary.recommendations.length > 0) {
      lines.push(`RECOMMENDATIONS:`);
      for (const r of summary.recommendations) {
        lines.push(`- ${r}`);
      }
      lines.push(``);
    }

    return lines.join("\n");
  }

  private generateOneLiner(summary: ProgressSummary): string {
    const reason = summary.termination.reason.type.replace(/_/g, " ");
    const percent = summary.progress.percentComplete;
    const bottlenecks = summary.bottlenecks.length;
    
    return `Session terminated (${reason}) at ${percent}% progress with ${bottlenecks} bottleneck(s). Trace: ${summary.traceRef}`;
  }

  private calculateBottleneckSeverity(bottlenecks: Bottleneck[]): number {
    const weights = {
      policy_violation: 5,
      critical_error: 5,
      state_corruption: 4,
      tool_failure: 3,
      timeout: 3,
      missing_dependency: 3,
      ambiguous_goal: 4,
      resource_limit: 2,
      external_error: 2,
      invalid_input: 2,
      concurrency_issue: 3,
    };

    let totalSeverity = 0;
    for (const b of bottlenecks) {
      const weight = weights[b.type] ?? 2;
      const recoverableMultiplier = b.recoverable ? 0.5 : 1.0;
      totalSeverity += weight * recoverableMultiplier;
    }

    return Math.min(5, Math.round(totalSeverity));
  }

  private generateSummaryId(): string {
    const timestamp = Date.now().toString(36);
    const random = Math.random().toString(36).slice(2, 8);
    return `sum_${timestamp}_${random}`;
  }

  private async persistSummary(summary: ProgressSummary): Promise<string> {
    try {
      const pool = await this.getPoolConnection();

      const query = `
        INSERT INTO ${this.config.summaryTable} (
          id,
          group_id,
          session_id,
          generated_at,
          goal,
          progress,
          bottlenecks,
          attempted_steps,
          stuck_patterns,
          partial_results,
          termination,
          recommendations,
          trace_ref
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
        RETURNING id
      `;

      const sessionIdStr = `${summary.sessionId.groupId}:${summary.sessionId.agentId}:${summary.sessionId.sessionId}`;

      await pool.query(query, [
        summary.id,
        summary.groupId,
        sessionIdStr,
        summary.generatedAt,
        JSON.stringify(summary.goal),
        JSON.stringify(summary.progress),
        JSON.stringify(summary.bottlenecks),
        JSON.stringify(summary.attemptedSteps),
        JSON.stringify(summary.stuckPatterns),
        JSON.stringify(summary.partialResults),
        JSON.stringify(summary.termination),
        JSON.stringify(summary.recommendations),
        summary.traceRef,
      ]);

      return this.formatTraceRef(summary.id);
    } catch (error) {
      console.error("[SummaryGenerator] Failed to persist summary:", error);
      // Return in-memory reference as fallback
      return this.formatTraceRef(summary.id);
    }
  }

  private formatTraceRef(id: string): string {
    return `termination_summaries:${id}`;
  }

  private async getPoolConnection(): Promise<Pool> {
    if (!this.pool) {
      this.pool = getPool();
    }
    return this.pool;
  }

  private async loadSummary(summaryId: string): Promise<ProgressSummary | null> {
    try {
      const pool = await this.getPoolConnection();

      const query = `
        SELECT * FROM ${this.config.summaryTable} WHERE id = $1
      `;

      const result = await pool.query(query, [summaryId]);

      if (result.rows.length === 0) {
        return null;
      }

      const row = result.rows[0];
      return this.rowToSummary(row);
    } catch (error) {
      console.error("[SummaryGenerator] Failed to load summary:", error);
      return null;
    }
  }

  private async loadSummariesByGroup(groupId: string, limit: number): Promise<ProgressSummary[]> {
    try {
      const pool = await this.getPoolConnection();

      const query = `
        SELECT * FROM ${this.config.summaryTable}
        WHERE group_id = $1
        ORDER BY generated_at DESC
        LIMIT $2
      `;

      const result = await pool.query(query, [groupId, limit]);

      return result.rows.map(row => this.rowToSummary(row));
    } catch (error) {
      console.error("[SummaryGenerator] Failed to load summaries:", error);
      return [];
    }
  }

  private rowToSummary(row: Record<string, unknown>): ProgressSummary {
    const sessionIdParts = (row.session_id as string).split(":");
    
    return {
      id: row.id as string,
      sessionId: {
        groupId: sessionIdParts[0] ?? "",
        agentId: sessionIdParts[1] ?? "",
        sessionId: sessionIdParts[2] ?? "",
      },
      generatedAt: row.generated_at as Date,
      goal: row.goal as ProgressSummary["goal"],
      progress: row.progress as ProgressSummary["progress"],
      bottlenecks: (row.bottlenecks as Bottleneck[]) ?? [],
      attemptedSteps: (row.attempted_steps as AttemptedStep[]) ?? [],
      stuckPatterns: (row.stuck_patterns as StuckPattern[]) ?? [],
      partialResults: (row.partial_results as PartialResult[]) ?? [],
      termination: row.termination as ProgressSummary["termination"],
      recommendations: (row.recommendations as string[]) ?? [],
      traceRef: row.trace_ref as string,
      groupId: row.group_id as string,
    };
  }
}

/**
 * Create a summary generator instance
 */
export function createSummaryGenerator(config?: Partial<SummaryGeneratorConfig>): SummaryGenerator {
  return new SummaryGenerator(config);
}