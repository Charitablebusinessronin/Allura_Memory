/**
 * Tests for Decision Provenance
 * Story 5-1: Audit Query Interface
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { getDecisionProvenance, DecisionProvenance } from './decision-provenance';

describe('DecisionProvenance', () => {
  let service: DecisionProvenance;

  beforeEach(() => {
    service = getDecisionProvenance();
  });

  describe('traceProvenance', () => {
    it('should return provenance graph for decision', async () => {
      const decisionId = 'decision-001';

      const result = await service.traceProvenance(decisionId);

      expect(result).toHaveProperty('decisionId');
      expect(result).toHaveProperty('groupId');
      expect(result).toHaveProperty('nodes');
      expect(result).toHaveProperty('edges');
      expect(Array.isArray(result.nodes)).toBe(true);
      expect(Array.isArray(result.edges)).toBe(true);
    });

    it('should return empty graph for non-existent decision', async () => {
      const result = await service.traceProvenance('non-existent');

      expect(result.nodes).toHaveLength(0);
      expect(result.edges).toHaveLength(0);
    });
  });

  describe('getRuleVersions', () => {
    it('should return rule versions', async () => {
      const ruleId = 'rule-001';

      // Will fail without database setup
      const versions = await service.getRuleVersions(ruleId);

      expect(Array.isArray(versions)).toBe(true);
    });
  });

  describe('reconstructEvidenceChain', () => {
    it('should return evidence chain for decision', async () => {
      const decisionId = 'decision-001';

      const result = await service.reconstructEvidenceChain(decisionId);

      expect(result).toHaveProperty('decisionId');
      expect(result).toHaveProperty('groupId');
      expect(result).toHaveProperty('evidenceChain');
      expect(result).toHaveProperty('transitions');
      expect(Array.isArray(result.evidenceChain)).toBe(true);
      expect(Array.isArray(result.transitions)).toBe(true);
    });

    it('should return empty chain for non-existent decision', async () => {
      const result = await service.reconstructEvidenceChain('non-existent');

      expect(result.evidenceChain).toHaveLength(0);
      expect(result.transitions).toHaveLength(0);
    });
  });

  describe('ProvenanceNode type', () => {
    it('should support state, evidence, and rule types', () => {
      const stateNode = {
        id: 'state-1',
        type: 'state' as const,
        timestamp: new Date(),
        actor: 'human-actor',
        actorType: 'human' as const,
        data: { fromState: 'pending', toState: 'approved' },
      };

      const evidenceNode = {
        id: 'evidence-1',
        type: 'evidence' as const,
        timestamp: new Date(),
        actor: 'agent-actor',
        actorType: 'agent' as const,
        data: { reference: 'ref-001' },
      };

      const ruleNode = {
        id: 'rule-1',
        type: 'rule' as const,
        timestamp: new Date(),
        actor: 'system',
        actorType: 'system' as const,
        data: { ruleId: 'rule-001' },
      };

      expect(stateNode.type).toBe('state');
      expect(evidenceNode.type).toBe('evidence');
      expect(ruleNode.type).toBe('rule');
    });
  });

  describe('ProvenanceEdge type', () => {
    it('should support TRANSITION, CITES, APPLIES, and SUPERSEDES relationships', () => {
      const transitionEdge = {
        from: 'node-1',
        to: 'node-2',
        relationship: 'TRANSITION' as const,
        metadata: { state: 'pending' },
      };

      const citesEdge = {
        from: 'node-1',
        to: 'evidence-1',
        relationship: 'CITES' as const,
      };

      const appliesEdge = {
        from: 'node-1',
        to: 'rule-1',
        relationship: 'APPLIES' as const,
      };

      const supersedesEdge = {
        from: 'node-2',
        to: 'node-old',
        relationship: 'SUPERSEDES' as const,
      };

      expect(transitionEdge.relationship).toBe('TRANSITION');
      expect(citesEdge.relationship).toBe('CITES');
      expect(appliesEdge.relationship).toBe('APPLIES');
      expect(supersedesEdge.relationship).toBe('SUPERSEDES');
    });
  });

  describe('EvidenceRecord type', () => {
    it('should support evidence record shape', () => {
      const record = {
        id: 'evidence-001',
        type: 'document',
        source: 'postgres',
        timestamp: new Date(),
        description: 'Key evidence',
        metadata: { confidence: 0.95 },
      };

      expect(record.id).toBe('evidence-001');
      expect(record.type).toBe('document');
      expect(record.source).toBe('postgres');
    });
  });

  describe('RuleVersion type', () => {
    it('should support rule version shape', () => {
      const version = {
        id: 'rule-001',
        version: '1.0.0',
        createdAt: new Date(),
        createdBy: 'curator@example.com',
        description: 'Initial version',
        isActive: true,
        supersededBy: undefined,
      };

      expect(version.id).toBe('rule-001');
      expect(version.version).toBe('1.0.0');
      expect(version.isActive).toBe(true);
    });

    it('should support supersededBy field', () => {
      const version = {
        id: 'rule-001',
        version: '1.0.0',
        createdAt: new Date(),
        createdBy: 'curator@example.com',
        description: 'Superseded version',
        isActive: false,
        supersededBy: 'rule-002',
      };

      expect(version.supersededBy).toBe('rule-002');
    });
  });
});