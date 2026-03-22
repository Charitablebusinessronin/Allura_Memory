import type { Pool } from "pg";
import { getPool } from "../postgres/connection";
import { insertEvent, insertOutcome } from "../postgres/queries/insert-trace";
import type {
  AgentDesign,
  DomainConfig,
  EvaluationHarnessConfig,
  EvaluationMetrics,
  EvaluationResult,
  ForwardFn,
  GroundTruthCase,
  ADASRunInsert,
  ADASRunRecord,
  CandidateRanking,
  TokenUsage,
  EvaluationDetails,
} from "./types";
import {
  TokenCounter,
  LatencyTracker,
  calculateAccuracy,
  buildMetrics,
  rankCandidates,
  meetsThresholds,
} from "./metrics";
import { randomUUID } from "crypto";

/**
 * Evaluation Harness for ADAS (Automated Design of Agent Systems)
 * Story 2.1: Implement Domain Evaluation Harness
 * 
 * Evaluates candidate agent designs against objective metrics
 * (accuracy, cost, latency) and logs results to PostgreSQL.
 */

/**
 * Global token counter for tracking usage during evaluation
 */
const tokenCounter = new TokenCounter();

/**
 * Global latency tracker for measuring execution time
 */
const latencyTracker = new LatencyTracker();

/**
 * ADAS Runs database operations
 */
async function insertADASRun(run: ADASRunInsert): Promise<ADASRunRecord> {
  const pool = getPool();

  const query = `
    INSERT INTO adas_runs (group_id, run_id, domain, config, status)
    VALUES ($1, $2, $3, $4, $5)
    RETURNING *
  `;

  const values = [
    run.group_id,
    run.run_id,
    run.domain,
    JSON.stringify(run.config ?? {}),
    run.status ?? "running",
  ];

  const result = await pool.query<ADASRunRecord>(query, values);
  return result.rows[0];
}

/**
 * Update ADAS run status and results
 */
async function updateADASRun(
  runId: string,
  updates: {
    status?: string;
    bestDesignId?: string;
    bestScore?: number;
    completedAt?: Date;
  }
): Promise<void> {
  const pool = getPool();
  const setClauses: string[] = [];
  const values: unknown[] = [];
  let paramIndex = 1;

  if (updates.status !== undefined) {
    setClauses.push(`status = $${paramIndex++}`);
    values.push(updates.status);
  }

  if (updates.bestDesignId !== undefined) {
    setClauses.push(`best_design_id = $${paramIndex++}`);
    values.push(updates.bestDesignId);
  }

  if (updates.bestScore !== undefined) {
    setClauses.push(`best_score = $${paramIndex++}`);
    values.push(updates.bestScore);
  }

  if (updates.completedAt !== undefined) {
    setClauses.push(`completed_at = $${paramIndex++}`);
    values.push(updates.completedAt);
  }

  if (setClauses.length === 0) {
    return;
  }

  values.push(runId);
  const query = `
    UPDATE adas_runs
    SET ${setClauses.join(", ")}
    WHERE run_id = $${paramIndex}
  `;

  await pool.query(query, values);
}

/**
 * Log evaluation event to PostgreSQL
 */
async function logEvaluationEvent(
  groupId: string,
  runId: string,
  designId: string,
  eventType: "evaluation_started" | "evaluation_completed" | "evaluation_failed",
  domain: string,
  outcome?: Partial<EvaluationMetrics>,
  error?: string
): Promise<void> {
  await insertEvent({
    group_id: groupId,
    event_type: eventType,
    agent_id: `adas-evaluator-${runId}`,
    workflow_id: runId,
    metadata: {
      runId,
      designId,
      domain,
    },
    status: eventType === "evaluation_failed" ? "failed" : "completed",
    outcome: {
      metrics: outcome,
      error,
    },
  });
}

/**
 * Log evaluation outcome to PostgreSQL
 */
async function logEvaluationOutcome(
  groupId: string,
  eventId: number,
  designId: string,
  metrics: EvaluationMetrics,
  passed: boolean,
  rank?: number
): Promise<void> {
  await insertOutcome({
    group_id: groupId,
    event_id: eventId,
    outcome_type: "evaluation_result",
    confidence: metrics.accuracy,
    data: {
      designId,
      metrics,
      passed,
      rank,
    },
  });
}

/**
 * Evaluation Harness class
 * The core component for measuring candidate agent designs
 */
export class EvaluationHarness {
  private config: EvaluationHarnessConfig;
  private runId: string;
  private groupId: string;
  private domain: DomainConfig;

  constructor(config: EvaluationHarnessConfig) {
    this.config = config;
    this.groupId = config.groupId;
    this.domain = config.domain;
    this.runId = randomUUID();
  }

  /**
   * Get the current run ID
   */
  getRunId(): string {
    return this.runId;
  }

  /**
   * Get the group ID
   */
  getGroupId(): string {
    return this.groupId;
  }

  /**
   * Evaluate a single candidate agent design
   * Implements AC1: harness evaluates design and returns structured score
   */
  async evaluateCandidate(
    design: AgentDesign,
    forwardFn: ForwardFn<unknown, unknown>
  ): Promise<EvaluationResult> {
    const startTime = new Date();

    try {
      await this.initializeRun(design);

      await logEvaluationEvent(
        this.groupId,
        this.runId,
        design.design_id,
        "evaluation_started",
        this.domain.domainId
      );

      const metrics = await this.evaluateDesign(design, forwardFn);

      const passed = meetsThresholds(metrics, this.domain);

      const event = await insertEvent({
        group_id: this.groupId,
        event_type: "evaluation_completed",
        agent_id: `adas-evaluator-${this.runId}`,
        workflow_id: this.runId,
        metadata: {
          runId: this.runId,
          designId: design.design_id,
          domain: this.domain.domainId,
          modelConfig: design.config.model,
        },
        outcome: {
          accuracy: metrics.accuracy,
          cost: metrics.cost,
          latency: metrics.latency,
          composite: metrics.composite,
        },
        status: "completed",
      });

      await this.logMetricsToTrace(event.id, design.design_id, metrics, passed);

      await updateADASRun(this.runId, {
        status: "completed",
        bestDesignId: design.design_id,
        bestScore: metrics.composite,
        completedAt: new Date(),
      });

      return {
        design,
        metrics,
        runId: this.runId,
        groupId: this.groupId,
        evaluatedAt: startTime,
        passed,
        details: metrics.details,
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);

      await logEvaluationEvent(
        this.groupId,
        this.runId,
        design.design_id,
        "evaluation_failed",
        this.domain.domainId,
        undefined,
        errorMessage
      );

      await updateADASRun(this.runId, {
        status: "failed",
        completedAt: new Date(),
      });

      throw error;
    }
  }

  /**
   * Evaluate multiple candidates and rank them
   * Implements AC3: rank candidates by composite score
   */
  async evaluateAndRank(
    candidates: Array<{
      design: AgentDesign;
      forwardFn: ForwardFn<unknown, unknown>;
    }>
  ): Promise<CandidateRanking[]> {
    const results: EvaluationResult[] = [];

    for (const candidate of candidates) {
      try {
        this.runId = randomUUID();
        
        const result = await this.evaluateCandidate(
          candidate.design,
          candidate.forwardFn
        );
        results.push(result);
      } catch (error) {
        console.error(
          `[EvaluationHarness] Failed to evaluate ${candidate.design.design_id}:`,
          error
        );
      }
    }

    const candidatesWithMetrics = results.map((r) => ({
      designId: r.design.design_id,
      name: r.design.name,
      metrics: r.metrics,
    }));

    const ranked = rankCandidates(candidatesWithMetrics, {
      accuracyWeight: this.domain.accuracyWeight ?? 0.5,
      costWeight: this.domain.costWeight ?? 0.25,
      latencyWeight: this.domain.latencyWeight ?? 0.25,
    });

    for (let i = 0; i < results.length; i++) {
      const result = results[i];
      const rankEntry = ranked.find(
        (r) => r.designId === result.design.design_id
      );

      if (rankEntry) {
        const event = await insertEvent({
          group_id: this.groupId,
          event_type: "candidate_ranked",
          agent_id: `adas-ranker-${this.runId}`,
          workflow_id: this.runId,
          metadata: {
            runId: this.runId,
            designId: result.design.design_id,
            rank: rankEntry.rank,
          },
          outcome: {
            composite: rankEntry.composite,
            accuracy: rankEntry.accuracy,
            cost: rankEntry.cost,
            latency: rankEntry.latency,
          },
          status: "completed",
        });

        await logEvaluationOutcome(
          this.groupId,
          event.id,
          result.design.design_id,
          result.metrics,
          result.passed,
          rankEntry.rank
        );
      }
    }

    if (ranked.length > 0 && ranked[0]) {
      await updateADASRun(this.runId, {
        bestDesignId: ranked[0].designId,
        bestScore: ranked[0].composite,
      });
    }

    return ranked;
  }

  /**
   * Initialize ADAS run record in database
   * Implements AC2: log metrics to raw trace layer
   */
  private async initializeRun(design: AgentDesign): Promise<ADASRunRecord> {
    return insertADASRun({
      group_id: this.groupId,
      run_id: this.runId,
      domain: this.domain.domainId,
      config: {
        designId: design.design_id,
        modelConfig: design.config.model,
        domainConfig: {
          accuracyWeight: this.domain.accuracyWeight,
          costWeight: this.domain.costWeight,
          latencyWeight: this.domain.latencyWeight,
        },
      },
      status: "running",
    });
  }

  /**
   * Evaluate a design against ground truth
   */
  private async evaluateDesign(
    design: AgentDesign,
    forwardFn: ForwardFn<unknown, unknown>
  ): Promise<EvaluationMetrics> {
    tokenCounter.reset();
    latencyTracker.reset();

    const testCases = this.domain.groundTruth ?? [];
    const results: Array<{ passed: boolean; weight?: number }> = [];
    let totalPromptTokens = 0;
    let totalCompletionTokens = 0;

    latencyTracker.start();

    for (const testCase of testCases) {
      try {
        const mockTokenUsage = this.simulateTokenUsage(
          testCase.input,
          testCase.expectedOutput
        );
        totalPromptTokens += mockTokenUsage.promptTokens;
        totalCompletionTokens += mockTokenUsage.completionTokens;

        const passed = await this.evaluateTestCase(
          forwardFn,
          testCase,
          this.config.timeout ?? 30000
        );

        results.push({
          passed,
          weight: testCase.weight,
        });
      } catch (error) {
        results.push({
          passed: false,
          weight: testCase.weight,
        });
      }
    }

    const latencyMs = latencyTracker.stop();

    const tokens: TokenUsage = {
      promptTokens: totalPromptTokens,
      completionTokens: totalCompletionTokens,
      totalTokens: totalPromptTokens + totalCompletionTokens,
    };

    const accuracy = calculateAccuracy(results);

    const details: EvaluationDetails = {
      testCasesExecuted: testCases.length,
      testCasesPassed: results.filter((r) => r.passed).length,
    };

    const modelId = design.config.model?.modelId ?? "gpt-4o-mini";

    return buildMetrics(accuracy, tokens, latencyMs, modelId, details, {
      accuracyWeight: this.domain.accuracyWeight ?? 0.5,
      costWeight: this.domain.costWeight ?? 0.25,
      latencyWeight: this.domain.latencyWeight ?? 0.25,
    });
  }

  /**
   * Evaluate a single test case
   */
  private async evaluateTestCase(
    forwardFn: ForwardFn,
    testCase: GroundTruthCase,
    timeout: number
  ): Promise<boolean> {
    try {
      const result = await Promise.race([
        Promise.resolve(forwardFn(testCase.input)),
        new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error("Timeout")), timeout)
        ),
      ]);

      return this.compareResults(result, testCase.expectedOutput);
    } catch {
      return false;
    }
  }

  /**
   * Compare results for accuracy assessment
   */
  private compareResults(
    actual: unknown,
    expected: unknown
  ): boolean {
    if (typeof actual === "string" && typeof expected === "string") {
      const normalizedActual = actual.trim().toLowerCase();
      const normalizedExpected = expected.trim().toLowerCase();
      return (
        normalizedActual === normalizedExpected ||
        normalizedActual.includes(normalizedExpected)
      );
    }

    if (typeof actual === "boolean" && typeof expected === "boolean") {
      return actual === expected;
    }

    if (typeof actual === "number" && typeof expected === "number") {
      return Math.abs(actual - expected) < 0.001;
    }

    if (typeof actual === "object" && typeof expected === "object") {
      try {
        return JSON.stringify(actual) === JSON.stringify(expected);
      } catch {
        return false;
      }
    }

    return actual === expected;
  }

  /**
   * Simulate token usage for testing
   * In production, this would be actual token counting from the LLM API
   */
  private simulateTokenUsage(
    input: string,
    output: string
  ): { promptTokens: number; completionTokens: number } {
    const promptTokens = Math.ceil((input?.length ?? 0) / 4);
    const completionTokens = Math.ceil((output?.length ?? 0) / 4);
    return { promptTokens, completionTokens };
  }

  /**
   * Log metrics to PostgreSQL trace layer
   * Implements AC2: metrics are logged to raw trace layer
   */
  private async logMetricsToTrace(
    eventId: number,
    designId: string,
    metrics: EvaluationMetrics,
    passed: boolean
  ): Promise<void> {
    await insertOutcome({
      group_id: this.groupId,
      event_id: eventId,
      outcome_type: "evaluation_metrics",
      confidence: metrics.accuracy,
      data: {
        designId,
        accuracy: metrics.accuracy,
        cost: metrics.cost,
        latency: metrics.latency,
        composite: metrics.composite,
        passed,
        tokens: metrics.tokens,
      },
    });
  }
}

/**
 * Factory function to create an evaluation harness
 */
export function createEvaluationHarness(
  config: EvaluationHarnessConfig
): EvaluationHarness {
  return new EvaluationHarness(config);
}

/**
 * Convenience function to evaluate a single candidate
 */
export async function evaluateCandidate(
  design: AgentDesign,
  forwardFn: ForwardFn<unknown, unknown>,
  domain: DomainConfig,
  groupId: string
): Promise<EvaluationResult> {
  const harness = createEvaluationHarness({
    groupId,
    domain,
  });

  return harness.evaluateCandidate(design, forwardFn);
}

/**
 * Convenience function to evaluate and rank multiple candidates
 */
export async function evaluateAndRankCandidates(
  candidates: Array<{
    design: AgentDesign;
    forwardFn: ForwardFn<unknown, unknown>;
  }>,
  domain: DomainConfig,
  groupId: string
): Promise<CandidateRanking[]> {
  const harness = createEvaluationHarness({
    groupId,
    domain,
  });

  return harness.evaluateAndRank(candidates);
}

/**
 * Exported for testing
 */
export { TokenCounter, LatencyTracker };