/**
 * Termination Types - Fail-Safe Return Path
 * Story 3.3: Implement Fail-Safe Termination and Escalation
 */

import type { HaltReason, SessionState, ToolCallRecord } from "../budget/types";

/**
 * Execution step outcome classification
 */
export type StepOutcome = 
  | "success"
  | "partial_success"
  | "failure"
  | "blocked"
  | "timeout"
  | "policy_denied"
  | "budget_exceeded";

/**
 * Stuck pattern detection result
 */
export interface StuckPattern {
  /** Pattern type detected */
  type: "repeated_action" | "no_progress" | "circular_reasoning" | "tool_failure_loop" | "policy_rejection_loop";
  /** Description of the pattern */
  description: string;
  /** When the pattern was first detected */
  detectedAt: Date;
  /** Affected step numbers */
  affectedSteps: number[];
  /** Severity: 1-5, 5 being most severe */
  severity: number;
  /** Suggested resolution */
  suggestedResolution: string;
}

/**
 * Bottleneck classification
 */
export type BottleneckType =
  | "resource_limit"
  | "tool_failure"
  | "policy_violation"
  | "missing_dependency"
  | "invalid_input"
  | "external_error"
  | "ambiguous_goal"
  | "state_corruption"
  | "concurrency_issue"
  | "timeout";

/**
 * Bottleneck detail
 */
export interface Bottleneck {
  /** Bottleneck classification */
  type: BottleneckType;
  /** What resource or tool was affected */
  affected: string;
  /** Description of the bottleneck */
  description: string;
  /** Step where bottleneck occurred */
  step: number;
  /** Timestamp */
  timestamp: Date;
  /** Whether it's recoverable */
  recoverable: boolean;
  /** Suggested resolution */
  resolution?: string;
}

/**
 * Attempted step record with detailed tracking
 */
export interface AttemptedStep {
  /** Step number in execution */
  step: number;
  /** When the step started */
  startedAt: Date;
  /** When the step completed */
  completedAt?: Date;
  /** Action taken */
  action: string;
  /** Tool used (if applicable) */
  tool?: string;
  /** Input provided */
  input?: Record<string, unknown>;
  /** Result of the step */
  result?: Record<string, unknown>;
  /** Outcome classification */
  outcome: StepOutcome;
  /** Duration in milliseconds */
  durationMs: number;
  /** Whether this step can be retried */
  retryable: boolean;
  /** Error message if failed */
  errorMessage?: string;
}

/**
 * Partial result with completion status
 */
export interface PartialResult {
  /** Identifier for this result */
  id: string;
  /** Type of result */
  type: "artifact" | "data" | "state" | "output" | "intermediate";
  /** Description of what was produced */
  description: string;
  /** The actual partial result */
  value: unknown;
  /** Completion percentage (0-100) */
  completionPercent: number;
  /** Whether this result is usable */
  isUsable: boolean;
  /** Timestamp when created */
  createdAt: Date;
}

/**
 * Progress summary report
 * Main artifact generated when termination occurs
 */
export interface ProgressSummary {
  /** Unique summary ID */
  id: string;
  /** Session that was terminated */
  sessionId: {
    groupId: string;
    agentId: string;
    sessionId: string;
  };
  /** When summary was generated */
  generatedAt: Date;

  /** GOAL: What the agent was trying to accomplish */
  goal: {
    /** Original task description */
    description: string;
    /** Type of task */
    type: string;
    /** Success criteria that were defined */
    successCriteria: string[];
    /** Any constraints that were set */
    constraints: string[];
  };

  /** PROGRESS: How far did it get */
  progress: {
    /** Steps completed */
    stepsCompleted: number;
    /** Steps remaining (estimated) */
    stepsRemaining?: number;
    /** Total step budget */
    stepBudget: number;
    /** Percentage complete (0-100) */
    percentComplete: number;
    /** Token consumption */
    tokensUsed: number;
    /** Token budget */
    tokenBudget: number;
    /** Time elapsed in milliseconds */
    timeElapsedMs: number;
    /** Time budget in milliseconds */
    timeBudgetMs: number;
    /** Budget utilization summary */
    budgetUtilization: {
      tokens: number;
      toolCalls: number;
      time: number;
      cost: number;
      steps: number;
    };
  };

  /** BOTTLENECKS: What blocked progress */
  bottlenecks: Bottleneck[];

  /** ATTEMPTED STEPS: What was tried */
  attemptedSteps: AttemptedStep[];

  /** STUCK PATTERNS: Detected stuck patterns */
  stuckPatterns: StuckPattern[];

  /** PARTIAL RESULTS: What was accomplished */
  partialResults: PartialResult[];

  /** TERMINATION: Why it stopped */
  termination: {
    /** Halt reason from budget enforcer */
    reason: HaltReason;
    /** Whether termination was expected */
    expected: boolean;
    /** Whether it can be resumed */
    resumable: boolean;
    /** Human-readable explanation */
    explanation: string;
  };

  /** RECOMMENDATIONS: What to do next */
  recommendations: string[];

  /** TRACE REF: Link to forensic trace */
  traceRef: string;

  /** Group ID for tenant isolation */
  groupId: string;
}

/**
 * Human-readable summary format
 */
export interface HumanReadableSummary {
  /** Markdown-formatted summary */
  markdown: string;
  /** Plain text summary */
  text: string;
  /** JSON summary for programmatic use */
  json: ProgressSummary;
  /** One-line summary for notifications */
  oneLiner: string;
}

/**
 * Escalation ticket for Mission Control
 */
export interface EscalationTicket {
  /** Unique ticket ID */
  id: string;
  /** Summary ID this escalation is for */
  summaryId: string;
  /** When escalation was created */
  createdAt: Date;
  /** Priority: low, medium, high, critical */
  priority: "low" | "medium" | "high" | "critical";
  /** Title/subject */
  title: string;
  /** Description */
  description: string;
  /** Session information */
  session: {
    groupId: string;
    agentId: string;
    sessionId: string;
  };
  /** Why escalation is needed */
  escalationReason: string;
  /** References to traces */
  traceRefs: string[];
  /** Suggested actions */
  suggestedActions: string[];
  /** Current status */
  status: "open" | "acknowledged" | "in_progress" | "resolved" | "dismissed";
  /** Assigned reviewer (if any) */
  assignedTo?: string;
  /** Resolution (if resolved) */
  resolution?: {
    action: "takeover" | "restart" | "modify_budget" | "modify_policy" | "cancel";
    reason: string;
    resolvedBy: string;
    resolvedAt: Date;
  };
  /** Notification channels used */
  notifications: NotificationRecord[];
}

/**
 * Notification record
 */
export interface NotificationRecord {
  /** Channel used */
  channel: "email" | "slack" | "in_app" | "webhook";
  /** Recipient */
  recipient: string;
  /** When notification was sent */
  sentAt: Date;
  /** Whether it was successful */
  success: boolean;
  /** Error message if failed */
  errorMessage?: string;
}

/**
 * Escalation configuration
 */
export interface EscalationConfig {
  /** Enable escalation */
  enabled: boolean;
  /** Notification channels to use */
  channels: EscalationChannel[];
  /** Priority thresholds for escalation */
  priorityThresholds: {
    budgetUtilPercent: number;
    errorCount: number;
    stuckPatternSeverity: number;
  };
  /** Mission Control endpoint */
  missionControlEndpoint?: string;
  /** Webhook URL for external notifications */
  webhookUrl?: string;
  /** Email recipients */
  emailRecipients?: string[];
  /** Slack channel */
  slackChannel?: string;
}

/**
 * Escalation channel configuration
 */
export interface EscalationChannel {
  type: "email" | "slack" | "in_app" | "webhook";
  enabled: boolean;
  config: Record<string, unknown>;
}

/**
 * Progress tracking configuration
 */
export interface ProgressTrackerConfig {
  /** Maximum steps to track in history */
  maxStepHistory: number;
  /** Maximum reasoning steps to keep */
  maxReasoningHistory: number;
  /** Enable stuck pattern detection */
  enableStuckDetection: boolean;
  /** Thresholds for stuck detection */
  stuckThresholds: {
    repeatedActionCount: number;
    noProgressSteps: number;
    circularReasoningDepth: number;
  };
}

/**
 * Summary generation options
 */
export interface SummaryGenerationOptions {
  /** Include all step history (vs just last N) */
  includeFullHistory: boolean;
  /** Include tool call inputs */
  includeToolInputs: boolean;
  /** Include tool call outputs */
  includeToolOutputs: boolean;
  /** Maximum length for text summaries */
  maxTextLength: number;
  /** Format for output */
  format: "json" | "markdown" | "text" | "all";
}

/**
 * Default progress tracking configuration
 */
export const DEFAULT_PROGRESS_TRACKER_CONFIG: ProgressTrackerConfig = {
  maxStepHistory: 1000,
  maxReasoningHistory: 100,
  enableStuckDetection: true,
  stuckThresholds: {
    repeatedActionCount: 3,
    noProgressSteps: 5,
    circularReasoningDepth: 3,
  },
};

/**
 * Default escalation configuration
 */
export const DEFAULT_ESCALATION_CONFIG: EscalationConfig = {
  enabled: true,
  channels: [
    { type: "in_app", enabled: true, config: {} },
  ],
  priorityThresholds: {
    budgetUtilPercent: 90,
    errorCount: 5,
    stuckPatternSeverity: 4,
  },
};

/**
 * Default summary generation options
 */
export const DEFAULT_SUMMARY_OPTIONS: SummaryGenerationOptions = {
  includeFullHistory: false,
  includeToolInputs: false,
  includeToolOutputs: false,
  maxTextLength: 10000,
  format: "all",
};