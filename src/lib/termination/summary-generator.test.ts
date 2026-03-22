/**
 * Summary Generator Tests
 * Story 3.3: Implement Fail-Safe Termination and Escalation
 */

import { describe, it, expect, beforeEach } from "vitest";
import { SummaryGenerator, createSummaryGenerator } from "./summary-generator";
import { ProgressTracker, createProgressTracker } from "./progress-tracker";
import type { HaltReason, SessionState } from "../budget/types";
import { createSessionState, DEFAULT_BUDGET_LIMITS } from "../budget/types";

describe("SummaryGenerator", () => {
  let generator: SummaryGenerator;
  let tracker: ProgressTracker;
  let sessionState: SessionState;
  const sessionId = { groupId: "test-group", agentId: "test-agent", sessionId: "test-session" };

  beforeEach(() => {
    generator = createSummaryGenerator({ enablePersistence: false });
    tracker = createProgressTracker();
    tracker.initialize(sessionId, {
      description: "Analyze data and generate report",
      type: "analysis",
      successCriteria: ["Complete analysis", "Generate report"],
      constraints: ["No external API calls"],
    });
    sessionState = createSessionState(sessionId, DEFAULT_BUDGET_LIMITS);
    sessionState.currentStep = 25;
    sessionState.budgetStatus.consumption = {
      tokens: 50000,
      toolCalls: 30,
      timeMs: 120000,
      costUsd: 2.5,
      steps: 25,
    };
    sessionState.budgetStatus.utilization = {
      tokens: 50,
      toolCalls: 30,
      timeMs: 40,
      costUsd: 25,
      steps: 50,
    };
  });

  const createHaltReason = (type: HaltReason["type"] = "kmax_exceeded"): HaltReason => {
    if (type === "kmax_exceeded") {
      return { type: "kmax_exceeded", currentStep: 25, maxSteps: 50 };
    }
    if (type === "token_limit") {
      return { type: "token_limit", consumed: 50000, limit: 100000 };
    }
    if (type === "policy_violation") {
      return { type: "policy_violation", reason: "Unauthorized API call" };
    }
    if (type === "critical_error") {
      return { type: "critical_error", error: "Database connection failed" };
    }
    return { type: "time_limit", elapsedMs: 120000, limitMs: 300000 };
  };

  describe("generateSummary", () => {
    it("should generate summary with goal information", async () => {
      const haltReason = createHaltReason();
      const summary = await generator.generateSummary(sessionState, haltReason, tracker);

      expect(summary.goal.description).toBe("Analyze data and generate report");
      expect(summary.goal.type).toBe("analysis");
      expect(summary.goal.successCriteria).toHaveLength(2);
      expect(summary.goal.constraints).toHaveLength(1);
    });

    it("should generate summary with progress metrics", async () => {
      const haltReason = createHaltReason();
      const summary = await generator.generateSummary(sessionState, haltReason, tracker);

      expect(summary.progress.stepsCompleted).toBe(25);
      expect(summary.progress.stepBudget).toBe(DEFAULT_BUDGET_LIMITS.maxSteps);
      expect(summary.progress.tokensUsed).toBe(50000);
      expect(summary.progress.percentComplete).toBeGreaterThan(0);
    });

    it("should generate summary with termination details", async () => {
      const haltReason = createHaltReason("kmax_exceeded");
      const summary = await generator.generateSummary(sessionState, haltReason, tracker);

      expect(summary.termination.reason.type).toBe("kmax_exceeded");
      expect(summary.termination.expected).toBe(true);
      expect(summary.termination.resumable).toBe(true);
      expect(summary.termination.explanation).toContain("Exceeded maximum step limit");
    });

    it("should include bottlenecks from tracker", async () => {
      // Add some steps that create bottlenecks
      for (let i = 0; i < 3; i++) {
        tracker.recordStep({
          action: "api_call",
          tool: "external_api",
          outcome: "failure",
          retryable: true,
        });
      }

      const haltReason = createHaltReason();
      const summary = await generator.generateSummary(sessionState, haltReason, tracker);

      expect(summary.bottlenecks.length).toBeGreaterThan(0);
      const toolBottleneck = summary.bottlenecks.find(b => b.type === "tool_failure");
      expect(toolBottleneck).toBeDefined();
    });

    it("should include stuck patterns from tracker", async () => {
      // Create stuck pattern
      for (let i = 0; i < 4; i++) {
        tracker.recordStep({
          action: "same_action",
          outcome: "failure",
          retryable: true,
        });
      }

      const haltReason = createHaltReason();
      const summary = await generator.generateSummary(sessionState, haltReason, tracker);

      expect(summary.stuckPatterns.length).toBeGreaterThan(0);
    });

    it("should include partial results from tracker", async () => {
      tracker.recordPartialResult({
        type: "data",
        description: "Partial analysis result",
        value: { processed: 75 },
        completionPercent: 75,
        isUsable: true,
      });

      const haltReason = createHaltReason();
      const summary = await generator.generateSummary(sessionState, haltReason, tracker);

      expect(summary.partialResults).toHaveLength(1);
      expect(summary.partialResults[0].description).toBe("Partial analysis result");
    });

    it("should generate recommendations", async () => {
      const haltReason = createHaltReason("kmax_exceeded");
      const summary = await generator.generateSummary(sessionState, haltReason, tracker);

      expect(summary.recommendations.length).toBeGreaterThan(0);
      expect(summary.recommendations).toContain("Increase Kmax step limit for complex tasks");
    });

    it("should generate unique summary ID", async () => {
      const haltReason = createHaltReason();
      const summary1 = await generator.generateSummary(sessionState, haltReason, tracker);

      // Reset tracker for new summary
      tracker.reset();
      tracker.initialize(sessionId, { description: "New task", type: "test" });

      const summary2 = await generator.generateSummary(sessionState, haltReason, tracker);

      expect(summary1.id).not.toBe(summary2.id);
    });
  });

  describe("formatSummary", () => {
    it("should generate markdown format", async () => {
      const haltReason = createHaltReason();
      const summary = await generator.generateSummary(sessionState, haltReason, tracker);
      const formatted = generator.formatSummary(summary);

      expect(formatted.markdown).toContain("# Termination Summary");
      expect(formatted.markdown).toContain("## Goal");
      expect(formatted.markdown).toContain("## Progress");
      expect(formatted.markdown).toContain("## Termination");
    });

    it("should generate text format", async () => {
      const haltReason = createHaltReason();
      const summary = await generator.generateSummary(sessionState, haltReason, tracker);
      const formatted = generator.formatSummary(summary);

      expect(formatted.text).toContain("TERMINATION SUMMARY");
      expect(formatted.text).toContain("GOAL:");
      expect(formatted.text).toContain("PROGRESS:");
    });

    it("should generate one-liner summary", async () => {
      const haltReason = createHaltReason("token_limit");
      const summary = await generator.generateSummary(sessionState, haltReason, tracker);
      const formatted = generator.formatSummary(summary);

      expect(formatted.oneLiner).toContain("terminated");
      expect(formatted.oneLiner).toContain("token limit");
    });

    it("should include JSON summary", async () => {
      const haltReason = createHaltReason();
      const summary = await generator.generateSummary(sessionState, haltReason, tracker);
      const formatted = generator.formatSummary(summary);

      expect(formatted.json).toEqual(summary);
    });

    it("should limit text length", async () => {
      const limitedGenerator = createSummaryGenerator({
        enablePersistence: false,
        maxTextLength: 100,
      });

      const haltReason = createHaltReason();
      const summary = await limitedGenerator.generateSummary(sessionState, haltReason, tracker);
      const formatted = limitedGenerator.formatSummary(summary);

      expect(formatted.text.length).toBeLessThanOrEqual(100);
    });
  });

  describe("termination explanations", () => {
    it("should explain Kmax exceeded termination", async () => {
      const haltReason: HaltReason = { type: "kmax_exceeded", currentStep: 50, maxSteps: 50 };
      const summary = await generator.generateSummary(sessionState, haltReason, tracker);

      expect(summary.termination.explanation).toContain("Exceeded maximum step limit");
      expect(summary.termination.expected).toBe(true);
      expect(summary.termination.resumable).toBe(true);
    });

    it("should explain token limit termination", async () => {
      const haltReason: HaltReason = { type: "token_limit", consumed: 100000, limit: 100000 };
      const summary = await generator.generateSummary(sessionState, haltReason, tracker);

      expect(summary.termination.explanation).toContain("Exceeded token budget");
      expect(summary.termination.expected).toBe(true);
      expect(summary.termination.resumable).toBe(true);
    });

    it("should explain policy violation termination", async () => {
      const haltReason: HaltReason = { type: "policy_violation", reason: "Unauthorized API call" };
      const summary = await generator.generateSummary(sessionState, haltReason, tracker);

      expect(summary.termination.explanation).toContain("Policy violation");
      expect(summary.termination.expected).toBe(false);
      expect(summary.termination.resumable).toBe(false);
    });

    it("should explain critical error termination", async () => {
      const haltReason: HaltReason = { type: "critical_error", error: "Database connection failed" };
      const summary = await generator.generateSummary(sessionState, haltReason, tracker);

      expect(summary.termination.explanation).toContain("Critical error");
      expect(summary.termination.expected).toBe(false);
      expect(summary.termination.resumable).toBe(false);
      expect(summary.recommendations).toContain("Investigate error in detail before resuming");
    });
  });

  describe("analyzeBottlenecks", () => {
    it("should identify primary bottleneck", async () => {
      tracker.recordStep({
        action: "policy_violation",
        outcome: "policy_denied",
        retryable: false,
      });

      const haltReason = createHaltReason();
      const summary = await generator.generateSummary(sessionState, haltReason, tracker);
      const analysis = generator.analyzeBottlenecks(summary.bottlenecks);

      if (analysis.primary) {
        expect(analysis.primary.type).toBe("policy_violation");
      }
    });

    it("should calculate severity", async () => {
      // Add multiple different bottlenecks
      for (let i = 0; i < 3; i++) {
        tracker.recordStep({
          action: "query",
          tool: "db",
          outcome: "failure",
          retryable: true,
        });
      }
      tracker.recordStep({
        action: "policy",
        outcome: "policy_denied",
        retryable: false,
      });

      const haltReason = createHaltReason();
      const summary = await generator.generateSummary(sessionState, haltReason, tracker);
      const analysis = generator.analyzeBottlenecks(summary.bottlenecks);

      expect(analysis.severity).toBeGreaterThan(0);
    });
  });

  describe("getSummary (retrieval)", () => {
    it("should retrieve generated summary by ID", async () => {
      const haltReason = createHaltReason();
      const summary = await generator.generateSummary(sessionState, haltReason, tracker);

      const retrieved = await generator.getSummary(summary.id);
      expect(retrieved).not.toBeNull();
      expect(retrieved?.id).toBe(summary.id);
    });

    it("should return null for non-existent summary", async () => {
      const retrieved = await generator.getSummary("non-existent-id");
      expect(retrieved).toBeNull();
    });
  });

  describe("listSummaries", () => {
    it("should list summaries by group", async () => {
      // Create multiple summaries
      const haltReason = createHaltReason();
      await generator.generateSummary(sessionState, haltReason, tracker);

      const summaries = await generator.listSummaries(sessionId.groupId);
      expect(summaries.length).toBeGreaterThanOrEqual(1);
    });
  });
});

describe("createSummaryGenerator", () => {
  it("should create generator with default config", () => {
    const generator = createSummaryGenerator();
    expect(generator).toBeInstanceOf(SummaryGenerator);
  });

  it("should create generator with custom config", () => {
    const generator = createSummaryGenerator({
      summaryTable: "custom_summaries",
      enablePersistence: false,
    });
    expect(generator).toBeInstanceOf(SummaryGenerator);
  });
});

describe("Progress calculations", () => {
  const sessionId = { groupId: "test-group", agentId: "test-agent", sessionId: "test-session" };
  
  const createHaltReason = (type: HaltReason["type"] = "kmax_exceeded"): HaltReason => {
    if (type === "kmax_exceeded") {
      return { type: "kmax_exceeded", currentStep: 25, maxSteps: 50 };
    }
    if (type === "token_limit") {
      return { type: "token_limit", consumed: 95000, limit: 100000 };
    }
    return { type: "time_limit", elapsedMs: 120000, limitMs: 300000 };
  };

  it("should calculate percent complete correctly", async () => {
    const generator = createSummaryGenerator({ enablePersistence: false });
    const tracker = createProgressTracker();
    tracker.initialize(sessionId, { description: "Test", type: "test" });

    const sessionState = createSessionState(sessionId, DEFAULT_BUDGET_LIMITS);
    sessionState.currentStep = 25;
    sessionState.budgetStatus.consumption.steps = 25;
    sessionState.budgetStatus.utilization.steps = 50;

    const haltReason = createHaltReason();
    const summary = await generator.generateSummary(sessionState, haltReason, tracker);

    expect(summary.progress.percentComplete).toBeGreaterThan(0);
    expect(summary.progress.percentComplete).toBeLessThan(100);
  });

  it("should reflect high token utilization", async () => {
    const generator = createSummaryGenerator({ enablePersistence: false });
    const tracker = createProgressTracker();
    tracker.initialize(sessionId, { description: "Test", type: "test" });

    const sessionState = createSessionState(sessionId, DEFAULT_BUDGET_LIMITS);
    sessionState.budgetStatus.consumption.tokens = 95000;
    sessionState.budgetStatus.utilization.tokens = 95;

    const haltReason = createHaltReason("token_limit");
    const summary = await generator.generateSummary(sessionState, haltReason, tracker);

    expect(summary.progress.budgetUtilization.tokens).toBeGreaterThan(90);
  });
});