/**
 * Budget Enforcer - Hard Limit Enforcement
 * Story 3.2: Enforce Kmax and budget limits with immediate halt
 */

import type {
  BudgetBreach,
  BudgetConfig,
  BudgetLimits,
  HaltReason,
  SessionId,
  SessionState,
} from "./types";
import { DEFAULT_BUDGET_CONFIG } from "./types";
import { BudgetMonitor, createBudgetMonitor } from "./monitor";

/**
 * Execution loop control interface
 * Integration point for agent execution loops
 */
export interface ExecutionLoop {
  /** Check if loop should continue */
  shouldContinue(): boolean;
  /** Signal halt with reason */
  halt(reason: HaltReason): void;
  /** Get current step number */
  getCurrentStep(): number;
}

/**
 * Enforcer callback types
 */
export type HaltCallback = (sessionId: SessionId, reason: HaltReason, state: SessionState) => Promise<void> | void;
export type PreCheckCallback = (sessionId: SessionId, state: SessionState) => Promise<boolean> | boolean;

/**
 * Enforcer configuration
 */
export interface EnforcerConfig {
  /** Budget configuration */
  budgetConfig: BudgetConfig;
  /** Callback when execution is halted */
  onHalt?: HaltCallback;
  /** Callback before each check (return false to skip) */
  onPreCheck?: PreCheckCallback;
  /** Enable/disable enforcement (default: true) */
  enabled: boolean;
}

/**
 * Enforcement result
 */
export interface EnforcementResult {
  /** Whether execution can continue */
  allowed: boolean;
  /** Current budget status */
  status: "ok" | "warning" | "breached" | "halted";
  /** Halt reason if applicable */
  haltReason?: HaltReason;
  /** Categories that are at warning level */
  warnings: BudgetBreach[];
  /** Categories that breached limits */
  breaches: BudgetBreach[];
  /** Current session state */
  state?: SessionState;
}

/**
 * Budget Enforcer - Ensures hard limits are enforced
 * This is the ENFORCEMENT layer - halts execution immediately on breach
 */
export class BudgetEnforcer {
  private monitor: BudgetMonitor;
  private config: EnforcerConfig;
  private haltedSessions: Set<string> = new Set();

  constructor(config?: Partial<EnforcerConfig>) {
    this.config = {
      budgetConfig: config?.budgetConfig ?? DEFAULT_BUDGET_CONFIG,
      onHalt: config?.onHalt,
      onPreCheck: config?.onPreCheck,
      enabled: config?.enabled ?? true,
    };

    this.monitor = createBudgetMonitor({
      budgetConfig: this.config.budgetConfig,
      onBreach: (sessionId, category, consumed, limit) => {
        this.handleBreach(sessionId, category, consumed, limit);
      },
      onWarning: (sessionId, category, utilization, threshold) => {
        this.handleWarning(sessionId, category, utilization, threshold);
      },
    });
  }

  /**
   * Start a new session with enforcement
   */
  startSession(sessionId: SessionId, limits?: BudgetLimits): SessionState {
    const key = this.sessionKey(sessionId);
    this.haltedSessions.delete(key);
    return this.monitor.startSession(sessionId, limits);
  }

  /**
   * End a session
   */
  endSession(sessionId: SessionId): SessionState | null {
    return this.monitor.endSession(sessionId);
  }

  /**
   * Pre-execution check - MUST be called before each iteration/step
   * Returns enforcement result indicating if execution can proceed
   */
  async checkBeforeExecution(sessionId: SessionId): Promise<EnforcementResult> {
    // Skip if enforcement disabled
    if (!this.config.enabled) {
      const state = this.monitor.getSessionState(sessionId);
      return {
        allowed: true,
        status: "ok",
        warnings: [],
        breaches: [],
        state: state ?? undefined,
      };
    }

    // Check if session is halted
    if (this.isHalted(sessionId)) {
      const state = this.monitor.getSessionState(sessionId);
      return {
        allowed: false,
        status: "halted",
        haltReason: state?.haltReason,
        warnings: [],
        breaches: [],
        state: state ?? undefined,
      };
    }

    // Run pre-check callback if provided
    if (this.config.onPreCheck) {
      const shouldContinue = await Promise.resolve(this.config.onPreCheck(sessionId, this.monitor.getSessionState(sessionId)!));
      if (!shouldContinue) {
        return {
          allowed: false,
          status: "halted",
          warnings: [],
          breaches: [],
        };
      }
    }

    const state = this.monitor.getSessionState(sessionId);
    if (!state) {
      throw new Error(`Session ${this.sessionKey(sessionId)} not found`);
    }

    const { limits, consumption } = state.budgetStatus;
    const warnings: BudgetBreach[] = [];
    const breaches: BudgetBreach[] = [];

    // Check each category
    this.checkCategory("tokens", consumption.tokens, limits.maxTokens, state, warnings, breaches);
    this.checkCategory("tool_calls", consumption.toolCalls, limits.maxToolCalls, state, warnings, breaches);
    this.checkCategory("time_ms", consumption.timeMs, limits.maxTimeMs, state, warnings, breaches);
    this.checkCategory("cost_usd", consumption.costUsd, limits.maxCostUsd, state, warnings, breaches);

    // Check Kmax (steps)
    const totalSteps = state.currentStep;
    if (totalSteps >= limits.maxSteps) {
      breaches.push({
        category: "steps",
        consumed: totalSteps,
        limit: limits.maxSteps,
        utilizationPercent: (totalSteps / limits.maxSteps) * 100,
        timestamp: new Date(),
      });
    }

    // Determine if we should halt
    if (breaches.length > 0 && this.config.budgetConfig.haltOnBreach) {
      const haltReason = this.createHaltReason(breaches[0], state);
      await this.haltSession(sessionId, haltReason);

      return {
        allowed: false,
        status: "halted",
        haltReason,
        warnings,
        breaches,
        state: this.monitor.getSessionState(sessionId) ?? undefined,
      };
    }

    // Return result
    const status: "ok" | "warning" | "breached" = 
      breaches.length > 0 ? "breached" : warnings.length > 0 ? "warning" : "ok";

    return {
      allowed: true,
      status,
      warnings,
      breaches,
      state,
    };
  }

  /**
   * Post-execution step recording
   * MUST be called after each step/iteration completes
   */
  async recordStep(sessionId: SessionId): Promise<EnforcementResult> {
    // Increment step counter
    this.monitor.incrementStep(sessionId);

    // Check limits after increment
    return this.checkBeforeExecution(sessionId);
  }

  /**
   * Check if an iteration is allowed (simplified check for loop control)
   */
  canContinue(sessionId: SessionId): boolean {
    if (!this.config.enabled) return true;
    if (this.isHalted(sessionId)) return false;

    const state = this.monitor.getSessionState(sessionId);
    if (!state) return false;

    const { limits, consumption } = state.budgetStatus;

    // Quick checks - any breached means no
    if (consumption.tokens >= limits.maxTokens) return false;
    if (consumption.toolCalls >= limits.maxToolCalls) return false;
    if (consumption.timeMs >= limits.maxTimeMs) return false;
    if (consumption.costUsd >= limits.maxCostUsd) return false;
    if (consumption.steps >= limits.maxSteps) return false;

    return true;
  }

  /**
   * Halt a session immediately
   */
  async haltSession(sessionId: SessionId, reason: HaltReason): Promise<void> {
    const key = this.sessionKey(sessionId);
    this.haltedSessions.add(key);

    const state = this.monitor.getSessionState(sessionId);
    if (state) {
      state.haltedAt = new Date();
      state.haltReason = reason;
    }

    // Call halt callback
    if (this.config.onHalt && state) {
      await Promise.resolve(this.config.onHalt(sessionId, reason, state));
    }
  }

  /**
   * Check if session is halted
   */
  isHalted(sessionId: SessionId): boolean {
    return this.haltedSessions.has(this.sessionKey(sessionId));
  }

  /**
   * Get halt reason for a session
   */
  getHaltReason(sessionId: SessionId): HaltReason | undefined {
    const state = this.monitor.getSessionState(sessionId);
    return state?.haltReason;
  }

  /**
   * Get current budget status
   */
  getStatus(sessionId: SessionId) {
    return this.monitor.getStatus(sessionId);
  }

  /**
   * Get full session state
   */
  getSessionState(sessionId: SessionId): SessionState | null {
    return this.monitor.getSessionState(sessionId);
  }

  /**
   * Get underlying monitor for direct operations
   */
  getMonitor(): BudgetMonitor {
    return this.monitor;
  }

  /**
   * Create an execution loop wrapper that enforces budget limits
   */
  wrapExecutionLoop(sessionId: SessionId, loop: ExecutionLoop): ExecutionLoop {
    const self = this;

    return {
      shouldContinue(): boolean {
        // First check if halted
        if (self.isHalted(sessionId)) {
          return false;
        }

        // Check budget limits
        if (!self.canContinue(sessionId)) {
          return false;
        }

        // Check original loop condition
        return loop.shouldContinue();
      },

      halt(reason: HaltReason): void {
        self.haltSession(sessionId, reason);
        loop.halt(reason);
      },

      getCurrentStep(): number {
        return self.monitor.getSessionState(sessionId)?.currentStep ?? loop.getCurrentStep();
      },
    };
  }

  // Private methods

  private sessionKey(sessionId: SessionId): string {
    return `${sessionId.groupId}:${sessionId.agentId}:${sessionId.sessionId}`;
  }

  private checkCategory(
    category: BudgetBreach["category"],
    consumed: number,
    limit: number,
    state: SessionState,
    warnings: BudgetBreach[],
    breaches: BudgetBreach[],
  ): void {
    const utilizationPercent = (consumed / limit) * 100;
    const warningThresholds = this.config.budgetConfig.warningThresholds;

    const breach: BudgetBreach = {
      category,
      consumed,
      limit,
      utilizationPercent,
      timestamp: new Date(),
    };

    // Check if at warning level (80% or 90%)
    const warning80 = utilizationPercent >= (warningThresholds.warning80 * 100);
    const warning90 = utilizationPercent >= (warningThresholds.warning90 * 100);
    const breached = consumed >= limit;

    // Track warning status in state
    if (category === "tokens") {
      state.budgetStatus.warnings.tokens.warning80 = warning80 || state.budgetStatus.warnings.tokens.warning80;
      state.budgetStatus.warnings.tokens.warning90 = warning90 || state.budgetStatus.warnings.tokens.warning90;
    }

    if (breached) {
      breaches.push(breach);
    } else if (warning90) {
      warnings.push(breach);
    } else if (warning80) {
      warnings.push(breach);
    }
  }

  private createHaltReason(breach: BudgetBreach, state: SessionState): HaltReason {
    switch (breach.category) {
      case "tokens":
        return { type: "token_limit", consumed: breach.consumed, limit: breach.limit };
      case "tool_calls":
        return { type: "tool_call_limit", consumed: breach.consumed, limit: breach.limit };
      case "time_ms":
        return { type: "time_limit", elapsedMs: breach.consumed, limitMs: breach.limit };
      case "cost_usd":
        return { type: "cost_limit", consumedUsd: breach.consumed, limitUsd: breach.limit };
      case "steps":
        return { type: "kmax_exceeded", currentStep: state.currentStep, maxSteps: breach.limit };
      default:
        return { type: "critical_error", error: `Unknown breach: ${breach.category}` };
    }
  }

  private handleBreach(
    sessionId: SessionId,
    category: string,
    consumed: number,
    limit: number,
  ): void {
    // Log breach - actual halt happens in checkBeforeExecution
    console.warn(`[BudgetEnforcer] Breach detected for ${this.sessionKey(sessionId)}: ${category} at ${consumed}/${limit}`);
  }

  private handleWarning(
    sessionId: SessionId,
    category: string,
    utilization: number,
    threshold: number,
  ): void {
    console.info(`[BudgetEnforcer] Warning for ${this.sessionKey(sessionId)}: ${category} at ${utilization.toFixed(1)}% (${threshold}% threshold)`);
  }
}

/**
 * Create a budget enforcer instance
 */
export function createBudgetEnforcer(config?: Partial<EnforcerConfig>): BudgetEnforcer {
  return new BudgetEnforcer(config);
}

/**
 * Kmax enforcement helper
 * Simplified interface for step-based limits
 */
export class KmaxEnforcer {
  private maxSteps: number;
  private currentStep: Map<string, number> = new Map();
  private halted: Set<string> = new Set();

  constructor(maxSteps: number) {
    this.maxSteps = maxSteps;
  }

  start(sessionKey: string): void {
    this.currentStep.set(sessionKey, 0);
    this.halted.delete(sessionKey);
  }

  increment(sessionKey: string): { allowed: boolean; step: number; maxSteps: number } {
    if (this.halted.has(sessionKey)) {
      return { allowed: false, step: this.currentStep.get(sessionKey) ?? 0, maxSteps: this.maxSteps };
    }

    const current = this.currentStep.get(sessionKey) ?? 0;
    const next = current + 1;
    this.currentStep.set(sessionKey, next);

    if (next >= this.maxSteps) {
      this.halted.add(sessionKey);
      return { allowed: false, step: next, maxSteps: this.maxSteps };
    }

    return { allowed: true, step: next, maxSteps: this.maxSteps };
  }

  halt(sessionKey: string): void {
    this.halted.add(sessionKey);
  }

  isHalted(sessionKey: string): boolean {
    return this.halted.has(sessionKey);
  }

  getCurrentStep(sessionKey: string): number {
    return this.currentStep.get(sessionKey) ?? 0;
  }
}

/**
 * Create a Kmax enforcer instance
 */
export function createKmaxEnforcer(maxSteps: number): KmaxEnforcer {
  return new KmaxEnforcer(maxSteps);
}