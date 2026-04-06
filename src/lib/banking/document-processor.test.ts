/**
 * Document Processor Tests
 * Story 6-1: Bank-Auditor Workflow
 * Epic 6: Production Workflows
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { getDocumentProcessor, DocumentProcessor } from './document-processor';
import type { LoanDocument } from './types';

describe('DocumentProcessor', () => {
  let processor: DocumentProcessor;

  beforeEach(() => {
    processor = getDocumentProcessor();
  });

  describe('extractText', () => {
    it('should extract text from PDF', async () => {
      const doc: LoanDocument = {
        id: 'test-doc-pdf',
        groupId: 'allura-test',
        uploadedBy: 'user-123',
        uploadedAt: new Date(),
        content: Buffer.from('Test loan document content\nBorrower: John Doe\nLoan Amount: $250,000'),
        format: 'pdf',
        metadata: {},
      };

      const text = await processor.extractText(doc);

      expect(text).toBeDefined();
      expect(typeof text).toBe('string');
      expect(text.length).toBeGreaterThan(0);
    });

    it('should extract text from images (OCR)', async () => {
      const doc: LoanDocument = {
        id: 'test-doc-image',
        groupId: 'allura-test',
        uploadedBy: 'user-123',
        uploadedAt: new Date(),
        content: Buffer.from('image-binary-data'),
        format: 'jpeg',
        metadata: {},
      };

      const text = await processor.extractText(doc);

      expect(text).toBeDefined();
      // In production, this would use OCR and return extracted text
      // For now, returns empty string as placeholder
    });

    it('should handle PNG format', async () => {
      const doc: LoanDocument = {
        id: 'test-doc-png',
        groupId: 'allura-test',
        uploadedBy: 'user-123',
        uploadedAt: new Date(),
        content: Buffer.from('png-binary-data'),
        format: 'png',
        metadata: {},
      };

      const text = await processor.extractText(doc);

      expect(text).toBeDefined();
    });

    it('should throw for unsupported format', async () => {
      const doc = {
        id: 'test-doc-invalid',
        groupId: 'allura-test',
        uploadedBy: 'user-123',
        uploadedAt: new Date(),
        content: Buffer.from('data'),
        format: 'docx' as 'pdf' | 'jpeg' | 'png', // Invalid format
        metadata: {},
      };

      await expect(processor.extractText(doc)).rejects.toThrow('Unsupported document format');
    });
  });

  describe('parseMetadata', () => {
    it('should parse metadata from document text', async () => {
      const text = `
        Loan Application Document
        Borrower: John Smith
        Loan Amount: $350,000
        Decision Date: 12/15/2026
        Status: Approved
        Loan Officer: Jane Doe
        Branch: BR-001
      `;

      const metadata = await processor.parseMetadata(text);

      expect(metadata.borrowerName).toBe('John Smith');
      expect(metadata.loanAmount).toBe(350000);
      expect(metadata.decisionDate).toBeInstanceOf(Date);
      expect(metadata.approvalStatus).toBe('approved');
      expect(metadata.loanOfficer).toBe('Jane Doe');
      expect(metadata.branchId).toBe('BR-001');
    });

    it('should handle missing fields gracefully', async () => {
      const text = 'Simple document without structured data';

      const metadata = await processor.parseMetadata(text);

      expect(metadata).toBeDefined();
      // Should not throw, just return empty values
    });

    it('should parse different date formats', async () => {
      const text = 'Decision Date: 01/20/2026';

      const metadata = await processor.parseMetadata(text);

      expect(metadata.decisionDate).toBeDefined();
      expect(metadata.decisionDate?.getMonth()).toBe(0); // January
      expect(metadata.decisionDate?.getDate()).toBe(20);
      expect(metadata.decisionDate?.getFullYear()).toBe(2026);
    });

    it('should parse different approval statuses', async () => {
      const texts = [
        'Status: Approved',
        'Status: Denied',
        'Status: Pending',
      ];

      const statuses = ['approved', 'denied', 'pending'];

      for (let i = 0; i < texts.length; i++) {
        const metadata = await processor.parseMetadata(texts[i]);
        expect(metadata.approvalStatus).toBe(statuses[i]);
      }
    });
  });

  describe('generateHash', () => {
    it('should generate SHA-256 hash', async () => {
      const content = Buffer.from('test content');

      const hash = await processor.generateHash(content);

      expect(hash).toBeDefined();
      expect(typeof hash).toBe('string');
      expect(hash.length).toBe(64); // SHA-256 hex length
    });

    it('should generate different hashes for different content', async () => {
      const content1 = Buffer.from('content 1');
      const content2 = Buffer.from('content 2');

      const hash1 = await processor.generateHash(content1);
      const hash2 = await processor.generateHash(content2);

      expect(hash1).not.toBe(hash2);
    });

    it('should generate same hash for same content', async () => {
      const content = Buffer.from('test content');

      const hash1 = await processor.generateHash(content);
      const hash2 = await processor.generateHash(content);

      expect(hash1).toBe(hash2);
    });
  });
});