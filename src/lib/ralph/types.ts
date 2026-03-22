/**
 * Ralph Loop Type Definitions
 * Story 3.4: Execute Iterative Ralph Development Loops
 * 
 * The "Ralph Wiggum" pattern is about persistence despite setbacks.
 * This module defines types for self-referential loops with completion promises.
 */

import type { HaltReason, SessionId } from "../budget/types";

/**
 * Completion promise type
 * Can be a string to match exactly or a function that evaluates completion
 */
export type CompletionPromise<T = unknown> = 
  | string 
  | { type: "exact"; value: string }
  | { type: "regex"; pattern: string | RegExp }
  | { type: "condition"; check: (output: T, iteration: number) => boolean }
  | { type: "multi"; promises: CompletionPromise<T>[] };

/**
 * Error classification for Ralph loops
 */
export type ErrorClassification = 
  | "transient"
  | "resource_exhausted"
  | "policy_denied"
  | "budget_exceeded"
  | "invalid_input"
  | "dependency_error"
  | "timeout"
  | "unknown_error"
  | "critical_error";

/**
 * Correction strategy type
 */
export type CorrectionStrategy = 
  | "retry_same"
  | "retry_with_backoff"
  | "modify_input"
  | "try_alternative"
  | "simplify_plan"
  | "escalate"
  | "abort";

/**
 * Error record for Ralph loop history
 */
export interface RalphError {
  step: number;
  timestamp: Date;
  classification: ErrorClassification;
  message: string;
  stack?: string;
  recoverable: boolean;
  retryCount: number;
  originalError?: Error;
  context?: Record<string, unknown>;
}

/**
 * Correction decision
 */
export interface CorrectionDecision {
  strategy: CorrectionStrategy;
  reason: string;
  modifications?: {
    input?: Record<string, unknown>;
    context?: Record<string, unknown>;
    plan?: string;
  };
  backoffMs?: number;
  maxRetries?: number;
}

/**
 * Ralph loop phase
 */
export type RalphPhase = "perceive" | "plan" | "act" | "check" | "adapt";

/**
 * Step in the Ralph loop
 */
export interface RalphStep<TInput = unknown, TOutput = unknown> {
  iteration: number;
  phase: RalphPhase;
  input: TInput;
  output?: TOutput;
  error?: RalphError;
  timestamp: Date;
  durationMs: number;
  corrections: CorrectionDecision[];
  metadata?: Record<string, unknown>;
}

/**
 * Plan generated during the Plan phase
 */
export interface RalphPlan {
  description: string;
  steps: PlanStep[];
  estimatedIterations: number;
  successCriteria: string[];
  risks: string[];
  modificationCount: number;
}

/**
 * Individual plan step
 */
export interface PlanStep {
  order: number;
  action: string;
  tool?: string;
  expectedOutcome: string;
  rollbackStrategy?: string;
}

/**
 * Perception data gathered during Perceive phase
 */
export interface Perception<TContext = unknown> {
  timestamp: Date;
  context: TContext;
  history: RalphStep[];
  currentError?: RalphError;
  budgetStatus: {
    tokensUsed: number;
    toolCallsUsed: number;
    timeElapsedMs: number;
    costUsedUsd: number;
    stepsCompleted: number;
    budgetRemaining: number;
  };
  stuckPatterns: StuckPattern[];
  lastSuccessfulOutput?: unknown;
}

/**
 * Stuck pattern detected in the loop
 */
export interface StuckPattern {
  type: "repeated_error" | "no_progress" | "oscillation" | "diminishing_returns";
  description: string;
  detectedAt: Date;
  affectedIterations: number[];
  severity: number;
}

/**
 * Adaptation decision from Adapt phase
 */
export interface AdaptationDecision {
  continue: boolean;
  reason: string;
  modifiedPlan?: RalphPlan;
  modifiedInput?: Record<string, unknown>;
  nextPhase: RalphPhase;
  haltReason?: HaltReason;
}

/**
 * Ralph loop configuration
 */
export interface RalphConfig {
  maxIterations: number;
  completionPromise: CompletionPromise;
  initialPlan?: RalphPlan;
  onProgress?: (step: RalphStep) => void;
  onError?: (error: RalphError) => void;
  onCompletion?: (output: unknown, iterations: number) => void;
  onHalt?: (reason: HaltReason) => void;
  enableSelfCorrection: boolean;
  errorClassificationEnabled: boolean;
  backoffStrategy: BackoffStrategy;
  stuckDetectionEnabled: boolean;
  stuckThresholds: {
    repeatedErrorCount: number;
    noProgressSteps: number;
    oscillationWindow: number;
    diminishingReturnThreshold: number;
  };
}

/**
 * Backoff strategy configuration
 */
export interface BackoffStrategy {
  type: "exponential" | "linear" | "constant";
  initialDelayMs: number;
  maxDelayMs: number;
  multiplier: number;
  jitterMs: number;
}

/**
 * Ralph loop state
 */
export interface RalphState<TInput = unknown, TOutput = unknown> {
  sessionId: SessionId;
  startedAt: Date;
  currentIteration: number;
  currentPhase: RalphPhase;
  plan: RalphPlan;
  input: TInput;
  output?: TOutput;
  steps: RalphStep[];
  errors: RalphError[];
  corrections: CorrectionDecision[];
  completionPromise: CompletionPromise;
  halted: boolean;
  haltReason?: HaltReason;
  completed: boolean;
  iterationsUsed: number;
}

/**
 * Ralph loop result
 */
export interface RalphResult<TOutput = unknown> {
  success: boolean;
  output?: TOutput;
  iterations: number;
  totalDurationMs: number;
  errors: RalphError[];
  corrections: CorrectionDecision[];
  steps: RalphStep[];
  haltReason?: HaltReason;
  completionPromiseMet: boolean;
  finalPlan: RalphPlan;
}

/**
 * Perceive function type
 */
export type PerceiveFunction<TContext = unknown> = (
  state: RalphState,
  context?: TContext,
) => Promise<Perception>;

/**
 * Plan function type
 */
export type PlanFunction<TInput = unknown> = (
  perception: Perception,
  previousPlan?: RalphPlan,
) => Promise<RalphPlan>;

/**
 * Act function type  
 */
export type ActFunction<TInput = unknown, TOutput = unknown> = (
  input: TInput,
  plan: RalphPlan,
  iteration: number,
) => Promise<TOutput>;

/**
 * Check function type
 */
export type CheckFunction<TOutput = unknown> = (
  output: TOutput,
  promise: CompletionPromise,
  iteration: number,
) => Promise<boolean>;

/**
 * Adapt function type
 */
export type AdaptFunction<TContext = unknown> = (
  state: RalphState,
  perception: Perception,
  checkResult: boolean,
) => Promise<AdaptationDecision>;

/**
 * Full Ralph loop callback set
 */
export interface RalphCallbacks<TContext = unknown> {
  perceive?: PerceiveFunction<TContext>;
  plan?: PlanFunction;
  act?: ActFunction;
  check?: CheckFunction;
  adapt?: AdaptFunction<TContext>;
  onProgress?: (step: RalphStep) => void;
  onError?: (error: RalphError) => void;
  onCorrection?: (decision: CorrectionDecision) => void;
  onCompletion?: (output: unknown, iterations: number) => void;
  onHalt?: (reason: HaltReason) => void;
}

/**
 * Default Ralph configuration
 */
export const DEFAULT_RALPH_CONFIG: Partial<RalphConfig> = {
  maxIterations: 50,
  enableSelfCorrection: true,
  errorClassificationEnabled: true,
  backoffStrategy: {
    type: "exponential",
    initialDelayMs: 1000,
    maxDelayMs: 60000,
    multiplier: 2,
    jitterMs: 100,
  },
  stuckDetectionEnabled: true,
  stuckThresholds: {
    repeatedErrorCount: 3,
    noProgressSteps: 5,
    oscillationWindow: 10,
    diminishingReturnThreshold: 0.1,
  },
};

/**
 * Default backoff strategy
 */
export const DEFAULT_BACKOFF_STRATEGY: BackoffStrategy = {
  type: "exponential",
  initialDelayMs: 1000,
  maxDelayMs: 60000,
  multiplier: 2,
  jitterMs: 100,
};

/**
 * Ralph loop status for monitoring
 */
export interface RalphStatus {
  isRunning: boolean;
  currentIteration: number;
  currentPhase: RalphPhase;
  errorsCount: number;
  correctionsCount: number;
  elapsedMs: number;
  estimatedRemainingMs?: number;
  lastError?: RalphError;
  lastCorrection?: CorrectionDecision;
}

/**
 * Create default perception
 */
export function createEmptyPerception<TContext = unknown>(
  context?: TContext,
): Perception {
  return {
    timestamp: new Date(),
    context: context as TContext,
    history: [],
    budgetStatus: {
      tokensUsed: 0,
      toolCallsUsed: 0,
      timeElapsedMs: 0,
      costUsedUsd: 0,
      stepsCompleted: 0,
      budgetRemaining: 0,
    },
    stuckPatterns: [],
  };
}

/**
 * Create empty Ralph state
 */
export function createInitialRalphState<TInput = unknown, TOutput = unknown>(
  sessionId: SessionId,
  input: TInput,
  completionPromise: CompletionPromise,
  initialPlan?: RalphPlan,
): RalphState {
  const plan: RalphPlan = initialPlan ?? {
    description: "Initial plan - to be refined",
    steps: [],
    estimatedIterations: 10,
    successCriteria: [],
    risks: [],
    modificationCount: 0,
  };

  return {
    sessionId,
    startedAt: new Date(),
    currentIteration: 0,
    currentPhase: "perceive",
    plan,
    input,
    steps: [],
    errors: [],
    corrections: [],
    completionPromise,
    halted: false,
    completed: false,
    iterationsUsed: 0,
  };
}

/**
 * Create Ralph error from error object
 */
export function createRalphError(
  step: number,
  error: unknown,
  retryCount: number = 0,
  context?: Record<string, unknown>,
): RalphError {
  const err = error instanceof Error ? error : new Error(String(error));
  
  return {
    step,
    timestamp: new Date(),
    classification: classifyError(err),
    message: err.message,
    stack: err.stack,
    recoverable: isRecoverableError(err),
    retryCount,
    originalError: err,
    context,
  };
}

/**
 * Classify an error type
 */
export function classifyError(error: Error): ErrorClassification {
  const message = error.message.toLowerCase();
  const name = error.name?.toLowerCase() ?? "";

  if (message.includes("timeout") || name.includes("timeout")) {
    return "timeout";
  }
  if (message.includes("rate limit") || message.includes("quota")) {
    return "resource_exhausted";
  }
  if (message.includes("unauthorized") || message.includes("forbidden") || message.includes("denied")) {
    return "policy_denied";
  }
  if (message.includes("budget") || message.includes("limit exceeded")) {
    return "budget_exceeded";
  }
  if (message.includes("invalid") || message.includes("validation")) {
    return "invalid_input";
  }
  if (message.includes("dependency") || message.includes("connection") || message.includes("network")) {
    return "dependency_error";
  }
  if (message.includes("critical") || message.includes("fatal")) {
    return "critical_error";
  }
  if (message.includes("transient") || message.includes("temporary") || message.includes("retry")) {
    return "transient";
  }
  
  return "unknown_error";
}

/**
 * Determine if an error is recoverable
 */
export function isRecoverableError(error: Error): boolean {
  const classification = classifyError(error);
  
  switch (classification) {
    case "transient":
    case "timeout":
    case "dependency_error":
    case "resource_exhausted":
      return true;
    case "policy_denied":
    case "budget_exceeded":
    case "critical_error":
      return false;
    case "invalid_input":
      return true;
    case "unknown_error":
      return false;
    default:
      return false;
  }
}