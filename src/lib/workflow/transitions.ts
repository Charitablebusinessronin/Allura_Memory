/**
 * Workflow State Transitions
 * 
 * Defines valid state transitions for the workflow state machine.
 * ALL transitions are append-only events, never UPDATE semantics.
 * 
 * State Machine Flow:
 * ```
 * planned → discovering → approved → executing → validating → complete
 *    ↓          ↓           ↓           ↓           ↓
 *  failed      failed      failed      failed      failed
 * ```
 * 
 * @module workflow/transitions
 */

import type {
  WorkflowState,
  ValidTransitions,
  TransitionValidation,
  WorkflowStateErrorCode,
} from './types';

/**
 * Valid state transitions map
 * Key = from state, Value = array of valid to states
 * 
 * Pattern: Each state can transition to specific next states,
 * OR to failed (unrecoverable error). Failed can reset to planned.
 */
export const VALID_TRANSITIONS: ValidTransitions = {
  // Initial state: Can start discovery or fail immediately
  planned: ['discovering', 'failed'],
  
  // Discovery phase: Can complete discovery (approved), or fail
  discovering: ['approved', 'failed'],
  
  // Approval gate: Can proceed to execution, or fail
  approved: ['executing', 'failed'],
  
  // Execution phase: Can complete execution (validation), or fail
  executing: ['validating', 'failed'],
  
  // Validation phase: Can complete workflow, or fail
  validating: ['complete', 'failed'],
  
  // Terminal states: No outgoing transitions (except failed reset)
  complete: [],
  
  // Failed can be reset to planned for retry
  failed: ['planned'],
};

/**
 * Terminal states (cannot transition except to failed reset)
 */
export const TERMINAL_STATES: readonly WorkflowState[] = ['complete'];

/**
 * Retry-safe states (can resume from these states)
 * These states capture sufficient checkpoint data for recovery
 */
export const RETRY_SAFE_STATES: readonly WorkflowState[] = [
  'planned',
  'approved',
  'failed',
];

/**
 * States that require human approval before proceeding
 */
export const APPROVAL_REQUIRED_STATES: readonly WorkflowState[] = [
  'approved',
];

/**
 * State descriptions for logging and debugging
 */
export const STATE_DESCRIPTIONS: Record<WorkflowState, string> = {
  planned: 'Workflow created, awaiting discovery phase',
  discovering: 'Gathering requirements and context',
  approved: 'Ready for execution (HITL approved)',
  executing: 'Agent actively executing tasks',
  validating: 'Validating results against acceptance criteria',
  complete: 'Workflow successfully completed',
  failed: 'Workflow failed (unrecoverable error)',
};

/**
 * Validate if a state transition is allowed
 * 
 * @param from - Current state
 * @param to - Desired next state
 * @returns Validation result with reason if invalid
 */
export function validateTransition(
  from: WorkflowState,
  to: WorkflowState
): TransitionValidation {
  // Same state is always valid (idempotent)
  if (from === to) {
    return {
      valid: true,
      from,
      to,
    };
  }
  
  const validNextStates = VALID_TRANSITIONS[from];
  
  if (!validNextStates) {
    return {
      valid: false,
      from,
      to,
      reason: `Unknown from state: ${from}`,
    };
  }
  
  if (!validNextStates.includes(to)) {
    const allowedStates = validNextStates.join(', ') || 'none';
    return {
      valid: false,
      from,
      to,
      reason: `Cannot transition from '${from}' to '${to}'. Allowed: ${allowedStates}`,
    };
  }
  
  return {
    valid: true,
    from,
    to,
  };
}

/**
 * Check if a transition is valid (boolean only)
 * 
 * @param from - Current state
 * @param to - Desired next state
 * @returns True if transition is valid
 */
export function isValidTransition(from: WorkflowState, to: WorkflowState): boolean {
  return validateTransition(from, to).valid;
}

/**
 * Get all valid next states from a given state
 * 
 * @param state - Current state
 * @returns Array of valid next states
 */
export function getValidNextStates(state: WorkflowState): WorkflowState[] {
  return [...VALID_TRANSITIONS[state]];
}

/**
 * Check if a state is terminal (no outgoing transitions)
 * 
 * @param state - State to check
 * @returns True if terminal
 */
export function isTerminalState(state: WorkflowState): boolean {
  return TERMINAL_STATES.includes(state);
}

/**
 * Check if a state is retry-safe (can resume from checkpoint)
 * 
 * @param state - State to check
 * @returns True if retry-safe
 */
export function isRetrySafeState(state: WorkflowState): boolean {
  return RETRY_SAFE_STATES.includes(state);
}

/**
 * Check if transition requires human approval
 * 
 * @param toState - Target state
 * @returns True if approval required
 */
export function requiresApproval(toState: WorkflowState): boolean {
  return APPROVAL_REQUIRED_STATES.includes(toState);
}

/**
 * Get the error code for an invalid transition
 * 
 * @returns Error code for invalid transitions
 */
export function getInvalidTransitionErrorCode(): WorkflowStateErrorCode {
  return 'WS-001';
}

/**
 * Get default retry_safe value for a state
 * 
 * @param state - The state
 * @returns Default retry_safe boolean
 */
export function getDefaultRetrySafe(state: WorkflowState): boolean {
  return RETRY_SAFE_STATES.includes(state);
}

/**
 * Get previous states that can transition to the given state
 * Useful for determining entry points
 * 
 * @param state - Target state
 * @returns Array of states that can transition to this state
 */
export function getPreviousStates(state: WorkflowState): WorkflowState[] {
  const previous: WorkflowState[] = [];
  
  for (const [fromState, toStates] of Object.entries(VALID_TRANSITIONS)) {
    if (toStates.includes(state)) {
      previous.push(fromState as WorkflowState);
    }
  }
  
  return previous;
}

/**
 * Get the "happy path" sequence of states
 * Used for UI progress indicators and validation
 * 
 * @returns Ordered array of happy path states
 */
export function getHappyPath(): WorkflowState[] {
  return ['planned', 'discovering', 'approved', 'executing', 'validating', 'complete'];
}

/**
 * Calculate progress percentage along happy path
 * 
 * @param state - Current state
 * @returns Progress percentage (0-100)
 */
export function getProgressPercentage(state: WorkflowState): number {
  const happyPath = getHappyPath();
  const index = happyPath.indexOf(state);
  
  if (index === -1) {
    // Failed state is 0% (needs reset)
    return state === 'failed' ? 0 : 0;
  }
  
  return Math.round((index / (happyPath.length - 1)) * 100);
}