import { describe, it, expect, beforeAll, afterAll } from "vitest";
import {
  TokenCounter,
  LatencyTracker,
  calculateCost,
  calculateAccuracy,
  calculateCompositeScore,
  buildMetrics,
  compareMetrics,
  rankCandidates,
  meetsThresholds,
  aggregateMetrics,
} from "./metrics";
import type { EvaluationMetrics, TokenUsage, DomainConfig } from "./types";

describe("Metrics Computation", () => {
  describe("TokenCounter", () => {
    it("should track prompt tokens", () => {
      const counter = new TokenCounter();
      counter.addPromptTokens(100);
      counter.addPromptTokens(50);

      const total = counter.getTotal();
      expect(total.promptTokens).toBe(150);
      expect(total.completionTokens).toBe(0);
      expect(total.totalTokens).toBe(150);
    });

    it("should track completion tokens", () => {
      const counter = new TokenCounter();
      counter.addCompletionTokens(200);
      counter.addCompletionTokens(100);

      const total = counter.getTotal();
      expect(total.promptTokens).toBe(0);
      expect(total.completionTokens).toBe(300);
      expect(total.totalTokens).toBe(300);
    });

    it("should track both prompt and completion tokens", () => {
      const counter = new TokenCounter();
      counter.addPromptTokens(500);
      counter.addCompletionTokens(300);

      const total = counter.getTotal();
      expect(total.promptTokens).toBe(500);
      expect(total.completionTokens).toBe(300);
      expect(total.totalTokens).toBe(800);
    });

    it("should reset counters", () => {
      const counter = new TokenCounter();
      counter.addPromptTokens(100);
      counter.addCompletionTokens(50);
      counter.reset();

      const total = counter.getTotal();
      expect(total.promptTokens).toBe(0);
      expect(total.completionTokens).toBe(0);
      expect(total.totalTokens).toBe(0);
    });
  });

  describe("LatencyTracker", () => {
    it("should measure elapsed time", async () => {
      const tracker = new LatencyTracker();
      tracker.start();

      await new Promise((resolve) => setTimeout(resolve, 10));

      const latency = tracker.stop();
      expect(latency).toBeGreaterThanOrEqual(10);
    });

    it("should return 0 if not started or stopped", () => {
      const tracker = new LatencyTracker();
      expect(tracker.getLatency()).toBe(0);
    });

    it("should reset properly", async () => {
      const tracker = new LatencyTracker();
      tracker.start();
      await new Promise((resolve) => setTimeout(resolve, 5));
      tracker.stop();

      tracker.reset();
      expect(tracker.getLatency()).toBe(0);
    });
  });

  describe("calculateCost", () => {
    it("should calculate cost for GPT-4o-mini", () => {
      const tokens: TokenUsage = {
        promptTokens: 1000,
        completionTokens: 500,
        totalTokens: 1500,
      };

      const cost = calculateCost(tokens, "gpt-4o-mini");
      expect(cost).toBeCloseTo(0.00045, 5);
    });

    it("should calculate cost for GPT-4o", () => {
      const tokens: TokenUsage = {
        promptTokens: 1000,
        completionTokens: 500,
        totalTokens: 1500,
      };

      const cost = calculateCost(tokens, "gpt-4o");
      expect(cost).toBeCloseTo(0.0075, 4);
    });

    it("should calculate cost for Claude", () => {
      const tokens: TokenUsage = {
        promptTokens: 1000,
        completionTokens: 500,
        totalTokens: 1500,
      };

      const cost = calculateCost(tokens, "claude-3.5-sonnet");
      expect(cost).toBeCloseTo(0.0105, 5);
    });

    it("should use default pricing for unknown models", () => {
      const tokens: TokenUsage = {
        promptTokens: 1000,
        completionTokens: 1000,
        totalTokens: 2000,
      };

      const cost = calculateCost(tokens, "unknown-model");
      expect(cost).toBeCloseTo(0.003, 4);
    });
  });

  describe("calculateAccuracy", () => {
    it("should calculate accuracy from passed tests", () => {
      const results = [
        { passed: true },
        { passed: true },
        { passed: false },
        { passed: true },
      ];

      const accuracy = calculateAccuracy(results);
      expect(accuracy).toBe(0.75);
    });

    it("should return 0 for empty results", () => {
      const accuracy = calculateAccuracy([]);
      expect(accuracy).toBe(0);
    });

    it("should respect weights", () => {
      const results = [
        { passed: true, weight: 2 },
        { passed: false, weight: 1 },
        { passed: true, weight: 1 },
      ];

      const accuracy = calculateAccuracy(results);
      expect(accuracy).toBeCloseTo(0.75, 2);
    });

    it("should handle all passed", () => {
      const results = [
        { passed: true },
        { passed: true },
        { passed: true },
      ];

      const accuracy = calculateAccuracy(results);
      expect(accuracy).toBe(1);
    });

    it("should handle all failed", () => {
      const results = [
        { passed: false },
        { passed: false },
        { passed: false },
      ];

      const accuracy = calculateAccuracy(results);
      expect(accuracy).toBe(0);
    });
  });

  describe("calculateCompositeScore", () => {
    it("should weight accuracy highest by default", () => {
      const score = calculateCompositeScore(1.0, 0.01, 100);

      expect(score).toBeGreaterThan(0);
      expect(score).toBeLessThan(1);
    });

    it("should penalize higher costs", () => {
      const lowCost = calculateCompositeScore(0.5, 0.01, 100);
      const highCost = calculateCompositeScore(0.5, 1.0, 100);

      expect(lowCost).toBeGreaterThan(highCost);
    });

    it("should penalize higher latency", () => {
      const lowLatency = calculateCompositeScore(0.5, 0.01, 100);
      const highLatency = calculateCompositeScore(0.5, 0.01, 10000);

      expect(lowLatency).toBeGreaterThan(highLatency);
    });

    it("should use custom weights", () => {
      const weights = {
        accuracyWeight: 0.8,
        costWeight: 0.1,
        latencyWeight: 0.1,
      };

      const score = calculateCompositeScore(1.0, 0.1, 100, weights);
      expect(score).toBeGreaterThan(0.85);
      expect(score).toBeLessThan(1.0);
    });

    it("should handle perfect scores", () => {
      const score = calculateCompositeScore(1.0, 0, 0);
      expect(score).toBeCloseTo(1, 2);
    });
  });

  describe("buildMetrics", () => {
    it("should build complete metrics object", () => {
      const tokens: TokenUsage = {
        promptTokens: 500,
        completionTokens: 300,
        totalTokens: 800,
      };

      const metrics = buildMetrics(0.85, tokens, 150, "gpt-4o-mini");

      expect(metrics.accuracy).toBe(0.85);
      expect(metrics.latency).toBe(150);
      expect(metrics.cost).toBeGreaterThan(0);
      expect(metrics.composite).toBeGreaterThan(0);
      expect(metrics.tokens?.totalTokens).toBe(800);
    });

    it("should include details when provided", () => {
      const tokens: TokenUsage = {
        promptTokens: 500,
        completionTokens: 300,
        totalTokens: 800,
      };

      const details = {
        testCasesExecuted: 10,
        testCasesPassed: 8,
      };

      const metrics = buildMetrics(0.8, tokens, 100, "gpt-4o-mini", details);

      expect(metrics.details?.testCasesExecuted).toBe(10);
      expect(metrics.details?.testCasesPassed).toBe(8);
    });
  });

  describe("compareMetrics", () => {
    it("should return positive when first is better", () => {
      const a: EvaluationMetrics = {
        accuracy: 0.9,
        cost: 0.01,
        latency: 100,
        composite: 0.85,
      };

      const b: EvaluationMetrics = {
        accuracy: 0.7,
        cost: 0.05,
        latency: 200,
        composite: 0.65,
      };

      const result = compareMetrics(a, b);
      expect(result).toBeGreaterThan(0);
    });

    it("should return negative when second is better", () => {
      const a: EvaluationMetrics = {
        accuracy: 0.7,
        cost: 0.05,
        latency: 200,
        composite: 0.65,
      };

      const b: EvaluationMetrics = {
        accuracy: 0.9,
        cost: 0.01,
        latency: 100,
        composite: 0.85,
      };

      const result = compareMetrics(a, b);
      expect(result).toBeLessThan(0);
    });

    it("should return zero when equal", () => {
      const a: EvaluationMetrics = {
        accuracy: 0.8,
        cost: 0.02,
        latency: 150,
        composite: 0.75,
      };

      const b: EvaluationMetrics = {
        accuracy: 0.8,
        cost: 0.02,
        latency: 150,
        composite: 0.75,
      };

      const result = compareMetrics(a, b);
      expect(result).toBe(0);
    });
  });

  describe("rankCandidates", () => {
    it("should rank candidates by composite score (AC3)", () => {
      const candidates = [
        {
          designId: "design-1",
          name: "Design A",
          metrics: {
            accuracy: 0.9,
            cost: 0.01,
            latency: 100,
            composite: 0.85,
          } as EvaluationMetrics,
        },
        {
          designId: "design-2",
          name: "Design B",
          metrics: {
            accuracy: 0.7,
            cost: 0.05,
            latency: 200,
            composite: 0.65,
          } as EvaluationMetrics,
        },
        {
          designId: "design-3",
          name: "Design C",
          metrics: {
            accuracy: 0.95,
            cost: 0.001,
            latency: 50,
            composite: 0.92,
          } as EvaluationMetrics,
        },
      ];

      const ranked = rankCandidates(candidates);

      expect(ranked).toHaveLength(3);
      expect(ranked[0]?.rank).toBe(1);
      expect(ranked[0]?.designId).toBe("design-3");
      expect(ranked[1]?.rank).toBe(2);
      expect(ranked[1]?.designId).toBe("design-1");
      expect(ranked[2]?.rank).toBe(3);
      expect(ranked[2]?.designId).toBe("design-2");
    });

    it("should use custom weights for ranking", () => {
      const candidates = [
        {
          designId: "design-1",
          name: "Design A",
          metrics: {
            accuracy: 0.8,
            cost: 0.1,
            latency: 100,
            composite: 0.7,
          } as EvaluationMetrics,
        },
        {
          designId: "design-2",
          name: "Design B",
          metrics: {
            accuracy: 0.6,
            cost: 0.001,
            latency: 50,
            composite: 0.75,
          } as EvaluationMetrics,
        },
      ];

      const weights = {
        accuracyWeight: 0.8,
        costWeight: 0.1,
        latencyWeight: 0.1,
      };

      const ranked = rankCandidates(candidates, weights);

      expect(ranked[0]?.designId).toBe("design-1");
    });

    it("should handle empty candidates", () => {
      const ranked = rankCandidates([]);
      expect(ranked).toHaveLength(0);
    });
  });

  describe("meetsThresholds", () => {
    it("should pass when all thresholds met", () => {
      const metrics: EvaluationMetrics = {
        accuracy: 0.8,
        cost: 0.01,
        latency: 100,
        composite: 0.75,
      };

      const config: DomainConfig = {
        domainId: "test",
        name: "Test Domain",
        minAccuracy: 0.7,
        maxCost: 0.02,
        maxLatency: 150,
      };

      expect(meetsThresholds(metrics, config)).toBe(true);
    });

    it("should fail when accuracy below threshold", () => {
      const metrics: EvaluationMetrics = {
        accuracy: 0.5,
        cost: 0.01,
        latency: 100,
        composite: 0.5,
      };

      const config: DomainConfig = {
        domainId: "test",
        name: "Test Domain",
        minAccuracy: 0.7,
      };

      expect(meetsThresholds(metrics, config)).toBe(false);
    });

    it("should fail when cost above threshold", () => {
      const metrics: EvaluationMetrics = {
        accuracy: 0.8,
        cost: 0.05,
        latency: 100,
        composite: 0.6,
      };

      const config: DomainConfig = {
        domainId: "test",
        name: "Test Domain",
        maxCost: 0.02,
      };

      expect(meetsThresholds(metrics, config)).toBe(false);
    });

    it("should fail when latency above threshold", () => {
      const metrics: EvaluationMetrics = {
        accuracy: 0.8,
        cost: 0.01,
        latency: 500,
        composite: 0.5,
      };

      const config: DomainConfig = {
        domainId: "test",
        name: "Test Domain",
        maxLatency: 200,
      };

      expect(meetsThresholds(metrics, config)).toBe(false);
    });

    it("should pass when no thresholds defined", () => {
      const metrics: EvaluationMetrics = {
        accuracy: 0.5,
        cost: 10,
        latency: 10000,
        composite: 0.1,
      };

      const config: DomainConfig = {
        domainId: "test",
        name: "Test Domain",
      };

      expect(meetsThresholds(metrics, config)).toBe(true);
    });
  });

  describe("aggregateMetrics", () => {
    it("should aggregate multiple evaluations", () => {
      const evaluations: EvaluationMetrics[] = [
        { accuracy: 0.8, cost: 0.01, latency: 100, composite: 0.75 },
        { accuracy: 0.9, cost: 0.02, latency: 150, composite: 0.8 },
        { accuracy: 0.7, cost: 0.015, latency: 120, composite: 0.65 },
      ];

      const aggregated = aggregateMetrics(evaluations);

      expect(aggregated.accuracy).toBeCloseTo(0.8, 1);
      expect(aggregated.cost).toBeCloseTo(0.015, 4);
      expect(aggregated.latency).toBeCloseTo(123, 0);
      expect(aggregated.composite).toBeGreaterThan(0);
    });

    it("should handle empty evaluations", () => {
      const aggregated = aggregateMetrics([]);

      expect(aggregated.accuracy).toBe(0);
      expect(aggregated.cost).toBe(0);
      expect(aggregated.latency).toBe(0);
      expect(aggregated.composite).toBe(0);
    });

    it("should handle single evaluation", () => {
      const evaluations: EvaluationMetrics[] = [
        { accuracy: 0.85, cost: 0.02, latency: 120, composite: 0.75 },
      ];

      const aggregated = aggregateMetrics(evaluations);

      expect(aggregated.accuracy).toBe(0.85);
      expect(aggregated.cost).toBe(0.02);
      expect(aggregated.latency).toBe(120);
    });
  });
});