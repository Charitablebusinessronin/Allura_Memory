/**
 * Promotion Detector for ADAS (Automated Design of Agent Systems)
 * Story 2.4: Automate Design Promotion Logic
 *
 * Scans completed ADAS runs and identifies candidates meeting the promotion threshold.
 * Implements AC1: Creates candidate proposals for designs with score >= 0.7
 */

import type { Pool } from "pg";
import { getPool } from "../postgres/connection";
import { insertEvent, insertOutcome } from "../postgres/queries/insert-trace";
import type { EvaluationMetrics, AgentDesign, ADASRunRecord } from "./types";

/**
 * Promotion status values following the state machine from Task 1:
 * candidate -> pending_approval -> approved/rejected
 */
export type PromotionStatus = "candidate" | "pending_approval" | "approved" | "rejected";

/**
 * Promotion configuration
 */
export interface PromotionConfig {
  /** Confidence threshold for promotion (default: 0.7 from FR4) */
  confidenceThreshold: number;
  /** Group ID for tenant isolation */
  groupId: string;
  /** Domain to scan for promotion candidates */
  domain?: string;
  /** Minimum number of test cases for evidence completeness */
  minTestCases?: number;
  /** Require trace evidence linkage */
  requireTraceEvidence?: boolean;
  /** Verbose logging */
  verbose?: boolean;
}

/**
 * Promotion candidate identified from ADAS runs
 */
export interface PromotionCandidate {
  /** Design ID being considered for promotion */
  designId: string;
  /** Run ID where this design was evaluated */
  runId: string;
  /** Group ID for tenant isolation */
  groupId: string;
  /** Domain of the design */
  domain: string;
  /** Composite score from evaluation */
  score: number;
  /** Design configuration */
  design: AgentDesign;
  /** Evaluation metrics */
  metrics: EvaluationMetrics;
  /** Evidence reference (PostgreSQL event ID) */
  evidenceRef: string;
  /** Timestamp of evaluation */
  evaluatedAt: Date;
  /** Current promotion status */
  status: PromotionStatus;
}

/**
 * Evidence collected for a promotion decision
 */
export interface PromotionEvidence {
  /** Design ID */
  designId: string;
  /** Run ID */
  runId: string;
  /** Event ID from PostgreSQL */
  eventId: number;
  /** Outcome ID if available */
  outcomeId?: number;
  /** Evaluation metrics */
  metrics: EvaluationMetrics;
  /** Test case results summary */
  testCases: {
    total: number;
    passed: number;
    failed: number;
  };
  /** Timestamp */
  timestamp: Date;
}

/**
 * Promotion detection result
 */
export interface PromotionDetectionResult {
  /** Number of runs scanned */
  runsScanned: number;
  /** Candidates found meeting threshold */
  candidatesFound: number;
  /** Candidates requiring evidence completion */
  needsEvidence: number;
  /** Promoted candidates */
  candidates: PromotionCandidate[];
}

/**
 * Default promotion configuration
 */
export const DEFAULT_PROMOTION_CONFIG: Omit<PromotionConfig, "groupId"> = {
  confidenceThreshold: 0.7,
  minTestCases: 1,
  requireTraceEvidence: true,
  verbose: false,
};

/**
 * Query result from adas_runs joined with events/outcomes
 */
interface ADASRunWithEvidence {
  run_id: string;
  group_id: string;
  domain: string;
  best_design_id: string | null;
  best_score: number | null;
  status: string;
  completed_at: Date | null;
}

/**
 * Event result with metrics
 */
interface EventWithMetrics {
  event_id: number;
  outcome_id: number | null;
  design_id: string;
  run_id: string;
  metrics: EvaluationMetrics | null;
  passed: boolean;
}

/**
 * Promotion Detector
 * Scans ADAS runs and identifies promotion candidates
 */
export class PromotionDetector {
  private config: PromotionConfig;
  private pool: Pool;

  constructor(config: PromotionConfig) {
    this.config = {
      ...DEFAULT_PROMOTION_CONFIG,
      ...config,
    };
    this.pool = getPool();
  }

  /**
   * Scan completed ADAS runs for promotion candidates
   * Implements AC1: Find designs with score >= 0.7
   */
  async scanForCandidates(): Promise<PromotionDetectionResult> {
    const threshold = this.config.confidenceThreshold;

    if (this.config.verbose) {
      console.log(`[PromotionDetector] Scaning for candidates with threshold ${threshold}`);
    }

    const result: PromotionDetectionResult = {
      runsScanned: 0,
      candidatesFound: 0,
      needsEvidence: 0,
      candidates: [],
    };

    const runs = await this.fetchCompletedRuns();

    result.runsScanned = runs.length;

    for (const run of runs) {
      if (run.best_score === null || run.best_design_id === null) {
        continue;
      }

      if (run.best_score >= threshold) {
        const candidate = await this.buildPromotionCandidate(run);

        if (candidate) {
          const evidenceComplete = this.verifyEvidenceCompleteness(candidate);

          if (!evidenceComplete) {
            result.needsEvidence++;
          }

          result.candidates.push(candidate);
          result.candidatesFound++;
        }
      }
    }

    await this.logDetectionRun(result);

    return result;
  }

  /**
   * Get promotion candidates by status
   */
  async getCandidatesByStatus(status: PromotionStatus): Promise<PromotionCandidate[]> {
    const query = `
      SELECT 
        p.design_id,
        p.run_id,
        p.group_id,
        p.domain,
        p.score,
        p.status,
        p.evidence_ref,
        p.created_at,
        p.updated_at
      FROM promotion_candidates p
      WHERE p.group_id = $1 AND p.status = $2
      ORDER BY p.score DESC
    `;

    const queryResult = await this.pool.query(query, [this.config.groupId, status]);

    return queryResult.rows.map((row) => ({
      designId: row.design_id,
      runId: row.run_id,
      groupId: row.group_id,
      domain: row.domain,
      score: parseFloat(row.score),
      design: JSON.parse(row.design_data || "{}"),
      metrics: JSON.parse(row.metrics || "{}"),
      evidenceRef: row.evidence_ref,
      evaluatedAt: new Date(row.created_at),
      status: row.status as PromotionStatus,
    }));
  }

  /**
   * Get high-confidence designs (AC3)
   * Only returns designs meeting threshold with proper evidence
   */
  async getHighConfidenceDesigns(minScore?: number): Promise<PromotionCandidate[]> {
    const threshold = minScore ?? this.config.confidenceThreshold;

    const query = `
      SELECT 
        p.design_id,
        p.run_id,
        p.group_id,
        p.domain,
        p.score,
        p.status,
        p.evidence_ref,
        p.created_at,
        p.updated_at
      FROM promotion_candidates p
      WHERE p.group_id = $1 
        AND p.score >= $2
        AND p.evidence_ref IS NOT NULL
      ORDER BY p.score DESC
    `;

    const queryResult = await this.pool.query(query, [this.config.groupId, threshold]);

    return queryResult.rows.map((row) => ({
      designId: row.design_id,
      runId: row.run_id,
      groupId: row.group_id,
      domain: row.domain,
      score: parseFloat(row.score),
      design: JSON.parse(row.design_data || "{}"),
      metrics: JSON.parse(row.metrics || "{}"),
      evidenceRef: row.evidence_ref,
      evaluatedAt: new Date(row.created_at),
      status: row.status as PromotionStatus,
    }));
  }

  /**
   * Fetch completed ADAS runs
   */
  private async fetchCompletedRuns(): Promise<ADASRunWithEvidence[]> {
    let query = `
      SELECT 
        run_id,
        group_id,
        domain,
        best_design_id,
        best_score,
        status,
        completed_at
      FROM adas_runs
      WHERE status = 'completed'
        AND group_id = $1
    `;

    const params: (string | number)[] = [this.config.groupId];

    if (this.config.domain) {
      query += ` AND domain = $${params.length + 1}`;
      params.push(this.config.domain);
    }

    query += ` ORDER BY started_at DESC`;

    const queryResult = await this.pool.query<ADASRunWithEvidence>(query, params);

    return queryResult.rows.map((row) => ({
      run_id: row.run_id,
      group_id: row.group_id,
      domain: row.domain,
      best_design_id: row.best_design_id,
      best_score: row.best_score,
      status: row.status,
      completed_at: row.completed_at,
    }));
  }

  /**
   * Build a promotion candidate from ADAS run
   */
  private async buildPromotionCandidate(run: ADASRunWithEvidence): Promise<PromotionCandidate | null> {
    if (!run.best_design_id || run.best_score === null) {
      return null;
    }

    const evidence = await this.fetchEvidence(run.run_id, run.best_design_id);

    if (!evidence && this.config.requireTraceEvidence) {
      if (this.config.verbose) {
        console.log(
          `[PromotionDetector] Skipping run ${run.run_id}: no evidence found`
        );
      }
      return null;
    }

    return {
      designId: run.best_design_id,
      runId: run.run_id,
      groupId: run.group_id,
      domain: run.domain,
      score: run.best_score,
      design: evidence?.metrics
        ? {
            design_id: run.best_design_id,
            name: `design-${run.best_design_id}`,
            version: "1.0",
            domain: run.domain,
            description: "ADAS-generated design",
            config: {},
          }
        : {
            design_id: run.best_design_id,
            name: `design-${run.best_design_id}`,
            version: "1.0",
            domain: run.domain,
            description: "ADAS-generated design",
            config: {},
          },
      metrics: evidence?.metrics ?? {
        accuracy: run.best_score,
        cost: 0,
        latency: 0,
        composite: run.best_score,
      },
      evidenceRef: evidence ? `event:${evidence.eventId}` : "",
      evaluatedAt: run.completed_at ?? new Date(),
      status: "candidate",
    };
  }

  /**
   * Fetch evidence from PostgreSQL events/outcomes
   */
  private async fetchEvidence(runId: string, designId: string): Promise<PromotionEvidence | null> {
    const query = `
      SELECT 
        e.id as event_id,
        o.id as outcome_id,
        e.metadata->>'designId' as design_id,
        e.metadata->>'runId' as run_id,
        e.outcome->>'accuracy' as accuracy,
        e.outcome->>'composite' as composite,
        e.outcome->>'cost' as cost,
        e.outcome->>'latency' as latency,
        e.created_at as timestamp
      FROM events e
      LEFT JOIN outcomes o ON o.event_id = e.id
      WHERE e.workflow_id = $1 
        AND e.metadata->>'designId' = $2
        AND e.event_type = 'evaluation_completed'
      ORDER BY e.created_at DESC
      LIMIT 1
    `;

    const queryResult = await this.pool.query(query, [runId, designId]);

    if (queryResult.rows.length === 0) {
      return null;
    }

    const row = queryResult.rows[0];

    if (!row) {
      return null;
    }

    const metrics: EvaluationMetrics = {
      accuracy: parseFloat(row.accuracy ?? "0"),
      cost: parseFloat(row.cost ?? "0"),
      latency: parseFloat(row.latency ?? "0"),
      composite: parseFloat(row.composite ?? "0"),
    };

    return {
      designId: row.design_id ?? designId,
      runId: row.run_id ?? runId,
      eventId: row.event_id,
      outcomeId: row.outcome_id ?? undefined,
      metrics,
      testCases: {
        total: 1,
        passed: 1,
        failed: 0,
      },
      timestamp: new Date(row.timestamp),
    };
  }

  /**
   * Verify evidence completeness (Task 1)
   * Checks that required evidence is present and valid
   */
  verifyEvidenceCompleteness(candidate: PromotionCandidate): boolean {
    if (this.config.minTestCases && this.config.minTestCases > 0) {
      if (!candidate.metrics.details?.testCasesExecuted) {
        return false;
      }

      if (candidate.metrics.details.testCasesExecuted < this.config.minTestCases) {
        return false;
      }
    }

    if (this.config.requireTraceEvidence) {
      if (!candidate.evidenceRef || candidate.evidenceRef.length === 0) {
        return false;
      }

      if (!candidate.evidenceRef.startsWith("event:")) {
        return false;
      }
    }

    return true;
  }

  /**
   * Log detection run to PostgreSQL
   */
  private async logDetectionRun(result: PromotionDetectionResult): Promise<void> {
    try {
      await insertEvent({
        group_id: this.config.groupId,
        event_type: "promotion_scan",
        agent_id: "promotion-detector",
        workflow_id: `scan-${Date.now()}`,
        metadata: {
          runsScanned: result.runsScanned,
          candidatesFound: result.candidatesFound,
          needsEvidence: result.needsEvidence,
          threshold: this.config.confidenceThreshold,
          domain: this.config.domain ?? "all",
        },
        status: "completed",
      });
    } catch (error) {
      if (this.config.verbose) {
        console.error("[PromotionDetector] Failed to log detection run:", error);
      }
    }
  }
}

/**
 * Create a promotion detector with configuration
 */
export function createPromotionDetector(config: PromotionConfig): PromotionDetector {
  return new PromotionDetector(config);
}

/**
 * Convenience function to scan for promotion candidates
 */
export async function scanForPromotionCandidates(
  groupId: string,
  options: Partial<PromotionConfig> = {}
): Promise<PromotionDetectionResult> {
  const config: PromotionConfig = {
    ...DEFAULT_PROMOTION_CONFIG,
    ...options,
    groupId,
  };

  const detector = new PromotionDetector(config);
  return detector.scanForCandidates();
}

/**
 * Convenience function to get high-confidence designs (AC3)
 */
export async function getHighConfidenceDesigns(
  groupId: string,
  minScore?: number,
  options: Partial<PromotionConfig> = {}
): Promise<PromotionCandidate[]> {
  const config: PromotionConfig = {
    ...DEFAULT_PROMOTION_CONFIG,
    ...options,
    groupId,
  };

  const detector = new PromotionDetector(config);
  return detector.getHighConfidenceDesigns(minScore);
}