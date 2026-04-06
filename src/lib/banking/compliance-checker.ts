/**
 * Compliance Checker
 * Story 6-1: Bank-Auditor Workflow
 * Epic 6: Production Workflows
 * 
 * Checks loan documents for regulatory compliance violations
 */

import type { LoanDocument, ComplianceIssue, Pattern, Severity } from './types';

/**
 * Regulatory compliance check result
 */
export interface ComplianceResult {
  issues: ComplianceIssue[];
  patterns: Pattern[];
  overallSeverity: Severity;
}

/**
 * Known regulatory frameworks
 */
export const REGULATORY_FRAMEWORKS = {
  CFPB: 'Consumer Financial Protection Bureau',
  OCC: 'Office of the Comptroller of the Currency',
  FDIC: 'Federal Deposit Insurance Corporation',
  FAIR_LENDING: 'Fair Lending Act',
  ECOA: 'Equal Credit Opportunity Act',
} as const;

/**
 * Compliance Checker - Detects regulatory violations and patterns
 */
export class ComplianceChecker {
  /**
   * Check document for regulatory compliance issues
   * 
   * @param doc - Loan document to check
   * @returns Compliance result with issues and patterns
   */
  async checkRegulatoryCompliance(doc: LoanDocument): Promise<ComplianceResult> {
    const issues: ComplianceIssue[] = [];
    const patterns: Pattern[] = [];

    // Extract text from document
    const processor = await import('./document-processor').then(m => m.getDocumentProcessor());
    const text = await processor.extractText(doc);
    
    // Check for various compliance issues
    issues.push(
      ...await this.checkFairLendingCompliance(text, doc),
      ...await this.checkDisclosureCompliance(text, doc),
      ...await this.checkDataIntegrityCompliance(text, doc),
    );

    // Detect patterns
    patterns.push(
      ...await this.detectPatterns({ documentId: doc.id, complianceIssues: issues, riskScore: 0, riskFactors: [], flaggedItems: [], analyzedAt: new Date() })
    );

    // Calculate overall severity
    const overallSeverity = this.calculateOverallSeverity(issues);

    return {
      issues,
      patterns,
      overallSeverity,
    };
  }

  /**
   * Detect suspicious patterns in document analyses
   * 
   * @param analysis - Analysis result to examine
   * @returns Detected patterns
   */
  async detectPatterns(analysis: { documentId: string; complianceIssues: ComplianceIssue[]; riskScore: number; riskFactors: unknown[]; flaggedItems: unknown[]; analyzedAt: Date }): Promise<Pattern[]> {
    const patterns: Pattern[] = [];

    // Group issues by type
    const issuesByType = analysis.complianceIssues.reduce((acc, issue) => {
      acc[issue.type] = (acc[issue.type] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    // Check for repeated violations
    for (const [type, count] of Object.entries(issuesByType)) {
      if (count >= 3) {
        patterns.push({
          id: `pattern-${type}-${Date.now()}`,
          type: 'repeated_violation',
          description: `Repeated ${type} violations detected (${count} occurrences)`,
          frequency: count,
          confidence: 0.85,
          examples: analysis.complianceIssues
            .filter(i => i.type === type)
            .slice(0, 3)
            .map(i => i.description),
        });
      }
    }

    // Check for severity escalation
    const criticalIssues = analysis.complianceIssues.filter(i => i.severity === 'critical');
    if (criticalIssues.length >= 2) {
      patterns.push({
        id: `pattern-severity-${Date.now()}`,
        type: 'severity_escalation',
        description: 'Multiple critical issues detected',
        frequency: criticalIssues.length,
        confidence: 0.95,
      });
    }

    return patterns;
  }

  // Private compliance check methods

  /**
   * Check for Fair Lending Act compliance
   */
  private async checkFairLendingCompliance(text: string, doc: LoanDocument): Promise<ComplianceIssue[]> {
    const issues: ComplianceIssue[] = [];

    // Check for prohibited discriminatory language
    const discriminatoryPatterns = [
      { pattern: /(?:race|color|religion|national origin):?\s*[a-z]+/gi, type: 'fair_lending' },
      { pattern: /(?:sex|gender):?\s*[a-z]+/gi, type: 'fair_lending' },
      { pattern: /(?:marital status|age):?\s*\d+/gi, type: 'fair_lending' },
    ];

    for (const { pattern, type } of discriminatoryPatterns) {
      const matches = text.match(pattern);
      if (matches && matches.length > 0) {
        issues.push({
          id: `issue-${type}-${doc.id}`,
          type,
          description: `Potential discriminatory information detected: "${matches[0]}"`,
          severity: 'critical',
          regulation: REGULATORY_FRAMEWORKS.FAIR_LENDING,
          evidence: matches.join(', '),
        });
      }
    }

    // Check for redlining indicators
    if (text.toLowerCase().includes('redline') || text.toLowerCase().includes('undesirable area')) {
      issues.push({
        id: `issue-redlining-${doc.id}`,
        type: 'fair_lending',
        description: 'Potential redlining language detected',
        severity: 'critical',
        regulation: REGULATORY_FRAMEWORKS.ECOA,
      });
    }

    return issues;
  }

  /**
   * Check for disclosure compliance
   */
  private async checkDisclosureCompliance(text: string, doc: LoanDocument): Promise<ComplianceIssue[]> {
    const issues: ComplianceIssue[] = [];

    // Check for required disclosures
    const requiredDisclosures = [
      { name: 'APR', pattern: /(?:apr|annual percentage rate):?\s*[\d.]+%/i },
      { name: 'Loan Terms', pattern: /(?:loan terms|terms):?\s*.+/i },
      { name: 'Interest Rate', pattern: /(?:interest rate|rate):?\s*[\d.]+%/i },
      { name: 'Total Cost', pattern: /(?:total cost|total amount):?\s*\$[\d,]+/i },
    ];

    for (const disclosure of requiredDisclosures) {
      if (!disclosure.pattern.test(text)) {
        issues.push({
          id: `issue-disclosure-${disclosure.name}-${doc.id}`,
          type: 'disclosure_missing',
          description: `Missing required disclosure: ${disclosure.name}`,
          severity: 'medium',
          regulation: REGULATORY_FRAMEWORKS.CFPB,
        });
      }
    }

    return issues;
  }

  /**
   * Check for data integrity issues
   */
  private async checkDataIntegrityCompliance(text: string, doc: LoanDocument): Promise<ComplianceIssue[]> {
    const issues: ComplianceIssue[] = [];

    // Check for incomplete borrower information
    const requiredFields = ['borrower', 'loan amount', 'date'];
    for (const field of requiredFields) {
      if (!text.toLowerCase().includes(field)) {
        issues.push({
          id: `issue-integrity-${field}-${doc.id}`,
          type: 'data_integrity',
          description: `Missing required field: ${field}`,
          severity: 'medium',
        });
      }
    }

    // Check for inconsistent dates
    const dates = text.match(/\d{1,2}\/\d{1,2}\/\d{4}/g) || [];
    const now = new Date();
    for (const dateStr of dates) {
      const [month, day, year] = dateStr.split('/').map(Number);
      const date = new Date(year, month - 1, day);
      
      // Check for future dates
      if (date > now) {
        issues.push({
          id: `issue-date-future-${doc.id}`,
          type: 'data_integrity',
          description: `Future date detected: ${dateStr}`,
          severity: 'high',
        });
      }
    }

    return issues;
  }

  /**
   * Calculate overall severity from issues
   */
  private calculateOverallSeverity(issues: ComplianceIssue[]): Severity {
    if (issues.length === 0) return 'low';
    
    const hasCritical = issues.some(i => i.severity === 'critical');
    const hasHigh = issues.some(i => i.severity === 'high');
    const hasMedium = issues.some(i => i.severity === 'medium');
    
    if (hasCritical) return 'critical';
    if (hasHigh) return 'high';
    if (hasMedium) return 'medium';
    return 'low';
  }
}

// Create singleton instance
let checkerInstance: ComplianceChecker | null = null;

/**
 * Get the ComplianceChecker singleton instance
 */
export function getComplianceChecker(): ComplianceChecker {
  if (!checkerInstance) {
    checkerInstance = new ComplianceChecker();
  }
  return checkerInstance;
}