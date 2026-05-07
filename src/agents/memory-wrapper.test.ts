/**
 * Story 1.2: Agent Memory Wrapper Integration Test
 *
 * Verifies that:
 * 1. Agents can import agentMemory
 * 2. agentMemory routes to canonical MCP tools
 * 3. All operations validate group_id and content
 * 4. Responses match SDK schemas
 *
 * Runs: bun test src/agents/memory-wrapper.test.ts
 */

import { beforeEach, describe, expect, it, vi } from "vitest";
import { agentMemory } from "./memory-wrapper";
import { ValidationError } from "@/lib/sdk/errors";
import * as canonicalTools from "@/mcp/canonical-tools";

// Mock canonical tools
vi.mock("@/mcp/canonical-tools", () => ({
  canonicalMemoryTools: {
    memory_add: vi.fn(),
    memory_search: vi.fn(),
    memory_get: vi.fn(),
    memory_list: vi.fn(),
    memory_delete: vi.fn(),
  },
}));

describe("Agent Memory Wrapper (Story 1.2)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("add()", () => {
    it("should add a memory with valid parameters", async () => {
      const mockResponse = {
        id: "mem_123",
        storage_location: "postgres",
        score: 0.8,
        promoted_to: null,
      };

      vi.spyOn(canonicalTools.canonicalMemoryTools, "memory_add").mockResolvedValue(
        mockResponse as any
      );

      const result = await agentMemory.add({
        group_id: "allura-system",
        user_id: "brooks-architect",
        content: "ADR: Implemented agent memory wrapper",
        metadata: { source: "conversation", confidence: 0.9 },
      });

      expect(result).toEqual(mockResponse);
      expect(canonicalTools.canonicalMemoryTools.memory_add).toHaveBeenCalledWith(
        expect.objectContaining({
          group_id: "allura-system",
          user_id: "brooks-architect",
          content: "ADR: Implemented agent memory wrapper",
        })
      );
    });

    it("should reject empty content", async () => {
      await expect(
        agentMemory.add({
          group_id: "allura-system",
          user_id: "brooks-architect",
          content: "",
        })
      ).rejects.toThrow(ValidationError);
    });

    it("should reject invalid group_id", async () => {
      await expect(
        agentMemory.add({
          group_id: "invalid-group",
          user_id: "brooks-architect",
          content: "Test content",
        })
      ).rejects.toThrow(ValidationError);
    });

    it("should reject missing user_id", async () => {
      await expect(
        agentMemory.add({
          group_id: "allura-system",
          user_id: "",
          content: "Test content",
        })
      ).rejects.toThrow(ValidationError);
    });

    it("should reject invalid threshold", async () => {
      await expect(
        agentMemory.add({
          group_id: "allura-system",
          user_id: "brooks-architect",
          content: "Test content",
          threshold: 1.5,
        })
      ).rejects.toThrow(ValidationError);
    });
  });

  describe("search()", () => {
    it("should search memories with valid parameters", async () => {
      const mockResponse = {
        results: [
          {
            id: "mem_123",
            content: "ADR: Memory wrapper",
            score: 0.95,
            storage: "neo4j",
          },
        ],
        total: 1,
        degraded: false,
        stores_queried: ["neo4j", "postgres"],
      };

      vi.spyOn(canonicalTools.canonicalMemoryTools, "memory_search").mockResolvedValue(
        mockResponse as any
      );

      const result = await agentMemory.search({
        group_id: "allura-system",
        query: "architecture decisions",
      });

      expect(result).toEqual(mockResponse);
      expect(canonicalTools.canonicalMemoryTools.memory_search).toHaveBeenCalledWith(
        expect.objectContaining({
          group_id: "allura-system",
          query: "architecture decisions",
        })
      );
    });

    it("should reject empty query", async () => {
      await expect(
        agentMemory.search({
          group_id: "allura-system",
          query: "",
        })
      ).rejects.toThrow(ValidationError);
    });

    it("should reject invalid limit", async () => {
      await expect(
        agentMemory.search({
          group_id: "allura-system",
          query: "test",
          limit: 200,
        })
      ).rejects.toThrow(ValidationError);
    });
  });

  describe("get()", () => {
    it("should get a memory by ID", async () => {
      const mockResponse = {
        id: "mem_123",
        content: "ADR: Memory wrapper implementation",
        storage: "neo4j",
        created_at: "2026-05-07T10:00:00Z",
      };

      vi.spyOn(canonicalTools.canonicalMemoryTools, "memory_get").mockResolvedValue(
        mockResponse as any
      );

      const result = await agentMemory.get({
        group_id: "allura-system",
        id: "mem_123",
      });

      expect(result).toEqual(mockResponse);
      expect(canonicalTools.canonicalMemoryTools.memory_get).toHaveBeenCalledWith({
        group_id: "allura-system",
        id: "mem_123",
      });
    });

    it("should reject invalid ID", async () => {
      await expect(
        agentMemory.get({
          group_id: "allura-system",
          id: "",
        })
      ).rejects.toThrow(ValidationError);
    });
  });

  describe("list()", () => {
    it("should list memories with valid parameters", async () => {
      const mockResponse = {
        memories: [
          {
            id: "mem_123",
            content: "ADR 1",
            created_at: "2026-05-07T10:00:00Z",
          },
        ],
        total: 1,
        has_more: false,
      };

      vi.spyOn(canonicalTools.canonicalMemoryTools, "memory_list").mockResolvedValue(
        mockResponse as any
      );

      const result = await agentMemory.list({
        group_id: "allura-system",
        limit: 50,
      });

      expect(result).toEqual(mockResponse);
    });

    it("should reject invalid limit", async () => {
      await expect(
        agentMemory.list({
          group_id: "allura-system",
          limit: 2000,
        })
      ).rejects.toThrow(ValidationError);
    });

    it("should reject negative offset", async () => {
      await expect(
        agentMemory.list({
          group_id: "allura-system",
          offset: -1,
        })
      ).rejects.toThrow(ValidationError);
    });
  });

  describe("delete()", () => {
    it("should delete a memory", async () => {
      const mockResponse = {
        id: "mem_123",
        deleted_at: "2026-05-07T10:00:00Z",
        recovery_until: "2026-06-06T10:00:00Z",
      };

      vi.spyOn(canonicalTools.canonicalMemoryTools, "memory_delete").mockResolvedValue(
        mockResponse as any
      );

      const result = await agentMemory.delete({
        group_id: "allura-system",
        id: "mem_123",
        user_id: "brooks-architect",
      });

      expect(result).toEqual(mockResponse);
    });

    it("should require user_id for deletion", async () => {
      await expect(
        agentMemory.delete({
          group_id: "allura-system",
          id: "mem_123",
          user_id: "",
        })
      ).rejects.toThrow(ValidationError);
    });
  });

  describe("Integration: Agent → MCP Tool Routing", () => {
    it("should route through canonical tools without modification", async () => {
      const addMock = vi
        .spyOn(canonicalTools.canonicalMemoryTools, "memory_add")
        .mockResolvedValue({ id: "mem_test", storage_location: "postgres", score: 0.7 } as any);

      await agentMemory.add({
        group_id: "allura-system",
        user_id: "woz-builder",
        content: "Implemented feature X",
      });

      expect(addMock).toHaveBeenCalledOnce();
      const call = addMock.mock.calls[0][0];
      expect(call).toMatchObject({
        group_id: "allura-system",
        user_id: "woz-builder",
        content: "Implemented feature X",
      });
    });

    it("should preserve metadata through MCP layer", async () => {
      const searchMock = vi
        .spyOn(canonicalTools.canonicalMemoryTools, "memory_search")
        .mockResolvedValue({
          results: [],
          total: 0,
          degraded: false,
          stores_queried: [],
        } as any);

      await agentMemory.search({
        group_id: "allura-system",
        query: "test query",
        limit: 25,
      });

      expect(searchMock).toHaveBeenCalledWith(
        expect.objectContaining({
          query: "test query",
          limit: 25,
        })
      );
    });
  });
});
