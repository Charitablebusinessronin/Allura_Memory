/**
 * State Capture Tests
 * Story 3.2: Test forensic state preservation
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import { StateCapture, createStateCapture } from "./state-capture";
import type { SessionId, SessionState, HaltReason } from "./types";
import { createSessionState, DEFAULT_BUDGET_LIMITS } from "./types";

// Mock the postgres connection
vi.mock("../postgres/connection", () => ({
  getPool: vi.fn(() => ({
    query: vi.fn().mockResolvedValue({ rows: [] }),
  })),
}));

describe("StateCapture", () => {
  let capture: StateCapture;
  const sessionId: SessionId = {
    groupId: "test-group",
    agentId: "test-agent",
    sessionId: "session-1",
  };

  beforeEach(() => {
    vi.clearAllMocks();
    capture = createStateCapture({
      enablePersistence: false, // Use in-memory for tests
    });
  });

  describe("captureState", () => {
    it("should capture session state", async () => {
      const state = createSessionState(sessionId);
      state.currentStep = 10;
      state.haltReason = {
        type: "kmax_exceeded",
        currentStep: 10,
        maxSteps: 10,
      };

      const snapshot = await capture.captureState(state);

      expect(snapshot.sessionId).toBe(sessionId);
      expect(snapshot.createdAt).toBeInstanceOf(Date);
      expect(snapshot.haltReason.type).toBe("kmax_exceeded");
      expect(snapshot.groupId).toBe("test-group");
    });

    it("should include budget report", async () => {
      const state = createSessionState(sessionId);
      state.budgetStatus.consumption.tokens = 50000;
      state.budgetStatus.consumption.toolCalls = 20;
      state.toolCallHistory = [
        {
          step: 1,
          toolName: "search_web",
          input: { query: "test" },
          output: { results: [] },
          timestamp: new Date(),
          durationMs: 100,
          success: true,
        },
        {
          step: 2,
          toolName: "read_file",
          input: { path: "/test" },
          timestamp: new Date(),
          durationMs: 50,
          success: false,
        },
      ];

      const snapshot = await capture.captureState(state);

      expect(snapshot.budgetReport.tokens.total).toBe(50000);
      expect(snapshot.budgetReport.toolCalls.total).toBe(20);
      expect(snapshot.budgetReport.toolCalls.byTool["search_web"]).toBe(1);
      expect(snapshot.budgetReport.toolCalls.byTool["read_file"]).toBe(1);
      expect(snapshot.budgetReport.toolCalls.successRate).toBe(0.5);
    });

    it("should serialize state to JSON", async () => {
      const state = createSessionState(sessionId);
      state.currentStep = 5;
      state.metadata = { testKey: "testValue" };

      const snapshot = await capture.captureState(state);

      expect(snapshot.stateJson).toContain("test-group");
      expect(snapshot.stateJson).toContain("test-agent");
      expect(snapshot.stateJson).toContain("session-1");
    });

    it("should handle halt reasons correctly", async () => {
      const state = createSessionState(sessionId);

      // Token limit
      state.haltReason = { type: "token_limit", consumed: 100000, limit: 100000 };
      let snapshot = await capture.captureState(state);
      expect(snapshot.haltReason.type).toBe("token_limit");

      // Tool call limit
      state.haltReason = { type: "tool_call_limit", consumed: 100, limit: 100 };
      snapshot = await capture.captureState(state);
      expect(snapshot.haltReason.type).toBe("tool_call_limit");

      // Time limit
      state.haltReason = { type: "time_limit", elapsedMs: 300000, limitMs: 300000 };
      snapshot = await capture.captureState(state);
      expect(snapshot.haltReason.type).toBe("time_limit");

      // Cost limit
      state.haltReason = { type: "cost_limit", consumedUsd: 10.0, limitUsd: 10.0 };
      snapshot = await capture.captureState(state);
      expect(snapshot.haltReason.type).toBe("cost_limit");

      // Critical error
      state.haltReason = { type: "critical_error", error: "Something went wrong" };
      snapshot = await capture.captureState(state);
      expect(snapshot.haltReason.type).toBe("critical_error");
    });
  });

  describe("getSnapshot", () => {
    it("should retrieve captured snapshot", async () => {
      const state = createSessionState(sessionId);
      state.currentStep = 15;

      await capture.captureState(state);
      const retrieved = await capture.getSnapshot(sessionId);

      expect(retrieved).not.toBeNull();
      expect(retrieved?.sessionId).toBe(sessionId);
    });

    it("should return null for non-existent snapshot", async () => {
      const nonExistent: SessionId = {
        groupId: "no-group",
        agentId: "no-agent",
        sessionId: "no-session",
      };

      const retrieved = await capture.getSnapshot(nonExistent);
      expect(retrieved).toBeNull();
    });
  });

  describe("listSnapshots", () => {
    it("should list snapshots by group", async () => {
      const session1: SessionId = {
        groupId: "group-a",
        agentId: "agent-1",
        sessionId: "session-1",
      };
      const session2: SessionId = {
        groupId: "group-a",
        agentId: "agent-2",
        sessionId: "session-2",
      };
      const session3: SessionId = {
        groupId: "group-b",
        agentId: "agent-3",
        sessionId: "session-3",
      };

      const state1 = createSessionState(session1);
      const state2 = createSessionState(session2);
      const state3 = createSessionState(session3);

      await capture.captureState(state1);
      await capture.captureState(state2);
      await capture.captureState(state3);

      const groupASnapshots = await capture.listSnapshots("group-a");
      expect(groupASnapshots.length).toBe(2);

      const groupBSnapshots = await capture.listSnapshots("group-b");
      expect(groupBSnapshots.length).toBe(1);
    });

    it("should respect limit parameter", async () => {
      for (let i = 0; i < 10; i++) {
        const sid: SessionId = {
          groupId: "group-limit-test",
          agentId: `agent-${i}`,
          sessionId: `session-${i}`,
        };
        const state = createSessionState(sid);
        await capture.captureState(state);
      }

      const snapshots = await capture.listSnapshots("group-limit-test", 5);
      expect(snapshots.length).toBe(5);
    });
  });

  describe("createBudgetReport", () => {
    it("should calculate token utilization", () => {
      const state = createSessionState(sessionId, DEFAULT_BUDGET_LIMITS);
      state.budgetStatus.consumption.tokens = 50000;

      const report = capture.createBudgetReport(state);

      expect(report.tokens.total).toBe(50000);
      expect(report.tokens.percentUtilized).toBe(50);
    });

    it("should calculate tool call success rate", () => {
      const state = createSessionState(sessionId);
      state.budgetStatus.consumption.toolCalls = 3;
      state.toolCallHistory = [
        {
          step: 1,
          toolName: "tool1",
          input: {},
          timestamp: new Date(),
          durationMs: 100,
          success: true,
        },
        {
          step: 2,
          toolName: "tool2",
          input: {},
          timestamp: new Date(),
          durationMs: 100,
          success: false,
        },
        {
          step: 3,
          toolName: "tool1",
          input: {},
          timestamp: new Date(),
          durationMs: 100,
          success: true,
        },
      ];

      const report = capture.createBudgetReport(state);

      expect(report.toolCalls.total).toBe(3);
      expect(report.toolCalls.byTool["tool1"]).toBe(2);
      expect(report.toolCalls.byTool["tool2"]).toBe(1);
      expect(report.toolCalls.successRate).toBeCloseTo(0.667, 2);
    });

    it("should calculate time breakdown", () => {
      const state = createSessionState(sessionId);
      state.toolCallHistory = [
        {
          step: 1,
          toolName: "search",
          input: {},
          timestamp: new Date(),
          durationMs: 100,
          success: true,
        },
        {
          step: 2,
          toolName: "search",
          input: {},
          timestamp: new Date(),
          durationMs: 150,
          success: true,
        },
      ];

      const report = capture.createBudgetReport(state);

      expect(report.time.breakdownByPhase["tool_search"]).toBe(250);
    });
  });

  describe("generateSummary", () => {
    it("should generate summary without halt", () => {
      const state = createSessionState(sessionId);
      state.currentStep = 25;
      state.budgetStatus.consumption.tokens = 50000;
      state.budgetStatus.consumption.toolCalls = 10;
      state.budgetStatus.utilization.tokens = 50;
      state.budgetStatus.utilization.toolCalls = 10;

      const summary = capture.generateSummary(state);

      expect(summary).toContain("session-1");
      expect(summary).toContain("Steps: 25");
      expect(summary).toContain("Tokens: 50000");
    });

    it("should include halt reason in summary", () => {
      const state = createSessionState(sessionId);
      state.haltReason = {
        type: "kmax_exceeded",
        currentStep: 50,
        maxSteps: 50,
      };

      const summary = capture.generateSummary(state);

      expect(summary).toContain("Halt Reason: kmax_exceeded");
      expect(summary).toContain("Max Steps: 50");
    });

    it("should include last error in summary", () => {
      const state = createSessionState(sessionId);
      state.currentStep = 10;
      state.lastError = {
        step: 10,
        message: "Test error",
        stack: "Error: Test error\n    at test.js:1",
        timestamp: new Date(),
        recoverable: false,
      };

      const summary = capture.generateSummary(state);

      expect(summary).toContain("Last Error (Step 10):");
      expect(summary).toContain("Test error");
    });

    it("should include last tool calls in summary", () => {
      const state = createSessionState(sessionId);
      for (let i = 0; i < 10; i++) {
        state.toolCallHistory.push({
          step: i,
          toolName: `tool-${i}`,
          input: {},
          timestamp: new Date(),
          durationMs: 100 * i,
          success: i % 2 === 0,
        });
      }

      const summary = capture.generateSummary(state);

      expect(summary).toContain("Last 5 Tool Calls:");
    });

    it("should include last reasoning steps in summary", () => {
      const state = createSessionState(sessionId);
      for (let i = 0; i < 5; i++) {
        state.reasoningHistory.push({
          step: i,
          thought: `Thinking about step ${i}`,
          timestamp: new Date(),
        });
      }

      const summary = capture.generateSummary(state);

      expect(summary).toContain("Last 3 Reasoning Steps:");
    });
  });

  describe("persistence disabled", () => {
    it("should store in memory when persistence disabled", async () => {
      const memCapture = createStateCapture({
        enablePersistence: false,
      });

      const state = createSessionState(sessionId);
      await memCapture.captureState(state);

      const retrieved = await memCapture.getSnapshot(sessionId);
      expect(retrieved).not.toBeNull();
    });
  });
});