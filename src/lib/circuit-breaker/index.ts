/**
 * Circuit Breaker Module - Public API
 * Story 3.6: Implement Circuit Breakers for Operational Safety
 */

export type {
  BreakerState,
  BreakerConfig,
  BreakerStateSnapshot,
  BreakerResult,
  BreakerError,
  BreakerSuccess,
  BreakerTripEvent,
  BreakerResetEvent,
  BreakerStateChangeEvent,
  BreakerTripCallback,
  BreakerResetCallback,
  BreakerStateChangeCallback,
  BreakerScope,
  BreakerRegistryEntry,
  HealthCheckFunction,
  ErrorSeverity,
  TransitionReason,
} from "./types";

export { DEFAULT_BREAKER_CONFIG } from "./types";

export { CircuitBreaker, createCircuitBreaker } from "./breaker";

export {
  BreakerManager,
  getBreakerManager,
  createBreakerManager,
  resetBreakerManager,
  type BreakerManagerConfig,
  type ResetRequest,
  type ResetResult,
} from "./manager";

export {
  createTripAlertCallback,
  createResetAlertCallback,
  createStateChangeAlertCallback,
  getPendingAlerts,
  getAllAlerts,
  getAlert,
  acknowledgeAlert,
  onAlert,
  offAlert,
  logBreakerEventToPostgres,
  type MissionControlAlert,
  type AlertSeverity,
  type AlertCallback,
} from "./alerting";