/**
 * Session Persistence - Core State Management and Recovery
 *
 * Course Correction: From Claude Code leak analysis - sessions must survive crashes.
 * Implements session state persistence with async, non-blocking saves and
 * crash recovery from last checkpoint.
 *
 * @module persistence
 */

import fs from 'fs/promises';
import path from 'path';
import { z } from 'zod';

// =============================================================================
// Type Definitions
// =============================================================================

/**
 * Workflow stages for session state machine
 */
export type WorkflowStage =
  | 'planned'
  | 'discovering'
  | 'approved'
  | 'executing'
  | 'validating'
  | 'complete';

/**
 * Token usage tracking structure
 */
export interface TokenUsage {
  input: number;
  output: number;
  turns: number;
}

/**
 * Session State Schema
 *
 * Defines the complete session state that must be persisted and recoverable.
 */
export interface SessionState {
  session_id: string;
  agent_id: string;
  group_id: string;
  workflow_stage: WorkflowStage;
  token_usage: TokenUsage;
  permissions_granted: string[];
  subagent_results: Record<string, unknown>;
  checkpoint_data: unknown;
  created_at: string;
  updated_at: string;
}

/**
 * Zod schema for runtime validation
 */
export const SessionStateSchema = z.object({
  session_id: z.string().uuid(),
  agent_id: z.string().min(1),
  group_id: z.string().regex(/^allura-|roninmemory$/),
  workflow_stage: z.enum([
    'planned',
    'discovering',
    'approved',
    'executing',
    'validating',
    'complete',
  ]),
  token_usage: z.object({
    input: z.number().nonnegative(),
    output: z.number().nonnegative(),
    turns: z.number().nonnegative(),
  }),
  permissions_granted: z.array(z.string()),
  subagent_results: z.record(z.string(), z.unknown()),
  checkpoint_data: z.unknown(),
  created_at: z.string().datetime(),
  updated_at: z.string().datetime(),
});

/**
 * Configuration options for session persistence
 */
export interface PersistenceConfig {
  /** Directory for session state files */
  stateDir: string;
  /** Enable async (non-blocking) saves */
  asyncSave: boolean;
  /** Maximum number of concurrent save operations */
  maxConcurrentSaves: number;
  /** Enable integrity checksums on state files */
  enableIntegrityCheck: boolean;
}

// =============================================================================
// Default Configuration
// =============================================================================

const DEFAULT_CONFIG: PersistenceConfig = {
  stateDir: '.opencode/state',
  asyncSave: true,
  maxConcurrentSaves: 5,
  enableIntegrityCheck: true,
};

// =============================================================================
// Session Persistence Manager
// =============================================================================

/**
 * Session Persistence Manager
 *
 * Manages session state persistence with:
 * - Async, non-blocking state saves
 * - Crash recovery from last checkpoint
 * - Token usage tracking
 * - Permission persistence
 * - Concurrent session isolation
 */
export class SessionPersistence {
  private config: PersistenceConfig;
  private saveQueue: Map<string, Promise<void>> = new Map();
  private activeSaves: number = 0;

  constructor(config?: Partial<PersistenceConfig>) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  // ---------------------------------------------------------------------------
  // Initialization
  // ---------------------------------------------------------------------------

  /**
   * Initialize persistence layer
   *
   * Creates state directory and ensures write permissions.
   *
   * @throws Error if directory creation fails
   */
  async initialize(): Promise<void> {
    await fs.mkdir(this.config.stateDir, { recursive: true });

    // Verify directory is writable
    const testFile = path.join(this.config.stateDir, '.write-test');
    try {
      await fs.writeFile(testFile, 'test', 'utf8');
      await fs.unlink(testFile);
    } catch {
      throw new Error(
        `Session persistence directory ${this.config.stateDir} is not writable`
      );
    }
  }

  // ---------------------------------------------------------------------------
  // Session Lifecycle
  // ---------------------------------------------------------------------------

  /**
   * Create a new session
   *
   * Generates session ID and initializes state. Persists initial state
   * synchronously to ensure recovery point exists.
   *
   * @param agent_id - Agent identifier
   * @param group_id - Tenant group ID (must start with 'allura-')
   * @returns Initial session state
   * @throws Error if group_id format is invalid
   */
  async createSession(
    agent_id: string,
    group_id: string
  ): Promise<SessionState> {
    // Validate group_id format
    if (!group_id.match(/^allura-/) && group_id !== 'roninmemory') {
      throw new Error(
        `Invalid group_id format: ${group_id}. Must start with 'allura-' or be 'roninmemory'`
      );
    }

    const now = new Date().toISOString();
    const session: SessionState = {
      session_id: crypto.randomUUID(),
      agent_id,
      group_id,
      workflow_stage: 'planned',
      token_usage: { input: 0, output: 0, turns: 0 },
      permissions_granted: [],
      subagent_results: {},
      checkpoint_data: null,
      created_at: now,
      updated_at: now,
    };

    // Validate schema
    SessionStateSchema.parse(session);

    // Persist synchronously for initial state
    await this.persistState(session);

    return session;
  }

  /**
   * Load session state by ID
   *
   * Attempts to load from state file. Returns null if session not found
   * or if file is corrupted.
   *
   * @param session_id - Session UUID
   * @returns Session state or null
   */
  async loadSession(session_id: string): Promise<SessionState | null> {
    const statePath = this.getStatePath(session_id);

    try {
      const content = await fs.readFile(statePath, 'utf8');
      const parsed = JSON.parse(content);

      // Validate schema
      const validated = SessionStateSchema.parse(parsed);

      // Verify integrity if checksum exists
      if (this.config.enableIntegrityCheck && parsed._checksum) {
        const checksum = await this.calculateChecksum(parsed);
        if (checksum !== parsed._checksum) {
          console.warn(
            `[SessionPersistence] Checksum mismatch for session ${session_id}`
          );
          return null;
        }
      }

      return validated;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
        return null;
      }
      if (error instanceof z.ZodError) {
        console.error(
          `[SessionPersistence] Invalid session state for ${session_id}:`,
          error.issues
        );
        return null;
      }
      throw error;
    }
  }

  /**
   * Delete session state
   *
   * Removes state file. Safe to call even if session doesn't exist.
   *
   * @param session_id - Session UUID
   */
  async deleteSession(session_id: string): Promise<void> {
    const statePath = this.getStatePath(session_id);
    try {
      await fs.unlink(statePath);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
        throw error;
      }
    }
  }

  // ---------------------------------------------------------------------------
  // State Updates
  // ---------------------------------------------------------------------------

  /**
   * Update session state
   *
   * Updates specific fields and persists. If asyncSave is enabled,
   * save happens in background (non-blocking).
   *
   * @param session_id - Session UUID
   * @param updates - Partial state updates
   * @returns Updated session state
   * @throws Error if session not found
   */
  async updateSession(
    session_id: string,
    updates: Partial<Omit<SessionState, 'session_id' | 'created_at'>>
  ): Promise<SessionState> {
    const current = await this.loadSession(session_id);
    if (!current) {
      throw new Error(`Session not found: ${session_id}`);
    }

    const updated: SessionState = {
      ...current,
      ...updates,
      session_id: current.session_id, // Never change session_id
      created_at: current.created_at, // Never change created_at
      updated_at: new Date().toISOString(),
    };

    // Validate schema
    SessionStateSchema.parse(updated);

    // Persist (async or sync)
    await this.saveState(updated);

    return updated;
  }

  /**
   * Save state
   *
   * Saves state to file. If asyncSave is enabled, operation is queued
   * and executed non-blocking.
   *
   * @param state - Session state to save
   */
  async saveState(state: SessionState): Promise<void> {
    if (this.config.asyncSave) {
      await this.queueSave(state);
    } else {
      await this.persistState(state);
    }
  }

  /**
   * Queue async save
   *
   * Manages save queue to limit concurrent operations.
   *
   * @param state - Session state to save
   */
  private async queueSave(state: SessionState): Promise<void> {
    const sessionId = state.session_id;

    // If there's an existing save in progress, wait for it
    const existingSave = this.saveQueue.get(sessionId);
    if (existingSave) {
      await existingSave;
    }

    // Limit concurrent saves
    while (this.activeSaves >= this.config.maxConcurrentSaves) {
      await new Promise((resolve) => setTimeout(resolve, 10));
    }

    // Create save promise
    const savePromise = this.executeSave(state);
    this.saveQueue.set(sessionId, savePromise);

    try {
      await savePromise;
    } finally {
      this.saveQueue.delete(sessionId);
    }
  }

  /**
   * Execute save operation
   *
   * @param state - Session state to persist
   */
  private async executeSave(state: SessionState): Promise<void> {
    this.activeSaves++;
    try {
      await this.persistState(state);
    } finally {
      this.activeSaves--;
    }
  }

  /**
   * Persist state to file
   *
   * @param state - Session state to persist
   */
  private async persistState(state: SessionState): Promise<void> {
    const statePath = this.getStatePath(state.session_id);

    // Add checksum for integrity
    let dataToSave: Record<string, unknown> = { ...state };
    if (this.config.enableIntegrityCheck) {
      const checksum = await this.calculateChecksum(state);
      dataToSave = { ...state, _checksum: checksum };
    }

    // Write atomically (write to temp, then rename)
    const tempPath = `${statePath}.tmp`;
    await fs.writeFile(
      tempPath,
      JSON.stringify(dataToSave, null, 2),
      'utf8'
    );
    await fs.rename(tempPath, statePath);
  }

  // ---------------------------------------------------------------------------
  // Crash Recovery
  // ---------------------------------------------------------------------------

  /**
   * Recover from crash
   *
   * Scans state directory for sessions that may have been interrupted.
   * Returns the most recent session for a given agent and group.
   *
   * @param agent_id - Agent identifier
   * @param group_id - Tenant group ID
   * @returns Most recent session state or null
   */
  async recoverFromCrash(
    agent_id: string,
    group_id: string
  ): Promise<SessionState | null> {
    const sessions = await this.listSessions();

    // Filter by agent and group, sort by updated_at desc
    const matchingSessions = sessions
      .filter((s) => s.agent_id === agent_id && s.group_id === group_id)
      .sort(
        (a, b) =>
          new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime()
      );

    if (matchingSessions.length === 0) {
      return null;
    }

    const mostRecent = matchingSessions[0];

    // Log recovery
    console.log(
      `[SessionPersistence] Recovered session ${mostRecent.session_id} ` +
        `from ${mostRecent.updated_at} (stage: ${mostRecent.workflow_stage})`
    );

    return mostRecent;
  }

  /**
   * List all persisted sessions
   *
   * @returns Array of session states
   */
  async listSessions(): Promise<SessionState[]> {
    try {
      const files = await fs.readdir(this.config.stateDir);
      const sessions: SessionState[] = [];

      for (const file of files) {
        if (!file.endsWith('.json') || file.startsWith('.')) {
          continue;
        }

        const sessionId = path.basename(file, '.json');
        if (!sessionId.startsWith('session-')) {
          continue;
        }

        const session = await this.loadSession(
          sessionId.replace('session-', '')
        );
        if (session) {
          sessions.push(session);
        }
      }

      return sessions;
    } catch {
      return [];
    }
  }

  // ---------------------------------------------------------------------------
  // Token Usage Tracking
  // ---------------------------------------------------------------------------

  /**
   * Update token usage for session
   *
   * Adds usage to existing totals. Non-blocking save.
   *
   * @param session_id - Session UUID
   * @param input - Input tokens used
   * @param output - Output tokens used
   * @returns Updated session state
   */
  async updateTokenUsage(
    session_id: string,
    input: number,
    output: number
  ): Promise<SessionState> {
    const current = await this.loadSession(session_id);
    if (!current) {
      throw new Error(`Session not found: ${session_id}`);
    }

    return this.updateSession(session_id, {
      token_usage: {
        input: current.token_usage.input + input,
        output: current.token_usage.output + output,
        turns: current.token_usage.turns + 1,
      },
    });
  }

  /**
   * Get token usage summary
   *
   * @param session_id - Session UUID
   * @returns Token usage or null if session not found
   */
  async getTokenUsage(session_id: string): Promise<TokenUsage | null> {
    const session = await this.loadSession(session_id);
    return session?.token_usage ?? null;
  }

  // ---------------------------------------------------------------------------
  // Permission Management
  // ---------------------------------------------------------------------------

  /**
   * Grant permission to session
   *
   * @param session_id - Session UUID
   * @param permission - Permission identifier
   * @returns Updated session state
   */
  async grantPermission(
    session_id: string,
    permission: string
  ): Promise<SessionState> {
    const current = await this.loadSession(session_id);
    if (!current) {
      throw new Error(`Session not found: ${session_id}`);
    }

    if (current.permissions_granted.includes(permission)) {
      return current; // Already granted
    }

    return this.updateSession(session_id, {
      permissions_granted: [...current.permissions_granted, permission],
    });
  }

  /**
   * Revoke permission from session
   *
   * @param session_id - Session UUID
   * @param permission - Permission identifier
   * @returns Updated session state
   */
  async revokePermission(
    session_id: string,
    permission: string
  ): Promise<SessionState> {
    const current = await this.loadSession(session_id);
    if (!current) {
      throw new Error(`Session not found: ${session_id}`);
    }

    return this.updateSession(session_id, {
      permissions_granted: current.permissions_granted.filter(
        (p) => p !== permission
      ),
    });
  }

  /**
   * Check if permission is granted
   *
   * @param session_id - Session UUID
   * @param permission - Permission identifier
   * @returns True if granted
   */
  async hasPermission(
    session_id: string,
    permission: string
  ): Promise<boolean> {
    const session = await this.loadSession(session_id);
    return session?.permissions_granted.includes(permission) ?? false;
  }

  // ---------------------------------------------------------------------------
  // Subagent Results
  // ---------------------------------------------------------------------------

  /**
   * Store subagent result
   *
   * @param session_id - Session UUID
   * @param subagent_id - Subagent identifier
   * @param result - Subagent result data
   * @returns Updated session state
   */
  async storeSubagentResult(
    session_id: string,
    subagent_id: string,
    result: unknown
  ): Promise<SessionState> {
    const current = await this.loadSession(session_id);
    if (!current) {
      throw new Error(`Session not found: ${session_id}`);
    }

    return this.updateSession(session_id, {
      subagent_results: {
        ...current.subagent_results,
        [subagent_id]: result,
      },
    });
  }

  /**
   * Get subagent result
   *
   * @param session_id - Session UUID
   * @param subagent_id - Subagent identifier
   * @returns Subagent result or undefined
   */
  async getSubagentResult(
    session_id: string,
    subagent_id: string
  ): Promise<unknown> {
    const session = await this.loadSession(session_id);
    return session?.subagent_results[subagent_id];
  }

  // ---------------------------------------------------------------------------
  // Utility Methods
  // ---------------------------------------------------------------------------

  /**
   * Get state file path
   *
   * @param session_id - Session UUID
   * @returns Absolute path to state file
   */
  private getStatePath(session_id: string): string {
    return path.join(this.config.stateDir, `session-${session_id}.json`);
  }

  /**
   * Calculate SHA-256 checksum for integrity verification
   *
   * @param state - Session state
   * @returns Hex checksum string
   */
  private async calculateChecksum(
    state: SessionState | Record<string, unknown>
  ): Promise<string> {
    // Remove _checksum if present
    const { _checksum, ...dataToHash } = state as Record<string, unknown>;

    const encoder = new TextEncoder();
    const data = encoder.encode(JSON.stringify(dataToHash));
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
  }

  /**
   * Validate session state
   *
   * @param state - State to validate
   * @returns Validation result
   */
  validateState(state: unknown): { valid: boolean; errors?: string[] } {
    try {
      SessionStateSchema.parse(state);
      return { valid: true };
    } catch (error) {
      if (error instanceof z.ZodError) {
        return {
          valid: false,
          errors: error.issues.map((e: z.ZodIssue) => `${e.path}: ${e.message}`),
        };
      }
      return { valid: false, errors: [(error as Error).message] };
    }
  }
}

// =============================================================================
// Factory Functions
// =============================================================================

/**
 * Create session persistence manager
 *
 * @param config - Optional configuration overrides
 * @returns SessionPersistence instance
 */
export function createSessionPersistence(
  config?: Partial<PersistenceConfig>
): SessionPersistence {
  return new SessionPersistence(config);
}

/**
 * Generate unique session ID
 *
 * @returns UUID string
 */
export function generateSessionId(): string {
  return crypto.randomUUID();
}

// =============================================================================
// Default Export
// =============================================================================

export default SessionPersistence;
