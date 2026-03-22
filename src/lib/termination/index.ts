/**
 * Termination Module Exports
 * Story 3.3: Implement Fail-Safe Termination and Escalation
 */

// Types
export type {
  StepOutcome,
  StuckPattern,
  BottleneckType,
  Bottleneck,
  AttemptedStep,
  PartialResult,
  ProgressSummary,
  HumanReadableSummary,
  EscalationTicket,
  NotificationRecord,
  EscalationConfig,
  EscalationChannel,
  ProgressTrackerConfig,
  SummaryGenerationOptions,
} from "./types";

// Constants
export {
  DEFAULT_PROGRESS_TRACKER_CONFIG,
  DEFAULT_ESCALATION_CONFIG,
  DEFAULT_SUMMARY_OPTIONS,
} from "./types";

// Progress Tracker
export {
  ProgressTracker,
  createProgressTracker,
} from "./progress-tracker";

// Summary Generator
export {
  SummaryGenerator,
  createSummaryGenerator,
  type SummaryGeneratorConfig,
} from "./summary-generator";

// Escalation Service
export {
  EscalationService,
  createEscalationService,
  escalateTerminatedSession,
  clearTicketStore,
  type EscalationServiceConfig,
} from "./escalation";