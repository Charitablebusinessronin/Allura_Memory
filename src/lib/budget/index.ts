/**
 * Budget Module Exports
 * Story 3.2: Enforce Bounded Autonomy and Budget Caps
 */

// Types
export type {
  BudgetCategory,
  BudgetScope,
  BudgetLimits,
  BudgetConsumption,
  WarningThresholds,
  BudgetStatus,
  SessionId,
  BudgetBreach,
  HaltReason,
  SessionState,
  ToolCallRecord,
  ReasoningStep,
  ErrorRecord,
  ForensicSnapshot,
  BudgetConsumptionReport,
  LLMPricing,
  TokenUsage,
  BudgetConfig,
} from "./types";

// Constants and helpers
export {
  DEFAULT_BUDGET_LIMITS,
  DEFAULT_BUDGET_CONFIG,
  estimateCost,
  calculateUtilization,
  isThresholdBreached,
  createEmptyConsumption,
  createSessionState,
} from "./types";

// Budget Monitor
export {
  BudgetMonitor,
  createBudgetMonitor,
  type WarningCallback,
  type BreachCallback,
  type MonitorConfig,
} from "./monitor";

// Budget Enforcer
export {
  BudgetEnforcer,
  createBudgetEnforcer,
  KmaxEnforcer,
  createKmaxEnforcer,
  type ExecutionLoop,
  type HaltCallback,
  type PreCheckCallback,
  type EnforcerConfig,
  type EnforcementResult,
} from "./enforcer";

// State Capture
export {
  StateCapture,
  createStateCapture,
  type StateCaptureConfig,
} from "./state-capture";