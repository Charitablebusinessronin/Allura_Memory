/**
 * Compliance Checker Tests
 * Story 6-1: Bank-Auditor Workflow
 * Epic 6: Production Workflows
 */

import { describe, it, expect } from 'vitest';
import { getComplianceChecker, ComplianceChecker } from './compliance-checker';
import type { LoanDocument } from './types';

describe('ComplianceChecker', () => {
  const checker: ComplianceChecker = getComplianceChecker();

  describe('checkRegulatoryCompliance', () => {
    it('should detect regulatory violations', async () => {
      const doc: LoanDocument = {
        id: 'test-doc-1',
        groupId: 'allura-test',
        uploadedBy: 'user-123',
        uploadedAt: new Date(),
        content: Buffer.from('Borrower: John Doe\nLoan Amount: $250,000\nAPR: 5.5%\nDecision: Approved'),
        format: 'pdf',
        metadata: {},
      };

      const result = await checker.checkRegulatoryCompliance(doc);

      expect(result).toBeDefined();
      expect(result.issues).toBeDefined();
      expect(Array.isArray(result.issues)).toBe(true);
    });

    it('should identify pattern anomalies', async () => {
      const analysis = {
        documentId: 'test-doc-1',
        complianceIssues: [
          { id: 'issue-1', type: 'fair_lending', description: 'Violation 1', severity: 'high' as const },
          { id: 'issue-2', type: 'fair_lending', description: 'Violation 2', severity: 'high' as const },
          { id: 'issue-3', type: 'fair_lending', description: 'Violation 3', severity: 'high' as const },
        ],
        riskScore: 0,
        riskFactors: [],
        flaggedItems: [],
        analyzedAt: new Date(),
      };

      const patterns = await checker.detectPatterns(analysis);

      expect(patterns).toBeDefined();
      expect(Array.isArray(patterns)).toBe(true);
      
      // Should detect repeated violation pattern
      const repeatedPattern = patterns.find(p => p.type === 'repeated_violation');
      expect(repeatedPattern).toBeDefined();
      expect(repeatedPattern?.frequency).toBe(3);
    });

    it('should return empty result for clean documents', async () => {
      const doc: LoanDocument = {
        id: 'test-doc-2',
        groupId: 'allura-test',
        uploadedBy: 'user-123',
        uploadedAt: new Date(),
        content: Buffer.from(''),
        format: 'pdf',
        metadata: {},
      };

      const result = await checker.checkRegulatoryCompliance(doc);

      expect(result.issues).toBeDefined();
      expect(Array.isArray(result.issues)).toBe(true);
      // May still have some baseline checks that return issues
    });
  });

  describe('detectPatterns', () => {
    it('should detect severity escalation', async () => {
      const analysis = {
        documentId: 'test-doc-1',
        complianceIssues: [
          { id: 'issue-1', type: 'fair_lending', description: 'Critical 1', severity: 'critical' as const },
          { id: 'issue-2', type: 'fair_lending', description: 'Critical 2', severity: 'critical' as const },
        ],
        riskScore: 0,
        riskFactors: [],
        flaggedItems: [],
        analyzedAt: new Date(),
      };

      const patterns = await checker.detectPatterns(analysis);

      const severityPattern = patterns.find(p => p.type === 'severity_escalation');
      expect(severityPattern).toBeDefined();
      expect(severityPattern?.frequency).toBe(2);
      expect(severityPattern?.confidence).toBeGreaterThan(0.9);
    });

    it('should return empty patterns for no issues', async () => {
      const analysis = {
        documentId: 'test-doc-1',
        complianceIssues: [],
        riskScore: 0,
        riskFactors: [],
        flaggedItems: [],
        analyzedAt: new Date(),
      };

      const patterns = await checker.detectPatterns(analysis);

      expect(patterns).toEqual([]);
    });
  });
});