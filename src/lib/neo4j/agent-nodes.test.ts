/**
 * Tests for Agent Memory Nodes
 * Requires a running Neo4j instance.
 * Run with: RUN_E2E_TESTS=true bun vitest run src/lib/neo4j/agent-nodes.test.ts
 */

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { closeDriver, getDriver } from "./connection";
import {
  createAgentNode,
  getAgentNode,
  listAgentNodes,
  updateAgentNode,
  createAgentGroup,
  linkAgentToGroup,
  initializeDefaultAgents,
  verifyAgentNodes,
  AgentValidationError,
  AgentConflictError,
  AgentQueryError,
} from "./agent-nodes";
import type { AgentInsert } from "./agent-nodes";

// Test configuration
const TEST_GROUP_ID = "allura-test-agents";

// All group_ids used across test fixtures — cleaned before and after
const ALL_TEST_GROUP_IDS = [
  "allura-test-agents",
  "allura-test-group-creation",
  "allura-duplicate-group",
  "allura-link-test-group",
  "allura-default-init-test",
  "allura-existing-agent-test",
  "allura-verify-test",
];

// E2E guard: requires running Neo4j
const shouldRunE2E = process.env.RUN_E2E_TESTS === "true";

async function cleanupTestNodes(): Promise<void> {
  const driver = getDriver();
  const session = driver.session();
  try {
    await session.run(
      "MATCH (n) WHERE n.group_id IN $groupIds DETACH DELETE n",
      { groupIds: ALL_TEST_GROUP_IDS }
    );
  } finally {
    await session.close();
  }
}

// Setup and teardown
beforeAll(async () => {
  // Ensure environment variables are set
  process.env.NEO4J_URI = process.env.NEO4J_URI || "bolt://localhost:7687";
  process.env.NEO4J_USER = process.env.NEO4J_USER || "neo4j";
  process.env.NEO4J_PASSWORD = process.env.NEO4J_PASSWORD || "test-password";

  // Verify connectivity
  const driver = getDriver();
  await driver.verifyConnectivity();

  // Clean up any leftover nodes from prior runs
  if (shouldRunE2E) {
    await cleanupTestNodes();
  }
});

afterAll(async () => {
  // Clean up test nodes before closing the driver
  if (shouldRunE2E) {
    await cleanupTestNodes();
  }
  await closeDriver();
});

describe.skipIf(!shouldRunE2E)("Agent Nodes Validation", () => {
  it("should throw if agent_id is missing", async () => {
    const agent = {
      agent_id: "",
      name: "TestAgent",
      role: "Test role",
      model: "test-model",
      group_id: TEST_GROUP_ID,
    } as AgentInsert;

    await expect(createAgentNode(agent)).rejects.toThrow(AgentValidationError);
    await expect(createAgentNode(agent)).rejects.toThrow("agent_id is required");
  });

  it("should throw if group_id is missing", async () => {
    const agent = {
      agent_id: "test-agent",
      name: "TestAgent",
      role: "Test role",
      model: "test-model",
      group_id: "",
    } as AgentInsert;

    await expect(createAgentNode(agent)).rejects.toThrow(AgentValidationError);
    await expect(createAgentNode(agent)).rejects.toThrow("group_id is required");
  });

  it("should reject non-allura group_id format", async () => {
    const agent: AgentInsert = {
      agent_id: "test-agent",
      name: "TestAgent",
      role: "Test role",
      model: "test-model",
      group_id: "invalid-group",
    };

    await expect(createAgentNode(agent)).rejects.toThrow(AgentValidationError);
    await expect(createAgentNode(agent)).rejects.toThrow(
      "group_id must use allura-* format"
    );
  });

  it("should reject confidence outside 0-1 range", async () => {
    const agent: AgentInsert = {
      agent_id: "test-agent",
      name: "TestAgent",
      role: "Test role",
      model: "test-model",
      group_id: TEST_GROUP_ID,
      confidence: 1.5,
    };

    await expect(createAgentNode(agent)).rejects.toThrow(AgentValidationError);
    await expect(createAgentNode(agent)).rejects.toThrow(
      "confidence must be between 0 and 1"
    );
  });
});

describe.skipIf(!shouldRunE2E)("Agent Nodes CRUD", () => {
  it("should create an agent node with defaults", async () => {
    const agent: AgentInsert = {
      agent_id: "create-test",
      name: "CreateTestAgent",
      role: "Test role",
      model: "test-model",
      group_id: TEST_GROUP_ID,
    };

    const created = await createAgentNode(agent);

    expect(created.agent_id).toBe("create-test");
    expect(created.name).toBe("CreateTestAgent");
    expect(created.role).toBe("Test role");
    expect(created.model).toBe("test-model");
    expect(created.group_id).toBe(TEST_GROUP_ID);
    expect(created.confidence).toBe(0.0);
    expect(created.status).toBe("active");
    expect(created.contribution_count).toBe(0);
    expect(created.learning_count).toBe(0);
    expect(created.id).toBeDefined();
    expect(created.created_at).toBeInstanceOf(Date);
    expect(created.last_active).toBeInstanceOf(Date);
  });

  it("should create an agent node with custom values", async () => {
    const agent: AgentInsert = {
      agent_id: "custom-test",
      name: "CustomTestAgent",
      role: "Custom role",
      model: "custom-model",
      group_id: TEST_GROUP_ID,
      confidence: 0.85,
      status: "inactive",
      metadata: { department: "engineering" },
    };

    const created = await createAgentNode(agent);

    expect(created.confidence).toBe(0.85);
    expect(created.status).toBe("inactive");
    expect(created.metadata).toEqual({ department: "engineering" });
  });

  it("should throw conflict error for duplicate agent_id", async () => {
    const agent: AgentInsert = {
      agent_id: "duplicate-test",
      name: "DuplicateTestAgent",
      role: "Test role",
      model: "test-model",
      group_id: TEST_GROUP_ID,
    };

    // First creation should succeed
    await createAgentNode(agent);

    // Second creation should fail
    await expect(createAgentNode(agent)).rejects.toThrow(AgentConflictError);
    await expect(createAgentNode(agent)).rejects.toThrow("already exists");
  });

  it("should get an agent by agent_id and group_id", async () => {
    const agent: AgentInsert = {
      agent_id: "get-test",
      name: "GetTestAgent",
      role: "Test role",
      model: "test-model",
      group_id: TEST_GROUP_ID,
    };

    await createAgentNode(agent);

    const retrieved = await getAgentNode("get-test", TEST_GROUP_ID);

    expect(retrieved).not.toBeNull();
    expect(retrieved?.agent_id).toBe("get-test");
    expect(retrieved?.name).toBe("GetTestAgent");
    expect(retrieved?.group_id).toBe(TEST_GROUP_ID);
  });

  it("should return null for non-existent agent", async () => {
    const result = await getAgentNode("non-existent", TEST_GROUP_ID);
    expect(result).toBeNull();
  });

  it("should throw if getAgentNode called without required params", async () => {
    await expect(getAgentNode("", TEST_GROUP_ID)).rejects.toThrow(AgentQueryError);
    await expect(getAgentNode("test", "")).rejects.toThrow(AgentQueryError);
  });

  it("should list agents with filters", async () => {
    // Create multiple agents
    const agents: AgentInsert[] = [
      {
        agent_id: "list-test-1",
        name: "ListTest1",
        role: "Role A",
        model: "model-a",
        group_id: TEST_GROUP_ID,
      },
      {
        agent_id: "list-test-2",
        name: "ListTest2",
        role: "Role B",
        model: "model-b",
        group_id: TEST_GROUP_ID,
        status: "inactive",
      },
    ];

    for (const agent of agents) {
      try {
        await createAgentNode(agent);
      } catch (error) {
        // Skip if already exists
        if (!(error instanceof AgentConflictError)) {
          throw error;
        }
      }
    }

    // List all agents in group
    const allAgents = await listAgentNodes({ group_id: TEST_GROUP_ID });
    expect(allAgents.length).toBeGreaterThanOrEqual(2);

    // Filter by status
    const activeAgents = await listAgentNodes({
      group_id: TEST_GROUP_ID,
      status: "active",
    });
    expect(activeAgents.every((a) => a.status === "active")).toBe(true);

    // Filter by agent_id
    const specificAgent = await listAgentNodes({
      group_id: TEST_GROUP_ID,
      agent_id: "list-test-1",
    });
    expect(specificAgent.length).toBe(1);
    expect(specificAgent[0].agent_id).toBe("list-test-1");
  });

  it("should update agent properties", async () => {
    const agent: AgentInsert = {
      agent_id: "update-test",
      name: "UpdateTestAgent",
      role: "Test role",
      model: "test-model",
      group_id: TEST_GROUP_ID,
    };

    await createAgentNode(agent);

    const updated = await updateAgentNode("update-test", TEST_GROUP_ID, {
      confidence: 0.95,
      contribution_count: 5,
      learning_count: 3,
      status: "paused",
      metadata: { updated: true },
    });

    expect(updated.confidence).toBe(0.95);
    expect(updated.contribution_count).toBe(5);
    expect(updated.learning_count).toBe(3);
    expect(updated.status).toBe("paused");
    expect(updated.metadata).toEqual({ updated: true });
  });

  it("should throw if update called without fields", async () => {
    await expect(
      updateAgentNode("test", TEST_GROUP_ID, {})
    ).rejects.toThrow(AgentValidationError);
    await expect(
      updateAgentNode("test", TEST_GROUP_ID, {})
    ).rejects.toThrow("No fields to update");
  });

  it("should throw validation error for non-existent agent update", async () => {
    await expect(
      updateAgentNode("non-existent", TEST_GROUP_ID, { confidence: 0.5 })
    ).rejects.toThrow(AgentValidationError);
    await expect(
      updateAgentNode("non-existent", TEST_GROUP_ID, { confidence: 0.5 })
    ).rejects.toThrow("not found");
  });
});

describe.skipIf(!shouldRunE2E)("Agent Groups", () => {
  it("should create an agent group", async () => {
    const groupId = "allura-test-group-creation";

    const created = await createAgentGroup(groupId, "Test Agent Group");

    expect(created.group_id).toBe(groupId);
    expect(created.id).toBeDefined();
    expect(created.created_at).toBeInstanceOf(Date);
  });

  it("should reject group creation with invalid group_id", async () => {
    await expect(
      createAgentGroup("invalid-group", "Test Group")
    ).rejects.toThrow(AgentValidationError);
    await expect(
      createAgentGroup("invalid-group", "Test Group")
    ).rejects.toThrow("must use allura-* format");
  });

  it("should throw conflict for duplicate group", async () => {
    const groupId = "allura-duplicate-group";

    await createAgentGroup(groupId, "First Group");

    await expect(
      createAgentGroup(groupId, "Second Group")
    ).rejects.toThrow(AgentConflictError);
  });

  it("should link agent to group", async () => {
    const groupId = "allura-link-test-group";

    // Create group
    await createAgentGroup(groupId, "Link Test Group");

    // Create agent
    const agent: AgentInsert = {
      agent_id: "link-test-agent",
      name: "LinkTestAgent",
      role: "Test",
      model: "test",
      group_id: groupId,
    };
    await createAgentNode(agent);

    // Link should be idempotent
    await linkAgentToGroup("link-test-agent", groupId);

    // Second link should succeed (MERGE)
    await linkAgentToGroup("link-test-agent", groupId);
  });
});

describe.skipIf(!shouldRunE2E)("Initialize Default Agents", () => {
  it("should initialize all 7 default agents", async () => {
    const groupId = "allura-default-init-test";

    const agents = await initializeDefaultAgents(groupId);

    expect(agents.length).toBe(7);

    const expectedAgents = [
      "memory-orchestrator",
      "memory-architect",
      "memory-builder",
      "memory-guardian",
      "memory-scout",
      "memory-analyst",
      "memory-chronicler",
    ];

    for (const expectedId of expectedAgents) {
      const found = agents.find((a) => a.agent_id === expectedId);
      expect(found).toBeDefined();
      expect(found?.group_id).toBe(groupId);
    }
  });

  it("should handle existing agents gracefully", async () => {
    const groupId = "allura-existing-agent-test";

    // Create one agent first
    await createAgentNode({
      agent_id: "memory-orchestrator",
      name: "MemoryOrchestrator",
      role: "BMad workflow coordination",
      model: "glm-5-cloud",
      group_id: groupId,
    });

    // Initialize default agents should not fail
    const agents = await initializeDefaultAgents(groupId);

    expect(agents.length).toBe(7);
    expect(agents.find((a) => a.agent_id === "memory-orchestrator")).toBeDefined();
  });
});

describe.skipIf(!shouldRunE2E)("Verify Agent Nodes", () => {
  it("should verify agents exist for a group", async () => {
    const groupId = "allura-verify-test";

    await initializeDefaultAgents(groupId);

    const verification = await verifyAgentNodes(groupId);

    expect(verification.total).toBe(7);
    expect(verification.agents.length).toBe(7);

    const agentIds = verification.agents.map((a) => a.agent_id);
    expect(agentIds).toContain("memory-orchestrator");
    expect(agentIds).toContain("memory-architect");
    expect(agentIds).toContain("memory-builder");
  });

  it("should reject verification with invalid group_id", async () => {
    await expect(verifyAgentNodes("invalid-group")).rejects.toThrow(AgentQueryError);
    await expect(verifyAgentNodes("invalid-group")).rejects.toThrow(
      "must use allura-* format"
    );
  });
});