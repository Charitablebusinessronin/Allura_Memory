/**
 * Budget Middleware Integration Tests
 * Story: Wire Token Budget Pre-Turn Checks into MCP middleware
 *
 * Test coverage:
 * 1. Budget check before call
 * 2. Hard stop when exceeded
 * 3. Budget update after call
 * 4. Configurable MIN_TURN_TOKENS
 * 5. Budget exceeded handler
 * 6. Session not found handling
 * 7. Budget integration creation
 * 8. Tool wrapper function
 * 9. Graceful error handling
 * 10. Session ID creation
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  MIN_TURN_TOKENS,
  checkBudgetBeforeCall,
  updateBudgetAfterCall,
  handleBudgetExceeded,
  wrapMcpToolWithBudget,
  createBudgetIntegration,
  createSessionId,
  BudgetExceededError,
} from "./middleware-integration";
import { BudgetEnforcer } from "./enforcer";
import type { SessionId, HaltReason } from "./types";
import { DEFAULT_BUDGET_LIMITS } from "./types";

describe("Budget Middleware Integration", () => {
  let mockEnforcer: BudgetEnforcer;
  let mockSessionId: SessionId;

  beforeEach(() => {
    mockSessionId = {
      groupId: "test-group",
      agentId: "test-agent",
      sessionId: "test-session-123",
    };

    mockEnforcer = new BudgetEnforcer({
      enabled: true,
      budgetConfig: {
        defaults: DEFAULT_BUDGET_LIMITS,
        warningThresholds: { warning80: 0.8, warning90: 0.9 },
        pricing: [],
        enableWarnings: true,
        haltOnBreach: true,
      },
    });

    // Start the session
    mockEnforcer.startSession(mockSessionId);
  });

  describe("MIN_TURN_TOKENS constant", () => {
    it("should export MIN_TURN_TOKENS with default value of 1000", () => {
      expect(MIN_TURN_TOKENS).toBe(1000);
    });

    it("should be configurable via options", () => {
      const customMinTokens = 500;
      const check = checkBudgetBeforeCall(mockEnforcer, mockSessionId, customMinTokens);
      expect(check.allowed).toBe(true);
    });
  });

  describe("checkBudgetBeforeCall", () => {
    it("should allow execution when sufficient budget exists", () => {
      const result = checkBudgetBeforeCall(mockEnforcer, mockSessionId);

      expect(result.allowed).toBe(true);
      expect(result.exceeded).toBe(false);
      expect(result.remainingTokens).toBeGreaterThan(MIN_TURN_TOKENS);
    });

    it("should check budget before each tool call", () => {
      // First call - should pass
      const firstCheck = checkBudgetBeforeCall(mockEnforcer, mockSessionId);
      expect(firstCheck.allowed).toBe(true);

      // Simulate consuming budget
      mockEnforcer.updateBudget(mockSessionId, { tokens: DEFAULT_BUDGET_LIMITS.maxTokens - 500 });

      // Second call - should still pass (500 remaining > 0 but < MIN_TURN_TOKENS)
      // Actually this should fail because 500 < MIN_TURN_TOKENS (1000)
      const secondCheck = checkBudgetBeforeCall(mockEnforcer, mockSessionId);
      expect(secondCheck.allowed).toBe(false);
    });

    it("should hard stop when budget exceeds MIN_TURN_TOKENS", () => {
      // Consume almost all budget, leaving less than MIN_TURN_TOKENS
      mockEnforcer.updateBudget(mockSessionId, {
        tokens: DEFAULT_BUDGET_LIMITS.maxTokens - MIN_TURN_TOKENS + 100,
      });

      const result = checkBudgetBeforeCall(mockEnforcer, mockSessionId);

      expect(result.allowed).toBe(false);
      expect(result.exceeded).toBe(true);
      expect(result.haltReason).toBeDefined();
      expect(result.haltReason?.type).toBe("token_limit");
    });

    it("should halt session when budget exceeded", () => {
      // Consume all budget
      mockEnforcer.updateBudget(mockSessionId, { tokens: DEFAULT_BUDGET_LIMITS.maxTokens + 100 });

      const result = checkBudgetBeforeCall(mockEnforcer, mockSessionId);

      expect(result.allowed).toBe(false);
      expect(mockEnforcer.isHalted(mockSessionId)).toBe(true);
    });

    it("should check estimated token cost when provided", () => {
      const estimatedCost = 50000;
      const result = checkBudgetBeforeCall(mockEnforcer, mockSessionId, estimatedCost);

      expect(result.allowed).toBe(true); // Should pass with default budget

      // Now try with cost exceeding budget
      const highCost = DEFAULT_BUDGET_LIMITS.maxTokens + 100;
      const result2 = checkBudgetBeforeCall(mockEnforcer, mockSessionId, highCost);

      expect(result2.allowed).toBe(false);
    });

    it("should return session not found when session doesn't exist", () => {
      const nonExistentSession: SessionId = {
        groupId: "test",
        agentId: "test",
        sessionId: "non-existent",
      };

      const result = checkBudgetBeforeCall(mockEnforcer, nonExistentSession);

      expect(result.allowed).toBe(false);
      expect(result.exceeded).toBe(true);
      expect(result.reason).toContain("not found");
    });
  });

  describe("updateBudgetAfterCall", () => {
    it("should update budget counters after tool call", () => {
      const initialStatus = mockEnforcer.getStatus(mockSessionId);
      const initialToolCalls = initialStatus?.consumption.toolCalls ?? 0;

      updateBudgetAfterCall(mockEnforcer, mockSessionId, {
        toolName: "test-tool",
        durationMs: 100,
        success: true,
        estimatedTokens: 500,
      });

      const updatedStatus = mockEnforcer.getStatus(mockSessionId);
      expect(updatedStatus?.consumption.toolCalls).toBe(initialToolCalls + 1);
    });

    it("should record tool call metadata", () => {
      const toolName = "notion-create-page";
      const durationMs = 250;

      updateBudgetAfterCall(mockEnforcer, mockSessionId, {
        toolName,
        durationMs,
        success: true,
      });

      const status = mockEnforcer.getStatus(mockSessionId);
      expect(status).toBeDefined();
    });

    it("should track tokens when estimated tokens provided", () => {
      const estimatedTokens = 1000;

      updateBudgetAfterCall(mockEnforcer, mockSessionId, {
        toolName: "test-tool",
        durationMs: 100,
        success: true,
        estimatedTokens,
      });

      const status = mockEnforcer.getStatus(mockSessionId);
      expect(status?.consumption.tokens).toBe(estimatedTokens);
    });
  });

  describe("handleBudgetExceeded", () => {
    it("should notify user when budget exceeded", () => {
      const haltReason: HaltReason = {
        type: "token_limit",
        consumed: 100000,
        limit: 100000,
      };

      const result = handleBudgetExceeded(mockSessionId, haltReason);

      expect(result.userNotified).toBe(true);
      expect(result.sessionHalted).toBe(true);
      expect(result.notificationMessage).toContain("Token budget exceeded");
    });

    it("should include session details in notification", () => {
      const haltReason: HaltReason = {
        type: "kmax_exceeded",
        currentStep: 50,
        maxSteps: 50,
      };

      const result = handleBudgetExceeded(mockSessionId, haltReason, {
        includeDetails: true,
      });

      expect(result.notificationMessage).toContain(mockSessionId.sessionId);
      expect(result.notificationMessage).toContain(mockSessionId.agentId);
    });

    it("should call custom notification handler when provided", () => {
      const customHandler = vi.fn();
      const haltReason: HaltReason = {
        type: "token_limit",
        consumed: 100,
        limit: 100,
      };

      handleBudgetExceeded(mockSessionId, haltReason, {
        onNotify: customHandler,
      });

      expect(customHandler).toHaveBeenCalled();
    });

    it("should handle different halt reason types", () => {
      const reasons: HaltReason[] = [
        { type: "token_limit", consumed: 100, limit: 100 },
        { type: "tool_call_limit", consumed: 50, limit: 50 },
        { type: "time_limit", elapsedMs: 300000, limitMs: 300000 },
        { type: "cost_limit", consumedUsd: 10, limitUsd: 10 },
        { type: "kmax_exceeded", currentStep: 50, maxSteps: 50 },
      ];

      reasons.forEach((reason) => {
        const result = handleBudgetExceeded(mockSessionId, reason);
        expect(result.userNotified).toBe(true);
        expect(result.notificationMessage).toBeDefined();
      });
    });
  });

  describe("wrapMcpToolWithBudget", () => {
    it("should wrap tool function with budget check", async () => {
      const mockToolFn = vi.fn().mockResolvedValue({ success: true });

      const wrappedTool = wrapMcpToolWithBudget(
        mockEnforcer,
        mockSessionId,
        "test-tool",
        mockToolFn,
        { trackBudget: true }
      );

      const result = await wrappedTool({ arg1: "value1" });

      expect(result).toEqual({ success: true });
      expect(mockToolFn).toHaveBeenCalledWith({ arg1: "value1" });
    });

    it("should throw when budget exceeded", async () => {
      // Consume all budget
      mockEnforcer.updateBudget(mockSessionId, { tokens: DEFAULT_BUDGET_LIMITS.maxTokens });

      const mockToolFn = vi.fn().mockResolvedValue({ success: true });

      const wrappedTool = wrapMcpToolWithBudget(
        mockEnforcer,
        mockSessionId,
        "test-tool",
        mockToolFn
      );

      await expect(wrappedTool({})).rejects.toThrow("Budget exceeded");
      expect(mockToolFn).not.toHaveBeenCalled();
    });

    it("should call custom handler when budget exceeded", async () => {
      mockEnforcer.updateBudget(mockSessionId, { tokens: DEFAULT_BUDGET_LIMITS.maxTokens });

      const customHandler = vi.fn();
      const mockToolFn = vi.fn().mockResolvedValue({ success: true });

      const wrappedTool = wrapMcpToolWithBudget(
        mockEnforcer,
        mockSessionId,
        "test-tool",
        mockToolFn,
        { onBudgetExceeded: customHandler }
      );

      try {
        await wrappedTool({});
      } catch (e) {
        // Expected to throw
      }

      expect(customHandler).toHaveBeenCalled();
    });

    it("should update budget after successful call", async () => {
      const mockToolFn = vi.fn().mockResolvedValue({ success: true });

      const wrappedTool = wrapMcpToolWithBudget(
        mockEnforcer,
        mockSessionId,
        "test-tool",
        mockToolFn,
        { trackBudget: true }
      );

      await wrappedTool({});

      const status = mockEnforcer.getStatus(mockSessionId);
      expect(status?.consumption.toolCalls).toBe(1);
    });
  });

  describe("createBudgetIntegration", () => {
    it("should create budget integration with default settings", () => {
      const integration = createBudgetIntegration({
        enforcer: mockEnforcer,
        sessionId: mockSessionId,
      });

      expect(integration.isEnabled).toBe(true);
      expect(integration.checkBeforeExecution).toBeDefined();
      expect(integration.updateAfterExecution).toBeDefined();
      expect(integration.handleExceeded).toBeDefined();
      expect(integration.getStatus).toBeDefined();
    });

    it("should respect enabled flag", () => {
      const integration = createBudgetIntegration({
        enforcer: mockEnforcer,
        sessionId: mockSessionId,
        enabled: false,
      });

      expect(integration.isEnabled).toBe(false);
      const check = integration.checkBeforeExecution();
      expect(check.allowed).toBe(true); // Should always allow when disabled
    });

    it("should use custom minTurnTokens", () => {
      const customMin = 500;
      const integration = createBudgetIntegration({
        enforcer: mockEnforcer,
        sessionId: mockSessionId,
        minTurnTokens: customMin,
      });

      // Should work with the custom minimum
      const check = integration.checkBeforeExecution();
      expect(check.allowed).toBe(true);
    });

    it("should provide budget status", () => {
      const integration = createBudgetIntegration({
        enforcer: mockEnforcer,
        sessionId: mockSessionId,
      });

      const status = integration.getStatus();
      expect(status).toBeDefined();
    });
  });

  describe("createSessionId", () => {
    it("should create session ID with provided values", () => {
      const sessionId = createSessionId("my-group", "my-agent", "my-session");

      expect(sessionId.groupId).toBe("my-group");
      expect(sessionId.agentId).toBe("my-agent");
      expect(sessionId.sessionId).toBe("my-session");
    });
  });

  describe("BudgetExceededError", () => {
    it("should create error with session info", () => {
      const haltReason: HaltReason = {
        type: "token_limit",
        consumed: 100,
        limit: 100,
      };

      const error = new BudgetExceededError(mockSessionId, haltReason, 0);

      expect(error.name).toBe("BudgetExceededError");
      expect(error.sessionId).toEqual(mockSessionId);
      expect(error.haltReason).toEqual(haltReason);
      expect(error.remainingTokens).toBe(0);
    });

    it("should use custom message when provided", () => {
      const haltReason: HaltReason = {
        type: "token_limit",
        consumed: 100,
        limit: 100,
      };

      const customMessage = "Custom budget exceeded message";
      const error = new BudgetExceededError(mockSessionId, haltReason, 0, customMessage);

      expect(error.message).toBe(customMessage);
    });
  });

  describe("Edge cases", () => {
    it("should handle session already halted", () => {
      mockEnforcer.haltSession(mockSessionId, {
        type: "token_limit",
        consumed: 100,
        limit: 100,
      });

      const result = checkBudgetBeforeCall(mockEnforcer, mockSessionId);

      expect(result.allowed).toBe(false);
      expect(result.reason).toContain("already halted");
    });

    it("should handle tool call failure", async () => {
      const mockToolFn = vi.fn().mockRejectedValue(new Error("Tool failed"));

      const wrappedTool = wrapMcpToolWithBudget(
        mockEnforcer,
        mockSessionId,
        "test-tool",
        mockToolFn
      );

      await expect(wrappedTool({})).rejects.toThrow("Tool failed");

      // Should still update budget even on failure
      const status = mockEnforcer.getStatus(mockSessionId);
      expect(status?.consumption.toolCalls).toBe(1);
    });
  });
});
