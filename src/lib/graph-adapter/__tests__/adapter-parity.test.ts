/**
 * Adapter Parity Tests — Slice C (S8-C8)
 *
 * Verifies that Neo4jGraphAdapter and RuVectorGraphAdapter produce
 * identical results for the same IGraphAdapter method calls.
 *
 * Strategy: mock both underlying stores (neo4j-driver sessions and pg Pool),
 * call the same adapter methods with identical inputs, and assert that
 * the returned types and shapes match the interface contract.
 *
 * ADR: AD-029 — Graph Adapter Pattern for Neo4j → RuVector Migration
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

// ── Hoist mock refs ────────────────────────────────────────────────────────

const { mockNeo4jSessionRun, mockNeo4jSessionClose, mockNeo4jSession, mockNeo4jDriver, mockPgQuery, mockPgConnect, mockPgPool } = vi.hoisted(() => {
  const mockNeo4jSessionRun = vi.fn();
  const mockNeo4jSessionClose = vi.fn().mockResolvedValue(undefined);

  const mockNeo4jSession = {
    run: mockNeo4jSessionRun,
    close: mockNeo4jSessionClose,
    executeRead: vi.fn((work: (tx: { run: typeof mockNeo4jSessionRun }) => Promise<unknown>) =>
      work({ run: mockNeo4jSessionRun })
    ),
    executeWrite: vi.fn((work: (tx: { run: typeof mockNeo4jSessionRun }) => Promise<unknown>) =>
      work({ run: mockNeo4jSessionRun })
    ),
  };

  const mockNeo4jDriver = {
    session: vi.fn().mockReturnValue(mockNeo4jSession),
    close: vi.fn(),
  };

  const mockPgQuery = vi.fn();
  const mockPgConnect = vi.fn();
  const mockPgPool = {
    query: mockPgQuery,
    connect: mockPgConnect,
    end: vi.fn(),
    on: vi.fn(),
  };

  return { mockNeo4jSessionRun, mockNeo4jSessionClose, mockNeo4jSession, mockNeo4jDriver, mockPgQuery, mockPgConnect, mockPgPool };
});

// ── Module mocks (hoisted) ─────────────────────────────────────────────────

vi.mock("neo4j-driver", () => ({
  default: {
    driver: vi.fn().mockReturnValue(mockNeo4jDriver),
    auth: {
      basic: vi.fn().mockReturnValue({ scheme: "basic", principal: "neo4j" }),
    },
    int: vi.fn((n: number) => ({ toNumber: () => n, low: n, high: 0 })),
  },
  Driver: class {},
}));

vi.mock("pg", () => ({
  Pool: vi.fn().mockImplementation(() => mockPgPool),
}));

// ── Set required env vars ──────────────────────────────────────────────────

process.env.NEO4J_URI = "bolt://localhost:7687";
process.env.NEO4J_USER = "neo4j";
process.env.NEO4J_PASSWORD = "test-password";
process.env.GRAPH_BACKEND = "neo4j";

// ── Import adapters (after mocks) ──────────────────────────────────────────

import { Neo4jGraphAdapter } from "../neo4j-adapter";
import { RuVectorGraphAdapter } from "../ruvector-adapter";
import type { IGraphAdapter } from "../types";

// ── Helpers ────────────────────────────────────────────────────────────────

const TEST_GROUP_ID = "allura-test";
const TEST_MEMORY_ID = "mem-001";
const TEST_CONTENT = "Test memory content for parity check";

function makeNeo4jRecord(fields: Record<string, unknown>): { keys: string[]; get: (key: string) => unknown } {
  return {
    keys: Object.keys(fields),
    get: (key: string) => fields[key],
  };
}

// ── Test Suite ─────────────────────────────────────────────────────────────

describe("Adapter Parity Tests (Slice C — S8-C8)", () => {
  let neo4jAdapter: IGraphAdapter;
  let ruvectorAdapter: IGraphAdapter;

  beforeEach(() => {
    vi.clearAllMocks();
    neo4jAdapter = new Neo4jGraphAdapter(mockNeo4jDriver as unknown as import("neo4j-driver").Driver);
    ruvectorAdapter = new RuVectorGraphAdapter(mockPgPool as unknown as import("pg").Pool);
  });

  describe("createMemory", () => {
    it("both adapters return the provided id on create", async () => {
      mockNeo4jSessionRun.mockResolvedValue({ records: [] });
      mockPgQuery.mockResolvedValue({ rowCount: 1 });

      const params = {
        id: TEST_MEMORY_ID as unknown as import("@/lib/memory/canonical-contracts").MemoryId,
        group_id: TEST_GROUP_ID as unknown as import("@/lib/memory/canonical-contracts").GroupId,
        user_id: null,
        content: TEST_CONTENT,
        score: 0.8 as unknown as import("@/lib/memory/canonical-contracts").ConfidenceScore,
        provenance: "conversation" as import("@/lib/memory/canonical-contracts").MemoryProvenance,
        created_at: "2026-04-25T12:00:00.000Z",
      };

      const neo4jResult = await neo4jAdapter.createMemory(params);
      const ruvResult = await ruvectorAdapter.createMemory(params);

      expect(neo4jResult).toBe(TEST_MEMORY_ID);
      expect(ruvResult).toBe(TEST_MEMORY_ID);
      expect(neo4jResult).toBe(ruvResult);
    });
  });

  describe("checkDuplicate", () => {
    it("both adapters return null when no duplicate exists", async () => {
      mockNeo4jSessionRun.mockResolvedValue({ records: [] });
      mockPgQuery.mockResolvedValue({ rows: [] });

      const params = {
        group_id: TEST_GROUP_ID as unknown as import("@/lib/memory/canonical-contracts").GroupId,
        user_id: null,
        content: TEST_CONTENT,
      };

      const neo4jResult = await neo4jAdapter.checkDuplicate(params);
      const ruvResult = await ruvectorAdapter.checkDuplicate(params);

      expect(neo4jResult.existingId).toBeNull();
      expect(ruvResult.existingId).toBeNull();
    });

    it("both adapters return existing id when duplicate found", async () => {
      mockNeo4jSessionRun.mockResolvedValue({
        records: [makeNeo4jRecord({ id: TEST_MEMORY_ID })],
      });
      mockPgQuery.mockResolvedValue({ rows: [{ id: TEST_MEMORY_ID }] });

      const params = {
        group_id: TEST_GROUP_ID as unknown as import("@/lib/memory/canonical-contracts").GroupId,
        user_id: null,
        content: TEST_CONTENT,
      };

      const neo4jResult = await neo4jAdapter.checkDuplicate(params);
      const ruvResult = await ruvectorAdapter.checkDuplicate(params);

      expect(neo4jResult.existingId).toBe(TEST_MEMORY_ID);
      expect(ruvResult.existingId).toBe(TEST_MEMORY_ID);
    });
  });

  describe("getMemory", () => {
    it("both adapters return null when memory not found", async () => {
      mockNeo4jSessionRun.mockResolvedValue({ records: [] });
      mockPgQuery.mockResolvedValue({ rows: [] });

      const params = {
        id: TEST_MEMORY_ID as unknown as import("@/lib/memory/canonical-contracts").MemoryId,
        group_id: TEST_GROUP_ID as unknown as import("@/lib/memory/canonical-contracts").GroupId,
      };

      const neo4jResult = await neo4jAdapter.getMemory(params);
      const ruvResult = await ruvectorAdapter.getMemory(params);

      expect(neo4jResult.node).toBeNull();
      expect(ruvResult.node).toBeNull();
    });
  });

  describe("softDeleteMemory", () => {
    it("both adapters return deleted: true when node exists", async () => {
      mockNeo4jSessionRun.mockResolvedValue({
        records: [makeNeo4jRecord({ id: TEST_MEMORY_ID })],
      });
      mockPgQuery.mockResolvedValue({ rowCount: 1 });

      const params = {
        id: TEST_MEMORY_ID as unknown as import("@/lib/memory/canonical-contracts").MemoryId,
        group_id: TEST_GROUP_ID as unknown as import("@/lib/memory/canonical-contracts").GroupId,
        deleted_at: "2026-04-25T12:00:00.000Z",
      };

      const neo4jResult = await neo4jAdapter.softDeleteMemory(params);
      const ruvResult = await ruvectorAdapter.softDeleteMemory(params);

      expect(neo4jResult.deleted).toBe(true);
      expect(ruvResult.deleted).toBe(true);
    });

    it("both adapters return deleted: false when node not found", async () => {
      mockNeo4jSessionRun.mockResolvedValue({ records: [] });
      mockPgQuery.mockResolvedValue({ rowCount: 0 });

      const params = {
        id: "nonexistent" as unknown as import("@/lib/memory/canonical-contracts").MemoryId,
        group_id: TEST_GROUP_ID as unknown as import("@/lib/memory/canonical-contracts").GroupId,
        deleted_at: "2026-04-25T12:00:00.000Z",
      };

      const neo4jResult = await neo4jAdapter.softDeleteMemory(params);
      const ruvResult = await ruvectorAdapter.softDeleteMemory(params);

      expect(neo4jResult.deleted).toBe(false);
      expect(ruvResult.deleted).toBe(false);
    });
  });

  describe("checkCanonical", () => {
    it("both adapters return isCanonical: false when not found", async () => {
      mockNeo4jSessionRun.mockResolvedValue({ records: [] });
      mockPgQuery.mockResolvedValue({ rows: [] });

      const params = {
        id: TEST_MEMORY_ID as unknown as import("@/lib/memory/canonical-contracts").MemoryId,
        group_id: TEST_GROUP_ID as unknown as import("@/lib/memory/canonical-contracts").GroupId,
      };

      const neo4jResult = await neo4jAdapter.checkCanonical(params);
      const ruvResult = await ruvectorAdapter.checkCanonical(params);

      expect(neo4jResult.isCanonical).toBe(false);
      expect(ruvResult.isCanonical).toBe(false);
    });
  });

  describe("getVersion", () => {
    it("both adapters return version: null, exists: false when not found", async () => {
      mockNeo4jSessionRun.mockResolvedValue({ records: [] });
      mockPgQuery.mockResolvedValue({ rows: [] });

      const params = {
        id: TEST_MEMORY_ID as unknown as import("@/lib/memory/canonical-contracts").MemoryId,
        group_id: TEST_GROUP_ID as unknown as import("@/lib/memory/canonical-contracts").GroupId,
      };

      const neo4jResult = await neo4jAdapter.getVersion(params);
      const ruvResult = await ruvectorAdapter.getVersion(params);

      expect(neo4jResult.version).toBeNull();
      expect(neo4jResult.exists).toBe(false);
      expect(ruvResult.version).toBeNull();
      expect(ruvResult.exists).toBe(false);
    });
  });

  describe("countMemories", () => {
    it("both adapters return total: 0 when no memories", async () => {
      mockNeo4jSessionRun.mockResolvedValue({
        records: [makeNeo4jRecord({ total: { toNumber: () => 0, low: 0, high: 0 } })],
      });
      mockPgQuery.mockResolvedValue({ rows: [{ total: "0" }] });

      const params = {
        group_id: TEST_GROUP_ID as unknown as import("@/lib/memory/canonical-contracts").GroupId,
        user_id: null,
      };

      const neo4jResult = await neo4jAdapter.countMemories(params);
      const ruvResult = await ruvectorAdapter.countMemories(params);

      expect(neo4jResult.total).toBe(0);
      expect(ruvResult.total).toBe(0);
    });
  });

  describe("isHealthy", () => {
    it("both adapters return true when backend is healthy", async () => {
      mockNeo4jSessionRun.mockResolvedValue({
        records: [makeNeo4jRecord({ test: { toNumber: () => 1, low: 1, high: 0 } })],
      });
      mockPgQuery.mockResolvedValue({ rows: [{ test: 1 }] });

      const neo4jHealthy = await neo4jAdapter.isHealthy();
      const ruvHealthy = await ruvectorAdapter.isHealthy();

      expect(neo4jHealthy).toBe(true);
      expect(ruvHealthy).toBe(true);
    });

    it("both adapters return false when backend is unreachable", async () => {
      mockNeo4jSessionRun.mockRejectedValue(new Error("Connection refused"));
      mockPgQuery.mockRejectedValue(new Error("Connection refused"));

      const neo4jHealthy = await neo4jAdapter.isHealthy();
      const ruvHealthy = await ruvectorAdapter.isHealthy();

      expect(neo4jHealthy).toBe(false);
      expect(ruvHealthy).toBe(false);
    });
  });

  describe("restoreMemory", () => {
    it("both adapters return restored: true on successful restore", async () => {
      mockNeo4jSessionRun.mockResolvedValue({
        records: [makeNeo4jRecord({ id: TEST_MEMORY_ID })],
      });

      const mockClient = {
        query: vi.fn()
          .mockResolvedValueOnce({}) // BEGIN
          .mockResolvedValueOnce({ rowCount: 1 }) // UPDATE
          .mockResolvedValueOnce({ rowCount: 1 }) // DELETE superseded
          .mockResolvedValueOnce({}), // COMMIT
        release: vi.fn(),
      };
      mockPgConnect.mockResolvedValue(mockClient);

      const params = {
        id: TEST_MEMORY_ID as unknown as import("@/lib/memory/canonical-contracts").MemoryId,
        group_id: TEST_GROUP_ID as unknown as import("@/lib/memory/canonical-contracts").GroupId,
        restored_at: "2026-04-25T12:00:00.000Z",
      };

      const neo4jResult = await neo4jAdapter.restoreMemory(params);
      const ruvResult = await ruvectorAdapter.restoreMemory(params);

      expect(neo4jResult.restored).toBe(true);
      expect(ruvResult.restored).toBe(true);
    });
  });

  describe("linkMemoryContext", () => {
    it("both adapters handle empty agent_id/project_id gracefully", async () => {
      const params = {
        memory_id: TEST_MEMORY_ID as unknown as import("@/lib/memory/canonical-contracts").MemoryId,
        group_id: TEST_GROUP_ID as unknown as import("@/lib/memory/canonical-contracts").GroupId,
        agent_id: null,
        project_id: null,
      };

      const neo4jResult = await neo4jAdapter.linkMemoryContext(params);
      const ruvResult = await ruvectorAdapter.linkMemoryContext(params);

      expect(neo4jResult.authored_by).toBe(false);
      expect(neo4jResult.relates_to).toBe(false);
      expect(ruvResult.authored_by).toBe(false);
      expect(ruvResult.relates_to).toBe(false);
    });
  });

  describe("interface contract", () => {
    it("both adapters implement all IGraphAdapter methods", () => {
      const requiredMethods: (keyof IGraphAdapter)[] = [
        "createMemory",
        "checkDuplicate",
        "supersedesMemory",
        "softDeleteMemory",
        "restoreMemory",
        "getMemory",
        "searchMemories",
        "listMemories",
        "countMemories",
        "checkCanonical",
        "getVersion",
        "exportMemories",
        "getDeprecatedMemories",
        "linkMemoryContext",
        "isHealthy",
        "close",
      ];

      for (const method of requiredMethods) {
        expect(typeof (neo4jAdapter as unknown as Record<string, unknown>)[method]).toBe("function");
        expect(typeof (ruvectorAdapter as unknown as Record<string, unknown>)[method]).toBe("function");
      }
    });
  });
});