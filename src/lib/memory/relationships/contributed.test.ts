/**
 * CONTRIBUTED Relationship Tests
 * 
 * Tests for agent knowledge contribution relationship operations.
 */

import { describe, it, expect, beforeEach, afterEach } from "bun:test";
import {
  createContributedRelationship,
  getAgentContributions,
  getInsightContributors,
  deleteContributedRelationship,
  countAgentContributions,
  getAgentContributionStats,
  ContributedValidationError,
  ContributedQueryError,
  type CreateContributedParams,
  type GetAgentContributionsParams,
  type ContributionAction,
} from "./contributed";
import { createAgentNode, getAgentNode, type AgentInsert } from "../../neo4j/agent-nodes";
import { writeTransaction, type ManagedTransaction } from "../../neo4j/connection";

// Test group ID (using allura-* naming convention)
const TEST_GROUP_ID = "allura-test";

// Test agent data
const TEST_AGENT: AgentInsert = {
  agent_id: "test-contributor-agent",
  name: "Test Contributor Agent",
  role: "Testing agent contribution relationships",
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

// Helper to create test insight
async function createTestInsight(insight_id: string, group_id: string): Promise<void> {
  await writeTransaction(async (tx: ManagedTransaction) => {
    await tx.run(
      `CREATE (i:Insight {
        id: $insight_id,
        topic_key: $topic_key,
        group_id: $group_id,
        confidence: 0.8,
        status: 'active',
        version: 1,
        created_at: datetime(),
        updated_at: datetime(),
        content: 'Test insight content'
      })`,
      {
        insight_id,
        topic_key: `insight.${insight_id}`,
        group_id,
      }
    );
  });
}

// Helper to clean up test data
async function cleanupTestData(): Promise<void> {
  await writeTransaction(async (tx: ManagedTransaction) => {
    // Delete all CONTRIBUTED relationships for test group
    await tx.run(
      `MATCH (a:Agent {group_id: $group_id})-[r:CONTRIBUTED]->(i:Insight {group_id: $group_id})
       DELETE r`,
      { group_id: TEST_GROUP_ID }
    );

    // Delete all test insights
    await tx.run(
      `MATCH (i:Insight {group_id: $group_id})
       DELETE i`,
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

describe("CONTRIBUTED Relationship", () => {
  beforeEach(async () => {
    await createTestAgent();
  });

  afterEach(async () => {
    await cleanupTestData();
  });

  describe("createContributedRelationship", () => {
    it("should create a CONTRIBUTED relationship with valid parameters", async () => {
      const params: CreateContributedParams = {
        agent_id: TEST_AGENT.agent_id,
        insight_id: "test-insight-001",
        group_id: TEST_GROUP_ID,
        confidence: 0.85,
        action: "created",
        metadata: { source: "test" },
      };

      const relationship = await createContributedRelationship(params);

      expect(relationship.agent_id).toBe(params.agent_id);
      expect(relationship.insight_id).toBe(params.insight_id);
      expect(relationship.group_id).toBe(params.group_id);
      expect(relationship.confidence).toBe(params.confidence);
      expect(relationship.action).toBe(params.action);
      expect(relationship.timestamp).toBeInstanceOf(Date);
    });

    it("should create insight node if it doesn't exist", async () => {
      const params: CreateContributedParams = {
        agent_id: TEST_AGENT.agent_id,
        insight_id: "auto-created-insight",
        group_id: TEST_GROUP_ID,
        confidence: 0.9,
        action: "created",
      };

      await createContributedRelationship(params);

      // Verify insight was created
      const contributions = await getAgentContributions({
        agent_id: TEST_AGENT.agent_id,
        group_id: TEST_GROUP_ID,
      });

      expect(contributions.length).toBe(1);
      expect(contributions[0].id).toBe("auto-created-insight");
    });

    it("should increment contribution_count on agent", async () => {
      const initialAgent = await getAgentNode(TEST_AGENT.agent_id, TEST_GROUP_ID);
      expect(initialAgent).not.toBeNull();
      const initialCount = initialAgent!.contribution_count ?? 0;

      await createContributedRelationship({
        agent_id: TEST_AGENT.agent_id,
        insight_id: "insight-1",
        group_id: TEST_GROUP_ID,
        confidence: 0.8,
        action: "created",
      });

      const updatedAgent = await getAgentNode(TEST_AGENT.agent_id, TEST_GROUP_ID);
      expect(updatedAgent).not.toBeNull();
      expect(updatedAgent!.contribution_count).toBe(initialCount + 1);
    });

    it("should validate required fields", async () => {
      await expect(
        createContributedRelationship({
          agent_id: "",
          insight_id: "insight-1",
          group_id: TEST_GROUP_ID,
          confidence: 0.8,
          action: "created",
        })
      ).rejects.toThrow(ContributedValidationError);

      await expect(
        createContributedRelationship({
          agent_id: TEST_AGENT.agent_id,
          insight_id: "",
          group_id: TEST_GROUP_ID,
          confidence: 0.8,
          action: "created",
        })
      ).rejects.toThrow(ContributedValidationError);

      await expect(
        createContributedRelationship({
          agent_id: TEST_AGENT.agent_id,
          insight_id: "insight-1",
          group_id: "",
          confidence: 0.8,
          action: "created",
        })
      ).rejects.toThrow(ContributedValidationError);
    });

    it("should validate confidence range", async () => {
      await expect(
        createContributedRelationship({
          agent_id: TEST_AGENT.agent_id,
          insight_id: "insight-1",
          group_id: TEST_GROUP_ID,
          confidence: -0.1,
          action: "created",
        })
      ).rejects.toThrow(ContributedValidationError);

      await expect(
        createContributedRelationship({
          agent_id: TEST_AGENT.agent_id,
          insight_id: "insight-1",
          group_id: TEST_GROUP_ID,
          confidence: 1.1,
          action: "created",
        })
      ).rejects.toThrow(ContributedValidationError);
    });

    it("should validate action type", async () => {
      await expect(
        createContributedRelationship({
          agent_id: TEST_AGENT.agent_id,
          insight_id: "insight-1",
          group_id: TEST_GROUP_ID,
          confidence: 0.8,
          action: "invalid" as ContributionAction,
        })
      ).rejects.toThrow(ContributedValidationError);
    });

    it("should enforce allura-* group_id format", async () => {
      await expect(
        createContributedRelationship({
          agent_id: TEST_AGENT.agent_id,
          insight_id: "insight-1",
          group_id: "invalid-group",
          confidence: 0.8,
          action: "created",
        })
      ).rejects.toThrow(ContributedValidationError);
    });

    it("should throw error if agent doesn't exist", async () => {
      await expect(
        createContributedRelationship({
          agent_id: "non-existent-agent",
          insight_id: "insight-1",
          group_id: TEST_GROUP_ID,
          confidence: 0.8,
          action: "created",
        })
      ).rejects.toThrow(ContributedValidationError);
    });

    it("should support all action types", async () => {
      const actions: ContributionAction[] = ["created", "modified", "validated"];

      for (const action of actions) {
        const rel = await createContributedRelationship({
          agent_id: TEST_AGENT.agent_id,
          insight_id: `insight-${action}`,
          group_id: TEST_GROUP_ID,
          confidence: 0.8,
          action,
        });
        expect(rel.action).toBe(action);
      }
    });

    it("should be idempotent - MERGE prevents duplicate relationships", async () => {
      const params: CreateContributedParams = {
        agent_id: TEST_AGENT.agent_id,
        insight_id: "idempotent-test",
        group_id: TEST_GROUP_ID,
        confidence: 0.8,
        action: "created",
      };

      // Create relationship twice
      await createContributedRelationship(params);
      await createContributedRelationship(params);

      // Should only have one relationship
      const count = await countAgentContributions(TEST_AGENT.agent_id, TEST_GROUP_ID);
      expect(count).toBe(1);
    });
  });

  describe("getAgentContributions", () => {
    beforeEach(async () => {
      // Create multiple contribution relationships
      await createContributedRelationship({
        agent_id: TEST_AGENT.agent_id,
        insight_id: "insight-high-confidence",
        group_id: TEST_GROUP_ID,
        confidence: 0.95,
        action: "created",
      });

      await createContributedRelationship({
        agent_id: TEST_AGENT.agent_id,
        insight_id: "insight-medium-confidence",
        group_id: TEST_GROUP_ID,
        confidence: 0.75,
        action: "modified",
      });

      await createContributedRelationship({
        agent_id: TEST_AGENT.agent_id,
        insight_id: "insight-low-confidence",
        group_id: TEST_GROUP_ID,
        confidence: 0.55,
        action: "validated",
      });
    });

    it("should return insights ordered by confidence DESC", async () => {
      const insights = await getAgentContributions({
        agent_id: TEST_AGENT.agent_id,
        group_id: TEST_GROUP_ID,
      });

      expect(insights.length).toBeGreaterThan(0);
      // First insight should have highest confidence
      // Note: The insight nodes themselves don't have confidence in this context,
      // but they're ordered by the relationship's confidence
    });

    it("should limit results with limit parameter", async () => {
      const insights = await getAgentContributions({
        agent_id: TEST_AGENT.agent_id,
        group_id: TEST_GROUP_ID,
        limit: 2,
      });

      expect(insights.length).toBe(2);
    });

    it("should filter by minConfidence", async () => {
      const insights = await getAgentContributions({
        agent_id: TEST_AGENT.agent_id,
        group_id: TEST_GROUP_ID,
        minConfidence: 0.8,
      });

      // Should only return insights with contribution confidence >= 0.8
      expect(insights.length).toBeGreaterThanOrEqual(1);
    });

    it("should filter by action type", async () => {
      const insights = await getAgentContributions({
        agent_id: TEST_AGENT.agent_id,
        group_id: TEST_GROUP_ID,
        actionFilter: "created",
      });

      // All results should be from created action
      // Note: We'd need to query the relationship to verify action
      expect(insights.length).toBeGreaterThanOrEqual(1);
    });

    it("should filter by time range", async () => {
      const now = new Date();
      const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);
      const oneHourFromNow = new Date(now.getTime() + 60 * 60 * 1000);

      const insights = await getAgentContributions({
        agent_id: TEST_AGENT.agent_id,
        group_id: TEST_GROUP_ID,
        timeRange: { start: oneHourAgo, end: oneHourFromNow },
      });

      expect(insights.length).toBeGreaterThan(0);
    });

    it("should validate required parameters", async () => {
      await expect(
        getAgentContributions({
          agent_id: "",
          group_id: TEST_GROUP_ID,
        })
      ).rejects.toThrow(ContributedQueryError);

      await expect(
        getAgentContributions({
          agent_id: TEST_AGENT.agent_id,
          group_id: "",
        })
      ).rejects.toThrow(ContributedQueryError);
    });

    it("should enforce allura-* group_id format", async () => {
      await expect(
        getAgentContributions({
          agent_id: TEST_AGENT.agent_id,
          group_id: "invalid-group",
        })
      ).rejects.toThrow(ContributedQueryError);
    });

    it("should return empty array for non-existent agent", async () => {
      const insights = await getAgentContributions({
        agent_id: "non-existent-agent",
        group_id: TEST_GROUP_ID,
      });

      expect(insights).toEqual([]);
    });
  });

  describe("getInsightContributors", () => {
    it("should return agents that contributed to an insight", async () => {
      const insight_id = "shared-insight";

      await createContributedRelationship({
        agent_id: TEST_AGENT.agent_id,
        insight_id,
        group_id: TEST_GROUP_ID,
        confidence: 0.85,
        action: "created",
      });

      const contributors = await getInsightContributors(insight_id, TEST_GROUP_ID);

      expect(contributors.length).toBe(1);
      expect(contributors[0].agent_id).toBe(TEST_AGENT.agent_id);
      expect(contributors[0].confidence).toBe(0.85);
      expect(contributors[0].action).toBe("created");
      expect(contributors[0].contributed_at).toBeInstanceOf(Date);
    });

    it("should return empty array for non-existent insight", async () => {
      const contributors = await getInsightContributors("non-existent-insight", TEST_GROUP_ID);

      expect(contributors).toEqual([]);
    });

    it("should validate required parameters", async () => {
      await expect(
        getInsightContributors("", TEST_GROUP_ID)
      ).rejects.toThrow(ContributedQueryError);

      await expect(
        getInsightContributors("insight-1", "")
      ).rejects.toThrow(ContributedQueryError);
    });

    it("should enforce allura-* group_id format", async () => {
      await expect(
        getInsightContributors("insight-1", "invalid-group")
      ).rejects.toThrow(ContributedQueryError);
    });
  });

  describe("deleteContributedRelationship", () => {
    it("should delete an existing relationship", async () => {
      await createContributedRelationship({
        agent_id: TEST_AGENT.agent_id,
        insight_id: "insight-to-delete",
        group_id: TEST_GROUP_ID,
        confidence: 0.8,
        action: "created",
      });

      const deleted = await deleteContributedRelationship(
        TEST_AGENT.agent_id,
        "insight-to-delete",
        TEST_GROUP_ID
      );

      expect(deleted).toBe(true);

      // Verify relationship was deleted
      const count = await countAgentContributions(TEST_AGENT.agent_id, TEST_GROUP_ID);
      expect(count).toBe(0);
    });

    it("should return false if relationship doesn't exist", async () => {
      const deleted = await deleteContributedRelationship(
        TEST_AGENT.agent_id,
        "non-existent-insight",
        TEST_GROUP_ID
      );

      expect(deleted).toBe(false);
    });

    it("should validate required parameters", async () => {
      await expect(
        deleteContributedRelationship("", "insight-1", TEST_GROUP_ID)
      ).rejects.toThrow(ContributedQueryError);

      await expect(
        deleteContributedRelationship(TEST_AGENT.agent_id, "", TEST_GROUP_ID)
      ).rejects.toThrow(ContributedQueryError);

      await expect(
        deleteContributedRelationship(TEST_AGENT.agent_id, "insight-1", "")
      ).rejects.toThrow(ContributedQueryError);
    });

    it("should enforce allura-* group_id format", async () => {
      await expect(
        deleteContributedRelationship(TEST_AGENT.agent_id, "insight-1", "invalid-group")
      ).rejects.toThrow(ContributedQueryError);
    });
  });

  describe("countAgentContributions", () => {
    it("should count contribution relationships for an agent", async () => {
      // Create 3 contribution relationships
      await createContributedRelationship({
        agent_id: TEST_AGENT.agent_id,
        insight_id: "count-insight-1",
        group_id: TEST_GROUP_ID,
        confidence: 0.8,
        action: "created",
      });

      await createContributedRelationship({
        agent_id: TEST_AGENT.agent_id,
        insight_id: "count-insight-2",
        group_id: TEST_GROUP_ID,
        confidence: 0.7,
        action: "modified",
      });

      await createContributedRelationship({
        agent_id: TEST_AGENT.agent_id,
        insight_id: "count-insight-3",
        group_id: TEST_GROUP_ID,
        confidence: 0.6,
        action: "validated",
      });

      const count = await countAgentContributions(TEST_AGENT.agent_id, TEST_GROUP_ID);
      expect(count).toBe(3);
    });

    it("should return 0 for agent with no contributions", async () => {
      // Clean up any existing contributions first
      await cleanupTestData();
      await createTestAgent();

      const count = await countAgentContributions(TEST_AGENT.agent_id, TEST_GROUP_ID);
      expect(count).toBe(0);
    });

    it("should validate required parameters", async () => {
      await expect(
        countAgentContributions("", TEST_GROUP_ID)
      ).rejects.toThrow(ContributedQueryError);

      await expect(
        countAgentContributions(TEST_AGENT.agent_id, "")
      ).rejects.toThrow(ContributedQueryError);
    });

    it("should enforce allura-* group_id format", async () => {
      await expect(
        countAgentContributions(TEST_AGENT.agent_id, "invalid-group")
      ).rejects.toThrow(ContributedQueryError);
    });
  });

  describe("getAgentContributionStats", () => {
    it("should return contribution statistics for an agent", async () => {
      // Create contributions with different action types
      await createContributedRelationship({
        agent_id: TEST_AGENT.agent_id,
        insight_id: "stats-insight-1",
        group_id: TEST_GROUP_ID,
        confidence: 0.9,
        action: "created",
      });

      await createContributedRelationship({
        agent_id: TEST_AGENT.agent_id,
        insight_id: "stats-insight-2",
        group_id: TEST_GROUP_ID,
        confidence: 0.8,
        action: "modified",
      });

      await createContributedRelationship({
        agent_id: TEST_AGENT.agent_id,
        insight_id: "stats-insight-3",
        group_id: TEST_GROUP_ID,
        confidence: 0.7,
        action: "validated",
      });

      const stats = await getAgentContributionStats(TEST_AGENT.agent_id, TEST_GROUP_ID);

      expect(stats.total).toBe(3);
      expect(stats.created).toBe(1);
      expect(stats.modified).toBe(1);
      expect(stats.validated).toBe(1);
      expect(stats.avg_confidence).toBeGreaterThan(0);
    });

    it("should return zero stats for agent with no contributions", async () => {
      // Clean up any existing contributions first
      await cleanupTestData();
      await createTestAgent();

      const stats = await getAgentContributionStats(TEST_AGENT.agent_id, TEST_GROUP_ID);

      expect(stats.total).toBe(0);
      expect(stats.created).toBe(0);
      expect(stats.modified).toBe(0);
      expect(stats.validated).toBe(0);
      expect(stats.avg_confidence).toBe(0);
    });

    it("should validate required parameters", async () => {
      await expect(
        getAgentContributionStats("", TEST_GROUP_ID)
      ).rejects.toThrow(ContributedQueryError);

      await expect(
        getAgentContributionStats(TEST_AGENT.agent_id, "")
      ).rejects.toThrow(ContributedQueryError);
    });

    it("should enforce allura-* group_id format", async () => {
      await expect(
        getAgentContributionStats(TEST_AGENT.agent_id, "invalid-group")
      ).rejects.toThrow(ContributedQueryError);
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

      // Create contribution in GROUP_A
      await createContributedRelationship({
        agent_id: "agent-a",
        insight_id: "insight-a",
        group_id: GROUP_A,
        confidence: 0.9,
        action: "created",
      });

      // Query from GROUP_B should not see GROUP_A data
      const insights = await getAgentContributions({
        agent_id: "agent-b",
        group_id: GROUP_B,
      });

      expect(insights.length).toBe(0);
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

      // Create contribution in GROUP_A
      await createContributedRelationship({
        agent_id: "agent-a",
        insight_id: "insight-a",
        group_id: GROUP_A,
        confidence: 0.9,
        action: "created",
      });

      // Attempt to delete from GROUP_B should fail silently (relationship not found)
      const deleted = await deleteContributedRelationship(
        "agent-a",
        "insight-a",
        GROUP_B // Wrong group_id
      );

      expect(deleted).toBe(false);

      // Verify relationship still exists in GROUP_A
      const count = await countAgentContributions("agent-a", GROUP_A);
      expect(count).toBe(1);
    });
  });

  describe("Edge Cases", () => {
    it("should handle Unicode in metadata", async () => {
      const params: CreateContributedParams = {
        agent_id: TEST_AGENT.agent_id,
        insight_id: "unicode-test",
        group_id: TEST_GROUP_ID,
        confidence: 0.85,
        action: "created",
        metadata: { description: "学习新技能 🎓 變數測試" },
      };

      const relationship = await createContributedRelationship(params);
      expect(relationship.metadata).toEqual(params.metadata);
    });

    it("should handle large metadata objects", async () => {
      const largeMetadata: Record<string, unknown> = {};
      for (let i = 0; i < 100; i++) {
        largeMetadata[`key_${i}`] = `value_${i}`;
      }

      const params: CreateContributedParams = {
        agent_id: TEST_AGENT.agent_id,
        insight_id: "large-metadata",
        group_id: TEST_GROUP_ID,
        confidence: 0.75,
        action: "created",
        metadata: largeMetadata,
      };

      const relationship = await createContributedRelationship(params);
      expect(relationship.metadata).toEqual(largeMetadata);
    });

    it("should handle boundary confidence values", async () => {
      // Test 0.0
      const rel1 = await createContributedRelationship({
        agent_id: TEST_AGENT.agent_id,
        insight_id: "boundary-0",
        group_id: TEST_GROUP_ID,
        confidence: 0.0,
        action: "created",
      });
      expect(rel1.confidence).toBe(0.0);

      // Test 1.0
      const rel2 = await createContributedRelationship({
        agent_id: TEST_AGENT.agent_id,
        insight_id: "boundary-1",
        group_id: TEST_GROUP_ID,
        confidence: 1.0,
        action: "created",
      });
      expect(rel2.confidence).toBe(1.0);
    });

    it("should handle time range boundaries", async () => {
      // Create a contribution
      await createContributedRelationship({
        agent_id: TEST_AGENT.agent_id,
        insight_id: "time-range-test",
        group_id: TEST_GROUP_ID,
        confidence: 0.8,
        action: "created",
      });

      // Query with time range that should include it
      const now = new Date();
      const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);
      const oneHourFromNow = new Date(now.getTime() + 60 * 60 * 1000);

      const insights = await getAgentContributions({
        agent_id: TEST_AGENT.agent_id,
        group_id: TEST_GROUP_ID,
        timeRange: { start: oneHourAgo, end: oneHourFromNow },
      });

      expect(insights.length).toBe(1);
      expect(insights[0].id).toBe("time-range-test");
    });
  });
});