import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
  createTripAlertCallback,
  createResetAlertCallback,
  createStateChangeAlertCallback,
  getPendingAlerts,
  getAllAlerts,
  getAlert,
  acknowledgeAlert,
  onAlert,
  offAlert,
  alertQueue,
} from "./alerting";
import type {
  BreakerTripEvent,
  BreakerResetEvent,
  BreakerStateChangeEvent,
} from "./types";

describe("Circuit Breaker Alerting - Story 3.6", () => {
  beforeEach(() => {
    const alerts = getAllAlerts();
    for (const alert of alerts) {
      alertQueue["alerts"].delete(alert.id);
    }
  });

  describe("Trip Alert Creation (AC2)", () => {
    it("should create trip alert with proper context", () => {
      const event: BreakerTripEvent = {
        name: "test-breaker",
        groupId: "test-group",
        timestamp: new Date(),
        reason: "threshold_exceeded",
        errorCount: 5,
        errorRate: 75.5,
        lastError: {
          timestamp: new Date(),
          message: "Connection timeout",
          errorType: "Error",
          severity: "transient",
          operation: "test-op",
        },
        stateSnapshot: {
          state: "open",
          name: "test-breaker",
          groupId: "test-group",
          consecutiveErrors: 5,
          consecutiveSuccesses: 0,
          totalCalls: 10,
          totalFailures: 5,
          totalSuccesses: 5,
          errorRate: 75.5,
          slowCalls: 0,
          tripCount: 1,
          config: {
            name: "test-breaker",
            groupId: "test-group",
            errorThreshold: 5,
            errorRateThreshold: 50,
            minimumCalls: 10,
            openTimeoutMs: 60000,
            successThreshold: 3,
            halfOpenFailureThreshold: 1,
            trackingWindowMs: 60000,
            enableAutoRecovery: true,
            volumeThreshold: 20,
            slowCallDurationMs: 5000,
            slowCallRateThreshold: 80,
          },
        },
      };

      const callback = createTripAlertCallback();
      callback(event);

      const pending = getPendingAlerts();
      expect(pending.length).toBe(1);
      expect(pending[0].breakerName).toBe("test-breaker");
      expect(pending[0].groupId).toBe("test-group");
      expect(pending[0].type).toBe("trip");
      expect(pending[0].severity).toBe("warning");
      expect(pending[0].context.errorCount).toBe(5);
      expect(pending[0].context.errorRate).toBe(75.5);
      expect(pending[0].context.lastError).toBe("Connection timeout");
    });

    it("should set critical severity for high error rates", () => {
      const event: BreakerTripEvent = {
        name: "critical-breaker",
        groupId: "prod-group",
        timestamp: new Date(),
        reason: "threshold_exceeded",
        errorCount: 10,
        errorRate: 90,
        stateSnapshot: {
          state: "open",
          name: "critical-breaker",
          groupId: "prod-group",
          consecutiveErrors: 10,
          consecutiveSuccesses: 0,
          totalCalls: 100,
          totalFailures: 90,
          totalSuccesses: 10,
          errorRate: 90,
          slowCalls: 0,
          tripCount: 1,
          config: {} as any,
        },
      };

      const callback = createTripAlertCallback();
      callback(event);

      const alerts = getPendingAlerts();
      expect(alerts[0].severity).toBe("critical");
    });

    it("should include state snapshot in alert context", () => {
      const event: BreakerTripEvent = {
        name: "test-breaker",
        groupId: "test-group",
        timestamp: new Date(),
        reason: "threshold_exceeded",
        errorCount: 5,
        errorRate: 50,
        stateSnapshot: {
          state: "open",
          name: "test-breaker",
          groupId: "test-group",
          consecutiveErrors: 5,
          consecutiveSuccesses: 0,
          totalCalls: 10,
          totalFailures: 5,
          totalSuccesses: 5,
          errorRate: 50,
          slowCalls: 0,
          tripCount: 1,
          config: {} as any,
        },
      };

      const callback = createTripAlertCallback();
      callback(event);

      const alerts = getPendingAlerts();
      expect(alerts[0].context.stateSnapshot).toBeDefined();
      expect(alerts[0].context.stateSnapshot.state).toBe("open");
    });
  });

  describe("Reset Alert Creation (AC3)", () => {
    it("should create reset alert with operator attribution", () => {
      const event: BreakerResetEvent = {
        name: "test-breaker",
        groupId: "test-group",
        timestamp: new Date(),
        reason: "manual_reset",
        resetBy: "operator-1",
        justification: "System recovered after investigation",
        stateSnapshot: {
          state: "closed",
          name: "test-breaker",
          groupId: "test-group",
          consecutiveErrors: 0,
          consecutiveSuccesses: 0,
          totalCalls: 20,
          totalFailures: 10,
          totalSuccesses: 10,
          errorRate: 50,
          slowCalls: 0,
          tripCount: 1,
          config: {} as any,
        },
      };

      const callback = createResetAlertCallback();
      callback(event);

      const alerts = getPendingAlerts();
      expect(alerts.length).toBe(1);
      expect(alerts[0].type).toBe("reset");
      expect(alerts[0].severity).toBe("info");
      expect(alerts[0].context.resetBy).toBe("operator-1");
      expect(alerts[0].context.justification).toBe(
        "System recovered after investigation",
      );
    });

    it("should handle automatic reset", () => {
      const event: BreakerResetEvent = {
        name: "auto-breaker",
        groupId: "auto-group",
        timestamp: new Date(),
        reason: "health_check_passed",
        stateSnapshot: {
          state: "closed",
          name: "auto-breaker",
          groupId: "auto-group",
          consecutiveErrors: 0,
          consecutiveSuccesses: 3,
          totalCalls: 15,
          totalFailures: 5,
          totalSuccesses: 10,
          errorRate: 33,
          slowCalls: 0,
          tripCount: 1,
          config: {} as any,
        },
      };

      const callback = createResetAlertCallback();
      callback(event);

      const alerts = getPendingAlerts();
      expect(alerts[0].message).toContain("reset successfully");
    });
  });

  describe("State Change Alerts", () => {
    it("should create state change alert for transitions", () => {
      const event: BreakerStateChangeEvent = {
        name: "test-breaker",
        groupId: "test-group",
        fromState: "closed",
        toState: "open",
        reason: "threshold_exceeded",
        timestamp: new Date(),
      };

      const callback = createStateChangeAlertCallback();
      callback(event);

      const alerts = getPendingAlerts();
      expect(alerts.length).toBe(1);
      expect(alerts[0].type).toBe("state_change");
      expect(alerts[0].message).toContain("closed to open");
    });

    it("should track HALF_OPEN transitions", () => {
      const event: BreakerStateChangeEvent = {
        name: "test-breaker",
        groupId: "test-group",
        fromState: "open",
        toState: "half_open",
        reason: "timeout_expired",
        timestamp: new Date(),
      };

      const callback = createStateChangeAlertCallback();
      callback(event);

      const alerts = getPendingAlerts();
      expect(alerts[0].message).toContain("open to half_open");
    });
  });

  describe("Alert Queue Management (AC2)", () => {
    it("should track pending (unacknowledged) alerts", () => {
      const tripEvent: BreakerTripEvent = {
        name: "breaker-1",
        groupId: "group-1",
        timestamp: new Date(),
        reason: "threshold_exceeded",
        errorCount: 5,
        errorRate: 60,
        stateSnapshot: {} as any,
      };

      const tripCallback = createTripAlertCallback();
      tripCallback(tripEvent);

      const pending = getPendingAlerts();
      expect(pending.length).toBe(1);
      expect(pending[0].acknowledged).toBe(false);
    });

    it("should acknowledge alerts", async () => {
      const tripEvent: BreakerTripEvent = {
        name: "breaker-1",
        groupId: "group-1",
        timestamp: new Date(),
        reason: "threshold_exceeded",
        errorCount: 5,
        errorRate: 60,
        stateSnapshot: {} as any,
      };

      const tripCallback = createTripAlertCallback();
      await tripCallback(tripEvent);

      const pending = getPendingAlerts();
      const alertId = pending[0].id;

      const result = await acknowledgeAlert(alertId, "operator-1");
      expect(result).toBe(true);

      const stillPending = getPendingAlerts();
      expect(stillPending.length).toBe(0);

      const allAlerts = getAllAlerts();
      const acknowledged = allAlerts.find((a) => a.id === alertId);
      expect(acknowledged?.acknowledged).toBe(true);
      expect(acknowledged?.acknowledgedBy).toBe("operator-1");
    });

    it("should support multiple alerts", () => {
      const tripCallback = createTripAlertCallback();

      for (let i = 0; i < 5; i++) {
        const event: BreakerTripEvent = {
          name: `breaker-${i}`,
          groupId: "group-1",
          timestamp: new Date(),
          reason: "threshold_exceeded",
          errorCount: 5 + i,
          errorRate: 50 + i * 10,
          stateSnapshot: {} as any,
        };
        tripCallback(event);
      }

      const pending = getPendingAlerts();
      expect(pending.length).toBe(5);
    });

    it("should get alert by ID", () => {
      const tripEvent: BreakerTripEvent = {
        name: "breaker-1",
        groupId: "group-1",
        timestamp: new Date(),
        reason: "threshold_exceeded",
        errorCount: 5,
        errorRate: 60,
        stateSnapshot: {} as any,
      };

      const tripCallback = createTripAlertCallback();
      tripCallback(tripEvent);

      const pending = getPendingAlerts();
      const alertId = pending[0].id;

      const alert = getAlert(alertId);
      expect(alert).toBeDefined();
      expect(alert?.breakerName).toBe("breaker-1");
    });

    it("should return undefined for non-existent alert", () => {
      const alert = getAlert("non-existent-id");
      expect(alert).toBeUndefined();
    });
  });

  describe("Alert Callbacks", () => {
    it("should trigger registered callbacks on new alerts", () => {
      const customCallback = vi.fn();
      onAlert(customCallback);

      const tripCallback = createTripAlertCallback();
      const event: BreakerTripEvent = {
        name: "breaker-1",
        groupId: "group-1",
        timestamp: new Date(),
        reason: "threshold_exceeded",
        errorCount: 5,
        errorRate: 60,
        stateSnapshot: {} as any,
      };

      tripCallback(event);

      expect(customCallback).toHaveBeenCalled();

      offAlert(customCallback);
    });

    it("should support removing callbacks", () => {
      const customCallback = vi.fn();
      onAlert(customCallback);
      offAlert(customCallback);

      const tripCallback = createTripAlertCallback();
      const event: BreakerTripEvent = {
        name: "breaker-1",
        groupId: "group-1",
        timestamp: new Date(),
        reason: "threshold_exceeded",
        errorCount: 5,
        errorRate: 60,
        stateSnapshot: {} as any,
      };

      tripCallback(event);

      expect(customCallback).not.toHaveBeenCalled();
    });
  });

  describe("Logging (AC2)", () => {
    it("should log trip events to PostgreSQL", async () => {
      vi.mock("../postgres/queries/insert-trace", () => ({
        insertEvent: vi.fn().mockResolvedValue({
          id: 1,
          group_id: "test-group",
          event_type: "circuit_breaker_trip",
          created_at: new Date(),
          agent_id: "circuit-breaker",
          workflow_id: null,
          step_id: null,
          parent_event_id: null,
          metadata: {},
          outcome: {},
          status: "completed",
          error_message: null,
          error_code: null,
          inserted_at: new Date(),
        }),
      }));

      const tripCallback = createTripAlertCallback();
      const event: BreakerTripEvent = {
        name: "breaker-1",
        groupId: "test-group",
        timestamp: new Date(),
        reason: "threshold_exceeded",
        errorCount: 5,
        errorRate: 60,
        stateSnapshot: {} as any,
      };

      await tripCallback(event);

      vi.unmock("../postgres/queries/insert-trace");
    });
  });

  describe("Severity Determination", () => {
    it("should set warning severity for moderate error rates", () => {
      const event: BreakerTripEvent = {
        name: "breaker-1",
        groupId: "group-1",
        timestamp: new Date(),
        reason: "threshold_exceeded",
        errorCount: 5,
        errorRate: 50,
        stateSnapshot: {} as any,
      };

      const callback = createTripAlertCallback();
      callback(event);

      const alerts = getPendingAlerts();
      expect(alerts[0].severity).toBe("warning");
    });

    it("should set critical severity for high error rates", () => {
      const event: BreakerTripEvent = {
        name: "breaker-1",
        groupId: "group-1",
        timestamp: new Date(),
        reason: "threshold_exceeded",
        errorCount: 10,
        errorRate: 85,
        stateSnapshot: {} as any,
      };

      const callback = createTripAlertCallback();
      callback(event);

      const alerts = getPendingAlerts();
      expect(alerts[0].severity).toBe("critical");
    });

    it("should set info severity for reset events", () => {
      const event: BreakerResetEvent = {
        name: "breaker-1",
        groupId: "group-1",
        timestamp: new Date(),
        reason: "manual_reset",
        stateSnapshot: {} as any,
      };

      const callback = createResetAlertCallback();
      callback(event);

      const alerts = getPendingAlerts();
      expect(alerts[0].severity).toBe("info");
    });
  });

  describe("Message Generation", () => {
    it("should generate informative trip message", () => {
      const event: BreakerTripEvent = {
        name: "api-breaker",
        groupId: "production",
        timestamp: new Date(),
        reason: "threshold_exceeded",
        errorCount: 7,
        errorRate: 72.5,
        stateSnapshot: {} as any,
      };

      const callback = createTripAlertCallback();
      callback(event);

      const alerts = getPendingAlerts();
      expect(alerts[0].message).toContain("api-breaker");
      expect(alerts[0].message).toContain("production");
      expect(alerts[0].message).toContain("72.5%");
      expect(alerts[0].message).toContain("7");
    });

    it("should include last error in trip message when available", () => {
      const event: BreakerTripEvent = {
        name: "breaker-1",
        groupId: "group-1",
        timestamp: new Date(),
        reason: "threshold_exceeded",
        errorCount: 5,
        errorRate: 50,
        lastError: {
          timestamp: new Date(),
          message: "ECONNREFUSED",
          errorType: "NetworkError",
          severity: "transient",
          operation: "api-call",
        },
        stateSnapshot: {} as any,
      };

      const callback = createTripAlertCallback();
      callback(event);

      const alerts = getPendingAlerts();
      expect(alerts[0].context.lastError).toBe("ECONNREFUSED");
    });
  });
});