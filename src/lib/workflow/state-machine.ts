/**
 * Workflow State Machine
 * 
 * Core state machine implementation with append-only transitions.
 * 
 * Design Principles:
 * 1. ALL state changes are append-only (INSERT only, never UPDATE)
 * 2. Each transition captures checkpoint data for crash recovery
 * 3. Tenant isolation enforced via group_id on every operation
 * 4. Valid transitions enforced before persistence
 * 
 * @module workflow/state-machine
 */

import type {
  WorkflowState,
  WorkflowStateTransition,
  WorkflowCurrentState,
  WorkflowCheckpointData,
  WorkflowStateHistory,
  StateMachineConfig,
  WorkflowStateError,
  WorkflowStateErrorCode,
} from './types';
import {
  validateTransition,
  isTerminalState,
  isRetrySafeState,
  getInvalidTransitionErrorCode,
  getDefaultRetrySafe,
  VALID_TRANSITIONS,
} from './transitions';
import {
  createStateTransition,
  getCurrentState,
  getWorkflowHistory,
  getWorkflowStateHistory,
  initializeWorkflow,
  workflowExists,
} from './queries';

/**
 * Default state machine configuration
 */
const DEFAULT_CONFIG: StateMachineConfig = {
  strict: true,
  auto_retry: false,
  max_retries: 3,
};

/**
 * Workflow State Machine
 * 
 * Manages workflow lifecycle with append-only transitions.
 * Each instance is bound to a specific workflow and group.
 */
export class WorkflowStateMachine {
  private _workflowId: string;
  private _groupId: string;
  private _config: StateMachineConfig;
  private _currentState: WorkflowCurrentState | null = null;
  private _initialized: boolean = false;

  /**
   * Create a new workflow state machine
   * 
   * @param workflowId - Unique workflow identifier
   * @param groupId - Tenant group identifier
   * @param config - Optional state machine configuration
   */
  constructor(
    workflowId: string,
    groupId: string,
    config: Partial<StateMachineConfig> = {}
  ) {
    this._workflowId = workflowId;
    this._groupId = groupId;
    this._config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * Initialize the state machine
   * Loads current state from database or creates initial 'planned' state
   * 
   * @param initialCheckpoint - Optional initial checkpoint data
   * @returns This instance for chaining
   */
  async initialize(initialCheckpoint?: WorkflowCheckpointData): Promise<this> {
    const exists = await workflowExists(this._workflowId, this._groupId);
    
    if (exists) {
      this._currentState = await getCurrentState(this._workflowId, this._groupId);
    } else {
      const transition = await initializeWorkflow(
        this._workflowId,
        this._groupId,
        initialCheckpoint
      );
      
      this._currentState = {
        transition_id: transition.id,
        group_id: transition.group_id,
        workflow_id: transition.workflow_id,
        state: transition.state,
        checkpoint_data: transition.checkpoint_data,
        retry_safe: transition.retry_safe,
        entered_at: transition.created_at,
        transition_count: 1,
      };
    }
    
    this._initialized = true;
    return this;
  }

  /**
   * Ensure the state machine is initialized
   * @private
   */
  private _ensureInitialized(): void {
    if (!this._initialized) {
      throw this._createError(
        'WS-004',
        'State machine not initialized. Call initialize() first.',
        { workflow_id: this._workflowId }
      );
    }
  }

  /**
   * Create a workflow state error
   * @private
   */
  private _createError(
    code: WorkflowStateErrorCode,
    message: string,
    details?: Record<string, unknown>
  ): WorkflowStateError {
    // Create error with proper prototype chain
    const error = Object.assign(new Error(message), {
      name: 'WorkflowStateError' as const,
      code,
      details: {
        workflow_id: this._workflowId,
        group_id: this._groupId,
        current_state: this._currentState?.state,
        ...details,
      },
    }) as WorkflowStateError;
    return error;
  }

  /**
   * Get the current workflow ID
   */
  get workflowId(): string {
    return this._workflowId;
  }

  /**
   * Get the group ID (tenant)
   */
  get groupId(): string {
    return this._groupId;
  }

  /**
   * Get the current state
   * @throws If state machine is not initialized
   */
  get state(): WorkflowState {
    this._ensureInitialized();
    return this._currentState!.state;
  }

  /**
   * Get the current checkpoint data
   * @throws If state machine is not initialized
   */
  get checkpoint(): WorkflowCheckpointData {
    this._ensureInitialized();
    return this._currentState!.checkpoint_data;
  }

  /**
   * Check if current state is retry-safe
   * @throws If state machine is not initialized
   */
  get isRetrySafe(): boolean {
    this._ensureInitialized();
    return this._currentState!.retry_safe;
  }

  /**
   * Check if current state is terminal
   * @throws If state machine is not initialized
   */
  get isTerminal(): boolean {
    this._ensureInitialized();
    return isTerminalState(this._currentState!.state);
  }

  /**
   * Get the total number of transitions
   * @throws If state machine is not initialized
   */
  get transitionCount(): number {
    this._ensureInitialized();
    return this._currentState!.transition_count;
  }

  /**
   * Get the full current state record
   * @throws If state machine is not initialized
   */
  get currentState(): WorkflowCurrentState {
    this._ensureInitialized();
    return this._currentState!;
  }

  /**
   * Transition to a new state
   * 
   * This is the core state machine operation. It:
   * 1. Validates the transition is allowed
   * 2. Persists the transition (append-only INSERT)
   * 3. Updates the local state cache
   * 
   * @param targetState - The state to transition to
   * @param checkpointData - Optional checkpoint data to capture
   * @param options - Optional transition options
   * @returns The created transition record
   * @throws WorkflowStateError if transition is invalid
   */
  async transition(
    targetState: WorkflowState,
    checkpointData?: WorkflowCheckpointData,
    options?: {
      force?: boolean;
      retrySafe?: boolean;
    }
  ): Promise<WorkflowStateTransition> {
    this._ensureInitialized();
    
    const currentState = this._currentState!.state;
    
    // Skip if already in target state (idempotent)
    if (currentState === targetState) {
      // Still record a transition if checkpoint data is different
      const currentCheckpoint = JSON.stringify(this._currentState!.checkpoint_data);
      const newCheckpoint = JSON.stringify(checkpointData ?? {});
      
      if (currentCheckpoint === newCheckpoint) {
        // Return the most recent transition
        const history = await getWorkflowHistory(this._workflowId, this._groupId);
        return history[history.length - 1];
      }
    }
    
    // Validate transition (unless force option is set)
    if (!options?.force && this._config.strict) {
      const validation = validateTransition(currentState, targetState);
      
      if (!validation.valid) {
        throw this._createError(
          getInvalidTransitionErrorCode(),
          validation.reason || `Invalid transition: ${currentState} → ${targetState}`,
          { from: currentState, to: targetState }
        );
      }
    }
    
    // Merge checkpoint data with existing (if any)
    const mergedCheckpoint: WorkflowCheckpointData = {
      ...this._currentState!.checkpoint_data,
      ...checkpointData,
      // Preserve memory pointers by merging
      memory_pointers: {
        ...this._currentState!.checkpoint_data.memory_pointers,
        ...checkpointData?.memory_pointers,
      },
    };
    
    // Determine retry_safe
    const retrySafe = options?.retrySafe ?? getDefaultRetrySafe(targetState);
    
    // Persist the transition (append-only)
    const transition = await createStateTransition({
      group_id: this._groupId,
      workflow_id: this._workflowId,
      state: targetState,
      checkpoint_data: mergedCheckpoint,
      retry_safe: retrySafe,
    });
    
    // Update local cache
    this._currentState = {
      transition_id: transition.id,
      group_id: transition.group_id,
      workflow_id: transition.workflow_id,
      state: transition.state,
      checkpoint_data: transition.checkpoint_data,
      retry_safe: transition.retry_safe,
      entered_at: transition.created_at,
      transition_count: this._currentState!.transition_count + 1,
    };
    
    return transition;
  }

  /**
   * Create a checkpoint at current state
   * 
   * Updates the checkpoint data without changing state.
   * This is useful for periodic state persistence during long-running operations.
   * 
   * @param checkpointData - Checkpoint data to capture
   * @returns The created transition record
   */
  async saveCheckpoint(
    checkpointData: WorkflowCheckpointData
  ): Promise<WorkflowStateTransition> {
    this._ensureInitialized();
    
    // Transition to same state with new checkpoint data
    return this.transition(this._currentState!.state, checkpointData);
  }

  /**
   * Check if a transition to the target state is valid
   * 
   * @param targetState - The desired state
   * @returns True if transition is valid
   * @throws If state machine is not initialized
   */
  canTransitionTo(targetState: WorkflowState): boolean {
    this._ensureInitialized();
    const validation = validateTransition(this._currentState!.state, targetState);
    return validation.valid;
  }

  /**
   * Get list of valid next states from current state
   * @throws If state machine is not initialized
   */
  getValidNextStates(): WorkflowState[] {
    this._ensureInitialized();
    return Object.entries(VALID_TRANSITIONS)
      .filter(([from]) => from === this._currentState!.state)
      .flatMap(([, toStates]) => toStates);
  }

  /**
   * Refresh current state from database
   * Useful after external modifications
   * 
   * @returns This instance for chaining
   */
  async refresh(): Promise<this> {
    this._ensureInitialized();
    
    const refreshed = await getCurrentState(this._workflowId, this._groupId);
    
    if (!refreshed) {
      throw this._createError(
        'WS-007',
        'Workflow not found during refresh',
        { workflow_id: this._workflowId }
      );
    }
    
    this._currentState = refreshed;
    return this;
  }

  /**
   * Get the full transition history for this workflow
   * @throws If state machine is not initialized
   */
  async getHistory(): Promise<WorkflowStateHistory> {
    this._ensureInitialized();
    
    const history = await getWorkflowStateHistory(this._workflowId, this._groupId);
    
    if (!history) {
      throw this._createError(
        'WS-007',
        'Workflow history not found',
        { workflow_id: this._workflowId }
      );
    }
    
    return history;
  }

  /**
   * Reset a failed workflow back to planned state
   * Only valid from 'failed' state
   * 
   * @param checkpointData - Optional new checkpoint data
   * @returns The created transition record
   * @throws If not in failed state
   */
  async reset(
    checkpointData?: WorkflowCheckpointData
  ): Promise<WorkflowStateTransition> {
    this._ensureInitialized();
    
    if (this._currentState!.state !== 'failed') {
      throw this._createError(
        'WS-001',
        `Can only reset from 'failed' state. Current state: ${this._currentState!.state}`,
        { current_state: this._currentState!.state }
      );
    }
    
    return this.transition('planned', checkpointData, { force: true });
  }

  /**
   * Complete the workflow
   * Convenience method for transitioning to 'complete' state
   * 
   * @param checkpointData - Final checkpoint data
   * @returns The created transition record
   */
  async complete(
    checkpointData?: WorkflowCheckpointData
  ): Promise<WorkflowStateTransition> {
    return this.transition('complete', checkpointData);
  }

  /**
   * Fail the workflow
   * Convenience method for transitioning to 'failed' state
   * 
   * @param errorMessage - Error message to store
   * @param checkpointData - Additional checkpoint data
   * @returns The created transition record
   */
  async fail(
    errorMessage?: string,
    checkpointData?: WorkflowCheckpointData
  ): Promise<WorkflowStateTransition> {
    return this.transition('failed', {
      ...checkpointData,
      error_message: errorMessage,
    });
  }

  /**
   * Resume from a retry-safe state
   * Only valid from retry-safe states (planned, approved, failed)
   * 
   * @returns True if resume was successful
   * @throws If not in a retry-safe state
   */
  async resume(): Promise<boolean> {
    this._ensureInitialized();
    
    if (!this.isRetrySafe) {
      throw this._createError(
        'WS-001',
        `Cannot resume from non-retry-safe state: ${this._currentState!.state}`,
        { current_state: this._currentState!.state }
      );
    }
    
    // Determine next state based on current
    const state = this._currentState!.state;
    let nextState: WorkflowState;
    
    switch (state) {
      case 'planned':
        nextState = 'discovering';
        break;
      case 'approved':
        nextState = 'executing';
        break;
      case 'failed':
        nextState = 'planned';
        break;
      default:
        throw this._createError(
          'WS-001',
          `Unexpected retry-safe state: ${state}`,
          { state }
        );
    }
    
    await this.transition(nextState);
    return true;
  }

  /**
   * Assert that the workflow is in a specific state
   * 
   * @param expectedState - The expected state
   * @throws WorkflowStateError if not in expected state
   */
  assertState(expectedState: WorkflowState): void {
    this._ensureInitialized();
    
    if (this._currentState!.state !== expectedState) {
      throw this._createError(
        'WS-001',
        `Expected state '${expectedState}' but workflow is in '${this._currentState!.state}'`,
        { expected: expectedState, actual: this._currentState!.state }
      );
    }
  }

  /**
   * Wait for a specific state (polling)
   * Useful in tests or when coordinating with external processes
   * 
   * @param targetState - The state to wait for
   * @param timeoutMs - Maximum time to wait
   * @param pollIntervalMs - Polling interval
   * @returns True if target state reached
   */
  async waitForState(
    targetState: WorkflowState,
    timeoutMs: number = 30000,
    pollIntervalMs: number = 100
  ): Promise<boolean> {
    const startTime = Date.now();
    
    while (Date.now() - startTime < timeoutMs) {
      await this.refresh();
      
      if (this.state === targetState) {
        return true;
      }
      
      await new Promise(resolve => setTimeout(resolve, pollIntervalMs));
    }
    
    return false;
  }
}

/**
 * Create and initialize a workflow state machine
 * Convenience function that creates and initializes in one call
 * 
 * @param workflowId - Unique workflow identifier
 * @param groupId - Tenant group identifier
 * @param initialCheckpoint - Optional initial checkpoint data
 * @param config - Optional state machine configuration
 * @returns Initialized state machine
 */
export async function createStateMachine(
  workflowId: string,
  groupId: string,
  initialCheckpoint?: WorkflowCheckpointData,
  config?: Partial<StateMachineConfig>
): Promise<WorkflowStateMachine> {
  const machine = new WorkflowStateMachine(workflowId, groupId, config);
  await machine.initialize(initialCheckpoint);
  return machine;
}

/**
 * Load an existing workflow state machine
 * Convenience function for loading existing workflows
 * 
 * @param workflowId - Workflow identifier
 * @param groupId - Tenant group identifier
 * @param config - Optional state machine configuration
 * @returns Initialized state machine
 * @throws If workflow does not exist
 */
export async function loadStateMachine(
  workflowId: string,
  groupId: string,
  config?: Partial<StateMachineConfig>
): Promise<WorkflowStateMachine> {
  const exists = await workflowExists(workflowId, groupId);
  
  if (!exists) {
    const error = Object.assign(new Error(`Workflow '${workflowId}' not found in group '${groupId}'`), {
      name: 'WorkflowStateError' as const,
      code: 'WS-007' as const,
      details: { workflow_id: workflowId, group_id: groupId },
    }) as WorkflowStateError;
    throw error;
  }
  
  const machine = new WorkflowStateMachine(workflowId, groupId, config);
  await machine.initialize();
  return machine;
}

/**
 * Recover a workflow from checkpoint
 * Used for crash recovery scenarios
 * 
 * @param workflowId - Workflow identifier
 * @param groupId - Tenant group identifier
 * @returns State machine if retry-safe, null otherwise
 */
export async function recoverWorkflow(
  workflowId: string,
  groupId: string
): Promise<WorkflowStateMachine | null> {
  try {
    const machine = await loadStateMachine(workflowId, groupId);
    
    if (!machine.isRetrySafe) {
      return null;
    }
    
    return machine;
  } catch {
    return null;
  }
}