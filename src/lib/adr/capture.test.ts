/**
 * ADR Capture Tests
 * Story 3.5: Record Five-Layer Agent Decision Records
 * 
 * AC 1: Given an agent completes a reasoning step, when the state is updated,
 *       then the system logs Action, Context, Reasoning, Counterfactuals, and Oversight.
 */

import { describe, it, expect, beforeEach } from "vitest";
import {
  ADRCapture,
  InMemoryADRStorage,
  createADRCapture,
  createInMemoryStorage,
  captureActionFromState,
  captureContextFromState,
} from "./capture";
import type { SessionId } from "../budget/types";
import {
  type ADRCreationOptions,
  type ActionType,
  type ActionResult,
  type ToolCallRecord,
  type GoalContext,
  type ConstraintContext,
  type OptionContext,
  type BudgetSnapshot,
  createDefaultReproducibilityInfo,
} from "./types";

describe("ADR Capture", () => {
  let storage: InMemoryADRStorage;
  let capture: ADRCapture;
  const testSessionId: SessionId = {
    groupId: "test-group",
    agentId: "test-agent",
    sessionId: "test-session",
  };

  beforeEach(() => {
    storage = createInMemoryStorage();
    capture = createADRCapture(storage);
  });

  describe("beginDecision", () => {
    it("should create a new ADR with all five layers initialized", async () => {
      const options: ADRCreationOptions = {
        groupId: "group-1",
        sessionId: testSessionId,
        actionType: "tool_invocation",
        reproducibility: createDefaultReproducibilityInfo(),
      };

      const adrId = await capture.beginDecision(options);

      expect(adrId).toBeDefined();
      expect(adrId).toMatch(/^adr_/);

      const adr = capture.getCurrentADR();
      expect(adr).not.toBeNull();
      expect(adr!.groupId).toBe("group-1");
      expect(adr!.sessionId).toEqual(testSessionId);
      expect(adr!.lifecycle).toBe("created");
    });

    it("should include reproducibility info (AC2)", async () => {
      const reproducibility = createDefaultReproducibilityInfo();
      reproducibility.model = {
        provider: "openai",
        modelId: "gpt-4",
        modelVersion: "2024-01-01",
        apiVersion: "v1",
      };
      reproducibility.prompt = {
        promptId: "prompt-123",
        promptVersion: "1.0.0",
        promptHash: "abc123",
      };
      reproducibility.tools = [
        {
          toolId: "tool-1",
          toolName: "search",
          toolVersion: "2.0.0",
        },
      ];

      const options: ADRCreationOptions = {
        groupId: "group-1",
        sessionId: testSessionId,
        actionType: "llm_request",
        reproducibility,
      };

      await capture.beginDecision(options);

      const adr = capture.getCurrentADR();
      expect(adr!.reproducibility.model.modelId).toBe("gpt-4");
      expect(adr!.reproducibility.prompt.promptId).toBe("prompt-123");
      expect(adr!.reproducibility.tools).toHaveLength(1);
      expect(adr!.reproducibility.tools[0].toolName).toBe("search");
    });
  });

  describe("captureAction (Layer 1)", () => {
    it("should capture action inputs and outputs", async () => {
      await capture.beginDecision({
        groupId: "group-1",
        sessionId: testSessionId,
        actionType: "tool_invocation",
        reproducibility: createDefaultReproducibilityInfo(),
      });

      const inputs = { query: "test query", limit: 10 };
      const outputs = { results: ["a", "b"], count: 2 };
      const toolCalls: ToolCallRecord[] = [
        {
          toolId: "tool-1",
          toolName: "search",
          input: { q: "test" },
          output: { hits: 5 },
          success: true,
          timestamp: new Date(),
          durationMs: 100,
        },
      ];

      capture.captureAction(inputs, outputs, "success", 250, toolCalls);

      const adr = capture.getCurrentADR()!;
      expect(adr.actionLayer.inputs).toEqual(inputs);
      expect(adr.actionLayer.outputs).toEqual(outputs);
      expect(adr.actionLayer.result).toBe("success");
      expect(adr.actionLayer.durationMs).toBe(250);
      expect(adr.actionLayer.toolCalls).toHaveLength(1);
      expect(adr.actionLayer.toolCalls[0].toolName).toBe("search");
    });

    it("should accept all action result types", async () => {
      await capture.beginDecision({
        groupId: "group-1",
        sessionId: testSessionId,
        actionType: "decision_made",
        reproducibility: createDefaultReproducibilityInfo(),
      });

      const results: ActionResult[] = ["success", "failure", "partial", "skipped", "pending"];

      for (const result of results) {
        capture.captureAction({}, undefined, result, 0);
        expect(capture.getCurrentADR()!.actionLayer.result).toBe(result);
      }
    });

    it("should throw error if no active ADR", () => {
      expect(() => {
        capture.captureAction({}, {}, "success", 0);
      }).toThrow("No active ADR");
    });
  });

  describe("captureContext (Layer 2)", () => {
    it("should capture decision context with goals and constraints", async () => {
      await capture.beginDecision({
        groupId: "group-1",
        sessionId: testSessionId,
        actionType: "decision_made",
        reproducibility: createDefaultReproducibilityInfo(),
      });

      const budget: BudgetSnapshot = {
        tokensRemaining: 50000,
        toolCallsRemaining: 50,
        timeRemainingMs: 60000,
        costRemainingUsd: 5.0,
      };

      const goals: GoalContext[] = [
        {
          goalId: "goal-1",
          description: "Complete task",
          priority: 1,
          status: "active",
        },
      ];

      const constraints: ConstraintContext[] = [
        {
          constraintId: "const-1",
          type: "hard",
          description: "Must not exceed budget",
          value: { max: 100 },
          source: "policy",
        },
      ];

      const options: OptionContext[] = [
        {
          optionId: "opt-1",
          description: "Option A",
          estimatedCost: 10,
          estimatedDuration: 1000,
          riskLevel: "low",
        },
      ];

      capture.captureContext(
        {
          sessionId: testSessionId,
          currentStep: 5,
          totalSteps: 10,
          budgetRemaining: budget,
          activePolicies: ["policy-1"],
        },
        goals,
        constraints,
        options,
        "opt-1",
        { systemLoad: 0.5 },
      );

      const adr = capture.getCurrentADR()!;
      expect(adr.contextLayer.sessionState.currentStep).toBe(5);
      expect(adr.contextLayer.goals).toHaveLength(1);
      expect(adr.contextLayer.constraints).toHaveLength(1);
      expect(adr.contextLayer.availableOptions).toHaveLength(1);
      expect(adr.contextLayer.selectedOption).toBe("opt-1");
      expect(adr.contextLayer.environmentalFactors.systemLoad).toBe(0.5);
    });
  });

  describe("updateLifecycle", () => {
    it("should update ADR lifecycle status", async () => {
      await capture.beginDecision({
        groupId: "group-1",
        sessionId: testSessionId,
        actionType: "tool_invocation",
        reproducibility: createDefaultReproducibilityInfo(),
      });

      capture.updateLifecycle("active");
      expect(capture.getCurrentADR()!.lifecycle).toBe("active");

      capture.updateLifecycle("completed");
      expect(capture.getCurrentADR()!.lifecycle).toBe("completed");
    });
  });

  describe("finalize", () => {
    it("should finalize ADR and compute overall checksum", async () => {
      await capture.beginDecision({
        groupId: "group-1",
        sessionId: testSessionId,
        actionType: "tool_invocation",
        reproducibility: createDefaultReproducibilityInfo(),
      });

      capture.captureAction({ input: "test" }, { output: "result" }, "success", 100);
      capture.updateLifecycle("completed");

      const adrId = await capture.finalize();

      expect(adrId).toBeDefined();
      expect(capture.getCurrentADR()).toBeNull();

      const storedADR = await storage.findById(adrId);
      expect(storedADR).not.toBeNull();
      expect(storedADR!.lifecycle).toBe("completed");
      expect(storedADR!.overallChecksum).toMatch(/^[a-f0-9]{64}$/);
    });
  });

  describe("InMemoryADRStorage", () => {
    it("should save and retrieve ADRs", async () => {
      const options: ADRCreationOptions = {
        groupId: "group-1",
        sessionId: testSessionId,
        actionType: "tool_invocation",
        reproducibility: createDefaultReproducibilityInfo(),
      };

      const adrId = await capture.beginDecision(options);
      await capture.finalize();

      const retrieved = await storage.findById(adrId);
      expect(retrieved).not.toBeNull();
      expect(retrieved!.adrId).toBe(adrId);
    });

    it("should find ADRs by session ID", async () => {
      const sessionId2: SessionId = {
        groupId: "test-group",
        agentId: "test-agent",
        sessionId: "session-2",
      };

      await capture.beginDecision({
        groupId: "group-1",
        sessionId: testSessionId,
        actionType: "tool_invocation",
        reproducibility: createDefaultReproducibilityInfo(),
      });
      await capture.finalize();

      const capture2 = createADRCapture(storage);
      await capture2.beginDecision({
        groupId: "group-2",
        sessionId: sessionId2,
        actionType: "llm_request",
        reproducibility: createDefaultReproducibilityInfo(),
      });
      await capture2.finalize();

      const results = await storage.findBySessionId(testSessionId);
      expect(results).toHaveLength(1);
      expect(results[0].sessionId.sessionId).toBe("test-session");
    });

    it("should find ADRs by group ID", async () => {
      await capture.beginDecision({
        groupId: "group-alpha",
        sessionId: testSessionId,
        actionType: "tool_invocation",
        reproducibility: createDefaultReproducibilityInfo(),
      });
      await capture.finalize();

      const capture2 = createADRCapture(storage);
      await capture2.beginDecision({
        groupId: "group-beta",
        sessionId: testSessionId,
        actionType: "llm_request",
        reproducibility: createDefaultReproducibilityInfo(),
      });
      await capture2.finalize();

      const results = await storage.findByGroupId("group-alpha");
      expect(results).toHaveLength(1);
      expect(results[0].groupId).toBe("group-alpha");
    });

    it("should query ADRs with filters", async () => {
      await capture.beginDecision({
        groupId: "group-1",
        sessionId: testSessionId,
        actionType: "tool_invocation",
        reproducibility: createDefaultReproducibilityInfo(),
      });
      await capture.finalize();

      const results = await storage.query({
        groupId: "group-1",
        lifecycle: "completed",
      });

      expect(results).toHaveLength(1);
    });

    it("should archive ADRs", async () => {
      const adrId = await capture.beginDecision({
        groupId: "group-1",
        sessionId: testSessionId,
        actionType: "tool_invocation",
        reproducibility: createDefaultReproducibilityInfo(),
      });
      await capture.finalize();

      const archived = await storage.archive(adrId);
      expect(archived).toBe(true);

      const adr = await storage.findById(adrId);
      expect(adr!.lifecycle).toBe("archived");
      expect(adr!.archivedAt).toBeDefined();
    });
  });

  describe("Helper functions", () => {
    it("should create action layer from state", () => {
      const action = captureActionFromState(
        testSessionId,
        "tool_invocation",
        { query: "test" },
        "success",
        150,
      );

      expect(action.actionType).toBe("tool_invocation");
      expect(action.inputs).toEqual({ query: "test" });
      expect(action.actionId).toMatch(/^act_/);
      expect(action.layerId).toMatch(/^action_/);
    });

    it("should create context layer from state", () => {
      const budget: BudgetSnapshot = {
        tokensRemaining: 1000,
        toolCallsRemaining: 10,
        timeRemainingMs: 60000,
        costRemainingUsd: 1.0,
      };

      const context = captureContextFromState(
        testSessionId,
        3,
        10,
        budget,
        [{ goalId: "g1", description: "Goal", priority: 1, status: "active" }],
        [{ constraintId: "c1", type: "hard", description: "Constraint", value: {}, source: "policy" }],
        [{ optionId: "o1", description: "Option", estimatedCost: 5, estimatedDuration: 100, riskLevel: "low" }],
        "o1",
      );

      expect(context.sessionState.sessionId).toEqual(testSessionId);
      expect(context.sessionState.currentStep).toBe(3);
      expect(context.goals).toHaveLength(1);
      expect(context.constraints).toHaveLength(1);
      expect(context.availableOptions).toHaveLength(1);
      expect(context.selectedOption).toBe("o1");
    });
  });

  describe("Five-layer completeness (AC1)", () => {
    it("should have all five layers after complete capture", async () => {
      await capture.beginDecision({
        groupId: "group-1",
        sessionId: testSessionId,
        actionType: "decision_made",
        reproducibility: createDefaultReproducibilityInfo(),
      });

      capture.captureAction(
        { input: "data" },
        { result: "output" },
        "success",
        100,
        [
          {
            toolId: "tool-1",
            toolName: "example",
            input: {},
            output: {},
            success: true,
            timestamp: new Date(),
            durationMs: 50,
          },
        ],
      );

      capture.captureContext(
        {
          sessionId: testSessionId,
          currentStep: 1,
          totalSteps: 5,
          budgetRemaining: {
            tokensRemaining: 10000,
            toolCallsRemaining: 100,
            timeRemainingMs: 300000,
            costRemainingUsd: 10,
          },
          activePolicies: [],
        },
        [],
        [],
        [],
        "",
      );

      capture.updateLifecycle("completed");
      await capture.finalize();

      const adrId = capture.getCurrentADR()?.adrId;
      if (adrId) {
        const stored = await storage.findById(adrId);
        expect(stored).not.toBeNull();

        expect(stored!.actionLayer).toBeDefined();
        expect(stored!.contextLayer).toBeDefined();
        expect(stored!.reasoningLayer).toBeDefined();
        expect(stored!.counterfactualsLayer).toBeDefined();
        expect(stored!.oversightLayer).toBeDefined();

        expect(stored!.actionLayer.checksum).toMatch(/^[a-f0-9]{64}$/);
        expect(stored!.contextLayer.checksum).toMatch(/^[a-f0-9]{64}$/);
        expect(stored!.reasoningLayer.checksum).toMatch(/^[a-f0-9]{64}$/);
        expect(stored!.counterfactualsLayer.checksum).toMatch(/^[a-f0-9]{64}$/);
        expect(stored!.oversightLayer.finalChecksum).toMatch(/^[a-f0-9]{64}$/);
        expect(stored!.overallChecksum).toMatch(/^[a-f0-9]{64}$/);
      }
    });
  });
});