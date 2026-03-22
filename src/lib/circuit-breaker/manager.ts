/**
 * Circuit Breaker Manager - Manages multiple breakers and reset mechanisms
 * Story 3.6: Implement Circuit Breakers for Operational Safety
 *
 * Provides:
 * - Centralized management of multiple circuit breakers
 * - Manual reset via API
 * - Automatic reset with health validation
 * - Breaker registry for agent isolation
 */

import type {
  BreakerState,
  BreakerConfig,
  BreakerStateSnapshot,
  BreakerScope,
  BreakerRegistryEntry,
  BreakerTripCallback,
  BreakerResetCallback,
  BreakerStateChangeCallback,
  HealthCheckFunction,
} from "./types";
import { CircuitBreaker, createCircuitBreaker } from "./breaker";
import {
  createTripAlertCallback,
  createResetAlertCallback,
  createStateChangeAlertCallback,
} from "./alerting";

/**
 * Manager configuration
 */
export interface BreakerManagerConfig {
  /** Default configuration for new breakers */
  defaultConfig: Partial<BreakerConfig>;
  /** Enable automatic recovery testing */
  enableAutoRecovery: boolean;
  /** Health check interval for HALF_OPEN validation (ms) */
  healthCheckIntervalMs: number;
  /** Maximum number of breakers per scope */
  maxBreakersPerScope: number;
}

/**
 * Default manager configuration
 */
export const DEFAULT_MANAGER_CONFIG: BreakerManagerConfig = {
  defaultConfig: {},
  enableAutoRecovery: true,
  healthCheckIntervalMs: 30000,
  maxBreakersPerScope: 100,
};

/**
 * Reset request payload
 */
export interface ResetRequest {
  /** Breaker name */
  name: string;
  /** Group/tenant ID */
  groupId: string;
  /** Who is requesting the reset */
  requestedBy: string;
  /** Justification for reset */
  justification: string;
  /** Whether to force reset even if unhealthy */
  force?: boolean;
}

/**
 * Reset result
 */
export interface ResetResult {
  /** Whether reset succeeded */
  success: boolean;
  /** Breaker that was reset */
  breaker?: BreakerRegistryEntry;
  /** Error message if failed */
  error?: string;
  /** Health check result (if performed) */
  healthCheckResult?: boolean;
}

/**
 * Circuit Breaker Manager
 * Central management for all circuit breakers with reset mechanisms
 */
export class BreakerManager {
  private breakers: Map<string, CircuitBreaker> = new Map();
  private healthChecks: Map<string, HealthCheckFunction> = new Map();
  private config: BreakerManagerConfig;
  private alertCallbacks: {
    trip: BreakerTripCallback;
    reset: BreakerResetCallback;
    stateChange: BreakerStateChangeCallback;
  };

  constructor(config: Partial<BreakerManagerConfig> = {}) {
    this.config = {
      ...DEFAULT_MANAGER_CONFIG,
      ...config,
    };

    this.alertCallbacks = {
      trip: createTripAlertCallback(),
      reset: createResetAlertCallback(),
      stateChange: createStateChangeAlertCallback(),
    };
  }

  /**
   * Generate unique key for breaker storage
   */
  private breakerKey(name: string, groupId: string): string {
    return `${groupId}:${name}`;
  }

  /**
   * Create and register a new circuit breaker
   */
  createBreaker(
    name: string,
    groupId: string,
    scope: BreakerScope = "tool",
    customConfig?: Partial<BreakerConfig>,
    healthCheck?: HealthCheckFunction,
  ): CircuitBreaker {
    const key = this.breakerKey(name, groupId);

    if (this.breakers.has(key)) {
      throw new Error(`Circuit breaker "${name}" already exists for group "${groupId}"`);
    }

    const config: Partial<BreakerConfig> & { name: string; groupId: string } = {
      ...this.config.defaultConfig,
      ...customConfig,
      name,
      groupId,
    };

    const breaker = createCircuitBreaker(config);

    breaker.onTrip(this.alertCallbacks.trip);
    breaker.onReset(this.alertCallbacks.reset);
    breaker.onStateChange(this.alertCallbacks.stateChange);

    this.breakers.set(key, breaker);

    if (healthCheck) {
      this.healthChecks.set(key, healthCheck);
    }

    return breaker;
  }

  /**
   * Get existing circuit breaker
   */
  getBreaker(name: string, groupId: string): CircuitBreaker | undefined {
    const key = this.breakerKey(name, groupId);
    return this.breakers.get(key);
  }

  /**
   * Get or create a circuit breaker
   */
  getOrCreateBreaker(
    name: string,
    groupId: string,
    scope: BreakerScope = "tool",
    customConfig?: Partial<BreakerConfig>,
    healthCheck?: HealthCheckFunction,
  ): CircuitBreaker {
    const existing = this.getBreaker(name, groupId);
    if (existing) {
      return existing;
    }

    return this.createBreaker(name, groupId, scope, customConfig, healthCheck);
  }

  /**
   * Execute through circuit breaker with automatic creation
   */
  async executeThrough<T>(
    name: string,
    groupId: string,
    operation: string,
    fn: () => Promise<T>,
    options?: {
      scope?: BreakerScope;
      config?: Partial<BreakerConfig>;
      healthCheck?: HealthCheckFunction;
    },
  ): Promise<{ result: T | null; breakerResult: Awaited<ReturnType<CircuitBreaker["execute"]>> }> {
    const breaker = this.getOrCreateBreaker(
      name,
      groupId,
      options?.scope,
      options?.config,
      options?.healthCheck,
    );

    const breakerResult = await breaker.execute(operation, fn);

    return {
      result: breakerResult.success ? breakerResult.result ?? null : null,
      breakerResult: breakerResult,
    };
  }

  /**
   * Manual reset of circuit breaker
   * AC3: System supports manual reset after review
   */
  async manualReset(request: ResetRequest): Promise<ResetResult> {
    const key = this.breakerKey(request.name, request.groupId);
    const breaker = this.breakers.get(key);

    if (!breaker) {
      return {
        success: false,
        error: `Circuit breaker "${request.name}" not found for group "${request.groupId}"`,
      };
    }

    const currentState = breaker.getState();

    if (currentState === "closed") {
      return {
        success: true,
        breaker: this.getBreakerEntry(request.name, request.groupId),
        error: "Circuit breaker is already in CLOSED state",
      };
    }

    let healthCheckPerformed = false;

    if (!request.force) {
      const healthCheck = this.healthChecks.get(key);
      if (healthCheck) {
        healthCheckPerformed = true;
        try {
          const isHealthy = await healthCheck();
          if (!isHealthy) {
            return {
              success: false,
              error: "Health check failed - circuit breaker cannot be safely reset",
              healthCheckResult: false,
            };
          }
        } catch (error) {
          return {
            success: false,
            error: `Health check error: ${error instanceof Error ? error.message : String(error)}`,
            healthCheckResult: false,
          };
        }
      }
    }

    breaker.reset(request.requestedBy, request.justification);

    const result: ResetResult = {
      success: true,
      breaker: this.getBreakerEntry(request.name, request.groupId),
    };

    if (healthCheckPerformed) {
      result.healthCheckResult = true;
    }

    return result;
  }

  /**
   * Force trip a circuit breaker
   * Used for testing or manual intervention
   */
  forceTrip(name: string, groupId: string): boolean {
    const key = this.breakerKey(name, groupId);
    const breaker = this.breakers.get(key);

    if (!breaker) {
      return false;
    }

    breaker.forceTrip();
    return true;
  }

  /**
   * Get breaker entry for registry
   */
  private getBreakerEntry(name: string, groupId: string): BreakerRegistryEntry | undefined {
    const key = this.breakerKey(name, groupId);
    const breaker = this.breakers.get(key);

    if (!breaker) {
      return undefined;
    }

    return {
      name,
      scope: "tool",
      config: breaker.getStateSnapshot().config,
      state: breaker.getStateSnapshot(),
    };
  }

  /**
   * Get all breakers for a group
   */
  getBreakersByGroup(groupId: string): BreakerRegistryEntry[] {
    const entries: BreakerRegistryEntry[] = [];

    for (const [key, breaker] of this.breakers) {
      if (key.startsWith(`${groupId}:`)) {
        const name = key.substring(groupId.length + 1);
        entries.push({
          name,
          scope: "tool",
          config: breaker.getStateSnapshot().config,
          state: breaker.getStateSnapshot(),
        });
      }
    }

    return entries;
  }

  /**
   * Get all breakers
   */
  getAllBreakers(): BreakerRegistryEntry[] {
    const entries: BreakerRegistryEntry[] = [];

    for (const [key, breaker] of this.breakers) {
      const colonIndex = key.indexOf(":");
      const groupId = key.substring(0, colonIndex);
      const name = key.substring(colonIndex + 1);

      entries.push({
        name,
        scope: "tool",
        config: breaker.getStateSnapshot().config,
        state: breaker.getStateSnapshot(),
      });
    }

    return entries;
  }

  /**
   * Get breakers by state
   */
  getBreakersByState(groupId: string, state: BreakerState): BreakerRegistryEntry[] {
    const allBreakers = this.getBreakersByGroup(groupId);
    return allBreakers.filter((b) => b.state.state === state);
  }

  /**
   * Get all tripped breakers
   */
  getTrippedBreakers(groupId?: string): BreakerRegistryEntry[] {
    const targetBreakers = groupId
      ? this.getBreakersByGroup(groupId)
      : this.getAllBreakers();

    return targetBreakers.filter((b) => b.state.state === "open");
  }

  /**
   * Get breakers in HALF_OPEN state (testing recovery)
   */
  getTestingBreakers(groupId?: string): BreakerRegistryEntry[] {
    const targetBreakers = groupId
      ? this.getBreakersByGroup(groupId)
      : this.getAllBreakers();

    return targetBreakers.filter((b) => b.state.state === "half_open");
  }

  /**
   * Remove a circuit breaker
   */
  removeBreaker(name: string, groupId: string): boolean {
    const key = this.breakerKey(name, groupId);
    const existed = this.breakers.has(key);

    if (existed) {
      this.breakers.delete(key);
      this.healthChecks.delete(key);
    }

    return existed;
  }

  /**
   * Get breaker statistics
   */
  getStats(groupId?: string): {
    total: number;
    closed: number;
    open: number;
    halfOpen: number;
    tripCount: number;
    averageErrorRate: number;
  } {
    const breakers = groupId
      ? this.getBreakersByGroup(groupId)
      : this.getAllBreakers();

    let total = 0;
    let closed = 0;
    let open = 0;
    let halfOpen = 0;
    let totalTrips = 0;
    let totalErrorRate = 0;

    for (const entry of breakers) {
      total++;
      totalTrips += entry.state.tripCount;
      totalErrorRate += entry.state.errorRate;

      switch (entry.state.state) {
        case "closed":
          closed++;
          break;
        case "open":
          open++;
          break;
        case "half_open":
          halfOpen++;
          break;
      }
    }

    return {
      total,
      closed,
      open,
      halfOpen,
      tripCount: totalTrips,
      averageErrorRate: total > 0 ? totalErrorRate / total : 0,
    };
  }

  /**
   * Set health check function for a breaker
   */
  setHealthCheck(name: string, groupId: string, healthCheck: HealthCheckFunction): void {
    const key = this.breakerKey(name, groupId);
    this.healthChecks.set(key, healthCheck);
  }

  /**
   * Run health check for a breaker in HALF_OPEN state
   */
  async runHealthCheck(name: string, groupId: string): Promise<{
    success: boolean;
    state: BreakerState;
    error?: string;
  }> {
    const key = this.breakerKey(name, groupId);
    const breaker = this.breakers.get(key);
    const healthCheck = this.healthChecks.get(key);

    if (!breaker) {
      return {
        success: false,
        state: "closed",
        error: "Breaker not found",
      };
    }

    if (!healthCheck) {
      return {
        success: false,
        state: breaker.getState(),
        error: "No health check configured",
      };
    }

    try {
      const isHealthy = await healthCheck();
      return {
        success: isHealthy,
        state: breaker.getState(),
      };
    } catch (error) {
      return {
        success: false,
        state: breaker.getState(),
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }
}

/**
 * Singleton breaker manager instance
 */
let defaultManager: BreakerManager | undefined;

/**
 * Get default breaker manager instance
 */
export function getBreakerManager(): BreakerManager {
  if (!defaultManager) {
    defaultManager = new BreakerManager();
  }
  return defaultManager;
}

/**
 * Create a new breaker manager with custom config
 */
export function createBreakerManager(config?: Partial<BreakerManagerConfig>): BreakerManager {
  return new BreakerManager(config);
}

/**
 * Reset default breaker manager (for testing)
 */
export function resetBreakerManager(): void {
  defaultManager = undefined;
}