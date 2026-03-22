/**
 * Budget Monitor Tests
 * Story 3.2: Test real-time budget monitoring
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import { BudgetMonitor, createBudgetMonitor } from "./monitor";
import type { SessionId, TokenUsage, ToolCallRecord, BudgetLimits } from "./types";
import { DEFAULT_BUDGET_LIMITS, DEFAULT_BUDGET_CONFIG } from "./types";

describe("BudgetMonitor", () => {
  let monitor: BudgetMonitor;
  const sessionId: SessionId = {
    groupId: "test-group",
    agentId: "test-agent",
    sessionId: "session-1",
  };

  beforeEach(() => {
    monitor = createBudgetMonitor();
  });

  describe("session management", () => {
    it("should start a new session", () => {
      const state = monitor.startSession(sessionId);
      expect(state.id).toBe(sessionId);
      expect(state.startedAt).toBeInstanceOf(Date);
      expect(state.currentStep).toBe(0);
    });

    it("should throw if session already exists", () => {
      monitor.startSession(sessionId);
      expect(() => monitor.startSession(sessionId)).toThrow("already exists");
    });

    it("should end a session", () => {
      monitor.startSession(sessionId);
      const finalState = monitor.endSession(sessionId);
      expect(finalState).not.toBeNull();
      expect(finalState?.haltedAt).toBeInstanceOf(Date);
      expect(monitor.hasSession(sessionId)).toBe(false);
    });

    it("should return null when ending non-existent session", () => {
      const result = monitor.endSession(sessionId);
      expect(result).toBeNull();
    });

    it("should use custom limits", () => {
      const customLimits: BudgetLimits = {
        maxTokens: 50000,
        maxToolCalls: 25,
        maxTimeMs: 60000,
        maxCostUsd: 5.0,
        maxSteps: 20,
      };

      const state = monitor.startSession(sessionId, customLimits);
      expect(state.budgetStatus.limits).toEqual(customLimits);
    });
  });

  describe("token tracking", () => {
    beforeEach(() => {
      monitor.startSession(sessionId);
    });

    it("should track token usage", () => {
      const usage: TokenUsage = {
        inputTokens: 1000,
        outputTokens: 500,
        model: "gpt-4o",
      };

      const status = monitor.trackTokens(sessionId, usage);
      expect(status.consumption.tokens).toBe(1500);
      expect(status.utilization.tokens).toBeGreaterThan(0);
    });

    it("should accumulate token usage", () => {
      const usage1: TokenUsage = {
        inputTokens: 1000,
        outputTokens: 500,
        model: "gpt-4o",
      };
      const usage2: TokenUsage = {
        inputTokens: 500,
        outputTokens: 250,
        model: "gpt-4o",
      };

      monitor.trackTokens(sessionId, usage1);
      const status = monitor.trackTokens(sessionId, usage2);
      expect(status.consumption.tokens).toBe(2250);
    });

    it("should estimate cost from tokens", () => {
      const usage: TokenUsage = {
        inputTokens: 1000,
        outputTokens: 500,
        model: "gpt-4o",
      };

      const status = monitor.trackTokens(sessionId, usage);
      // gpt-4o: $0.0025/1k input, $0.01/1k output
      // cost = (1000/1000 * 0.0025) + (500/1000 * 0.01) = 0.0075
      expect(status.consumption.costUsd).toBeCloseTo(0.0075, 4);
    });

    it("should throw for non-existent session", () => {
      const usage: TokenUsage = {
        inputTokens: 1000,
        outputTokens: 500,
        model: "gpt-4o",
      };

      expect(() =>
        monitor.trackTokens({ groupId: "x", agentId: "y", sessionId: "z" }, usage),
      ).toThrow("not found");
    });
  });

  describe("tool call tracking", () => {
    beforeEach(() => {
      monitor.startSession(sessionId);
    });

    it("should track tool calls", () => {
      const call: ToolCallRecord = {
        step: 1,
        toolName: "search_web",
        input: { query: "test" },
        output: { results: [] },
        timestamp: new Date(),
        durationMs: 100,
        success: true,
      };

      const status = monitor.trackToolCall(sessionId, call);
      expect(status.consumption.toolCalls).toBe(1);
    });

    it("should accumulate tool calls", () => {
      const call1: ToolCallRecord = {
        step: 1,
        toolName: "search_web",
        input: { query: "test1" },
        timestamp: new Date(),
        durationMs: 100,
        success: true,
      };
      const call2: ToolCallRecord = {
        step: 2,
        toolName: "read_file",
        input: { path: "/test" },
        timestamp: new Date(),
        durationMs: 50,
        success: true,
      };

      monitor.trackToolCall(sessionId, call1);
      const status = monitor.trackToolCall(sessionId, call2);
      expect(status.consumption.toolCalls).toBe(2);
    });

    it("should track tool call breakdown", () => {
      const call: ToolCallRecord = {
        step: 1,
        toolName: "search_web",
        input: { query: "test" },
        timestamp: new Date(),
        durationMs: 100,
        success: true,
      };

      monitor.trackToolCall(sessionId, call);
      const breakdown = monitor.getToolCallBreakdown(sessionId);
      expect(breakdown["search_web"]).toBe(1);
    });

    it("should track time by tool", () => {
      const call: ToolCallRecord = {
        step: 1,
        toolName: "search_web",
        input: { query: "test" },
        timestamp: new Date(),
        durationMs: 100,
        success: true,
      };

      monitor.trackToolCall(sessionId, call);
      const timeBreakdown = monitor.getTimeBreakdown(sessionId);
      expect(timeBreakdown["tool_search_web"]).toBe(100);
    });
  });

  describe("step tracking", () => {
    beforeEach(() => {
      monitor.startSession(sessionId);
    });

    it("should increment step counter", () => {
      const status1 = monitor.incrementStep(sessionId);
      expect(status1.consumption.steps).toBe(1);

      const status2 = monitor.incrementStep(sessionId);
      expect(status2.consumption.steps).toBe(2);
    });

    it("should update utilization", () => {
      for (let i = 0; i < 25; i++) {
        monitor.incrementStep(sessionId);
      }
      const status = monitor.getStatus(sessionId);
      expect(status?.utilization.steps).toBe(50); // 25/50 = 50%
    });
  });

  describe("warning thresholds", () => {
    it("should trigger warning at 80%", () => {
      const onWarning = vi.fn();
      const onBreach = vi.fn();

      const warningMonitor = createBudgetMonitor({
        budgetConfig: DEFAULT_BUDGET_CONFIG,
        onWarning,
        onBreach,
      });

      warningMonitor.startSession(sessionId);

      // Use 80% of tokens
      const usage: TokenUsage = {
        inputTokens: 80000,
        outputTokens: 0,
        model: "gpt-4o",
      };

      warningMonitor.trackTokens(sessionId, usage);
      expect(onWarning).toHaveBeenCalled();
    });

    it("should trigger breach at limit", () => {
      const onWarning = vi.fn();
      const onBreach = vi.fn();

      const breachMonitor = createBudgetMonitor({
        budgetConfig: DEFAULT_BUDGET_CONFIG,
        onWarning,
        onBreach,
      });

      breachMonitor.startSession(sessionId);

      // Use 100% of tokens
      const usage: TokenUsage = {
        inputTokens: 100000,
        outputTokens: 0,
        model: "gpt-4o",
      };

      breachMonitor.trackTokens(sessionId, usage);
      expect(onBreach).toHaveBeenCalled();
    });

    it("should not trigger same warning twice for same threshold", () => {
      const onWarning = vi.fn();
      const warningMonitor = createBudgetMonitor({
        budgetConfig: DEFAULT_BUDGET_CONFIG,
        onWarning,
      });

      warningMonitor.startSession(sessionId);

      // Use exactly 80% of tokens - triggers warning80
      const usage: TokenUsage = {
        inputTokens: 80000,
        outputTokens: 0,
        model: "gpt-4o",
      };

      warningMonitor.trackTokens(sessionId, usage);
      expect(onWarning).toHaveBeenCalledTimes(1);

      // Use more tokens but still below 90% - should NOT trigger another warning
      const usage2: TokenUsage = {
        inputTokens: 5000,
        outputTokens: 0,
        model: "gpt-4o",
      };

      // This should only trigger once for 80% threshold (85% is still same threshold band)
      onWarning.mockClear();
      warningMonitor.trackTokens(sessionId, usage2);
      // Should be 0 calls because we're still in the 80-90% band (85%)
      // but warning80 is already set
      expect(onWarning).toHaveBeenCalledTimes(0);
    });
  });

  describe("reasoning tracking", () => {
    beforeEach(() => {
      monitor.startSession(sessionId);
    });

    it("should add reasoning steps", () => {
      monitor.addReasoningStep(sessionId, "I need to search", "Use search tool");
      monitor.addReasoningStep(sessionId, "Now analyze results");

      const state = monitor.getSessionState(sessionId);
      expect(state?.reasoningHistory.length).toBe(2);
    });

    it("should keep only last 100 reasoning steps", () => {
      for (let i = 0; i < 150; i++) {
        monitor.addReasoningStep(sessionId, `Step ${i}`);
      }

      const state = monitor.getSessionState(sessionId);
      expect(state?.reasoningHistory.length).toBe(100);
    });

    it("should track step number in reasoning", () => {
      monitor.incrementStep(sessionId);
      monitor.addReasoningStep(sessionId, "After step 1");

      monitor.incrementStep(sessionId);
      monitor.addReasoningStep(sessionId, "After step 2");

      const state = monitor.getSessionState(sessionId);
      expect(state?.reasoningHistory[0].step).toBe(1);
      expect(state?.reasoningHistory[1].step).toBe(2);
    });
  });

  describe("error tracking", () => {
    beforeEach(() => {
      monitor.startSession(sessionId);
    });

    it("should record errors", () => {
      const error = new Error("Test error");
      monitor.recordError(sessionId, error, true);

      const state = monitor.getSessionState(sessionId);
      expect(state?.lastError?.message).toBe("Test error");
      expect(state?.lastError?.recoverable).toBe(true);
    });

    it("should track error stack", () => {
      const error = new Error("Test error");
      error.stack = "Error: Test error\n    at test.js:1";
      monitor.recordError(sessionId, error, false);

      const state = monitor.getSessionState(sessionId);
      expect(state?.lastError?.stack).toContain("test.js");
    });
  });

  describe("breach detection", () => {
    it("should detect limit breaches", () => {
      monitor.startSession(sessionId);
      const result = monitor.hasBreachedLimit(sessionId);
      expect(result.breached).toBe(false);
    });

    it("should detect token breach", () => {
      monitor.startSession(sessionId);
      const usage: TokenUsage = {
        inputTokens: 100000,
        outputTokens: 0,
        model: "gpt-4o",
      };
      monitor.trackTokens(sessionId, usage);

      const result = monitor.hasBreachedLimit(sessionId);
      expect(result.breached).toBe(true);
      expect(result.categories).toContain("tokens");
    });

    it("should detect step breach", () => {
      monitor.startSession(sessionId);
      for (let i = 0; i < 50; i++) {
        monitor.incrementStep(sessionId);
      }

      const result = monitor.hasBreachedLimit(sessionId);
      expect(result.breached).toBe(true);
      expect(result.categories).toContain("steps");
    });
  });

  describe("time tracking", () => {
    it("should track elapsed time", async () => {
      vi.useFakeTimers();
      const timeMonitor = createBudgetMonitor({
        budgetConfig: DEFAULT_BUDGET_CONFIG,
        trackTime: true,
        timeUpdateIntervalMs: 100,
      });

      timeMonitor.startSession(sessionId);

      // Advance time by 500ms
      vi.advanceTimersByTime(500);

      const state = timeMonitor.getSessionState(sessionId);
      expect(state?.budgetStatus.consumption.timeMs).toBeGreaterThanOrEqual(500);

      vi.useRealTimers();
    });
  });
});