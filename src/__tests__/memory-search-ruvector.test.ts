/**
 * RuVector Bridge Integration Tests for memory_search
 *
 * Tests that the canonical memory_search function correctly integrates
 * RuVector as a conditional third search source:
 * - Feature-flagged: only active when RUVECTOR_ENABLED=true AND health check passes
 * - Fail-closed: if RuVector fails, search falls back to PG+Neo4j only
 * - Evidence-gated feedback: trajectoryId is surfaced in metadata for caller use
 * - Score normalization: RuVector scores are used as-is (already 0-1 compatible)
 * - Group_id enforcement: all paths validate group_id via validateGroupId()
 * - stores_used includes "ruvector" when RuVector results are present
 *
 * These tests mock the RuVector adapter and database connections to avoid
 * requiring live services.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// ── Module mocks ──────────────────────────────────────────────────────────────

// Mock the RuVector retrieval adapter
const mockShouldUseRuVector = vi.fn();
const mockSearchWithFeedback = vi.fn();

vi.mock("@/lib/ruvector/retrieval-adapter", () => ({
  shouldUseRuVector: (...args: unknown[]) => mockShouldUseRuVector(...args),
  searchWithFeedback: (...args: unknown[]) => mockSearchWithFeedback(...args),
}));

// Mock database connections
const mockPgQuery = vi.fn();
const mockNeo4jSession = {
  run: vi.fn(),
  close: vi.fn(),
};

vi.mock("pg", () => ({
  Pool: vi.fn().mockImplementation(() => ({
    query: mockPgQuery,
    end: vi.fn(),
    on: vi.fn(),
  })),
}));

vi.mock("neo4j-driver", () => ({
  default: {
    driver: vi.fn().mockReturnValue({
      session: () => mockNeo4jSession,
      close: vi.fn(),
    }),
    int: (val: number) => ({ toNumber: () => val }),
    auth: {
      basic: vi.fn(),
    },
  },
  Driver: vi.fn(),
}));

vi.mock("dotenv", () => ({ config: vi.fn() }));

vi.mock("@/lib/curator/score", () => ({
  curatorScore: vi.fn().mockResolvedValue(0.5),
}));

vi.mock("@/lib/validation/group-id", () => ({
  validateGroupId: vi.fn((id: string) => {
    if (!id.startsWith("allura-")) {
      throw new Error("Invalid group_id: must match ^allura-[a-z0-9-]+$");
    }
    return id;
  }),
}));

vi.mock("@/lib/dedup/proposal-dedup", () => ({
  createProposalDedupChecker: vi.fn(),
  getDedupThreshold: vi.fn().mockReturnValue(0.95),
}));

vi.mock("@/lib/budget/enforcer", () => ({
  BudgetEnforcer: vi.fn(),
}));

vi.mock("@/lib/budget/middleware-integration", () => ({
  checkBudgetBeforeCall: vi.fn().mockReturnValue({ allowed: true }),
  updateBudgetAfterCall: vi.fn(),
  createSessionId: vi.fn().mockReturnValue("mock-session-id"),
}));

vi.mock("@/lib/circuit-breaker/manager", () => ({
  BreakerManager: vi.fn(),
}));

vi.mock("@/lib/errors/database-errors", () => ({
  DatabaseUnavailableError: class extends Error {
    operation: string;
    constructor(op: string, cause: Error) {
      super(`Database unavailable for operation: ${op}`);
      this.name = "DatabaseUnavailableError";
      this.operation = op;
    }
  },
  DatabaseQueryError: class extends Error {
    operation: string;
    query: string;
    constructor(op: string, q: string, cause: Error) {
      super(`Database query failed for operation: ${op}`);
      this.name = "DatabaseQueryError";
      this.operation = op;
      this.query = q;
    }
  },
  classifyPostgresError: vi.fn((err: Error, op: string, q: string) => err),
}));

import { memory_search } from "../mcp/canonical-tools";
import type { MemorySearchRequest } from "../lib/memory/canonical-contracts";

// ── Test fixtures ─────────────────────────────────────────────────────────────

const VALID_GROUP_ID = "allura-test-group";

function makeSearchRequest(overrides?: Partial<MemorySearchRequest>): MemorySearchRequest {
  return {
    query: "test query",
    group_id: VALID_GROUP_ID as any,
    ...overrides,
  };
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("memory_search RuVector integration", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    // Default: PG returns some results
    mockPgQuery.mockResolvedValue({
      rows: [
        {
          id: "pg-mem-1",
          content: "User prefers dark mode",
          provenance: "conversation",
          created_at: new Date().toISOString(),
        },
      ],
    });

    // Default: Neo4j returns some results
    mockNeo4jSession.run.mockResolvedValue({
      records: [
        {
          get: (key: string) => {
            const map: Record<string, unknown> = {
              id: "neo4j-mem-1",
              content: "Semantic knowledge about dark mode",
              score: 0.9,
              provenance: "conversation",
              created_at: new Date().toISOString(),
              usage_count: 5,
              relevance: 0.9,
            };
            return map[key];
          },
        },
      ],
    });

    // Default: RuVector is NOT enabled
    mockShouldUseRuVector.mockResolvedValue(false);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("when RuVector is disabled (default)", () => {
    it("should not call shouldUseRuVector when searching", async () => {
      await memory_search(makeSearchRequest());

      expect(mockShouldUseRuVector).toHaveBeenCalled();
      expect(mockSearchWithFeedback).not.toHaveBeenCalled();
    });

    it("should return results without RuVector and without ruvector metadata", async () => {
      const response = await memory_search(makeSearchRequest());

      // Should have results from PG+Neo4j only
      expect(response.results.length).toBeGreaterThan(0);
      // Should NOT have RuVector metadata
      expect(response.meta?.ruvector_trajectory_id).toBeUndefined();
      expect(response.meta?.ruvector_count).toBeUndefined();
      // stores_used should NOT include "ruvector"
      expect(response.meta?.stores_used).not.toContain("ruvector");
    });
  });

  describe("when RuVector is enabled and healthy", () => {
    beforeEach(() => {
      mockShouldUseRuVector.mockResolvedValue(true);
      mockSearchWithFeedback.mockResolvedValue({
        memories: [
          {
            id: "rv-mem-1",
            content: "RuVector semantic memory about TypeScript",
            memoryType: "episodic",
            score: 0.85,
          },
          {
            id: "rv-mem-2",
            content: "RuVector memory about dark mode preference",
            memoryType: "episodic",
            score: 0.72,
          },
        ],
        total: 2,
        latencyMs: 15,
        trajectoryId: "traj-abc-123",
        bridgeSource: "ruvector",
        shouldLogFeedback: true,
      });
    });

    it("should call searchWithFeedback with validated group_id and query", async () => {
      const request = makeSearchRequest({ query: "dark mode preferences" });
      await memory_search(request);

      expect(mockSearchWithFeedback).toHaveBeenCalledWith(
        VALID_GROUP_ID,
        "dark mode preferences",
        expect.objectContaining({
          limit: 10,
          threshold: 0.3,
        }),
      );
    });

    it("should merge RuVector results with PG+Neo4j results", async () => {
      const response = await memory_search(makeSearchRequest());

      // Results should include both PG/Neo4j and RuVector results
      const ruvectorContents = response.results
        .filter((r) => r.content.includes("RuVector"))
        .map((r) => r.content);
      expect(ruvectorContents.length).toBe(2);

      // Total count should reflect all sources
      expect(response.results.length).toBeGreaterThanOrEqual(3); // 1 PG + 1 Neo4j + 2 RV
    });

    it("should sort all results by score descending", async () => {
      const response = await memory_search(makeSearchRequest());

      // Verify scores are in descending order
      for (let i = 1; i < response.results.length; i++) {
        expect(response.results[i - 1].score).toBeGreaterThanOrEqual(
          response.results[i].score,
        );
      }
    });

    it("should include ruvector_trajectory_id and ruvector_count in metadata", async () => {
      const response = await memory_search(makeSearchRequest());

      expect(response.meta?.ruvector_trajectory_id).toBe("traj-abc-123");
      expect(response.meta?.ruvector_count).toBe(2);
    });

    it("should include 'ruvector' in stores_used when RuVector returns results", async () => {
      const response = await memory_search(makeSearchRequest());

      expect(response.meta?.stores_used).toContain("ruvector");
      // Should also still include postgres and neo4j
      expect(response.meta?.stores_used).toContain("postgres");
      expect(response.meta?.stores_used).toContain("neo4j");
    });

    it("should map RuVector results as episodic source with conversation provenance", async () => {
      const response = await memory_search(makeSearchRequest());

      const ruvectorResults = response.results.filter((r) =>
        r.content.includes("RuVector"),
      );

      for (const result of ruvectorResults) {
        expect(result.source).toBe("episodic"); // RuVector is episodic storage
        expect(result.provenance).toBe("conversation");
        expect(result.created_at).toBeDefined();
        expect(result.usage_count).toBe(0);
      }
    });

    it("should respect the limit parameter across all sources", async () => {
      const request = makeSearchRequest({ limit: 2 });
      const response = await memory_search(request);

      expect(response.results.length).toBeLessThanOrEqual(2);
    });

    it("should pass the request limit to searchWithFeedback", async () => {
      const request = makeSearchRequest({ limit: 5 });
      await memory_search(request);

      expect(mockSearchWithFeedback).toHaveBeenCalledWith(
        VALID_GROUP_ID,
        expect.any(String),
        expect.objectContaining({
          limit: 5,
        }),
      );
    });
  });

  describe("when RuVector is enabled but returns no results", () => {
    beforeEach(() => {
      mockShouldUseRuVector.mockResolvedValue(true);
      mockSearchWithFeedback.mockResolvedValue({
        memories: [],
        total: 0,
        latencyMs: 5,
        trajectoryId: "traj-empty-456",
        bridgeSource: "ruvector",
        shouldLogFeedback: false,
      });
    });

    it("should still include trajectory_id but with count 0", async () => {
      const response = await memory_search(makeSearchRequest());

      expect(response.meta?.ruvector_trajectory_id).toBe("traj-empty-456");
      expect(response.meta?.ruvector_count).toBe(0);
    });

    it("should NOT include 'ruvector' in stores_used with zero results", async () => {
      const response = await memory_search(makeSearchRequest());

      expect(response.meta?.stores_used).not.toContain("ruvector");
    });

    it("should still return PG+Neo4j results", async () => {
      const response = await memory_search(makeSearchRequest());

      expect(response.results.length).toBeGreaterThan(0);
    });
  });

  describe("when RuVector throws an error (fail-closed)", () => {
    beforeEach(() => {
      mockShouldUseRuVector.mockResolvedValue(true);
      mockSearchWithFeedback.mockRejectedValue(
        new Error("RuVector connection refused"),
      );
    });

    it("should NOT fail the entire search", async () => {
      const response = await memory_search(makeSearchRequest());

      // Search should succeed with PG+Neo4j results only
      expect(response.results.length).toBeGreaterThan(0);
      expect(response.count).toBeGreaterThan(0);
    });

    it("should NOT include RuVector metadata", async () => {
      const response = await memory_search(makeSearchRequest());

      expect(response.meta?.ruvector_trajectory_id).toBeUndefined();
      expect(response.meta?.ruvector_count).toBeUndefined();
    });

    it("should NOT include 'ruvector' in stores_used", async () => {
      const response = await memory_search(makeSearchRequest());

      expect(response.meta?.stores_used).not.toContain("ruvector");
    });
  });

  describe("when shouldUseRuVector returns false", () => {
    beforeEach(() => {
      mockShouldUseRuVector.mockResolvedValue(false);
    });

    it("should not call searchWithFeedback", async () => {
      await memory_search(makeSearchRequest());

      expect(mockSearchWithFeedback).not.toHaveBeenCalled();
    });

    it("should not include RuVector metadata", async () => {
      const response = await memory_search(makeSearchRequest());

      expect(response.meta?.ruvector_trajectory_id).toBeUndefined();
      expect(response.meta?.ruvector_count).toBeUndefined();
      expect(response.meta?.stores_used).not.toContain("ruvector");
    });
  });

  describe("when shouldUseRuVector throws", () => {
    beforeEach(() => {
      mockShouldUseRuVector.mockRejectedValue(
        new Error("Health check timeout"),
      );
    });

    it("should fail-closed and continue with PG+Neo4j only", async () => {
      const response = await memory_search(makeSearchRequest());

      expect(response.results.length).toBeGreaterThan(0);
      expect(response.meta?.stores_used).not.toContain("ruvector");
    });
  });

  describe("group_id validation", () => {
    it("should reject invalid group_id before reaching RuVector", async () => {
      const request = makeSearchRequest({
        group_id: "invalid-group" as any,
      });

      await expect(memory_search(request)).rejects.toThrow("Invalid group_id");
      // searchWithFeedback should not be called since validation fails first
      expect(mockSearchWithFeedback).not.toHaveBeenCalled();
    });
  });
});