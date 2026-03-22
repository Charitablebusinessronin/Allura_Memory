/**
 * Ralph Loop - Main Orchestrator
 * Story 3.4: Execute Iterative Ralph Development Loops
 * 
 * AC 1: Agent continues to refine output despite setbacks
 * AC 2: Loop terminates when promise detected or Kmax reached
 * AC 3: Agent self-corrects and retries with modified approach
 * 
 * The "Ralph Wiggum" pattern: persistence despite setbacks.
 */

import type { SessionId, HaltReason } from "../budget/types";
import type {
  CompletionPromise,
  RalphConfig,
  RalphState,
  RalphResult,
  RalphPhase,
  RalphStep,
  RalphPlan,
  Perception,
  CorrectionDecision,
  RalphError,
  AdaptationDecision,
  PerceiveFunction,
  PlanFunction,
  ActFunction,
  CheckFunction,
  AdaptFunction,
  RalphCallbacks,
} from "./types";
import {
  DEFAULT_RALPH_CONFIG,
  createInitialRalphState,
  createEmptyPerception,
} from "./types";
import { CompletionDetector, createCompletionDetector, checkKmax } from "./completion-detector";
import { SelfCorrector, createSelfCorrector } from "./self-corrector";

/**
 * Ralph Loop Orchestrator
 * Implements the Perceive -> Plan -> Act -> Check -> Adapt cycle
 */
export class RalphLoop<TInput = unknown, TOutput = unknown, TContext = unknown> {
  private detector: CompletionDetector;
  private corrector: SelfCorrector;
  private config: RalphConfig;
  private callbacks?: RalphCallbacks<TContext>;
  private state: RalphState<TInput, TOutput>;
  private running: boolean = false;
  private startTime: number = 0;

  constructor(
    sessionId: SessionId,
    input: TInput,
    completionPromise: CompletionPromise<TOutput>,
    config: Partial<RalphConfig> = {},
    callbacks?: RalphCallbacks<TContext>,
  ) {
    this.config = { ...DEFAULT_RALPH_CONFIG, ...config } as RalphConfig;
    this.detector = createCompletionDetector({
      enableLogging: false,
    });
    this.corrector = createSelfCorrector({
      maxRetries: 3,
      backoffStrategy: this.config.backoffStrategy,
      onCorrection: callbacks?.onCorrection,
    });
    this.callbacks = callbacks;
    this.state = createInitialRalphState(sessionId, input, completionPromise as CompletionPromise) as RalphState<TInput, TOutput>;
  }

  /**
   * Execute the Ralph loop
   * AC 1, AC 2, AC 3: Main execution with completion, Kmax, and self-correction
   */
  async execute(): Promise<RalphResult<TOutput>> {
    if (this.running) {
      throw new Error("Ralph loop is already running");
    }

    this.running = true;
    this.startTime = Date.now();
    this.state.startedAt = new Date();

    let lastOutput: TOutput | undefined;
    let lastError: RalphError | undefined;

    try {
      while (this.shouldContinue()) {
        const iterationStart = Date.now();

        try {
          // Increment iteration first
          this.state.currentIteration++;
          this.state.currentPhase = "perceive";

          // 1. PERCEIVE: Gather context and analyze state
          const perception = await this.perceive(lastOutput, lastError);

          // 2. PLAN: Generate or refine plan
          this.state.currentPhase = "plan";
          this.state.plan = await this.plan(perception);

          // 3. ACT: Execute plan step
          this.state.currentPhase = "act";
          const stepStart = Date.now();
          
          try {
            lastOutput = await this.act();
            lastError = undefined;

            const stepDuration = Date.now() - stepStart;
            this.recordStep(iterationStart, stepDuration, lastOutput);
          } catch (actError) {
            // AC 3: Handle error and self-correct
            const correction = await this.handleError(actError, this.state.currentIteration);
            
            if (correction.strategy === "abort") {
              this.state.halted = true;
              this.state.haltReason = { type: "critical_error", error: correction.reason };
              break;
            }

            lastError = this.state.errors[this.state.errors.length - 1];
            
            if (correction.backoffMs) {
              await this.sleep(correction.backoffMs);
            }

            // retry with modifications
            if (correction.modifications?.input || correction.modifications?.context) {
              this.state.input = { ...this.state.input, ...correction.modifications?.input } as TInput;
            }

            continue;
          }

          // 4. CHECK: Verify completion promise
          this.state.currentPhase = "check";
          const isComplete = await this.check(lastOutput);

          if (isComplete) {
            // AC 2: Completion promise met
            this.state.completed = true;
            break;
          }

          // 5. ADAPT: Decide whether to continue
          this.state.currentPhase = "adapt";
          const adaptation = await this.adapt(lastOutput, lastError);

          if (!adaptation.continue) {
            if (adaptation.haltReason) {
              this.state.halted = true;
              this.state.haltReason = adaptation.haltReason;
            }
            break;
          }

          // Apply modifications if any
          if (adaptation.modifiedInput) {
            this.state.input = { ...this.state.input, ...adaptation.modifiedInput } as TInput;
          }
          if (adaptation.modifiedPlan) {
            this.state.plan = adaptation.modifiedPlan;
          }

        } catch (phaseError) {
          // Critical error in phase itself
          this.state.halted = true;
          this.state.haltReason = { type: "critical_error", error: String(phaseError) };
          lastError = {
            step: this.state.currentIteration,
            timestamp: new Date(),
            classification: "critical_error",
            message: String(phaseError),
            recoverable: false,
            retryCount: 0,
          };
          this.state.errors.push(lastError);
          break;
        }
      }

      return this.buildResult(lastOutput);

    } finally {
      this.running = false;
    }
  }

  /**
   * Check if loop should continue
   * AC 2: Handles Kmax termination
   */
  private shouldContinue(): boolean {
    if (this.state.halted) {
      return false;
    }

    if (this.state.completed) {
      return false;
    }

    // Check Kmax
    const kmaxCheck = checkKmax(this.state.currentIteration, this.config.maxIterations);
    if (kmaxCheck.exceeded) {
      this.state.halted = true;
      this.state.haltReason = {
        type: "kmax_exceeded",
        currentStep: this.state.currentIteration,
        maxSteps: this.config.maxIterations,
      };
      return false;
    }

    return true;
  }

  /**
   * PERCEIVE phase: Gather context
   */
  private async perceive(lastOutput?: TOutput, lastError?: RalphError): Promise<Perception> {
    if (this.callbacks?.perceive) {
      try {
        return await this.callbacks.perceive(this.state, undefined);
      } catch {
        // Fall back to default
      }
    }

    return {
      ...createEmptyPerception(),
      history: [...this.state.steps],
      currentError: lastError,
      lastSuccessfulOutput: lastOutput,
      budgetStatus: {
        tokensUsed: 0,
        toolCallsUsed: 0,
        timeElapsedMs: Date.now() - this.startTime,
        costUsedUsd: 0,
        stepsCompleted: this.state.currentIteration,
        budgetRemaining: this.config.maxIterations - this.state.currentIteration,
      },
      stuckPatterns: this.corrector.detectStuckPatterns(this.state),
    };
  }

  /**
   * PLAN phase: Generate or refine plan
   */
  private async plan(perception: Perception): Promise<RalphPlan> {
    if (this.callbacks?.plan) {
      try {
        return await this.callbacks.plan(perception, this.state.plan);
      } catch {
        // Fall back to existing plan
      }
    }

    // Default: keep existing plan
    return this.state.plan;
  }

  /**
   * ACT phase: Execute plan step
   */
  private async act(): Promise<TOutput> {
    if (this.callbacks?.act) {
      return await this.callbacks.act(
        this.state.input,
        this.state.plan,
        this.state.currentIteration,
      ) as TOutput;
    }

    // Default: return input as output
    return this.state.input as unknown as TOutput;
  }

  /**
   * CHECK phase: Verify completion promise
   */
  private async check(output: TOutput): Promise<boolean> {
    if (this.callbacks?.check) {
      return await this.callbacks.check(output, this.state.completionPromise as CompletionPromise, this.state.currentIteration);
    }

    // Use completion detector
    const result = await this.detector.isComplete(output, this.state.completionPromise as CompletionPromise, this.state.currentIteration);
    return result.isComplete;
  }

  /**
   * ADAPT phase: Decide whether to continue
   */
  private async adapt(output: TOutput, error?: RalphError): Promise<AdaptationDecision> {
    if (this.callbacks?.adapt) {
      try {
        return await this.callbacks.adapt(this.state, await this.perceive(output, error), false);
      } catch {
        // Fall back to default
      }
    }

    // Check for stuck patterns
    const stuckPatterns = this.corrector.detectStuckPatterns(this.state);
    
    if (stuckPatterns.length > 0) {
      return this.corrector.generateAdaptation(this.state, await this.perceive(output, error));
    }

    return {
      continue: true,
      reason: "Continuing - completion promise not yet met",
      nextPhase: "perceive",
    };
  }

  /**
   * Handle error with self-correction
   * AC 3: Self-correct and retry
   */
  private async handleError(error: unknown, step: number): Promise<CorrectionDecision> {
    const retryCount = this.state.errors.filter(e => e.step === step).length;
    
    // Get raw classification before creating RalphError
    const err = error instanceof Error ? error : new Error(String(error));
    const rawClassification = this.classifyErrorInternal(err);
    
    const decision = await this.corrector.decide(
      error,
      step,
      retryCount,
      this.state.plan,
      { input: this.state.input as Record<string, unknown> },
    );

    // Track error with proper classification
    const classification: import("./types").ErrorClassification = 
      decision.strategy === "abort" ? "critical_error" : rawClassification;
    const ralphError: RalphError = {
      step,
      timestamp: new Date(),
      classification,
      message: decision.reason,
      recoverable: decision.strategy !== "abort",
      retryCount,
    };
    this.state.errors.push(ralphError);
    this.state.corrections.push(decision);

    // Call error callback from both config and callbacks
    if (this.config.onError) {
      this.config.onError(ralphError);
    }
    if (this.callbacks?.onError) {
      this.callbacks.onError(ralphError);
    }

    return decision;
  }

  /**
   * Internal error classification helper
   */
  private classifyErrorInternal(error: Error): import("./types").ErrorClassification {
    const message = error.message.toLowerCase();
    
    if (message.includes("timeout")) return "timeout";
    if (message.includes("rate limit") || message.includes("quota")) return "resource_exhausted";
    if (message.includes("unauthorized") || message.includes("forbidden") || message.includes("denied")) return "policy_denied";
    if (message.includes("budget") || message.includes("limit exceeded")) return "budget_exceeded";
    if (message.includes("invalid") || message.includes("validation")) return "invalid_input";
    if (message.includes("dependency") || message.includes("connection") || message.includes("network")) return "dependency_error";
    if (message.includes("critical") || message.includes("fatal")) return "critical_error";
    if (message.includes("transient") || message.includes("temporary") || message.includes("retry")) return "transient";
    
    return "unknown_error";
  }

  /**
   * Record step in history
   */
  private recordStep(startMs: number, durationMs: number, output?: TOutput): void {
    const step: RalphStep = {
      iteration: this.state.currentIteration,
      phase: this.state.currentPhase,
      input: this.state.input,
      output,
      timestamp: new Date(),
      durationMs,
      corrections: [...this.state.corrections],
    };

    this.state.steps.push(step);

    // Update iterations used
    this.state.iterationsUsed = this.state.currentIteration;

    // Call progress callback from both config and callbacks
    if (this.config.onProgress) {
      this.config.onProgress(step);
    }
    if (this.callbacks?.onProgress) {
      this.callbacks.onProgress(step);
    }
  }

  /**
   * Build final result
   */
  private buildResult(output?: TOutput): RalphResult<TOutput> {
    const totalDurationMs = Date.now() - this.startTime;

    const result: RalphResult<TOutput> = {
      success: this.state.completed && !this.state.halted,
      output: output ?? this.state.output,
      iterations: this.state.currentIteration,
      totalDurationMs,
      errors: [...this.state.errors],
      corrections: [...this.state.corrections],
      steps: [...this.state.steps],
      completionPromiseMet: this.state.completed,
      finalPlan: this.state.plan,
    };

    if (this.state.halted && this.state.haltReason) {
      result.haltReason = this.state.haltReason;
    }

    // Call completion callback from both config and callbacks
    if (this.config.onCompletion && result.success) {
      this.config.onCompletion(output, this.state.currentIteration);
    }
    if (this.callbacks?.onCompletion && result.success) {
      this.callbacks.onCompletion(output, this.state.currentIteration);
    }

    // Call halt callback from both config and callbacks
    if (this.config.onHalt && this.state.halted) {
      this.config.onHalt(this.state.haltReason!);
    }
    if (this.callbacks?.onHalt && this.state.halted) {
      this.callbacks.onHalt(this.state.haltReason!);
    }

    return result;
  }

  /**
   * Sleep utility for backoff
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Get current state (for monitoring)
   */
  getState(): RalphState<TInput, TOutput> {
    return { ...this.state };
  }

  /**
   * Get current status
   */
  getStatus(): {
    isRunning: boolean;
    currentIteration: number;
    currentPhase: RalphPhase;
    errorsCount: number;
    correctionsCount: number;
    elapsedMs: number;
  } {
    return {
      isRunning: this.running,
      currentIteration: this.state.currentIteration,
      currentPhase: this.state.currentPhase,
      errorsCount: this.state.errors.length,
      correctionsCount: this.state.corrections.length,
      elapsedMs: Date.now() - this.startTime,
    };
  }

  /**
   * Halt the loop externally
   */
  halt(reason: HaltReason): void {
    this.state.halted = true;
    this.state.haltReason = reason;
  }
}

/**
 * Create a Ralph loop instance
 */
export function createRalphLoop<TInput = unknown, TOutput = unknown, TContext = unknown>(
  sessionId: SessionId,
  input: TInput,
  completionPromise: CompletionPromise<TOutput>,
  config?: Partial<RalphConfig>,
  callbacks?: RalphCallbacks<TContext>,
): RalphLoop<TInput, TOutput, TContext> {
  return new RalphLoop(sessionId, input, completionPromise, config, callbacks);
}

/**
 * Convenience function to run a simple Ralph loop
 */
export async function runRalphLoop<TInput = unknown, TOutput = unknown>(
  sessionId: SessionId,
  input: TInput,
  completionPromise: CompletionPromise<TOutput>,
  actFn: ActFunction<TInput, TOutput>,
  config?: Partial<RalphConfig>,
  checkFn?: CheckFunction<TOutput>,
): Promise<RalphResult<TOutput>> {
  // Create default check function if not provided
  const defaultCheckFn = async (output: unknown, promise: CompletionPromise, iteration: number) => {
    const detector = createCompletionDetector();
    const result = await detector.isComplete(output, promise, iteration);
    return result.isComplete;
  };

  // Cast callbacks to work with generic types
  const callbacks: RalphCallbacks = {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    act: actFn as any,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    check: (checkFn as any) ?? defaultCheckFn,
  };

  const loop = createRalphLoop<TInput, TOutput>(sessionId, input, completionPromise, config, callbacks);
  return loop.execute();
}