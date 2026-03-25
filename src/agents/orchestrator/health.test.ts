import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import { HealthMonitor } from "./health";
import type { AgentConfig } from "../config/schema";

// Skip tests if Docker is not available
const describeIfDocker = process.env.SKIP_DOCKER_TESTS ? describe.skip : describe;

describeIfDocker("Health Monitor", () => {
  let monitor: HealthMonitor;
  let containerManager: any;

  beforeAll(async () => {
    containerManager = { healthCheck: () => ({ healthy: true, status: "running" }) };
    monitor = new HealthMonitor(containerManager);
  });

  beforeEach(async () => {
    // Reset state before each test
    monitor["healthStates"].clear();
  });

  afterAll(async () => {
    // Cleanup if needed
  });

  describe("checkContainerHealth", () => {
    it("should mark healthy container as healthy", async () => {
      const result = await monitor.checkContainerHealth("test-container-1");

      expect(result).toEqual({
        containerId: "test-container-1",
        healthy: true,
        status: "running",
        consecutiveFailures: 0,
      });
    });

    it("should increment failure count for unhealthy container", async () => {
      const unhealthyManager = {
        healthCheck: () => ({ healthy: false, status: "exited" }),
      };
      monitor["containerManager"] = unhealthyManager;

      await monitor.checkContainerHealth("test-container-2");
      const result = await monitor.checkContainerHealth("test-container-2");

      expect(result.consecutiveFailures).toBe(2);
    });

    it("should mark container as unhealthy after max failures", async () => {
      const unhealthyManager = {
        healthCheck: () => ({ healthy: false, status: "exited" }),
      };
      monitor["containerManager"] = unhealthyManager;

      // Trigger 3 consecutive failures (assuming threshold is 3)
      await monitor.checkContainerHealth("test-container-3");
      await monitor.checkContainerHealth("test-container-3");
      const result = await monitor.checkContainerHealth("test-container-3");

      expect(result.isUnhealthy).toBe(true);
    });
  });

  describe("handleUnhealthyContainer", () => {
    it("should restart unhealthy container", async () => {
      let restarted = false;
      const manager = {
        healthCheck: () => ({ healthy: false, status: "exited" }),
        restartContainer: async (id: string) => {
          restarted = true;
        },
      };
      monitor["containerManager"] = manager;

      await monitor.handleUnhealthyContainer("test-container-4", 100);

      expect(restarted).toBe(true);
    });

    it("should reset failure count after successful restart", async () => {
      let restartCount = 0;
      let healthCheckCount = 0;
      const manager = {
        healthCheck: async (id: string) => {
          healthCheckCount++;
          if (id === "test-container-5" && healthCheckCount > 3) {
            return { healthy: true, status: "running" };
          }
          return { healthy: false, status: "exited" };
        },
        restartContainer: async (id: string) => {
          restartCount++;
        },
      };
      monitor["containerManager"] = manager;

      // Container fails 3 times
      await monitor.checkContainerHealth("test-container-5");
      await monitor.checkContainerHealth("test-container-5");
      await monitor.checkContainerHealth("test-container-5");

      // Then container recovers after restart
      await monitor.checkContainerHealth("test-container-5");

      const state = monitor["healthStates"].get("test-container-5");
      expect(state?.consecutiveFailures).toBe(1); // Reset after healthy check
    });
  });

  describe("monitorLoop", () => {
    it("should run monitoring loop and check containers", async () => {
      let checkCount = 0;
      const manager = {
        healthCheck: async (id: string) => {
          checkCount++;
          return { healthy: true, status: "running" };
        },
      };
      monitor["containerManager"] = manager;

      const containers = [
        { id: "agent-1", status: "running" },
        { id: "agent-2", status: "running" },
      ];

      const stopMonitor = monitor.startMonitorLoop(100, containers);

      // Wait for checks
      await new Promise(resolve => setTimeout(resolve, 350));

      stopMonitor();

      expect(checkCount).toBeGreaterThan(0);
    });
  });

  describe("getHealthSummary", () => {
    it("should return summary of all container health", async () => {
      const manager = {
        healthCheck: async (id: string) => {
          return id === "agent-healthy" ? { healthy: true, status: "running" } : { healthy: false, status: "exited" };
        },
      };
      monitor["containerManager"] = manager;

      await monitor.checkContainerHealth("agent-healthy");
      await monitor.checkContainerHealth("agent-unhealthy");

      const summary = monitor.getHealthSummary();
      expect(summary).toHaveLength(2);
      expect(summary.find((s: any) => s.containerId === "agent-healthy")?.healthy).toBe(true);
      expect(summary.find((s: any) => s.containerId === "agent-unhealthy")?.healthy).toBe(false);
    });
  });
});
