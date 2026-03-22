/**
 * Lifecycle Types
 * 
 * Type definitions for insight lifecycle management.
 */

// =============================================================================
// Lifecycle States
// =============================================================================

/**
 * Valid lifecycle states for an insight
 * 
 * State progression:
 * - Active → Degraded (confidence drops)
 * - Active → Expired (age threshold exceeded)
 * - Active → Superseded (newer version created)
 * - Degraded → Expired (age threshold)
 * - Degraded → Active (confidence restored)
 * - Any → Deprecated (manual action)
 * - Deprecated → Active (manual restoration)
 * - Any → Reverted (undo last transition)
 */
export type LifecycleState = 
  | 'active'
  | 'degraded'
  | 'expired'
  | 'superseded'
  | 'deprecated'
  | 'reverted'

/**
 * All valid states as array for iteration
 */
export const LIFECYCLE_STATES: LifecycleState[] = [
  'active',
  'degraded',
  'expired',
  'superseded',
  'deprecated',
  'reverted',
]

/**
 * Check if a value is a valid lifecycle state
 */
export function isLifecycleState(value: unknown): value is LifecycleState {
  return typeof value === 'string' && LIFECYCLE_STATES.includes(value as LifecycleState)
}

// =============================================================================
// Transition Reasons
// =============================================================================

/**
 * Reason for a state transition
 */
export type TransitionReason = 
  | 'age_threshold'          // Exceeded maximum age
  | 'confidence_drop'       // Confidence fell below threshold
  | 'confidence_restore'    // Confidence restored above threshold
  | 'superseded_by_newer'   // Newer version created
  | 'manual_deprecation'    // Manual deprecation action
  | 'manual_restoration'    // Manual restoration action
  | 'policy_evaluation'     // Automated policy evaluation
  | 'system_cleanup'         // System cleanup process
  | 'revert'                // Revert previous transition
  | 'manual_override'       // Manual override

/**
 * All valid transition reasons
 */
export const TRANSITION_REASONS: TransitionReason[] = [
  'age_threshold',
  'confidence_drop',
  'confidence_restore',
  'superseded_by_newer',
  'manual_deprecation',
  'manual_restoration',
  'policy_evaluation',
  'system_cleanup',
  'revert',
  'manual_override',
]

// =============================================================================
// Transition Events
// =============================================================================

/**
 * A state transition event record
 */
export interface TransitionEvent {
  /** Unique event ID */
  id: string
  
  /** Insight ID this transition applies to */
  insightId: string
  
  /** Previous state (null for initial) */
  fromState: LifecycleState | null
  
  /** New state after transition */
  toState: LifecycleState
  
  /** Reason for transition */
  reason: TransitionReason
  
  /** Timestamp of transition */
  timestamp: Date
  
  /** User or system that triggered transition */
  triggeredBy: string
  
  /** Optional details about transition */
  details?: Record<string, unknown>
  
  /** Policy ID that triggered this (if applicable) */
  policyId?: string
  
  /** Confidence score at time of transition */
  confidence?: number
  
  /** Age in days at time of transition */
  ageDays?: number
}

// =============================================================================
// Policy Definitions
// =============================================================================

/**
 * Policy for automatic state transitions
 */
export interface LifecyclePolicy {
  /** Unique policy ID */
  id: string
  
  /** Policy name */
  name: string
  
  /** Policy description */
  description?: string
  
  /** Group this policy applies to (default = 'default') */
  groupId: string
  
  /** Policy is active */
  enabled: boolean
  
  /** Priority (higher = evaluated first) */
  priority: number
  
  /** Transition rules */
  rules: TransitionRule[]
  
  /** Created at timestamp */
  createdAt: Date
  
  /** Last updated timestamp */
  updatedAt: Date
}

/**
 * A single transition rule within a policy
 */
export interface TransitionRule {
  /** Rule ID */
  id: string
  
  /** Source state to transition from */
  fromState: LifecycleState
  
  /** Target state to transition to */
  toState: LifecycleState
  
  /** Conditions that must be met */
  conditions: TransitionCondition[]
  
  /** Reason to record for transition */
  reason: TransitionReason
  
  /** Rule is enabled */
  enabled: boolean
}

/**
 * Condition for a transition
 */
export interface TransitionCondition {
  /** Condition type */
  type: 'age_days' | 'confidence' | 'has_newer_version' | 'manual'
  
  /** Comparison operator */
  operator: 'gt' | 'gte' | 'lt' | 'lte' | 'eq' | 'neq'
  
  /** Value to compare against */
  value: number | string | boolean
  
  /** Negate the condition */
  negate?: boolean
}

// =============================================================================
// Policy Configuration
// =============================================================================

/**
 * Policy configuration from YAML/JSON
 */
export interface PolicyConfig {
  /** Default policies */
  default: PolicyGroupConfig
  
  /** Group-specific policies */
  groups?: Record<string, PolicyGroupConfig>
}

/**
 * Policy configuration for a group
 */
export interface PolicyGroupConfig {
  /** Age threshold for expiration (days) */
  expirationAgeDays: number
  
  /** Confidence threshold for degradation (%) */
  degradationThreshold: number
  
  /** Confidence threshold for restoration (%) */
  restorationThreshold: number
  
  /** Enable automatic degradation */
  enableAutoDegradation: boolean
  
  /** Enable automatic expiration */
  enableAutoExpiration: boolean
  
  /** Enable supersession detection */
  enableSupersession: boolean
  
  /** Custom rules to add */
  customRules?: Omit<TransitionRule, 'id'>[]
}

// =============================================================================
// Insight Interface Extensions
// =============================================================================

/**
 * Insight with lifecycle state
 */
export interface LifecycleInsight {
  /** Insight ID */
  id: string
  
  /** Current lifecycle state */
  lifecycleState: LifecycleState
  
  /** Version number */
  version: number
  
  /** Group ID for policy application */
  groupId: string
  
  /** Confidence score (0-100) */
  confidence: number
  
  /** Creation timestamp */
  createdAt: Date
  
  /** Last updated timestamp */
  updatedAt: Date
  
  /** Last state transition timestamp */
  lastStateChange: Date
  
  /** Current state duration in days */
  stateAgeDays: number
  
  /** ID of newer version (if superseded) */
  supersededBy?: string
  
  /** ID of older version (if this is newer) */
  supersedes?: string
  
  /** History of state transitions */
  history: TransitionEvent[]
}

// =============================================================================
// State Machine Types
// =============================================================================

/**
 * Result of validating a transition
 */
export interface TransitionValidation {
  /** Transition is valid */
  valid: boolean
  
  /** Error message if invalid */
  error?: string
  
  /** Allowed reasons for this transition */
  allowedReasons: TransitionReason[]
}

/**
 * State transition result
 */
export interface TransitionResult {
  /** Transition was successful */
  success: boolean
  
  /** Transition event created */
  event: TransitionEvent | null
  
  /** Error message if failed */
  error?: string
  
  /** Previous state */
  previousState: LifecycleState | null
  
  /** New state */
  newState: LifecycleState
}

// =============================================================================
// History Types
// =============================================================================

/**
 * Query options for history
 */
export interface HistoryQuery {
  /** Filter by insight ID */
  insightId?: string
  
  /** Filter by from state */
  fromState?: LifecycleState
  
  /** Filter by to state */
  toState?: LifecycleState
  
  /** Filter by reason */
  reason?: TransitionReason
  
  /** Filter by trigger source */
  triggeredBy?: string
  
  /** Start date */
  startDate?: Date
  
  /** End date */
  endDate?: Date
  
  /** Maximum results */
  limit?: number
  
  /** Offset for pagination */
  offset?: number
}

/**
 * History query result
 */
export interface HistoryResult {
  /** Matching events */
  events: TransitionEvent[]
  
  /** Total count of matching events */
  total: number
  
  /** Query execution time (ms) */
  durationMs: number
}

// =============================================================================
// Policy Evaluation Types
// =============================================================================

/**
 * Result of policy evaluation for an insight
 */
export interface PolicyEvaluation {
  /** Insight ID */
  insightId: string
  
  /** Insight evaluated */
  insight: LifecycleInsight
  
  /** Policies that were evaluated */
  policiesEvaluated: string[]
  
  /** Recommended transitions */
  transitions: RecommendedTransition[]
  
  /** Evaluation timestamp */
  evaluatedAt: Date
  
  /** Evaluation duration (ms) */
  durationMs: number
}

/**
 * A recommended transition from policy evaluation
 */
export interface RecommendedTransition {
  /** Target state */
  toState: LifecycleState
  
  /** Reason for transition */
  reason: TransitionReason
  
  /** Policy that triggered recommendation */
  policyId: string
  
  /** Rule that triggered recommendation */
  ruleId: string
  
  /** Confidence of recommendation */
  confidence: number
  
  /** Priority of transition */
  priority: number
}

/**
 * Batch evaluation result
 */
export interface BatchEvaluation {
  /** Total insights evaluated */
  totalEvaluated: number
  
  /** Transitions recommended */
  transitionsRecommended: number
  
  /** Errors encountered */
  errors: Array<{ insightId: string; error: string }>
  
  /** Evaluation results */
  results: PolicyEvaluation[]
  
  /** Total duration (ms) */
  durationMs: number
}