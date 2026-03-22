/**
 * Approval Router Tests
 * Story 3.1: Mediate Tool Calls via Policy Gateway
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  ApprovalRouter,
  createApprovalRouter,
  isPendingApproval,
  isResolvedApproval,
  isExpiredApproval,
} from "./approval-router";
import type { ExecutionContext, RiskLevel } from "./types";

describe("ApprovalRouter", () => {
  let router: ApprovalRouter;

  const agentContext: ExecutionContext = {
    groupId: "test-group",
    agentId: "agent-123",
    role: "agent",
    sessionId: "session-456",
    timestamp: new Date(),
  };

  beforeEach(() => {
    router = createApprovalRouter();
  });

  describe("Queue Approval Requests", () => {
    it("should queue an approval request and return ID", async () => {
      const approvalId = await router.queueApproval({
        toolName: "dangerous-tool",
        input: { action: "delete", target: "all" },
        context: agentContext,
        riskLevel: "high",
        reason: "High-risk operation requires review",
      });

      expect(approvalId).toBeDefined();
      expect(typeof approvalId).toBe("string");
    });

    it("should store pending approval with correct data", async () => {
      const approvalId = await router.queueApproval({
        toolName: "test-tool",
        input: { key: "value" },
        context: agentContext,
        riskLevel: "medium",
        reason: "Test approval",
      });

      const approval = router.getApproval(approvalId);

      expect(approval).toBeDefined();
      expect(approval?.toolName).toBe("test-tool");
      expect(approval?.input).toEqual({ key: "value" });
      expect(approval?.riskLevel).toBe("medium");
      expect(approval?.status).toBe("pending");
      expect(approval?.context.agentId).toBe("agent-123");
    });

    it("should track pending approvals count", async () => {
      expect(router.getPendingCount()).toBe(0);

      await router.queueApproval({
        toolName: "tool1",
        input: {},
        context: agentContext,
        riskLevel: "low",
        reason: "Test 1",
      });

      expect(router.getPendingCount()).toBe(1);

      await router.queueApproval({
        toolName: "tool2",
        input: {},
        context: agentContext,
        riskLevel: "low",
        reason: "Test 2",
      });

      expect(router.getPendingCount()).toBe(2);
    });

    it("should reject queue when max pending reached", async () => {
      const limitedRouter = createApprovalRouter({ maxPendingApprovals: 2 });

      await limitedRouter.queueApproval({
        toolName: "tool1",
        input: {},
        context: agentContext,
        riskLevel: "low",
        reason: "Test 1",
      });

      await limitedRouter.queueApproval({
        toolName: "tool2",
        input: {},
        context: agentContext,
        riskLevel: "low",
        reason: "Test 2",
      });

      await expect(
        limitedRouter.queueApproval({
          toolName: "tool3",
          input: {},
          context: agentContext,
          riskLevel: "low",
          reason: "Test 3",
        }),
      ).rejects.toThrow("Maximum pending approvals");
    });
  });

  describe("Get Pending Approvals", () => {
    it("should return all pending approvals", async () => {
      await router.queueApproval({
        toolName: "tool1",
        input: {},
        context: agentContext,
        riskLevel: "low",
        reason: "Test 1",
      });

      await router.queueApproval({
        toolName: "tool2",
        input: {},
        context: agentContext,
        riskLevel: "high",
        reason: "Test 2",
      });

      const pending = router.getPendingApprovals();
      expect(pending).toHaveLength(2);
    });

    it("should filter by risk level", async () => {
      await router.queueApproval({
        toolName: "low-tool",
        input: {},
        context: agentContext,
        riskLevel: "low",
        reason: "Low risk",
      });

      await router.queueApproval({
        toolName: "high-tool",
        input: {},
        context: agentContext,
        riskLevel: "high",
        reason: "High risk",
      });

      const highRisk = router.getPendingByRiskLevel("high");
      expect(highRisk).toHaveLength(1);
      expect(highRisk[0]?.toolName).toBe("high-tool");
    });

    it("should filter by agent", async () => {
      const agent1Context: ExecutionContext = {
        ...agentContext,
        agentId: "agent-1",
      };
      const agent2Context: ExecutionContext = {
        ...agentContext,
        agentId: "agent-2",
      };

      await router.queueApproval({
        toolName: "tool1",
        input: {},
        context: agent1Context,
        riskLevel: "low",
        reason: "Agent 1 request",
      });

      await router.queueApproval({
        toolName: "tool2",
        input: {},
        context: agent2Context,
        riskLevel: "low",
        reason: "Agent 2 request",
      });

      const agent1Pending = router.getPendingByAgent("agent-1");
      expect(agent1Pending).toHaveLength(1);
      expect(agent1Pending[0]?.context.agentId).toBe("agent-1");
    });

    it("should filter by group", async () => {
      const group1Context: ExecutionContext = {
        ...agentContext,
        groupId: "group-1",
      };
      const group2Context: ExecutionContext = {
        ...agentContext,
        groupId: "group-2",
      };

      await router.queueApproval({
        toolName: "tool1",
        input: {},
        context: group1Context,
        riskLevel: "low",
        reason: "Group 1 request",
      });

      await router.queueApproval({
        toolName: "tool2",
        input: {},
        context: group2Context,
        riskLevel: "low",
        reason: "Group 2 request",
      });

      const group1Pending = router.getPendingByGroup("group-1");
      expect(group1Pending).toHaveLength(1);
    });
  });

  describe("Resolve Approvals", () => {
    it("should approve a pending request", async () => {
      const approvalId = await router.queueApproval({
        toolName: "test-tool",
        input: { key: "value" },
        context: agentContext,
        riskLevel: "medium",
        reason: "Test",
      });

      const result = await router.approve(
        approvalId,
        "admin-1",
        "Operation looks safe",
      );

      expect(result).toBe(true);

      const approval = router.getApproval(approvalId);
      expect(approval?.status).toBe("approved");
      expect(approval?.resolvedBy).toBe("admin-1");
      expect(approval?.justification).toBe("Operation looks safe");
    });

    it("should deny a pending request", async () => {
      const approvalId = await router.queueApproval({
        toolName: "test-tool",
        input: {},
        context: agentContext,
        riskLevel: "high",
        reason: "Test",
      });

      const result = await router.deny(
        approvalId,
        "admin-1",
        "Too risky for production",
      );

      expect(result).toBe(true);

      const approval = router.getApproval(approvalId);
      expect(approval?.status).toBe("denied");
      expect(approval?.resolvedBy).toBe("admin-1");
      expect(approval?.justification).toBe("Too risky for production");
    });

    it("should not resolve non-existent request", async () => {
      const result = await router.approve("non-existent", "admin", "Test");
      expect(result).toBe(false);
    });

    it("should not resolve already resolved request", async () => {
      const approvalId = await router.queueApproval({
        toolName: "test-tool",
        input: {},
        context: agentContext,
        riskLevel: "low",
        reason: "Test",
      });

      await router.approve(approvalId, "admin-1", "Approved once");

      const secondAttempt = await router.deny(approvalId, "admin-2", "Try again");
      expect(secondAttempt).toBe(false);
    });

    it("should update pending count after resolution", async () => {
      const approvalId = await router.queueApproval({
        toolName: "test-tool",
        input: {},
        context: agentContext,
        riskLevel: "low",
        reason: "Test",
      });

      expect(router.getPendingCount()).toBe(1);

      await router.approve(approvalId, "admin", "OK");

      expect(router.getPendingCount()).toBe(0);
    });
  });

  describe("Cancel Approvals", () => {
    it("should cancel a pending approval", async () => {
      const approvalId = await router.queueApproval({
        toolName: "test-tool",
        input: {},
        context: agentContext,
        riskLevel: "low",
        reason: "Test",
      });

      const result = router.cancelApproval(approvalId);

      expect(result).toBe(true);

      const approval = router.getApproval(approvalId);
      expect(approval?.status).toBe("expired");
    });

    it("should not cancel resolved approvals", async () => {
      const approvalId = await router.queueApproval({
        toolName: "test-tool",
        input: {},
        context: agentContext,
        riskLevel: "low",
        reason: "Test",
      });

      await router.approve(approvalId, "admin", "Approved");

      const result = router.cancelApproval(approvalId);
      expect(result).toBe(false);
    });
  });

  describe("Event Listeners", () => {
    it("should emit approval_requested event", async () => {
      const listener = vi.fn();
      router.subscribe(listener);

      await router.queueApproval({
        toolName: "test-tool",
        input: {},
        context: agentContext,
        riskLevel: "low",
        reason: "Test",
      });

      expect(listener).toHaveBeenCalledWith(
        expect.objectContaining({
          type: "approval_requested",
        }),
      );
    });

    it("should emit approval_granted event on approve", async () => {
      const listener = vi.fn();
      router.subscribe(listener);

      const approvalId = await router.queueApproval({
        toolName: "test-tool",
        input: {},
        context: agentContext,
        riskLevel: "low",
        reason: "Test",
      });

      await router.approve(approvalId, "admin", "OK");

      expect(listener).toHaveBeenCalledWith(
        expect.objectContaining({
          type: "approval_granted",
        }),
      );
    });

    it("should emit approval_denied event on deny", async () => {
      const listener = vi.fn();
      router.subscribe(listener);

      const approvalId = await router.queueApproval({
        toolName: "test-tool",
        input: {},
        context: agentContext,
        riskLevel: "high",
        reason: "Test",
      });

      await router.deny(approvalId, "admin", "No");

      expect(listener).toHaveBeenCalledWith(
        expect.objectContaining({
          type: "approval_denied",
        }),
      );
    });

    it("should unsubscribe listener", async () => {
      const listener = vi.fn();
      const unsubscribe = router.subscribe(listener);

      unsubscribe();

      await router.queueApproval({
        toolName: "test-tool",
        input: {},
        context: agentContext,
        riskLevel: "low",
        reason: "Test",
      });

      expect(listener).not.toHaveBeenCalled();
    });
  });

  describe("Audit Log", () => {
    it("should export audit log", async () => {
      const approvalId1 = await router.queueApproval({
        toolName: "tool1",
        input: {},
        context: agentContext,
        riskLevel: "low",
        reason: "Test 1",
      });

      const approvalId2 = await router.queueApproval({
        toolName: "tool2",
        input: {},
        context: agentContext,
        riskLevel: "high",
        reason: "Test 2",
      });

      await router.approve(approvalId1, "admin", "OK");

      const auditLog = router.exportAuditLog();

      expect(auditLog).toHaveLength(2);
      expect(auditLog.find((a) => a.id === approvalId1)?.status).toBe("approved");
      expect(auditLog.find((a) => a.id === approvalId2)?.status).toBe("pending");
    });

    it("should clear all approvals", async () => {
      await router.queueApproval({
        toolName: "tool1",
        input: {},
        context: agentContext,
        riskLevel: "low",
        reason: "Test",
      });

      router.clear();

      expect(router.getPendingCount()).toBe(0);
      expect(router.getAllApprovals()).toHaveLength(0);
    });
  });
});

describe("Approval Status Helpers", () => {
  const pendingApproval = {
    id: "test",
    toolName: "test",
    input: {},
    context: {} as ExecutionContext,
    riskLevel: "low" as RiskLevel,
    reason: "test",
    status: "pending" as const,
    createdAt: new Date(),
  };

  const approvedApproval = {
    ...pendingApproval,
    status: "approved" as const,
    resolvedAt: new Date(),
    resolvedBy: "admin",
  };

  const deniedApproval = {
    ...pendingApproval,
    status: "denied" as const,
    resolvedAt: new Date(),
    resolvedBy: "admin",
  };

  const expiredApproval = {
    ...pendingApproval,
    status: "expired" as const,
  };

  it("should check pending status", () => {
    expect(isPendingApproval(pendingApproval)).toBe(true);
    expect(isPendingApproval(approvedApproval)).toBe(false);
  });

  it("should check resolved status", () => {
    expect(isResolvedApproval(approvedApproval)).toBe(true);
    expect(isResolvedApproval(deniedApproval)).toBe(true);
    expect(isResolvedApproval(pendingApproval)).toBe(false);
  });

  it("should check expired status", () => {
    expect(isExpiredApproval(expiredApproval)).toBe(true);
    expect(isExpiredApproval(pendingApproval)).toBe(false);
  });
});