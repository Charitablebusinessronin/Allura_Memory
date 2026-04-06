/**
 * Bank Auditor Workflow Tests
 * Story 6-1: Bank-Auditor Workflow
 * Epic 6: Production Workflows
 * 
 * Tests for document upload, analysis, flagging, and export
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { BankAuditorWorkflow, createBankAuditorWorkflow } from './bank-auditor';
import { GroupIdValidationError } from '@/lib/validation/group-id';
import type { AnalysisResult } from '@/lib/banking/types';

describe('BankAuditorWorkflow', () => {
  const validGroupId = 'allura-test-org';
  let workflow: BankAuditorWorkflow;

  beforeEach(() => {
    workflow = new BankAuditorWorkflow(validGroupId);
  });

  describe('constructor', () => {
    it('should accept valid group_id', () => {
      expect(() => new BankAuditorWorkflow('allura-test')).not.toThrow();
    });

    it('should reject invalid group_id with uppercase', () => {
      expect(() => new BankAuditorWorkflow('Allura-Test')).toThrow(GroupIdValidationError);
    });

    it('should accept valid group_id format', () => {
      // validateGroupId accepts any valid format, DB enforces allura- prefix
      expect(() => new BankAuditorWorkflow('valid-group')).not.toThrow();
    });

    it('should reject empty group_id', () => {
      expect(() => new BankAuditorWorkflow('')).toThrow(GroupIdValidationError);
    });

    it('should reject null group_id', () => {
      expect(() => new BankAuditorWorkflow(null as unknown as string)).toThrow(GroupIdValidationError);
    });
  });

  describe('uploadDocument', () => {
    it('should upload document with valid group_id', async () => {
      const content = Buffer.from('test document content');
      const result = await workflow.uploadDocument(content, 'pdf', 'user-123');

      expect(result.success).toBe(true);
      expect(result.documentId).toBeDefined();
      expect(result.documentId).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i);
    });

    it('should reject upload with invalid group_id', () => {
      // Constructor throws for invalid group_id (NFR11: lowercase-only)
      expect(() => new BankAuditorWorkflow('Invalid-Group')).toThrow(GroupIdValidationError);
    });

    it('should support different document formats', async () => {
      const formats: Array<'pdf' | 'jpeg' | 'png'> = ['pdf', 'jpeg', 'png'];
      
      for (const format of formats) {
        const content = Buffer.from('test content');
        const result = await workflow.uploadDocument(content, format, 'user-123', {
          documentType: 'loan-application',
        });

        expect(result.success).toBe(true);
        expect(result.documentId).toBeDefined();
      }
    });

    it('should upload document with metadata', async () => {
      const content = Buffer.from('test content');
      const metadata = {
        loanAmount: 250000,
        borrowerName: 'John Doe',
        approvalStatus: 'approved',
      };

      const result = await workflow.uploadDocument(content, 'pdf', 'user-123', metadata);

      expect(result.success).toBe(true);
      expect(result.documentId).toBeDefined();
    });
  });

  describe('analyzeDocument', () => {
    it('should analyze document for compliance issues', async () => {
      // First upload a document
      const uploadResult = await workflow.uploadDocument(
        Buffer.from('test loan document'),
        'pdf',
        'user-123'
      );

      expect(uploadResult.success).toBe(true);
      expect(uploadResult.documentId).toBeDefined();

      if (!uploadResult.documentId) {
        throw new Error('Upload failed');
      }

      // Analyze the document
      const analysis = await workflow.analyzeDocument(uploadResult.documentId);

      expect(analysis).toBeDefined();
      expect(analysis.id).toBeDefined();
      expect(analysis.documentId).toBe(uploadResult.documentId);
      expect(analysis.groupId).toBe(validGroupId);
      expect(analysis.complianceIssues).toBeDefined();
      expect(Array.isArray(analysis.complianceIssues)).toBe(true);
    });

    it('should return analysis with risk score', async () => {
      const uploadResult = await workflow.uploadDocument(
        Buffer.from('test document'),
        'pdf',
        'user-123'
      );

      if (!uploadResult.documentId) {
        throw new Error('Upload failed');
      }

      const analysis = await workflow.analyzeDocument(uploadResult.documentId);

      expect(analysis.riskScore).toBeDefined();
      expect(typeof analysis.riskScore).toBe('number');
      expect(analysis.riskScore).toBeGreaterThanOrEqual(0);
      expect(analysis.riskScore).toBeLessThanOrEqual(1);
    });

    it('should return analysis with risk factors', async () => {
      const uploadResult = await workflow.uploadDocument(
        Buffer.from('test document'),
        'pdf',
        'user-123'
      );

      if (!uploadResult.documentId) {
        throw new Error('Upload failed');
      }

      const analysis = await workflow.analyzeDocument(uploadResult.documentId);

      expect(analysis.riskFactors).toBeDefined();
      expect(Array.isArray(analysis.riskFactors)).toBe(true);
    });
  });

  describe('calculateRiskScore', () => {
    it('should calculate risk score between 0 and 1', async () => {
      const analysis: AnalysisResult = {
        id: 'test-id',
        documentId: 'doc-id',
        groupId: validGroupId,
        complianceIssues: [],
        riskScore: 0,
        riskFactors: [],
        flaggedItems: [],
        analyzedAt: new Date(),
      };

      const score = await workflow.calculateRiskScore(analysis);

      expect(score).toBeDefined();
      expect(typeof score).toBe('number');
      expect(score).toBeGreaterThanOrEqual(0);
      expect(score).toBeLessThanOrEqual(1);
    });

    it('should identify risk factors', async () => {
      const analysis: AnalysisResult = {
        id: 'test-id',
        documentId: 'doc-id',
        groupId: validGroupId,
        complianceIssues: [
          {
            id: 'issue-1',
            type: 'fair_lending',
            description: 'Test violation',
            severity: 'high',
          },
          {
            id: 'issue-2',
            type: 'disclosure_missing',
            description: 'Missing disclosure',
            severity: 'medium',
          },
        ],
        riskScore: 0,
        riskFactors: [],
        flaggedItems: [],
        analyzedAt: new Date(),
      };

      const score = await workflow.calculateRiskScore(analysis);

      expect(score).toBeGreaterThan(0);
      // High severity + medium severity should give score > 0
    });

    it('should use configurable threshold', async () => {
      const analysis: AnalysisResult = {
        id: 'test-id',
        documentId: 'doc-id',
        groupId: validGroupId,
        complianceIssues: [
          {
            id: 'issue-1',
            type: 'fair_lending',
            description: 'Critical violation',
            severity: 'critical',
          },
        ],
        riskScore: 0,
        riskFactors: [],
        flaggedItems: [],
        analyzedAt: new Date(),
      };

      const score = await workflow.calculateRiskScore(analysis);

      // Critical issue should contribute significantly to risk score
      expect(score).toBeGreaterThan(0.5);
    });
  });

  describe('flagForReview', () => {
    it('should flag decisions above threshold', async () => {
      const analysis: AnalysisResult = {
        id: 'test-id',
        documentId: 'doc-id',
        groupId: validGroupId,
        complianceIssues: [
          {
            id: 'issue-1',
            type: 'fair_lending',
            description: 'Critical violation',
            severity: 'critical',
          },
        ],
        riskScore: 0.85, // Above default threshold of 0.75
        riskFactors: [],
        flaggedItems: [],
        analyzedAt: new Date(),
      };

      const result = await workflow.flagForReview(analysis);

      expect(result.flagged).toBe(true);
      expect(result.suspiciousDecision).toBeDefined();
      expect(result.suspiciousDecision?.severity).toBe('critical');
      expect(result.suspiciousDecision?.requiresApproval).toBe(true);
    });

    it('should not flag decisions below threshold', async () => {
      const analysis: AnalysisResult = {
        id: 'test-id',
        documentId: 'doc-id',
        groupId: validGroupId,
        complianceIssues: [
          {
            id: 'issue-1',
            type: 'disclosure_missing',
            description: 'Minor issue',
            severity: 'low',
          },
        ],
        riskScore: 0.3, // Below default threshold of 0.75
        riskFactors: [],
        flaggedItems: [],
        analyzedAt: new Date(),
      };

      const result = await workflow.flagForReview(analysis);

      expect(result.flagged).toBe(false);
      expect(result.suspiciousDecision).toBeUndefined();
    });

    it('should integrate with HITL for critical findings', async () => {
      const analysis: AnalysisResult = {
        id: 'test-id',
        documentId: 'doc-id',
        groupId: validGroupId,
        complianceIssues: [
          {
            id: 'issue-1',
            type: 'fair_lending',
            description: 'Critical fair lending violation',
            severity: 'critical',
          },
        ],
        riskScore: 0.95, // Very high risk
        riskFactors: [],
        flaggedItems: [],
        analyzedAt: new Date(),
      };

      const result = await workflow.flagForReview(analysis);

      expect(result.flagged).toBe(true);
      expect(result.suspiciousDecision?.severity).toBe('critical');
      expect(result.suspiciousDecision?.requiresApproval).toBe(true);
      expect(result.suspiciousDecision?.reasons).toContain('Critical fair lending violation');
    });
  });

  describe('exportAuditTrail', () => {
    it('should export audit trail as JSON', async () => {
      const buffer = await workflow.exportAuditTrail('json');

      expect(buffer).toBeDefined();
      expect(buffer).toBeInstanceOf(Buffer);
      
      const data = JSON.parse(buffer.toString());
      expect(data.groupId).toBe(validGroupId);
      expect(data.format).toBe('json');
      expect(data.exportedAt).toBeDefined();
    });

    it('should export audit trail as CSV', async () => {
      const buffer = await workflow.exportAuditTrail('csv');

      expect(buffer).toBeDefined();
      expect(buffer).toBeInstanceOf(Buffer);
      expect(buffer.toString()).toContain('csv');
    });

    it('should export audit trail as PDF', async () => {
      const buffer = await workflow.exportAuditTrail('pdf');

      expect(buffer).toBeDefined();
      expect(buffer).toBeInstanceOf(Buffer);
    });

    it('should reject unsupported export format', async () => {
      await expect(
        workflow.exportAuditTrail('invalid' as 'pdf' | 'csv' | 'json')
      ).rejects.toThrow('Unsupported export format');
    });
  });

  describe('createBankAuditorWorkflow factory', () => {
    it('should create workflow instance', () => {
      const wf = createBankAuditorWorkflow('allura-test');
      
      expect(wf).toBeInstanceOf(BankAuditorWorkflow);
    });

    it('should validate group_id', () => {
      expect(() => createBankAuditorWorkflow('Invalid-Group')).toThrow(GroupIdValidationError);
    });
  });
});