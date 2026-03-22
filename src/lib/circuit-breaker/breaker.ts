/**
 * Circuit Breaker Core Implementation
 * Story 3.6: Implement Circuit Breakers for Operational Safety
 *
 * Implements Michael Nygard's circuit breaker pattern with three states:
 * CLOSED (normal), OPEN (tripped), HALF_OPEN (testing)
 */

import type {
  BreakerState,
  BreakerConfig,
  BreakerStateSnapshot,
  BreakerResult,
  BreakerError,
  BreakerSuccess,
  BreakerTripCallback,
  BreakerResetCallback,
  BreakerStateChangeCallback,
  BreakerTripEvent,
  BreakerResetEvent,
  BreakerStateChangeEvent,
  TransitionReason,
} from "./types";
import { DEFAULT_BREAKER_CONFIG } from "./types";

/**
 * Circuit Breaker - Prevents cascade failures by tripping on error thresholds
 *
 * State Machine:
 * ┌───────┐  threshold_exceeded   ┌─────┐  timeout_expired   ┌───────────┐
 * │CLOSED │ ───────────────────▶ │OPEN │ ────────────────▶ │ HALF_OPEN │
 * └───────┘                        └─────┘                   └───────────┘
 *     ▲                                                       │
 *     │                        health_check_passed            │
 *     └───────────────────────────────────────────────────────┘
 *     │                                                       │
 *     │                                       health_check_failed
 *     └───────────────────────────────────────────────────────┘
 *
 * CLOSED: Normal operation - all requests flow through
 * OPEN: Tripped - all requests are rejected immediately
 * HALF_OPEN: Testing - limited requests allowed to check health
 */
export class CircuitBreaker {
  private state: BreakerState = "closed";
  private consecutiveErrors: number = 0;
  private consecutiveSuccesses: number = 0;
  private totalCalls: number = 0;
  private totalFailures: number = 0;
  private totalSuccesses: number = 0;
  private slowCalls: number = 0;
  private errors: BreakerError[] = [];
  private successes: BreakerSuccess[] = [];
  private lastTrippedAt?: Date;
  private lastResetAt?: Date;
  private halfOpenStartedAt?: Date;
  private lastError?: BreakerError;
  private tripCount: number = 0;
  private config: BreakerConfig;

  private tripCallbacks: Set<BreakerTripCallback> = new Set();
  private resetCallbacks: Set<BreakerResetCallback> = new Set();
  private stateChangeCallbacks: Set<BreakerStateChangeCallback> = new Set();

  constructor(config: Partial<BreakerConfig> & { name: string; groupId: string }) {
    this.config = {
      ...DEFAULT_BREAKER_CONFIG,
      ...config,
    } as BreakerConfig;
  }

  async execute<T>(
    operation: string,
    fn: () => Promise<T>,
  ): Promise<BreakerResult<T>> {
    const stateSnapshot = this.getStateSnapshot();

    if (!this.canExecute()) {
      return {
        allowed: false,
        success: false,
        rejectionReason: `Circuit breaker is ${this.state}`,
        state: this.state,
        stateSnapshot,
      };
    }

    const startTime = Date.now();

    try {
      const result = await fn();
      const durationMs = Date.now() - startTime;

      this.recordSuccess(operation, durationMs);

      return {
        allowed: true,
        success: true,
        result,
        state: this.state,
        stateSnapshot: this.getStateSnapshot(),
      };
    } catch (error) {
      const durationMs = Date.now() - startTime;

      this.recordFailure(operation, error instanceof Error ? error : new Error(String(error)));

      return {
        allowed: true,
        success: false,
        error: error instanceof Error ? error : new Error(String(error)),
        state: this.state,
        stateSnapshot: this.getStateSnapshot(),
      };
    }
  }

  canExecute(): boolean {
    switch (this.state) {
      case "closed":
        return true;
      case "open":
        if (this.config.enableAutoRecovery && this.lastTrippedAt) {
          const elapsedMs = Date.now() - this.lastTrippedAt.getTime();
          if (elapsedMs >= this.config.openTimeoutMs) {
            this.transitionTo("half_open", "timeout_expired");
            return true;
          }
        }
        return false;
      case "half_open":
        return true;
      default:
        return false;
    }
  }

  private recordSuccess(operation: string, durationMs: number): void {
    const success: BreakerSuccess = {
      timestamp: new Date(),
      operation,
      durationMs,
    };

    this.successes.push(success);
    this.consecutiveSuccesses++;
    this.consecutiveErrors = 0;
    this.totalCalls++;
    this.totalSuccesses++;

    if (durationMs >= this.config.slowCallDurationMs) {
      this.slowCalls++;
    }

    this.pruneTrackingWindow();

    if (this.state === "half_open") {
      if (this.consecutiveSuccesses >= this.config.successThreshold) {
        this.transitionTo("closed", "health_check_passed");
      }
    }
  }

  private recordFailure(operation: string, error: Error): void {
    const breakerError: BreakerError = {
      timestamp: new Date(),
      message: error.message,
      errorType: error.constructor.name,
      severity: this.classifyErrorSeverity(error),
      operation,
    };

    this.errors.push(breakerError);
    this.consecutiveErrors++;
    this.consecutiveSuccesses = 0;
    this.totalCalls++;
    this.totalFailures++;
    this.lastError = breakerError;

    this.pruneTrackingWindow();

    if (this.state === "closed") {
      if (this.shouldTrip()) {
        this.transitionTo("open", "threshold_exceeded");
      }
    } else if (this.state === "half_open") {
      if (this.consecutiveErrors >= this.config.halfOpenFailureThreshold) {
        this.transitionTo("open", "health_check_failed");
      }
    }
  }

  private shouldTrip(): boolean {
    if (this.consecutiveErrors >= this.config.errorThreshold) {
      return true;
    }

    if (this.totalCalls >= this.config.minimumCalls) {
      const errorRate = this.calculateErrorRate();

      if (errorRate >= this.config.errorRateThreshold) {
        if (this.totalCalls >= this.config.volumeThreshold) {
          return true;
        }
      }
    }

    const slowCallRate = this.calculateSlowCallRate();
    if (slowCallRate >= this.config.slowCallRateThreshold) {
      if (this.totalCalls >= this.config.minimumCalls) {
        return true;
      }
    }

    return false;
  }

  private calculateErrorRate(): number {
    if (this.totalCalls === 0) return 0;
    return (this.totalFailures / this.totalCalls) * 100;
  }

  private calculateSlowCallRate(): number {
    if (this.totalCalls === 0) return 0;
    return (this.slowCalls / this.totalCalls) * 100;
  }

  private transitionTo(newState: BreakerState, reason: TransitionReason): void {
    const oldState = this.state;
    this.state = newState;

    const timestamp = new Date();

    if (newState === "open") {
      this.lastTrippedAt = timestamp;
      this.tripCount++;
      this.emitTripEvent(reason);
    }

    if (newState === "closed") {
      this.lastResetAt = timestamp;
      this.consecutiveErrors = 0;
      this.consecutiveSuccesses = 0;
    }

    if (newState === "half_open") {
      this.halfOpenStartedAt = timestamp;
      this.consecutiveErrors = 0;
      this.consecutiveSuccesses = 0;
    }

    this.emitStateChangeEvent(oldState, newState, reason, timestamp);
  }

  private classifyErrorSeverity(error: Error): "transient" | "recoverable" | "critical" {
    const transientPatterns = [
      /timeout/i,
      /econnrefused/i,
      /enotfound/i,
      /econnreset/i,
      /rate limit/i,
      /temporarily/i,
      /unavailable/i,
    ];

    const criticalPatterns = [
      /authenticat/i,
      /unauthorized/i,
      /forbidden/i,
      /not found/i,
      /invalid/i,
      /malformed/i,
    ];

    const message = error.message.toLowerCase();

    for (const pattern of transientPatterns) {
      if (pattern.test(message)) {
        return "transient";
      }
    }

    for (const pattern of criticalPatterns) {
      if (pattern.test(message)) {
        return "critical";
      }
    }

    return "recoverable";
  }

  private pruneTrackingWindow(): void {
    const cutoff = Date.now() - this.config.trackingWindowMs;

    this.errors = this.errors.filter((e) => e.timestamp.getTime() >= cutoff);
    this.successes = this.successes.filter((s) => s.timestamp.getTime() >= cutoff);

    this.totalCalls = this.errors.length + this.successes.length;
    this.totalFailures = this.errors.length;
    this.totalSuccesses = this.successes.length;

    const recentSlowCalls = this.successes.filter(
      (s) => s.durationMs >= this.config.slowCallDurationMs,
    );
    this.slowCalls = recentSlowCalls.length;
  }

  private emitTripEvent(reason: TransitionReason): void {
    const event: BreakerTripEvent = {
      name: this.config.name,
      groupId: this.config.groupId,
      timestamp: this.lastTrippedAt!,
      reason,
      errorCount: this.consecutiveErrors,
      errorRate: this.calculateErrorRate(),
      lastError: this.lastError,
      stateSnapshot: this.getStateSnapshot(),
    };

    for (const callback of this.tripCallbacks) {
      Promise.resolve(callback(event)).catch((err) => {
        console.error(`[CircuitBreaker] Trip callback error:`, err);
      });
    }
  }

  private emitResetEvent(reason: TransitionReason, resetBy?: string, justification?: string): void {
    const event: BreakerResetEvent = {
      name: this.config.name,
      groupId: this.config.groupId,
      timestamp: new Date(),
      reason,
      resetBy,
      justification,
      stateSnapshot: this.getStateSnapshot(),
    };

    for (const callback of this.resetCallbacks) {
      Promise.resolve(callback(event)).catch((err) => {
        console.error(`[CircuitBreaker] Reset callback error:`, err);
      });
    }
  }

  private emitStateChangeEvent(
    fromState: BreakerState,
    toState: BreakerState,
    reason: TransitionReason,
    timestamp: Date,
  ): void {
    const event: BreakerStateChangeEvent = {
      name: this.config.name,
      groupId: this.config.groupId,
      fromState,
      toState,
      reason,
      timestamp,
    };

    for (const callback of this.stateChangeCallbacks) {
      Promise.resolve(callback(event)).catch((err) => {
        console.error(`[CircuitBreaker] State change callback error:`, err);
      });
    }
  }

  getStateSnapshot(): BreakerStateSnapshot {
    return {
      state: this.state,
      name: this.config.name,
      groupId: this.config.groupId,
      consecutiveErrors: this.consecutiveErrors,
      consecutiveSuccesses: this.consecutiveSuccesses,
      totalCalls: this.totalCalls,
      totalFailures: this.totalFailures,
      totalSuccesses: this.totalSuccesses,
      errorRate: this.calculateErrorRate(),
      slowCalls: this.slowCalls,
      lastTrippedAt: this.lastTrippedAt,
      lastResetAt: this.lastResetAt,
      halfOpenStartedAt: this.halfOpenStartedAt,
      lastError: this.lastError,
      tripCount: this.tripCount,
      config: this.config,
    };
  }

  getState(): BreakerState {
    return this.state;
  }

  reset(resetBy?: string, justification?: string): void {
    if (this.state === "closed") {
      return;
    }

    this.state = "closed";
    this.consecutiveErrors = 0;
    this.consecutiveSuccesses = 0;
    this.lastResetAt = new Date();

    this.emitResetEvent("manual_reset", resetBy, justification);
  }

  forceTrip(): void {
    if (this.state === "open") {
      return;
    }

    this.transitionTo("open", "threshold_exceeded");
  }

  onTrip(callback: BreakerTripCallback): void {
    this.tripCallbacks.add(callback);
  }

  onReset(callback: BreakerResetCallback): void {
    this.resetCallbacks.add(callback);
  }

  onStateChange(callback: BreakerStateChangeCallback): void {
    this.stateChangeCallbacks.add(callback);
  }

  offTrip(callback: BreakerTripCallback): void {
    this.tripCallbacks.delete(callback);
  }

  offReset(callback: BreakerResetCallback): void {
    this.resetCallbacks.delete(callback);
  }

  offStateChange(callback: BreakerStateChangeCallback): void {
    this.stateChangeCallbacks.delete(callback);
  }
}

export function createCircuitBreaker(
  config: Partial<BreakerConfig> & { name: string; groupId: string },
): CircuitBreaker {
  return new CircuitBreaker(config);
}