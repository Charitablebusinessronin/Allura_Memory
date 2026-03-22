import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import {
  getCurrentInsight,
  getInsightVersion,
  getInsightHistory,
  listInsights,
  searchInsights,
  getInsightById,
  getActiveInsightCount,
  QueryError,
} from "./get-insight";
import {
  createInsight,
  createInsightVersion,
  deprecateInsight,
  type InsightInsert,
} from "./insert-insight";
import { getDriver, closeDriver } from "../connection";

/**
 * Test suite for Neo4j insight retrieval
 */
describe("get-insight", () => {
  const testGroupId = "test-get-insight-group";
  const otherGroupId = "other-get-insight-group";

  beforeAll(async () => {
    // Ensure environment is configured for tests
    process.env.NEO4J_URI = process.env.NEO4J_URI || "bolt://localhost:7687";
    process.env.NEO4J_USER = process.env.NEO4J_USER || "neo4j";
    process.env.NEO4J_PASSWORD = process.env.NEO4J_PASSWORD || "KaminaTHC*";
    process.env.NEO4J_DATABASE = process.env.NEO4J_DATABASE || "neo4j";

    // Clean up any previous test data
    const driver = getDriver();
    const session = driver.session();
    try {
      await session.run(
        "MATCH (i:Insight) WHERE i.group_id IN $groups DETACH DELETE i",
        { groups: [testGroupId, otherGroupId] }
      );
      await session.run(
        "MATCH (h:InsightHead) WHERE h.group_id IN $groups DETACH DELETE h",
        { groups: [testGroupId, otherGroupId] }
      );
    } finally {
      await session.close();
    }
  });

  afterAll(async () => {
    // Clean up test data
    const driver = getDriver();
    const session = driver.session();
    try {
      await session.run(
        "MATCH (i:Insight) WHERE i.group_id IN $groups DETACH DELETE i",
        { groups: [testGroupId, otherGroupId] }
      );
      await session.run(
        "MATCH (h:InsightHead) WHERE h.group_id IN $groups DETACH DELETE h",
        { groups: [testGroupId, otherGroupId] }
      );
    } finally {
      await session.close();
    }

    await closeDriver();
  });

  beforeEach(async () => {
    // Clean up between tests
    const driver = getDriver();
    const session = driver.session();
    try {
      await session.run(
        "MATCH (i:Insight) WHERE i.group_id = $group_id DETACH DELETE i",
        { group_id: testGroupId }
      );
      await session.run(
        "MATCH (h:InsightHead) WHERE h.group_id = $group_id DETACH DELETE h",
        { group_id: testGroupId }
      );
    } finally {
      await session.close();
    }
  });

  // =========================================================================
  // Validation Tests
  // =========================================================================

  describe("validation", () => {
    it("should require group_id for listInsights", async () => {
      const params = {} as { group_id: string };
      await expect(listInsights(params)).rejects.toThrow(QueryError);
    });

    it("should reject empty group_id", async () => {
      await expect(listInsights({ group_id: "" })).rejects.toThrow(
        "group_id is required"
      );
    });

    it("should reject negative offset", async () => {
      await expect(
        listInsights({ group_id: testGroupId, offset: -1 })
      ).rejects.toThrow("offset must be a non-negative number");
    });

    it("should reject limit < 1", async () => {
      await expect(
        listInsights({ group_id: testGroupId, limit: 0 })
      ).rejects.toThrow("limit must be a positive number");
    });

    it("should reject since > until", async () => {
      const now = new Date();
      const past = new Date(now.getTime() - 10000);

      await expect(
        listInsights({
          group_id: testGroupId,
          since: now,
          until: past,
        })
      ).rejects.toThrow("since must be before until");
    });

    it("should reject invalid confidence range", async () => {
      await expect(
        listInsights({ group_id: testGroupId, min_confidence: -0.1 })
      ).rejects.toThrow("min_confidence must be between 0 and 1");

      await expect(
        listInsights({ group_id: testGroupId, max_confidence: 1.5 })
      ).rejects.toThrow("max_confidence must be between 0 and 1");
    });
  });

  // =========================================================================
  // getCurrentInsight Tests
  // =========================================================================

  describe("getCurrentInsight", () => {
    it("should return null for non-existent insight", async () => {
      const result = await getCurrentInsight("non-existent", testGroupId);
      expect(result).toBeNull();
    });

    it("should return the current version of an insight", async () => {
      const insight: InsightInsert = {
        insight_id: "current-test-1",
        group_id: testGroupId,
        content: "Version 1",
        confidence: 0.7,
      };

      await createInsight(insight);
      await createInsightVersion("current-test-1", "Version 2", 0.9, testGroupId);

      const result = await getCurrentInsight("current-test-1", testGroupId);

      expect(result).not.toBeNull();
      expect(result?.version).toBe(2);
      expect(result?.content).toBe("Version 2");
      expect(result?.confidence).toBe(0.9);
    });

    it("should require insight_id and group_id", async () => {
      await expect(getCurrentInsight("", testGroupId)).rejects.toThrow(
        "insight_id is required"
      );
      await expect(getCurrentInsight("test", "")).rejects.toThrow(
        "group_id is required"
      );
    });
  });

  // =========================================================================
  // getInsightVersion Tests
  // =========================================================================

  describe("getInsightVersion", () => {
    it("should return null for non-existent version", async () => {
      const result = await getInsightVersion("non-existent", 1, testGroupId);
      expect(result).toBeNull();
    });

    it("should return a specific version", async () => {
      const insight: InsightInsert = {
        insight_id: "version-test-1",
        group_id: testGroupId,
        content: "Version 1",
        confidence: 0.7,
      };

      await createInsight(insight);
      await createInsightVersion("version-test-1", "Version 2", 0.9, testGroupId);

      const v1 = await getInsightVersion("version-test-1", 1, testGroupId);
      const v2 = await getInsightVersion("version-test-1", 2, testGroupId);

      expect(v1?.content).toBe("Version 1");
      expect(v2?.content).toBe("Version 2");
    });

    it("should reject version < 1", async () => {
      await expect(getInsightVersion("test", 0, testGroupId)).rejects.toThrow(
        "version must be >= 1"
      );
    });
  });

  // =========================================================================
  // getInsightHistory Tests
  // =========================================================================

  describe("getInsightHistory", () => {
    it("should return empty array for non-existent insight", async () => {
      const result = await getInsightHistory("non-existent", testGroupId);
      expect(result).toEqual([]);
    });

    it("should return full version history", async () => {
      const insight: InsightInsert = {
        insight_id: "history-test-1",
        group_id: testGroupId,
        content: "Version 1",
        confidence: 0.7,
      };

      await createInsight(insight);
      await createInsightVersion("history-test-1", "Version 2", 0.8, testGroupId);
      await createInsightVersion("history-test-1", "Version 3", 0.9, testGroupId);

      const history = await getInsightHistory("history-test-1", testGroupId);

      expect(history.length).toBe(3);
      // Should be ordered by version descending
      expect(history[0].insight.version).toBe(3);
      expect(history[1].insight.version).toBe(2);
      expect(history[2].insight.version).toBe(1);

      // Check supersedes relationships
      expect(history[0].supersedes?.version).toBe(2);
      expect(history[1].supersedes?.version).toBe(1);
      expect(history[2].supersedes).toBeNull();
    });

    it("should require insight_id and group_id", async () => {
      await expect(getInsightHistory("", testGroupId)).rejects.toThrow(
        "insight_id is required"
      );
      await expect(getInsightHistory("test", "")).rejects.toThrow(
        "group_id is required"
      );
    });
  });

  // =========================================================================
  // listInsights Tests
  // =========================================================================

  describe("listInsights", () => {
    beforeEach(async () => {
      // Create some test insights
      for (let i = 1; i <= 5; i++) {
        await createInsight({
          insight_id: `list-test-${i}`,
          group_id: testGroupId,
          content: `Insight ${i}`,
          confidence: 0.5 + i * 0.1,
          source_type: i % 2 === 0 ? "promotion" : "manual",
        });
      }
    });

    it("should list all insights for a group", async () => {
      const result = await listInsights({ group_id: testGroupId });

      expect(result.items.length).toBe(5);
      expect(result.total).toBe(5);
    });

    it("should filter by status", async () => {
      // Deprecate one insight
      await deprecateInsight("list-test-1", testGroupId);

      const result = await listInsights({
        group_id: testGroupId,
        status: "active",
      });

      expect(result.items.length).toBe(4);
      expect(result.items.every((i) => i.status === "active")).toBe(true);
    });

    it("should filter by source_type", async () => {
      const result = await listInsights({
        group_id: testGroupId,
        source_type: "promotion",
      });

      expect(result.items.length).toBe(2);
      expect(result.items.every((i) => i.source_type === "promotion")).toBe(true);
    });

    it("should filter by confidence range", async () => {
      const result = await listInsights({
        group_id: testGroupId,
        min_confidence: 0.7,
        max_confidence: 0.9,
      });

      expect(result.items.every((i) => i.confidence >= 0.7 && i.confidence <= 0.9)).toBe(true);
    });

    it("should support pagination", async () => {
      const page1 = await listInsights({
        group_id: testGroupId,
        limit: 2,
        offset: 0,
      });

      const page2 = await listInsights({
        group_id: testGroupId,
        limit: 2,
        offset: 2,
      });

      expect(page1.items.length).toBe(2);
      expect(page2.items.length).toBe(2);

      // No overlap between pages
      const ids1 = page1.items.map((i) => i.id);
      const ids2 = page2.items.map((i) => i.id);
      const overlap = ids1.some((id) => ids2.includes(id));
      expect(overlap).toBe(false);
    });

    it("should respect tenant isolation", async () => {
      // Create insight in other group
      await createInsight({
        insight_id: "other-group-insight",
        group_id: otherGroupId,
        content: "Other",
        confidence: 0.9,
      });

      const result = await listInsights({ group_id: testGroupId });

      expect(result.items.every((i) => i.group_id === testGroupId)).toBe(true);
    });
  });

  // =========================================================================
  // searchInsights Tests
  // =========================================================================

  describe("searchInsights", () => {
    beforeEach(async () => {
      await createInsight({
        insight_id: "search-test-1",
        group_id: testGroupId,
        content: "The quick brown fox",
        confidence: 0.9,
      });

      await createInsight({
        insight_id: "search-test-2",
        group_id: testGroupId,
        content: "The lazy dog",
        confidence: 0.8,
      });

      await createInsight({
        insight_id: "search-test-3",
        group_id: testGroupId,
        content: "Quick thinking required",
        confidence: 0.7,
      });
    });

    it("should find insights matching search term", async () => {
      const result = await searchInsights("quick", { group_id: testGroupId });

      // Note: CONTAINS is case-sensitive, so "Quick" won't match "quick"
      // Only search-test-1 ("The quick brown fox") matches
      expect(result.items.length).toBeGreaterThanOrEqual(1);
      expect(result.items.every((i) => 
        i.content.toLowerCase().includes("quick")
      )).toBe(true);
    });

    it("should require search term", async () => {
      await expect(searchInsights("", { group_id: testGroupId })).rejects.toThrow(
        "search_term is required"
      );
    });

    it("should respect tenant isolation in search", async () => {
      await createInsight({
        insight_id: "other-search",
        group_id: otherGroupId,
        content: "Quick in other group",
        confidence: 0.9,
      });

      const result = await searchInsights("Quick", { group_id: testGroupId });

      expect(result.items.every((i) => i.group_id === testGroupId)).toBe(true);
    });
  });

  // =========================================================================
  // getInsightById Tests
  // =========================================================================

  describe("getInsightById", () => {
    it("should return insight by ID", async () => {
      const created = await createInsight({
        insight_id: "by-id-test",
        group_id: testGroupId,
        content: "Test insight",
        confidence: 0.9,
      });

      const result = await getInsightById(created.id, testGroupId);

      expect(result).not.toBeNull();
      expect(result?.id).toBe(created.id);
      expect(result?.content).toBe("Test insight");
    });

    it("should return null for non-existent ID", async () => {
      const result = await getInsightById("non-existent-id", testGroupId);
      expect(result).toBeNull();
    });

    it("should not return insight from another tenant", async () => {
      const created = await createInsight({
        insight_id: "cross-tenant-by-id",
        group_id: testGroupId,
        content: "Test",
        confidence: 0.9,
      });

      const result = await getInsightById(created.id, otherGroupId);
      expect(result).toBeNull();
    });
  });

  // =========================================================================
  // getActiveInsightCount Tests
  // =========================================================================

  describe("getActiveInsightCount", () => {
    it("should return count of active insights", async () => {
      await createInsight({
        insight_id: "count-test-1",
        group_id: testGroupId,
        content: "Active 1",
        confidence: 0.9,
      });

      await createInsight({
        insight_id: "count-test-2",
        group_id: testGroupId,
        content: "Active 2",
        confidence: 0.8,
      });

      await createInsight({
        insight_id: "count-test-3",
        group_id: testGroupId,
        content: "To deprecate",
        confidence: 0.7,
      });

      await deprecateInsight("count-test-3", testGroupId);

      const count = await getActiveInsightCount(testGroupId);
      expect(count).toBe(2);
    });

    it("should respect tenant isolation", async () => {
      await createInsight({
        insight_id: "isolation-count-1",
        group_id: testGroupId,
        content: "Test",
        confidence: 0.9,
      });

      await createInsight({
        insight_id: "isolation-count-2",
        group_id: otherGroupId,
        content: "Test",
        confidence: 0.9,
      });

      const count = await getActiveInsightCount(testGroupId);
      expect(count).toBe(1);
    });
  });
});