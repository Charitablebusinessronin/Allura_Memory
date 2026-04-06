/**
 * Risk Scorer
 * Story 6-1: Bank-Auditor Workflow
 * Epic 6: Production Workflows
 * 
 * Calculates risk scores for loan decisions based on compliance analysis
 */

import type { AnalysisResult, RiskFactor, Severity } from './types';

/**
 * Risk scoring configuration
 */
export interface RiskConfig {
  defaultThreshold: number;
  weights: {
    criticalIssues: number;
    highIssues: number;
    mediumIssues: number;
    lowIssues: number;
    missingDisclosures: number;
    dataIntegrity: number;
    patternFrequency: number;
  };
}

/**
 * Default risk scoring configuration
 */
export const DEFAULT_RISK_CONFIG: RiskConfig = {
  defaultThreshold: 0.75,
  weights: {
    criticalIssues: 0.30,
    highIssues: 0.25,
    mediumIssues: 0.15,
    lowIssues: 0.05,
    missingDisclosures: 0.10,
    dataIntegrity: 0.10,
    patternFrequency: 0.05,
  },
};

/**
 * Risk Scorer - Calculates loan decision risk scores
 */
export class RiskScorer {
  private config: RiskConfig;

  constructor(config: RiskConfig = DEFAULT_RISK_CONFIG) {
    this.config = config;
  }

  /**
   * Calculate risk score from analysis result
   * 
   * @param analysis - Analysis result to score
   * @returns Risk score between 0 and 1
   */
  async calculateRiskScore(analysis: AnalysisResult): Promise<number> {
    const { complianceIssues, riskFactors } = analysis;
    
    // Base score from compliance issues
    const baseScore = this.calculateBaseScore(complianceIssues);
    
    // Additional risk from identified risk factors
    const factorScore = this.calculateFactorScore(riskFactors);
    
    // Combined score (weighted average)
    const totalScore = (baseScore * 0.7) + (factorScore * 0.3);
    
    // Ensure score is between 0 and 1
    return Math.max(0, Math.min(1, totalScore));
  }

  /**
   * Get risk factors contributing to the score
   * 
   * @param analysis - Analysis result to examine
   * @returns Array of risk factors with weights
   */
  async getRiskFactors(analysis: AnalysisResult): Promise<RiskFactor[]> {
    const { complianceIssues } = analysis;
    const factors: RiskFactor[] = [];

    // Add factors for each severity level
    const criticalCount = complianceIssues.filter(i => i.severity === 'critical').length;
    if (criticalCount > 0) {
      factors.push({
        id: 'factor-critical',
        name: 'Critical Issues',
        weight: this.config.weights.criticalIssues,
        value: criticalCount,
        description: `${criticalCount} critical compliance violations detected`,
      });
    }

    const highCount = complianceIssues.filter(i => i.severity === 'high').length;
    if (highCount > 0) {
      factors.push({
        id: 'factor-high',
        name: 'High Severity Issues',
        weight: this.config.weights.highIssues,
        value: highCount,
        description: `${highCount} high severity violations detected`,
      });
    }

    const mediumCount = complianceIssues.filter(i => i.severity === 'medium').length;
    if (mediumCount > 0) {
      factors.push({
        id: 'factor-medium',
        name: 'Medium Severity Issues',
        weight: this.config.weights.mediumIssues,
        value: mediumCount,
        description: `${mediumCount} medium severity violations detected`,
      });
    }

    const lowCount = complianceIssues.filter(i => i.severity === 'low').length;
    if (lowCount > 0) {
      factors.push({
        id: 'factor-low',
        name: 'Low Severity Issues',
        weight: this.config.weights.lowIssues,
        value: lowCount,
        description: `${lowCount} low severity violations detected`,
      });
    }

    // Add factors for specific violation types
    const disclosureIssues = complianceIssues.filter(i => i.type === 'disclosure_missing');
    if (disclosureIssues.length > 0) {
      factors.push({
        id: 'factor-disclosures',
        name: 'Missing Disclosures',
        weight: this.config.weights.missingDisclosures,
        value: disclosureIssues.length,
        description: `${disclosureIssues.length} required disclosures missing`,
      });
    }

    const dataIssues = complianceIssues.filter(i => i.type === 'data_integrity');
    if (dataIssues.length > 0) {
      factors.push({
        id: 'factor-integrity',
        name: 'Data Integrity Issues',
        weight: this.config.weights.dataIntegrity,
        value: dataIssues.length,
        description: `${dataIssues.length} data integrity violations detected`,
      });
    }

    return factors;
  }

  /**
   * Check if score exceeds threshold
   * 
   * @param score - Risk score to check
   * @param threshold - Optional custom threshold
   * @returns true if score exceeds threshold
   */
  exceedsThreshold(score: number, threshold?: number): boolean {
    const limit = threshold ?? this.config.defaultThreshold;
    return score >= limit;
  }

  /**
   * Get severity from risk score
   * 
   * @param score - Risk score
   * @returns Severity level
   */
  getSeverityFromScore(score: number): Severity {
    if (score >= 0.85) return 'critical';
    if (score >= 0.70) return 'high';
    if (score >= 0.50) return 'medium';
    return 'low';
  }

  /**
   * Get config
   */
  getConfig(): RiskConfig {
    return { ...this.config };
  }

  // Private helper methods

  /**
   * Calculate base score from compliance issues
   */
  private calculateBaseScore(issues: AnalysisResult['complianceIssues']): number {
    if (issues.length === 0) return 0;

    const weights = this.config.weights;
    
    const criticalCount = issues.filter(i => i.severity === 'critical').length;
    const highCount = issues.filter(i => i.severity === 'high').length;
    const mediumCount = issues.filter(i => i.severity === 'medium').length;
    const lowCount = issues.filter(i => i.severity === 'low').length;
    
    // Weighted sum with severity multipliers
    // Critical issues contribute significantly more than others
    const weightedSum = 
      (criticalCount * weights.criticalIssues * 2.0) +
      (highCount * weights.highIssues * 1.5) +
      (mediumCount * weights.mediumIssues * 0.7) +
      (lowCount * weights.lowIssues * 0.3);
    
    // Normalize by total weight (cap at 1.0)
    const totalWeight = weights.criticalIssues + weights.highIssues + 
                        weights.mediumIssues + weights.lowIssues;
    return Math.min(1.0, weightedSum / totalWeight);
  }

  /**
   * Calculate score from risk factors
   */
  private calculateFactorScore(factors: RiskFactor[]): number {
    if (factors.length === 0) return 0;

    const totalWeight = factors.reduce((sum, f) => sum + f.weight, 0);
    const weightedScore = factors.reduce((sum, f) => sum + (f.weight * f.value), 0);
    
    return Math.min(1.0, weightedScore / totalWeight);
  }
}

// Create singleton instance with default config
let scorerInstance: RiskScorer | null = null;

/**
 * Get the RiskScorer singleton instance
 */
export function getRiskScorer(): RiskScorer {
  if (!scorerInstance) {
    scorerInstance = new RiskScorer(DEFAULT_RISK_CONFIG);
  }
  return scorerInstance;
}