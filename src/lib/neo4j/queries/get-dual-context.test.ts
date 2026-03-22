import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import {
  getDualContextSemanticMemory,
  getMergedDualContextInsights,
  getDualContextWorkingMemory,
  isGlobalContext,
  validateCrossGroupAccess,
  searchDualContextInsights,
  GLOBAL_GROUP_ID,
  DualInsightQueryError,
  type DualInsightQueryParams,
} from "./get-dual-context";
import {
  createInsight,
  type InsightInsert,
} from "./insert-insight";
import { getDriver, closeDriver } from "../connection";

/**
 * Test suite for dual-context semantic memory queries (Neo4j)
 */
describe("get-dual-context (Neo4j)", () => {
  const testProjectGroup = "test-dual-project";
  const testOtherProject = "test-dual-other";
  const globalGroupId = GLOBAL_GROUP_ID;

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
        { groups: [testProjectGroup, testOtherProject, globalGroupId] }
      );
      await session.run(
        "MATCH (h:InsightHead) WHERE h.group_id IN $groups DETACH DELETE h",
        { groups: [testProjectGroup, testOtherProject, globalGroupId] }
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
        { groups: [testProjectGroup, testOtherProject, globalGroupId] }
      );
      await session.run(
        "MATCH (h:InsightHead) WHERE h.group_id IN $groups DETACH DELETE h",
        { groups: [testProjectGroup, testOtherProject, globalGroupId] }
      );
    } finally {
      await session.close();
    }

    await closeDriver();
  });

  beforeEach(async () => {
    // Clean up before each test
    const driver = getDriver();
    const session = driver.session();
    try {
      await session.run(
        "MATCH (i:Insight) WHERE i.group_id IN $groups DETACH DELETE i",
        { groups: [testProjectGroup, testOtherProject, globalGroupId] }
      );
      await session.run(
        "MATCH (h:InsightHead) WHERE h.group_id IN $groups DETACH DELETE h",
        { groups: [testProjectGroup, testOtherProject, globalGroupId] }
      );
    } finally {
      await session.close();
    }
  });

  // =========================================================================
  // Validation Tests
  // =========================================================================

  describe("validation", () => {
    it("should require project_group_id", async () => {
      const params = {} as DualInsightQueryParams;
      await expect(getDualContextSemanticMemory(params)).rejects.toThrow(
        DualInsightQueryError
      );
      await expect(getDualContextSemanticMemory(params)).rejects.toThrow(
        "project_group_id is required"
      );
    });

    it("should reject empty project_group_id", async () => {
      const params: DualInsightQueryParams = { project_group_id: "" };
      await expect(getDualContextSemanticMemory(params)).rejects.toThrow(
        "project_group_id is required"
      );
    });

    it("should reject GLOBAL_GROUP_ID as project_group_id", async () => {
      const params: DualInsightQueryParams = { project_group_id: GLOBAL_GROUP_ID };
      await expect(getDualContextSemanticMemory(params)).rejects.toThrow(
        `project_group_id cannot be '${GLOBAL_GROUP_ID}'`
      );
    });

    it("should reject negative limit_per_scope", async () => {
      const params: DualInsightQueryParams = {
        project_group_id: testProjectGroup,
        limit_per_scope: 0,
      };
      await expect(getDualContextSemanticMemory(params)).rejects.toThrow(
        "limit_per_scope must be a positive number"
      );
    });

    it("should reject invalid confidence range", async () => {
      const params: DualInsightQueryParams = {
        project_group_id: testProjectGroup,
        min_confidence: -0.1,
      };
      await expect(getDualContextSemanticMemory(params)).rejects.toThrow(
        "min_confidence must be between 0 and 1"
      );
    });
  });

  // =========================================================================
  // Dual-Context Retrieval Tests
  // =========================================================================

  describe("dual-context retrieval", () => {
    beforeEach(async () => {
      // Create project insights
      for (let i = 0; i < 3; i++) {
        await createInsight({
          insight_id: `project-insight-${i}`,
          group_id: testProjectGroup,
          content: `Project insight number ${i}`,
          confidence: 0.8 + i * 0.05,
        });
      }

      // Create global insights
      for (let i = 0; i < 2; i++) {
        await createInsight({
          insight_id: `global-insight-${i}`,
          group_id: globalGroupId,
          content: `Global insight number ${i}`,
          confidence: 0.9,
        });
      }

      // Create other project insights (should NOT be accessible)
      await createInsight({
        insight_id: "other-project-insight",
        group_id: testOtherProject,
        content: "Other project insight",
        confidence: 0.7,
      });
    });

    it("should retrieve both project and global insights", async () => {
      const result = await getDualContextSemanticMemory({
        project_group_id: testProjectGroup,
      });

      expect(result.project_insights.length).toBe(3);
      expect(result.global_insights.length).toBe(2);
      expect(result.total_count).toBe(5);
    });

    it("should preserve scope metadata in results", async () => {
      const result = await getDualContextSemanticMemory({
        project_group_id: testProjectGroup,
      });

      // Project insights should have scope = "project"
      result.project_insights.forEach((insight) => {
        expect(insight.scope).toBe("project");
        expect(insight.source_group_id).toBe(testProjectGroup);
      });

      // Global insights should have scope = "global"
      result.global_insights.forEach((insight) => {
        expect(insight.scope).toBe("global");
        expect(insight.source_group_id).toBe(globalGroupId);
      });
    });

    it("should NOT include insights from other projects", async () => {
      const result = await getDualContextSemanticMemory({
        project_group_id: testProjectGroup,
      });

      const allInsights = [...result.project_insights, ...result.global_insights];
      const hasOtherProject = allInsights.some(
        (i) => i.source_group_id === testOtherProject
      );
      expect(hasOtherProject).toBe(false);
    });

    it("should respect include_global = false", async () => {
      const result = await getDualContextSemanticMemory({
        project_group_id: testProjectGroup,
        include_global: false,
      });

      expect(result.project_insights.length).toBe(3);
      expect(result.global_insights.length).toBe(0);
      expect(result.metadata.included_global).toBe(false);
    });

    it("should respect limit_per_scope", async () => {
      const result = await getDualContextSemanticMemory({
        project_group_id: testProjectGroup,
        limit_per_scope: 2,
      });

      expect(result.project_insights.length).toBeLessThanOrEqual(2);
      expect(result.global_insights.length).toBeLessThanOrEqual(2);
    });

    it("should filter by status", async () => {
      // Deprecate one project insight
      await createInsight({
        insight_id: "deprecated-insight",
        group_id: testProjectGroup,
        content: "Deprecated insight",
        confidence: 0.5,
      });

      // Note: We'd need to deprecate it, but for now test the active filter
      const result = await getDualContextSemanticMemory({
        project_group_id: testProjectGroup,
        status: "active",
      });

      expect(result.project_insights.every((i) => i.status === "active")).toBe(true);
    });

    it("should filter by min_confidence", async () => {
      const result = await getDualContextSemanticMemory({
        project_group_id: testProjectGroup,
        min_confidence: 0.85,
      });

      expect(
        result.project_insights.every((i) => i.confidence >= 0.85)
      ).toBe(true);
    });

    it("should include correct metadata", async () => {
      const result = await getDualContextSemanticMemory({
        project_group_id: testProjectGroup,
      });

      expect(result.metadata.project_group_id).toBe(testProjectGroup);
      expect(result.metadata.included_global).toBe(true);
      expect(result.metadata.retrieved_at).toBeInstanceOf(Date);
      expect(result.metadata.project_count).toBe(3);
      expect(result.metadata.global_count).toBe(2);
    });
  });

  // =========================================================================
  // Merged Results Tests
  // =========================================================================

  describe("merged results", () => {
    beforeEach(async () => {
      // Create project insights with different confidence
      await createInsight({
        insight_id: "project-low",
        group_id: testProjectGroup,
        content: "Low confidence project",
        confidence: 0.7,
      });

      await createInsight({
        insight_id: "project-high",
        group_id: testProjectGroup,
        content: "High confidence project",
        confidence: 0.95,
      });

      // Create global insight
      await createInsight({
        insight_id: "global-medium",
        group_id: globalGroupId,
        content: "Medium confidence global",
        confidence: 0.85,
      });
    });

    it("should merge and sort insights by confidence DESC", async () => {
      const merged = await getMergedDualContextInsights({
        project_group_id: testProjectGroup,
      });

      expect(merged.length).toBe(3);

      // Should be sorted by confidence DESC (highest first)
      for (let i = 1; i < merged.length; i++) {
        expect(merged[i - 1].confidence).toBeGreaterThanOrEqual(merged[i].confidence);
      }
    });

    it("should preserve scope in merged results", async () => {
      const merged = await getMergedDualContextInsights({
        project_group_id: testProjectGroup,
      });

      const projectInsights = merged.filter((i) => i.scope === "project");
      const globalInsights = merged.filter((i) => i.scope === "global");

      expect(projectInsights.length).toBe(2);
      expect(globalInsights.length).toBe(1);
    });
  });

  // =========================================================================
  // Working Memory Tests
  // =========================================================================

  describe("working memory", () => {
    beforeEach(async () => {
      for (let i = 0; i < 15; i++) {
        await createInsight({
          insight_id: `project-wm-${i}`,
          group_id: testProjectGroup,
          content: `Working memory project ${i}`,
          confidence: 0.8,
        });
      }

      for (let i = 0; i < 10; i++) {
        await createInsight({
          insight_id: `global-wm-${i}`,
          group_id: globalGroupId,
          content: `Working memory global ${i}`,
          confidence: 0.9,
        });
      }
    });

    it("should limit working memory results", async () => {
      const result = await getDualContextWorkingMemory(testProjectGroup, 5);

      expect(result.project_insights.length).toBeLessThanOrEqual(5);
      expect(result.global_insights.length).toBeLessThanOrEqual(5);
    });

    it("should default to 10 insights per scope", async () => {
      const result = await getDualContextWorkingMemory(testProjectGroup);

      expect(result.project_insights.length).toBeLessThanOrEqual(10);
      expect(result.global_insights.length).toBeLessThanOrEqual(10);
    });

    it("should filter for active status only", async () => {
      const result = await getDualContextWorkingMemory(testProjectGroup);

      expect(
        result.project_insights.every((i) => i.status === "active")
      ).toBe(true);
      expect(
        result.global_insights.every((i) => i.status === "active")
      ).toBe(true);
    });
  });

  // =========================================================================
  // Search Tests
  // =========================================================================

  describe("search", () => {
    beforeEach(async () => {
      await createInsight({
        insight_id: "project-search-1",
        group_id: testProjectGroup,
        content: "The quick brown fox",
        confidence: 0.9,
      });

      await createInsight({
        insight_id: "project-search-2",
        group_id: testProjectGroup,
        content: "The lazy dog",
        confidence: 0.8,
      });

      await createInsight({
        insight_id: "global-search-1",
        group_id: globalGroupId,
        content: "Quick thinking required",
        confidence: 0.85,
      });
    });

    it("should find insights matching search term in both scopes", async () => {
      const result = await searchDualContextInsights("quick", {
        project_group_id: testProjectGroup,
      });

      // Note: CONTAINS is case-sensitive
      expect(result.total_count).toBeGreaterThanOrEqual(1);
      expect(
        result.project_insights.every((i) =>
          i.content.toLowerCase().includes("quick")
        )
      ).toBe(true);
    });

    it("should require search term", async () => {
      await expect(
        searchDualContextInsights("", { project_group_id: testProjectGroup })
      ).rejects.toThrow("search_term is required");
    });

    it("should respect include_global = false in search", async () => {
      const result = await searchDualContextInsights("quick", {
        project_group_id: testProjectGroup,
        include_global: false,
      });

      expect(result.global_insights.length).toBe(0);
      expect(result.metadata.included_global).toBe(false);
    });
  });

  // =========================================================================
  // Tenant Isolation Tests
  // =========================================================================

  describe("tenant isolation", () => {
    it("should identify global context correctly", () => {
      expect(isGlobalContext(GLOBAL_GROUP_ID)).toBe(true);
      expect(isGlobalContext("any-other-group")).toBe(false);
      expect(isGlobalContext(testProjectGroup)).toBe(false);
    });

    it("should allow same-group access", () => {
      expect(() =>
        validateCrossGroupAccess(testProjectGroup, testProjectGroup)
      ).not.toThrow();
    });

    it("should allow global context access from any project", () => {
      expect(() =>
        validateCrossGroupAccess(testProjectGroup, GLOBAL_GROUP_ID)
      ).not.toThrow();
    });

    it("should deny cross-project access", () => {
      expect(() =>
        validateCrossGroupAccess(testProjectGroup, testOtherProject)
      ).toThrow(DualInsightQueryError);
      expect(() =>
        validateCrossGroupAccess(testProjectGroup, testOtherProject)
      ).toThrow("Cross-project access denied");
    });
  });

  // =========================================================================
  // Edge Cases Tests
  // =========================================================================

  describe("edge cases", () => {
    it("should handle empty project insights", async () => {
      const result = await getDualContextSemanticMemory({
        project_group_id: "empty-project",
      });

      expect(result.project_insights.length).toBe(0);
      expect(result.metadata.project_count).toBe(0);
    });

    it("should handle empty global insights", async () => {
      // Create only project insights
      await createInsight({
        insight_id: "only-project",
        group_id: testProjectGroup,
        content: "Only project insight",
        confidence: 0.9,
      });

      const result = await getDualContextSemanticMemory({
        project_group_id: testProjectGroup,
      });

      // Should still return empty global array
      expect(Array.isArray(result.global_insights)).toBe(true);
    });
  });
});