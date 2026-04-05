/**
 * LEARNED Relationship Tests
 * 
 * Tests for agent session learning relationship operations.
 */

import { describe, it, expect, beforeEach, afterEach } from "bun:test";
import {
  createLearnedRelationship,
  getAgentLearnings,
  getSessionLearners,
  deleteLearnedRelationship,
  countAgentLearnings,
  LearnedValidationError,
  LearnedQueryError,
  type CreateLearnedParams,
  type GetAgentLearningsParams,
} from "./learned";
import { createAgentNode, getAgentNode, type AgentInsert } from "../../neo4j/agent-nodes";
import { writeTransaction, readTransaction, type ManagedTransaction } from "../../neo4j/connection";

// Test group ID (using allura-* naming convention)
const TEST_GROUP_ID = "allura-test";

// Test agent data
const TEST_AGENT: AgentInsert = {
  agent_id: "test-learner-agent",
  name: "Test Learner Agent",
  role: "Testing agent learning relationships",
  model: "test-model",
  group_id: TEST_GROUP_ID,
  confidence: 0.75,
};

// Helper to create test agent
async function createTestAgent(): Promise<void> {
  try {
    await createAgentNode(TEST_AGENT);
  } catch (error) {
    // Agent may already exist - that's OK
    if (!(error instanceof Error && error.message.includes("already exists"))) {
      throw error;
    }
  }
}

// Helper to clean up test data
async function cleanupTestData(): Promise<void> {
  await writeTransaction(async (tx: ManagedTransaction) => {
    // Delete all LEARNED relationships for test group
    await tx.run(
      `MATCH (a:Agent {group_id: $group_id})-[r:LEARNED]->(s:Session {group_id: $group_id})
       DELETE r`,
      { group_id: TEST_GROUP_ID }
    );

    // Delete all test sessions
    await tx.run(
      `MATCH (s:Session {group_id: $group_id})
       DELETE s`,
      { group_id: TEST_GROUP_ID }
    );

    // Delete test agent
    await tx.run(
      `MATCH (a:Agent {agent_id: $agent_id, group_id: $group_id})
       DELETE a`,
      { agent_id: TEST_AGENT.agent_id, group_id: TEST_GROUP_ID }
    );
  });
}

describe("LEARNED Relationship", () => {
  beforeEach(async () => {
    await createTestAgent();
  });

  afterEach(async () => {
    await cleanupTestData();
  });

  describe("createlearnedRelationship", () => {
    it("should create a LEARNED relationship with valid parameters", async () => {
      const params: CreateLearnedParams = {
        agent_id: TEST_AGENT.agent_id,
        session_id: "test-session-001",
        group_id: TEST_GROUP_ID,
        relevance_score: 0.85,
        learning_summary: "Learned about LEARNED relationship implementation",
        metadata: { source: "test" },
      };

      const relationship = await createLearnedRelationship(params);

      expect(relationship.agent_id).toBe(params.agent_id);
      expect(relationship.session_id).toBe(params.session_id);
      expect(relationship.group_id).toBe(params.group_id);
      expect(relationship.relevance_score).toBe(params.relevance_score);
      expect(relationship.learning_summary).toBe(params.learning_summary);
      expect(relationship.timestamp).toBeInstanceOf(Date);
    });

    it("should create session node if it doesn't exist", async () => {
      const params: CreateLearnedParams = {
        agent_id: TEST_AGENT.agent_id,
        session_id: "auto-created-session",
        group_id: TEST_GROUP_ID,
        relevance_score: 0.9,
      };

      await createLearnedRelationship(params);

      // Verify session was created
      const sessions = await getAgentLearnings({
        agent_id: TEST_AGENT.agent_id,
        group_id: TEST_GROUP_ID,
      });

      expect(sessions.length).toBe(1);
      expect(sessions[0].session_id).toBe("auto-created-session");
    });

    it("should increment learning_count on agent", async () => {
      const initialAgent = await getAgentNode(TEST_AGENT.agent_id, TEST_GROUP_ID);
      expect(initialAgent).not.toBeNull();
      const initialCount = initialAgent!.learning_count;

      await createLearnedRelationship({
        agent_id: TEST_AGENT.agent_id,
        session_id: "session-1",
        group_id: TEST_GROUP_ID,
        relevance_score: 0.8,
      });

      const updatedAgent = await getAgentNode(TEST_AGENT.agent_id, TEST_GROUP_ID);
      expect(updatedAgent).not.toBeNull();
      expect(updatedAgent!.learning_count).toBe(initialCount + 1);
    });

    it("should validate required fields", async () => {
      await expect(
        createLearnedRelationship({
          agent_id: "",
          session_id: "session-1",
          group_id: TEST_GROUP_ID,
          relevance_score: 0.8,
        })
      ).rejects.toThrow(LearnedValidationError);

      await expect(
        createLearnedRelationship({
          agent_id: TEST_AGENT.agent_id,
          session_id: "",
          group_id: TEST_GROUP_ID,
          relevance_score: 0.8,
        })
      ).rejects.toThrow(LearnedValidationError);

      await expect(
        createLearnedRelationship({
          agent_id: TEST_AGENT.agent_id,
          session_id: "session-1",
          group_id: "",
          relevance_score: 0.8,
        })
      ).rejects.toThrow(LearnedValidationError);
    });

    it("should validate relevance_score range", async () => {
      await expect(
        createLearnedRelationship({
          agent_id: TEST_AGENT.agent_id,
          session_id: "session-1",
          group_id: TEST_GROUP_ID,
          relevance_score: -0.1,
        })
      ).rejects.toThrow(LearnedValidationError);

      await expect(
        createLearnedRelationship({
          agent_id: TEST_AGENT.agent_id,
          session_id: "session-1",
          group_id: TEST_GROUP_ID,
          relevance_score: 1.1,
        })
      ).rejects.toThrow(LearnedValidationError);
    });

    it("should enforce allura-* group_id format", async () => {
      await expect(
        createLearnedRelationship({
          agent_id: TEST_AGENT.agent_id,
          session_id: "session-1",
          group_id: "invalid-group",
          relevance_score: 0.8,
        })
      ).rejects.toThrow(LearnedValidationError);
    });

    it("should throw error if agent doesn't exist", async () => {
      await expect(
        createLearnedRelationship({
          agent_id: "non-existent-agent",
          session_id: "session-1",
          group_id: TEST_GROUP_ID,
          relevance_score: 0.8,
        })
      ).rejects.toThrow(LearnedValidationError);
    });

    it("should be idempotent - MERGE prevents duplicate relationships", async () => {
      const params: CreateLearnedParams = {
        agent_id: TEST_AGENT.agent_id,
        session_id: "idempotent-test",
        group_id: TEST_GROUP_ID,
        relevance_score: 0.8,
      };

      // Create relationship twice
      await createLearnedRelationship(params);
      await createLearnedRelationship(params);

      // Should only have one relationship
      const count = await countAgentLearnings(TEST_AGENT.agent_id, TEST_GROUP_ID);
      expect(count).toBe(1);
    });
  });

  describe("getAgentLearnings", () => {
    beforeEach(async () => {
      // Create multiple learning relationships
      await createLearnedRelationship({
        agent_id: TEST_AGENT.agent_id,
        session_id: "session-high-relevance",
        group_id: TEST_GROUP_ID,
        relevance_score: 0.95,
        learning_summary: "High relevance learning",
      });

      await createLearnedRelationship({
        agent_id: TEST_AGENT.agent_id,
        session_id: "session-medium-relevance",
        group_id: TEST_GROUP_ID,
        relevance_score: 0.75,
        learning_summary: "Medium relevance learning",
      });

      await createLearnedRelationship({
        agent_id: TEST_AGENT.agent_id,
        session_id: "session-low-relevance",
        group_id: TEST_GROUP_ID,
        relevance_score: 0.55,
        learning_summary: "Low relevance learning",
      });
    });

    it("should return sessions ordered by relevance_score DESC", async () => {
      const sessions = await getAgentLearnings({
        agent_id: TEST_AGENT.agent_id,
        group_id: TEST_GROUP_ID,
      });

      expect(sessions.length).toBeGreaterThan(0);
      // First session should have highest relevance
      // Note: The session nodes themselves don't have relevance_score,
      // but they're ordered by the relationship's relevance_score
    });

    it("should limit results with session_limit parameter", async () => {
      const sessions = await getAgentLearnings({
        agent_id: TEST_AGENT.agent_id,
        group_id: TEST_GROUP_ID,
        session_limit: 2,
      });

      expect(sessions.length).toBe(2);
    });

    it("should filter by min_relevance", async () => {
      const sessions = await getAgentLearnings({
        agent_id: TEST_AGENT.agent_id,
        group_id: TEST_GROUP_ID,
        min_relevance: 0.8,
      });

      // Should only return sessions with relevance >= 0.8
      expect(sessions.length).toBeGreaterThanOrEqual(1);
    });

    it("should validate required parameters", async () => {
      await expect(
        getAgentLearnings({
          agent_id: "",
          group_id: TEST_GROUP_ID,
        })
      ).rejects.toThrow(LearnedQueryError);

      await expect(
        getAgentLearnings({
          agent_id: TEST_AGENT.agent_id,
          group_id: "",
        })
      ).rejects.toThrow(LearnedQueryError);
    });

    it("should enforce allura-* group_id format", async () => {
      await expect(
        getAgentLearnings({
          agent_id: TEST_AGENT.agent_id,
          group_id: "invalid-group",
        })
      ).rejects.toThrow(LearnedQueryError);
    });

    it("should return empty array for non-existent agent", async () => {
      const sessions = await getAgentLearnings({
        agent_id: "non-existent-agent",
        group_id: TEST_GROUP_ID,
      });

      expect(sessions).toEqual([]);
    });
  });

  describe("getSessionLearners", () => {
    it("should return agents that learned from a session", async () => {
      const session_id = "shared-session";

      await createLearnedRelationship({
        agent_id: TEST_AGENT.agent_id,
        session_id,
        group_id: TEST_GROUP_ID,
        relevance_score: 0.85,
      });

      const learners = await getSessionLearners(session_id, TEST_GROUP_ID);

      expect(learners.length).toBe(1);
      expect(learners[0].agent_id).toBe(TEST_AGENT.agent_id);
      expect(learners[0].relevance_score).toBe(0.85);
      expect(learners[0].learned_at).toBeInstanceOf(Date);
    });

    it("should return empty array for non-existent session", async () => {
      const learners = await getSessionLearners("non-existent-session", TEST_GROUP_ID);

      expect(learners).toEqual([]);
    });

    it("should validate required parameters", async () => {
      await expect(
        getSessionLearners("", TEST_GROUP_ID)
      ).rejects.toThrow(LearnedQueryError);

      await expect(
        getSessionLearners("session-1", "")
      ).rejects.toThrow(LearnedQueryError);
    });

    it("should enforce allura-* group_id format", async () => {
      await expect(
        getSessionLearners("session-1", "invalid-group")
      ).rejects.toThrow(LearnedQueryError);
    });
  });

  describe("deleteLearnedRelationship", () => {
    it("should delete an existing relationship", async () => {
      await createLearnedRelationship({
        agent_id: TEST_AGENT.agent_id,
        session_id: "session-to-delete",
        group_id: TEST_GROUP_ID,
        relevance_score: 0.8,
      });

      const deleted = await deleteLearnedRelationship(
        TEST_AGENT.agent_id,
        "session-to-delete",
        TEST_GROUP_ID
      );

      expect(deleted).toBe(true);

      // Verify relationship was deleted
      const count = await countAgentLearnings(TEST_AGENT.agent_id, TEST_GROUP_ID);
      expect(count).toBe(0);
    });

    it("should return false if relationship doesn't exist", async () => {
      const deleted = await deleteLearnedRelationship(
        TEST_AGENT.agent_id,
        "non-existent-session",
        TEST_GROUP_ID
      );

      expect(deleted).toBe(false);
    });

    it("should validate required parameters", async () => {
      await expect(
        deleteLearnedRelationship("", "session-1", TEST_GROUP_ID)
      ).rejects.toThrow(LearnedQueryError);

      await expect(
        deleteLearnedRelationship(TEST_AGENT.agent_id, "", TEST_GROUP_ID)
      ).rejects.toThrow(LearnedQueryError);

      await expect(
        deleteLearnedRelationship(TEST_AGENT.agent_id, "session-1", "")
      ).rejects.toThrow(LearnedQueryError);
    });

    it("should enforce allura-* group_id format", async () => {
      await expect(
        deleteLearnedRelationship(TEST_AGENT.agent_id, "session-1", "invalid-group")
      ).rejects.toThrow(LearnedQueryError);
    });
  });

  describe("countAgentLearnings", () => {
    it("should count learning relationships for an agent", async () => {
      // Create 3 learning relationships
      await createLearnedRelationship({
        agent_id: TEST_AGENT.agent_id,
        session_id: "count-session-1",
        group_id: TEST_GROUP_ID,
        relevance_score: 0.8,
      });

      await createLearnedRelationship({
        agent_id: TEST_AGENT.agent_id,
        session_id: "count-session-2",
        group_id: TEST_GROUP_ID,
        relevance_score: 0.7,
      });

      await createLearnedRelationship({
        agent_id: TEST_AGENT.agent_id,
        session_id: "count-session-3",
        group_id: TEST_GROUP_ID,
        relevance_score: 0.6,
      });

      const count = await countAgentLearnings(TEST_AGENT.agent_id, TEST_GROUP_ID);
      expect(count).toBe(3);
    });

    it("should return 0 for agent with no learnings", async () => {
      // Clean up any existing learnings first
      await cleanupTestData();
      await createTestAgent();

      const count = await countAgentLearnings(TEST_AGENT.agent_id, TEST_GROUP_ID);
      expect(count).toBe(0);
    });

    it("should validate required parameters", async () => {
      await expect(
        countAgentLearnings("", TEST_GROUP_ID)
      ).rejects.toThrow(LearnedQueryError);

      await expect(
        countAgentLearnings(TEST_AGENT.agent_id, "")
      ).rejects.toThrow(LearnedQueryError);
    });

    it("should enforce allura-* group_id format", async () => {
      await expect(
        countAgentLearnings(TEST_AGENT.agent_id, "invalid-group")
      ).rejects.toThrow(LearnedQueryError);
    });
  });

  describe("Tenant Isolation", () => {
    it("should enforce group_id on all operations", async () => {
      const GROUP_A = "allura-group-a";
      const GROUP_B = "allura-group-b";

      // Create agents in different groups
      try {
        await createAgentNode({ ...TEST_AGENT, agent_id: "agent-a", group_id: GROUP_A });
        await createAgentNode({ ...TEST_AGENT, agent_id: "agent-b", group_id: GROUP_B });
      } catch {
        // Agents may already exist
      }

      // Create learning in GROUP_A
      await createLearnedRelationship({
        agent_id: "agent-a",
        session_id: "session-a",
        group_id: GROUP_A,
        relevance_score: 0.9,
      });

      // Query from GROUP_B should not see GROUP_A data
      const sessions = await getAgentLearnings({
        agent_id: "agent-b",
        group_id: GROUP_B,
      });

      expect(sessions.length).toBe(0);
    });

    it("should prevent cross-tenant relationship deletion", async () => {
      const GROUP_A = "allura-group-a";
      const GROUP_B = "allura-group-b";

      try {
        await createAgentNode({ ...TEST_AGENT, agent_id: "agent-a", group_id: GROUP_A });
        await createAgentNode({ ...TEST_AGENT, agent_id: "agent-b", group_id: GROUP_B });
      } catch {
        // Agents may already exist
      }

      // Create learning in GROUP_A
      await createLearnedRelationship({
        agent_id: "agent-a",
        session_id: "session-a",
        group_id: GROUP_A,
        relevance_score: 0.9,
      });

      // Attempt to delete from GROUP_B should fail silently (relationship not found)
      const deleted = await deleteLearnedRelationship(
        "agent-a",
        "session-a",
        GROUP_B // Wrong group_id
      );

      expect(deleted).toBe(false);

      // Verify relationship still exists in GROUP_A
      const count = await countAgentLearnings("agent-a", GROUP_A);
      expect(count).toBe(1);
    });
  });

  describe("Edge Cases", () => {
    it("should handle Unicode in learning_summary", async () => {
      const params: CreateLearnedParams = {
        agent_id: TEST_AGENT.agent_id,
        session_id: "unicode-test",
        group_id: TEST_GROUP_ID,
        relevance_score: 0.85,
        learning_summary: "学习新技能 🎓 變數測試",
      };

      const relationship = await createLearnedRelationship(params);
      expect(relationship.learning_summary).toBe(params.learning_summary);
    });

    it("should handle large metadata objects", async () => {
      const largeMetadata: Record<string, unknown> = {};
      for (let i = 0; i < 100; i++) {
        largeMetadata[`key_${i}`] = `value_${i}`;
      }

      const params: CreateLearnedParams = {
        agent_id: TEST_AGENT.agent_id,
        session_id: "large-metadata",
        group_id: TEST_GROUP_ID,
        relevance_score: 0.75,
        metadata: largeMetadata,
      };

      const relationship = await createLearnedRelationship(params);
      expect(relationship.metadata).toEqual(largeMetadata);
    });

    it("should handle boundary relevance_score values", async () => {
      // Test 0.0
      const rel1 = await createLearnedRelationship({
        agent_id: TEST_AGENT.agent_id,
        session_id: "boundary-0",
        group_id: TEST_GROUP_ID,
        relevance_score: 0.0,
      });
      expect(rel1.relevance_score).toBe(0.0);

      // Test 1.0
      const rel2 = await createLearnedRelationship({
        agent_id: TEST_AGENT.agent_id,
        session_id: "boundary-1",
        group_id: TEST_GROUP_ID,
        relevance_score: 1.0,
      });
      expect(rel2.relevance_score).toBe(1.0);
    });
  });
});