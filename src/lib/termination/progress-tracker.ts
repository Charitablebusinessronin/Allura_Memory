/**
 * Progress Tracker - Execution History and Pattern Detection
 * Story 3.3: Implement Fail-Safe Termination and Escalation
 */

import type {
  ProgressTrackerConfig,
  AttemptedStep,
  StuckPattern,
  Bottleneck,
  PartialResult,
  StepOutcome,
} from "./types";
import { DEFAULT_PROGRESS_TRACKER_CONFIG } from "./types";
import type { SessionId, ReasoningStep, ToolCallRecord } from "../budget/types";

/**
 * Action pattern for stuck detection
 */
interface ActionPattern {
  action: string;
  count: number;
  lastSeen: number;
  steps: number[];
}

/**
 * Progress delta tracking
 */
interface ProgressDelta {
  step: number;
  timestamp: Date;
  metricName: string;
  previousValue: number;
  newValue: number;
}

/**
 * Progress Tracker - Captures execution history and detects stuck patterns
 */
export class ProgressTracker {
  private config: ProgressTrackerConfig;
  private steps: AttemptedStep[] = [];
  private stuckPatterns: StuckPattern[] = [];
  private partialResults: PartialResult[] = [];
  private actionPatterns: Map<string, ActionPattern> = new Map();
  private progressDeltas: ProgressDelta[] = [];
  private goalDescription: string = "";
  private goalType: string = "";
  private successCriteria: string[] = [];
  private constraints: string[] = [];
  private sessionId: SessionId | null = null;

  constructor(config?: Partial<ProgressTrackerConfig>) {
    this.config = { ...DEFAULT_PROGRESS_TRACKER_CONFIG, ...config };
  }

  /**
   * Initialize tracking for a session
   */
  initialize(sessionId: SessionId, goal: {
    description: string;
    type: string;
    successCriteria?: string[];
    constraints?: string[];
  }): void {
    this.sessionId = sessionId;
    this.goalDescription = goal.description;
    this.goalType = goal.type;
    this.successCriteria = goal.successCriteria ?? [];
    this.constraints = goal.constraints ?? [];
    this.steps = [];
    this.stuckPatterns = [];
    this.partialResults = [];
    this.actionPatterns = new Map();
    this.progressDeltas = [];
  }

  /**
   * Record a step attempt
   */
  recordStep(step: Omit<AttemptedStep, "step" | "startedAt" | "completedAt" | "durationMs">): void {
    const now = new Date();
    const stepNumber = this.steps.length + 1;
    const startTime = this.steps.length > 0
      ? this.steps[this.steps.length - 1].completedAt ?? now
      : now;

    const attemptedStep: AttemptedStep = {
      ...step,
      step: stepNumber,
      startedAt: startTime,
      completedAt: now,
      durationMs: now.getTime() - startTime.getTime(),
    };

    this.steps.push(attemptedStep);

    // Track action pattern for stuck detection
    this.trackActionPattern(step.action, stepNumber);

    // Check for stuck patterns if enabled
    if (this.config.enableStuckDetection) {
      this.detectStuckPatterns();
    }

    // Limit history
    if (this.steps.length > this.config.maxStepHistory) {
      this.steps = this.steps.slice(-this.config.maxStepHistory);
    }
  }

  /**
   * Record a partial result
   */
  recordPartialResult(result: Omit<PartialResult, "id" | "createdAt">): void {
    this.partialResults.push({
      ...result,
      id: this.generateId(),
      createdAt: new Date(),
    });
  }

  /**
   * Record progress delta
   */
  recordProgressDelta(metricName: string, previousValue: number, newValue: number): void {
    this.progressDeltas.push({
      step: this.steps.length,
      timestamp: new Date(),
      metricName,
      previousValue,
      newValue,
    });
  }

  /**
   * Convert tool call records to attempted steps
   */
  importToolCallHistory(toolCalls: ToolCallRecord[]): void {
    for (const call of toolCalls) {
      const outcome: StepOutcome = call.success ? "success" : "failure";
      this.recordStep({
        action: `tool:${call.toolName}`,
        tool: call.toolName,
        input: call.input,
        result: call.output,
        outcome,
        retryable: !call.success,
        errorMessage: call.error,
      });
    }
  }

  /**
   * Import reasoning history for context
   */
  importReasoningHistory(reasoning: ReasoningStep[]): void {
    for (const step of reasoning) {
      this.recordStep({
        action: step.decision ?? step.thought.slice(0, 100),
        outcome: "success",
        retryable: false,
      });
    }
  }

  /**
   * Get all attempted steps
   */
  getSteps(): AttemptedStep[] {
    return [...this.steps];
  }

  /**
   * Get detected stuck patterns
   */
  getStuckPatterns(): StuckPattern[] {
    return [...this.stuckPatterns];
  }

  /**
   * Get all partial results
   */
  getPartialResults(): PartialResult[] {
    return [...this.partialResults];
  }

  /**
   * Get goal information
   */
  getGoal(): {
    description: string;
    type: string;
    successCriteria: string[];
    constraints: string[];
  } {
    return {
      description: this.goalDescription,
      type: this.goalType,
      successCriteria: [...this.successCriteria],
      constraints: [...this.constraints],
    };
  }

  /**
   * Check if progress is stuck
   */
  isStuck(): boolean {
    return this.stuckPatterns.some(p => p.severity >= 4);
  }

  /**
   * Get the last N steps
   */
  getLastSteps(count: number): AttemptedStep[] {
    return this.steps.slice(-count);
  }

  /**
   * Get summaries of steps by outcome
   */
  getStepSummaryByOutcome(): Record<StepOutcome, number> {
    const summary: Record<StepOutcome, number> = {
      success: 0,
      partial_success: 0,
      failure: 0,
      blocked: 0,
      timeout: 0,
      policy_denied: 0,
      budget_exceeded: 0,
    };

    for (const step of this.steps) {
      summary[step.outcome]++;
    }

    return summary;
  }

  /**
   * Get bottlenecks from the execution history
   */
  identifyBottlenecks(): Bottleneck[] {
    const bottlenecks: Bottleneck[] = [];

    // Analyze failed steps
    const failures = this.steps.filter(s => s.outcome === "failure");
    const failureByTool: Record<string, number> = {};

    for (const failure of failures) {
      if (failure.tool) {
        failureByTool[failure.tool] = (failureByTool[failure.tool] ?? 0) + 1;
      }
    }

    // Tools with high failure rates are bottlenecks
    for (const [tool, count] of Object.entries(failureByTool)) {
      if (count >= 2) {
        bottlenecks.push({
          type: "tool_failure",
          affected: tool,
          description: `Tool '${tool}' failed ${count} times during execution`,
          step: failures.find(f => f.tool === tool)?.step ?? 0,
          timestamp: new Date(),
          recoverable: true,
          resolution: `Review ${tool} tool usage and implement retry logic`,
        });
      }
    }

    // Check for policy denials as bottlenecks
    const policyDenials = this.steps.filter(s => s.outcome === "policy_denied");
    if (policyDenials.length > 0) {
      bottlenecks.push({
        type: "policy_violation",
        affected: "policy_gateway",
        description: `${policyDenials.length} steps were blocked by policy`,
        step: policyDenials[0]?.step ?? 0,
        timestamp: new Date(),
        recoverable: false,
        resolution: "Review policy configuration and adjust constraints",
      });
    }

    // Check for timeouts
    const timeouts = this.steps.filter(s => s.outcome === "timeout");
    if (timeouts.length > 0) {
      bottlenecks.push({
        type: "timeout",
        affected: "execution",
        description: `${timeouts.length} steps timed out`,
        step: timeouts[0]?.step ?? 0,
        timestamp: new Date(),
        recoverable: true,
        resolution: "Increase timeout thresholds or optimize step execution",
      });
    }

    // Add stuck patterns as bottlenecks
    for (const pattern of this.stuckPatterns) {
      if (pattern.severity >= 3) {
        bottlenecks.push({
          type: this.patternToBottleneckType(pattern.type),
          affected: "execution_flow",
          description: pattern.description,
          step: pattern.affectedSteps[0] ?? 0,
          timestamp: pattern.detectedAt,
          recoverable: true,
          resolution: pattern.suggestedResolution,
        });
      }
    }

    return bottlenecks;
  }

  /**
   * Get current execution state summary
   */
  getExecutionSummary(): {
    totalSteps: number;
    successRate: number;
    averageDurationMs: number;
    lastOutcome: StepOutcome;
    stuckDetected: boolean;
  } {
    const totalSteps = this.steps.length;
    const successCount = this.steps.filter(s => s.outcome === "success").length;
    const totalDuration = this.steps.reduce((sum, s) => sum + s.durationMs, 0);

    return {
      totalSteps,
      successRate: totalSteps > 0 ? successCount / totalSteps : 1,
      averageDurationMs: totalSteps > 0 ? totalDuration / totalSteps : 0,
      lastOutcome: this.steps.length > 0 ? this.steps[this.steps.length - 1].outcome : "success",
      stuckDetected: this.stuckPatterns.length > 0,
    };
  }

  /**
   * Clear tracking state
   */
  reset(): void {
    this.steps = [];
    this.stuckPatterns = [];
    this.partialResults = [];
    this.actionPatterns = new Map();
    this.progressDeltas = [];
    this.sessionId = null;
  }

  // Private methods

  private trackActionPattern(action: string, step: number): void {
    const existing = this.actionPatterns.get(action);
    
    if (existing) {
      existing.count++;
      existing.steps.push(step);
      existing.lastSeen = step;
    } else {
      this.actionPatterns.set(action, {
        action,
        count: 1,
        lastSeen: step,
        steps: [step],
      });
    }
  }

  private detectStuckPatterns(): void {
    const thresholds = this.config.stuckThresholds;

    // Pattern 1: Repeated action
    for (const [action, pattern] of this.actionPatterns) {
      if (pattern.count >= thresholds.repeatedActionCount) {
        const stuckPattern: StuckPattern = {
          type: "repeated_action",
          description: `Action '${action}' was attempted ${pattern.count} times without progress`,
          detectedAt: new Date(),
          affectedSteps: pattern.steps,
          severity: Math.min(5, pattern.count),
          suggestedResolution: `Review why '${action}' keeps failing and consider alternative approaches`,
        };

        // Only add if not already detected
        if (!this.stuckPatterns.some(p => p.type === "repeated_action" && p.description === stuckPattern.description)) {
          this.stuckPatterns.push(stuckPattern);
        }
      }
    }

    // Pattern 2: No progress (failures without success)
    const recentSteps = this.steps.slice(-thresholds.noProgressSteps);
    if (recentSteps.length >= thresholds.noProgressSteps) {
      const allFailures = recentSteps.every(s => s.outcome !== "success");
      
      if (allFailures && !this.stuckPatterns.some(p => p.type === "no_progress")) {
        this.stuckPatterns.push({
          type: "no_progress",
          description: `Last ${thresholds.noProgressSteps} steps all resulted in non-success outcomes`,
          detectedAt: new Date(),
          affectedSteps: recentSteps.map(s => s.step),
          severity: 4,
          suggestedResolution: "Investigate root cause of consecutive failures",
        });
      }
    }

    // Pattern 3: Tool failure loop
    const toolFailures = new Map<string, number>();
    for (const step of this.steps) {
      if (step.outcome === "failure" && step.tool) {
        toolFailures.set(step.tool, (toolFailures.get(step.tool) ?? 0) + 1);
      }
    }

    for (const [tool, count] of toolFailures) {
      if (count >= thresholds.repeatedActionCount) {
        const patternKey = `tool_failure_loop:${tool}`;
        if (!this.stuckPatterns.some(p => p.description.includes(tool))) {
          this.stuckPatterns.push({
            type: "tool_failure_loop",
            description: `Tool '${tool}' has failed ${count} times`,
            detectedAt: new Date(),
            affectedSteps: this.steps.filter(s => s.tool === tool && s.outcome === "failure").map(s => s.step),
            severity: Math.min(5, count),
            suggestedResolution: `Check ${tool} tool configuration and error handling`,
          });
        }
      }
    }

    // Pattern 4: Policy rejection loop
    const policyDenials = this.steps.filter(s => s.outcome === "policy_denied");
    if (policyDenials.length >= 2 && !this.stuckPatterns.some(p => p.type === "policy_rejection_loop")) {
      this.stuckPatterns.push({
        type: "policy_rejection_loop",
        description: `${policyDenials.length} actions were rejected by policy`,
        detectedAt: new Date(),
        affectedSteps: policyDenials.map(s => s.step),
        severity: Math.min(5, policyDenials.length + 2),
        suggestedResolution: "Review policy constraints and action compliance",
      });
    }

    // Pattern 5: Circular reasoning detection
    if (this.config.enableStuckDetection) {
      const recentActions = this.getLastSteps(thresholds.circularReasoningDepth);
      if (recentActions.length === thresholds.circularReasoningDepth) {
        if (this.isCircularReasoning(recentActions)) {
          if (!this.stuckPatterns.some(p => p.type === "circular_reasoning")) {
            this.stuckPatterns.push({
              type: "circular_reasoning",
              description: "Agent appears to be cycling through the same actions",
              detectedAt: new Date(),
              affectedSteps: recentActions.map(s => s.step),
              severity: 4,
              suggestedResolution: "Force alternative reasoning path or reassess goal",
            });
          }
        }
      }
    }
  }

  private isCircularReasoning(steps: AttemptedStep[]): boolean {
    if (steps.length < 2) return false;
    
    // Check if actions are repeating in a cycle
    const actions = steps.map(s => s.action);
    const uniqueActions = new Set(actions);
    
    // If all actions are the same, it's circular
    if (uniqueActions.size === 1) return true;
    
    // Check for simple cycles (A -> B -> A -> B)
    if (steps.length >= 4) {
      const first = actions.slice(0, 2).join(",");
      const second = actions.slice(2, 4).join(",");
      if (first === second) return true;
    }
    
    return false;
  }

  private patternToBottleneckType(patternType: StuckPattern["type"]): Bottleneck["type"] {
    const mapping: Record<StuckPattern["type"], Bottleneck["type"]> = {
      repeated_action: "resource_limit",
      no_progress: "missing_dependency",
      circular_reasoning: "ambiguous_goal",
      tool_failure_loop: "tool_failure",
      policy_rejection_loop: "policy_violation",
    };

    return mapping[patternType] ?? "state_corruption";
  }

  private generateId(): string {
    return `pr_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
  }
}

/**
 * Create a progress tracker instance
 */
export function createProgressTracker(config?: Partial<ProgressTrackerConfig>): ProgressTracker {
  return new ProgressTracker(config);
}