/**
 * Checkpoint Management - Session State Checkpoints and Recovery
 *
 * Manages checkpoints for session state with integrity verification.
 * Provides atomic save/restore operations for crash recovery.
 *
 * @module checkpoint
 */

import fs from 'fs/promises';
import path from 'path';
import { z } from 'zod';

// =============================================================================
// Type Definitions
// =============================================================================

/**
 * Checkpoint state
 */
export interface Checkpoint {
  /** Checkpoint UUID */
  id: string;
  /** Session UUID */
  session_id: string;
  /** Agent identifier */
  agent_id: string;
  /** Tenant group ID */
  group_id: string;
  /** Checkpoint sequence number */
  sequence: number;
  /** Checkpoint data */
  data: Record<string, unknown>;
  /** ISO timestamp */
  timestamp: string;
  /** SHA-256 checksum */
  checksum: string;
}

/**
 * Checkpoint manifest
 */
export interface CheckpointManifest {
  /** Session ID */
  session_id: string;
  /** Latest checkpoint ID */
  latest_checkpoint_id: string;
  /** Total checkpoints created */
  checkpoint_count: number;
  /** Last checkpoint timestamp */
  last_checkpoint_at: string;
}

/**
 * Checkpoint configuration
 */
export interface CheckpointConfig {
  /** Directory for checkpoints */
  checkpointDir: string;
  /** Maximum checkpoints to retain per session */
  maxCheckpoints: number;
  /** Enable compression (future) */
  enableCompression: boolean;
  /** Enable integrity checks */
  enableIntegrityCheck: boolean;
}

// =============================================================================
// Zod Schemas
// =============================================================================

const CheckpointSchema = z.object({
  id: z.string().uuid(),
  session_id: z.string().uuid(),
  agent_id: z.string().min(1),
  group_id: z.string().regex(/^allura-|roninmemory$/),
  sequence: z.number().int().nonnegative(),
  data: z.record(z.string(), z.unknown()),
  timestamp: z.string().datetime(),
  checksum: z.string().min(64).max(64), // SHA-256 hex
});

const CheckpointManifestSchema = z.object({
  session_id: z.string().uuid(),
  latest_checkpoint_id: z.string().uuid(),
  checkpoint_count: z.number().int().nonnegative(),
  last_checkpoint_at: z.string().datetime(),
});

// =============================================================================
// Default Configuration
// =============================================================================

const DEFAULT_CONFIG: CheckpointConfig = {
  checkpointDir: '.opencode/state/checkpoints',
  maxCheckpoints: 10,
  enableCompression: false,
  enableIntegrityCheck: true,
};

// =============================================================================
// Checkpoint Manager
// =============================================================================

/**
 * Checkpoint Manager
 *
 * Manages session checkpoints with:
 * - Atomic save operations
 * - Integrity verification (SHA-256)
 * - Automatic cleanup of old checkpoints
 * - Manifest tracking
 */
export class CheckpointManager {
  private config: CheckpointConfig;
  private sequenceCounters: Map<string, number> = new Map();

  constructor(config?: Partial<CheckpointConfig>) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  // ---------------------------------------------------------------------------
  // Initialization
  // ---------------------------------------------------------------------------

  /**
   * Initialize checkpoint manager
   *
   * Creates checkpoint directory.
   *
   * @throws Error if directory creation fails
   */
  async initialize(): Promise<void> {
    await fs.mkdir(this.config.checkpointDir, { recursive: true });

    // Verify directory is writable
    const testFile = path.join(this.config.checkpointDir, '.write-test');
    try {
      await fs.writeFile(testFile, 'test', 'utf8');
      await fs.unlink(testFile);
    } catch {
      throw new Error(
        `Checkpoint directory ${this.config.checkpointDir} is not writable`
      );
    }
  }

  // ---------------------------------------------------------------------------
  // Checkpoint Operations
  // ---------------------------------------------------------------------------

  /**
   * Create checkpoint
   *
   * Creates new checkpoint with atomic write and integrity verification.
   * Automatically cleans up old checkpoints beyond max limit.
   *
   * @param session_id - Session UUID
   * @param agent_id - Agent identifier
   * @param group_id - Tenant group ID
   * @param data - Checkpoint data
   * @returns Checkpoint ID
   */
  async createCheckpoint(
    session_id: string,
    agent_id: string,
    group_id: string,
    data: Record<string, unknown>
  ): Promise<string> {
    // Validate group_id
    if (!group_id.match(/^allura-/) && group_id !== 'roninmemory') {
      throw new Error(
        `Invalid group_id format: ${group_id}. Must start with 'allura-' or be 'roninmemory'`
      );
    }

    // Get next sequence number
    const sequence = this.getNextSequence(session_id);

    // Create checkpoint
    const checkpoint: Checkpoint = {
      id: crypto.randomUUID(),
      session_id,
      agent_id,
      group_id,
      sequence,
      data,
      timestamp: new Date().toISOString(),
      checksum: '', // Will be calculated
    };

    // Calculate checksum
    if (this.config.enableIntegrityCheck) {
      checkpoint.checksum = await this.calculateChecksum(checkpoint);
    }

    // Validate
    CheckpointSchema.parse(checkpoint);

    // Persist checkpoint (atomic)
    await this.persistCheckpoint(checkpoint);

    // Update manifest
    await this.updateManifest(session_id, checkpoint.id);

    // Cleanup old checkpoints
    await this.cleanupOldCheckpoints(session_id);

    return checkpoint.id;
  }

  /**
   * Load checkpoint by ID
   *
   * Loads and verifies checkpoint integrity.
   *
   * @param checkpoint_id - Checkpoint UUID
   * @returns Checkpoint or null if not found/corrupted
   */
  async loadCheckpoint(checkpoint_id: string): Promise<Checkpoint | null> {
    const checkpointPath = this.getCheckpointPath(checkpoint_id);

    try {
      const content = await fs.readFile(checkpointPath, 'utf8');
      const parsed = JSON.parse(content);

      // Validate schema
      const validated = CheckpointSchema.parse(parsed);

      // Verify integrity
      if (this.config.enableIntegrityCheck) {
        const computedChecksum = await this.calculateChecksum(validated);
        if (computedChecksum !== validated.checksum) {
          console.warn(
            `[CheckpointManager] Checksum mismatch for checkpoint ${checkpoint_id}`
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
          `[CheckpointManager] Invalid checkpoint ${checkpoint_id}:`,
          error.issues
        );
        return null;
      }
      throw error;
    }
  }

  /**
   * Load latest checkpoint for session
   *
   * @param session_id - Session UUID
   * @returns Latest checkpoint or null
   */
  async loadLatestCheckpoint(
    session_id: string
  ): Promise<Checkpoint | null> {
    const manifest = await this.loadManifest(session_id);
    if (!manifest) {
      return null;
    }

    return this.loadCheckpoint(manifest.latest_checkpoint_id);
  }

  /**
   * List checkpoints for session
   *
   * @param session_id - Session UUID
   * @returns Array of checkpoints (sorted by sequence desc)
   */
  async listCheckpoints(session_id: string): Promise<Checkpoint[]> {
    try {
      const files = await fs.readdir(this.config.checkpointDir);
      const checkpoints: Checkpoint[] = [];

      for (const file of files) {
        if (!file.endsWith('.json') || file.startsWith('manifest-')) {
          continue;
        }

        const checkpointId = path.basename(file, '.json');
        const checkpoint = await this.loadCheckpoint(checkpointId);

        if (checkpoint && checkpoint.session_id === session_id) {
          checkpoints.push(checkpoint);
        }
      }

      // Sort by sequence descending
      return checkpoints.sort((a, b) => b.sequence - a.sequence);
    } catch {
      return [];
    }
  }

  /**
   * Restore from checkpoint
   *
   * Loads checkpoint data and returns it for restoration.
   *
   * @param checkpoint_id - Checkpoint UUID
   * @returns Checkpoint data or null
   */
  async restoreFromCheckpoint(
    checkpoint_id: string
  ): Promise<Record<string, unknown> | null> {
    const checkpoint = await this.loadCheckpoint(checkpoint_id);
    return checkpoint?.data ?? null;
  }

  // ---------------------------------------------------------------------------
  // Manifest Management
  // ---------------------------------------------------------------------------

  /**
   * Get manifest path
   *
   * @param session_id - Session UUID
   * @returns Path to manifest file
   */
  private getManifestPath(session_id: string): string {
    return path.join(
      this.config.checkpointDir,
      `manifest-${session_id}.json`
    );
  }

  /**
   * Load manifest for session
   *
   * @param session_id - Session UUID
   * @returns Manifest or null
   */
  async loadManifest(session_id: string): Promise<CheckpointManifest | null> {
    const manifestPath = this.getManifestPath(session_id);

    try {
      const content = await fs.readFile(manifestPath, 'utf8');
      const parsed = JSON.parse(content);
      return CheckpointManifestSchema.parse(parsed);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
        return null;
      }
      if (error instanceof z.ZodError) {
        console.error(
          `[CheckpointManager] Invalid manifest for ${session_id}:`,
          error.issues
        );
        return null;
      }
      throw error;
    }
  }

  /**
   * Update manifest
   *
   * @param session_id - Session UUID
   * @param checkpoint_id - Latest checkpoint ID
   */
  private async updateManifest(
    session_id: string,
    checkpoint_id: string
  ): Promise<void> {
    const manifestPath = this.getManifestPath(session_id);

    let manifest: CheckpointManifest = {
      session_id,
      latest_checkpoint_id: checkpoint_id,
      checkpoint_count: 1,
      last_checkpoint_at: new Date().toISOString(),
    };

    // Load existing manifest if present
    const existing = await this.loadManifest(session_id);
    if (existing) {
      manifest = {
        ...existing,
        latest_checkpoint_id: checkpoint_id,
        checkpoint_count: existing.checkpoint_count + 1,
        last_checkpoint_at: new Date().toISOString(),
      };
    }

    // Write manifest
    await fs.writeFile(
      manifestPath,
      JSON.stringify(manifest, null, 2),
      'utf8'
    );
  }

  // ---------------------------------------------------------------------------
  // Utility Methods
  // ---------------------------------------------------------------------------

  /**
   * Get checkpoint file path
   *
   * @param checkpoint_id - Checkpoint UUID
   * @returns Absolute path
   */
  private getCheckpointPath(checkpoint_id: string): string {
    return path.join(this.config.checkpointDir, `${checkpoint_id}.json`);
  }

  /**
   * Get next sequence number
   *
   * @param session_id - Session UUID
   * @returns Next sequence number
   */
  private getNextSequence(session_id: string): number {
    const current = this.sequenceCounters.get(session_id) ?? 0;
    const next = current + 1;
    this.sequenceCounters.set(session_id, next);
    return next;
  }

  /**
   * Persist checkpoint (atomic write)
   *
   * @param checkpoint - Checkpoint to persist
   */
  private async persistCheckpoint(checkpoint: Checkpoint): Promise<void> {
    const checkpointPath = this.getCheckpointPath(checkpoint.id);
    const tempPath = `${checkpointPath}.tmp`;

    await fs.writeFile(
      tempPath,
      JSON.stringify(checkpoint, null, 2),
      'utf8'
    );
    await fs.rename(tempPath, checkpointPath);
  }

  /**
   * Calculate SHA-256 checksum
   *
   * @param checkpoint - Checkpoint to hash
   * @returns Hex checksum
   */
  private async calculateChecksum(checkpoint: Checkpoint): Promise<string> {
    const dataToHash = {
      id: checkpoint.id,
      session_id: checkpoint.session_id,
      agent_id: checkpoint.agent_id,
      group_id: checkpoint.group_id,
      sequence: checkpoint.sequence,
      data: checkpoint.data,
      timestamp: checkpoint.timestamp,
    };

    const encoder = new TextEncoder();
    const data = encoder.encode(JSON.stringify(dataToHash));
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
  }

  /**
   * Cleanup old checkpoints
   *
   * Removes checkpoints beyond max limit.
   *
   * @param session_id - Session UUID
   */
  private async cleanupOldCheckpoints(session_id: string): Promise<void> {
    const checkpoints = await this.listCheckpoints(session_id);

    if (checkpoints.length <= this.config.maxCheckpoints) {
      return;
    }

    // Remove oldest checkpoints
    const toRemove = checkpoints.slice(this.config.maxCheckpoints);
    for (const checkpoint of toRemove) {
      const checkpointPath = this.getCheckpointPath(checkpoint.id);
      try {
        await fs.unlink(checkpointPath);
      } catch (error) {
        console.warn(
          `[CheckpointManager] Failed to remove old checkpoint ${checkpoint.id}:`,
          error
        );
      }
    }
  }

  /**
   * Export checkpoint for backup
   *
   * @param checkpoint_id - Checkpoint UUID
   * @returns JSON string
   */
  async exportCheckpoint(checkpoint_id: string): Promise<string> {
    const checkpoint = await this.loadCheckpoint(checkpoint_id);
    if (!checkpoint) {
      throw new Error(`Checkpoint ${checkpoint_id} not found`);
    }
    return JSON.stringify(checkpoint, null, 2);
  }

  /**
   * Import checkpoint from backup
   *
   * @param json - Checkpoint JSON
   * @returns Checkpoint ID
   */
  async importCheckpoint(json: string): Promise<string> {
    const parsed = JSON.parse(json);
    const checkpoint = CheckpointSchema.parse(parsed);

    // Persist
    await this.persistCheckpoint(checkpoint);

    // Update manifest
    await this.updateManifest(checkpoint.session_id, checkpoint.id);

    return checkpoint.id;
  }

  /**
   * Get checkpoint statistics
   *
   * @param session_id - Session UUID
   * @returns Statistics object
   */
  async getCheckpointStats(session_id: string): Promise<{
    total: number;
    latest: Checkpoint | null;
    oldest: Checkpoint | null;
  }> {
    const checkpoints = await this.listCheckpoints(session_id);

    return {
      total: checkpoints.length,
      latest: checkpoints[0] ?? null,
      oldest: checkpoints[checkpoints.length - 1] ?? null,
    };
  }
}

// =============================================================================
// Factory Functions
// =============================================================================

/**
 * Create checkpoint manager
 *
 * @param config - Optional configuration
 * @returns CheckpointManager instance
 */
export function createCheckpointManager(
  config?: Partial<CheckpointConfig>
): CheckpointManager {
  return new CheckpointManager(config);
}

// =============================================================================
// Default Export
// =============================================================================

export default CheckpointManager;
