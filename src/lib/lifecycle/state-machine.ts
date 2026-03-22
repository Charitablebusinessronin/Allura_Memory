/**
 * Lifecycle State Machine
 * 
 * Manages insight lifecycle state transitions with validation
 * and immutability guarantees.
 */

import {
  LifecycleState,
  TransitionReason,
  TransitionEvent,
  TransitionValidation,
  TransitionResult,
  LIFECYCLE_STATES,
  isLifecycleState,
} from './types'

// =============================================================================
// State Transition Rules
// =============================================================================

/**
 * Type for allowed transitions map
 */
type TransitionMap = Map<LifecycleState, TransitionReason[]>

/**
 * Valid state transitions map
 * Maps from-state → to-state → allowed reasons
 */
const VALID_TRANSITIONS: Map<LifecycleState, TransitionMap> = new Map<LifecycleState, TransitionMap>([
  // Active → other states
  ['active', new Map<LifecycleState, TransitionReason[]>([
    ['degraded', ['confidence_drop', 'policy_evaluation', 'manual_override', 'revert']],
    ['expired', ['age_threshold', 'policy_evaluation', 'system_cleanup', 'manual_override', 'revert']],
    ['superseded', ['superseded_by_newer', 'manual_override', 'revert']],
    ['deprecated', ['manual_deprecation', 'policy_evaluation', 'manual_override', 'revert']],
  ])],
  
  // Degraded → other states
  ['degraded', new Map<LifecycleState, TransitionReason[]>([
    ['active', ['confidence_restore', 'manual_restoration', 'manual_override', 'revert']],
    ['expired', ['age_threshold', 'policy_evaluation', 'system_cleanup', 'manual_override']],
    ['deprecated', ['manual_deprecation', 'policy_evaluation', 'manual_override']],
  ])],
  
  // Expired → other states (limited transitions from terminal state)
  ['expired', new Map<LifecycleState, TransitionReason[]>([
    ['active', ['manual_restoration', 'manual_override', 'revert']],
    ['deprecated', ['manual_deprecation', 'manual_override']],
  ])],
  
  // Superseded → other states
  ['superseded', new Map<LifecycleState, TransitionReason[]>([
    ['active', ['manual_restoration', 'manual_override', 'revert']],
    ['expired', ['age_threshold', 'policy_evaluation', 'system_cleanup', 'manual_override']],
    ['deprecated', ['manual_deprecation', 'policy_evaluation', 'manual_override']],
  ])],
  
  // Deprecated → other states
  ['deprecated', new Map<LifecycleState, TransitionReason[]>([
    ['active', ['manual_restoration', 'manual_override', 'revert']],
  ])],
  
  // Reverted is a special meta-state, transitions from it use previous state context
  ['reverted', new Map<LifecycleState, TransitionReason[]>([
    ['active', ['manual_restoration', 'manual_override']],
    ['degraded', ['manual_override']],
    ['expired', ['manual_override']],
    ['superseded', ['manual_override']],
  ])],
])

/**
 * Check if a transition from one state to another is valid
 */
export function isValidTransition(
  fromState: LifecycleState | null,
  toState: LifecycleState
): boolean {
  // Initial state can only transition from null to active
  if (fromState === null) {
    return toState === 'active'
  }
  
  const fromMap = VALID_TRANSITIONS.get(fromState)
  if (!fromMap) return false
  
  return fromMap.has(toState)
}

/**
 * Get allowed reasons for a transition
 */
export function getAllowedReasons(
  fromState: LifecycleState | null,
  toState: LifecycleState
): TransitionReason[] {
  // Initial transition has no reason options
  if (fromState === null) {
    return toState === 'active' ? ['manual_override'] : []
  }
  
  const fromMap = VALID_TRANSITIONS.get(fromState)
  if (!fromMap) return []

  const reasons = fromMap.get(toState)
  return reasons ?? []
}

/**
 * Check if a reason is valid for a transition
 */
export function isValidReason(
  fromState: LifecycleState | null,
  toState: LifecycleState,
  reason: TransitionReason
): boolean {
  const allowedReasons = getAllowedReasons(fromState, toState)
  return allowedReasons.includes(reason)
}

// =============================================================================
// State Machine Class
// =============================================================================

/**
 * Lifecycle State Machine
 * 
 * Manages valid state transitions for insights.
 */
export class LifecycleStateMachine {
  private history: Map<string, TransitionEvent[]> = new Map()
  private currentState: Map<string, LifecycleState> = new Map()
  private idCounter: number = 0

  /**
   * Generate unique event ID
   */
  private generateEventId(): string {
    this.idCounter += 1
    return `transition-${Date.now()}-${this.idCounter}`
  }

  /**
   * Validate a transition
   */
  validateTransition(
    insightId: string,
    toState: LifecycleState,
    reason: TransitionReason
  ): TransitionValidation {
    // Validate target state
    if (!isLifecycleState(toState)) {
      return {
        valid: false,
        error: `Invalid target state: ${toState}`,
        allowedReasons: [],
      }
    }

    // Get current state
    const fromState = this.currentState.get(insightId) ?? null

    // Check transition validity
    if (!isValidTransition(fromState, toState)) {
      const validTargets = fromState === null 
        ? ['active'] 
        : Array.from(VALID_TRANSITIONS.get(fromState)?.keys() ?? [])
      
      return {
        valid: false,
        error: fromState === null
          ? `Initial transition must be to 'active', got '${toState}'`
          : `Invalid transition from '${fromState}' to '${toState}'. Valid targets: ${validTargets.join(', ')}`,
        allowedReasons: [],
      }
    }

    // Check reason validity
    const allowedReasons = getAllowedReasons(fromState, toState)
    if (!allowedReasons.includes(reason)) {
      return {
        valid: false,
        error: `Invalid reason '${reason}' for transition '${fromState ?? 'initial'}' → '${toState}'. Allowed: ${allowedReasons.join(', ') || 'none'}`,
        allowedReasons,
      }
    }

    return {
      valid: true,
      allowedReasons,
    }
  }

  /**
   * Execute a state transition
   */
  transition(
    insightId: string,
    toState: LifecycleState,
    reason: TransitionReason,
    options: {
      triggeredBy?: string
      details?: Record<string, unknown>
      policyId?: string
      confidence?: number
      ageDays?: number
    } = {}
  ): TransitionResult {
    const validation = this.validateTransition(insightId, toState, reason)
    
    if (!validation.valid) {
      return {
        success: false,
        event: null,
        error: validation.error,
        previousState: this.currentState.get(insightId) ?? null,
        newState: toState,
      }
    }

    const fromState = this.currentState.get(insightId) ?? null
    
    // Create transition event
    const event: TransitionEvent = {
      id: this.generateEventId(),
      insightId,
      fromState,
      toState,
      reason,
      timestamp: new Date(),
      triggeredBy: options.triggeredBy ?? 'system',
      details: options.details,
      policyId: options.policyId,
      confidence: options.confidence,
      ageDays: options.ageDays,
    }

    // Update state
    this.currentState.set(insightId, toState)

    // Record history
    const insightHistory = this.history.get(insightId) ?? []
    insightHistory.push(event)
    this.history.set(insightId, insightHistory)

    return {
      success: true,
      event,
      previousState: fromState,
      newState: toState,
    }
  }

  /**
   * Get current state for an insight
   */
  getCurrentState(insightId: string): LifecycleState | null {
    return this.currentState.get(insightId) ?? null
  }

  /**
   * Get history for an insight
   */
  getHistory(insightId: string): TransitionEvent[] {
    return this.history.get(insightId) ?? []
  }

  /**
   * Get all transitions for an insight (alias for getHistory)
   */
  getTransitions(insightId: string): TransitionEvent[] {
    return this.getHistory(insightId)
  }

  /**
   * Initialize an insight to active state
   */
  initializeInsight(
    insightId: string,
    options: {
      triggeredBy?: string
      confidence?: number
    } = {}
  ): TransitionResult {
    return this.transition(insightId, 'active', 'manual_override', {
      ...options,
      triggeredBy: options.triggeredBy ?? 'system',
    })
  }

  /**
   * Revert last transition
   */
  revertTransition(
    insightId: string,
    reason: TransitionReason = 'revert',
    options: {
      triggeredBy?: string
    } = {}
  ): TransitionResult {
    const history = this.getHistory(insightId)
    
    if (history.length === 0) {
      return {
        success: false,
        event: null,
        error: 'No transitions to revert',
        previousState: null,
        newState: this.currentState.get(insightId) ?? 'active',
      }
    }

    // Get the last transition
    const lastTransition = history[history.length - 1]
    
    if (!lastTransition.fromState) {
      return {
        success: false,
        event: null,
        error: 'Cannot revert initial transition',
        previousState: lastTransition.toState,
        newState: lastTransition.toState,
      }
    }

    // Validate the revert
    const validation = this.validateTransition(
      insightId,
      lastTransition.fromState,
      reason
    )

    if (!validation.valid) {
      return {
        success: false,
        event: null,
        error: validation.error,
        previousState: lastTransition.toState,
        newState: lastTransition.fromState,
      }
    }

    // Execute revert
    const result = this.transition(
      insightId,
      lastTransition.fromState,
      reason,
      {
        ...options,
        triggeredBy: options.triggeredBy ?? 'system',
        details: { revertedFrom: lastTransition.toState, revertedEventId: lastTransition.id },
      }
    )

    return result
  }

  /**
   * Get all insights in a specific state
   */
  getInsightsInState(state: LifecycleState): string[] {
    const insightIds: string[] = []
    for (const [insightId, currentState] of Array.from(this.currentState.entries())) {
      if (currentState === state) {
        insightIds.push(insightId)
      }
    }
    return insightIds
  }

  /**
   * Check if an insight exists
   */
  hasInsight(insightId: string): boolean {
    return this.currentState.has(insightId)
  }

  /**
   * Clear all state (for testing)
   */
  clear(): void {
    this.currentState.clear()
    this.history.clear()
    this.idCounter = 0
  }

  /**
   * Export state for persistence
   */
  export(): {
    states: Record<string, LifecycleState>
    history: Record<string, TransitionEvent[]>
  } {
    const states: Record<string, LifecycleState> = {}
    const history: Record<string, TransitionEvent[]> = {}

    for (const [insightId, state] of Array.from(this.currentState.entries())) {
      states[insightId] = state
    }

    for (const [insightId, events] of Array.from(this.history.entries())) {
      history[insightId] = [...events]
    }

    return { states, history }
  }

  /**
   * Import state from persistence
   */
  import(data: {
    states: Record<string, LifecycleState>
    history: Record<string, TransitionEvent[]>
  }): void {
    this.clear()

    for (const [insightId, state] of Object.entries(data.states)) {
      this.currentState.set(insightId, state)
    }

    for (const [insightId, events] of Object.entries(data.history)) {
      this.history.set(insightId, events.map(e => ({
        ...e,
        timestamp: new Date(e.timestamp),
      })))
    }
  }
}

// =============================================================================
// Factory Function
// =============================================================================

/**
 * Create a new lifecycle state machine
 */
export function createStateMachine(): LifecycleStateMachine {
  return new LifecycleStateMachine()
}

// =============================================================================
// Default Export
// =============================================================================

export default LifecycleStateMachine