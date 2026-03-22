/**
 * Self-Corrector - Error Recovery and Plan Modification
 * Story 3.4: Execute Iterative Ralph Development Loops
 * 
 * AC 3: Given setbacks occur during execution, when errors happen,
 * then the agent self-corrects and retries with modified approach.
 */

import type {
  RalphError,
  ErrorClassification,
  CorrectionStrategy,
  CorrectionDecision,
  RalphPlan,
  PlanStep,
  BackoffStrategy,
  Perception,
  RalphState,
  StuckPattern,
  AdaptationDecision,
} from "./types";
import {
  classifyError,
  isRecoverableError,
  DEFAULT_BACKOFF_STRATEGY,
} from "./types";

/**
 * Self-Corrector configuration
 */
export interface SelfCorrectorConfig {
  maxRetries: number;
  backoffStrategy: BackoffStrategy;
  enablePlanModification: boolean;
  enableInputModification: boolean;
  enableContextModification: boolean;
  stuckPatternThresholds: {
    repeatedErrorCount: number;
    noProgressSteps: number;
    oscillationWindow: number;
    diminishingReturnThreshold: number;
  };
  onCorrection?: (decision: CorrectionDecision) => void;
  onErrorClassified?: (error: RalphError, classification: ErrorClassification) => void;
}

/**
 * Error analysis result with suggested strategy
 */
export interface ErrorAnalysis {
  classification: ErrorClassification;
  recoverable: boolean;
  rootCause: string;
  suggestedStrategy: CorrectionStrategy;
  modifications?: {
    input?: Record<string, unknown>;
    context?: Record<string, unknown>;
    plan?: string;
  };
  confidence: number;
}

/**
 * Self-Corrector class
 * Handles error classification, root cause analysis, and plan modification
 */
export class SelfCorrector {
  private config: SelfCorrectorConfig;
  private errorHistory: RalphError[] = [];
  private correctionHistory: CorrectionDecision[] = [];

  constructor(config: Partial<SelfCorrectorConfig> = {}) {
    this.config = {
      maxRetries: config.maxRetries ?? 3,
      backoffStrategy: config.backoffStrategy ?? DEFAULT_BACKOFF_STRATEGY,
      enablePlanModification: config.enablePlanModification ?? true,
      enableInputModification: config.enableInputModification ?? true,
      enableContextModification: config.enableContextModification ?? true,
      stuckPatternThresholds: config.stuckPatternThresholds ?? {
        repeatedErrorCount: 3,
        noProgressSteps: 5,
        oscillationWindow: 10,
        diminishingReturnThreshold: 0.1,
      },
      onCorrection: config.onCorrection,
      onErrorClassified: config.onErrorClassified,
    };
  }

  /**
   * Analyze an error and determine correction strategy
   * AC 3: Self-correct and retry with modified approach
   */
  async analyzeError(
    error: unknown,
    step: number,
    retryCount: number,
    context?: Record<string, unknown>,
  ): Promise<ErrorAnalysis> {
    const ralphError = this.classifyError(error, step, retryCount, context);
    this.errorHistory.push(ralphError);

    if (this.config.onErrorClassified) {
      this.config.onErrorClassified(ralphError, ralphError.classification);
    }

    const rootCause = this.identifyRootCause(ralphError);
    const suggestedStrategy = this.selectStrategy(ralphError, retryCount);
    const modifications = this.generateModifications(ralphError, suggestedStrategy);

    return {
      classification: ralphError.classification,
      recoverable: ralphError.recoverable,
      rootCause,
      suggestedStrategy,
      modifications,
      confidence: this.calculateConfidence(ralphError, retryCount),
    };
  }

  /**
   * Make a correction decision based on error analysis
   */
  async decide(
    error: unknown,
    step: number,
    retryCount: number,
    previousPlan: RalphPlan,
    context?: Record<string, unknown>,
  ): Promise<CorrectionDecision> {
    const analysis = await this.analyzeError(error, step, retryCount, context);

    if (!analysis.recoverable && analysis.suggestedStrategy !== "escalate") {
      return {
        strategy: "abort",
        reason: `Non-recoverable error: ${analysis.rootCause}`,
      };
    }

    if (retryCount >= this.config.maxRetries) {
      return {
        strategy: "escalate",
        reason: `Max retries (${this.config.maxRetries}) exceeded for error: ${analysis.rootCause}`,
      };
    }

    const decision: CorrectionDecision = {
      strategy: analysis.suggestedStrategy,
      reason: analysis.rootCause,
      modifications: analysis.modifications,
      backoffMs: this.calculateBackoff(retryCount),
      maxRetries: this.config.maxRetries - retryCount,
    };

    // Modify plan if strategy requires it
    if (analysis.suggestedStrategy === "simplify_plan" || analysis.suggestedStrategy === "try_alternative") {
      decision.modifications = decision.modifications ?? {};
      decision.modifications.plan = this.modifyPlan(previousPlan, analysis);
    }

    this.correctionHistory.push(decision);

    if (this.config.onCorrection) {
      this.config.onCorrection(decision);
    }

    return decision;
  }

  /**
   * Detect stuck patterns from state history
   */
  detectStuckPatterns(state: RalphState): StuckPattern[] {
    const patterns: StuckPattern[] = [];
    const errors = state.errors;

    // Check for repeated error pattern
    const repeatedErrors = this.findRepeatedErrors(errors);
    if (repeatedErrors) {
      patterns.push(repeatedErrors);
    }

    // Check for no progress pattern
    const noProgress = this.findNoProgressPattern(state);
    if (noProgress) {
      patterns.push(noProgress);
    }

    // Check for oscillation pattern
    const oscillation = this.findOscillationPattern(state);
    if (oscillation) {
      patterns.push(oscillation);
    }

    // Check for diminishing returns
    const diminishingReturns = this.findDiminishingReturns(state);
    if (diminishingReturns) {
      patterns.push(diminishingReturns);
    }

    return patterns;
  }

  /**
   * Generate adapted plan based on stuck patterns
   */
  generateAdaptation(
    state: RalphState,
    perception: Perception,
  ): AdaptationDecision {
    const stuckPatterns = this.detectStuckPatterns(state);

    if (stuckPatterns.length === 0) {
      return {
        continue: true,
        reason: "No stuck patterns detected, continuing execution",
        nextPhase: "perceive",
      };
    }

    // Find highest severity pattern
    const highestSeverity = stuckPatterns.reduce<StuckPattern>((max, p) => 
      p.severity > max.severity ? p : max,
    { severity: 0, type: "no_progress", description: "", detectedAt: new Date(), affectedIterations: [] });

    if (highestSeverity.severity >= 4) {
      return {
        continue: false,
        reason: `High severity stuck pattern detected: ${highestSeverity.description}`,
        haltReason: { type: "critical_error", error: highestSeverity.description },
        nextPhase: "adapt",
      };
    }

    // Generate modified plan
    const modifiedPlan = this.generateAlternativePlan(state.plan, stuckPatterns);

    return {
      continue: true,
      reason: `Adapting plan due to: ${highestSeverity.description}`,
      modifiedPlan,
      nextPhase: "plan",
    };
  }

  // Private methods

  /**
   * Classify an error and create RalphError
   */
  private classifyError(
    error: unknown,
    step: number,
    retryCount: number,
    context?: Record<string, unknown>,
  ): RalphError {
    const err = error instanceof Error ? error : new Error(String(error));
    const classification = classifyError(err);
    const recoverable = isRecoverableError(err);

    return {
      step,
      timestamp: new Date(),
      classification,
      message: err.message,
      stack: err.stack,
      recoverable,
      retryCount,
      originalError: err,
      context,
    };
  }

  /**
   * Identify root cause from error
   */
  private identifyRootCause(error: RalphError): string {
    const classificationToRootCause: Record<ErrorClassification, string> = {
      transient: "Temporary failure, likely recoverable with retry",
      resource_exhausted: "System resources or rate limits exhausted",
      policy_denied: "Operation blocked by policy gateway",
      budget_exceeded: "Operation exceeded budget limits",
      invalid_input: "Invalid input provided to operation",
      dependency_error: "External dependency or service unavailable",
      timeout: "Operation timed out",
      unknown_error: "Unknown error occurred",
      critical_error: "Critical failure requiring immediate attention",
    };

    return classificationToRootCause[error.classification] ?? error.message;
  }

  /**
   * Select correction strategy based on error classification
   */
  private selectStrategy(error: RalphError, retryCount: number): CorrectionStrategy {
    if (retryCount >= this.config.maxRetries) {
      return "escalate";
    }

    const strategyMap: Record<ErrorClassification, CorrectionStrategy> = {
      transient: "retry_with_backoff",
      resource_exhausted: "retry_with_backoff",
      policy_denied: "try_alternative",
      budget_exceeded: "escalate",
      invalid_input: "modify_input",
      dependency_error: "retry_with_backoff",
      timeout: "retry_with_backoff",
      unknown_error: "retry_same",
      critical_error: "abort",
    };

    return strategyMap[error.classification] ?? "retry_same";
  }

  /**
   * Generate modifications based on strategy
   */
  private generateModifications(
    error: RalphError,
    strategy: CorrectionStrategy,
  ): CorrectionDecision["modifications"] {
    if (!this.config.enableInputModification && !this.config.enablePlanModification) {
      return undefined;
    }

    const modifications: {
      input?: Record<string, unknown>;
      context?: Record<string, unknown>;
      plan?: string;
    } = {};

    switch (strategy) {
      case "modify_input":
        if (this.config.enableInputModification && error.context?.input) {
          modifications.input = this.modifyInput(error.context.input as Record<string, unknown>, error);
        }
        break;

      case "try_alternative":
      case "simplify_plan":
        if (this.config.enablePlanModification) {
          modifications.context = { alternativeApproach: true };
        }
        break;

      case "retry_with_backoff":
        modifications.context = { backoffApplied: true };
        break;
    }

    return Object.keys(modifications).length > 0 ? modifications : undefined;
  }

  /**
   * Calculate backoff delay
   */
  private calculateBackoff(retryCount: number): number {
    const { type, initialDelayMs, maxDelayMs, multiplier, jitterMs } = this.config.backoffStrategy;

    let delay: number;

    switch (type) {
      case "exponential":
        delay = initialDelayMs * Math.pow(multiplier, retryCount);
        break;
      case "linear":
        delay = initialDelayMs + (initialDelayMs * retryCount);
        break;
      case "constant":
      default:
        delay = initialDelayMs;
        break;
    }

    // Apply max cap
    delay = Math.min(delay, maxDelayMs);

    // Add jitter
    if (jitterMs > 0) {
      delay += Math.random() * jitterMs;
    }

    return Math.floor(delay);
  }

  /**
   * Calculate confidence in correction
   */
  private calculateConfidence(error: RalphError, retryCount: number): number {
    const baseConfidence = error.recoverable ? 0.7 : 0.3;
    const retryPenalty = retryCount * 0.1;
    return Math.max(0, Math.min(1, baseConfidence - retryPenalty));
  }

  /**
   * Modify input based on error
   */
  private modifyInput(input: Record<string, unknown>, error: RalphError): Record<string, unknown> {
    const modified = { ...input };

    // Simple modification strategies based on error type
    if (error.classification === "invalid_input") {
      // Try to sanitize or modify input
      for (const [key, value] of Object.entries(input)) {
        if (typeof value === "string") {
          modified[key] = value.trim();
        }
        if (value === null || value === undefined) {
          delete modified[key];
        }
      }
    }

    return modified;
  }

  /**
   * Modify plan based on error analysis
   */
  private modifyPlan(plan: RalphPlan, analysis: ErrorAnalysis): string {
    const currentSteps = plan.steps.length;
    const simplifiedStepCount = Math.max(1, Math.floor(currentSteps / 2));

    plan.modificationCount++;

    return `Simplified plan (iteration ${plan.modificationCount}): Reduced from ${currentSteps} to ${simplifiedStepCount} steps. Root cause: ${analysis.rootCause}`;
  }

  /**
   * Generate alternative plan based on stuck patterns
   */
  private generateAlternativePlan(plan: RalphPlan, patterns: StuckPattern[]): RalphPlan {
    const alternativeSteps: PlanStep[] = [];

    for (const step of plan.steps) {
      // Keep the step but add rollback strategy
      alternativeSteps.push({
        ...step,
        rollbackStrategy: step.rollbackStrategy ?? "Revert to previous state and try alternative approach",
      });
    }

    // Add adaptation note
    const patternDescriptions = patterns.map(p => p.description).join("; ");

    return {
      ...plan,
      steps: alternativeSteps,
      description: `Adapted plan based on stuck patterns: ${patternDescriptions}`,
      risks: [...plan.risks, `Potential stuck pattern: ${patternDescriptions}`],
      modificationCount: plan.modificationCount + 1,
    };
  }

  /**
   * Find repeated error pattern
   */
  private findRepeatedErrors(errors: RalphError[]): StuckPattern | null {
    if (errors.length < this.config.stuckPatternThresholds.repeatedErrorCount) {
      return null;
    }

    const recentErrors = errors.slice(-this.config.stuckPatternThresholds.repeatedErrorCount);
    const classifications = recentErrors.map(e => e.classification);
    const unique = new Set(classifications);

    if (unique.size === 1) {
      return {
        type: "repeated_error",
        description: `Repeated ${classifications[0]} errors (${recentErrors.length} times)`,
        detectedAt: new Date(),
        affectedIterations: recentErrors.map(e => e.step),
        severity: Math.min(5, recentErrors.length),
      };
    }

    return null;
  }

  /**
   * Find no progress pattern
   */
  private findNoProgressPattern(state: RalphState): StuckPattern | null {
    const steps = state.steps;
    const threshold = this.config.stuckPatternThresholds.noProgressSteps;

    if (steps.length < threshold) {
      return null;
    }

    const recentSteps = steps.slice(-threshold);
    const hasProgress = recentSteps.some(s => s.output !== undefined && s.error === undefined);

    if (!hasProgress) {
      return {
        type: "no_progress",
        description: `No progress in last ${threshold} steps`,
        detectedAt: new Date(),
        affectedIterations: recentSteps.map(s => s.iteration),
        severity: 3,
      };
    }

    return null;
  }

  /**
   * Find oscillation pattern
   */
  private findOscillationPattern(state: RalphState): StuckPattern | null {
    const steps = state.steps;
    const window = this.config.stuckPatternThresholds.oscillationWindow;

    if (steps.length < window) {
      return null;
    }

    const recentPhases = steps.slice(-window).map(s => s.phase);
    const phaseChanges = recentPhases.filter((p, i) => i > 0 && p !== recentPhases[i - 1]).length;

    if (phaseChanges >= window / 2) {
      return {
        type: "oscillation",
        description: `Oscillating between phases (${phaseChanges} changes in ${window} steps)`,
        detectedAt: new Date(),
        affectedIterations: steps.slice(-window).map(s => s.iteration),
        severity: 3,
      };
    }

    return null;
  }

  /**
   * Find diminishing returns pattern
   */
  private findDiminishingReturns(state: RalphState): StuckPattern | null {
    const threshold = this.config.stuckPatternThresholds.diminishingReturnThreshold;
    const errors = state.errors;

    if (errors.length < 3) {
      return null;
    }

    const recentErrorRates = errors.slice(-5).map((_, i, arr) => {
      const slice = arr.slice(0, i + 1);
      return slice.length / (state.currentIteration || 1);
    });

    const increasingRate = recentErrorRates.every((rate, i) => 
      i === 0 || rate >= recentErrorRates[i - 1] - threshold,
    );

    if (increasingRate && recentErrorRates[recentErrorRates.length - 1] > 0.5) {
      return {
        type: "diminishing_returns",
        description: "Error rate increasing, showing diminishing returns",
        detectedAt: new Date(),
        affectedIterations: errors.slice(-5).map(e => e.step),
        severity: 4,
      };
    }

    return null;
  }

  /**
   * Get error history
   */
  getErrorHistory(): RalphError[] {
    return [...this.errorHistory];
  }

  /**
   * Get correction history
   */
  getCorrectionHistory(): CorrectionDecision[] {
    return [...this.correctionHistory];
  }

  /**
   * Clear histories
   */
  clearHistories(): void {
    this.errorHistory = [];
    this.correctionHistory = [];
  }
}

/**
 * Create a self-corrector instance
 */
export function createSelfCorrector(config?: Partial<SelfCorrectorConfig>): SelfCorrector {
  return new SelfCorrector(config);
}

/**
 * Default self-corrector instance
 */
export const defaultSelfCorrector = createSelfCorrector();