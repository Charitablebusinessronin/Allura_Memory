/**
 * ADAS (Automated Design of Agent Systems) Module
 * Story 2.1: Implement Domain Evaluation Harness
 * Story 2.2: Execute Meta Agent Search Loop
 *
 * This module provides the evaluation harness for measuring candidate agent
 * designs against objective metrics (accuracy, cost, latency),
 * and the meta agent search loop for discovering novel agent architectures.
 */

export type {
  AgentDesign,
  AgentDesignConfig,
  AgentDesignMetadata,
  AgentTool,
  ModelConfig,
  ReasoningStrategy,
  EvaluationMetrics,
  TokenUsage,
  EvaluationDetails,
  EvaluationResult,
  CandidateRanking,
  DomainConfig,
  GroundTruthCase,
  ForwardFn,
  EvaluationHarnessConfig,
  ADASRun,
  ADASRunInsert,
  ADASRunRecord,
  EvaluationEventType,
  EvaluationEventInsert,
  EvaluationOutcomeInsert,
} from "./types";

export {
  EvaluationHarness,
  createEvaluationHarness,
  evaluateCandidate,
  evaluateAndRankCandidates,
} from "./evaluation-harness";

export {
  TokenCounter,
  LatencyTracker,
  calculateCost,
  calculateAccuracy,
  calculateCompositeScore,
  buildMetrics,
  compareMetrics,
  rankCandidates,
  meetsThresholds,
  aggregateMetrics,
  MODEL_PRICING,
} from "./metrics";

// Agent Design exports (Story 2.2)
export type { SearchSpace } from "./agent-design";
export type { ModelTier } from "./types";
export {
  PROMPT_TEMPLATES,
  TOOL_LIBRARY,
  MODEL_CONFIGS,
  REASONING_STRATEGIES,
  DEFAULT_SEARCH_SPACE,
  createAgentDesign,
  generateSystemPrompt,
  generateAgentCode,
  serializeDesign,
  deserializeDesign,
  cloneDesign,
  generateRandomDesign,
  calculateDiversity,
  getModelsByTier,
  getStableModels,
  getExperimentalModels,
} from "./agent-design";

// Mutation exports (Story 2.2)
export type { MutationConfig, MutationType, MutationRecord } from "./mutations";
export {
  DEFAULT_MUTATION_CONFIG,
  applyRandomMutation,
  applyMutations,
  mutatePrompt,
  addTool,
  removeTool,
  changeModel,
  changeStrategy,
  mutateTemperature,
  mutateMaxTokens,
  crossoverDesigns,
} from "./mutations";

// Search Loop exports (Story 2.2)
export type { SearchConfig, SearchIteration, SearchResult } from "./search-loop";
export {
  MetaAgentSearch,
  createSearchConfig,
  runMetaAgentSearch,
} from "./search-loop";

// Sandbox exports (Story 2.3)
export type {
  SandboxOptions,
  ExecutionResult,
  ResourceUsage,
  KmaxState,
  SandboxExecutionRequest,
} from "./sandbox";
export {
  SandboxExecutor,
  createSandboxExecutor,
  executeInSandbox,
  getDefaultSandboxExecutor,
  KmaxCounter,
  DEFAULT_SANDBOX_OPTIONS,
  DEFAULT_KMAX_STEPS,
  SANDBOX_IMAGE,
} from "./sandbox";

// Safety Monitor exports (Story 2.3)
export type {
  ViolationType,
  SafetyViolation,
  ResourceUsageStats,
  ResourceLimits,
  SafetyCheckResult,
} from "./safety-monitor";
export {
  SafetyMonitor,
  createSafetyMonitor,
  shouldTerminateExecution,
  formatViolation,
  DEFAULT_RESOURCE_LIMITS,
} from "./safety-monitor";

// Sandboxed Evaluation exports (Story 2.3)
export type { SandboxedEvaluationConfig } from "./sandboxed-evaluation";
export {
  SandboxedEvaluationHarness,
  createSandboxedEvaluationHarness,
  evaluateCandidateInSandbox,
  createSandboxedForwardFn,
  executeCodeInSandbox,
  batchEvaluateInSandbox,
} from "./sandboxed-evaluation";