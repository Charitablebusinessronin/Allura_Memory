/**
 * Circuit Breaker Type Definitions
 * Story 3.6: Implement Circuit Breakers for Operational Safety
 *
 * Pattern: Michael Nygard's "Release It!"
 * Purpose: Prevent cascade failures by tripping when error thresholds are exceeded
 */

/**
 * Circuit breaker states (finite state machine)
 *
 * CLOSED: Normal operation - requests flow through
 * OPEN: Tripped state - requests are rejected with fallback
 * HALF_OPEN: Testing state - limited requests allowed to test recovery
 */
export type BreakerState = "closed" | "open" | "half_open";

/**
 * Reason for state transition
 */
export type TransitionReason =
  | "threshold_exceeded"
  | "manual_reset"
  | "timeout_expired"
  | "health_check_passed"
  | "health_check_failed";

/**
 * Error severity levels
 */
export type ErrorSeverity = "transient" | "recoverable" | "critical";

/**
 * Error record for tracking
 */
export interface BreakerError {
  /** When the error occurred */
  timestamp: Date;
  /** Error message */
  message: string;
  /** Error type/classification */
  errorType: string;
  /** Severity level */
  severity: ErrorSeverity;
  /** Tool or operation that failed */
  operation: string;
  /** Context when error occurred */
  context?: Record<string, unknown>;
}

/**
 * Success record for tracking
 */
export interface BreakerSuccess {
  /** When success occurred */
  timestamp: Date;
  /** Tool or operation that succeeded */
  operation: string;
  /** Execution time in milliseconds */
  durationMs: number;
}

/**
 * Circuit breaker configuration
 */
export interface BreakerConfig {
  /** Maximum consecutive errors before tripping */
  errorThreshold: number;
  /** Maximum error rate percentage (0-100) before tripping */
  errorRateThreshold: number;
  /** Minimum calls before error rate calculation is reliable */
  minimumCalls: number;
  /** Time in milliseconds before transitioning from OPEN to HALF_OPEN */
  openTimeoutMs: number;
  /** Number of successful calls in HALF_OPEN to transition to CLOSED */
  successThreshold: number;
  /** Number of failed calls in HALF_OPEN to transition back to OPEN */
  halfOpenFailureThreshold: number;
  /** Time window for tracking errors (milliseconds) */
  trackingWindowMs: number;
  /** Enable automatic recovery (HALF_OPEN testing) */
  enableAutoRecovery: boolean;
  /** Volume threshold for trip (minimum number of calls in window) */
  volumeThreshold: number;
  /** Slow call duration threshold (milliseconds) */
  slowCallDurationMs: number;
  /** Slow call rate threshold percentage (0-100) */
  slowCallRateThreshold: number;
  /** Group ID for tenant isolation */
  groupId: string;
  /** Breaker name/identifier */
  name: string;
}

/**
 * Circuit breaker state snapshot
 */
export interface BreakerStateSnapshot {
  /** Current state */
  state: BreakerState;
  /** Breaker name */
  name: string;
  /** Group ID for tenant isolation */
  groupId: string;
  /** Number of consecutive errors */
  consecutiveErrors: number;
  /** Number of consecutive successes */
  consecutiveSuccesses: number;
  /** Total calls in tracking window */
  totalCalls: number;
  /** Total failures in tracking window */
  totalFailures: number;
  /** Total successes in tracking window */
  totalSuccesses: number;
  /** Current error rate percentage */
  errorRate: number;
  /** Number of slow calls */
  slowCalls: number;
  /** When the breaker was last tripped (OPEN state entered) */
  lastTrippedAt?: Date;
  /** When the breaker was last reset (CLOSED state entered) */
  lastResetAt?: Date;
  /** When HALF_OPEN testing started */
  halfOpenStartedAt?: Date;
  /** Last error encountered */
  lastError?: BreakerError;
  /** Number of times breaker has tripped */
  tripCount: number;
  /** Configuration */
  config: BreakerConfig;
}

/**
 * Execution result wrapper
 */
export interface BreakerResult<T> {
  /** Whether execution was allowed */
  allowed: boolean;
  /** Whether execution succeeded */
  success: boolean;
  /** Result if allowed and successful */
  result?: T;
  /** Error if allowed but failed */
  error?: Error;
  /** Rejection reason if not allowed */
  rejectionReason?: string;
  /** Current breaker state */
  state: BreakerState;
  /** Current state snapshot */
  stateSnapshot: BreakerStateSnapshot;
}

/**
 * Trip event data for alerting
 */
export interface BreakerTripEvent {
  /** Breaker name */
  name: string;
  /** Group ID */
  groupId: string;
  /** When it tripped */
  timestamp: Date;
  /** Reason for trip */
  reason: TransitionReason;
  /** Error count at trip */
  errorCount: number;
  /** Error rate at trip */
  errorRate: number;
  /** Last error */
  lastError?: BreakerError;
  /** State snapshot at trip */
  stateSnapshot: BreakerStateSnapshot;
}

/**
 * Reset event data for alerting
 */
export interface BreakerResetEvent {
  /** Breaker name */
  name: string;
  /** Group ID */
  groupId: string;
  /** When it reset */
  timestamp: Date;
  /** Reason for reset */
  reason: TransitionReason;
  /** Who performed reset (for manual resets) */
  resetBy?: string;
  /** Justification for reset */
  justification?: string;
  /** State snapshot at reset */
  stateSnapshot: BreakerStateSnapshot;
}

/**
 * State change event
 */
export interface BreakerStateChangeEvent {
  /** Breaker name */
  name: string;
  /** Group ID */
  groupId: string;
  /** Previous state */
  fromState: BreakerState;
  /** New state */
  toState: BreakerState;
  /** Reason for change */
  reason: TransitionReason;
  /** When change occurred */
  timestamp: Date;
}

/**
 * Callback types
 */
export type BreakerTripCallback = (event: BreakerTripEvent) => Promise<void> | void;
export type BreakerResetCallback = (event: BreakerResetEvent) => Promise<void> | void;
export type BreakerStateChangeCallback = (event: BreakerStateChangeEvent) => Promise<void> | void;

/**
 * Health check function type
 */
export type HealthCheckFunction = () => Promise<boolean>;

/**
 * Default breaker configuration
 */
export const DEFAULT_BREAKER_CONFIG: Partial<BreakerConfig> = {
  errorThreshold: 5,
  errorRateThreshold: 50,
  minimumCalls: 10,
  openTimeoutMs: 60000,
  successThreshold: 3,
  halfOpenFailureThreshold: 1,
  trackingWindowMs: 60000,
  enableAutoRecovery: true,
  volumeThreshold: 20,
  slowCallDurationMs: 5000,
  slowCallRateThreshold: 80,
};

/**
 * Breaker scope for different breaker types
 */
export type BreakerScope = "tool" | "llm" | "external_api" | "database" | "global";

/**
 * Breaker registry entry
 */
export interface BreakerRegistryEntry {
  name: string;
  scope: BreakerScope;
  config: BreakerConfig;
  state: BreakerStateSnapshot;
}