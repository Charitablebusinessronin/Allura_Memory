import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import { AgentRegistry } from "./client";
import type { AgentConfig } from "../config/schema";
import { getSession, closeDriver } from "@/lib/neo4j/connection";

// Skip these tests if Neo4j is not available
const describeIfNeo4j = process.env.SKIP_NEO4J_TESTS ? describe.skip : describe;

describeIfNeo4j("Agent Registry", () => {
  let registry: AgentRegistry;

  beforeAll(async () => {
    registry = new AgentRegistry();
  });

  beforeEach(async () => {
    const session = getSession();
    try {
      await session.run(`
        MATCH (r:AgentRun)-[:RUN_OF]->(a:Agent)
        WHERE a.group_id STARTS WITH "test-"
        DETACH DELETE r, a
      `);
      await session.run(`
        MATCH (a:Agent)
        WHERE a.group_id STARTS WITH "test-"
        DETACH DELETE a
      `);
    } finally {
      await session.close();
    }
  });

  afterAll(async () => {
    const session = getSession();
    try {
      await session.run(`
        MATCH (r:AgentRun)-[:RUN_OF]->(a:Agent)
        WHERE a.group_id STARTS WITH "test-"
        DETACH DELETE r, a
      `);
      await session.run(`
        MATCH (a:Agent)
        WHERE a.group_id STARTS WITH "test-"
        DETACH DELETE a
      `);
    } finally {
      await session.close();
    }
    await closeDriver();
  });

  const mockAgentConfig: AgentConfig = {
    name: "test-agent",
    type: "knowledge-curator",
    enabled: true,
    schedule: { cron: "0 * * * *" },
    resources: { memory_mb: 512, cpu_percent: 50, timeout_seconds: 300 },
    restart_policy: "unless-stopped",
    notion: { sync: true },
    config: { min_confidence: 0.7 },
  };

  describe("createAgent", () => {
    it("should create a new agent node", async () => {
      const agent = await registry.createAgent(mockAgentConfig, "test-group");

      expect(agent.id).toBe("agent-test-agent-test-group");
      expect(agent.name).toBe("test-agent");
      expect(agent.type).toBe("knowledge-curator");
      expect(agent.group_id).toBe("test-group");
      expect(agent.status).toBe("Pending");
    });

    it("should throw on duplicate agent name", async () => {
      await registry.createAgent(mockAgentConfig, "test-group");

      await expect(
        registry.createAgent(mockAgentConfig, "test-group")
      ).rejects.toThrow("Agent already exists");
    });
  });

  describe("getAgent", () => {
    it("should retrieve agent by name and group_id", async () => {
      await registry.createAgent(mockAgentConfig, "test-group");

      const agent = await registry.getAgent("test-agent", "test-group");

      expect(agent).toBeDefined();
      expect(agent?.name).toBe("test-agent");
      expect(agent?.group_id).toBe("test-group");
    });

    it("should return null for non-existent agent", async () => {
      const agent = await registry.getAgent("non-existent", "test-group");

      expect(agent).toBeNull();
    });
  });

  describe("listAgents", () => {
    it("should list agents by group_id", async () => {
      const agent1: AgentConfig = { ...mockAgentConfig, name: "agent-1" };
      const agent2: AgentConfig = { ...mockAgentConfig, name: "agent-2" };

      await registry.createAgent(agent1, "test-group");
      await registry.createAgent(agent2, "test-group");

      const agents = await registry.listAgents("test-group");

      expect(agents).toHaveLength(2);
      expect(agents.map((a: { name: string }) => a.name)).toContain("agent-1");
      expect(agents.map((a: { name: string }) => a.name)).toContain("agent-2");
    });
  });

  describe("updateAgentStatus", () => {
    it("should update agent status", async () => {
      await registry.createAgent(mockAgentConfig, "test-group");

      await registry.updateAgentStatus("test-agent", "test-group", "Running");

      const agent = await registry.getAgent("test-agent", "test-group");
      expect(agent?.status).toBe("Running");
    });
  });

  describe("deleteAgent", () => {
    it("should delete agent and its runs", async () => {
      await registry.createAgent(mockAgentConfig, "test-group");
      await registry.deleteAgent("test-agent", "test-group");

      const agent = await registry.getAgent("test-agent", "test-group");
      expect(agent).toBeNull();
    });
  });

  describe("recordAgentRun", () => {
    it("should record a successful agent run", async () => {
      await registry.createAgent(mockAgentConfig, "test-group");

      const run = await registry.recordAgentRun(
        "test-agent",
        "test-group",
        {
          success: true,
          duration_ms: 5000,
          exit_code: 0,
        }
      );

      expect(run.run_id).toBeDefined();
      expect(run.success).toBe(true);
      expect(run.duration_ms).toBe(5000);
    });
  });
});
