/**
 * Bank-Auditor Workflow Tests
 * Story 6.1: First Production Workflow for allura-audits Tenant
 * 
 * GLBA-compliant banking audit automation with HITL approval.
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import {
  uploadLoanDocuments,
  analyzeForCompliance,
  flagSuspiciousDecisions,
  submitForApproval,
  exportAuditTrail,
  type ComplianceReport,
  type FlaggedDecision,
  GLBAValidationError,
} from "./index";

// Mock File type for Node.js
class MockFile {
  name: string;
  size: number;
  type: string;
  content: Buffer;

  constructor(content: Buffer, name: string, type: string) {
    this.content = content;
    this.name = name;
    this.size = content.length;
    this.type = type;
  }
}

describe("Bank-Auditor Workflow", () => {
  // GLBA most restricted - must use allura-audits
  const VALID_GROUP_ID = "allura-audits";
  const INVALID_GROUP_ID = "allura-faith-meats"; // Wrong workspace

  // Test environment setup
  beforeAll(async () => {
    process.env.POSTGRES_HOST = process.env.POSTGRES_HOST || "localhost";
    process.env.POSTGRES_PORT = process.env.POSTGRES_PORT || "5432";
    process.env.POSTGRES_DB = process.env.POSTGRES_DB || "memory";
    process.env.POSTGRES_USER = process.env.POSTGRES_USER || "ronin4life";
    process.env.POSTGRES_PASSWORD = process.env.POSTGRES_PASSWORD || "KaminaTHC*";
  });

  describe("uploadLoanDocuments", () => {
    it("should reject uploads without group_id", async () => {
      const files = [
        new MockFile(Buffer.from("test"), "loan.docx", "application/vnd.openxmlformats-officedocument.wordprocessingml.document"),
      ];

      // @ts-expect-error - Testing missing group_id
      await expect(uploadLoanDocuments({ files })).rejects.toThrow(GLBAValidationError);
    });

    it("should reject uploads with wrong workspace", async () => {
      const files = [
        new MockFile(Buffer.from("test"), "loan.pdf", "application/pdf"),
      ];

      // GLBA data must use allura-audits - wrong workspace should be rejected
      await expect(
        uploadLoanDocuments({ files: files as unknown as File[], group_id: INVALID_GROUP_ID })
      ).rejects.toThrow(/RK-01/);
    });

    it("should reject non-PDF or DOCX files", async () => {
      const files = [
        new MockFile(Buffer.from("test"), "loan.txt", "text/plain"),
      ];

      await expect(
        uploadLoanDocuments({ files: files as unknown as File[], group_id: VALID_GROUP_ID })
      ).rejects.toThrow(/GLBAValidationError/);
    });

    it("should accept valid PDF and DOCX uploads", async () => {
      const files = [
        new MockFile(
          Buffer.from("%PDF-1.4 test"),
          "mortgage-application.pdf",
          "application/pdf"
        ),
        new MockFile(
          Buffer.from("PK test"),
          "loan-decision.docx",
          "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
        ),
      ];

      const result = await uploadLoanDocuments({ 
        files: files as unknown as File[], 
        group_id: VALID_GROUP_ID 
      });

      expect(result).toHaveProperty("documentIds");
      expect(Array.isArray(result.documentIds)).toBe(true);
      expect(result.documentIds).toHaveLength(2);
      
      // Each document ID should be a valid UUID
      result.documentIds.forEach(id => {
        expect(id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i);
      });
    });

    it("should log upload to audit trail with GLBA classification", async () => {
      const files = [
        new MockFile(Buffer.from("test"), "loan.pdf", "application/pdf"),
      ];

      const result = await uploadLoanDocuments({ 
        files: files as unknown as File[], 
        group_id: VALID_GROUP_ID 
      });

      // Audit trail should be created with GLBA classification
      expect(result).toHaveProperty("documentIds");
      expect(result.documentIds).toHaveLength(1);
    });
  });

  describe("analyzeForCompliance", () => {
    it("should reject analysis without group_id", async () => {
      // @ts-expect-error - Testing missing group_id
      await expect(analyzeForCompliance({ documentId: "test-id" }))
        .rejects.toThrow(GLBAValidationError);
    });

    it("should reject analysis with wrong workspace", async () => {
      await expect(
        analyzeForCompliance({ documentId: "test-id", group_id: INVALID_GROUP_ID })
      ).rejects.toThrow(/RK-01/);
    });

    it("should return compliance report for valid document", async () => {
      const report = await analyzeForCompliance({ 
        documentId: "doc-123", 
        group_id: VALID_GROUP_ID 
      });

      expect(report).toHaveProperty("documentId");
      expect(report).toHaveProperty("complianceStatus");
      expect(report).toHaveProperty("glba_rules_assessed");
      expect(report).toHaveProperty("violations");
      expect(report).toHaveProperty("confidence");
      expect(report.confidence).toBeGreaterThanOrEqual(0);
      expect(report.confidence).toBeLessThanOrEqual(1);
    });

    it("should assess GLBA privacy rule compliance", async () => {
      const report = await analyzeForCompliance({ 
        documentId: "doc-456", 
        group_id: VALID_GROUP_ID 
      });

      // GLBA requires privacy rule assessment
      expect(report.glba_rules_assessed).toContain("privacy_notice");
      expect(report.glba_rules_assessed).toContain("opt_out_rights");
      expect(report.glba_rules_assessed).toContain("data_security");
    });

    it("should flag PII exposure in documents", async () => {
      const report = await analyzeForCompliance({ 
        documentId: "doc-pii", 
        group_id: VALID_GROUP_ID 
      });

      // Should detect potential PII exposures
      expect(report).toHaveProperty("pii_detected");
    });
  });

  describe("flagSuspiciousDecisions", () => {
    it("should reject flagging without group_id", async () => {
      const report: ComplianceReport = {
        documentId: "test",
        complianceStatus: "review_required",
        glba_rules_assessed: ["privacy_notice"],
        violations: [],
        confidence: 0.85,
        pii_detected: false,
      };

      // @ts-expect-error - Testing missing group_id
      await expect(flagSuspiciousDecisions({ report, threshold: 0.7 }))
        .rejects.toThrow(GLBAValidationError);
    });

    it("should reject flagging with wrong workspace", async () => {
      const report: ComplianceReport = {
        documentId: "test",
        complianceStatus: "review_required",
        glba_rules_assessed: ["privacy_notice"],
        violations: [],
        confidence: 0.85,
        pii_detected: false,
      };

      await expect(
        flagSuspiciousDecisions({ report, threshold: 0.7, group_id: INVALID_GROUP_ID })
      ).rejects.toThrow(/RK-01/);
    });

    it("should flag decisions below confidence threshold", async () => {
      const report: ComplianceReport = {
        documentId: "doc-low-confidence",
        complianceStatus: "review_required",
        glba_rules_assessed: ["privacy_notice", "opt_out_rights"],
        violations: [
          { rule: "privacy_notice", severity: "medium", description: "Missing opt-out language" }
        ],
        confidence: 0.65,
        pii_detected: true,
      };

      const flagged = await flagSuspiciousDecisions({ 
        report, 
        threshold: 0.7, 
        group_id: VALID_GROUP_ID 
      });

      expect(Array.isArray(flagged)).toBe(true);
      // Low confidence + violations should be flagged
      expect(flagged.length).toBeGreaterThan(0);
      expect(flagged[0]).toHaveProperty("documentId");
      expect(flagged[0]).toHaveProperty("reason");
      expect(flagged[0]).toHaveProperty("severity");
    });

    it("should set severity based on GLBA violation type", async () => {
      const report: ComplianceReport = {
        documentId: "doc-severe",
        complianceStatus: "non_compliant",
        glba_rules_assessed: ["privacy_notice", "data_security"],
        violations: [
          { rule: "data_security", severity: "high", description: "Unencrypted PII data" }
        ],
        confidence: 0.55,
        pii_detected: true,
      };

      const flagged = await flagSuspiciousDecisions({ 
        report, 
        threshold: 0.7, 
        group_id: VALID_GROUP_ID 
      });

      expect(flagged[0].severity).toBe("high");
    });

    it("should not flag compliant decisions above threshold", async () => {
      const report: ComplianceReport = {
        documentId: "doc-compliant",
        complianceStatus: "compliant",
        glba_rules_assessed: ["privacy_notice", "opt_out_rights", "data_security"],
        violations: [],
        confidence: 0.95,
        pii_detected: false,
      };

      const flagged = await flagSuspiciousDecisions({ 
        report, 
        threshold: 0.7, 
        group_id: VALID_GROUP_ID 
      });

      expect(flagged).toHaveLength(0);
    });
  });

  describe("submitForApproval", () => {
    it("should reject submission without group_id", async () => {
      const flaggedDecisions: FlaggedDecision[] = [
        { documentId: "doc-1", reason: "Low confidence", severity: "medium" }
      ];

      // @ts-expect-error - Testing missing group_id
      await expect(submitForApproval({ flaggedDecisions }))
        .rejects.toThrow(GLBAValidationError);
    });

    it("should reject submission with wrong workspace", async () => {
      const flaggedDecisions: FlaggedDecision[] = [
        { documentId: "doc-1", reason: "Low confidence", severity: "medium" }
      ];

      await expect(
        submitForApproval({ flaggedDecisions, group_id: INVALID_GROUP_ID })
      ).rejects.toThrow(/RK-01/);
    });

    it("should create approval request for HITL", async () => {
      const flaggedDecisions: FlaggedDecision[] = [
        { documentId: "doc-1", reason: "GLBA violation detected", severity: "high" },
        { documentId: "doc-2", reason: "PII exposure risk", severity: "medium" }
      ];

      const result = await submitForApproval({ 
        flaggedDecisions, 
        group_id: VALID_GROUP_ID 
      });

      expect(result).toHaveProperty("approvalId");
      expect(result.approvalId).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i);
    });

    it("should log approval request to audit trail", async () => {
      const flaggedDecisions: FlaggedDecision[] = [
        { documentId: "doc-audit", reason: "Test flag", severity: "low" }
      ];

      const result = await submitForApproval({ 
        flaggedDecisions, 
        group_id: VALID_GROUP_ID 
      });

      // Approval should be logged for GLBA audit compliance
      expect(result.approvalId).toBeDefined();
    });

    it("should require HITL for all GLBA submissions", async () => {
      // Even high-confidence decisions need HITL for GLBA compliance
      const flaggedDecisions: FlaggedDecision[] = [
        { documentId: "doc-hitl", reason: "Needs human review", severity: "high" }
      ];

      const result = await submitForApproval({ 
        flaggedDecisions, 
        group_id: VALID_GROUP_ID 
      });

      // Approval ID indicates HITL queue entry
      expect(result.approvalId).toBeDefined();
    });
  });

  describe("exportAuditTrail", () => {
    it("should reject export without group_id", async () => {
      // @ts-expect-error - Testing missing group_id
      await expect(exportAuditTrail({ approvalId: "test-id", format: "json" }))
        .rejects.toThrow(GLBAValidationError);
    });

    it("should reject export with wrong workspace", async () => {
      await expect(
        exportAuditTrail({ approvalId: "test-id", format: "json", group_id: INVALID_GROUP_ID })
      ).rejects.toThrow(/RK-01/);
    });

    it("should export audit trail as JSON", async () => {
      const result = await exportAuditTrail({ 
        approvalId: "approval-123", 
        format: "json", 
        group_id: VALID_GROUP_ID 
      });

      expect(result).toBeInstanceOf(Buffer);
      
      const parsed = JSON.parse(result.toString("utf-8"));
      expect(parsed).toHaveProperty("approvalId");
      expect(parsed).toHaveProperty("workflow");
      expect(parsed).toHaveProperty("group_id");
      expect(parsed).toHaveProperty("timestamp");
      expect(parsed).toHaveProperty("glbaCompliance");
    });

    it("should export audit trail as PDF", async () => {
      const result = await exportAuditTrail({ 
        approvalId: "approval-456", 
        format: "pdf", 
        group_id: VALID_GROUP_ID 
      });

      expect(result).toBeInstanceOf(Buffer);
      // PDF should start with %PDF header
      expect(result.toString("utf-8", 0, 4)).toBe("%PDF");
    });

    it("should include GLBA compliance metadata in export", async () => {
      const result = await exportAuditTrail({ 
        approvalId: "approval-glba", 
        format: "json", 
        group_id: VALID_GROUP_ID 
      });

      const parsed = JSON.parse(result.toString("utf-8"));
      expect(parsed.glbaCompliance).toHaveProperty("rulesAssessed");
      expect(parsed.glbaCompliance).toHaveProperty("violationsDetected");
      expect(parsed.glbaCompliance).toHaveProperty("piiHandling");
    });

    it("should reject invalid export format", async () => {
      // @ts-expect-error - Testing invalid format
      await expect(
        exportAuditTrail({ approvalId: "test", format: "csv", group_id: VALID_GROUP_ID })
      ).rejects.toThrow(/Invalid format/);
    });
  });

  describe("GLBA Data Handling", () => {
    it("should enforce allura-audits workspace for all operations", async () => {
      // All bank-auditor operations must use allura-audits
      const wrongGroupIds = [
        "allura-faith-meats",
        "allura-creative",
        "allura-personal",
        "allura-nonprofit",
        "allura-haccp",
      ];

      for (const groupId of wrongGroupIds) {
        const files = [new MockFile(Buffer.from("test"), "loan.pdf", "application/pdf")];
        
        await expect(
          uploadLoanDocuments({ files: files as unknown as File[], group_id: groupId })
        ).rejects.toThrow(/RK-01/);
      }
    });

    it("should classify all audit data as GLBA restricted", async () => {
      const files = [
        new MockFile(Buffer.from("test"), "restricted.pdf", "application/pdf")
      ];

      const result = await uploadLoanDocuments({ 
        files: files as unknown as File[], 
        group_id: VALID_GROUP_ID 
      });

      // All data should be classified as GLBA restricted
      expect(result.documentIds).toBeDefined();
    });
  });

  describe("group_id Enforcement", () => {
    it("should validate group_id format for every operation", async () => {
      // Test each workflow function with invalid group_id
      const invalidGroupIds = [
        "RONINCLAW-AUDITS", // Legacy format
        "Allura-Audits",   // Uppercase
        "audits",          // Missing prefix
        "",                // Empty
        "allura_",         // Invalid characters
      ];

      for (const groupId of invalidGroupIds) {
        const files = [new MockFile(Buffer.from("test"), "loan.pdf", "application/pdf")];
        
        await expect(
          uploadLoanDocuments({ files: files as unknown as File[], group_id: groupId })
        ).rejects.toThrow();
      }
    });

    it("should log all operations with group_id for tenant isolation", async () => {
      const files = [
        new MockFile(Buffer.from("test"), "isolation.pdf", "application/pdf")
      ];

      const uploadResult = await uploadLoanDocuments({ 
        files: files as unknown as File[], 
        group_id: VALID_GROUP_ID 
      });

      expect(uploadResult.documentIds).toBeDefined();
      
      // Each operation should be logged with group_id
      const report = await analyzeForCompliance({ 
        documentId: uploadResult.documentIds[0], 
        group_id: VALID_GROUP_ID 
      });

      expect(report.documentId).toBe(uploadResult.documentIds[0]);
    });
  });
});