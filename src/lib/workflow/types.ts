/**
 * Workflow State Machine Types
 * 
 * Type definitions for the workflow state machine with append-only transitions.
 * Follows patterns from systemPatterns.md: "Conversation state ≠ workflow state"
 * 
 * @module workflow/types
 */

/**
 * Valid workflow states
 * Ordered by lifecycle progression
 */
export type WorkflowState =
  | 'planned'
  | 'discovering'
  | 'approved'
  | 'executing'
  | 'validating'
  | 'complete'
  | 'failed';

/**
 * Workflow state transition record
 * Represents a single state transition (append-only)
 */
export interface WorkflowStateTransition {
  /** Unique identifier for this transition record */
  id: string;
  
  /** Tenant isolation identifier */
  group_id: string;
  
  /** Workflow this transition belongs to */
  workflow_id: string;
  
  /** The state being entered */
  state: WorkflowState;
  
  /** Optional checkpoint data for crash recovery */
  checkpoint_data: WorkflowCheckpointData;
  
  /** Whether this state is safe to retry from */
  retry_safe: boolean;
  
  /** When this transition was recorded */
  created_at: Date;
  
  /** When this record was last updated (for idempotency) */
  updated_at: Date;
}

/**
 * Current workflow state view
 * Aggregated from transition history
 */
export interface WorkflowCurrentState {
  /** Latest transition ID */
  transition_id: string;
  
  /** Tenant isolation identifier */
  group_id: string;
  
  /** Workflow identifier */
  workflow_id: string;
  
  /** Current state */
  state: WorkflowState;
  
  /** Latest checkpoint data */
  checkpoint_data: WorkflowCheckpointData;
  
  /** Whether current state is retry-safe */
  retry_safe: boolean;
  
  /** When current state was entered */
  entered_at: Date;
  
  /** Total transitions for this workflow */
  transition_count: number;
}

/**
 * Checkpoint data structure
 * Captures execution context for resumption
 */
export interface WorkflowCheckpointData {
  /** Last completed turn number */
  last_turn?: number;
  
  /** Agent execution context */
  context?: Record<string, unknown>;
  
  /** Pending tool calls */
  tool_calls?: ToolCall[];
  
  /** Actions awaiting execution */
  pending_actions?: Action[];
  
  /** Memory references for restoration */
  memory_pointers?: {
    /** PostgreSQL trace IDs */
    postgres_trace_ids?: string[];
    /** Neo4j node IDs */
    neo4j_node_ids?: string[];
  };
  
  /** Custom metadata */
  [key: string]: unknown;
}

/**
 * Tool call record
 */
export interface ToolCall {
  id: string;
  tool: string;
  parameters: Record<string, unknown>;
  status: 'pending' | 'completed' | 'failed';
}

/**
 * Action record
 */
export interface Action {
  id: string;
  type: string;
  payload: Record<string, unknown>;
  status: 'pending' | 'completed' | 'failed';
}

/**
 * Valid state transitions map
 * Defines which states can transition to which other states
 */
export type ValidTransitions = {
  [K in WorkflowState]: WorkflowState[];
};

/**
 * Transition validation result
 */
export interface TransitionValidation {
  valid: boolean;
  from: WorkflowState;
  to: WorkflowState;
  reason?: string;
}

/**
 * State machine configuration
 */
export interface StateMachineConfig {
  /** Whether to validate transitions strictly */
  strict: boolean;
  /** Whether to auto-retry from retry-safe states */
  auto_retry: boolean;
  /** Maximum retry attempts */
  max_retries: number;
}

/**
 * State transition event for logging
 */
export interface StateTransitionEvent {
  transition_id: string;
  workflow_id: string;
  group_id: string;
  from_state: WorkflowState | null;
  to_state: WorkflowState;
  checkpoint_data: WorkflowCheckpointData;
  retry_safe: boolean;
  timestamp: Date;
}

/**
 * Workflow state query options
 */
export interface WorkflowStateQueryOptions {
  group_id: string;
  workflow_id?: string;
  state?: WorkflowState;
  retry_safe?: boolean;
  limit?: number;
  offset?: number;
}

/**
 * Workflow state query result
 */
export interface WorkflowStateQueryResult {
  transitions: WorkflowStateTransition[];
  total: number;
  has_more: boolean;
}

/**
 * Workflow state history (ordered transitions)
 */
export interface WorkflowStateHistory {
  workflow_id: string;
  group_id: string;
  transitions: WorkflowStateTransition[];
  current_state: WorkflowCurrentState;
}

/**
 * Error codes for workflow state operations
 */
export type WorkflowStateErrorCode =
  | 'WS-001' // Invalid state transition
  | 'WS-002' // Checkpoint failed
  | 'WS-003' // Recovery failed
  | 'WS-004' // State machine corrupted
  | 'WS-005' // Concurrent state modification
  | 'WS-006' // Group isolation violation
  | 'WS-007' // Workflow not found;

/**
 * Workflow state error
 */
export class WorkflowStateError extends Error {
  constructor(
    public readonly code: WorkflowStateErrorCode,
    message: string,
    public readonly details?: Record<string, unknown>
  ) {
    super(message);
    this.name = 'WorkflowStateError';
  }
}
