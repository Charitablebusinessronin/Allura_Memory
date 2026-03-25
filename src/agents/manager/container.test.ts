import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import { AgentContainerManager } from "./container";
import type { AgentConfig } from "../config/schema";

// Skip these tests if Docker is not available
const describeIfDocker = process.env.SKIP_DOCKER_TESTS ? describe.skip : describe;

describeIfDocker("Agent Container Manager", () => {
  let manager: AgentContainerManager;

  beforeAll(async () => {
    manager = new AgentContainerManager();
  });

  beforeEach(async () => {
    // Cleanup test containers before each test
    const containers = await manager.listContainers("test-");
    for (const container of containers) {
      await manager.removeContainer(container.id);
    }
  });

  afterAll(async () => {
    // Final cleanup
    const containers = await manager.listContainers("test-");
    for (const container of containers) {
      await manager.removeContainer(container.id);
    }
  });

  const mockAgentConfig: AgentConfig = {
    name: "test-agent",
    type: "knowledge-curator",
    enabled: true,
    schedule: { interval_seconds: 300 },
    resources: { memory_mb: 256, cpu_percent: 50, timeout_seconds: 300 },
    restart_policy: "unless-stopped",
    notion: { sync: false },
    config: { task: "test" },
  };

  describe("createContainer", () => {
    it("should create a container with correct config", async () => {
      const container = await manager.createContainer(mockAgentConfig, "test-group");

      expect(container.id).toBeDefined();
      expect(container.name).toBe("test-agent");
      expect(container.agentId).toBe("agent-test-agent-test-group");
      expect(container.status).toBe("created");
    });

    it("should set correct resource limits", async () => {
      const container = await manager.createContainer(mockAgentConfig, "test-group");
      const info = await manager.getContainerInfo(container.id);

      expect(info).not.toBeNull();
      expect(info!.memoryLimit).toBe(256 * 1024 * 1024); // 256MB in bytes
    });
  });

  describe("startContainer", () => {
    it("should start a created container", async () => {
      const container = await manager.createContainer(mockAgentConfig, "test-group");
      await manager.startContainer(container.id);

      const info = await manager.getContainerInfo(container.id);
      expect(info).not.toBeNull();
      expect(info!.status).toMatch(/running|Up/);
    });

    it("should throw on non-existent container", async () => {
      await expect(
        manager.startContainer("non-existent-id")
      ).rejects.toThrow("Container not found");
    });
  });

  describe("stopContainer", () => {
    it("should stop a running container", async () => {
      const container = await manager.createContainer(mockAgentConfig, "test-group");
      await manager.startContainer(container.id);
      await manager.stopContainer(container.id);

      const info = await manager.getContainerInfo(container.id);
      expect(info).not.toBeNull();
      expect(info!.status).toMatch(/exited|stopped/);
    });
  });

  describe("getContainerInfo", () => {
    it("should return null for non-existent container", async () => {
      const info = await manager.getContainerInfo("non-existent-id");
      expect(info).toBeNull();
    });

    it("should return container details", async () => {
      const container = await manager.createContainer(mockAgentConfig, "test-group");
      const info = await manager.getContainerInfo(container.id);

      expect(info).toBeDefined();
      expect(info?.name).toBe("test-agent");
      expect(info?.agentId).toBe("agent-test-agent-test-group");
    });
  });

  describe("listContainers", () => {
    it("should list containers by group", async () => {
      const config1: AgentConfig = { ...mockAgentConfig, name: "agent-1" };
      const config2: AgentConfig = { ...mockAgentConfig, name: "agent-2" };

      await manager.createContainer(config1, "test-group");
      await manager.createContainer(config2, "test-group");

      const containers = await manager.listContainers("test-group");

      expect(containers).toHaveLength(2);
      expect(containers.map((c: { name: string }) => c.name)).toContain("agent-1");
      expect(containers.map((c: { name: string }) => c.name)).toContain("agent-2");
    });
  });

  describe("healthCheck", () => {
    it("should detect healthy running container", async () => {
      const container = await manager.createContainer(mockAgentConfig, "test-group");
      await manager.startContainer(container.id);

      // Wait a moment for container to start
      await new Promise(resolve => setTimeout(resolve, 500));

      const health = await manager.healthCheck(container.id);
      expect(health.healthy).toBe(true);
      expect(health.status).toBe("running");
    });

    it("should detect stopped container as unhealthy", async () => {
      const container = await manager.createContainer(mockAgentConfig, "test-group");

      const health = await manager.healthCheck(container.id);
      expect(health.healthy).toBe(false);
      expect(health.status).toBe("created");
    });
  });

  describe("removeContainer", () => {
    it("should remove a container", async () => {
      const container = await manager.createContainer(mockAgentConfig, "test-group");
      await manager.removeContainer(container.id);

      const info = await manager.getContainerInfo(container.id);
      expect(info).toBeNull();
    });
  });

  describe("restart policies", () => {
    it("should apply restart policy to container", async () => {
      const config: AgentConfig = {
        ...mockAgentConfig,
        restart_policy: "always",
      };

      const container = await manager.createContainer(config, "test-group");
      const info = await manager.getContainerInfo(container.id);

      expect(info).not.toBeNull();
      expect(info!.restartPolicy).toBe("always");
    });
  });
});
