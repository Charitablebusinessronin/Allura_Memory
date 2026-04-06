/**
 * Tests for Audit Query Service
 * Story 5-1: Audit Query Interface
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { getAuditQueryService, AuditQueryService } from './query-service';
import type { AuditLogEntry } from '@/lib/promotions/types';

describe('AuditQueryService', () => {
  let service: AuditQueryService;

  beforeEach(() => {
    service = getAuditQueryService();
  });

  describe('queryByDateRange', () => {
    it('should query entries within date range', async () => {
      const groupId = 'test-group';
      const from = new Date('2026-01-01');
      const to = new Date('2026-12-31');

      // This will fail without database setup, so we test the query construction
      await expect(
        service.queryByDateRange(from, to, groupId)
      ).resolves.toBeInstanceOf(Array);
    });

    it('should reject invalid group_id', async () => {
      const from = new Date('2026-01-01');
      const to = new Date('2026-12-31');

      await expect(
        service.queryByDateRange(from, to, '')
      ).rejects.toThrow('group_id is required');

      await expect(
        service.queryByDateRange(from, to, 'InvalidGroup')
      ).rejects.toThrow('must be lowercase');
    });
  });

  describe('queryByAgent', () => {
    it('should query entries by agent ID', async () => {
      const groupId = 'test-group';
      const agentId = 'memory-scout';

      await expect(
        service.queryByAgent(agentId, groupId)
      ).resolves.toBeInstanceOf(Array);
    });

    it('should reject invalid group_id', async () => {
      await expect(
        service.queryByAgent('agent-id', '')
      ).rejects.toThrow('group_id is required');

      await expect(
        service.queryByAgent('agent-id', 'InvalidGroup')
      ).rejects.toThrow('must be lowercase');
    });
  });

  describe('queryByDecision', () => {
    it('should query entries by decision ID', async () => {
      const groupId = 'test-group';
      const decisionId = 'decision-001';

      await expect(
        service.queryByDecision(decisionId, groupId)
      ).resolves.toBeInstanceOf(Array);
    });

    it('should reject invalid group_id', async () => {
      await expect(
        service.queryByDecision('decision-id', '')
      ).rejects.toThrow('group_id is required');

      await expect(
        service.queryByDecision('decision-id', 'InvalidGroup')
      ).rejects.toThrow('must be lowercase');
    });
  });

  describe('queryEvidenceChain', () => {
    it('should return decision chain and evidence', async () => {
      const decisionId = 'decision-001';

      const result = await service.queryEvidenceChain(decisionId);

      expect(result).toHaveProperty('decision');
      expect(result).toHaveProperty('evidence');
      expect(Array.isArray(result.decision)).toBe(true);
      expect(Array.isArray(result.evidence)).toBe(true);
    });
  });

  describe('exportCSV', () => {
    it('should export entries as CSV', async () => {
      const query = {
        group_id: 'test-group',
        start_date: new Date('2026-01-01'),
        end_date: new Date('2026-12-31'),
      };

      const csv = await service.exportCSV(query);

      expect(typeof csv).toBe('string');
      expect(csv).toContain('ID,Timestamp,Actor,Actor Type,Action');
    });
  });

  describe('exportJSON', () => {
    it('should export entries as JSON', async () => {
      const query = {
        group_id: 'test-group',
        start_date: new Date('2026-01-01'),
        end_date: new Date('2026-12-31'),
      };

      const json = await service.exportJSON(query);

      expect(typeof json).toBe('string');
      expect(() => JSON.parse(json)).not.toThrow();
    });
  });

  describe('mapRowToAuditEntry', () => {
    it('should map database row to AuditLogEntry', () => {
      const row = {
        id: 'test-id',
        timestamp: new Date('2026-04-06T12:00:00Z'),
        actor: 'test-actor',
        actor_type: 'human',
        action: 'approved',
        entity_type: 'proposal',
        entity_id: 'prop-001',
        from_state: 'pending',
        to_state: 'approved',
        outcome: 'success',
        reason: 'Test reason',
        metadata: '{"key": "value"}',
      };

      // Access private method through type assertion
      const serviceAny = service as unknown as {
        mapRowToAuditEntry: (row: Record<string, unknown>) => AuditLogEntry;
      };

      const entry = serviceAny.mapRowToAuditEntry(row);

      expect(entry.id).toBe('test-id');
      expect(entry.actor).toBe('test-actor');
      expect(entry.actor_type).toBe('human');
      expect(entry.entity_type).toBe('proposal');
      expect(entry.from_state).toBe('pending');
      expect(entry.to_state).toBe('approved');
      expect(entry.metadata).toEqual({ key: 'value' });
    });

    it('should handle metadata as object', () => {
      const row = {
        id: 'test-id',
        timestamp: new Date('2026-04-06T12:00:00Z'),
        actor: 'test-actor',
        actor_type: 'human',
        action: 'approved',
        entity_type: 'proposal',
        entity_id: 'prop-001',
        from_state: null,
        to_state: 'approved',
        outcome: 'success',
        reason: null,
        metadata: { key: 'value' },
      };

      const serviceAny = service as unknown as {
        mapRowToAuditEntry: (row: Record<string, unknown>) => AuditLogEntry;
      };

      const entry = serviceAny.mapRowToAuditEntry(row);

      expect(entry.metadata).toEqual({ key: 'value' });
    });
  });
});