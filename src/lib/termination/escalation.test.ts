/**
 * Escalation Service Tests
 * Story 3.3: Implement Fail-Safe Termination and Escalation
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { EscalationService, createEscalationService, clearTicketStore } from "./escalation";
import { SummaryGenerator, createSummaryGenerator } from "./summary-generator";
import { ProgressTracker, createProgressTracker } from "./progress-tracker";
import type { EscalationTicket, ProgressSummary } from "./types";
import type { HaltReason, SessionState, SessionId } from "../budget/types";
import { createSessionState, DEFAULT_BUDGET_LIMITS } from "../budget/types";

describe("EscalationService", () => {
  let service: EscalationService;
  let summaryGenerator: SummaryGenerator;
  let tracker: ProgressTracker;
  let sessionState: SessionState;
  const sessionId: SessionId = { groupId: "test-group", agentId: "test-agent", sessionId: "test-session" };

  beforeEach(() => {
    summaryGenerator = createSummaryGenerator({ enablePersistence: false });
    tracker = createProgressTracker();
    tracker.initialize(sessionId, {
      description: "Test task",
      type: "test",
      successCriteria: ["Complete task"],
    });
    service = createEscalationService({
      escalation: {
        enabled: false,
        channels: [],
        priorityThresholds: { budgetUtilPercent: 90, errorCount: 5, stuckPatternSeverity: 4 },
      },
    }, summaryGenerator);
    sessionState = createSessionState(sessionId, DEFAULT_BUDGET_LIMITS);
    clearTicketStore();
  });

  afterEach(() => {
    clearTicketStore();
  });

  const createHaltReason = (type: HaltReason["type"] = "kmax_exceeded"): HaltReason => {
    if (type === "kmax_exceeded") {
      return { type: "kmax_exceeded", currentStep: 25, maxSteps: 50 };
    }
    if (type === "token_limit") {
      return { type: "token_limit", consumed: 50000, limit: 100000 };
    }
    if (type === "policy_violation") {
      return { type: "policy_violation", reason: "Unauthorized action" };
    }
    if (type === "critical_error") {
      return { type: "critical_error", error: "Database failure" };
    }
    return { type: "time_limit", elapsedMs: 120000, limitMs: 300000 };
  };

  const createTestSummary = async (haltReason: HaltReason): Promise<ProgressSummary> => {
    return await summaryGenerator.generateSummary(sessionState, haltReason, tracker);
  };

  describe("createTicket", () => {
    it("should create escalation ticket", async () => {
      const haltReason = createHaltReason();
      const summary = await createTestSummary(haltReason);

      const ticket = await service.createTicket(sessionId, haltReason, summary);

      expect(ticket.id).toBeDefined();
      expect(ticket.summaryId).toBe(summary.id);
      expect(ticket.session.groupId).toBe("test-group");
      expect(ticket.status).toBe("open");
    });

    it("should set priority based on halt reason", async () => {
      const criticalReason: HaltReason = { type: "critical_error", error: "Failure" };
      const criticalSummary = await createTestSummary(criticalReason);

      const ticket = await service.createTicket(sessionId, criticalReason, criticalSummary);

      expect(ticket.priority).toBe("critical");
    });

    it("should set high priority for policy violations", async () => {
      const policyReason: HaltReason = { type: "policy_violation", reason: "Blocked" };
      const policySummary = await createTestSummary(policyReason);

      const ticket = await service.createTicket(sessionId, policyReason, policySummary);

      expect(ticket.priority).toBe("high");
    });

    it("should generate appropriate title", async () => {
      const haltReason = createHaltReason("kmax_exceeded");
      const summary = await createTestSummary(haltReason);

      const ticket = await service.createTicket(sessionId, haltReason, summary);

      expect(ticket.title).toContain("terminated");
      expect(ticket.title).toContain("kmax exceeded");
    });

    it("should include suggested actions", async () => {
      const haltReason = createHaltReason("kmax_exceeded");
      const summary = await createTestSummary(haltReason);

      const ticket = await service.createTicket(sessionId, haltReason, summary);

      expect(ticket.suggestedActions.length).toBeGreaterThan(0);
    });

    it("should include trace references", async () => {
      const haltReason = createHaltReason();
      const summary = await createTestSummary(haltReason);

      const ticket = await service.createTicket(sessionId, haltReason, summary);

      expect(ticket.traceRefs).toContain(summary.traceRef);
    });
  });

  describe("escalate", () => {
    it("should send notifications via configured channels", async () => {
      const serviceWithChannels = createEscalationService({
        escalation: {
          enabled: true,
          channels: [
            { type: "in_app", enabled: true, config: {} },
          ],
          priorityThresholds: {
            budgetUtilPercent: 90,
            errorCount: 5,
            stuckPatternSeverity: 4,
          },
        },
      }, summaryGenerator);

      const haltReason = createHaltReason();
      const summary = await createTestSummary(haltReason);
      const ticket = await serviceWithChannels.createTicket(sessionId, haltReason, summary);

      const escalated = await serviceWithChannels.escalate(ticket, summary);

      expect(escalated.notifications).toHaveLength(1);
      expect(escalated.notifications[0].channel).toBe("in_app");
      expect(escalated.notifications[0].success).toBe(true);
    });

    it("should handle multiple notification channels", async () => {
      const serviceWithChannels = createEscalationService({
        escalation: {
          enabled: true,
          channels: [
            { type: "in_app", enabled: true, config: {} },
            { type: "email", enabled: true, config: { recipient: "admin@example.com" } },
            { type: "slack", enabled: true, config: { channel: "#alerts" } },
          ],
          priorityThresholds: {
            budgetUtilPercent: 90,
            errorCount: 5,
            stuckPatternSeverity: 4,
          },
        },
      }, summaryGenerator);

      const haltReason = createHaltReason();
      const summary = await createTestSummary(haltReason);
      const ticket = await serviceWithChannels.createTicket(sessionId, haltReason, summary);

      const escalated = await serviceWithChannels.escalate(ticket, summary);

      expect(escalated.notifications.length).toBe(3);
    });

    it("should skip disabled channels", async () => {
      const serviceWithChannels = createEscalationService({
        escalation: {
          enabled: true,
          channels: [
            { type: "in_app", enabled: true, config: {} },
            { type: "email", enabled: false, config: {} },
          ],
          priorityThresholds: {
            budgetUtilPercent: 90,
            errorCount: 5,
            stuckPatternSeverity: 4,
          },
        },
      }, summaryGenerator);

      const haltReason = createHaltReason();
      const summary = await createTestSummary(haltReason);
      const ticket = await serviceWithChannels.createTicket(sessionId, haltReason, summary);

      const escalated = await serviceWithChannels.escalate(ticket, summary);

      expect(escalated.notifications).toHaveLength(1);
      expect(escalated.notifications[0].channel).toBe("in_app");
    });
  });

  describe("resolveTicket", () => {
    it("should resolve ticket with action", async () => {
      const haltReason = createHaltReason();
      const summary = await createTestSummary(haltReason);
      const ticket = await service.createTicket(sessionId, haltReason, summary);

      const resolved = await service.resolveTicket(ticket.id, {
        action: "takeover",
        reason: "Human reviewed and will complete",
        resolvedBy: "admin@example.com",
        resolvedAt: new Date(),
      });

      expect(resolved).not.toBeNull();
      expect(resolved?.status).toBe("resolved");
      expect(resolved?.resolution?.action).toBe("takeover");
    });

    it("should return null for non-existent ticket", async () => {
      const resolved = await service.resolveTicket("non-existent", {
        action: "restart",
        reason: "Budget increased",
        resolvedBy: "admin",
        resolvedAt: new Date(),
      });

      expect(resolved).toBeNull();
    });
  });

  describe("acknowledgeTicket", () => {
    it("should acknowledge ticket", async () => {
      const haltReason = createHaltReason();
      const summary = await createTestSummary(haltReason);
      const ticket = await service.createTicket(sessionId, haltReason, summary);

      const acknowledged = await service.acknowledgeTicket(ticket.id, "operator@example.com");

      expect(acknowledged).not.toBeNull();
      expect(acknowledged?.status).toBe("acknowledged");
      expect(acknowledged?.assignedTo).toBe("operator@example.com");
    });
  });

  describe("getTicket", () => {
    it("should retrieve created ticket", async () => {
      const haltReason = createHaltReason();
      const summary = await createTestSummary(haltReason);
      const ticket = await service.createTicket(sessionId, haltReason, summary);

      const retrieved = await service.getTicket(ticket.id);

      expect(retrieved).not.toBeNull();
      expect(retrieved?.id).toBe(ticket.id);
    });

    it("should return null for non-existent ticket", async () => {
      const retrieved = await service.getTicket("non-existent-id");
      expect(retrieved).toBeNull();
    });
  });

  describe("listTickets", () => {
    it("should list tickets by group", async () => {
      const haltReason = createHaltReason();
      const summary = await createTestSummary(haltReason);
      await service.createTicket(sessionId, haltReason, summary);

      const tickets = await service.listTickets(sessionId.groupId);

      expect(tickets.length).toBeGreaterThanOrEqual(1);
      expect(tickets[0].session.groupId).toBe(sessionId.groupId);
    });

    it("should filter by status", async () => {
      const haltReason = createHaltReason();
      const summary = await createTestSummary(haltReason);
      await service.createTicket(sessionId, haltReason, summary);

      const openTickets = await service.listTickets(sessionId.groupId, "open");

      // All returned tickets should be open
      expect(openTickets.every(t => t.status === "open")).toBe(true);
      expect(openTickets.length).toBeGreaterThanOrEqual(1);

      // Resolved should return empty
      const resolvedTickets = await service.listTickets(sessionId.groupId, "resolved");
      expect(resolvedTickets).toHaveLength(0);
    });
  });

  describe("canTakeOver", () => {
    it("should allow takeover for open tickets", async () => {
      const haltReason = createHaltReason("kmax_exceeded");
      const summary = await createTestSummary(haltReason);
      const ticket = await service.createTicket(sessionId, haltReason, summary);

      expect(service.canTakeOver(ticket)).toBe(true);
    });

    it("should not allow takeover for resolved tickets", async () => {
      const haltReason = createHaltReason();
      const summary = await createTestSummary(haltReason);
      const ticket = await service.createTicket(sessionId, haltReason, summary);

      await service.resolveTicket(ticket.id, {
        action: "cancel",
        reason: "No longer needed",
        resolvedBy: "admin",
        resolvedAt: new Date(),
      });

      expect(service.canTakeOver(ticket)).toBe(false);
    });

    it("should not allow takeover for critical errors without acknowledgment", async () => {
      const haltReason: HaltReason = { type: "critical_error", error: "System failure" };
      const summary = await createTestSummary(haltReason);
      const ticket = await service.createTicket(sessionId, haltReason, summary);

      expect(service.canTakeOver(ticket)).toBe(false);
    });

    it("should allow takeover for critical errors after acknowledgment", async () => {
      const haltReason: HaltReason = { type: "critical_error", error: "System failure" };
      const summary = await createTestSummary(haltReason);
      const ticket = await service.createTicket(sessionId, haltReason, summary);

      await service.acknowledgeTicket(ticket.id, "admin");
      const acknowledged = await service.getTicket(ticket.id);

      expect(service.canTakeOver(acknowledged!)).toBe(true);
    });
  });

  describe("canRestart", () => {
    it("should allow restart for budget limits", async () => {
      const haltReason = createHaltReason("token_limit");
      const summary = await createTestSummary(haltReason);
      const ticket = await service.createTicket(sessionId, haltReason, summary);

      expect(service.canRestart(ticket)).toBe(true);
    });

    it("should not allow restart for policy violations", async () => {
      const haltReason: HaltReason = { type: "policy_violation", reason: "Blocked" };
      const summary = await createTestSummary(haltReason);
      const ticket = await service.createTicket(sessionId, haltReason, summary);

      expect(service.canRestart(ticket)).toBe(false);
    });

    it("should not allow restart for resolved tickets", async () => {
      const haltReason = createHaltReason();
      const summary = await createTestSummary(haltReason);
      const ticket = await service.createTicket(sessionId, haltReason, summary);

      ticket.status = "resolved";

      expect(service.canRestart(ticket)).toBe(false);
    });
  });

  describe("getRecommendedActions", () => {
    it("should return recommended actions", async () => {
      const haltReason = createHaltReason("kmax_exceeded");
      const summary = await createTestSummary(haltReason);
      const ticket = await service.createTicket(sessionId, haltReason, summary);

      const actions = service.getRecommendedActions(ticket);

      expect(actions.canTakeOver).toBe(true);
      expect(actions.canRestart).toBe(true);
      // Recommended action should mention limits or goals
      expect(actions.recommendedAction.length).toBeGreaterThan(0);
    });

    it("should restrict actions for policy violations", async () => {
      const haltReason: HaltReason = { type: "policy_violation", reason: "Unauthorized" };
      const summary = await createTestSummary(haltReason);
      const ticket = await service.createTicket(sessionId, haltReason, summary);

      const actions = service.getRecommendedActions(ticket);

      expect(actions.canRestart).toBe(false);
      expect(actions.canModifyPolicy).toBe(true);
      expect(actions.recommendedAction).toContain("policy");
    });

    it("should indicate budget modification for limit issues", async () => {
      const haltReason = createHaltReason("token_limit");
      const summary = await createTestSummary(haltReason);
      const ticket = await service.createTicket(sessionId, haltReason, summary);

      const actions = service.getRecommendedActions(ticket);

      expect(actions.canModifyBudget).toBe(true);
    });
  });

  describe("priority determination", () => {
    it("should assign critical priority to critical errors", async () => {
      const haltReason: HaltReason = { type: "critical_error", error: "Failure" };
      const summary = await createTestSummary(haltReason);
      const ticket = await service.createTicket(sessionId, haltReason, summary);

      expect(ticket.priority).toBe("critical");
    });

    it("should assign high priority to policy violations", async () => {
      const haltReason: HaltReason = { type: "policy_violation", reason: "Blocked" };
      const summary = await createTestSummary(haltReason);
      const ticket = await service.createTicket(sessionId, haltReason, summary);

      expect(ticket.priority).toBe("high");
    });

    it("should assign medium priority for high utilization", async () => {
      sessionState.budgetStatus.utilization.tokens = 96;
      const haltReason = createHaltReason("token_limit");
      const summary = await createTestSummary(haltReason);
      const ticket = await service.createTicket(sessionId, haltReason, summary);

      expect(ticket.priority).toBe("medium");
    });

    it("should assign low priority for normal termination", async () => {
      const haltReason = createHaltReason("kmax_exceeded");
      const summary = await createTestSummary(haltReason);
      const ticket = await service.createTicket(sessionId, haltReason, summary);

      expect(ticket.priority).toBe("low");
    });
  });

  describe("suggested actions generation", () => {
    it("should suggest budget increase for token limits", async () => {
      const haltReason = createHaltReason("token_limit");
      const summary = await createTestSummary(haltReason);
      const ticket = await service.createTicket(sessionId, haltReason, summary);

      expect(ticket.suggestedActions).toContain("Increase token budget");
    });

    it("should suggest policy review for violations", async () => {
      const haltReason: HaltReason = { type: "policy_violation", reason: "Blocked" };
      const summary = await createTestSummary(haltReason);
      const ticket = await service.createTicket(sessionId, haltReason, summary);

      expect(ticket.suggestedActions.some(a => a.includes("policy") || a.includes("Policy"))).toBe(true);
    });

    it("should suggest investigation for critical errors", async () => {
      const haltReason: HaltReason = { type: "critical_error", error: "Failure" };
      const summary = await createTestSummary(haltReason);
      const ticket = await service.createTicket(sessionId, haltReason, summary);

      expect(ticket.suggestedActions.some(a => a.includes("Investigate") || a.includes("investigate"))).toBe(true);
    });
  });
});

describe("createEscalationService", () => {
  it("should create service with default config", () => {
    const service = createEscalationService();
    expect(service).toBeInstanceOf(EscalationService);
  });

  it("should create service with custom config", () => {
    const service = createEscalationService({
      escalation: {
        enabled: true,
        channels: [],
        priorityThresholds: {
          budgetUtilPercent: 80,
          errorCount: 3,
          stuckPatternSeverity: 3,
        },
      },
    });
    expect(service).toBeInstanceOf(EscalationService);
  });
});