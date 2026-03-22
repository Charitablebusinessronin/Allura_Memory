import type { EvaluationMetrics, TokenUsage, EvaluationDetails, DomainConfig } from "./types";

/**
 * Metrics Computation for ADAS Evaluation Harness
 * Story 2.1: Implement Domain Evaluation Harness
 * 
 * Computes accuracy, cost, latency, and composite scores
 * for evaluating candidate agent designs.
 */

/**
 * Model pricing configuration (per 1K tokens in USD)
 * Based on current API pricing as of 2024
 */
export const MODEL_PRICING: Record<string, { prompt: number; completion: number }> = {
  "gpt-4o": { prompt: 0.0025, completion: 0.01 },
  "gpt-4o-mini": { prompt: 0.00015, completion: 0.0006 },
  "gpt-4-turbo": { prompt: 0.01, completion: 0.03 },
  "gpt-4": { prompt: 0.03, completion: 0.06 },
  "gpt-3.5-turbo": { prompt: 0.0005, completion: 0.0015 },
  "claude-3-opus": { prompt: 0.015, completion: 0.075 },
  "claude-3-sonnet": { prompt: 0.003, completion: 0.015 },
  "claude-3-haiku": { prompt: 0.00025, completion: 0.00125 },
  "claude-3.5-sonnet": { prompt: 0.003, completion: 0.015 },
};

/**
 * Default pricing for unknown models
 */
const DEFAULT_PRICING = { prompt: 0.001, completion: 0.002 };

/**
 * Token usage tracker for evaluating agents
 */
export class TokenCounter {
  private promptTokens = 0;
  private completionTokens = 0;

  addPromptTokens(count: number): void {
    this.promptTokens += count;
  }

  addCompletionTokens(count: number): void {
    this.completionTokens += count;
  }

  getTotal(): TokenUsage {
    return {
      promptTokens: this.promptTokens,
      completionTokens: this.completionTokens,
      totalTokens: this.promptTokens + this.completionTokens,
    };
  }

  reset(): void {
    this.promptTokens = 0;
    this.completionTokens = 0;
  }
}

/**
 * Latency tracker for evaluating agents
 */
export class LatencyTracker {
  private startTime: number | null = null;
  private endTime: number | null = null;

  start(): void {
    this.startTime = performance.now();
  }

  stop(): number {
    this.endTime = performance.now();
    return this.getLatency();
  }

  getLatency(): number {
    if (this.startTime === null || this.endTime === null) {
      return 0;
    }
    return Math.round(this.endTime - this.startTime);
  }

  reset(): void {
    this.startTime = null;
    this.endTime = null;
  }
}

/**
 * Calculate cost from token usage
 */
export function calculateCost(
  tokens: TokenUsage,
  modelId: string
): number {
  const pricing = MODEL_PRICING[modelId] ?? DEFAULT_PRICING;

  const promptCost = (tokens.promptTokens / 1000) * pricing.prompt;
  const completionCost = (tokens.completionTokens / 1000) * pricing.completion;

  return Math.round((promptCost + completionCost) * 100000) / 100000;
}

/**
 * Calculate accuracy from test results
 * Supports both binary and weighted scoring
 */
export function calculateAccuracy(
  results: Array<{ passed: boolean; weight?: number }>
): number {
  if (results.length === 0) {
    return 0;
  }

  let totalWeight = 0;
  let passedWeight = 0;

  for (const result of results) {
    const weight = result.weight ?? 1;
    totalWeight += weight;
    if (result.passed) {
      passedWeight += weight;
    }
  }

  return Math.round((passedWeight / totalWeight) * 1000) / 1000;
}

/**
 * Calculate composite score from metrics
 * Weighted average of accuracy, cost, and latency
 * 
 * Cost and latency are normalized and inverted (lower is better)
 */
export function calculateCompositeScore(
  accuracy: number,
  cost: number,
  latency: number,
  weights?: {
    accuracyWeight: number;
    costWeight: number;
    latencyWeight: number;
  }
): number {
  const w = weights ?? {
    accuracyWeight: 0.5,
    costWeight: 0.25,
    latencyWeight: 0.25,
  };

  const normAccuracy = accuracy;

  const normCost = 1 / (1 + cost * 100);

  const normLatency = 1 / (1 + latency / 10000);

  const rawScore =
    normAccuracy * w.accuracyWeight +
    normCost * w.costWeight +
    normLatency * w.latencyWeight;

  return Math.round(rawScore * 10000) / 10000;
}

/**
 * Build complete metrics from evaluation results
 */
export function buildMetrics(
  accuracy: number,
  tokens: TokenUsage,
  latencyMs: number,
  modelId: string,
  details?: EvaluationDetails,
  weights?: {
    accuracyWeight: number;
    costWeight: number;
    latencyWeight: number;
  }
): EvaluationMetrics {
  const cost = calculateCost(tokens, modelId);
  const composite = calculateCompositeScore(accuracy, cost, latencyMs, weights);

  return {
    accuracy,
    cost,
    latency: latencyMs,
    composite,
    tokens: {
      ...tokens,
      promptCost: (tokens.promptTokens / 1000) * (MODEL_PRICING[modelId]?.prompt ?? DEFAULT_PRICING.prompt),
      completionCost: (tokens.completionTokens / 1000) * (MODEL_PRICING[modelId]?.completion ?? DEFAULT_PRICING.completion),
    },
    details,
  };
}

/**
 * Compare two sets of metrics
 * Returns positive if a is better, negative if b is better
 */
export function compareMetrics(
  a: EvaluationMetrics,
  b: EvaluationMetrics,
  weights?: {
    accuracyWeight: number;
    costWeight: number;
    latencyWeight: number;
  }
): number {
  const compositeA = calculateCompositeScore(
    a.accuracy,
    a.cost,
    a.latency,
    weights
  );
  const compositeB = calculateCompositeScore(
    b.accuracy,
    b.cost,
    b.latency,
    weights
  );

  return compositeA - compositeB;
}

/**
 * Rank candidates by composite score
 * Implements AC3: rank candidates by composite score across accuracy, cost, latency
 */
export function rankCandidates(
  candidates: Array<{
    designId: string;
    name: string;
    metrics: EvaluationMetrics;
  }>,
  weights?: {
    accuracyWeight: number;
    costWeight: number;
    latencyWeight: number;
  }
): Array<{
  designId: string;
  name: string;
  composite: number;
  accuracy: number;
  cost: number;
  latency: number;
  rank: number;
}> {
  const sorted = [...candidates].sort((a, b) => 
    compareMetrics(b.metrics, a.metrics, weights)
  );

  return sorted.map((candidate, index) => ({
    designId: candidate.designId,
    name: candidate.name,
    composite: candidate.metrics.composite,
    accuracy: candidate.metrics.accuracy,
    cost: candidate.metrics.cost,
    latency: candidate.metrics.latency,
    rank: index + 1,
  }));
}

/**
 * Check if metrics meet minimum thresholds for a domain
 */
export function meetsThresholds(
  metrics: EvaluationMetrics,
  config: DomainConfig
): boolean {
  if (config.minAccuracy !== undefined && metrics.accuracy < config.minAccuracy) {
    return false;
  }

  if (config.maxCost !== undefined && metrics.cost > config.maxCost) {
    return false;
  }

  if (config.maxLatency !== undefined && metrics.latency > config.maxLatency) {
    return false;
  }

  return true;
}

/**
 * Normalize metrics to 0-1 scale for comparison
 */
export function normalizeMetrics(
  candidates: EvaluationMetrics[]
): EvaluationMetrics[] {
  if (candidates.length === 0) {
    return candidates;
  }

  const accuracyValues = candidates.map((c) => c.accuracy);
  const costValues = candidates.map((c) => c.cost);
  const latencyValues = candidates.map((c) => c.latency);

  const minAccuracy = Math.min(...accuracyValues);
  const maxAccuracy = Math.max(...accuracyValues);
  const minCost = Math.min(...costValues);
  const maxCost = Math.max(...costValues);
  const minLatency = Math.min(...latencyValues);
  const maxLatency = Math.max(...latencyValues);

  const accuracyRange = maxAccuracy - minAccuracy || 1;
  const costRange = maxCost - minCost || 1;
  const latencyRange = maxLatency - minLatency || 1;

  return candidates.map((c) => ({
    ...c,
    accuracy: accuracyRange > 0 ? (c.accuracy - minAccuracy) / accuracyRange : 1,
    cost: costRange > 0 ? (c.cost - minCost) / costRange : 0,
    latency: latencyRange > 0 ? (c.latency - minLatency) / latencyRange : 0,
  }));
}

/**
 * Aggregate metrics across multiple evaluations
 */
export function aggregateMetrics(
  evaluations: EvaluationMetrics[]
): EvaluationMetrics {
  if (evaluations.length === 0) {
    return {
      accuracy: 0,
      cost: 0,
      latency: 0,
      composite: 0,
    };
  }

  const count = evaluations.length;

  const totalAccuracy = evaluations.reduce((sum, e) => sum + e.accuracy, 0);
  const totalCost = evaluations.reduce((sum, e) => sum + e.cost, 0);
  const totalLatency = evaluations.reduce((sum, e) => sum + e.latency, 0);

  const avgAccuracy = totalAccuracy / count;
  const avgCost = totalCost / count;
  const avgLatency = totalLatency / count;

  const composite = calculateCompositeScore(avgAccuracy, avgCost, avgLatency);

  const totalTokens = evaluations.reduce(
    (sum, e) => sum + (e.tokens?.totalTokens ?? 0),
    0
  );
  const totalPromptTokens = evaluations.reduce(
    (sum, e) => sum + (e.tokens?.promptTokens ?? 0),
    0
  );
  const totalCompletionTokens = evaluations.reduce(
    (sum, e) => sum + (e.tokens?.completionTokens ?? 0),
    0
  );

  return {
    accuracy: Math.round(avgAccuracy * 1000) / 1000,
    cost: Math.round(avgCost * 100000) / 100000,
    latency: Math.round(avgLatency),
    composite,
    tokens: {
      promptTokens: totalPromptTokens,
      completionTokens: totalCompletionTokens,
      totalTokens: totalTokens,
    },
  };
}