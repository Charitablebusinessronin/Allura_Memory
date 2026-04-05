/**
 * Memory MCP Wrapper Tests
 * Story 1.7: TypeScript wrapper for MCP Docker tools
 * 
 * Tests automatic group_id injection and tenant isolation enforcement.
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { memory, Entity, Relationship, QueryResult, SearchResult } from "./mcp-wrapper";
import { validateTenantGroupId } from "../validation/tenant-group-id";
import { GroupIdValidationError } from "../validation/group-id";

// Mock MCP Docker tools for testing
const mockCreateEntities = vi.fn();
const mockCreateRelations = vi.fn();
const mockReadGraph = vi.fn();
const mockExecuteSql = vi.fn();
const mockFindMemoriesByName = vi.fn();

// Reset mocks before each test
beforeEach(() => {
  mockCreateEntities.mockClear();
  mockCreateRelations.mockClear();
  mockReadGraph.mockClear();
  mockExecuteSql.mockClear();
  mockFindMemoriesByName.mockClear();
});

describe("memory() MCP Wrapper", () => {
  const TEST_GROUP_ID = "allura-test-workspace";
  const INVALID_GROUP_ID = "invalid-group";

  describe("createEntity", () => {
    it("should create entity with automatic group_id injection", async () => {
      const entityData = {
        name: "Test Entity",
        type: "TestType",
        description: "Test description",
      };

      mockCreateEntities.mockResolvedValueOnce({
        entities: [
          {
            name: "Test Entity",
            type: "TestType",
            description: "Test description",
            group_id: TEST_GROUP_ID,
            created_at: new Date().toISOString(),
          },
        ],
      });

      const result = await memory.createEntity("TestType", entityData, TEST_GROUP_ID);

      expect(result).toMatchObject({
        name: "Test Entity",
        type: "TestType",
        group_id: TEST_GROUP_ID,
      });
      expect(mockCreateEntities).toHaveBeenCalledWith(
        expect.objectContaining({
          entities: expect.arrayContaining([
            expect.objectContaining({
              group_id: TEST_GROUP_ID,
            }),
          ]),
        })
      );
    });

    it("should reject invalid group_id with RK-01 error", async () => {
      const entityData = {
        name: "Test Entity",
        type: "TestType",
        description: "Test description",
      };

      await expect(
        memory.createEntity("TestType", entityData, INVALID_GROUP_ID)
      ).rejects.toThrow(GroupIdValidationError);

      // Verify error code is RK-01
      try {
        await memory.createEntity("TestType", entityData, INVALID_GROUP_ID);
      } catch (error) {
        expect(error).toBeInstanceOf(GroupIdValidationError);
        expect((error as GroupIdValidationError).message).toContain("RK-01");
      }
    });

    it("should enforce allura-{org} naming pattern", async () => {
      const entityData = {
        name: "Test Entity",
        type: "TestType",
      };

      // Non-allura namespace should fail
      await expect(
        memory.createEntity("TestType", entityData, "wrong-namespace")
      ).rejects.toThrow(GroupIdValidationError);

      // Missing allura- prefix should fail
      await expect(
        memory.createEntity("TestType", entityData, "faith-meats")
      ).rejects.toThrow(GroupIdValidationError);

      // Correct format should succeed
      mockCreateEntities.mockResolvedValueOnce({
        entities: [{ name: "Test", group_id: "allura-faith-meats" }],
      });

      await expect(
        memory.createEntity("TestType", entityData, "allura-faith-meats")
      ).resolves.toBeDefined();
    });

    it("should always include group_id even if caller forgets", async () => {
      // This should be caught at validation time
      await expect(
        memory.createEntity("TestType", { name: "Test" }, "" as any)
      ).rejects.toThrow(GroupIdValidationError);

      await expect(
        memory.createEntity("TestType", { name: "Test" }, null as any)
      ).rejects.toThrow(GroupIdValidationError);

      await expect(
        memory.createEntity("TestType", { name: "Test" }, undefined as any)
      ).rejects.toThrow(GroupIdValidationError);
    });
  });

  describe("createRelationship", () => {
    it("should create relationship with group_id", async () => {
      const fromName = "EntityA";
      const toName = "EntityB";

      mockCreateRelations.mockResolvedValueOnce({
        relations: [
          {
            source: fromName,
            target: toName,
            relationType: "RELATES_TO",
            group_id: TEST_GROUP_ID,
          },
        ],
      });

      const result = await memory.createRelationship(
        fromName,
        toName,
        "RELATES_TO",
        {},
        TEST_GROUP_ID
      );

      expect(result).toMatchObject({
        source: fromName,
        target: toName,
        relationType: "RELATES_TO",
        group_id: TEST_GROUP_ID,
      });
      expect(mockCreateRelations).toHaveBeenCalledWith(
        expect.objectContaining({
          relations: expect.arrayContaining([
            expect.objectContaining({
              group_id: TEST_GROUP_ID,
            }),
          ]),
        })
      );
    });

    it("should reject invalid group_id for relationships", async () => {
      await expect(
        memory.createRelationship("A", "B", "RELATES_TO", {}, INVALID_GROUP_ID)
      ).rejects.toThrow(GroupIdValidationError);
    });

    it("should support relationship properties", async () => {
      const props = { confidence: 0.95, source: "test" };

      mockCreateRelations.mockResolvedValueOnce({
        relations: [
          {
            source: "A",
            target: "B",
            relationType: "EVIDENCE_FOR",
            props,
            group_id: TEST_GROUP_ID,
          },
        ],
      });

      const result = await memory.createRelationship(
        "A",
        "B",
        "EVIDENCE_FOR",
        props,
        TEST_GROUP_ID
      );

      expect(result).toMatchObject({
        props,
      });
    });
  });

  describe("query", () => {
    it("should execute Cypher query with group_id filter", async () => {
      const cypher = "MATCH (n:Insight) RETURN n";
      const params = { limit: 10 };

      mockExecuteSql.mockResolvedValueOnce({
        records: [
          { n: { properties: { name: "Test", group_id: TEST_GROUP_ID } } },
        ],
      });

      const result = await memory.query(cypher, params, TEST_GROUP_ID);

      expect(result.records).toBeDefined();
      expect(mockExecuteSql).toHaveBeenCalledWith(
        expect.objectContaining({
          sql_query: expect.stringContaining(TEST_GROUP_ID),
        })
      );
    });

    it("should enforce group_id in WHERE clause", async () => {
      const cypher = "MATCH (n:Insight) RETURN n";

      // Query without group_id should be rejected or auto-patched
      mockExecuteSql.mockResolvedValueOnce({ records: [] });

      await memory.query(cypher, {}, TEST_GROUP_ID);

      // Verify group_id was injected into query
      const callArgs = mockExecuteSql.mock.calls[0][0];
      expect(callArgs.sql_query).toMatch(/group_id|WHERE/);
    });

    it("should reject queries without group_id parameter", async () => {
      await expect(
        memory.query("MATCH (n) RETURN n", {}, "" as any)
      ).rejects.toThrow(GroupIdValidationError);
    });
  });

  describe("search", () => {
    it("should search memories with group_id filtering", async () => {
      const query = "test insight";
      const mockResults = [
        {
          name: "Test Insight 1",
          type: "Insight",
          observations: ["group_id: " + TEST_GROUP_ID, "content: test"],
        },
        {
          name: "Test Insight 2",
          type: "Insight",
          observations: ["group_id: " + TEST_GROUP_ID, "content: another"],
        },
      ];

      mockReadGraph.mockResolvedValueOnce({
        entities: mockResults,
      });

      const results = await memory.search(query, TEST_GROUP_ID);

      expect(results).toHaveLength(2);
      expect(results[0]).toMatchObject({
        name: "Test Insight 1",
        type: "Insight",
      });
    });

    it("should filter results by group_id", async () => {
      const query = "test";

      mockReadGraph.mockResolvedValueOnce({
        entities: [
          { name: "A", observations: ["group_id: " + TEST_GROUP_ID] },
          { name: "B", observations: ["group_id: other-tenant"] }, // Wrong tenant
        ],
      });

      const results = await memory.search(query, TEST_GROUP_ID);

      // Should only return entities matching group_id
      expect(results).toHaveLength(1);
      expect(results[0].name).toBe("A");
    });

    it("should reject invalid group_id for search", async () => {
      await expect(
        memory.search("test", INVALID_GROUP_ID)
      ).rejects.toThrow(GroupIdValidationError);
    });
  });

  describe("findById", () => {
    it("should find entity by name with group_id check", async () => {
      const entityName = "TestEntity";
      const mockEntity = {
        name: entityName,
        type: "Insight",
        observations: ["group_id: " + TEST_GROUP_ID, "content: test"],
      };

      mockFindMemoriesByName.mockResolvedValueOnce({
        entities: [mockEntity],
      });

      const result = await memory.findById(entityName, TEST_GROUP_ID);

      expect(result).toMatchObject({
        name: entityName,
      });
      expect(mockFindMemoriesByName).toHaveBeenCalledWith(
        expect.objectContaining({
          names: [entityName],
        })
      );
    });

    it("should return null if entity belongs to different tenant", async () => {
      const entityName = "PrivateEntity";
      const mockEntity = {
        name: entityName,
        observations: ["group_id: other-tenant"], // Different tenant
      };

      mockFindMemoriesByName.mockResolvedValueOnce({
        entities: [mockEntity],
      });

      const result = await memory.findById(entityName, TEST_GROUP_ID);

      // Should return null for cross-tenant access
      expect(result).toBeNull();
    });

    it("should return null for non-existent entity", async () => {
      mockFindMemoriesByName.mockResolvedValueOnce({ entities: [] });

      const result = await memory.findById("NonExistent", TEST_GROUP_ID);

      expect(result).toBeNull();
    });

    it("should reject invalid group_id for findById", async () => {
      await expect(
        memory.findById("TestEntity", INVALID_GROUP_ID)
      ).rejects.toThrow(GroupIdValidationError);
    });
  });

  describe("Type Safety", () => {
    it("should return properly typed Entity from createEntity", async () => {
      mockCreateEntities.mockResolvedValueOnce({
        entities: [
          {
            name: "Typed Entity",
            type: "Insight",
            description: "Test",
            group_id: TEST_GROUP_ID,
            observations: ["obs1"],
            created_at: new Date().toISOString(),
          },
        ],
      });

      const entity: Entity = await memory.createEntity(
        "Insight",
        { name: "Typed Entity", description: "Test" },
        TEST_GROUP_ID
      );

      // TypeScript should enforce these types
      expect(entity.name).toBeDefined();
      expect(entity.type).toBeDefined();
      expect(entity.group_id).toBe(TEST_GROUP_ID);
    });

    it("should return properly typed Relationship from createRelationship", async () => {
      mockCreateRelations.mockResolvedValueOnce({
        relations: [
          {
            source: "A",
            target: "B",
            relationType: "RELATES_TO",
            group_id: TEST_GROUP_ID,
          },
        ],
      });

      const rel: Relationship = await memory.createRelationship(
        "A",
        "B",
        "RELATES_TO",
        {},
        TEST_GROUP_ID
      );

      expect(rel.source).toBeDefined();
      expect(rel.target).toBeDefined();
      expect(rel.relationType).toBeDefined();
      expect(rel.group_id).toBe(TEST_GROUP_ID);
    });

    it("should return properly typed QueryResult from query", async () => {
      mockExecuteSql.mockResolvedValueOnce({
        records: [{ n: { properties: { name: "Test" } } }],
        query_time_ms: 42,
      });

      const result: QueryResult = await memory.query(
        "MATCH (n) RETURN n",
        {},
        TEST_GROUP_ID
      );

      expect(result.records).toBeDefined();
      expect(result.query_time_ms).toBeGreaterThanOrEqual(0);
    });

    it("should return properly typed SearchResult[] from search", async () => {
      mockReadGraph.mockResolvedValueOnce({
        entities: [
          {
            name: "Result",
            type: "Insight",
            observations: ["group_id: " + TEST_GROUP_ID],
          },
        ],
      });

      const results: SearchResult[] = await memory.search("test", TEST_GROUP_ID);

      expect(Array.isArray(results)).toBe(true);
      if (results.length > 0) {
        expect(results[0].name).toBeDefined();
        expect(results[0].type).toBeDefined();
      }
    });
  });

  describe("Error Handling", () => {
    it("should throw RK-01 error for all tenant isolation violations", async () => {
      const testCases = [
        () => memory.createEntity("Type", {}, "" as any),
        () => memory.createRelationship("A", "B", "REL", {}, "" as any),
        () => memory.query("MATCH (n) RETURN n", {}, "" as any),
        () => memory.search("test", "" as any),
        () => memory.findById("Test", "" as any),
      ];

      for (const testCase of testCases) {
        try {
          await testCase();
          // Should not reach here
          expect(true).toBe(false); // Force failure
        } catch (error) {
          expect(error).toBeInstanceOf(GroupIdValidationError);
          expect((error as Error).message).toMatch(/allura-|RK-01/);
        }
      }
    });

    it("should provide helpful error messages for debugging", async () => {
      try {
        await memory.createEntity("Type", {}, "bad-format");
      } catch (error) {
        expect(error).toBeInstanceOf(GroupIdValidationError);
        const message = (error as Error).message;
        
        // Should explain what went wrong
        expect(message).toMatch(/allura-\{org\}/);
        
        // Should provide valid examples
        expect(message).toMatch(/allura-faith-meats|allura-creative/);
      }
    });
  });
});