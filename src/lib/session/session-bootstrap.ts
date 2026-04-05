/**
 * Session Bootstrap - Entry Point Combining All Layers
 *
 * Implements the complete session initialization flow:
 * 1. Encoding validation
 * 2. State hydration
 * 3. Checkpoint initialization
 * 4. Budget enforcement
 * 5. Drift detection
 *
 * This is the entry point for 6-month operational stability.
 */

import { EncodingValidator, createEncodingValidator } from '../validation/encoding-validator';
import { CheckpointManager, createCheckpointManager, type CheckpointState } from './checkpoint-manager';
import { StateHydrator, createStateHydrator, type SessionState } from './state-hydrator';
import { BudgetEnforcer } from '../budget/enforcer';

/**
 * Session bootstrap configuration
 */
export interface SessionBootstrapConfig {
  /** Session ID (generated if not provided) */
  sessionId?: string;
  /** Group ID for tenant isolation */
  groupId: string;
  /** Enable encoding validation */
  enableEncodingValidation: boolean;
  /** Enable checkpoint management */
  enableCheckpoints: boolean;
  /** Enable budget enforcement */
  enableBudget: boolean;
  /** Enable drift detection */
  enableDriftDetection: boolean;
  /** Encoding validator config */
  encodingConfig?: Parameters<typeof createEncodingValidator>[0];
  /** Checkpoint manager config */
  checkpointConfig?: Parameters<typeof createCheckpointManager>[0];
  /** State hydrator config */
  hydratorConfig?: Parameters<typeof createStateHydrator>[0];
}

const DEFAULT_CONFIG: Omit<SessionBootstrapConfig, 'groupId'> = {
  enableEncodingValidation: true,
  enableCheckpoints: true,
  enableBudget: true,
  enableDriftDetection: true,
};

/**
 * Session bootstrap result
 */
export interface SessionBootstrapResult {
  /** Whether bootstrap succeeded */
  success: boolean;
  /** Session ID */
  sessionId: string;
  /** Group ID */
  groupId: string;
  /** Loaded session state */
  state: SessionState;
  /** Warnings encountered during bootstrap */
  warnings: string[];
  /** Errors encountered during bootstrap */
  errors: string[];
  /** Checkpoint manager (if enabled) */
  checkpointManager?: CheckpointManager;
}

/**
 * Session Bootstrap
 *
 * Orchestrates the complete session initialization flow.
 * Ensures operational stability over 6+ month periods.
 */
export class SessionBootstrap {
  private config: SessionBootstrapConfig;
  private encodingValidator?: EncodingValidator;
  private checkpointManager?: CheckpointManager;
  private stateHydrator: StateHydrator;
  private budgetEnforcer?: BudgetEnforcer;
  private sessionId: string;

  constructor(config: Partial<SessionBootstrapConfig> & { groupId: string }) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.sessionId = config.sessionId ?? crypto.randomUUID();

    // Initialize components
    if (this.config.enableEncodingValidation) {
      this.encodingValidator = createEncodingValidator(this.config.encodingConfig);
    }

    if (this.config.enableCheckpoints) {
      this.checkpointManager = createCheckpointManager(this.config.checkpointConfig);
    }

    this.stateHydrator = createStateHydrator(this.config.hydratorConfig);

    if (this.config.enableBudget) {
      this.budgetEnforcer = new BudgetEnforcer();
    }
  }

  /**
   * Bootstrap session
   */
  async bootstrap(): Promise<SessionBootstrapResult> {
    const warnings: string[] = [];
    const errors: string[] = [];

    // Step 1: Encoding validation
    if (this.config.enableEncodingValidation && this.encodingValidator) {
      const encodingResult = await this.encodingValidator.validateMemoryBank('memory-bank');
      if (!encodingResult.valid) {
        errors.push(`Encoding validation failed: ${encodingResult.error}`);
      }
      warnings.push(...encodingResult.warnings);
    }

    // Step 2: State hydration
    let state: SessionState;
    try {
      state = await this.stateHydrator.hydrate(this.sessionId, this.config.groupId);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      errors.push(`State hydration failed: ${errorMessage}`);

      // Create default state on failure
      state = {
        sessionId: this.sessionId,
        groupId: this.config.groupId,
        phase: 'WAITING',
        loadedFrom: 'none',
      };
    }

    // Step 3: Validate state integrity
    const stateValid = await this.stateHydrator.validateState(state);
    if (!stateValid) {
      warnings.push('State validation failed, using default state');
      state = {
        sessionId: this.sessionId,
        groupId: this.config.groupId,
        phase: 'WAITING',
        loadedFrom: 'none',
      };
    }

    // Step 4: Checkpoint initialization
    if (this.config.enableCheckpoints && this.checkpointManager) {
      try {
        await this.checkpointManager.initialize(this.sessionId, this.config.groupId);
        
        // Create initial checkpoint
        await this.checkpointManager.createCheckpoint(
          this.sessionId,
          this.config.groupId,
          state.phase
        );
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        warnings.push(`Checkpoint initialization failed: ${errorMessage}`);
      }
    }

    // Step 5: Budget enforcement initialization
    if (this.config.enableBudget && this.budgetEnforcer) {
      try {
        // Start a session for this bootstrap
        this.budgetEnforcer.startSession({
          groupId: this.config.groupId,
          agentId: 'session-bootstrap',
          sessionId: this.sessionId,
        });

        // Verify budget status is available by checking we can continue
        const canContinue = this.budgetEnforcer.canContinue({
          groupId: this.config.groupId,
          agentId: 'session-bootstrap',
          sessionId: this.sessionId,
        });

        if (!canContinue) {
          warnings.push('Budget not available or exhausted');
        }
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        warnings.push(`Budget initialization failed: ${errorMessage}`);
      }
    }

    // Step 6: Drift detection (placeholder)
    if (this.config.enableDriftDetection) {
      // TODO: Implement drift detection when planning-drift-analyzer is ready
      console.log('[Bootstrap] Drift detection not yet implemented');
    }

    // Save state to files for fast recovery
    try {
      await this.stateHydrator.saveState(state);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      warnings.push(`Failed to save state: ${errorMessage}`);
    }

    return {
      success: errors.length === 0,
      sessionId: this.sessionId,
      groupId: this.config.groupId,
      state,
      warnings,
      errors,
      checkpointManager: this.checkpointManager,
    };
  }

  /**
   * Update session phase
   */
  async updatePhase(
    phase: SessionState['phase'],
    additionalData?: Record<string, unknown>
  ): Promise<void> {
    // Budget check before allowing phase change
    if (this.config.enableBudget && this.budgetEnforcer) {
      const result = await this.budgetEnforcer.checkBeforeExecution({
        groupId: this.config.groupId,
        agentId: 'session-bootstrap',
        sessionId: this.sessionId,
      });
      
      if (!result.allowed) {
        throw new Error(`Budget exhausted (${result.status}), cannot proceed with phase change`);
      }
    }

    // Create checkpoint for phase change
    if (this.config.enableCheckpoints && this.checkpointManager) {
      await this.checkpointManager.createCheckpoint(
        this.sessionId,
        this.config.groupId,
        phase,
        additionalData
      );
    }

    // Log phase change
    console.log(`[Bootstrap] Phase changed to: ${phase}`);
  }

  /**
   * Get current session state
   */
  async getState(): Promise<SessionState> {
    return this.stateHydrator.hydrate(this.sessionId, this.config.groupId);
  }

  /**
   * Get checkpoint for recovery
   */
  async getCheckpoint(): Promise<CheckpointState | null> {
    if (!this.checkpointManager) {
      return null;
    }

    return this.checkpointManager.loadLatestCheckpoint(this.sessionId);
  }

  /**
   * Shutdown session gracefully
   */
  async shutdown(): Promise<void> {
    // Create final checkpoint
    if (this.checkpointManager) {
      const state = await this.getState();
      await this.checkpointManager.createCheckpoint(
        this.sessionId,
        this.config.groupId,
        state.phase,
        { shutdown: true, timestamp: new Date().toISOString() }
      );
      this.checkpointManager.stopCheckpointTimer();
    }

    // Log session end
    console.log(`[Bootstrap] Session ${this.sessionId} ended gracefully`);
  }

  /**
   * Recover from crash
   */
  async recover(): Promise<SessionState | null> {
    const checkpoint = await this.getCheckpoint();

    if (!checkpoint) {
      console.warn('[Bootstrap] No checkpoint found for recovery');
      return null;
    }

    console.log(`[Bootstrap] Recovering from checkpoint: ${checkpoint.lastCheckpointId}`);

    const state = this.stateHydrator.restoreFromCheckpoint(checkpoint);
    await this.stateHydrator.saveState(state);

    return state;
  }
}

/**
 * Factory function to create session bootstrap
 */
export function createSessionBootstrap(
  config: Partial<SessionBootstrapConfig> & { groupId: string }
): SessionBootstrap {
  return new SessionBootstrap(config);
}

/**
 * Default export
 */
export default SessionBootstrap;