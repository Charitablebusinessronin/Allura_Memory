/**
 * Risk Scorer Tests
 * Story 6-1: Bank-Auditor Workflow
 * Epic 6: Production Workflows
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { RiskScorer, getRiskScorer, DEFAULT_RISK_CONFIG } from './risk-scorer';
import type { AnalysisResult } from './types';

describe('RiskScorer', () => {
  let scorer: RiskScorer;

  beforeEach(() => {
    scorer = new RiskScorer(DEFAULT_RISK_CONFIG);
  });

  describe('calculateRiskScore', () => {
    it('should calculate risk between 0 and 1', async () => {
      const analysis: AnalysisResult = {
        id: 'test-id',
        documentId: 'doc-id',
        groupId: 'allura-test',
        complianceIssues: [],
        riskScore: 0,
        riskFactors: [],
        flaggedItems: [],
        analyzedAt: new Date(),
      };

      const score = await scorer.calculateRiskScore(analysis);

      expect(score).toBeDefined();
      expect(typeof score).toBe('number');
      expect(score).toBeGreaterThanOrEqual(0);
      expect(score).toBeLessThanOrEqual(1);
    });

    it('should identify risk factors', async () => {
      const analysis: AnalysisResult = {
        id: 'test-id',
        documentId: 'doc-id',
        groupId: 'allura-test',
        complianceIssues: [
          { id: 'issue-1', type: 'fair_lending', description: 'Violation', severity: 'high' },
          { id: 'issue-2', type: 'disclosure_missing', description: 'Missing disclosure', severity: 'medium' },
        ],
        riskScore: 0,
        riskFactors: [],
        flaggedItems: [],
        analyzedAt: new Date(),
      };

      const factors = await scorer.getRiskFactors(analysis);

      expect(factors).toBeDefined();
      expect(Array.isArray(factors)).toBe(true);
      expect(factors.length).toBeGreaterThan(0);
      
      // Should include critical/high severity factors
      const criticalFactor = factors.find(f => f.name === 'High Severity Issues');
      expect(criticalFactor).toBeDefined();
    });

    it('should use configurable threshold', () => {
      // Test default threshold
      expect(scorer.exceedsThreshold(0.75)).toBe(true);
      expect(scorer.exceedsThreshold(0.50)).toBe(false);

      // Test custom threshold
      expect(scorer.exceedsThreshold(0.80, 0.85)).toBe(false);
      expect(scorer.exceedsThreshold(0.90, 0.85)).toBe(true);
    });
  });

  describe('getRiskFactors', () => {
    it('should return empty array for no issues', async () => {
      const analysis: AnalysisResult = {
        id: 'test-id',
        documentId: 'doc-id',
        groupId: 'allura-test',
        complianceIssues: [],
        riskScore: 0,
        riskFactors: [],
        flaggedItems: [],
        analyzedAt: new Date(),
      };

      const factors = await scorer.getRiskFactors(analysis);

      expect(factors).toEqual([]);
    });

    it('should categorize factors by severity', async () => {
      const analysis: AnalysisResult = {
        id: 'test-id',
        documentId: 'doc-id',
        groupId: 'allura-test',
        complianceIssues: [
          { id: 'issue-1', type: 'fair_lending', description: 'Critical', severity: 'critical' },
          { id: 'issue-2', type: 'fair_lending', description: 'High', severity: 'high' },
          { id: 'issue-3', type: 'fair_lending', description: 'Medium', severity: 'medium' },
          { id: 'issue-4', type: 'fair_lending', description: 'Low', severity: 'low' },
        ],
        riskScore: 0,
        riskFactors: [],
        flaggedItems: [],
        analyzedAt: new Date(),
      };

      const factors = await scorer.getRiskFactors(analysis);

      // Should have factors for each severity
      const criticalFactor = factors.find(f => f.name === 'Critical Issues');
      const highFactor = factors.find(f => f.name === 'High Severity Issues');
      const mediumFactor = factors.find(f => f.name === 'Medium Severity Issues');
      const lowFactor = factors.find(f => f.name === 'Low Severity Issues');

      expect(criticalFactor).toBeDefined();
      expect(highFactor).toBeDefined();
      expect(mediumFactor).toBeDefined();
      expect(lowFactor).toBeDefined();
    });
  });

  describe('getSeverityFromScore', () => {
    it('should return critical for score >= 0.85', () => {
      expect(scorer.getSeverityFromScore(0.85)).toBe('critical');
      expect(scorer.getSeverityFromScore(0.95)).toBe('critical');
      expect(scorer.getSeverityFromScore(1.0)).toBe('critical');
    });

    it('should return high for score >= 0.70', () => {
      expect(scorer.getSeverityFromScore(0.70)).toBe('high');
      expect(scorer.getSeverityFromScore(0.80)).toBe('high');
    });

    it('should return medium for score >= 0.50', () => {
      expect(scorer.getSeverityFromScore(0.50)).toBe('medium');
      expect(scorer.getSeverityFromScore(0.65)).toBe('medium');
    });

    it('should return low for score < 0.50', () => {
      expect(scorer.getSeverityFromScore(0.0)).toBe('low');
      expect(scorer.getSeverityFromScore(0.49)).toBe('low');
    });
  });

  describe('getConfig', () => {
    it('should return config', () => {
      const config = scorer.getConfig();

      expect(config).toBeDefined();
      expect(config.defaultThreshold).toBe(0.75);
      expect(config.weights).toBeDefined();
    });
  });
});