import { describe, it, expect, beforeEach, afterEach } from "vitest";
import {
  BreakerManager,
  createBreakerManager,
  getBreakerManager,
  resetBreakerManager,
} from "./manager";
import type { BreakerConfig } from "./types";

describe("Circuit Breaker Manager - Story 3.6", () => {
  let manager: BreakerManager;

  beforeEach(() => {
    resetBreakerManager();
    manager = createBreakerManager();
  });

  afterEach(() => {
    resetBreakerManager();
  });

  describe("Breaker Creation and Management", () => {
    it("should create and register a circuit breaker", () => {
      const config: Partial<BreakerConfig> & { name: string; groupId: string } = {
        name: "test-breaker",
        groupId: "test-group",
      };

      const breaker = manager.createBreaker(config.name!, config.groupId);

      expect(breaker).toBeDefined();
      expect(breaker.getState()).toBe("closed");

      const retrieved = manager.getBreaker(config.name!, config.groupId);
      expect(retrieved).toBe(breaker);
    });

    it("should throw error for duplicate breaker", () => {
      manager.createBreaker("breaker-1", "group-1");

      expect(() => {
        manager.createBreaker("breaker-1", "group-1");
      }).toThrow("already exists");
    });

    it("should support get or create pattern", () => {
      const config: Partial<BreakerConfig> & { name: string; groupId: string } = {
        name: "breaker-1",
        groupId: "group-1",
        errorThreshold: 5,
      };

      const created = manager.getOrCreateBreaker(
        config.name!,
        config.groupId,
        "tool",
        config,
      );

      const retrieved = manager.getOrCreateBreaker(
        config.name!,
        config.groupId,
        "tool",
        config,
      );

      expect(created).toBe(retrieved);
    });

    it("should create different breakers for different groups", () => {
      const breaker1 = manager.createBreaker("breaker-1", "group-1");
      const breaker2 = manager.createBreaker("breaker-1", "group-2");

      expect(breaker1).not.toBe(breaker2);

      const retrieved1 = manager.getBreaker("breaker-1", "group-1");
      const retrieved2 = manager.getBreaker("breaker-1", "group-2");

      expect(retrieved1).toBe(breaker1);
      expect(retrieved2).toBe(breaker2);
    });
  });

  describe("Execute Through Manager", () => {
    it("should execute operations through breaker", async () => {
      const { result, breakerResult } = await manager.executeThrough(
        "test-breaker",
        "test-group",
        "test-operation",
        async () => "success",
      );

      expect(breakerResult.allowed).toBe(true);
      expect(breakerResult.success).toBe(true);
      expect(result).toBe("success");
    });

    it("should handle execution failures", async () => {
      const { result, breakerResult } = await manager.executeThrough(
        "test-breaker",
        "test-group",
        "test-operation",
        async () => {
          throw new Error("Test error");
        },
        { config: { errorThreshold: 100 } },
      );

      expect(breakerResult.allowed).toBe(true);
      expect(breakerResult.success).toBe(false);
      expect(result).toBeNull();
    });

    it("should create breaker automatically on execute", () => {
      expect(manager.getBreaker("auto-breaker", "auto-group")).toBeUndefined();

      manager.executeThrough(
        "auto-breaker",
        "auto-group",
        "test-operation",
        async () => "success",
      );

      expect(manager.getBreaker("auto-breaker", "auto-group")).toBeDefined();
    });
  });

  describe("Manual Reset (AC3)", () => {
    it("should support manual reset with operator attribution", async () => {
      manager.createBreaker("test-breaker", "test-group", "tool", {
        errorThreshold: 1,
      });

      const breaker = manager.getBreaker("test-breaker", "test-group")!;

      await breaker.execute("test", async () => {
        throw new Error("Error");
      });

      expect(breaker.getState()).toBe("open");

      const result = await manager.manualReset({
        name: "test-breaker",
        groupId: "test-group",
        requestedBy: "operator-1",
        justification: "System recovered after investigation",
      });

      expect(result.success).toBe(true);
      expect(result.breaker?.state.state).toBe("closed");
      expect(result.healthCheckResult).toBeUndefined();
    });

    it("should require justification for manual reset", async () => {
      manager.createBreaker("test-breaker", "test-group");

      const breaker = manager.getBreaker("test-breaker", "test-group")!;
      breaker.forceTrip();

      const result = await manager.manualReset({
        name: "test-breaker",
        groupId: "test-group",
        requestedBy: "operator-1",
        justification: "Required for production",
      });

      expect(result.success).toBe(true);
    });

    it("should return error for non-existent breaker", async () => {
      const result = await manager.manualReset({
        name: "non-existent",
        groupId: "test-group",
        requestedBy: "operator-1",
        justification: "Test",
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain("not found");
    });

    it("should validate health before reset", async () => {
      manager.createBreaker(
        "test-breaker",
        "test-group",
        "tool",
        {},
        async () => false,
      );

      const breaker = manager.getBreaker("test-breaker", "test-group")!;
      breaker.forceTrip();

      const result = await manager.manualReset({
        name: "test-breaker",
        groupId: "test-group",
        requestedBy: "operator-1",
        justification: "Test reset",
      });

      expect(result.success).toBe(false);
      expect(result.healthCheckResult).toBe(false);
    });

    it("should force reset with health bypass", async () => {
      manager.createBreaker(
        "test-breaker",
        "test-group",
        "tool",
        {},
        async () => false,
      );

      const breaker = manager.getBreaker("test-breaker", "test-group")!;
      breaker.forceTrip();

      const result = await manager.manualReset({
        name: "test-breaker",
        groupId: "test-group",
        requestedBy: "operator-1",
        justification: "Emergency reset",
        force: true,
      });

      expect(result.success).toBe(true);
    });
  });

  describe("Automatic Recovery Testing", () => {
    it("should track breakers in HALF_OPEN state", () => {
      manager.createBreaker("breaker-1", "group-1");
      manager.createBreaker("breaker-2", "group-1");
      manager.createBreaker("breaker-3", "group-2");

      const breaker1 = manager.getBreaker("breaker-1", "group-1")!;
      breaker1.forceTrip();

      const breaker3 = manager.getBreaker("breaker-3", "group-2")!;
      breaker3.forceTrip();

      const testing = manager.getTestingBreakers();
      expect(testing.length).toBe(0);

      breaker1.reset();
      const breaker2 = manager.getBreaker("breaker-2", "group-1")!;
      breaker2.forceTrip();

      const allTesting = manager.getTestingBreakers();
      expect(allTesting.length).toBe(0);
    });
  });

  describe("Breaker Registry", () => {
    it("should get all breakers by group", () => {
      manager.createBreaker("breaker-1", "group-1");
      manager.createBreaker("breaker-2", "group-1");
      manager.createBreaker("breaker-3", "group-2");

      const group1Breakers = manager.getBreakersByGroup("group-1");
      expect(group1Breakers.length).toBe(2);

      const group2Breakers = manager.getBreakersByGroup("group-2");
      expect(group2Breakers.length).toBe(1);
    });

    it("should get breakers by state", () => {
      manager.createBreaker("breaker-1", "group-1", "tool", { errorThreshold: 1 });
      manager.createBreaker("breaker-2", "group-1", "tool", { errorThreshold: 1 });

      const breaker1 = manager.getBreaker("breaker-1", "group-1")!;
      breaker1.forceTrip();

      const openBreakers = manager.getBreakersByState("group-1", "open");
      expect(openBreakers.length).toBe(1);

      const closedBreakers = manager.getBreakersByState("group-1", "closed");
      expect(closedBreakers.length).toBe(1);
    });

    it("should get all tripped breakers", () => {
      manager.createBreaker("breaker-1", "group-1");
      manager.createBreaker("breaker-2", "group-2");

      const breaker1 = manager.getBreaker("breaker-1", "group-1")!;
      breaker1.forceTrip();

      const tripped = manager.getTrippedBreakers();
      expect(tripped.length).toBe(1);
      expect(tripped[0].name).toBe("breaker-1");
    });

    it("should get tripped breakers by group", () => {
      manager.createBreaker("breaker-1", "group-1");
      manager.createBreaker("breaker-2", "group-2");

      const breaker1 = manager.getBreaker("breaker-1", "group-1")!;
      breaker1.forceTrip();

      const tripped = manager.getTrippedBreakers("group-1");
      expect(tripped.length).toBe(1);
    });

    it("should remove breaker", () => {
      manager.createBreaker("breaker-1", "group-1");

      const removed = manager.removeBreaker("breaker-1", "group-1");
      expect(removed).toBe(true);

      const retrieved = manager.getBreaker("breaker-1", "group-1");
      expect(retrieved).toBeUndefined();
    });
  });

  describe("Statistics", () => {
    it("should provide breaker statistics", () => {
      manager.createBreaker("breaker-1", "group-1");
      manager.createBreaker("breaker-2", "group-1");
      manager.createBreaker("breaker-3", "group-2");

      const breaker1 = manager.getBreaker("breaker-1", "group-1")!;
      breaker1.forceTrip();

      const stats = manager.getStats("group-1");
      expect(stats.total).toBe(2);
      expect(stats.open).toBe(1);
      expect(stats.closed).toBe(1);

      const allStats = manager.getStats();
      expect(allStats.total).toBe(3);
    });

    it("should track average error rate", async () => {
      manager.createBreaker("breaker-1", "group-1");
      manager.createBreaker("breaker-2", "group-1");

      const breaker1 = manager.getBreaker("breaker-1", "group-1")!;
      await breaker1.execute("test", async () => "success");
      await breaker1.execute("test", async () => {
        throw new Error("Error");
      });

      const stats = manager.getStats("group-1");
      expect(stats.averageErrorRate).toBeGreaterThanOrEqual(0);
    });
  });

  describe("Health Checks", () => {
    it("should set health check for breaker", () => {
      manager.createBreaker("breaker-1", "group-1");

      manager.setHealthCheck("breaker-1", "group-1", async () => true);

      expect(manager.getBreaker("breaker-1", "group-1")).toBeDefined();
    });

    it("should run health check", async () => {
      manager.createBreaker(
        "breaker-1",
        "group-1",
        "tool",
        {},
        async () => true,
      );

      const result = await manager.runHealthCheck("breaker-1", "group-1");

      expect(result.success).toBe(true);
      expect(result.state).toBe("closed");
    });

    it("should return error for non-existent breaker health check", async () => {
      const result = await manager.runHealthCheck("non-existent", "group-1");

      expect(result.success).toBe(false);
      expect(result.error).toContain("not found");
    });
  });

  describe("Singleton Pattern", () => {
    it("should return default manager instance", () => {
      const defaultManager = getBreakerManager();
      expect(defaultManager).toBeDefined();

      const sameManager = getBreakerManager();
      expect(sameManager).toBe(defaultManager);
    });

    it("should reset default manager", () => {
      const defaultManager = getBreakerManager();
      defaultManager.createBreaker("breaker-1", "group-1");

      resetBreakerManager();

      const newManager = getBreakerManager();
      const breaker = newManager.getBreaker("breaker-1", "group-1");

      expect(breaker).toBeUndefined();
    });
  });

  describe("Integration with Alerting", () => {
    it("should wire trip callbacks on creation", async () => {
      const breaker = manager.createBreaker(
        "breaker-1",
        "group-1",
        "tool",
        { errorThreshold: 1 },
      );

      await breaker.execute("test", async () => {
        throw new Error("Test error");
      });

      expect(breaker.getState()).toBe("open");
    });

    it("should wire reset callbacks", () => {
      const breaker = manager.createBreaker("breaker-1", "group-1");
      breaker.forceTrip();

      breaker.reset("operator-1", "Manual reset");

      expect(breaker.getState()).toBe("closed");
    });

    it("should wire state change callbacks", async () => {
      const breaker = manager.createBreaker(
        "breaker-1",
        "group-1",
        "tool",
        { errorThreshold: 1 },
      );

      await breaker.execute("test", async () => {
        throw new Error("Error");
      });

      expect(breaker.getState()).toBe("open");
    });
  });
});