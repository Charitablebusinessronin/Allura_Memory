import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import {
  createInsight,
  createInsightVersion,
  deprecateInsight,
  revertInsightVersion,
  InsightValidationError,
  InsightConflictError,
  type InsightInsert,
} from "./insert-insight";
import { getDriver, closeDriver } from "../connection";
import { writeTransaction, readTransaction, type ManagedTransaction } from "../connection";

/**
 * Test suite for Neo4j insight insertion and versioning
 */
describe("insert-insight", () => {
  const testGroupId = "test-insight-group";
  const otherGroupId = "other-insight-group";

  // Track created insights for cleanup
  const createdInsightIds: string[] = [];

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

  beforeEach(() => {
    createdInsightIds.length = 0;
  });

  // =========================================================================
  // Validation Tests
  // =========================================================================

  describe("validation", () => {
    it("should require insight_id", async () => {
      const insight: InsightInsert = {
        insight_id: "",
        group_id: testGroupId,
        content: "Test insight",
        confidence: 0.9,
        topic_key: "test.insight",
      };

      await expect(createInsight(insight)).rejects.toThrow(InsightValidationError);
      await expect(createInsight(insight)).rejects.toThrow("insight_id is required");
    });

    it("should require group_id", async () => {
      const insight: InsightInsert = {
        insight_id: "test-insight-1",
        group_id: "",
        content: "Test insight",
        confidence: 0.9,
        topic_key: "test.insight",
      };

      await expect(createInsight(insight)).rejects.toThrow("group_id is required");
    });

    it("should require content", async () => {
      const insight: InsightInsert = {
        insight_id: "test-insight-2",
        group_id: testGroupId,
        content: "",
        confidence: 0.9,
        topic_key: "test.insight",
      };

      await expect(createInsight(insight)).rejects.toThrow("content is required");
    });

    it("should require confidence between 0 and 1", async () => {
      const insight1: InsightInsert = {
        insight_id: "test-insight-3",
        group_id: testGroupId,
        content: "Test",
        confidence: -0.1,
        topic_key: "test.insight",
      };

      await expect(createInsight(insight1)).rejects.toThrow(
        "confidence must be between 0 and 1"
      );

      const insight2: InsightInsert = {
        insight_id: "test-insight-4",
        group_id: testGroupId,
        content: "Test",
        confidence: 1.1,
        topic_key: "test.insight",
      };

      await expect(createInsight(insight2)).rejects.toThrow(
        "confidence must be between 0 and 1"
      );
    });

    it("should reject creating duplicate insight_id", async () => {
      const insight: InsightInsert = {
        insight_id: "duplicate-test",
        group_id: testGroupId,
        content: "First insight",
        confidence: 0.9,
        topic_key: "test.insight",
      };

      const result1 = await createInsight(insight);
      createdInsightIds.push(result1.id);

      // Second create with same insight_id should fail
      await expect(createInsight(insight)).rejects.toThrow(InsightConflictError);
    });
  });

  // =========================================================================
  // Create Insight Tests
  // =========================================================================

  describe("createInsight", () => {
    it("should create a new insight with version 1", async () => {
      const insight: InsightInsert = {
        insight_id: "new-insight-1",
        group_id: testGroupId,
        content: "This is a test insight",
        confidence: 0.85,
        topic_key: "test.insight",
        source_type: "manual",
        created_by: "test-agent",
      };

      const result = await createInsight(insight);
      createdInsightIds.push(result.id);

      expect(result.insight_id).toBe("new-insight-1");
      expect(result.version).toBe(1);
      expect(result.content).toBe("This is a test insight");
      expect(result.confidence).toBe(0.85);
      expect(result.group_id).toBe(testGroupId);
      expect(result.status).toBe("active");
      expect(result.created_by).toBe("test-agent");
    });

    it("should create InsightHead node with correct metadata", async () => {
      const insight: InsightInsert = {
        insight_id: "head-test-1",
        group_id: testGroupId,
        content: "Test for head node",
        confidence: 0.75,
        topic_key: "test.insight",
      };

      await createInsight(insight);

      // Verify InsightHead was created
      const driver = getDriver();
      const session = driver.session();
      try {
        const result = await session.run(
          "MATCH (h:InsightHead {insight_id: $insight_id}) RETURN h",
          { insight_id: "head-test-1" }
        );

        expect(result.records.length).toBe(1);
        const head = result.records[0].get("h").properties;
        expect(head.group_id).toBe(testGroupId);
        expect(head.current_version.toNumber()).toBe(1);
      } finally {
        await session.close();
      }
    });

    it("should store metadata as JSON", async () => {
      const insight: InsightInsert = {
        insight_id: "metadata-test-1",
        group_id: testGroupId,
        content: "Test with metadata",
        confidence: 0.8,
        topic_key: "test.insight",
        metadata: { key: "value", nested: { foo: "bar" } },
      };

      const result = await createInsight(insight);
      createdInsightIds.push(result.id);

      expect(result.metadata).toEqual({ key: "value", nested: { foo: "bar" } });
    });
  });

  // =========================================================================
  // Version Tests
  // =========================================================================

  describe("createInsightVersion", () => {
    it("should create a new version with incremented version number", async () => {
      // Create initial insight
      const insight: InsightInsert = {
        insight_id: "version-test-1",
        group_id: testGroupId,
        content: "Version 1",
        confidence: 0.7,
        topic_key: "test.insight",
      };

      await createInsight(insight);

      // Create version 2
      const result = await createInsightVersion(
        "version-test-1",
        "Version 2",
        0.9,
        testGroupId
      );

      expect(result.version).toBe(2);
      expect(result.content).toBe("Version 2");
      expect(result.confidence).toBe(0.9);
    });

    it("should supersede previous version", async () => {
      const insight: InsightInsert = {
        insight_id: "supersede-test-1",
        group_id: testGroupId,
        content: "Version 1",
        confidence: 0.7,
        topic_key: "test.insight",
      };

      const v1 = await createInsight(insight);

      const v2 = await createInsightVersion(
        "supersede-test-1",
        "Version 2",
        0.9,
        testGroupId
      );

      // Verify v1 status changed to 'superseded'
      const driver = getDriver();
      const session = driver.session();
      let status: string | undefined;
      try {
        const result = await session.run(
          "MATCH (i:Insight {id: $id}) RETURN i.status as status",
          { id: v1.id }
        );
        status = result.records[0].get("status") as string;
      } finally {
        await session.close();
      }
      expect(status).toBe("superseded");

      // Verify v2 has SUPERSEDES relationship
      const session2 = driver.session();
      try {
        const result = await session2.run(
          "MATCH (v2:Insight {id: $v2id})-[s:SUPERSEDES]->(v1:Insight {id: $v1id}) RETURN s",
          { v2id: v2.id, v1id: v1.id }
        );
        expect(result.records.length).toBe(1);
      } finally {
        await session2.close();
      }
    });

    it("should throw for non-existent insight_id", async () => {
      await expect(
        createInsightVersion("non-existent", "content", 0.8, testGroupId)
      ).rejects.toThrow(InsightValidationError);
    });
  });

  // =========================================================================
  // Deprecation Tests
  // =========================================================================

  describe("deprecateInsight", () => {
    it("should mark insight as deprecated", async () => {
      const insight: InsightInsert = {
        insight_id: "deprecate-test-1",
        group_id: testGroupId,
        content: "To be deprecated",
        confidence: 0.8,
        topic_key: "test.insight",
      };

      await createInsight(insight);

      const result = await deprecateInsight(
        "deprecate-test-1",
        testGroupId,
        "No longer valid"
      );

      expect(result.status).toBe("deprecated");
    });

    it("should throw for non-existent insight", async () => {
      await expect(
        deprecateInsight("non-existent", testGroupId)
      ).rejects.toThrow(InsightValidationError);
    });
  });

  // =========================================================================
  // Revert Tests
  // =========================================================================

  describe("revertInsightVersion", () => {
    it("should create new version copying content from target version", async () => {
      const insight: InsightInsert = {
        insight_id: "revert-test-1",
        group_id: testGroupId,
        content: "Version 1",
        confidence: 0.7,
        topic_key: "test.insight",
      };

      await createInsight(insight);

      // Create version 2
      await createInsightVersion("revert-test-1", "Version 2", 0.8, testGroupId);

      // Create version 3
      await createInsightVersion("revert-test-1", "Version 3", 0.9, testGroupId);

      // Revert to version 1
      const result = await revertInsightVersion("revert-test-1", testGroupId, 1);

      expect(result.version).toBe(4);
      expect(result.content).toBe("Version 1");
      expect(result.confidence).toBe(0.7);
    });

    it("should throw for non-existent version", async () => {
      await expect(
        revertInsightVersion("non-existent", testGroupId, 1)
      ).rejects.toThrow(InsightValidationError);
    });
  });

  // =========================================================================
  // Tenant Isolation Tests
  // =========================================================================

  describe("tenant isolation", () => {
    it("should isolate insights by group_id", async () => {
      const insight1: InsightInsert = {
        insight_id: "isolation-test-1",
        group_id: testGroupId,
        content: "Group 1 insight",
        confidence: 0.9,
        topic_key: "test.insight",
      };

      const insight2: InsightInsert = {
        insight_id: "isolation-test-1",
        group_id: otherGroupId,
        content: "Group 2 insight",
        confidence: 0.8,
        topic_key: "test.insight",
      };

      // Same insight_id but different groups should both succeed
      const result1 = await createInsight(insight1);
      const result2 = await createInsight(insight2);

      expect(result1.group_id).toBe(testGroupId);
      expect(result2.group_id).toBe(otherGroupId);
    });

    it("should not allow cross-tenant version creation", async () => {
      const insight: InsightInsert = {
        insight_id: "cross-tenant-test",
        group_id: testGroupId,
        content: "Original",
        confidence: 0.9,
        topic_key: "test.insight",
      };

      await createInsight(insight);

      // Try to create version with different group_id
      await expect(
        createInsightVersion("cross-tenant-test", "New version", 0.9, otherGroupId)
      ).rejects.toThrow(InsightValidationError);
    });
  });
});