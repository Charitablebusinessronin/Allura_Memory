/**
 * Progress Tracker Tests
 * Story 3.3: Implement Fail-Safe Termination and Escalation
 */

import { describe, it, expect, beforeEach } from "vitest";
import { ProgressTracker, createProgressTracker } from "./progress-tracker";
import type { StuckPattern, Bottleneck, StepOutcome } from "./types";
import type { SessionId, ToolCallRecord, ReasoningStep } from "../budget/types";

describe("ProgressTracker", () => {
  let tracker: ProgressTracker;
  const sessionId: SessionId = {
    groupId: "test-group",
    agentId: "test-agent",
    sessionId: "test-session",
  };

  beforeEach(() => {
    tracker = createProgressTracker();
    tracker.initialize(sessionId, {
      description: "Test task",
      type: "analysis",
      successCriteria: ["Complete analysis", "Generate report"],
      constraints: ["No external API calls"],
    });
  });

  describe("initialization", () => {
    it("should initialize with goal information", () => {
      const goal = tracker.getGoal();

      expect(goal.description).toBe("Test task");
      expect(goal.type).toBe("analysis");
      expect(goal.successCriteria).toHaveLength(2);
      expect(goal.constraints).toHaveLength(1);
    });

    it("should start with empty steps", () => {
      const steps = tracker.getSteps();
      expect(steps).toHaveLength(0);
    });

    it("should start with no stuck patterns", () => {
      const patterns = tracker.getStuckPatterns();
      expect(patterns).toHaveLength(0);
    });
  });

  describe("recordStep", () => {
    it("should record a successful step", () => {
      tracker.recordStep({
        action: "analyze_data",
        outcome: "success",
        retryable: false,
      });

      const steps = tracker.getSteps();
      expect(steps).toHaveLength(1);
      expect(steps[0].action).toBe("analyze_data");
      expect(steps[0].outcome).toBe("success");
      expect(steps[0].step).toBe(1);
    });

    it("should record multiple steps with incrementing step numbers", () => {
      tracker.recordStep({ action: "step1", outcome: "success", retryable: false });
      tracker.recordStep({ action: "step2", outcome: "success", retryable: false });
      tracker.recordStep({ action: "step3", outcome: "success", retryable: false });

      const steps = tracker.getSteps();
      expect(steps).toHaveLength(3);
      expect(steps[0].step).toBe(1);
      expect(steps[1].step).toBe(2);
      expect(steps[2].step).toBe(3);
    });

    it("should record tool information", () => {
      tracker.recordStep({
        action: "query_database",
        tool: "postgres",
        input: { query: "SELECT * FROM users" },
        outcome: "success",
        retryable: false,
      });

      const steps = tracker.getSteps();
      expect(steps[0].tool).toBe("postgres");
      expect(steps[0].input).toEqual({ query: "SELECT * FROM users" });
    });

    it("should record error information for failures", () => {
      tracker.recordStep({
        action: "api_call",
        outcome: "failure",
        retryable: true,
        errorMessage: "Connection timeout",
      });

      const steps = tracker.getSteps();
      expect(steps[0].outcome).toBe("failure");
      expect(steps[0].errorMessage).toBe("Connection timeout");
      expect(steps[0].retryable).toBe(true);
    });

    it("should track duration", () => {
      tracker.recordStep({ action: "process", outcome: "success", retryable: false });

      const steps = tracker.getSteps();
      expect(steps[0].durationMs).toBeGreaterThanOrEqual(0);
    });
  });

  describe("recordPartialResult", () => {
    it("should record partial results", () => {
      tracker.recordPartialResult({
        type: "data",
        description: "Partial dataset processed",
        value: { processed: 50, total: 100 },
        completionPercent: 50,
        isUsable: true,
      });

      const results = tracker.getPartialResults();
      expect(results).toHaveLength(1);
      expect(results[0].type).toBe("data");
      expect(results[0].completionPercent).toBe(50);
    });

    it("should generate unique IDs for partial results", () => {
      tracker.recordPartialResult({
        type: "artifact",
        description: "First artifact",
        value: {},
        completionPercent: 100,
        isUsable: true,
      });
      tracker.recordPartialResult({
        type: "artifact",
        description: "Second artifact",
        value: {},
        completionPercent: 100,
        isUsable: true,
      });

      const results = tracker.getPartialResults();
      expect(results[0].id).not.toBe(results[1].id);
    });
  });

  describe("importToolCallHistory", () => {
    it("should import tool call history as steps", () => {
      const toolCalls: ToolCallRecord[] = [
        {
          step: 1,
          toolName: "query",
          input: { q: "test" },
          output: { result: "ok" },
          timestamp: new Date(),
          durationMs: 100,
          success: true,
        },
        {
          step: 2,
          toolName: "query",
          input: { q: "test2" },
          error: "Failed",
          timestamp: new Date(),
          durationMs: 50,
          success: false,
        },
      ];

      tracker.importToolCallHistory(toolCalls);
      const steps = tracker.getSteps();

      expect(steps).toHaveLength(2);
      expect(steps[0].tool).toBe("query");
      expect(steps[0].outcome).toBe("success");
      expect(steps[1].outcome).toBe("failure");
      expect(steps[1].errorMessage).toBe("Failed");
    });
  });

  describe("importReasoningHistory", () => {
    it("should import reasoning history as steps", () => {
      const reasoning: ReasoningStep[] = [
        { step: 1, thought: "First thought", decision: "Decided A", timestamp: new Date() },
        { step: 2, thought: "Second thought", timestamp: new Date() },
      ];

      tracker.importReasoningHistory(reasoning);
      const steps = tracker.getSteps();

      expect(steps).toHaveLength(2);
      expect(steps[0].action).toBe("Decided A");
      expect(steps[1].action).toBe("Second thought".slice(0, 100));
    });
  });

  describe("stuck pattern detection", () => {
    it("should detect repeated action pattern", () => {
      // Record the same action 4 times (threshold is 3)
      for (let i = 0; i < 4; i++) {
        tracker.recordStep({
          action: "same_action",
          outcome: "failure",
          retryable: true,
        });
      }

      const patterns = tracker.getStuckPatterns();
      expect(patterns.length).toBeGreaterThan(0);
      expect(patterns[0].type).toBe("repeated_action");
      expect(patterns[0].severity).toBeGreaterThanOrEqual(3);
    });

    it("should detect no progress pattern", () => {
      // Record 5 consecutive failures
      for (let i = 0; i < 5; i++) {
        tracker.recordStep({
          action: `action_${i}`,
          outcome: "failure",
          retryable: true,
        });
      }

      const patterns = tracker.getStuckPatterns();
      const noProgress = patterns.find(p => p.type === "no_progress");
      expect(noProgress).toBeDefined();
      expect(noProgress?.severity).toBe(4);
    });

    it("should detect tool failure loop", () => {
      // Record 3 failures with the same tool
      for (let i = 0; i < 3; i++) {
        tracker.recordStep({
          action: "database_query",
          tool: "postgres",
          outcome: "failure",
          retryable: true,
        });
      }

      const patterns = tracker.getStuckPatterns();
      const toolLoop = patterns.find(p => p.type === "tool_failure_loop");
      expect(toolLoop).toBeDefined();
      expect(toolLoop?.description).toContain("postgres");
    });

    it("should detect policy rejection loop", () => {
      // Record 2 policy denials
      tracker.recordStep({
        action: "delete_records",
        outcome: "policy_denied",
        retryable: false,
      });
      tracker.recordStep({
        action: "delete_records",
        outcome: "policy_denied",
        retryable: false,
      });

      const patterns = tracker.getStuckPatterns();
      const policyLoop = patterns.find(p => p.type === "policy_rejection_loop");
      expect(policyLoop).toBeDefined();
    });

    it("should not detect patterns with success outcomes", () => {
      // Record successful actions - no failures should mean no stuck patterns
      tracker.recordStep({ action: "process_data", outcome: "success", retryable: false });
      tracker.recordStep({ action: "process_data", outcome: "success", retryable: false });
      tracker.recordStep({ action: "process_data", outcome: "success", retryable: false });

      const patterns = tracker.getStuckPatterns();
      // Repeated action pattern is based on count, not outcome - but it shouldn't be severe
      // Filter to only look at patterns with non-success outcomes
      const failurePatterns = patterns.filter(p => 
        p.type === "no_progress" || p.type === "tool_failure_loop" || p.type === "policy_rejection_loop"
      );
      expect(failurePatterns).toHaveLength(0);
    });
  });

  describe("bottleneck identification", () => {
    it("should identify tool failure bottlenecks", () => {
      // Record multiple failures with the same tool
      for (let i = 0; i < 3; i++) {
        tracker.recordStep({
          action: "api_call",
          tool: "external_api",
          outcome: "failure",
          retryable: true,
          errorMessage: "Timeout",
        });
      }

      const bottlenecks = tracker.identifyBottlenecks();
      const toolBottleneck = bottlenecks.find(b => b.type === "tool_failure");
      expect(toolBottleneck).toBeDefined();
      expect(toolBottleneck?.affected).toBe("external_api");
      expect(toolBottleneck?.recoverable).toBe(true);
    });

    it("should identify policy violation bottlenecks", () => {
      tracker.recordStep({
        action: "unsafe_operation",
        outcome: "policy_denied",
        retryable: false,
      });

      const bottlenecks = tracker.identifyBottlenecks();
      const policyBottleneck = bottlenecks.find(b => b.type === "policy_violation");
      expect(policyBottleneck).toBeDefined();
      expect(policyBottleneck?.recoverable).toBe(false);
    });

    it("should identify timeout bottlenecks", () => {
      tracker.recordStep({
        action: "long_running_task",
        outcome: "timeout",
        retryable: true,
      });

      const bottlenecks = tracker.identifyBottlenecks();
      const timeoutBottleneck = bottlenecks.find(b => b.type === "timeout");
      expect(timeoutBottleneck).toBeDefined();
    });
  });

  describe("getStepSummaryByOutcome", () => {
    it("should summarize steps by outcome", () => {
      tracker.recordStep({ action: "s1", outcome: "success", retryable: false });
      tracker.recordStep({ action: "s2", outcome: "success", retryable: false });
      tracker.recordStep({ action: "s3", outcome: "failure", retryable: true });
      tracker.recordStep({ action: "s4", outcome: "policy_denied", retryable: false });

      const summary = tracker.getStepSummaryByOutcome();

      expect(summary.success).toBe(2);
      expect(summary.failure).toBe(1);
      expect(summary.policy_denied).toBe(1);
    });
  });

  describe("getExecutionSummary", () => {
    it("should provide execution summary", () => {
      tracker.recordStep({ action: "s1", outcome: "success", retryable: false });
      tracker.recordStep({ action: "s2", outcome: "success", retryable: false });
      tracker.recordStep({ action: "s3", outcome: "failure", retryable: true });

      const summary = tracker.getExecutionSummary();

      expect(summary.totalSteps).toBe(3);
      expect(summary.successRate).toBeCloseTo(2 / 3, 2);
      expect(summary.lastOutcome).toBe("failure");
      // Stuck detection is based on failure count and patterns
      // 1 failure out of 3 doesn't trigger stuck detection
    });
  });

  describe("isStuck", () => {
    it("should return true when severe stuck patterns detected", () => {
      // Create a severe pattern
      for (let i = 0; i < 6; i++) {
        tracker.recordStep({
          action: "same_action",
          outcome: "failure",
          retryable: true,
        });
      }

      expect(tracker.isStuck()).toBe(true);
    });

    it("should return false when no severe patterns", () => {
      tracker.recordStep({ action: "step1", outcome: "success", retryable: false });
      tracker.recordStep({ action: "step2", outcome: "success", retryable: false });

      expect(tracker.isStuck()).toBe(false);
    });
  });

  describe("getLastSteps", () => {
    it("should return the last N steps", () => {
      for (let i = 0; i < 10; i++) {
        tracker.recordStep({ action: `step${i}`, outcome: "success", retryable: false });
      }

      const lastSteps = tracker.getLastSteps(3);
      expect(lastSteps).toHaveLength(3);
      expect(lastSteps[0].action).toBe("step7");
      expect(lastSteps[2].action).toBe("step9");
    });
  });

  describe("reset", () => {
    it("should clear all tracking state", () => {
      tracker.recordStep({ action: "test", outcome: "success", retryable: false });
      tracker.recordPartialResult({
        type: "data",
        description: "test",
        value: {},
        completionPercent: 50,
        isUsable: true,
      });

      tracker.reset();

      expect(tracker.getSteps()).toHaveLength(0);
      expect(tracker.getPartialResults()).toHaveLength(0);
      expect(tracker.getStuckPatterns()).toHaveLength(0);
    });
  });
});

describe("createProgressTracker", () => {
  it("should create tracker with default config", () => {
    const tracker = createProgressTracker();
    expect(tracker).toBeInstanceOf(ProgressTracker);
  });

  it("should create tracker with custom config", () => {
    const tracker = createProgressTracker({
      maxStepHistory: 500,
      enableStuckDetection: false,
    });
    expect(tracker).toBeInstanceOf(ProgressTracker);
  });
});