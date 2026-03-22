/**
 * Lifecycle Module
 * 
 * Manages insight lifecycle state transitions with policy-based automation.
 */

// Types
export type {
  LifecycleState,
  TransitionReason,
  TransitionEvent,
  LifecyclePolicy,
  TransitionRule,
  TransitionCondition,
  PolicyConfig,
  PolicyGroupConfig,
  LifecycleInsight,
  TransitionValidation,
  TransitionResult,
  HistoryQuery,
  HistoryResult,
  PolicyEvaluation,
  RecommendedTransition,
  BatchEvaluation,
} from './types'

// Constants and functions from types
export {
  LIFECYCLE_STATES,
  isLifecycleState,
  TRANSITION_REASONS,
} from './types'

// State Machine
export {
  LifecycleStateMachine,
  isValidTransition,
  getAllowedReasons,
  isValidReason,
  createStateMachine,
} from './state-machine'

// Policies
export {
  PolicyManager,
  DEFAULT_POLICY_CONFIG,
  createPolicyManager,
  isAutomaticTransition,
  isManualTransition,
  getStatePriority,
  isTerminalState,
  requiresManualIntervention,
} from './policies'

// History
export {
  HistoryManager,
  InMemoryHistoryStore,
  createHistoryManager,
  createHistoryManagerWithStore,
  createInMemoryStore,
} from './history'
export type { HistoryStore } from './history'