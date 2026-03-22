/**
 * Budget Types Tests
 * Story 3.2: Test budget type definitions and helpers
 */

import { describe, it, expect } from "vitest";
import {
  DEFAULT_BUDGET_LIMITS,
  DEFAULT_BUDGET_CONFIG,
  estimateCost,
  calculateUtilization,
  isThresholdBreached,
  createEmptyConsumption,
  createSessionState,
} from "./types";
import type { TokenUsage, LLMPricing, BudgetLimits, SessionId } from "./types";

describe("Budget Types", () => {
  describe("DEFAULT_BUDGET_LIMITS", () => {
    it("should have sensible default values", () => {
      expect(DEFAULT_BUDGET_LIMITS.maxTokens).toBe(100000);
      expect(DEFAULT_BUDGET_LIMITS.maxToolCalls).toBe(100);
      expect(DEFAULT_BUDGET_LIMITS.maxTimeMs).toBe(300000);
      expect(DEFAULT_BUDGET_LIMITS.maxCostUsd).toBe(10.0);
      expect(DEFAULT_BUDGET_LIMITS.maxSteps).toBe(50);
    });
  });

  describe("DEFAULT_BUDGET_CONFIG", () => {
    it("should have warning thresholds at 80% and 90%", () => {
      expect(DEFAULT_BUDGET_CONFIG.warningThresholds.warning80).toBe(0.8);
      expect(DEFAULT_BUDGET_CONFIG.warningThresholds.warning90).toBe(0.9);
    });

    it("should have pricing for common models", () => {
      const models = DEFAULT_BUDGET_CONFIG.pricing.map((p) => p.model);
      expect(models).toContain("gpt-4o");
      expect(models).toContain("claude-3-5-sonnet-20241022");
    });

    it("should enable warnings and halt on breach by default", () => {
      expect(DEFAULT_BUDGET_CONFIG.enableWarnings).toBe(true);
      expect(DEFAULT_BUDGET_CONFIG.haltOnBreach).toBe(true);
    });
  });

  describe("estimateCost", () => {
    const pricing: LLMPricing[] = [
      { model: "gpt-4o", inputCostPer1k: 0.0025, outputCostPer1k: 0.01 },
      { model: "gpt-4o-mini", inputCostPer1k: 0.00015, outputCostPer1k: 0.0006 },
    ];

    it("should calculate cost for token usage", () => {
      const usage: TokenUsage = {
        inputTokens: 1000,
        outputTokens: 500,
        model: "gpt-4o",
      };

      const cost = estimateCost(usage, pricing);
      // (1000/1000 * 0.0025) + (500/1000 * 0.01) = 0.0025 + 0.005 = 0.0075
      expect(cost).toBeCloseTo(0.0075, 6);
    });

    it("should return 0 for unknown models", () => {
      const usage: TokenUsage = {
        inputTokens: 1000,
        outputTokens: 500,
        model: "unknown-model",
      };

      const cost = estimateCost(usage, pricing);
      expect(cost).toBe(0);
    });

    it("should handle zero token usage", () => {
      const usage: TokenUsage = {
        inputTokens: 0,
        outputTokens: 0,
        model: "gpt-4o",
      };

      const cost = estimateCost(usage, pricing);
      expect(cost).toBe(0);
    });
  });

  describe("calculateUtilization", () => {
    it("should calculate utilization percentage", () => {
      expect(calculateUtilization(50, 100)).toBe(50);
      expect(calculateUtilization(75, 100)).toBe(75);
      expect(calculateUtilization(150, 100)).toBe(100); // capped at 100
    });

    it("should handle zero limit", () => {
      expect(calculateUtilization(50, 0)).toBe(0);
    });

    it("should handle zero consumed", () => {
      expect(calculateUtilization(0, 100)).toBe(0);
    });
  });

  describe("isThresholdBreached", () => {
    it("should detect threshold breach", () => {
      // 80 out of 100 is 80% - exactly at threshold
      expect(isThresholdBreached(80, 100, 0.8)).toBe(true);
      // 81 out of 100 is 81% - above threshold
      expect(isThresholdBreached(81, 100, 0.8)).toBe(true);
      // 79 out of 100 is 79% - below threshold
      expect(isThresholdBreached(79, 100, 0.8)).toBe(false);
    });

    it("should handle 90% threshold", () => {
      expect(isThresholdBreached(90, 100, 0.9)).toBe(true);
      expect(isThresholdBreached(91, 100, 0.9)).toBe(true);
      expect(isThresholdBreached(89, 100, 0.9)).toBe(false);
    });
  });

  describe("createEmptyConsumption", () => {
    it("should create zero consumption", () => {
      const consumption = createEmptyConsumption();
      expect(consumption.tokens).toBe(0);
      expect(consumption.toolCalls).toBe(0);
      expect(consumption.timeMs).toBe(0);
      expect(consumption.costUsd).toBe(0);
      expect(consumption.steps).toBe(0);
    });
  });

  describe("createSessionState", () => {
    const sessionId: SessionId = {
      groupId: "test-group",
      agentId: "test-agent",
      sessionId: "test-session",
    };

    it("should create session state with defaults", () => {
      const state = createSessionState(sessionId);
      expect(state.id).toBe(sessionId);
      expect(state.startedAt).toBeInstanceOf(Date);
      expect(state.currentStep).toBe(0);
      expect(state.toolCallHistory).toEqual([]);
      expect(state.reasoningHistory).toEqual([]);
      expect(state.metadata).toEqual({});
    });

    it("should create session state with custom limits", () => {
      const limits: BudgetLimits = {
        maxTokens: 50000,
        maxToolCalls: 50,
        maxTimeMs: 60000,
        maxCostUsd: 5.0,
        maxSteps: 25,
      };

      const state = createSessionState(sessionId, limits);
      expect(state.budgetStatus.limits).toEqual(limits);
    });

    it("should initialize consumption to zero", () => {
      const state = createSessionState(sessionId);
      expect(state.budgetStatus.consumption.tokens).toBe(0);
      expect(state.budgetStatus.utilization.tokens).toBe(0);
    });

    it("should initialize warnings to false", () => {
      const state = createSessionState(sessionId);
      expect(state.budgetStatus.warnings.tokens.warning80).toBe(false);
      expect(state.budgetStatus.warnings.tokens.warning90).toBe(false);
      expect(state.budgetStatus.warnings.steps.warning80).toBe(false);
    });
  });
});