/**
 * Banking Types
 * Story 6-1: Bank-Auditor Workflow
 * Epic 6: Production Workflows
 * 
 * Type definitions for loan document audit workflow
 */

/**
 * Document upload status
 */
export type DocumentStatus = 'uploading' | 'processing' | 'analyzed' | 'flagged' | 'error';

/**
 * Severity levels for compliance issues
 */
export type Severity = 'low' | 'medium' | 'high' | 'critical';

/**
 * Supported document upload formats
 */
export type DocumentFormat = 'pdf' | 'jpeg' | 'png';

/**
 * Export formats for audit trail
 */
export type ExportFormat = 'pdf' | 'csv' | 'json';

/**
 * Loan Document (raw upload)
 */
export interface LoanDocument {
  id: string;
  groupId: string;
  uploadedBy: string;
  uploadedAt: Date;
  content: Buffer;
  format: DocumentFormat;
  metadata: DocumentMetadata;
}

/**
 * Document Metadata (extracted from document)
 */
export interface DocumentMetadata {
  documentType?: string;
  loanAmount?: number;
  borrowerName?: string;
  decisionDate?: Date;
  approvalStatus?: 'approved' | 'denied' | 'pending';
  loanOfficer?: string;
  branchId?: string;
  [key: string]: unknown;
}

/**
 * Compliance Issue (detected during analysis)
 */
export interface ComplianceIssue {
  id: string;
  type: string;
  description: string;
  severity: Severity;
  regulation?: string;
  location?: {
    page?: number;
    section?: string;
  };
  evidence?: string;
}

/**
 * Risk Factor (contributes to risk score)
 */
export interface RiskFactor {
  id: string;
  name: string;
  weight: number;
  value: number;
  description: string;
}

/**
 * Analysis Result (output of document analysis)
 */
export interface AnalysisResult {
  id: string;
  documentId: string;
  groupId: string;
  complianceIssues: ComplianceIssue[];
  riskScore: number;
  riskFactors: RiskFactor[];
  flaggedItems: FlaggedItem[];
  analyzedAt: Date;
}

/**
 * Flagged Item (suspicious content)
 */
export interface FlaggedItem {
  id: string;
  type: string;
  reason: string;
  severity: Severity;
  requiresApproval: boolean;
}

/**
 * Suspicious Decision (requires HITL review)
 */
export interface SuspiciousDecision {
  id: string;
  analysisId: string;
  groupId: string;
  reasons: string[];
  severity: Severity;
  requiresApproval: boolean;
  reviewedAt?: Date;
  reviewedBy?: string;
  createdAt: Date;
}

/**
 * Pattern (detected during compliance check)
 */
export interface Pattern {
  id: string;
  type: string;
  description: string;
  frequency: number;
  confidence: number;
  examples?: string[];
}

/**
 * Audit Trail Export Data
 */
export interface AuditTrailExport {
  documents: AuditDocumentSummary[];
  analyses: AnalysisSummary[];
  suspiciousDecisions: SuspiciousDecisionSummary[];
  exportedAt: Date;
  group_id: string;
}

/**
 * Audit Document Summary (for export)
 */
export interface AuditDocumentSummary {
  id: string;
  uploadedBy: string;
  uploadedAt: Date;
  documentType?: string;
  loanAmount?: number;
  approvalStatus?: string;
}

/**
 * Analysis Summary (for export)
 */
export interface AnalysisSummary {
  id: string;
  documentId: string;
  riskScore: number;
  complianceIssuesCount: number;
  flagged: boolean;
  analyzedAt: Date;
}

/**
 * Suspicious Decision Summary (for export)
 */
export interface SuspiciousDecisionSummary {
  id: string;
  analysisId: string;
  severity: Severity;
  reasons: string[];
  reviewed: boolean;
  reviewedBy?: string;
  createdAt: Date;
}

/**
 * Upload Result
 */
export interface UploadResult {
  success: boolean;
  documentId?: string;
  error?: string;
}

/**
 * Analysis Options
 */
export interface AnalysisOptions {
  skipPatterns?: boolean;
  skipComparison?: boolean;
  customThreshold?: number;
}