/**
 * Workflow State Machine
 * 
 * Append-only workflow state management with PostgreSQL persistence.
 * 
 * ## Overview
 * 
 * This module implements a crash-safe workflow state machine following
 * the pattern from systemPatterns.md: "Conversation state ≠ workflow state"
 * 
 * ## State Machine Flow
 * 
 * ```
 * planned → discovering → approved → executing → validating → complete
 *    ↓          ↓           ↓           ↓           ↓
 *  failed      failed      failed      failed      failed
 * 
 * failed → planned (reset)
 * ```
 * 
 * ## Key Features
 * 
 * - **Append-only transitions**: Every state change creates a new record
 * - **Tenant isolation**: All operations filtered by group_id
 * - **Checkpoint data**: Captures execution context for crash recovery
 * - **Retry-safe detection**: States that can be resumed after interruption
 * - **History querying**: Complete audit trail of all transitions
 * 
 * ## Usage
 * 
 * ```typescript
 * import { createStateMachine } from './state-machine';
 * 
 * // Create and initialize a workflow
 * const machine = await createStateMachine(
 *   'workflow-123',
 *   'allura-test-group',
 *   { initial_context: 'data' }
 * );
 * 
 * // Transition through states
 * await machine.transition('discovering');
 * await machine.transition('approved');
 * await machine.transition('executing');
 * 
 * // Complete the workflow
 * await machine.complete({ result: 'success' });
 * 
 * // Or fail
 * await machine.fail('Something went wrong');
 * 
 * // Reset failed workflow
 * await machine.reset();
 * 
 * // Get history
 * const history = await machine.getHistory();
 * ```
 * 
 * ## Files
 * 
 * | File | Purpose |
 * |------|---------|
 * | `types.ts` | TypeScript type definitions |
 * | `transitions.ts` | Valid transition definitions and validators |
 * | `queries.ts` | PostgreSQL query operations |
 * | `state-machine.ts` | Core state machine class |
 * | `state-machine.test.ts` | Comprehensive test suite (70 tests) |
 * 
 * @module workflow
 */

export {
  // State Machine
  WorkflowStateMachine,
  createStateMachine,
  loadStateMachine,
  recoverWorkflow,
} from './state-machine';

// Types
export type {
  WorkflowState,
  WorkflowStateTransition,
  WorkflowCurrentState,
  WorkflowCheckpointData,
  WorkflowStateQueryOptions,
  WorkflowStateQueryResult,
  WorkflowStateHistory,
  StateMachineConfig,
  WorkflowStateError,
  WorkflowStateErrorCode,
  ToolCall,
  Action,
  ValidTransitions,
  TransitionValidation,
  StateTransitionEvent,
} from './types';

// Transitions
export {
  VALID_TRANSITIONS,
  TERMINAL_STATES,
  RETRY_SAFE_STATES,
  APPROVAL_REQUIRED_STATES,
  STATE_DESCRIPTIONS,
  validateTransition,
  isValidTransition,
  isTerminalState,
  isRetrySafeState,
  requiresApproval,
  getDefaultRetrySafe,
  getPreviousStates,
  getHappyPath,
  getProgressPercentage,
} from './transitions';

// Queries
export {
  createStateTransition,
  getCurrentState,
  getWorkflowHistory,
  getWorkflowStateHistory,
  queryWorkflowStates,
  getTransitionEvents,
  initializeWorkflow,
  workflowExists,
  getWorkflowsByState,
  getRetrySafeWorkflows,
} from './queries';