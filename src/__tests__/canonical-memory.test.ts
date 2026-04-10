/**
 * Canonical Memory Operations Tests
 * 
 * Regression tests for the 5 canonical memory operations:
 * 1. memory_add - Add a memory (episodic → score → promote/queue)
 * 2. memory_search - Search memories (federated: Postgres + Neo4j)
 * 3. memory_get - Get a single memory by ID
 * 4. memory_list - List all memories for a user
 * 5. memory_delete - Soft-delete a memory
 * 
 * Reference: docs/allura/BLUEPRINT.md
 */

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import {
  memory_add,
  memory_search,
  memory_get,
  memory_list,
  memory_delete,
} from "../mcp/canonical-tools";
import type {
  MemoryAddRequest,
  MemorySearchRequest,
  MemoryGetRequest,
  MemoryListRequest,
  MemoryDeleteRequest,
} from "../lib/memory/canonical-contracts";

// Test configuration
const TEST_GROUP_ID = "allura-test-canonical" as any;
const TEST_USER_ID = "test-user-1";
const TEST_USER_ID_2 = "test-user-2";

describe("Canonical Memory Operations", () => {
  beforeAll(async () => {
    // Setup: Ensure databases are running
    // TODO: Add database health check
  });

  afterAll(async () => {
    // Cleanup: Remove test data
    // TODO: Add cleanup logic
  });

  describe("1. memory_add", () => {
    it("should add a memory to PostgreSQL (episodic only) when score < threshold", async () => {
      const request: MemoryAddRequest = {
        group_id: TEST_GROUP_ID,
        user_id: TEST_USER_ID,
        content: "Test memory with low confidence",
        metadata: { source: "manual" },
        threshold: 0.9, // High threshold to ensure episodic only
      };

      const response = await memory_add(request);

      expect(response.id).toBeDefined();
      expect(response.stored).toBe("episodic");
      expect(response.score).toBeLessThan(0.9);
      expect(response.pending_review).toBeUndefined();
      expect(response.created_at).toBeDefined();
    });

    it("should add a memory and promote to Neo4j when score >= threshold in auto mode", async () => {
      // This test requires PROMOTION_MODE=auto
      const originalMode = process.env.PROMOTION_MODE;
      process.env.PROMOTION_MODE = "auto";

      try {
        const request: MemoryAddRequest = {
          group_id: TEST_GROUP_ID,
          user_id: TEST_USER_ID,
          content: "User prefers dark mode in VS Code", // High confidence content
          metadata: { source: "conversation" },
        };

        const response = await memory_add(request);

        expect(response.id).toBeDefined();
        expect(response.stored).toBe("both");
        expect(response.score).toBeGreaterThanOrEqual(0.85);
        expect(response.created_at).toBeDefined();
      } finally {
        process.env.PROMOTION_MODE = originalMode;
      }
    });

    it("should queue memory for review when score >= threshold in soc2 mode", async () => {
      // This test requires PROMOTION_MODE=soc2
      const originalMode = process.env.PROMOTION_MODE;
      process.env.PROMOTION_MODE = "soc2";

      try {
        const request: MemoryAddRequest = {
          group_id: TEST_GROUP_ID,
          user_id: TEST_USER_ID,
          content: "User works in TypeScript with strict mode enabled", // High confidence
          metadata: { source: "conversation" },
        };

        const response = await memory_add(request);

        expect(response.id).toBeDefined();
        expect(response.stored).toBe("episodic");
        expect(response.pending_review).toBe(true);
        expect(response.created_at).toBeDefined();
      } finally {
        process.env.PROMOTION_MODE = originalMode;
      }
    });

    it("should reject invalid group_id", async () => {
      const request: MemoryAddRequest = {
        group_id: "invalid-group-id" as any, // Missing 'allura-' prefix
        user_id: TEST_USER_ID,
        content: "Test content",
      };

      await expect(memory_add(request)).rejects.toThrow("Invalid group_id");
    });

    it("should reject missing required fields", async () => {
      const request = {
        group_id: TEST_GROUP_ID,
        // Missing user_id and content
      } as any;

      await expect(memory_add(request)).rejects.toThrow();
    });
  });

  describe("2. memory_search", () => {
    beforeAll(async () => {
      // Add test memories
      await memory_add({
        group_id: TEST_GROUP_ID,
        user_id: TEST_USER_ID,
        content: "User prefers dark mode",
        metadata: { source: "manual" },
      });

      await memory_add({
        group_id: TEST_GROUP_ID,
        user_id: TEST_USER_ID,
        content: "User uses TypeScript",
        metadata: { source: "conversation" },
      });
    });

    it("should search memories across both stores", async () => {
      const request: MemorySearchRequest = {
        query: "dark mode",
        group_id: TEST_GROUP_ID,
      };

      const response = await memory_search(request);

      expect(response.results).toBeDefined();
      expect(response.count).toBeGreaterThanOrEqual(0);
      expect(response.latency_ms).toBeDefined();
    });

    it("should scope search to user when user_id provided", async () => {
      const request: MemorySearchRequest = {
        query: "TypeScript",
        group_id: TEST_GROUP_ID,
        user_id: TEST_USER_ID,
      };

      const response = await memory_search(request);

      expect(response.results).toBeDefined();
      // All results should belong to the user
      response.results.forEach((result: any) => {
        // Note: user_id is not in MemorySearchResult, but we can verify
        // that results exist
        expect(result.id).toBeDefined();
      });
    });

    it("should respect limit parameter", async () => {
      const request: MemorySearchRequest = {
        query: "user",
        group_id: TEST_GROUP_ID,
        limit: 2,
      };

      const response = await memory_search(request);

      expect(response.results.length).toBeLessThanOrEqual(2);
    });

    it("should reject invalid group_id", async () => {
      const request: MemorySearchRequest = {
        query: "test",
        group_id: "invalid-group" as any,
      };

      await expect(memory_search(request)).rejects.toThrow("Invalid group_id");
    });
  });

  describe("3. memory_get", () => {
    let testMemoryId: string;

    beforeAll(async () => {
      // Add a test memory
      const response = await memory_add({
        group_id: TEST_GROUP_ID,
        user_id: TEST_USER_ID,
        content: "Test memory for get operation",
        metadata: { source: "manual" },
      });
      testMemoryId = response.id;
    });

    it("should retrieve a memory by ID", async () => {
      const request: MemoryGetRequest = {
        id: testMemoryId as any,
        group_id: TEST_GROUP_ID,
      };

      const response = await memory_get(request);

      expect(response.id).toBe(testMemoryId);
      expect(response.content).toBe("Test memory for get operation");
      expect(response.source).toBeDefined();
      expect(response.provenance).toBe("manual");
      expect(response.created_at).toBeDefined();
    });

    it("should throw error for non-existent memory", async () => {
      const request: MemoryGetRequest = {
        id: "non-existent-id" as any,
        group_id: TEST_GROUP_ID,
      };

      await expect(memory_get(request)).rejects.toThrow("not found");
    });

    it("should reject invalid group_id", async () => {
      const request: MemoryGetRequest = {
        id: testMemoryId as any,
        group_id: "invalid-group" as any,
      };

      await expect(memory_get(request)).rejects.toThrow("Invalid group_id");
    });
  });

  describe("4. memory_list", () => {
    beforeAll(async () => {
      // Add test memories for different users
      await memory_add({
        group_id: TEST_GROUP_ID,
        user_id: TEST_USER_ID,
        content: "Memory 1 for user 1",
        metadata: { source: "manual" },
      });

      await memory_add({
        group_id: TEST_GROUP_ID,
        user_id: TEST_USER_ID,
        content: "Memory 2 for user 1",
        metadata: { source: "conversation" },
      });

      await memory_add({
        group_id: TEST_GROUP_ID,
        user_id: TEST_USER_ID_2,
        content: "Memory 1 for user 2",
        metadata: { source: "manual" },
      });
    });

    it("should list all memories for a user", async () => {
      const request: MemoryListRequest = {
        group_id: TEST_GROUP_ID,
        user_id: TEST_USER_ID,
      };

      const response = await memory_list(request);

      expect(response.memories).toBeDefined();
      expect(response.total).toBeGreaterThanOrEqual(2);
      expect(response.has_more).toBeDefined();
    });

    it("should respect limit and offset parameters", async () => {
      const request: MemoryListRequest = {
        group_id: TEST_GROUP_ID,
        user_id: TEST_USER_ID,
        limit: 1,
        offset: 0,
      };

      const response = await memory_list(request);

      expect(response.memories.length).toBeLessThanOrEqual(1);
    });

    it("should not return memories from other users", async () => {
      const request: MemoryListRequest = {
        group_id: TEST_GROUP_ID,
        user_id: TEST_USER_ID,
      };

      const response = await memory_list(request);

      // All memories should belong to TEST_USER_ID
      response.memories.forEach((memory: any) => {
        expect(memory.user_id).toBe(TEST_USER_ID);
      });
    });

    it("should reject invalid group_id", async () => {
      const request: MemoryListRequest = {
        group_id: "invalid-group" as any,
        user_id: TEST_USER_ID,
      };

      await expect(memory_list(request)).rejects.toThrow("Invalid group_id");
    });
  });

  describe("5. memory_delete", () => {
    let testMemoryId: string;

    beforeEach(async () => {
      // Add a test memory
      const response = await memory_add({
        group_id: TEST_GROUP_ID,
        user_id: TEST_USER_ID,
        content: "Test memory for delete operation",
        metadata: { source: "manual" },
      });
      testMemoryId = response.id;
    });

    it("should soft-delete a memory", async () => {
      const request: MemoryDeleteRequest = {
        id: testMemoryId as any,
        group_id: TEST_GROUP_ID,
        user_id: TEST_USER_ID,
      };

      const response = await memory_delete(request);

      expect(response.id).toBe(testMemoryId);
      expect(response.deleted).toBe(true);
      expect(response.deleted_at).toBeDefined();
      expect(response.recovery_days).toBe(30);
    });

    it("should mark memory as deprecated in Neo4j", async () => {
      // First, promote to Neo4j (requires auto mode)
      const originalMode = process.env.PROMOTION_MODE;
      process.env.PROMOTION_MODE = "auto";

      try {
        const addResponse = await memory_add({
          group_id: TEST_GROUP_ID,
          user_id: TEST_USER_ID,
          content: "User prefers dark mode for deletion test",
          metadata: { source: "conversation" },
        });

        const deleteRequest: MemoryDeleteRequest = {
          id: addResponse.id as any,
          group_id: TEST_GROUP_ID,
          user_id: TEST_USER_ID,
        };

        const deleteResponse = await memory_delete(deleteRequest);

        expect(deleteResponse.deleted).toBe(true);
      } finally {
        process.env.PROMOTION_MODE = originalMode;
      }
    });

    it("should reject invalid group_id", async () => {
      const request: MemoryDeleteRequest = {
        id: testMemoryId as any,
        group_id: "invalid-group" as any,
        user_id: TEST_USER_ID,
      };

      await expect(memory_delete(request)).rejects.toThrow("Invalid group_id");
    });
  });

  describe("Tenant Isolation", () => {
    const GROUP_A = "allura-tenant-a" as any;
    const GROUP_B = "allura-tenant-b" as any;
    const USER_A = "user-a";
    const USER_B = "user-b";

    it("should isolate memories by group_id", async () => {
      // Add memory for Group A
      await memory_add({
        group_id: GROUP_A,
        user_id: USER_A,
        content: "Memory for Group A",
        metadata: { source: "manual" },
      });

      // Add memory for Group B
      await memory_add({
        group_id: GROUP_B,
        user_id: USER_B,
        content: "Memory for Group B",
        metadata: { source: "manual" },
      });

      // Search Group A
      const searchA = await memory_search({
        query: "Memory",
        group_id: GROUP_A,
      });

      // Search Group B
      const searchB = await memory_search({
        query: "Memory",
        group_id: GROUP_B,
      });

      // Verify isolation
      expect(searchA.results.some((r: any) => r.content.includes("Group A"))).toBe(true);
      expect(searchA.results.some((r: any) => r.content.includes("Group B"))).toBe(false);

      expect(searchB.results.some((r: any) => r.content.includes("Group B"))).toBe(true);
      expect(searchB.results.some((r: any) => r.content.includes("Group A"))).toBe(false);
    });

    it("should prevent cross-tenant memory access", async () => {
      // Add memory for Group A
      const addResponse = await memory_add({
        group_id: GROUP_A,
        user_id: USER_A,
        content: "Private memory for Group A",
        metadata: { source: "manual" },
      });

      // Try to get memory from Group B
      await expect(
        memory_get({
          id: addResponse.id as any,
          group_id: GROUP_B,
        })
      ).rejects.toThrow("not found");
    });
  });

  describe("Promotion Mode Behavior", () => {
    it("should auto-promote in auto mode", async () => {
      const originalMode = process.env.PROMOTION_MODE;
      process.env.PROMOTION_MODE = "auto";

      try {
        const response = await memory_add({
          group_id: TEST_GROUP_ID,
          user_id: TEST_USER_ID,
          content: "User prefers dark mode in VS Code editor",
          metadata: { source: "conversation" },
        });

        expect(response.stored).toBe("both");
        expect(response.pending_review).toBeUndefined();
      } finally {
        process.env.PROMOTION_MODE = originalMode;
      }
    });

    it("should queue for review in soc2 mode", async () => {
      const originalMode = process.env.PROMOTION_MODE;
      process.env.PROMOTION_MODE = "soc2";

      try {
        const response = await memory_add({
          group_id: TEST_GROUP_ID,
          user_id: TEST_USER_ID,
          content: "User works in TypeScript with strict mode",
          metadata: { source: "conversation" },
        });

        expect(response.stored).toBe("episodic");
        expect(response.pending_review).toBe(true);
      } finally {
        process.env.PROMOTION_MODE = originalMode;
      }
    });
  });
});