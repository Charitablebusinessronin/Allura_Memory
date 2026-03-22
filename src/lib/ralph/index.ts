/**
 * Ralph Loop Module Exports
 * Story 3.4: Execute Iterative Ralph Development Loops
 */

// Types
export type {
  CompletionPromise,
  ErrorClassification,
  CorrectionStrategy,
  RalphError,
  CorrectionDecision,
  RalphPhase,
  RalphStep,
  RalphPlan,
  PlanStep,
  Perception,
  StuckPattern,
  AdaptationDecision,
  RalphConfig,
  BackoffStrategy,
  RalphState,
  RalphResult,
  PerceiveFunction,
  PlanFunction,
  ActFunction,
  CheckFunction,
  AdaptFunction,
  RalphCallbacks,
  RalphStatus,
} from "./types";

// Constants and helpers
export {
  DEFAULT_RALPH_CONFIG,
  DEFAULT_BACKOFF_STRATEGY,
  createEmptyPerception,
  createInitialRalphState,
  createRalphError,
  classifyError,
  isRecoverableError,
} from "./types";

// Completion Detector
export {
  CompletionDetector,
  createCompletionDetector,
  checkKmax,
  checkCompletionAndKmax,
  type CompletionCheckResult,
  type CompletionDetectorConfig,
  type CombinedCheckResult,
} from "./completion-detector";

// Self Corrector
export {
  SelfCorrector,
  createSelfCorrector,
  defaultSelfCorrector,
  type SelfCorrectorConfig,
  type ErrorAnalysis,
} from "./self-corrector";

// Ralph Loop
export {
  RalphLoop,
  createRalphLoop,
  runRalphLoop,
} from "./loop";