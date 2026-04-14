/**
 * Tests for RuVector Retrieval Adapter
 *
 * Covers:
 * - shouldUseRuVector() when enabled and disabled
 * - searchWithFeedback() returning trajectoryId
 * - shouldLogFeedback being true only when memories exist
 */

import { beforeEach, describe, expect, it, vi } from "vitest";

// ── Mock setup ───────────────────────────────────────────────────────────────

vi.mock("./connection", () => ({
  getRuVectorPool: vi.fn(),
  isRuVectorEnabled: vi.fn(() => true),
  checkRuVectorHealth: vi.fn(() =>
    Promise.resolve({ status: "healthy", latencyMs: 5, version: "RuVector 0.3.0" })
  ),
}));

vi.mock("./bridge", () => ({
  retrieveMemories: vi.fn(),
  isRuVectorReady: vi.fn(() =>
    Promise.resolve({ ready: true })
  ),
}));

vi.mock("../validation/group-id", () => ({
  validateGroupId: vi.fn((id: string) => {
    const trimmed = id.trim();
    if (!trimmed) throw new Error("group_id is required");
    if (!/^allura-[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/.test(trimmed)) {
      throw new Error("Invalid group_id: must match pattern allura-*");
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

// ── Imports (after mocks) ────────────────────────────────────────────────────

import { shouldUseRuVector, searchWithFeedback } from "./retrieval-adapter";
import type { RetrievalWithFeedbackResult } from "./retrieval-adapter";
import { retrieveMemories, isRuVectorReady } from "./bridge";
import { isRuVectorEnabled } from "./connection";
import { validateGroupId } from "../validation/group-id";

// ── Test Suite ────────────────────────────────────────────────────────────────

describe("RuVector Retrieval Adapter — shouldUseRuVector", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should return true when RuVector is enabled and healthy", async () => {
    vi.mocked(isRuVectorEnabled).mockReturnValue(true);
    vi.mocked(isRuVectorReady).mockResolvedValue({ ready: true });

    const result = await shouldUseRuVector();

    expect(result).toBe(true);
    expect(isRuVectorEnabled).toHaveBeenCalled();
    expect(isRuVectorReady).toHaveBeenCalled();
  });

  it("should return false when RuVector is not enabled", async () => {
    vi.mocked(isRuVectorEnabled).mockReturnValue(false);

    const result = await shouldUseRuVector();

    expect(result).toBe(false);
    // isRuVectorReady should NOT be called when the feature flag is off
    expect(isRuVectorReady).not.toHaveBeenCalled();
  });

  it("should return false when RuVector is enabled but health check fails", async () => {
    vi.mocked(isRuVectorEnabled).mockReturnValue(true);
    vi.mocked(isRuVectorReady).mockResolvedValue({
      ready: false,
      reason: "RuVector health check failed",
    });

    const result = await shouldUseRuVector();

    expect(result).toBe(false);
  });

  it("should return false when RuVector health check throws", async () => {
    vi.mocked(isRuVectorEnabled).mockReturnValue(true);
    vi.mocked(isRuVectorReady).mockRejectedValue(new Error("Connection refused"));

    const result = await shouldUseRuVector();

    expect(result).toBe(false);
  });
});

describe("RuVector Retrieval Adapter — searchWithFeedback", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should return trajectoryId from retrieveMemories", async () => {
    vi.mocked(retrieveMemories).mockResolvedValue({
      memories: [
        { id: "mem-1", content: "Test memory", memoryType: "episodic" as const, score: 0.9 },
      ],
      total: 1,
      latencyMs: 12,
      trajectoryId: "traj-abc-123",
      modesUsed: ["text"],
    });

    const result = await searchWithFeedback("allura-test", "test query");

    expect(result.trajectoryId).toBe("traj-abc-123");
    expect(retrieveMemories).toHaveBeenCalledWith({
      userId: "allura-test",
      query: "test query",
      limit: undefined,
      threshold: undefined,
      searchMode: undefined,
    });
  });

  it("should set bridgeSource to 'ruvector'", async () => {
    vi.mocked(retrieveMemories).mockResolvedValue({
      memories: [
        { id: "mem-1", content: "Test", memoryType: "episodic" as const, score: 0.75 },
      ],
      total: 1,
      latencyMs: 5,
      trajectoryId: "traj-xyz",
      modesUsed: ["text"],
    });

    const result = await searchWithFeedback("allura-test", "test");

    expect(result.bridgeSource).toBe("ruvector");
  });

  it("should set shouldLogFeedback to true when memories exist", async () => {
    vi.mocked(retrieveMemories).mockResolvedValue({
      memories: [
        { id: "mem-1", content: "Alpha", memoryType: "episodic" as const, score: 0.8 },
        { id: "mem-2", content: "Beta", memoryType: "semantic" as const, score: 0.6 },
      ],
      total: 2,
      latencyMs: 8,
      trajectoryId: "traj-feedback-test",
      modesUsed: ["vector", "text"],
    });

    const result = await searchWithFeedback("allura-test", "alpha beta");

    expect(result.shouldLogFeedback).toBe(true);
    expect(result.memories).toHaveLength(2);
  });

  it("should set shouldLogFeedback to false when no memories returned", async () => {
    vi.mocked(retrieveMemories).mockResolvedValue({
      memories: [],
      total: 0,
      latencyMs: 3,
      trajectoryId: "traj-empty",
      modesUsed: ["text"],
    });

    const result = await searchWithFeedback("allura-test", "nonexistent query");

    expect(result.shouldLogFeedback).toBe(false);
    expect(result.memories).toHaveLength(0);
  });

  it("should pass limit, threshold, and searchMode options through", async () => {
    vi.mocked(retrieveMemories).mockResolvedValue({
      memories: [],
      total: 0,
      latencyMs: 2,
      trajectoryId: "traj-opts",
      modesUsed: ["vector", "text"],
    });

    await searchWithFeedback("allura-test", "query", {
      limit: 5,
      threshold: 0.8,
      searchMode: "hybrid",
    });

    expect(retrieveMemories).toHaveBeenCalledWith({
      userId: "allura-test",
      query: "query",
      limit: 5,
      threshold: 0.8,
      searchMode: "hybrid",
    });
  });

  it("should validate group_id before calling retrieveMemories", async () => {
    vi.mocked(retrieveMemories).mockResolvedValue({
      memories: [],
      total: 0,
      latencyMs: 1,
      trajectoryId: "traj-validate",
      modesUsed: ["text"],
    });

    await searchWithFeedback("allura-test", "test");

    expect(validateGroupId).toHaveBeenCalledWith("allura-test");
  });

  it("should reject invalid group_id", async () => {
    await expect(
      searchWithFeedback("bad-group", "test")
    ).rejects.toThrow();
  });
});

describe("RuVector Retrieval Adapter — RetrievalWithFeedbackResult type", () => {
  it("should satisfy the type contract with all fields", () => {
    const result: RetrievalWithFeedbackResult = {
      memories: [
        { id: "1", content: "m", memoryType: "episodic" as const, score: 0.5 },
      ],
      total: 1,
      latencyMs: 10,
      trajectoryId: "traj-type-test",
      modesUsed: ["text"],
      bridgeSource: "ruvector",
      shouldLogFeedback: true,
    };

    expect(result.bridgeSource).toBe("ruvector");
    expect(result.shouldLogFeedback).toBe(true);
    expect(result.trajectoryId).toBe("traj-type-test");
    expect(result.modesUsed).toEqual(["text"]);
  });

  it("should allow bridgeSource to be undefined (postgres fallback)", () => {
    const result: RetrievalWithFeedbackResult = {
      memories: [],
      total: 0,
      latencyMs: 5,
      trajectoryId: "traj-pg",
      modesUsed: ["text"],
      shouldLogFeedback: false,
    };

    expect(result.bridgeSource).toBeUndefined();
  });
});