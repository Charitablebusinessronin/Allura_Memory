import type { EventInsert, EventRecord, OutcomeInsert } from "../postgres/queries/insert-trace";

/**
 * ADAS Type Definitions
 * Story 2.1: Implement Domain Evaluation Harness
 */

/**
 * Agent Design candidate representation
 * This is a serializable representation of an agent architecture
 * that can be evaluated by the harness
 */
export interface AgentDesign {
  /** Unique identifier for this design candidate */
  design_id: string;
  /** Human-readable name for the design */
  name: string;
  /** Version of the design (for iteration tracking) */
  version: string;
  /** Target domain this design is optimized for */
  domain: string;
  /** Description of the agent architecture */
  description: string;
  /** Design configuration (prompts, tools, parameters) */
  config: AgentDesignConfig;
  /** Design metadata (createdAt, createdBy, etc.) */
  metadata?: AgentDesignMetadata;
}

/**
 * Agent design configuration
 * Contains the actual architectural decisions
 */
export interface AgentDesignConfig {
  /** System prompt or instructions for the agent */
  systemPrompt?: string;
  /** Tools available to the agent */
  tools?: AgentTool[];
  /** Model configuration */
  model?: ModelConfig;
  /** Reasoning strategy (CoT, ReAct, etc.) */
  reasoningStrategy?: ReasoningStrategy;
  /** Additional parameters */
  parameters?: Record<string, unknown>;
}

/**
 * Tool definition for an agent
 */
export interface AgentTool {
  name: string;
  description: string;
  inputSchema?: Record<string, unknown>;
}

/**
 * Model tier classification
 * Stable: proven models used for baseline comparisons
 * Experimental: latest models, opt-in per search
 */
export type ModelTier = "stable" | "experimental";

/**
 * Model configuration
 */
export interface ModelConfig {
  provider: string;
  modelId: string;
  temperature?: number;
  maxTokens?: number;
  topP?: number;
  tier: ModelTier;
  /** Human-readable description of what this model excels at */
  description?: string;
  /** Supports vision/image inputs */
  supportsVision?: boolean;
  /** Supports function calling / tools */
  supportsTools?: boolean;
}

/**
 * Reasoning strategy types
 */
export type ReasoningStrategy = "cot" | "react" | "plan-and-execute" | "reflexion" | "custom";

/**
 * Design metadata
 */
export interface AgentDesignMetadata {
  createdAt: Date;
  createdBy?: string;
  parentDesignId?: string;
  iterationNumber?: number;
  tags?: string[];
}

/**
 * Evaluation metrics for a candidate agent design
 * These form the structured score from AC1
 */
export interface EvaluationMetrics {
  /** Accuracy score (0.0 to 1.0) - measured against ground truth or heuristics */
  accuracy: number;
  /** Cost in USD - calculated from token usage and API pricing */
  cost: number;
  /** Latency in milliseconds - end-to-end execution time */
  latency: number;
  /** Composite score - weighted average of metrics */
  composite: number;
  /** Token usage breakdown */
  tokens?: TokenUsage;
  /** Additional context about the evaluation */
  details?: EvaluationDetails;
}

/**
 * Token usage tracking for cost calculation
 */
export interface TokenUsage {
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  /** Cost breakdown by token type */
  promptCost?: number;
  completionCost?: number;
}

/**
 * Detailed evaluation context
 */
export interface EvaluationDetails {
  /** Number of test cases executed */
  testCasesExecuted?: number;
  /** Number of test cases passed */
  testCasesPassed?: number;
  /** Error messages from evaluation */
  errors?: string[];
  /** Warnings during evaluation */
  warnings?: string[];
  /** Custom domain-specific metrics */
  customMetrics?: Record<string, number>;
}

/**
 * Evaluation result combining design and metrics
 */
export interface EvaluationResult {
  /** The candidate design that was evaluated */
  design: AgentDesign;
  /** Computed metrics */
  metrics: EvaluationMetrics;
  /** Run ID for this evaluation (links to adas_runs table) */
  runId: string;
  /** Group ID for tenant isolation */
  groupId: string;
  /** Timestamp of evaluation */
  evaluatedAt: Date;
  /** Whether the evaluation passed minimal thresholds */
  passed: boolean;
  /** Detailed evaluation context */
  details?: EvaluationDetails;
}

/**
 * Comparison ranking result
 * Used for AC3 - ranking candidates by composite score
 */
export interface CandidateRanking {
  /** Design ID */
  designId: string;
  /** Design name */
  name: string;
  /** Composite score */
  composite: number;
  /** Accuracy score */
  accuracy: number;
  /** Cost in USD */
  cost: number;
  /** Latency in ms */
  latency: number;
  /** Rank position (1 = best) */
  rank: number;
}

/**
 * Domain configuration for evaluation
 * Configurable per-domain evaluation criteria from Task 1.2.3
 */
export interface DomainConfig {
  /** Domain identifier */
  domainId: string;
  /** Domain name */
  name: string;
  /** Description of the domain */
  description?: string;
  /** Ground truth for accuracy evaluation */
  groundTruth?: GroundTruthCase[];
  /** Accuracy weight in composite score (default: 0.5) */
  accuracyWeight?: number;
  /** Cost weight in composite score (default: 0.25) */
  costWeight?: number;
  /** Latency weight in composite score (default: 0.25) */
  latencyWeight?: number;
  /** Maximum acceptable latency in ms */
  maxLatency?: number;
  /** Maximum acceptable cost in USD */
  maxCost?: number;
  /** Minimum acceptable accuracy (0-1) */
  minAccuracy?: number;
  /** Custom evaluation function */
  customEvaluator?: string;
}

/**
 * Ground truth test case
 */
export interface GroundTruthCase {
  /** Test case ID */
  id: string;
  /** Input to the agent */
  input: string;
  /** Expected output or behavior */
  expectedOutput: string;
  /** Evaluation criteria */
  criteria?: string;
  /** Test case weight */
  weight?: number;
}

/**
 * Forward function signature
 * The core function that agents implement to solve domain tasks
 * This is what the harness evaluates
 */
export type ForwardFn<I = unknown, O = unknown> = (input: I) => Promise<O>;

/**
 * Evaluation harness configuration
 */
export interface EvaluationHarnessConfig {
  /** Group ID for tenant isolation */
  groupId: string;
  /** Domain configuration */
  domain: DomainConfig;
  /** Maximum time per evaluation in ms */
  timeout?: number;
  /** Enable detailed logging */
  verbose?: boolean;
  /** Cache evaluation results */
  cacheResults?: boolean;
}

/**
 * ADAS run record - mirrors adas_runs table
 */
export interface ADASRun {
  run_id: string;
  group_id: string;
  domain: string;
  config: Record<string, unknown>;
  status: "running" | "completed" | "failed" | "cancelled";
  best_design_id?: string;
  best_score?: number;
  started_at: Date;
  completed_at?: Date;
}

/**
 * ADAS run insert payload for PostgreSQL
 */
export interface ADASRunInsert {
  group_id: string;
  run_id: string;
  domain: string;
  config?: Record<string, unknown>;
  status?: "running" | "completed" | "failed" | "cancelled";
}

/**
 * ADAS run result record from PostgreSQL
 */
export interface ADASRunRecord {
  id: number;
  group_id: string;
  run_id: string;
  domain: string;
  config: Record<string, unknown>;
  status: string;
  best_design_id: string | null;
  best_score: number | null;
  started_at: Date;
  completed_at: Date | null;
  inserted_at: Date;
}

/**
 * Evaluation event types for tracking in PostgreSQL
 */
export type EvaluationEventType =
  | "evaluation_started"
  | "evaluation_completed"
  | "evaluation_failed"
  | "metrics_computed"
  | "candidate_ranked";

/**
 * Evaluation event insert payload
 */
export interface EvaluationEventInsert extends EventInsert {
  event_type: EvaluationEventType;
  agent_id: string;
  workflow_id?: string;
  metadata: {
    runId: string;
    designId: string;
    domain: string;
    [key: string]: unknown;
  };
  outcome?: {
    metrics?: Partial<EvaluationMetrics>;
    error?: string;
    [key: string]: unknown;
  };
}

/**
 * Evaluation outcome insert payload
 */
export interface EvaluationOutcomeInsert extends OutcomeInsert {
  outcome_type: "evaluation_result";
  data: {
    designId: string;
    metrics: EvaluationMetrics;
    passed: boolean;
    rank?: number;
  };
}