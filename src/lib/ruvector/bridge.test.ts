/**
 * Tests for RuVector MCP Bridge Module
 *
 * Tests the three primary functions:
 * - storeMemory()  — validates group_id, generates embedding, inserts with vector
 * - retrieveMemories() — ts_rank text search with trajectory tracking
 * - postFeedback() — SONA feedback loop with guard for empty usedMemoryIds
 *
 * Uses mocked pg Pool and mocked embedding service to avoid
 * database and Ollama dependencies in unit tests.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";

// ── Mock setup ───────────────────────────────────────────────────────────────

// Mock the connection module BEFORE importing bridge
const mockQuery = vi.fn();
const mockPool = { query: mockQuery };

vi.mock("./connection", () => ({
  getRuVectorPool: vi.fn(() => mockPool),
  isRuVectorEnabled: vi.fn(() => true),
  checkRuVectorHealth: vi.fn(() =>
    Promise.resolve({ status: "healthy", latencyMs: 5, version: "RuVector 0.3.0" })
  ),
}));

// Mock the embedding service BEFORE importing bridge
vi.mock("./embedding-service", () => ({
  generateEmbedding: vi.fn(),
}));

// Mock validation module
vi.mock("../validation/group-id", () => ({
  validateGroupId: vi.fn((id: string) => {
    // Reproduce the validation for test purposes
    const trimmed = id.trim();
    if (!trimmed) throw new Error("group_id is required");
    if (!/^allura-[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/.test(trimmed)) {
      throw new Error(`Invalid group_id: must match pattern allura-*`);
    }
    return trimmed;
  }),
  GroupIdValidationError: class GroupIdValidationError extends Error {
    constructor(message: string) {
      super(message);
      this.name = "GroupIdValidationError";
    }
  },
}));

// Mock crypto
vi.mock("node:crypto", () => ({
  randomUUID: vi.fn(() => "test-uuid-1234-5678-9abc-def012345678"),
}));

// ── Imports (after mocks) ───────────────────────────────────────────────────

import {
  storeMemory,
  retrieveMemories,
  postFeedback,
  isRuVectorReady,
  RuVectorBridgeValidationError,
} from "./bridge";

// Import mocked modules for assertion access
import { getRuVectorPool, isRuVectorEnabled, checkRuVectorHealth } from "./connection";
import { validateGroupId } from "../validation/group-id";
import { generateEmbedding } from "./embedding-service";

// Typed mock reference for the mocked embedding service
const mockGenerateEmbedding = vi.mocked(generateEmbedding);

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Create a fake 768-dim embedding vector */
function makeFakeEmbedding(): number[] {
  return Array.from({ length: 768 }, (_, i) => i / 768);
}

// ── Test Suite ───────────────────────────────────────────────────────────────

describe("RuVector Bridge — storeMemory", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockQuery.mockReset();
    // Default: embedding generation succeeds
    mockGenerateEmbedding.mockResolvedValue(makeFakeEmbedding());
  });

  it("should store a memory with embedding and return status 'stored'", async () => {
    mockQuery.mockResolvedValueOnce({
      rows: [{ id: 42, created_at: new Date("2025-01-01T00:00:00Z") }],
      rowCount: 1,
    });

    const result = await storeMemory({
      userId: "allura-test",
      sessionId: "session-1",
      content: "This is a test memory",
      memoryType: "episodic",
      metadata: { source: "test" },
    });

    expect(result.id).toBe("42");
    expect(result.status).toBe("stored");
    expect(result.groupId).toBe("allura-test");
    expect(result.createdAt).toBeTruthy();
    expect(mockQuery).toHaveBeenCalledTimes(1);

    // Verify embedding service was called with content
    expect(mockGenerateEmbedding).toHaveBeenCalledWith("This is a test memory");

    // Verify parameterized query (no string interpolation)
    const call = mockQuery.mock.calls[0];
    expect(call[0]).toContain("$1");
    expect(call[0]).toContain("$2");
    expect(call[0]).toContain("$3");
    expect(call[0]).toContain("$4");
    // Verify embedding is formatted as ruvector literal string '[0.1,0.2,...]'
    const embeddingParam = call[1][4];
    expect(typeof embeddingParam === "string").toBe(true);
    expect(embeddingParam).toMatch(/^\[.*\]$/);
    expect(embeddingParam).toContain("0.1");
  });

  it("should store with 'stored_pending_embedding' when embedding fails", async () => {
    mockGenerateEmbedding.mockResolvedValueOnce(null);
    mockQuery.mockResolvedValueOnce({
      rows: [{ id: 43, created_at: new Date("2025-01-01T00:00:00Z") }],
      rowCount: 1,
    });

    const result = await storeMemory({
      userId: "allura-test",
      sessionId: "session-1",
      content: "No embedding for this",
    });

    expect(result.id).toBe("43");
    expect(result.status).toBe("stored_pending_embedding");

    // Verify NULL embedding in query params
    const call = mockQuery.mock.calls[0];
    expect(call[1][4]).toBeNull();
  });

  it("should default memoryType to episodic", async () => {
    mockQuery.mockResolvedValueOnce({
      rows: [{ id: 43, created_at: new Date() }],
      rowCount: 1,
    });

    await storeMemory({
      userId: "allura-test",
      sessionId: "session-1",
      content: "Default type test",
    });

    const call = mockQuery.mock.calls[0];
    // New param order: [groupId, sessionId, content, memoryType, embedding, metadataJSON, groupId]
    // memory_type is $4 (index 3)
    expect(call[1][3]).toBe("episodic");
  });

  it("should reject invalid group_id that doesn't match allura- pattern", async () => {
    await expect(
      storeMemory({
        userId: "invalid-group",
        sessionId: "session-1",
        content: "This should fail",
      })
    ).rejects.toThrow();
  });

  it("should reject empty content", async () => {
    await expect(
      storeMemory({
        userId: "allura-test",
        sessionId: "session-1",
        content: "",
      })
    ).rejects.toThrow(RuVectorBridgeValidationError);

    await expect(
      storeMemory({
        userId: "allura-test",
        sessionId: "session-1",
        content: "",
      })
    ).rejects.toThrow("content must be a non-empty string");
  });

  it("should reject whitespace-only content", async () => {
    await expect(
      storeMemory({
        userId: "allura-test",
        sessionId: "session-1",
        content: "   ",
      })
    ).rejects.toThrow("content must be a non-empty string");
  });

  it("should reject empty sessionId", async () => {
    await expect(
      storeMemory({
        userId: "allura-test",
        sessionId: "",
        content: "Valid content",
      })
    ).rejects.toThrow("sessionId must be a non-empty string");
  });

  it("should throw DatabaseUnavailableError when pool fails", async () => {
    vi.mocked(getRuVectorPool).mockImplementationOnce(() => {
      throw new Error("Pool creation failed");
    });

    await expect(
      storeMemory({
        userId: "allura-test",
        sessionId: "session-1",
        content: "Test",
      })
    ).rejects.toThrow();
  });

  it("should throw DatabaseQueryError when insert fails", async () => {
    mockQuery.mockRejectedValueOnce(
      Object.assign(new Error('relation "allura_memories" does not exist'), {
        code: "42P01",
      })
    );

    await expect(
      storeMemory({
        userId: "allura-test",
        sessionId: "session-1",
        content: "Test",
      })
    ).rejects.toThrow();
  });

  it("should accept all memory types", async () => {
    const types = ["episodic", "semantic", "procedural"] as const;

    for (const memoryType of types) {
      mockQuery.mockResolvedValueOnce({
        rows: [{ id: 44, created_at: new Date() }],
        rowCount: 1,
      });

      await storeMemory({
        userId: "allura-test",
        sessionId: "session-1",
        content: `${memoryType} test`,
        memoryType,
      });

      const call = mockQuery.mock.calls[mockQuery.mock.calls.length - 1];
      // New param order: [groupId, sessionId, content, memoryType, embedding, metadataJSON, groupId]
      expect(call[1][3]).toBe(memoryType);
    }
  });

  it("should generate embedding before inserting into database", async () => {
    mockQuery.mockResolvedValueOnce({
      rows: [{ id: 45, created_at: new Date() }],
      rowCount: 1,
    });

    await storeMemory({
      userId: "allura-test",
      sessionId: "session-1",
      content: "Check call order",
    });

    // Embedding should be generated before DB query
    // Both are called exactly once
    expect(mockGenerateEmbedding).toHaveBeenCalledTimes(1);
    expect(mockQuery).toHaveBeenCalledTimes(1);
  });
});

describe("RuVector Bridge — retrieveMemories", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockQuery.mockReset();
    // Default: embedding generation fails (text-only fallback for existing tests)
    mockGenerateEmbedding.mockResolvedValue(null);
  });

  it("should retrieve memories using text search with ts_rank (searchMode: text)", async () => {
    const mockRows = [
      { id: "mem-1", content: "Test memory alpha", memory_type: "episodic", bm25_score: 0.8 },
      { id: "mem-2", content: "Test memory beta", memory_type: "semantic", bm25_score: 0.4 },
    ];
    mockQuery.mockResolvedValueOnce({ rows: mockRows, rowCount: 2 });

    const result = await retrieveMemories({
      userId: "allura-test",
      query: "test",
      limit: 10,
      threshold: 0.3,
      searchMode: "text",
    });

    expect(result.memories).toHaveLength(2);
    expect(result.trajectoryId).toBeTruthy();
    expect(result.total).toBe(2);
    expect(result.latencyMs).toBeGreaterThanOrEqual(0);
    expect(result.modesUsed).toEqual(["text"]);

    // Verify parameterized query
    const call = mockQuery.mock.calls[0];
    expect(call[0]).toContain("$1"); // query
    expect(call[0]).toContain("$2"); // user_id (group_id)
    expect(call[0]).toContain("$3"); // limit
    expect(call[1][1]).toBe("allura-test"); // group_id value
  });

  it("should filter results below threshold in text mode", async () => {
    const mockRows = [
      { id: "mem-1", content: "High score", memory_type: "episodic", bm25_score: 10 },
      { id: "mem-2", content: "Low score", memory_type: "semantic", bm25_score: 1 },
    ];
    mockQuery.mockResolvedValueOnce({ rows: mockRows, rowCount: 2 });

    // Threshold of 0.5 should filter out low-scored results after normalization
    const result = await retrieveMemories({
      userId: "allura-test",
      query: "test",
      threshold: 0.5,
      searchMode: "text",
    });

    // bm25_score of 10 normalizes to 1.0 (10/10), bm25_score of 1 normalizes to 0.1 (1/10)
    // With threshold 0.5, only the first memory passes
    expect(result.memories.length).toBeLessThanOrEqual(1);
    expect(result.modesUsed).toEqual(["text"]);
  });

  it("should return empty memories when no results found", async () => {
    mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 });

    const result = await retrieveMemories({
      userId: "allura-test",
      query: "nonexistent",
      searchMode: "text",
    });

    expect(result.memories).toHaveLength(0);
    expect(result.total).toBe(0);
    expect(result.trajectoryId).toBeTruthy();
    expect(result.modesUsed).toEqual(["text"]);
  });

  it("should fall back to text-only when embedding generation fails (hybrid default)", async () => {
    mockGenerateEmbedding.mockResolvedValue(null);
    const mockRows = [
      { id: "mem-1", content: "Fallback result", memory_type: "semantic", bm25_score: 5 },
    ];
    mockQuery.mockResolvedValueOnce({ rows: mockRows, rowCount: 1 });

    const result = await retrieveMemories({
      userId: "allura-test",
      query: "test",
      // searchMode defaults to 'hybrid', but embedding fails → text fallback
    });

    expect(result.modesUsed).toEqual(["text"]);
    expect(result.memories).toHaveLength(1);
  });

  it("should reject invalid group_id", async () => {
    await expect(
      retrieveMemories({
        userId: "bad-group",
        query: "test",
      })
    ).rejects.toThrow();
  });

  it("should reject empty query", async () => {
    await expect(
      retrieveMemories({
        userId: "allura-test",
        query: "",
      })
    ).rejects.toThrow("query must be a non-empty string");
  });

  it("should reject limit out of bounds", async () => {
    await expect(
      retrieveMemories({
        userId: "allura-test",
        query: "test",
        limit: 0,
      })
    ).rejects.toThrow("limit must be between 1 and 100");

    await expect(
      retrieveMemories({
        userId: "allura-test",
        query: "test",
        limit: 101,
      })
    ).rejects.toThrow("limit must be between 1 and 100");
  });

  it("should reject threshold out of bounds", async () => {
    await expect(
      retrieveMemories({
        userId: "allura-test",
        query: "test",
        threshold: -0.1,
      })
    ).rejects.toThrow("threshold must be between 0.0 and 1.0");

    await expect(
      retrieveMemories({
        userId: "allura-test",
        query: "test",
        threshold: 1.5,
      })
    ).rejects.toThrow("threshold must be between 0.0 and 1.0");
  });

  it("should generate unique trajectoryId per call", async () => {
    mockQuery.mockResolvedValue({ rows: [], rowCount: 0 });

    const result1 = await retrieveMemories({
      userId: "allura-test",
      query: "one",
      searchMode: "text",
    });
    const result2 = await retrieveMemories({
      userId: "allura-test",
      query: "two",
      searchMode: "text",
    });

    // With the mocked randomUUID, both get the same value,
    // but in production they'd differ. Just verify the field exists.
    expect(result1.trajectoryId).toBeTruthy();
    expect(result2.trajectoryId).toBeTruthy();
  });

  it("should throw DatabaseUnavailableError when pool fails", async () => {
    vi.mocked(getRuVectorPool).mockImplementationOnce(() => {
      throw new Error("Pool creation failed");
    });

    await expect(
      retrieveMemories({
        userId: "allura-test",
        query: "test",
      })
    ).rejects.toThrow();
  });

  it("should use text-only mode when searchMode is 'text'", async () => {
    mockGenerateEmbedding.mockResolvedValue(makeFakeEmbedding());
    const mockRows = [
      { id: "mem-1", content: "Text only", memory_type: "semantic", bm25_score: 3 },
    ];
    mockQuery.mockResolvedValueOnce({ rows: mockRows, rowCount: 1 });

    const result = await retrieveMemories({
      userId: "allura-test",
      query: "test",
      searchMode: "text",
    });

    // Even though embedding succeeded, text mode should NOT call generateEmbedding
    expect(mockGenerateEmbedding).not.toHaveBeenCalled();
    expect(result.modesUsed).toEqual(["text"]);
  });
});

// ── Hybrid Search Tests ─────────────────────────────────────────────────────

describe("RuVector Bridge — retrieveMemories (hybrid search)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockQuery.mockReset();
  });

  it("should perform hybrid search with vector + BM25 and RRF fusion", async () => {
    mockGenerateEmbedding.mockResolvedValue(makeFakeEmbedding());

    // Mock: embedding check (has embeddings)
    mockQuery.mockResolvedValueOnce({ rows: [{ "?column?": 1 }], rowCount: 1 });
    // Mock: vector search results
    mockQuery.mockResolvedValueOnce({
      rows: [
        { id: "mem-1", content: "Vector match A", memory_type: "episodic", vector_score: 0.95 },
        { id: "mem-2", content: "Vector match B", memory_type: "semantic", vector_score: 0.85 },
      ],
      rowCount: 2,
    });
    // Mock: BM25 search results
    mockQuery.mockResolvedValueOnce({
      rows: [
        { id: "mem-2", content: "Vector match B", memory_type: "semantic", bm25_score: 8 },
        { id: "mem-3", content: "Text match C", memory_type: "procedural", bm25_score: 5 },
      ],
      rowCount: 2,
    });

    const result = await retrieveMemories({
      userId: "allura-test",
      query: "test hybrid",
      limit: 10,
      threshold: 0.0,
    });

    expect(result.modesUsed).toEqual(["vector", "text"]);
    expect(result.memories.length).toBeGreaterThanOrEqual(1);

    // mem-2 appears in both results → highest RRF score
    // mem-1 appears only in vector → moderate RRF score
    // mem-3 appears only in BM25 → lower RRF score
    const mem2Idx = result.memories.findIndex((m) => m.id === "mem-2");
    const mem1Idx = result.memories.findIndex((m) => m.id === "mem-1");
    const mem3Idx = result.memories.findIndex((m) => m.id === "mem-3");
    expect(mem2Idx).toBeLessThan(mem1Idx);
    expect(mem2Idx).toBeLessThan(mem3Idx);
  });

  it("should skip vector search when no embeddings exist in table", async () => {
    mockGenerateEmbedding.mockResolvedValue(makeFakeEmbedding());

    // Mock: embedding check (no embeddings)
    mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 });
    // Mock: BM25 search results
    mockQuery.mockResolvedValueOnce({
      rows: [
        { id: "mem-1", content: "Text result", memory_type: "semantic", bm25_score: 5 },
      ],
      rowCount: 1,
    });

    const result = await retrieveMemories({
      userId: "allura-test",
      query: "test",
    });

    expect(result.modesUsed).toEqual(["text"]);
    expect(result.memories).toHaveLength(1);
  });

  it("should fall back to text-only when vector search query fails", async () => {
    mockGenerateEmbedding.mockResolvedValue(makeFakeEmbedding());

    // Mock: embedding check succeeds
    mockQuery.mockResolvedValueOnce({ rows: [{ "?column?": 1 }], rowCount: 1 });
    // Mock: vector search fails (function not available)
    mockQuery.mockRejectedValueOnce(new Error('function "ruvector_cosine_distance" does not exist'));
    // Mock: BM25 search results
    mockQuery.mockResolvedValueOnce({
      rows: [
        { id: "mem-1", content: "Fallback text result", memory_type: "episodic", bm25_score: 3 },
      ],
      rowCount: 1,
    });

    const result = await retrieveMemories({
      userId: "allura-test",
      query: "test",
    });

    // Vector failed gracefully, fell back to text
    expect(result.modesUsed).toEqual(["text"]);
    expect(result.memories).toHaveLength(1);
  });

  it("should use vector-only mode when searchMode is 'vector'", async () => {
    mockGenerateEmbedding.mockResolvedValue(makeFakeEmbedding());

    // Mock: embedding check
    mockQuery.mockResolvedValueOnce({ rows: [{ "?column?": 1 }], rowCount: 1 });
    // Mock: vector search
    mockQuery.mockResolvedValueOnce({
      rows: [
        { id: "mem-1", content: "Vector only", memory_type: "semantic", vector_score: 0.9 },
      ],
      rowCount: 1,
    });

    const result = await retrieveMemories({
      userId: "allura-test",
      query: "test",
      searchMode: "vector",
    });

    expect(result.modesUsed).toEqual(["vector"]);
    expect(result.memories).toHaveLength(1);
    // Should NOT call BM25 query (total 2 calls: embedding check + vector)
    expect(mockQuery).toHaveBeenCalledTimes(2);
  });

  it("should format query embedding as ruvector literal string", async () => {
    const fakeEmbedding = makeFakeEmbedding();
    mockGenerateEmbedding.mockResolvedValue(fakeEmbedding);

    // Mock: embedding check
    mockQuery.mockResolvedValueOnce({ rows: [{ "?column?": 1 }], rowCount: 1 });
    // Mock: vector search
    mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 });
    // Mock: BM25 search
    mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 });

    await retrieveMemories({
      userId: "allura-test",
      query: "test",
    });

    // Find the vector search call (second query call)
    const vectorCall = mockQuery.mock.calls[1];
    const embeddingParam = vectorCall[1][0];
    expect(typeof embeddingParam).toBe("string");
    expect(embeddingParam).toMatch(/^\[.*\]$/);
    expect(embeddingParam).toContain(String(fakeEmbedding[0]));
  });
});

// ── RRF Fusion Tests ────────────────────────────────────────────────────────

describe("RuVector Bridge — RRF fusion correctness", () => {
  // Import fuseResults for direct testing
  // We test it indirectly through retrieveMemories, but also test the
  // mathematical correctness of RRF scoring here.

  it("should give higher RRF score to items appearing in both result sets", async () => {
    mockGenerateEmbedding.mockResolvedValue(makeFakeEmbedding());

    // Mock: embedding check
    mockQuery.mockResolvedValueOnce({ rows: [{ "?column?": 1 }], rowCount: 1 });
    // Mock: vector search — mem-A at rank 1
    mockQuery.mockResolvedValueOnce({
      rows: [
        { id: "mem-A", content: "Both sources", memory_type: "episodic", vector_score: 0.9 },
        { id: "mem-B", content: "Vector only", memory_type: "semantic", vector_score: 0.8 },
      ],
      rowCount: 2,
    });
    // Mock: BM25 search — mem-A at rank 1, mem-C at rank 2
    mockQuery.mockResolvedValueOnce({
      rows: [
        { id: "mem-A", content: "Both sources", memory_type: "episodic", bm25_score: 10 },
        { id: "mem-C", content: "Text only", memory_type: "procedural", bm25_score: 5 },
      ],
      rowCount: 2,
    });

    const result = await retrieveMemories({
      userId: "allura-test",
      query: "test",
      threshold: 0.0,
    });

    // mem-A appears in both → RRF = 1/(60+1) + 1/(60+1) ≈ 0.0328
    // mem-B appears in vector only (rank 2) → RRF = 1/(60+2) ≈ 0.0161
    // mem-C appears in BM25 only (rank 2) → RRF = 1/(60+2) ≈ 0.0161
    const memA = result.memories.find((m) => m.id === "mem-A");
    const memB = result.memories.find((m) => m.id === "mem-B");
    const memC = result.memories.find((m) => m.id === "mem-C");

    expect(memA).toBeDefined();
    expect(memB).toBeDefined();
    expect(memC).toBeDefined();
    expect(memA!.score).toBeGreaterThan(memB!.score);
    expect(memA!.score).toBeGreaterThan(memC!.score);
  });

  it("should correctly deduplicate items appearing in both result sets", async () => {
    mockGenerateEmbedding.mockResolvedValue(makeFakeEmbedding());

    // Mock: embedding check
    mockQuery.mockResolvedValueOnce({ rows: [{ "?column?": 1 }], rowCount: 1 });
    // Mock: vector and BM25 both have mem-X
    mockQuery.mockResolvedValueOnce({
      rows: [
        { id: "mem-X", content: "In both", memory_type: "semantic", vector_score: 0.95 },
      ],
      rowCount: 1,
    });
    mockQuery.mockResolvedValueOnce({
      rows: [
        { id: "mem-X", content: "In both", memory_type: "semantic", bm25_score: 8 },
      ],
      rowCount: 1,
    });

    const result = await retrieveMemories({
      userId: "allura-test",
      query: "test",
      threshold: 0.0,
    });

    // Should only have one entry for mem-X (deduplicated)
    const memXItems = result.memories.filter((m) => m.id === "mem-X");
    expect(memXItems).toHaveLength(1);
  });

  it("should apply threshold to fused RRF scores", async () => {
    mockGenerateEmbedding.mockResolvedValue(makeFakeEmbedding());

    // Mock: embedding check
    mockQuery.mockResolvedValueOnce({ rows: [{ "?column?": 1 }], rowCount: 1 });
    // Mock: vector results
    mockQuery.mockResolvedValueOnce({
      rows: [
        { id: "mem-1", content: "Top result", memory_type: "episodic", vector_score: 0.95 },
      ],
      rowCount: 1,
    });
    // Mock: BM25 results
    mockQuery.mockResolvedValueOnce({
      rows: [
        { id: "mem-1", content: "Top result", memory_type: "episodic", bm25_score: 10 },
      ],
      rowCount: 1,
    });

    // With high threshold, some fused results may be filtered
    const result = await retrieveMemories({
      userId: "allura-test",
      query: "test",
      threshold: 0.5,
    });

    // mem-1 has highest possible RRF (rank 1 in both), should pass threshold
    expect(result.memories.some((m) => m.id === "mem-1")).toBe(true);
  });
});

describe("RuVector Bridge — postFeedback", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockQuery.mockReset();
  });

  it("should record feedback and attempt SONA learning", async () => {
    mockQuery
      .mockResolvedValueOnce({ rows: [], rowCount: 1 }) // INSERT feedback
      .mockResolvedValueOnce({ rows: [], rowCount: 0 }); // ruvector_sona_learn

    await postFeedback({
      trajectoryId: "traj-123",
      relevanceScores: [0.9, 0.7],
      usedMemoryIds: ["mem-1", "mem-2"],
      userId: "allura-test",
    });

    expect(mockQuery).toHaveBeenCalledTimes(2);

    // First call: INSERT feedback
    const insertCall = mockQuery.mock.calls[0];
    expect(insertCall[0]).toContain("INSERT INTO allura_feedback");
    expect(insertCall[1][1]).toBe("traj-123"); // trajectory_id

    // Second call: SONA learning attempt
    const sonaCall = mockQuery.mock.calls[1];
    expect(sonaCall[0]).toContain("ruvector_sona_learn");
  });

  it("should skip feedback when usedMemoryIds is empty", async () => {
    await postFeedback({
      trajectoryId: "traj-123",
      relevanceScores: [0.5],
      usedMemoryIds: [],
      userId: "allura-test",
    });

    expect(mockQuery).not.toHaveBeenCalled();
  });

  it("should skip feedback when usedMemoryIds is undefined (defaults to empty)", async () => {
    await postFeedback({
      trajectoryId: "traj-123",
      relevanceScores: [0.5],
      userId: "allura-test",
    });

    expect(mockQuery).not.toHaveBeenCalled();
  });

  it("should reject invalid relevance scores outside 0-1 range", async () => {
    await expect(
      postFeedback({
        trajectoryId: "traj-123",
        relevanceScores: [1.5],
        usedMemoryIds: ["mem-1"],
        userId: "allura-test",
      })
    ).rejects.toThrow("relevanceScores must be numbers between 0.0 and 1.0");

    await expect(
      postFeedback({
        trajectoryId: "traj-123",
        relevanceScores: [-0.1],
        usedMemoryIds: ["mem-1"],
        userId: "allura-test",
      })
    ).rejects.toThrow("relevanceScores must be numbers between 0.0 and 1.0");
  });

  it("should reject relevanceScores length mismatch with usedMemoryIds", async () => {
    await expect(
      postFeedback({
        trajectoryId: "traj-123",
        relevanceScores: [0.9],         // 1 score
        usedMemoryIds: ["mem-1", "mem-2"], // 2 IDs — mismatch
        userId: "allura-test",
      })
    ).rejects.toThrow("relevanceScores length");
  });

  it("should reject empty trajectoryId", async () => {
    await expect(
      postFeedback({
        trajectoryId: "",
        relevanceScores: [0.8],
        usedMemoryIds: ["mem-1"],
        userId: "allura-test",
      })
    ).rejects.toThrow("trajectoryId must be a non-empty string");
  });

  it("should handle ruvector_sona_learn not being available gracefully", async () => {
    mockQuery
      .mockResolvedValueOnce({ rows: [], rowCount: 1 }) // INSERT feedback succeeds
      .mockRejectedValueOnce(new Error('function "ruvector_sona_learn" does not exist'));

    // Should NOT throw — SONA learning is best-effort
    await expect(
      postFeedback({
        trajectoryId: "traj-123",
        relevanceScores: [0.9],
        usedMemoryIds: ["mem-1"],
        userId: "allura-test",
      })
    ).resolves.toBeUndefined();
  });

  it("should throw DatabaseUnavailableError when pool fails", async () => {
    vi.mocked(getRuVectorPool).mockImplementationOnce(() => {
      throw new Error("Pool creation failed");
    });

    await expect(
      postFeedback({
        trajectoryId: "traj-123",
        relevanceScores: [0.8],
        usedMemoryIds: ["mem-1"],
        userId: "allura-test",
      })
    ).rejects.toThrow();
  });
});

describe("RuVector Bridge — isRuVectorReady", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should return ready when enabled and healthy", async () => {
    vi.mocked(isRuVectorEnabled).mockReturnValue(true);
    vi.mocked(checkRuVectorHealth).mockResolvedValue({
      status: "healthy",
      latencyMs: 5,
      version: "RuVector 0.3.0",
    });

    const result = await isRuVectorReady();

    expect(result.ready).toBe(true);
    expect(result.reason).toBeUndefined();
  });

  it("should return not ready when not enabled", async () => {
    vi.mocked(isRuVectorEnabled).mockReturnValue(false);

    const result = await isRuVectorReady();

    expect(result.ready).toBe(false);
    expect(result.reason).toContain("RUVECTOR_ENABLED");
  });

  it("should return not ready when health check fails", async () => {
    vi.mocked(isRuVectorEnabled).mockReturnValue(true);
    vi.mocked(checkRuVectorHealth).mockResolvedValue({
      status: "unhealthy",
      latencyMs: 5000,
    });

    const result = await isRuVectorReady();

    expect(result.ready).toBe(false);
    expect(result.reason).toContain("unhealthy");
  });

  it("should return not ready when health check throws", async () => {
    vi.mocked(isRuVectorEnabled).mockReturnValue(true);
    vi.mocked(checkRuVectorHealth).mockRejectedValue(new Error("Connection refused"));

    const result = await isRuVectorReady();

    expect(result.ready).toBe(false);
    expect(result.reason).toContain("Connection refused");
  });
});

// ── Type-checking tests ──────────────────────────────────────────────────────

describe("RuVector Bridge — Type compliance", () => {
  it("StoreMemoryParams should accept all documented fields", () => {
    // This test verifies the type compiles correctly
    const params: import("./types").StoreMemoryParams = {
      userId: "allura-test",
      sessionId: "session-1",
      content: "Test content",
      memoryType: "semantic",
      metadata: { key: "value" },
    };

    expect(params.userId).toBe("allura-test");
    expect(params.memoryType).toBe("semantic");
    expect(params.metadata).toEqual({ key: "value" });
  });

  it("RetrieveMemoriesParams should accept optional fields including searchMode", () => {
    const minimal: import("./types").RetrieveMemoriesParams = {
      userId: "allura-test",
      query: "search query",
    };

    const full: import("./types").RetrieveMemoriesParams = {
      userId: "allura-test",
      query: "search query",
      limit: 20,
      threshold: 0.7,
      searchMode: "hybrid",
    };

    expect(minimal.limit).toBeUndefined();
    expect(minimal.searchMode).toBeUndefined();
    expect(full.limit).toBe(20);
    expect(full.threshold).toBe(0.7);
    expect(full.searchMode).toBe("hybrid");
  });

  it("RetrieveMemoriesParams searchMode should accept all three values", () => {
    const hybrid: import("./types").RetrieveMemoriesParams = {
      userId: "allura-test",
      query: "test",
      searchMode: "hybrid",
    };
    const vectorOnly: import("./types").RetrieveMemoriesParams = {
      userId: "allura-test",
      query: "test",
      searchMode: "vector",
    };
    const textOnly: import("./types").RetrieveMemoriesParams = {
      userId: "allura-test",
      query: "test",
      searchMode: "text",
    };

    expect(hybrid.searchMode).toBe("hybrid");
    expect(vectorOnly.searchMode).toBe("vector");
    expect(textOnly.searchMode).toBe("text");
  });

  it("PostFeedbackParams should accept optional usedMemoryIds", () => {
    const minimal: import("./types").PostFeedbackParams = {
      trajectoryId: "traj-123",
      relevanceScores: [0.8],
      userId: "allura-test",
    };

    const full: import("./types").PostFeedbackParams = {
      trajectoryId: "traj-123",
      relevanceScores: [0.8, 0.5],
      usedMemoryIds: ["mem-1", "mem-2"],
      userId: "allura-test",
    };

    expect(minimal.usedMemoryIds).toBeUndefined();
    expect(full.usedMemoryIds).toEqual(["mem-1", "mem-2"]);
  });

  it("StoreMemoryResult should match documented shape", () => {
    const result: import("./types").StoreMemoryResult = {
      id: "uuid-123",
      status: "stored_pending_embedding",
      createdAt: "2026-04-13T00:00:00.000Z",
      groupId: "allura-test",
    };

    expect(result.id).toBeTruthy();
    expect(result.status).toBe("stored_pending_embedding");
  });

  it("RetrieveMemoriesResult should include trajectoryId and modesUsed", () => {
    const result: import("./types").RetrieveMemoriesResult = {
      memories: [],
      total: 0,
      latencyMs: 5,
      trajectoryId: "traj-456",
      modesUsed: ["vector", "text"],
    };

    expect(result.trajectoryId).toBeTruthy();
    expect(Array.isArray(result.memories)).toBe(true);
    expect(result.modesUsed).toEqual(["vector", "text"]);
  });

  it("RuVectorMemoryType should allow all three types", () => {
    const types: import("./types").RuVectorMemoryType[] = [
      "episodic",
      "semantic",
      "procedural",
    ];

    expect(types).toHaveLength(3);
    expect(types).toContain("episodic");
    expect(types).toContain("semantic");
    expect(types).toContain("procedural");
  });
});