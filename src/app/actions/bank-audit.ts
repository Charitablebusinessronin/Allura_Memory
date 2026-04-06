/**
 * Bank Audit Server Actions
 * Story 6-1: Bank-Auditor Workflow
 * Epic 6: Production Workflows
 * 
 * Server actions for loan document upload, analysis, and audit trail export
 * ARCH-001: All functions validate group_id before ANY database operation
 */

'use server';

import { validateGroupId, GroupIdValidationError } from '@/lib/validation/group-id';
import { getPool } from '@/lib/postgres/connection';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { randomUUID } from 'crypto';
import { PromotionProposalManager } from '@/lib/promotions/proposal';
import type { 
  DocumentStatus,
  Severity,
  DocumentFormat,
  ExportFormat,
  LoanDocument,
  AnalysisResult,
  ComplianceIssue,
  RiskFactor,
  FlaggedItem,
  AuditDocumentSummary,
  AnalysisSummary,
  SuspiciousDecisionSummary,
  AuditTrailExport,
} from '@/lib/banking/types';

// ============================================================================
// Validation Schemas
// ============================================================================

const UploadDocumentSchema = z.object({
  groupId: z.string().min(1),
  file: z.instanceof(File),
  documentType: z.enum(['loan_application', 'approval_document', 'compliance_report']),
  metadata: z.record(z.string(), z.unknown()).optional()
});

const AnalyzeDocumentSchema = z.object({
  documentId: z.string().uuid(),
  groupId: z.string().min(1)
});

const ExportAuditTrailSchema = z.object({
  format: z.enum(['pdf', 'csv', 'json']),
  groupId: z.string().min(1),
  dateRange: z.object({
    start: z.date(),
    end: z.date()
  }).optional()
});

// ============================================================================
// Upload Document
// ============================================================================

/**
 * Upload a loan decision document for audit analysis
 * ARCH-001: Validates group_id before any database operation
 * 
 * @param formData - Form data containing file and metadata
 * @param groupId - Tenant group ID
 * @returns Upload result with document ID or error
 */
export async function uploadDocument(
  formData: FormData,
  groupId: string
): Promise<{ success: boolean; documentId?: string; error?: string }> {
  // ARCH-001: Validate group_id IMMEDIATELY
  let validatedGroupId: string;
  try {
    validatedGroupId = validateGroupId(groupId);
  } catch (error) {
    if (error instanceof GroupIdValidationError) {
      return { success: false, error: error.message };
    }
    throw error;
  }

  try {
    // Extract and validate form data
    const file = formData.get('file') as File | null;
    const documentType = formData.get('documentType') as string | null;
    const uploadedBy = formData.get('uploadedBy') as string | null;

    if (!file || !documentType || !uploadedBy) {
      return { success: false, error: 'Missing required fields: file, documentType, or uploadedBy' };
    }

    // Validate file format
    const validFormats: DocumentFormat[] = ['pdf', 'jpeg', 'png'];
    const fileExtension = file.name.split('.').pop()?.toLowerCase() as DocumentFormat;
    if (!validFormats.includes(fileExtension)) {
      return { 
        success: false, 
        error: `Invalid file format. Supported formats: ${validFormats.join(', ')}` 
      };
    }

    // Convert file to buffer
    const arrayBuffer = await file.arrayBuffer();
    const content = Buffer.from(arrayBuffer);
    
    // Generate content hash for deduplication
    const crypto = await import('crypto');
    const contentHash = crypto.createHash('sha256').update(content).digest('hex');

    // Extract metadata from form
    const metadata: Record<string, unknown> = {
      documentType,
      originalFilename: file.name,
      mimeType: file.type,
      size: file.size,
      uploadedAt: new Date().toISOString()
    };

    // Extract additional metadata from form
    const loanAmount = formData.get('loanAmount');
    const borrowerName = formData.get('borrowerName');
    const branchId = formData.get('branchId');

    if (loanAmount) metadata.loanAmount = parseFloat(loanAmount as string);
    if (borrowerName) metadata.borrowerName = borrowerName;
    if (branchId) metadata.branchId = branchId;

    // ARCH-001: Use validatedGroupId for database operations
    const pool = getPool();
    const result = await pool.query(
      `INSERT INTO audit_documents (
        group_id, uploaded_by, content_hash, uploaded_at, metadata
      ) VALUES ($1, $2, $3, NOW(), $4)
      RETURNING id`,
      [
        validatedGroupId,
        uploadedBy,
        contentHash,
        JSON.stringify(metadata)
      ]
    );

    const documentId = result.rows[0].id;

    // Revalidate cache for dashboard
    revalidatePath('/dashboard/paperclip/bank-audit');

    return { success: true, documentId };
  } catch (error) {
    console.error('Upload failed:', error);
    
    if (error instanceof Error) {
      return { success: false, error: `Upload failed: ${error.message}` };
    }
    
    return { success: false, error: 'Upload failed: Unknown error' };
  }
}

// ============================================================================
// Analyze Document
// ============================================================================

/**
 * Analyze an uploaded document for compliance
 * ARCH-001: Validates group_id before any database operation
 * 
 * @param documentId - UUID of the document to analyze
 * @param groupId - Tenant group ID
 * @returns Analysis result with compliance issues and risk score
 */
export async function analyzeDocument(
  documentId: string,
  groupId: string
): Promise<{ 
  success: boolean; 
  analysis?: AnalysisResult; 
  error?: string 
}> {
  // ARCH-001: Validate group_id IMMEDIATELY
  let validatedGroupId: string;
  try {
    validatedGroupId = validateGroupId(groupId);
  } catch (error) {
    if (error instanceof GroupIdValidationError) {
      return { success: false, error: error.message };
    }
    throw error;
  }

  try {
    // ARCH-001: Use validatedGroupId for database operations
    const pool = getPool();

    // Verify document exists and belongs to group
    const docResult = await pool.query(
      `SELECT id, group_id, metadata FROM audit_documents WHERE id = $1 AND group_id = $2`,
      [documentId, validatedGroupId]
    );

    if (docResult.rows.length === 0) {
      return { success: false, error: 'Document not found or access denied' };
    }

    // Run compliance analysis
    // NOTE: Actual compliance checking logic would be implemented in separate modules
    // This is a placeholder that returns a structured analysis result
    const analysisId = randomUUID();
    const complianceIssues: ComplianceIssue[] = [];
    const riskFactors: RiskFactor[] = [];
    const flaggedItems: FlaggedItem[] = [];

    // Calculate initial risk score (placeholder logic - real implementation would
    // integrate with compliance-checker and risk-scorer modules)
    const riskScore = 0.25; // Placeholder - low risk by default

    // Determine if document should be flagged
    const shouldFlag = riskScore > 0.75;

    // Store analysis result
    await pool.query(
      `INSERT INTO audit_analyses (
        id, document_id, group_id, compliance_issues, risk_score, flagged, created_at
      ) VALUES ($1, $2, $3, $4, $5, $6, NOW())`,
      [
        analysisId,
        documentId,
        validatedGroupId,
        JSON.stringify(complianceIssues),
        riskScore,
        shouldFlag
      ]
    );

    // If flagged, create suspicious decision record
    if (shouldFlag) {
      const severity: Severity = riskScore > 0.9 ? 'critical' : 
                                   riskScore > 0.8 ? 'high' : 
                                   riskScore > 0.7 ? 'medium' : 'low';

      const reasons = ['Risk score exceeds threshold', 'Requires manual review'];

    await pool.query(
      `INSERT INTO suspicious_decisions (
        id, analysis_id, group_id, reasons, severity, requires_approval, created_at
      ) VALUES ($1, $2, $3, $4, $5, TRUE, NOW())`,
      [
        randomUUID(),
        analysisId,
        validatedGroupId,
        JSON.stringify(reasons),
        severity
      ]
    );

      // HITL Integration: Critical severity requires approval workflow
      // NOTE: EntityType needs to be extended to include 'critical-audit-finding'
      // For now, using 'insight' as the closest entity type
      if (severity === 'critical') {
        const proposalManager = new PromotionProposalManager();
        
        await proposalManager.createProposal({
          group_id: validatedGroupId,
          entity_type: 'insight', // Would be 'critical-audit-finding' with extended EntityType
          entity_id: analysisId,
          confidence_score: riskScore,
          evidence_refs: [
            `analysis:${analysisId}`,
            `document:${documentId}`,
            `timestamp:${new Date().toISOString()}`
          ],
          metadata: {
            severity,
            reasons,
            documentId,
            analysisId,
            requires_approval: true,
            entity_subtype: 'critical-audit-finding'
          },
          proposed_by: 'bank-auditor-workflow'
        });

        // Submit for review
        await proposalManager.submitForReview(analysisId, validatedGroupId);
      }
    }

    const analysis: AnalysisResult = {
      id: analysisId,
      documentId,
      groupId: validatedGroupId,
      complianceIssues,
      riskScore,
      riskFactors,
      flaggedItems,
      analyzedAt: new Date()
    };

    revalidatePath('/dashboard/paperclip/bank-audit');

    return { success: true, analysis };
  } catch (error) {
    console.error('Analysis failed:', error);
    
    if (error instanceof Error) {
      return { success: false, error: `Analysis failed: ${error.message}` };
    }
    
    return { success: false, error: 'Analysis failed: Unknown error' };
  }
}

// ============================================================================
// Export Audit Trail
// ============================================================================

/**
 * Export audit trail in specified format
 * ARCH-001: Validates group_id before any database operation
 * 
 * @param format - Export format (pdf, csv, json)
 * @param groupId - Tenant group ID
 * @param dateRange - Optional date range filter
 * @returns Exported data as buffer with filename
 */
export async function exportAuditTrail(
  format: ExportFormat,
  groupId: string,
  dateRange?: { start: Date; end: Date }
): Promise<{ 
  success: boolean; 
  data?: ArrayBuffer; 
  filename?: string; 
  error?: string 
}> {
  // ARCH-001: Validate group_id IMMEDIATELY
  let validatedGroupId: string;
  try {
    validatedGroupId = validateGroupId(groupId);
  } catch (error) {
    if (error instanceof GroupIdValidationError) {
      return { success: false, error: error.message };
    }
    throw error;
  }

  try {
    // ARCH-001: Use validatedGroupId for database operations
    const pool = getPool();

    // Build date filter
    const dateFilter = dateRange
      ? `AND ad.uploaded_at >= $2 AND ad.uploaded_at <= $3`
      : '';

    const queryParams: (string | Date)[] = [validatedGroupId];
    if (dateRange) {
      queryParams.push(dateRange.start, dateRange.end);
    }

    // Fetch all audit data
    const documentsResult = await pool.query(
      `SELECT 
        ad.id,
        ad.uploaded_by,
        ad.uploaded_at,
        ad.metadata
      FROM audit_documents ad
      WHERE ad.group_id = $1
      ${dateFilter}
      ORDER BY ad.uploaded_at DESC`,
      queryParams
    );

    const analysesResult = await pool.query(
      `SELECT 
        aa.id,
        aa.document_id,
        aa.risk_score,
        aa.compliance_issues,
        aa.flagged,
        aa.created_at
      FROM audit_analyses aa
      JOIN audit_documents ad ON ad.id = aa.document_id
      WHERE aa.group_id = $1
      ${dateFilter}
      ORDER BY aa.created_at DESC`,
      queryParams
    );

    const suspiciousResult = await pool.query(
      `SELECT 
        sd.id,
        sd.analysis_id,
        sd.severity,
        sd.reasons,
        sd.reviewed_at,
        sd.reviewed_by,
        sd.created_at
      FROM suspicious_decisions sd
      JOIN audit_analyses aa ON aa.id = sd.analysis_id
      JOIN audit_documents ad ON ad.id = aa.document_id
      WHERE sd.group_id = $1
      ${dateFilter}
      ORDER BY sd.created_at DESC`,
      queryParams
    );

    // Map to summary types
    const documents: AuditDocumentSummary[] = documentsResult.rows.map(row => {
      const metadata = row.metadata as Record<string, unknown>;
      return {
        id: row.id,
        uploadedBy: row.uploaded_by,
        uploadedAt: row.uploaded_at,
        documentType: metadata?.documentType as string | undefined,
        loanAmount: metadata?.loanAmount as number | undefined,
        approvalStatus: metadata?.approvalStatus as string | undefined
      };
    });

    const analyses: AnalysisSummary[] = analysesResult.rows.map(row => ({
      id: row.id,
      documentId: row.document_id,
      riskScore: parseFloat(row.risk_score),
      complianceIssuesCount: (row.compliance_issues as unknown[])?.length || 0,
      flagged: row.flagged,
      analyzedAt: row.created_at
    }));

    const suspiciousDecisions: SuspiciousDecisionSummary[] = suspiciousResult.rows.map(row => ({
      id: row.id,
      analysisId: row.analysis_id,
      severity: row.severity as Severity,
      reasons: row.reasons as string[],
      reviewed: row.reviewed_at !== null,
      reviewedBy: row.reviewed_by,
      createdAt: row.created_at
    }));

    // Create export data
    const exportData: AuditTrailExport = {
      documents,
      analyses,
      suspiciousDecisions,
      exportedAt: new Date(),
      group_id: validatedGroupId
    };

    // Format based on requested format
    let buffer: ArrayBuffer;
    let filename: string;

    switch (format) {
      case 'json': {
        const jsonString = JSON.stringify(exportData, null, 2);
        buffer = Buffer.from(jsonString).buffer as ArrayBuffer;
        filename = `audit-trail-${validatedGroupId}-${new Date().toISOString().split('T')[0]}.json`;
        break;
      }

      case 'csv': {
        // Create CSV representation
        const lines: string[] = [];
        
        // Documents section
        lines.push('DOCUMENTS');
        lines.push('ID,Uploaded By,Uploaded At,Document Type,Loan Amount,Approval Status');
        for (const doc of documents) {
          lines.push([
            doc.id,
            doc.uploadedBy,
            doc.uploadedAt.toISOString(),
            doc.documentType || '',
            doc.loanAmount || '',
            doc.approvalStatus || ''
          ].join(','));
        }
        
        lines.push('');
        lines.push('ANALYSES');
        lines.push('ID,Document ID,Risk Score,Compliance Issues,Flagged,Analyzed At');
        for (const analysis of analyses) {
          lines.push([
            analysis.id,
            analysis.documentId,
            analysis.riskScore,
            analysis.complianceIssuesCount,
            analysis.flagged,
            analysis.analyzedAt.toISOString()
          ].join(','));
        }
        
        lines.push('');
        lines.push('SUSPICIOUS DECISIONS');
        lines.push('ID,Analysis ID,Severity,Reasons,Reviewed,Reviewed By,Created At');
        for (const decision of suspiciousDecisions) {
          lines.push([
            decision.id,
            decision.analysisId,
            decision.severity,
            `"${decision.reasons.join('; ')}"`,
            decision.reviewed,
            decision.reviewedBy || '',
            decision.createdAt.toISOString()
          ].join(','));
        }

        buffer = Buffer.from(lines.join('\n')).buffer as ArrayBuffer;
        filename = `audit-trail-${validatedGroupId}-${new Date().toISOString().split('T')[0]}.csv`;
        break;
      }

      case 'pdf': {
        // In production, this would use a PDF generation library
        // For now, create a structured text representation
        const lines: string[] = [];
        lines.push('AUDIT TRAIL REPORT');
        lines.push(`Group ID: ${validatedGroupId}`);
        lines.push(`Export Date: ${new Date().toISOString()}`);
        lines.push('');
        lines.push('='.repeat(80));
        lines.push('DOCUMENTS');
        lines.push('='.repeat(80));
        for (const doc of documents) {
          lines.push(`ID: ${doc.id}`);
          lines.push(`  Uploaded By: ${doc.uploadedBy}`);
          lines.push(`  Uploaded At: ${doc.uploadedAt.toISOString()}`);
          lines.push(`  Type: ${doc.documentType || 'N/A'}`);
          lines.push(`  Amount: ${doc.loanAmount || 'N/A'}`);
          lines.push(`  Status: ${doc.approvalStatus || 'N/A'}`);
          lines.push('');
        }
        
        lines.push('='.repeat(80));
        lines.push('ANALYSES');
        lines.push('='.repeat(80));
        for (const analysis of analyses) {
          lines.push(`ID: ${analysis.id}`);
          lines.push(`  Document ID: ${analysis.documentId}`);
          lines.push(`  Risk Score: ${analysis.riskScore}`);
          lines.push(`  Issues: ${analysis.complianceIssuesCount}`);
          lines.push(`  Flagged: ${analysis.flagged}`);
          lines.push(`  Analyzed: ${analysis.analyzedAt.toISOString()}`);
          lines.push('');
        }
        
        lines.push('='.repeat(80));
        lines.push('SUSPICIOUS DECISIONS');
        lines.push('='.repeat(80));
        for (const decision of suspiciousDecisions) {
          lines.push(`ID: ${decision.id}`);
          lines.push(`  Analysis ID: ${decision.analysisId}`);
          lines.push(`  Severity: ${decision.severity}`);
          lines.push(`  Reasons: ${decision.reasons.join(', ')}`);
          lines.push(`  Reviewed: ${decision.reviewed ? 'Yes by ' + decision.reviewedBy : 'No'}`);
          lines.push(`  Created: ${decision.createdAt.toISOString()}`);
          lines.push('');
        }
        
        lines.push('='.repeat(80));
        lines.push('END OF REPORT');
        
        buffer = Buffer.from(lines.join('\n')).buffer as ArrayBuffer;
        filename = `audit-trail-${validatedGroupId}-${new Date().toISOString().split('T')[0]}.txt`;
        break;
      }

      default:
        return { 
          success: false, 
          error: `Unsupported export format: ${format}` 
        };
    }

    return { 
      success: true, 
      data: buffer,
      filename
    };
  } catch (error) {
    console.error('Export failed:', error);
    
    if (error instanceof Error) {
      return { success: false, error: `Export failed: ${error.message}` };
    }
    
    return { success: false, error: 'Export failed: Unknown error' };
  }
}

// ============================================================================
// Get Audit Documents
// ============================================================================

/**
 * Get audit documents for display
 * ARCH-001: Validates group_id before any database operation
 * 
 * @param groupId - Tenant group ID
 * @param limit - Maximum number of documents to return
 * @returns List of documents with metadata
 */
export async function getAuditDocuments(
  groupId: string,
  limit = 20
): Promise<{ 
  success: boolean; 
  documents?: Array<{
    id: string;
    uploadedBy: string;
    uploadedAt: Date;
    metadata: Record<string, unknown>;
    status?: DocumentStatus;
  }>; 
  error?: string 
}> {
  // ARCH-001: Validate group_id IMMEDIATELY
  let validatedGroupId: string;
  try {
    validatedGroupId = validateGroupId(groupId);
  } catch (error) {
    if (error instanceof GroupIdValidationError) {
      return { success: false, error: error.message };
    }
    throw error;
  }

  try {
    // ARCH-001: Use validatedGroupId for database operations
    const pool = getPool();

    const result = await pool.query(
      `SELECT 
        ad.id,
        ad.uploaded_by,
        ad.uploaded_at,
        ad.metadata,
        COALESCE(aa.status, 'uploading') as status
      FROM audit_documents ad
      LEFT JOIN LATERAL (
        SELECT 'analyzed' as status
        FROM audit_analyses aa
        WHERE aa.document_id = ad.id AND aa.group_id = $1
        LIMIT 1
      ) aa ON TRUE
      WHERE ad.group_id = $1
      ORDER BY ad.uploaded_at DESC
      LIMIT $2`,
      [validatedGroupId, limit]
    );

    const documents = result.rows.map(row => ({
      id: row.id,
      uploadedBy: row.uploaded_by,
      uploadedAt: row.uploaded_at,
      metadata: row.metadata as Record<string, unknown>,
      status: row.status as DocumentStatus
    }));

    return { success: true, documents };
  } catch (error) {
    console.error('Failed to fetch documents:', error);
    
    if (error instanceof Error) {
      return { success: false, error: `Failed to fetch documents: ${error.message}` };
    }
    
    return { success: false, error: 'Failed to fetch documents: Unknown error' };
  }
}