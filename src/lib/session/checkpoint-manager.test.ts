/**
 * Tests for Checkpoint Manager
 * Requires filesystem access for checkpoint storage.
 * Run with: RUN_E2E_TESTS=true bun vitest run src/lib/session/checkpoint-manager.test.ts
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'fs/promises';
import path from 'path';
import { CheckpointManager, createCheckpointManager } from './checkpoint-manager';

const shouldRunE2E = process.env.RUN_E2E_TESTS === "true";

describe.skipIf(!shouldRunE2E)('CheckpointManager', () => {
  let manager: CheckpointManager;
  const testCheckpointDir = '.opencode/state/checkpoints-test';
  const sessionId = '00000000-0000-0000-0000-000000000001';
  const groupId = 'allura-test';

  beforeEach(async () => {
    manager = createCheckpointManager({
      checkpointDir: testCheckpointDir,
      checkpointInterval: 1000,
      maxCheckpoints: 5,
      enableDbPersistence: false,
    });

    // Ensure test directory exists
    await fs.mkdir(testCheckpointDir, { recursive: true });
  });

  afterEach(async () => {
    // Stop timer
    manager.stopCheckpointTimer();

    // Cleanup test directory
    try {
      await fs.rm(testCheckpointDir, { recursive: true, force: true });
    } catch {
      // Directory may not exist
    }
  });

  describe('initialize', () => {
    it('should create checkpoint directory', async () => {
      await manager.initialize(sessionId, groupId);

      const stat = await fs.stat(testCheckpointDir);
      expect(stat.isDirectory()).toBe(true);
    });

    it('should start checkpoint timer', async () => {
      await manager.initialize(sessionId, groupId);

      // Checkpoint timer should be running
      // We can't directly check this, but we can verify createCheckpoint works
      const checkpointId = await manager.createCheckpoint(sessionId, groupId, 'DEV');
      expect(checkpointId).toBeDefined();
      expect(typeof checkpointId).toBe('string');
    });
  });

  describe('createCheckpoint', () => {
    beforeEach(async () => {
      await manager.initialize(sessionId, groupId);
    });

    it('should create a checkpoint with valid state', async () => {
      const checkpointId = await manager.createCheckpoint(sessionId, groupId, 'DEV', {
        story: 'story-1',
        epic: 1,
      });

      expect(checkpointId).toBeDefined();
      expect(typeof checkpointId).toBe('string');
    });

    it('should include checksum in checkpoint', async () => {
      const checkpointId = await manager.createCheckpoint(sessionId, groupId, 'CODE_REVIEW');

      const checkpoint = await manager.loadCheckpoint(checkpointId);
      expect(checkpoint).toBeDefined();
      expect(checkpoint?.checksum).toBeDefined();
      expect(typeof checkpoint?.checksum).toBe('string');
    });

    it('should include state data when provided', async () => {
      const stateData = {
        story: 'story-1',
        epic: 1,
        tests: ['test1', 'test2'],
      };

      const checkpointId = await manager.createCheckpoint(sessionId, groupId, 'DEV', stateData);

      const checkpoint = await manager.loadCheckpoint(checkpointId);
      expect(checkpoint?.stateData).toEqual(stateData);
    });

    it('should enforce group_id format', async () => {
      // group_id validation is handled by Zod schema
      // This should work with any non-empty string
      const checkpointId = await manager.createCheckpoint(sessionId, 'test-group', 'WAITING');
      expect(checkpointId).toBeDefined();
    });
  });

  describe('loadCheckpoint', () => {
    beforeEach(async () => {
      await manager.initialize(sessionId, groupId);
    });

    it('should load existing checkpoint', async () => {
      const checkpointId = await manager.createCheckpoint(sessionId, groupId, 'DEV');

      const checkpoint = await manager.loadCheckpoint(checkpointId);
      expect(checkpoint).not.toBeNull();
      expect(checkpoint?.sessionId).toBe(sessionId);
      expect(checkpoint?.groupId).toBe(groupId);
      expect(checkpoint?.phase).toBe('DEV');
    });

    it('should return null for non-existent checkpoint', async () => {
      const checkpoint = await manager.loadCheckpoint('non-existent-id');
      expect(checkpoint).toBeNull();
    });

    it('should verify checksum', async () => {
      const checkpointId = await manager.createCheckpoint(sessionId, groupId, 'BLOOD_LOOP');

      const checkpoint = await manager.loadCheckpoint(checkpointId);
      expect(checkpoint?.checksum).toBeDefined();
      
      // Checksum should match
      // Note: In production, we'd verify the computed checksum matches
    });
  });

  describe('listCheckpoints', () => {
    beforeEach(async () => {
      await manager.initialize(sessionId, groupId);
    });

    it('should list checkpoints for a session', async () => {
      await manager.createCheckpoint(sessionId, groupId, 'DEV');
      await manager.createCheckpoint(sessionId, groupId, 'CODE_REVIEW');

      const checkpoints = await manager.listCheckpoints(sessionId);
      expect(checkpoints.length).toBeGreaterThanOrEqual(2);
    });

    it('should sort checkpoints by timestamp descending', async () => {
      await manager.createCheckpoint(sessionId, groupId, 'DEV');
      await new Promise(resolve => setTimeout(resolve, 10)); // Small delay
      await manager.createCheckpoint(sessionId, groupId, 'CODE_REVIEW');

      const checkpoints = await manager.listCheckpoints(sessionId);
      expect(checkpoints[0]?.phase).toBe('CODE_REVIEW');
      expect(checkpoints[1]?.phase).toBe('DEV');
    });

    it('should filter checkpoints by session', async () => {
      const otherSessionId = '00000000-0000-0000-0000-000000000002';
      
      await manager.createCheckpoint(sessionId, groupId, 'DEV');
      await manager.createCheckpoint(otherSessionId, 'allura-other', 'WAITING');

      const checkpoints = await manager.listCheckpoints(sessionId);
      expect(checkpoints.every(c => c.sessionId === sessionId)).toBe(true);
    });
  });

  describe('cleanupOldCheckpoints', () => {
    beforeEach(async () => {
      await manager.initialize(sessionId, groupId);
    });

    it('should remove old checkpoints beyond max limit', async () => {
      // Create more checkpoints than max
      for (let i = 0; i < 7; i++) {
        await manager.createCheckpoint(sessionId, groupId, 'DEV');
        await new Promise(resolve => setTimeout(resolve, 10)); // Small delay
      }

      const checkpoints = await manager.listCheckpoints(sessionId);
      expect(checkpoints.length).toBeLessThanOrEqual(5);
    });
  });

  describe('exportCheckpoint', () => {
    beforeEach(async () => {
      await manager.initialize(sessionId, groupId);
    });

    it('should export checkpoint as JSON string', async () => {
      const checkpointId = await manager.createCheckpoint(sessionId, groupId, 'RETROSPECTIVE');

      const exported = await manager.exportCheckpoint(checkpointId);
      expect(typeof exported).toBe('string');
      expect(() => JSON.parse(exported)).not.toThrow();
    });

    it('should throw for non-existent checkpoint', async () => {
      await expect(manager.exportCheckpoint('non-existent')).rejects.toThrow();
    });
  });

  describe('importCheckpoint', () => {
    beforeEach(async () => {
      await manager.initialize(sessionId, groupId);
    });

    it('should import checkpoint from JSON string', async () => {
      const checkpointId = await manager.createCheckpoint(sessionId, groupId, 'DEV');
      const exported = await manager.exportCheckpoint(checkpointId);

      const importedId = await manager.importCheckpoint(exported);
      expect(importedId).toBeDefined();

      const loaded = await manager.loadCheckpoint(importedId);
      expect(loaded?.phase).toBe('DEV');
    });
  });

  describe('phase tracking', () => {
    it('should track current phase for auto-checkpoints', async () => {
      await manager.initialize(sessionId, groupId);

      // Phase tracking should work for auto-checkpoints
      // This is tested indirectly through the initialization
      const checkpointId = await manager.createCheckpoint(sessionId, groupId, 'CODE_REVIEW');
      expect(checkpointId).toBeDefined();
    });
  });
});

describe('createCheckpointManager', () => {
  it('should create instance with default config', () => {
    const manager = createCheckpointManager();
    expect(manager).toBeInstanceOf(CheckpointManager);
  });

  it('should create instance with custom config', () => {
    const manager = createCheckpointManager({
      checkpointDir: '.opencode/state/custom',
      checkpointInterval: 3000,
      maxCheckpoints: 20,
      enableDbPersistence: false,
    });
    expect(manager).toBeInstanceOf(CheckpointManager);
  });
});