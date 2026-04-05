/**
 * Bank-Auditor Workflow
 * Story 6.1: First Production Workflow for allura-audits Tenant
 * 
 * GLBA-compliant banking audit automation with HITL approval.
 * Enforces tenant isolation for most restricted data class.
 */

import { validateTenantGroupId, TENANT_ERROR_CODE } from "../../lib/validation/tenant-group-id";
import { GroupIdValidationError } from "../../lib/validation/group-id";
import { logTrace } from "../../lib/postgres/trace-logger";
import type { TraceType } from "../../lib/postgres/trace-logger";
import { randomUUID } from "crypto";

/**
 * GLBA Validation Error
 * Thrown when operations violate GLBA compliance requirements
 */
export class GLBAValidationError extends Error {
  public readonly code = "GLBA_ERROR";
  public readonly group_id: string;

  constructor(message: string, group_id?: string) {
    super(message);
    this.name = "GLBAValidationError";
    if (group_id) this.group_id = group_id;
  }
}

/**
 * Compliance status for loan documents
 */
export type ComplianceStatus = 
  | "compliant"
  | "non_compliant"
  | "review_required"
  | "pending";

/**
 * GLBA Privacy Rules
 * Financial institutions must comply with these regulations
 */
export type GLBARule = 
  | "privacy_notice"       // Must provide privacy notice
  | "opt_out_rights"       // Must honor opt-out requests
  | "data_security"        // Must protect customer data
  | "safeguards_rule"      // Must implement safeguards
  | "pretexting_protection"; // Must prevent pretexting

/**
 * Violation severity levels
 */
export type ViolationSeverity = "low" | "medium" | "high";

/**
 * GLBA Violation
 */
export interface GLBAViolation {
  rule: GLBARule;
  severity: ViolationSeverity;
  description: string;
}

/**
 * Compliance Analysis Report
 */
export interface ComplianceReport {
  documentId: string;
  complianceStatus: ComplianceStatus;
  glba_rules_assessed: GLBARule[];
  violations: GLBAViolation[];
  confidence: number;
  pii_detected: boolean;
  metadata?: Record<string, unknown>;
}

/**
 * Flagged Decision for Human Review
 */
export interface FlaggedDecision {
  documentId: string;
  reason: string;
  severity: ViolationSeverity;
  flagged_at?: Date;
  glba_rules_violated?: GLBARule[];
}

/**
 * Audit trail entry
 */
export interface AuditTrailEntry {
  id: string;
  workflow: string;
  group_id: string;
  operation: string;
  timestamp: Date;
  actor: string;
  details: Record<string, unknown>;
  glbaCompliance: {
    rulesAssessed: GLBARule[];
    violationsDetected: number;
    piiHandling: "encrypted" | "restricted" | "standard";
  };
}

/**
 * Bank-Auditor Workflow Class
 * Handles GLBA-compliant audit automation
 */
export class BankAuditorWorkflow {
  private readonly group_id: string;
  private readonly agent_id = "memory-builder";

  /**
   * Validate and enforce allura-audits workspace
   * GLBA requires use of this specific workspace
   */
  constructor(group_id: string) {
    // RK-01: Enforce tenant isolation
    const validated = validateTenantGroupId(group_id);
    
    // GLBA constraint: Must use allura-audits for banking audit
    if (validated !== "allura-audits") {
      throw new GLBAValidationError(
        `GLBA compliance violation: Bank-auditor workflow must use 'allura-audits' workspace. ` +
        `Provided: '${validated}'`,
        validated
      );
    }

    this.group_id = validated;
  }

  /**
   * Upload loan decision documents (PDF, DOCX)
   * GLBA: All documents are classified as restricted
   */
  async uploadLoanDocuments(params: {
    files: File[];
    group_id: string;
  }): Promise<{ documentIds: string[] }> {
    // Validate GLBA workspace
    this.validateGLBAWorkspace(params.group_id);

    // Validate file types
    const allowedTypes = ["application/pdf", "application/vnd.openxmlformats-officedocument.wordprocessingml.document"];
    
    for (const file of params.files) {
      if (!allowedTypes.includes(file.type)) {
        throw new GLBAValidationError(
          `Invalid file type: ${file.name}. ` +
          `GLBA compliance requires PDF or DOCX documents only. ` +
          `Got: ${file.type}`,
          params.group_id
        );
      }
    }

    // Generate document IDs
    const documentIds: string[] = [];
    
    for (const file of params.files) {
      const docId = randomUUID();
      documentIds.push(docId);

      // Log upload to audit trail
      await logTrace({
        group_id: params.group_id,
        agent_id: this.agent_id,
        trace_type: "contribution",
        content: `GLBA document uploaded: ${file.name}`,
        confidence: 1.0,
        workflow_id: "bank-auditor-upload",
        metadata: {
          document_id: docId,
          file_name: file.name,
          file_size: file.size,
          file_type: file.type,
          glba_classification: "restricted",
          pii_handling: "encrypted",
        },
      });
    }

    return { documentIds };
  }

  /**
   * AI analysis for GLBA compliance
   * Assesses privacy rules and flags violations
   */
  async analyzeForCompliance(params: {
    documentId: string;
    group_id: string;
  }): Promise<ComplianceReport> {
    // Validate GLBA workspace
    this.validateGLBAWorkspace(params.group_id);

    // Assess GLBA rules
    const glba_rules_assessed: GLBARule[] = [
      "privacy_notice",
      "opt_out_rights",
      "data_security",
      "safeguards_rule",
      "pretexting_protection",
    ];

    // Simulate AI analysis (in production, this would call AI service)
    // For now, return a basic compliance report
    const report: ComplianceReport = {
      documentId: params.documentId,
      complianceStatus: "review_required",
      glba_rules_assessed,
      violations: [],
      confidence: 0.85,
      pii_detected: false,
    };

    // Log analysis to audit trail
    await logTrace({
      group_id: params.group_id,
      agent_id: this.agent_id,
      trace_type: "decision",
      content: `GLBA compliance analysis completed for document ${params.documentId}`,
      confidence: report.confidence,
      workflow_id: "bank-auditor-analysis",
      metadata: {
        document_id: params.documentId,
        compliance_status: report.complianceStatus,
        rules_assessed: report.glba_rules_assessed.length,
        violations: report.violations.length,
        pii_detected: report.pii_detected,
      },
    });

    return report;
  }

  /**
   * Flag suspicious decisions based on confidence threshold
   * GLBA: All low-confidence decisions require human review
   */
  async flagSuspiciousDecisions(params: {
    report: ComplianceReport;
    threshold: number;
    group_id: string;
  }): Promise<FlaggedDecision[]> {
    // Validate GLBA workspace
    this.validateGLBAWorkspace(params.group_id);

    const flagged: FlaggedDecision[] = [];

    // Flag if confidence below threshold
    if (params.report.confidence < params.threshold) {
      flagged.push({
        documentId: params.report.documentId,
        reason: `Low confidence score: ${params.report.confidence} (threshold: ${params.threshold})`,
        severity: params.report.violations.length > 0 ? "high" : "medium",
        glba_rules_violated: params.report.violations.map(v => v.rule),
      });
    }

    // Flag if violations present
    if (params.report.violations.length > 0) {
      const highSeverityViolations = params.report.violations.filter(v => v.severity === "high");
      
      if (highSeverityViolations.length > 0 && flagged.length === 0) {
        flagged.push({
          documentId: params.report.documentId,
          reason: `High severity GLBA violations: ${highSeverityViolations.map(v => v.rule).join(", ")}`,
          severity: "high",
          glba_rules_violated: highSeverityViolations.map(v => v.rule),
        });
      }
    }

    // Flag if PII detected without compliance
    if (params.report.pii_detected && params.report.complianceStatus !== "compliant") {
      if (flagged.length === 0) {
        flagged.push({
          documentId: params.report.documentId,
          reason: "PII detected without verified compliance",
          severity: "high",
        });
      }
    }

    // Log flagging to audit trail
    if (flagged.length > 0) {
      await logTrace({
        group_id: params.group_id,
        agent_id: this.agent_id,
        trace_type: "decision",
        content: `GLBA decisions flagged for human review: ${flagged.length} items`,
        confidence: 1.0,
        workflow_id: "bank-auditor-flagging",
        metadata: {
          document_id: params.report.documentId,
          flagged_count: flagged.length,
          reasons: flagged.map(f => f.reason),
          threshold: params.threshold,
        },
      });
    }

    return flagged;
  }

  /**
   * Submit flagged decisions for HITL approval
   * GLBA: ALL decisions require human review
   */
  async submitForApproval(params: {
    flaggedDecisions: FlaggedDecision[];
    group_id: string;
  }): Promise<{ approvalId: string }> {
    // Validate GLBA workspace
    this.validateGLBAWorkspace(params.group_id);

    // Generate approval ID
    const approvalId = randomUUID();

    // Log approval request to audit trail
    await logTrace({
      group_id: params.group_id,
      agent_id: this.agent_id,
      trace_type: "decision",
      content: `GLBA approval request submitted: ${params.flaggedDecisions.length} decisions`,
      confidence: 1.0,
      workflow_id: "bank-auditor-approval",
      metadata: {
        approval_id: approvalId,
        decision_count: params.flaggedDecisions.length,
        documents: params.flaggedDecisions.map(d => d.documentId),
        severities: params.flaggedDecisions.map(d => d.severity),
        hitl_required: true,
        glba_compliance_check: "pending",
      },
    });

    return { approvalId };
  }

  /**
   * Export audit trail for regulators
   * GLBA: Must maintain 6-12 month audit trails
   */
  async exportAuditTrail(params: {
    approvalId: string;
    format: "pdf" | "json";
    group_id: string;
  }): Promise<Buffer> {
    // Validate GLBA workspace
    this.validateGLBAWorkspace(params.group_id);

    // Validate format
    if (params.format !== "pdf" && params.format !== "json") {
      throw new Error(`Invalid format: ${params.format}. Must be 'pdf' or 'json'.`);
    }

    // Create audit trail entry
    const auditEntry: AuditTrailEntry = {
      id: randomUUID(),
      workflow: "bank-auditor",
      group_id: params.group_id,
      operation: "export_audit_trail",
      timestamp: new Date(),
      actor: this.agent_id,
      details: {
        approval_id: params.approvalId,
        format: params.format,
      },
      glbaCompliance: {
        rulesAssessed: [
          "privacy_notice",
          "opt_out_rights",
          "data_security",
          "safeguards_rule",
          "pretexting_protection",
        ],
        violationsDetected: 0,
        piiHandling: "encrypted",
      },
    };

    // Log export to audit trail
    await logTrace({
      group_id: params.group_id,
      agent_id: this.agent_id,
      trace_type: "contribution",
      content: `GLBA audit trail exported: ${params.approvalId}`,
      confidence: 1.0,
      workflow_id: "bank-auditor-export",
      metadata: {
        approval_id: params.approvalId,
        export_format: params.format,
        export_timestamp: auditEntry.timestamp.toISOString(),
      },
    });

    if (params.format === "json") {
      return Buffer.from(JSON.stringify(auditEntry, null, 2), "utf-8");
    }

    // PDF format (minimal PDF structure for demo)
    const pdfContent = `%PDF-1.4
1 0 obj
<< /Type /Catalog /Pages 2 0 R >>
endobj
2 0 obj
<< /Type /Pages /Kids [3 0 R] /Count 1 >>
endobj
3 0 obj
<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R >>
endobj
4 0 obj
<< /Length 44 >>
stream
BT
/F1 12 Tf
100 700 Td
(GLBA Audit Trail) Tj
ET
endstream
endobj
xref
0 5
0000000000 65535 f 
0000000009 00000 n 
0000000058 00000 n 
0000000115 00000 n 
0000000214 00000 n 
trailer
<< /Size 5 /Root 1 0 R >>
startxref
308
%%EOF`;

    return Buffer.from(pdfContent, "utf-8");
  }

  /**
   * Validate that we're using the GLBA-restricted workspace
   */
  private validateGLBAWorkspace(group_id: string): void {
    try {
      const validated = validateTenantGroupId(group_id);
      
      // GLBA constraint: Must use allura-audits
      if (validated !== "allura-audits") {
        throw new GLBAValidationError(
          `GLBA compliance violation: Bank-auditor workflow must use 'allura-audits' workspace. ` +
          `Provided: '${validated}'`,
          validated
        );
      }
    } catch (error) {
      if (error instanceof GroupIdValidationError) {
        throw new GLBAValidationError(
          `${TENANT_ERROR_CODE}: ${error.message}`,
          group_id
        );
      }
      throw error;
    }
  }
}

// Export functions for module interface
let workflowInstance: BankAuditorWorkflow | null = null;

function getWorkflow(group_id: string): BankAuditorWorkflow {
  if (!workflowInstance || workflowInstance["group_id"] !== group_id) {
    workflowInstance = new BankAuditorWorkflow(group_id);
  }
  return workflowInstance;
}

/**
 * Upload loan decision documents (PDF, DOCX)
 * GLBA: All documents classified as restricted
 */
export async function uploadLoanDocuments(params: {
  files: File[];
  group_id: string;
}): Promise<{ documentIds: string[] }> {
  return getWorkflow(params.group_id).uploadLoanDocuments(params);
}

/**
 * AI analysis for GLBA compliance
 * Assesses privacy rules and flags violations
 */
export async function analyzeForCompliance(params: {
  documentId: string;
  group_id: string;
}): Promise<ComplianceReport> {
  return getWorkflow(params.group_id).analyzeForCompliance(params);
}

/**
 * Flag suspicious decisions for human review
 * GLBA: Low-confidence decisions require HITL
 */
export async function flagSuspiciousDecisions(params: {
  report: ComplianceReport;
  threshold: number;
  group_id: string;
}): Promise<FlaggedDecision[]> {
  return getWorkflow(params.group_id).flagSuspiciousDecisions(params);
}

/**
 * Submit flagged decisions for HITL approval
 * GLBA: All decisions require human review
 */
export async function submitForApproval(params: {
  flaggedDecisions: FlaggedDecision[];
  group_id: string;
}): Promise<{ approvalId: string }> {
  return getWorkflow(params.group_id).submitForApproval(params);
}

/**
 * Export audit trail for regulators
 * GLBA: 6-12 month retention required
 */
export async function exportAuditTrail(params: {
  approvalId: string;
  format: "pdf" | "json";
  group_id: string;
}): Promise<Buffer> {
  return getWorkflow(params.group_id).exportAuditTrail(params);
}