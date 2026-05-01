/**
 * Budget Tracking Type Definitions
 * Story 3.2: Enforce Bounded Autonomy and Budget Caps
 */

/**
 * Resource category for budget tracking
 */
export type BudgetCategory = "tokens" | "tool_calls" | "time_ms" | "cost_usd" | "steps";

/**
 * Budget allocation level
 */
export type BudgetScope = "session" | "task" | "agent";

/**
 * Budget limit configuration
 */
export interface BudgetLimits {
  /** Maximum LLM tokens (input + output) */
  maxTokens: number;
  /** Maximum tool invocations */
  maxToolCalls: number;
  /** Maximum execution time in milliseconds */
  maxTimeMs: number;
  /** Maximum estimated cost in USD */
  maxCostUsd: number;
  /** Maximum iteration/steps (Kmax) */
  maxSteps: number;
}

/**
 * Budget consumption snapshot
 */
export interface BudgetConsumption {
  /** Tokens consumed */
  tokens: number;
  /** Tool calls made */
  toolCalls: number;
  /** Time elapsed in milliseconds */
  timeMs: number;
  /** Estimated cost in USD */
  costUsd: number;
  /** Steps completed */
  steps: number;
}

/**
 * Budget warning thresholds
 */
export interface WarningThresholds {
  /** Soft warning at 80% consumed */
  warning80: boolean;
  /** Hard warning at 90% consumed */
  warning90: boolean;
}

/**
 * Budget status for each category
 */
export interface BudgetStatus {
  limits: BudgetLimits;
  consumption: BudgetConsumption;
  utilization: {
    tokens: number;
    toolCalls: number;
    timeMs: number;
    costUsd: number;
    steps: number;
  };
  warnings: {
    tokens: WarningThresholds;
    toolCalls: WarningThresholds;
    timeMs: WarningThresholds;
    costUsd: WarningThresholds;
    steps: WarningThresholds;
  };
}

/**
 * Session identifier for budget tracking
 */
export interface SessionId {
  /** Tenant isolation ID */
  groupId: string;
  /** Agent instance ID */
  agentId: string;
  /** Session instance ID */
  sessionId: string;
}

/**
 * Budget breach detail
 */
export interface BudgetBreach {
  category: BudgetCategory;
  consumed: number;
  limit: number;
  utilizationPercent: number;
  timestamp: Date;
}

/**
 * Halt reason for session termination
 */
export type HaltReason = 
  | { type: "kmax_exceeded"; currentStep: number; maxSteps: number }
  | { type: "token_limit"; consumed: number; limit: number }
  | { type: "tool_call_limit"; consumed: number; limit: number }
  | { type: "time_limit"; elapsedMs: number; limitMs: number }
  | { type: "cost_limit"; consumedUsd: number; limitUsd: number }
  | { type: "policy_violation"; reason: string }
  | { type: "critical_error"; error: string };

/**
 * Session state for forensic preservation
 */
export interface SessionState {
  /** Session identifiers */
  id: SessionId;
  /** When session started */
  startedAt: Date;
  /** When session halted (if applicable) */
  haltedAt?: Date;
  /** Current execution step */
  currentStep: number;
  /** Budget status at halt */
  budgetStatus: BudgetStatus;
  /** Halt reason (if applicable) */
  haltReason?: HaltReason;
  /** All tool calls made */
  toolCallHistory: ToolCallRecord[];
  /** Last 100 reasoning steps */
  reasoningHistory: ReasoningStep[];
  /** Last error encountered */
  lastError?: ErrorRecord;
  /** Session metadata */
  metadata: Record<string, unknown>;
}

/**
 * Tool call record for history
 */
export interface ToolCallRecord {
  step: number;
  toolName: string;
  input: Record<string, unknown>;
  output?: Record<string, unknown>;
  error?: string;
  timestamp: Date;
  durationMs: number;
  success: boolean;
}

/**
 * Reasoning step for history
 */
export interface ReasoningStep {
  step: number;
  thought: string;
  decision?: string;
  timestamp: Date;
}

/**
 * Error record for session state
 */
export interface ErrorRecord {
  step: number;
  message: string;
  stack?: string;
  timestamp: Date;
  recoverable: boolean;
}

/**
 * Forensic snapshot stored in PostgreSQL
 */
export interface ForensicSnapshot {
  /** Database ID */
  id: number;
  /** Session that was halted */
  sessionId: SessionId;
  /** When snapshot was taken */
  createdAt: Date;
  /** Halt reason */
  haltReason: HaltReason;
  /** Full state JSON */
  stateJson: string;
  /** Budget consumption report */
  budgetReport: BudgetConsumptionReport;
  /** Group ID for tenant isolation */
  groupId: string;
}

/**
 * Budget consumption report for storage
 */
export interface BudgetConsumptionReport {
 /** Token usage breakdown */
  tokens: {
    input: number;
    output: number;
    total: number;
    percentUtilized: number;
  };
  /** Tool call breakdown */
  toolCalls: {
    total: number;
    byTool: Record<string, number>;
    successRate: number;
  };
  /** Time breakdown */
  time: {
    totalMs: number;
    breakdownByPhase: Record<string, number>;
  };
  /** Cost breakdown */
  cost: {
    totalUsd: number;
    breakdownByModel: Record<string, number>;
  };
  /** Steps completed */
  steps: {
    total: number;
    limit: number;
    percentUtilized: number;
  };
}

/**
 * LLM pricing data for cost estimation
 */
export interface LLMPricing {
  model: string;
  inputCostPer1k: number;
  outputCostPer1k: number;
}

/**
 * Token usage breakdown
 */
export interface TokenUsage {
  inputTokens: number;
  outputTokens: number;
  model: string;
}

/**
 * Budget configuration schema
 */
export interface BudgetConfig {
  /** Default limits for new sessions */
  defaults: BudgetLimits;
  /** Per-scope overrides */
  scopeOverrides?: {
    session?: Partial<BudgetLimits>;
    task?: Partial<BudgetLimits>;
    agent?: Partial<BudgetLimits>;
  };
  /** Warning thresholds (0-1 ratios) */
  warningThresholds: {
    warning80: number;
    warning90: number;
  };
  /** Pricing data for cost estimation */
  pricing: LLMPricing[];
  /** Whether to enable soft warnings */
  enableWarnings: boolean;
  /** Whether to halt on breach (vs just alert) */
  haltOnBreach: boolean;
}

/**
 * Default budget limits
 */
export const DEFAULT_BUDGET_LIMITS: BudgetLimits = {
  maxTokens: 100000,
  maxToolCalls: 60,
  maxTimeMs: 86400000, // 24 hours — agents doing real work need time
  maxCostUsd: 50.0,
  maxSteps: 1000,
};

/**
 * Default budget configuration
 */
export const DEFAULT_BUDGET_CONFIG: BudgetConfig = {
  defaults: DEFAULT_BUDGET_LIMITS,
  warningThresholds: {
    warning80: 0.8,
    warning90: 0.9,
  },
  pricing: [
    { model: "gpt-4o", inputCostPer1k: 0.0025, outputCostPer1k: 0.01 },
    { model: "gpt-4o-mini", inputCostPer1k: 0.00015, outputCostPer1k: 0.0006 },
    { model: "claude-3-5-sonnet-20241022", inputCostPer1k: 0.003, outputCostPer1k: 0.015 },
    { model: "claude-3-5-haiku-20241022", inputCostPer1k: 0.0008, outputCostPer1k: 0.004 },
  ],
  enableWarnings: true,
  haltOnBreach: true,
};

/**
 * Calculate cost from token usage
 */
export function estimateCost(
  usage: TokenUsage,
  pricing: LLMPricing[],
): number {
  const modelPricing = pricing.find((p) => p.model === usage.model);
  if (!modelPricing) {
    console.warn(`No pricing found for model ${usage.model}, using 0 cost`);
    return 0;
  }

  const inputCost = (usage.inputTokens / 1000) * modelPricing.inputCostPer1k;
  const outputCost = (usage.outputTokens / 1000) * modelPricing.outputCostPer1k;
  return inputCost + outputCost;
}

/**
 * Calculate utilization percentage
 */
export function calculateUtilization(consumed: number, limit: number): number {
  if (limit <= 0) return 0;
  return Math.min(100, (consumed / limit) * 100);
}

/**
 * Check if a threshold is breached
 */
export function isThresholdBreached(
  consumed: number,
  limit: number,
  threshold: number,
): boolean {
  return calculateUtilization(consumed, limit) >= threshold * 100;
}

/**
 * Create empty budget consumption
 */
export function createEmptyConsumption(): BudgetConsumption {
  return {
    tokens: 0,
    toolCalls: 0,
    timeMs: 0,
    costUsd: 0,
    steps: 0,
  };
}

/**
 * Create session state with defaults
 */
export function createSessionState(
  sessionId: SessionId,
  limits: BudgetLimits = DEFAULT_BUDGET_LIMITS,
): SessionState {
  return {
    id: sessionId,
    startedAt: new Date(),
    currentStep: 0,
    budgetStatus: {
      limits,
      consumption: createEmptyConsumption(),
      utilization: {
        tokens: 0,
        toolCalls: 0,
        timeMs: 0,
        costUsd: 0,
        steps: 0,
      },
      warnings: {
        tokens: { warning80: false, warning90: false },
        toolCalls: { warning80: false, warning90: false },
        timeMs: { warning80: false, warning90: false },
        costUsd: { warning80: false, warning90: false },
        steps: { warning80: false, warning90: false },
      },
    },
    toolCallHistory: [],
    reasoningHistory: [],
    metadata: {},
  };
}