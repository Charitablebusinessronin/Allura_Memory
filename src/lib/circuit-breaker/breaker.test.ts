import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
  CircuitBreaker,
  createCircuitBreaker,
} from "./breaker";
import type { BreakerState, BreakerConfig } from "./types";

describe("CircuitBreaker - Story 3.6", () => {
  let breaker: CircuitBreaker;
  const defaultConfig: Partial<BreakerConfig> & { name: string; groupId: string } = {
    name: "test-breaker",
    groupId: "test-group",
    errorThreshold: 3,
    errorRateThreshold: 50,
    minimumCalls: 5,
    openTimeoutMs: 1000,
    successThreshold: 2,
    halfOpenFailureThreshold: 1,
    trackingWindowMs: 5000,
  };

  beforeEach(() => {
    breaker = createCircuitBreaker(defaultConfig);
  });

  describe("State Machine", () => {
    it("should start in CLOSED state", () => {
      expect(breaker.getState()).toBe("closed");
    });

    it("should transition to OPEN when error threshold is exceeded (AC1)", async () => {
      const tripCallback = vi.fn();
      breaker.onTrip(tripCallback);

      for (let i = 0; i < defaultConfig.errorThreshold!; i++) {
        await breaker.execute("test", async () => {
          throw new Error(`Error ${i + 1}`);
        });
      }

      expect(breaker.getState()).toBe("open");
      expect(tripCallback).toHaveBeenCalledTimes(1);
    });

    it("should reject calls when in OPEN state", async () => {
      for (let i = 0; i < defaultConfig.errorThreshold!; i++) {
        await breaker.execute("test", async () => {
          throw new Error("Error");
        });
      }

      expect(breaker.getState()).toBe("open");

      const result = await breaker.execute("test", async () => "success");

      expect(result.allowed).toBe(false);
      expect(result.rejectionReason).toContain("open");
    });

    it("should transition to HALF_OPEN after timeout expires", async () => {
      vi.useFakeTimers();

      const breaker = createCircuitBreaker({
        ...defaultConfig,
        openTimeoutMs: 100,
      });

      for (let i = 0; i < defaultConfig.errorThreshold!; i++) {
        await breaker.execute("test", async () => {
          throw new Error("Error");
        });
      }

      expect(breaker.getState()).toBe("open");

      vi.advanceTimersByTime(150);

      const canExecute = breaker.canExecute();
      expect(canExecute).toBe(true);
      expect(breaker.getState()).toBe("half_open");

      vi.useRealTimers();
    });

    it("should transition from HALF_OPEN to CLOSED after success threshold", async () => {
      vi.useFakeTimers();

      const breaker = createCircuitBreaker({
        ...defaultConfig,
        openTimeoutMs: 100,
        successThreshold: 2,
      });

      for (let i = 0; i < defaultConfig.errorThreshold!; i++) {
        await breaker.execute("test", async () => {
          throw new Error("Error");
        });
      }

      vi.advanceTimersByTime(150);
      breaker.canExecute();

      expect(breaker.getState()).toBe("half_open");

      for (let i = 0; i < 2; i++) {
        await breaker.execute("test", async () => "success");
      }

      expect(breaker.getState()).toBe("closed");

      vi.useRealTimers();
    });

    it("should transition from HALF_OPEN back to OPEN on failure", async () => {
      vi.useFakeTimers();

      const breaker = createCircuitBreaker({
        ...defaultConfig,
        openTimeoutMs: 100,
        halfOpenFailureThreshold: 1,
      });

      for (let i = 0; i < defaultConfig.errorThreshold!; i++) {
        await breaker.execute("test", async () => {
          throw new Error("Error");
        });
      }

      vi.advanceTimersByTime(150);
      breaker.canExecute();

      expect(breaker.getState()).toBe("half_open");

      await breaker.execute("test", async () => {
        throw new Error("Error");
      });

      expect(breaker.getState()).toBe("open");

      vi.useRealTimers();
    });
  });

  describe("Error Tracking", () => {
    it("should track consecutive errors", async () => {
      expect(breaker.getStateSnapshot().consecutiveErrors).toBe(0);

      await breaker.execute("test", async () => {
        throw new Error("Error 1");
      });
      expect(breaker.getStateSnapshot().consecutiveErrors).toBe(1);

      await breaker.execute("test", async () => {
        throw new Error("Error 2");
      });
      expect(breaker.getStateSnapshot().consecutiveErrors).toBe(2);
    });

    it("should reset consecutive errors on success", async () => {
      await breaker.execute("test", async () => {
        throw new Error("Error 1");
      });
      await breaker.execute("test", async () => {
        throw new Error("Error 2");
      });
      expect(breaker.getStateSnapshot().consecutiveErrors).toBe(2);

      await breaker.execute("test", async () => "success");
      expect(breaker.getStateSnapshot().consecutiveErrors).toBe(0);
    });

    it("should calculate error rate correctly", async () => {
      for (let i = 0; i < 3; i++) {
        await breaker.execute("test", async () => "success");
      }

      for (let i = 0; i < 2; i++) {
        await breaker.execute("test", async () => {
          throw new Error("Error");
        });
      }

      const snapshot = breaker.getStateSnapshot();
      expect(snapshot.totalCalls).toBe(5);
      expect(snapshot.errorRate).toBe(40);
    });
  });

  describe("Error Rate Threshold", () => {
    it("should trip on error rate threshold", async () => {
      const breaker = createCircuitBreaker({
        ...defaultConfig,
        errorThreshold: 100, // Disable consecutive error threshold
        errorRateThreshold: 50,
        minimumCalls: 5,
        volumeThreshold: 10,
      });

      const successCount = 5;
      const failureCount = 5;

      for (let i = 0; i < successCount; i++) {
        await breaker.execute("test", async () => "success");
      }

      for (let i = 0; i < failureCount; i++) {
        await breaker.execute("test", async () => {
          throw new Error("Error");
        });
      }

      // After 10 calls with 50% error rate and volumeThreshold=10, it should trip
      expect(breaker.getState()).toBe("open");
    });

    it("should not trip before minimum calls", async () => {
      const breaker = createCircuitBreaker({
        ...defaultConfig,
        errorThreshold: 100,
        errorRateThreshold: 1,
        minimumCalls: 10,
      });

      for (let i = 0; i < 5; i++) {
        await breaker.execute("test", async () => {
          throw new Error("Error");
        });
      }

      expect(breaker.getState()).toBe("closed");
    });
  });

  describe("Manual Reset (AC3)", () => {
    it("should support manual reset from OPEN state", async () => {
      for (let i = 0; i < defaultConfig.errorThreshold!; i++) {
        await breaker.execute("test", async () => {
          throw new Error("Error");
        });
      }

      expect(breaker.getState()).toBe("open");

      const resetCallback = vi.fn();
      breaker.onReset(resetCallback);

      breaker.reset("operator-1", "System healthy after investigation");

      expect(breaker.getState()).toBe("closed");
      expect(breaker.getStateSnapshot().consecutiveErrors).toBe(0);
      expect(resetCallback).toHaveBeenCalled();
    });

    it("should not affect CLOSED state on reset", () => {
      expect(breaker.getState()).toBe("closed");

      breaker.reset("operator-1", "No-op");

      expect(breaker.getState()).toBe("closed");
    });

    it("should support force trip for testing", async () => {
      expect(breaker.getState()).toBe("closed");

      breaker.forceTrip();

      expect(breaker.getState()).toBe("open");

      const result = await breaker.execute("test", async () => "success");
      expect(result.allowed).toBe(false);
    });
  });

  describe("State Snapshots", () => {
    it("should provide complete state snapshot", async () => {
      await breaker.execute("test1", async () => "success");
      await breaker.execute("test2", async () => {
        throw new Error("Test error");
      });

      const snapshot = breaker.getStateSnapshot();

      expect(snapshot.state).toBe("closed");
      expect(snapshot.name).toBe(defaultConfig.name);
      expect(snapshot.groupId).toBe(defaultConfig.groupId);
      expect(snapshot.totalCalls).toBe(2);
      expect(snapshot.totalFailures).toBe(1);
      expect(snapshot.totalSuccesses).toBe(1);
      expect(snapshot.errorRate).toBe(50);
      expect(snapshot.tripCount).toBe(0);
    });

    it("should track last error in snapshot", async () => {
      await breaker.execute("test", async () => {
        throw new Error("Specific error");
      });

      const snapshot = breaker.getStateSnapshot();

      expect(snapshot.lastError).toBeDefined();
      expect(snapshot.lastError?.message).toBe("Specific error");
      expect(snapshot.lastError?.operation).toBe("test");
    });

    it("should track trip count", async () => {
      expect(breaker.getStateSnapshot().tripCount).toBe(0);

      breakpoint: for (let round = 0; round < 2; round++) {
        for (let i = 0; i < defaultConfig.errorThreshold!; i++) {
          await breaker.execute("test", async () => {
            throw new Error("Error");
          });
        }

        expect(breaker.getState()).toBe("open");

        breaker.reset(`operator-${round}`, "Reset for testing");
      }

      expect(breaker.getStateSnapshot().tripCount).toBe(2);
    });
  });

  describe("Callbacks", () => {
    it("should call trip callback when breaker trips", async () => {
      const tripCallback = vi.fn();
      breaker.onTrip(tripCallback);

      for (let i = 0; i < defaultConfig.errorThreshold!; i++) {
        await breaker.execute("test", async () => {
          throw new Error("Error");
        });
      }

      expect(tripCallback).toHaveBeenCalledTimes(1);
      expect(tripCallback).toHaveBeenCalledWith(
        expect.objectContaining({
          name: defaultConfig.name,
          groupId: defaultConfig.groupId,
          reason: "threshold_exceeded",
        }),
      );
    });

    it("should call reset callback when breaker resets", async () => {
      const resetCallback = vi.fn();
      breaker.onReset(resetCallback);

      for (let i = 0; i < defaultConfig.errorThreshold!; i++) {
        await breaker.execute("test", async () => {
          throw new Error("Error");
        });
      }

      breaker.reset("operator-1", "System recovered");

      expect(resetCallback).toHaveBeenCalledTimes(1);
      expect(resetCallback).toHaveBeenCalledWith(
        expect.objectContaining({
          name: defaultConfig.name,
          groupId: defaultConfig.groupId,
          resetBy: "operator-1",
          justification: "System recovered",
        }),
      );
    });

    it("should call state change callback on transitions", async () => {
      const stateChangeCallback = vi.fn();
      breaker.onStateChange(stateChangeCallback);

      for (let i = 0; i < defaultConfig.errorThreshold!; i++) {
        await breaker.execute("test", async () => {
          throw new Error("Error");
        });
      }

      expect(stateChangeCallback).toHaveBeenCalledWith(
        expect.objectContaining({
          fromState: "closed",
          toState: "open",
        }),
      );
    });

    it("should allow removing callbacks", async () => {
      const tripCallback = vi.fn();
      breaker.onTrip(tripCallback);

      breaker.offTrip(tripCallback);

      for (let i = 0; i < defaultConfig.errorThreshold!; i++) {
        await breaker.execute("test", async () => {
          throw new Error("Error");
        });
      }

      expect(tripCallback).not.toHaveBeenCalled();
    });
  });

  describe("Error Classification", () => {
    it("should classify transient errors", async () => {
      await breaker.execute("test", async () => {
        throw new Error("Connection timeout");
      });

      const snapshot = breaker.getStateSnapshot();
      expect(snapshot.lastError?.severity).toBe("transient");
    });

    it("should classify critical errors", async () => {
      await breaker.execute("test", async () => {
        throw new Error("Authentication failed");
      });

      const snapshot = breaker.getStateSnapshot();
      expect(snapshot.lastError?.severity).toBe("critical");
    });

    it("should classify recoverable errors by default", async () => {
      await breaker.execute("test", async () => {
        throw new Error("Unknown error");
      });

      const snapshot = breaker.getStateSnapshot();
      expect(snapshot.lastError?.severity).toBe("recoverable");
    });
  });

  describe("Integration with Operations", () => {
    it("should allow operation execution in CLOSED state", async () => {
      const result = await breaker.execute("test", async () => "data");

      expect(result.allowed).toBe(true);
      expect(result.success).toBe(true);
      expect(result.result).toBe("data");
    });

    it("should track successful operations", async () => {
      await breaker.execute("operation1", async () => "result1");
      await breaker.execute("operation2", async () => "result2");

      const snapshot = breaker.getStateSnapshot();
      expect(snapshot.totalSuccesses).toBe(2);
      expect(snapshot.consecutiveSuccesses).toBe(2);
    });

    it("should track slow calls", async () => {
      vi.useFakeTimers();

      const breaker = createCircuitBreaker({
        ...defaultConfig,
        slowCallDurationMs: 100,
      });

      const slowOperation = async () => {
        await new Promise((resolve) => setTimeout(resolve, 150));
        return "slow";
      };

      // Start the operation
      const resultPromise = breaker.execute("slow", slowOperation);

      // Advance time past the slow call threshold
      vi.advanceTimersByTime(200);
      vi.runAllTimersAsync();

      const result = await resultPromise;

      vi.useRealTimers();

      expect(result.allowed).toBe(true);
      expect(result.success).toBe(true);
    });
  });

  describe("Configuration", () => {
    it("should use provided configuration", () => {
      const customConfig = {
        name: "custom-breaker",
        groupId: "custom-group",
        errorThreshold: 10,
        openTimeoutMs: 5000,
      };

      const customBreaker = createCircuitBreaker(customConfig);

      const snapshot = customBreaker.getStateSnapshot();
      expect(snapshot.config.errorThreshold).toBe(10);
      expect(snapshot.config.openTimeoutMs).toBe(5000);
    });

    it("should apply default configuration for missing values", () => {
      const minimalConfig = {
        name: "minimal-breaker",
        groupId: "minimal-group",
      };

      const minimalBreaker = createCircuitBreaker(minimalConfig);

      const snapshot = minimalBreaker.getStateSnapshot();
      expect(snapshot.config.name).toBe("minimal-breaker");
      expect(snapshot.config.groupId).toBe("minimal-group");
      expect(snapshot.config.errorThreshold).toBeGreaterThanOrEqual(1);
    });
  });
});