/**
 * Bank Auditor Workflow
 * Story 6-1: Bank-Auditor Workflow
 * Epic 6: Production Workflows
 * 
 * Main workflow orchestration for banking audit process
 * ARCH-001: Enforces group_id validation on all operations
 */

import { validateGroupId, GroupIdValidationError } from '@/lib/validation/group-id';
import { getDocumentProcessor } from '@/lib/banking/document-processor';
import { getComplianceChecker } from '@/lib/banking/compliance-checker';
import { getRiskScorer } from '@/lib/banking/risk-scorer';
import type {
  LoanDocument,
  AnalysisResult,
  ExportFormat,
  SuspiciousDecision,
  ComplianceIssue,
  FlaggedItem,
  Severity,
} from '@/lib/banking/types';

/**
 * Bank Auditor Workflow - Orchestrates loan document analysis pipeline
 */
export class BankAuditorWorkflow {
  private groupId: string;

  constructor(groupId: string) {
    // ARCH-001: Validate group_id at construction time
    this.groupId = validateGroupId(groupId);
  }

  /**
   * Upload and process a loan document
   * 
   * @param content - Document content buffer
   * @param format - Document format (pdf/jpeg/png)
   * @param uploadedBy - User who uploaded the document
   * @param metadata - Optional pre-extracted metadata
   * @returns Upload result with document ID
   */
  async uploadDocument(
    content: Buffer,
    format: 'pdf' | 'jpeg' | 'png',
    uploadedBy: string,
    metadata?: Record<string, unknown>
  ): Promise<{ success: boolean; documentId?: string; error?: string }> {
    try {
      const processor = getDocumentProcessor();
      
      // Generate content hash
      const contentHash = await processor.generateHash(content);
      
      // Extract text and metadata
      const doc: LoanDocument = {
        id: crypto.randomUUID(),
        groupId: this.groupId,
        uploadedBy,
        uploadedAt: new Date(),
        content,
        format,
        metadata: metadata ?? {},
      };

      const extractedText = await processor.extractText(doc);
      const extractedMetadata = await processor.parseMetadata(extractedText);
      
      // Merge extracted metadata with provided metadata
      doc.metadata = { ...extractedMetadata, ...metadata };

      // TODO: Insert into database
      // Production: await insertAuditDocument(doc);
      
      console.log('[BankAuditorWorkflow] Document uploaded:', {
        documentId: doc.id,
        groupId: this.groupId,
        uploadedBy,
        format,
      });

      return { success: true, documentId: doc.id };
    } catch (error) {
      if (error instanceof GroupIdValidationError) {
        return { success: false, error: `Invalid group_id: ${error.message}` };
      }
      console.error('[BankAuditorWorkflow] Upload failed:', error);
      return { success: false, error: 'Failed to upload document' };
    }
  }

  /**
   * Analyze a loan document for compliance issues
   * 
   * @param documentId - ID of the document to analyze
   * @returns Analysis result with issues and risk score
   */
  async analyzeDocument(documentId: string): Promise<AnalysisResult> {
    // ARCH-001: Use validated group_id from constructor
    const groupId = this.groupId;
    
    // TODO: Fetch document from database
    // Production: const doc = await fetchAuditDocument(documentId, groupId);
    
    // For now, create placeholder document
    const doc: LoanDocument = {
      id: documentId,
      groupId,
      uploadedBy: 'system',
      uploadedAt: new Date(),
      content: Buffer.from('placeholder'),
      format: 'pdf',
      metadata: {},
    };

    // Extract text and check compliance
    const processor = getDocumentProcessor();
    const checker = getComplianceChecker();
    const scorer = getRiskScorer();

    const text = await processor.extractText(doc);
    const complianceResult = await checker.checkRegulatoryCompliance(doc);
    
    // Create analysis result
    const analysis: AnalysisResult = {
      id: crypto.randomUUID(),
      documentId,
      groupId,
      complianceIssues: complianceResult.issues,
      riskScore: 0,
      riskFactors: [],
      flaggedItems: [],
      analyzedAt: new Date(),
    };

    // Calculate risk score and factors
    analysis.riskScore = await scorer.calculateRiskScore(analysis);
    analysis.riskFactors = await scorer.getRiskFactors(analysis);
    
    // Flag items based on severity
    analysis.flaggedItems = this.flagComplianceIssues(analysis.complianceIssues);

    // TODO: Insert analysis into database
    // Production: await insertAuditAnalysis(analysis);

    console.log('[BankAuditorWorkflow] Document analyzed:', {
      documentId,
      groupId,
      issuesCount: analysis.complianceIssues.length,
      riskScore: analysis.riskScore,
    });

    return analysis;
  }

  /**
   * Calculate risk score for an analysis
   * 
   * @param analysis - Analysis result to score
   * @returns Risk score between 0 and 1
   */
  async calculateRiskScore(analysis: AnalysisResult): Promise<number> {
    const scorer = getRiskScorer();
    return scorer.calculateRiskScore(analysis);
  }

  /**
   * Flag decision for HITL review if above threshold
   * 
   * @param result - Analysis result to evaluate
   * @returns Flagged items and suspicious decision if flagged
   */
  async flagForReview(result: AnalysisResult): Promise<{ flagged: boolean; suspiciousDecision?: SuspiciousDecision }> {
    const scorer = getRiskScorer();
    
    // Check if risk score exceeds threshold
    if (scorer.exceedsThreshold(result.riskScore)) {
      const severity = scorer.getSeverityFromScore(result.riskScore);
      
      // Create suspicious decision record
      const suspiciousDecision: SuspiciousDecision = {
        id: crypto.randomUUID(),
        analysisId: result.id,
        groupId: this.groupId,
        reasons: result.complianceIssues.map(i => i.description),
        severity,
        requiresApproval: severity === 'critical' || severity === 'high',
        createdAt: new Date(),
      };

      // If critical, route to Paperclip approval queue
      if (severity === 'critical') {
        // TODO: Integrate with Paperclip HITL workflow
        // Production: await routeToPaperclipApproval(suspiciousDecision);
        console.log('[BankAuditorWorkflow] Routing critical decision to Paperclip:', {
          suspiciousDecisionId: suspiciousDecision.id,
          analysisId: result.id,
          groupId: this.groupId,
          severity,
        });
      }

      // TODO: Insert suspicious decision into database
      // Production: await insertSuspiciousDecision(suspiciousDecision);

      return { flagged: true, suspiciousDecision };
    }

    return { flagged: false };
  }

  /**
   * Export audit trail in specified format
   * 
   * @param format - Export format (pdf/csv/json)
   * @returns Export data as buffer
   */
  async exportAuditTrail(format: ExportFormat): Promise<Buffer> {
    // ARCH-001: Use validated group_id from constructor
    const groupId = this.groupId;

    // TODO: Fetch data from database
    // Production: const documents = await fetchAuditDocuments(groupId);
    // Production: const analyses = await fetchAuditAnalyses(groupId);
    // Production: const decisions = await fetchSuspiciousDecisions(groupId);

    // For now, return placeholder export
    const exportData = {
      exportedAt: new Date().toISOString(),
      groupId,
      format,
      data: {
        documents: [],
        analyses: [],
        suspiciousDecisions: [],
      },
    };

    console.log('[BankAuditorWorkflow] Exporting audit trail:', {
      groupId,
      format,
    });

    switch (format) {
      case 'json':
        return Buffer.from(JSON.stringify(exportData, null, 2));
      
      case 'csv':
        // Production: Use csv-writer or similar
        return Buffer.from('placeholder,csv,data\n');
      
      case 'pdf':
        // Production: Use pdf-lib or similar
        return Buffer.from('placeholder pdf content');
      
      default:
        throw new Error(`Unsupported export format: ${format}`);
    }
  }

  // Private helper methods

  /**
   * Flag compliance issues for review
   */
  private flagComplianceIssues(issues: ComplianceIssue[]): FlaggedItem[] {
    return issues
      .filter(issue => issue.severity === 'critical' || issue.severity === 'high')
      .map(issue => ({
        id: `flagged-${issue.id}`,
        type: issue.type,
        reason: issue.description,
        severity: issue.severity,
        requiresApproval: issue.severity === 'critical',
      }));
  }
}

/**
 * Create a Bank Auditor Workflow instance
 * Factory function for dependency injection
 */
export function createBankAuditorWorkflow(groupId: string): BankAuditorWorkflow {
  return new BankAuditorWorkflow(groupId);
}