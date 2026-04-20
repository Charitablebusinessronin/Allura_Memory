/**
 * embedding-backfill-worker.test.ts
 *
 * Unit tests for the embedding backfill worker.
 *
 * Strategy:
 * - Mock `getRuVectorPool` so no real DB connection is required
 * - Mock `generateEmbeddingBatch` to control embedding results
 * - Test batch query, update format, CLI flags, and graceful shutdown
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// ── Module mocks ──────────────────────────────────────────────────────────────

// Mock RuVector connection before importing the module under test
vi.mock("../lib/ruvector/connection", () => ({
  getRuVectorPool: vi.fn(),
  closeRuVectorPool: vi.fn(),
}));

// Mock embedding service
vi.mock("../lib/ruvector/embedding-service", () => ({
  generateEmbeddingBatch: vi.fn(),
}));

import { getRuVectorPool, closeRuVectorPool } from "../lib/ruvector/connection";
import { generateEmbeddingBatch } from "../lib/ruvector/embedding-service";
import {
  parseArgs,
  getPendingRows,
  formatEmbeddingForUpdate,
  processBatch,
  runBackfillCycle,
  runWorker,
  type WorkerConfig,
  type PendingMemoryRow,
} from "./embedding-backfill-worker";

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeMockPool(queryResult: { rows: Record<string, unknown>[] } = { rows: [] }) {
  return {
    query: vi.fn().mockResolvedValue(queryResult),
  };
}

function makeFakeEmbedding(dimensions: number = 768): number[] {
  return Array.from({ length: dimensions }, (_, i) => parseFloat((0.001 * (i + 1)).toFixed(6)));
}

function makePendingRows(count: number): PendingMemoryRow[] {
  return Array.from({ length: count }, (_, i) => ({
    id: String(100 + i),
    content: `Memory content item ${i}`,
  }));
}

function defaultConfig(overrides: Partial<WorkerConfig> = {}): WorkerConfig {
  return {
    once: true,
    dryRun: false,
    pollIntervalMs: 30_000,
    groupId: null,
    ...overrides,
  };
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("parseArgs", () => {
  it("should return defaults when no args provided", () => {
    const config = parseArgs([]);
    expect(config.once).toBe(false);
    expect(config.dryRun).toBe(false);
    expect(config.pollIntervalMs).toBe(30_000);
    expect(config.groupId).toBe(null);
  });

  it("should parse --once flag", () => {
    const config = parseArgs(["--once"]);
    expect(config.once).toBe(true);
  });

  it("should parse --dry-run flag", () => {
    const config = parseArgs(["--dry-run"]);
    expect(config.dryRun).toBe(true);
  });

  it("should parse --interval with value", () => {
    const config = parseArgs(["--interval", "60000"]);
    expect(config.pollIntervalMs).toBe(60_000);
  });

  it("should parse --group-id with value", () => {
    const config = parseArgs(["--group-id", "allura-test"]);
    expect(config.groupId).toBe("allura-test");
  });

  it("should parse all flags together", () => {
    const config = parseArgs(["--once", "--dry-run", "--interval", "10000", "--group-id", "allura-prod"]);
    expect(config.once).toBe(true);
    expect(config.dryRun).toBe(true);
    expect(config.pollIntervalMs).toBe(10_000);
    expect(config.groupId).toBe("allura-prod");
  });

  it("should ignore unknown flags", () => {
    const config = parseArgs(["--unknown-flag", "42"]);
    expect(config.once).toBe(false);
    expect(config.dryRun).toBe(false);
  });

  it("should handle --interval without value gracefully", () => {
    const config = parseArgs(["--interval"]);
    // Missing value — should keep default
    expect(config.pollIntervalMs).toBe(30_000);
  });

  it("should handle --group-id without value gracefully", () => {
    const config = parseArgs(["--group-id"]);
    expect(config.groupId).toBe(null);
  });
});

describe("getPendingRows", () => {
  let mockPool: ReturnType<typeof makeMockPool>;

  beforeEach(() => {
    mockPool = makeMockPool({ rows: [] });
    vi.mocked(getRuVectorPool).mockReturnValue(mockPool as never);
  });

  it("should query rows WHERE embedding IS NULL AND deleted_at IS NULL", async () => {
    const fakeRows = [
      { id: 1, content: "Memory A" },
      { id: 2, content: "Memory B" },
    ];
    mockPool.query.mockResolvedValueOnce({ rows: fakeRows });

    const result = await getPendingRows(10);

    expect(result).toHaveLength(2);
    expect(result[0]).toEqual({ id: "1", content: "Memory A" });
    expect(result[1]).toEqual({ id: "2", content: "Memory B" });

    // Verify the SQL includes the required WHERE clauses
    const sqlCall = mockPool.query.mock.calls[0];
    expect(sqlCall[0]).toContain("embedding IS NULL");
    expect(sqlCall[0]).toContain("deleted_at IS NULL");
    expect(sqlCall[0]).toContain("ORDER BY created_at ASC");
    expect(sqlCall[0]).toContain("LIMIT $1");
  });

  it("should include group_id filter when groupId is provided", async () => {
    mockPool.query.mockResolvedValueOnce({ rows: [] });

    await getPendingRows(10, "allura-test");

    const sqlCall = mockPool.query.mock.calls[0];
    expect(sqlCall[0]).toContain("group_id = $2");
    expect(sqlCall[1]).toEqual([10, "allura-test"]);
  });

  it("should not include group_id in SQL when groupId is null", async () => {
    mockPool.query.mockResolvedValueOnce({ rows: [] });

    await getPendingRows(10, null);

    const sqlCall = mockPool.query.mock.calls[0];
    expect(sqlCall[0]).not.toContain("group_id = $2");
    expect(sqlCall[1]).toEqual([10]);
  });

  it("should stringify ids from query results", async () => {
    mockPool.query.mockResolvedValueOnce({
      rows: [{ id: 999, content: "Big id" }],
    });

    const result = await getPendingRows(10);
    expect(result[0].id).toBe("999");
  });
});

describe("formatEmbeddingForUpdate", () => {
  it("should format embedding as string literal '[0.1,0.2,...]'", () => {
    const embedding = [0.1, 0.2, 0.3, 0.768];
    const result = formatEmbeddingForUpdate(embedding);
    expect(result).toBe("[0.1,0.2,0.3,0.768]");
  });

  it("should format a 768-dim embedding correctly", () => {
    const embedding = makeFakeEmbedding(768);
    const result = formatEmbeddingForUpdate(embedding);
    // Should start with [ and end with ]
    expect(result).toMatch(/^\[.*\]$/);
    // Should have 768 comma-separated values
    const parts = result.slice(1, -1).split(",");
    expect(parts).toHaveLength(768);
  });

  it("should handle single-element embedding", () => {
    const result = formatEmbeddingForUpdate([0.5]);
    expect(result).toBe("[0.5]");
  });

  it("should handle negative values", () => {
    const result = formatEmbeddingForUpdate([-0.1, 0.2, -0.3]);
    expect(result).toBe("[-0.1,0.2,-0.3]");
  });
});

describe("processBatch", () => {
  let mockPool: ReturnType<typeof makeMockPool>;

  beforeEach(() => {
    mockPool = makeMockPool();
    vi.mocked(getRuVectorPool).mockReturnValue(mockPool as never);
    vi.mocked(generateEmbeddingBatch).mockReset();
  });

  it("should return zero counts when no rows provided", async () => {
    const result = await processBatch([]);
    expect(result).toEqual({ succeeded: 0, failed: 0 });
    expect(generateEmbeddingBatch).not.toHaveBeenCalled();
  });

  it("should update rows with generated embeddings using ::vector cast", async () => {
    const rows = makePendingRows(3);
    const embeddings = rows.map(() => makeFakeEmbedding(768));

    vi.mocked(generateEmbeddingBatch).mockResolvedValueOnce(embeddings);
    mockPool.query.mockResolvedValue({ rows: [] });

    const result = await processBatch(rows);

    expect(result.succeeded).toBe(3);
    expect(result.failed).toBe(0);

    // Verify each UPDATE uses ::vector and the formatted embedding string
    for (let i = 0; i < 3; i++) {
      const updateCall = mockPool.query.mock.calls[i];
      expect(updateCall[0]).toContain("::vector");
      expect(updateCall[0]).toContain("UPDATE allura_memories");
      // First param is the embedding string literal
      expect(updateCall[1][0]).toMatch(/^\[.*\]$/);
      // Second param is the row id
      expect(updateCall[1][1]).toBe(rows[i].id);
    }
  });

  it("should count failed embeddings when generateEmbeddingBatch returns nulls", async () => {
    const rows = makePendingRows(3);
    // First succeeds, second fails, third succeeds
    const embeddings = [makeFakeEmbedding(768), null, makeFakeEmbedding(768)];

    vi.mocked(generateEmbeddingBatch).mockResolvedValueOnce(embeddings);
    mockPool.query.mockResolvedValue({ rows: [] });

    const result = await processBatch(rows);

    expect(result.succeeded).toBe(2);
    expect(result.failed).toBe(1);
    // Only 2 UPDATE queries (for successful embeddings)
    expect(mockPool.query).toHaveBeenCalledTimes(2);
  });

  it("should count DB update failures as failed", async () => {
    const rows = makePendingRows(2);
    const embeddings = [makeFakeEmbedding(768), makeFakeEmbedding(768)];

    vi.mocked(generateEmbeddingBatch).mockResolvedValueOnce(embeddings);
    // First UPDATE succeeds, second throws
    mockPool.query
      .mockResolvedValueOnce({ rows: [] })
      .mockRejectedValueOnce(new Error("Connection lost"));

    const result = await processBatch(rows);

    expect(result.succeeded).toBe(1);
    expect(result.failed).toBe(1);
  });

  it("should NOT write to DB in dry-run mode", async () => {
    const rows = makePendingRows(5);

    const result = await processBatch(rows, true);

    expect(result.succeeded).toBe(0);
    expect(result.failed).toBe(0);
    expect(generateEmbeddingBatch).not.toHaveBeenCalled();
    expect(mockPool.query).not.toHaveBeenCalled();
  });
});

describe("--once flag (single batch then exit)", () => {
  let mockPool: ReturnType<typeof makeMockPool>;

  beforeEach(() => {
    mockPool = makeMockPool();
    vi.mocked(getRuVectorPool).mockReturnValue(mockPool as never);
    vi.mocked(generateEmbeddingBatch).mockReset();
    vi.mocked(closeRuVectorPool).mockReset();
  });

  it("should process one batch and exit when --once is set", async () => {
    const rows = makePendingRows(2);
    const embeddings = rows.map(() => makeFakeEmbedding(768));

    // getPendingRows returns rows on first call, then empty
    mockPool.query
      .mockResolvedValueOnce({ rows: rows.map((r) => ({ id: r.id, content: r.content })) })
      .mockResolvedValue({ rows: [] }); // UPDATE calls

    vi.mocked(generateEmbeddingBatch).mockResolvedValueOnce(embeddings);

    const config = defaultConfig({ once: true });
    const stats = await runWorker(config);

    // Should have processed exactly the first batch
    expect(stats.totalProcessed).toBe(2);
    expect(stats.successfullyEmbedded).toBe(2);
    expect(stats.cyclesCompleted).toBe(1);
    expect(closeRuVectorPool).toHaveBeenCalled();
  });

  it("should exit immediately when no pending rows and --once is set", async () => {
    mockPool.query.mockResolvedValueOnce({ rows: [] });

    const config = defaultConfig({ once: true });
    const stats = await runWorker(config);

    expect(stats.totalProcessed).toBe(0);
    expect(stats.cyclesCompleted).toBe(1);
  });
});

describe("--dry-run (no writes)", () => {
  let mockPool: ReturnType<typeof makeMockPool>;

  beforeEach(() => {
    mockPool = makeMockPool();
    vi.mocked(getRuVectorPool).mockReturnValue(mockPool as never);
    vi.mocked(generateEmbeddingBatch).mockReset();
  });

  it("should not generate embeddings or write to DB in dry-run mode", async () => {
    const rows = makePendingRows(5);
    mockPool.query.mockResolvedValueOnce({
      rows: rows.map((r) => ({ id: r.id, content: r.content })),
    });

    const config = defaultConfig({ once: true, dryRun: true });
    const stats = await runWorker(config);

    // In dry-run, processBatch returns {succeeded: 0, failed: 0}
    expect(stats.successfullyEmbedded).toBe(0);
    expect(stats.failed).toBe(0);
    expect(stats.totalProcessed).toBe(5); // Rows were found
    expect(generateEmbeddingBatch).not.toHaveBeenCalled();

    // Only the SELECT query should have been called (no UPDATE)
    const queryCalls = mockPool.query.mock.calls;
    expect(queryCalls.length).toBe(1);
    expect(queryCalls[0][0]).toContain("SELECT");
  });
});

describe("graceful shutdown on SIGINT", () => {
  let mockPool: ReturnType<typeof makeMockPool>;

  beforeEach(() => {
    mockPool = makeMockPool();
    vi.mocked(getRuVectorPool).mockReturnValue(mockPool as never);
    vi.mocked(generateEmbeddingBatch).mockReset();
    vi.mocked(closeRuVectorPool).mockReset();
  });

  afterEach(() => {
    // Clean up any stray SIGINT listeners
    process.removeAllListeners("SIGINT");
    process.removeAllListeners("SIGTERM");
  });

  it("should stop polling and report stats on SIGINT", async () => {
    // Return rows on first query, empty after
    mockPool.query
      .mockResolvedValueOnce({ rows: [{ id: "1", content: "test" }] })
      .mockResolvedValue({ rows: [] });

    vi.mocked(generateEmbeddingBatch).mockResolvedValueOnce([makeFakeEmbedding(768)]);

    const config = defaultConfig({ once: false, pollIntervalMs: 300_000 });

    // Start the worker, then send SIGINT after a short delay
    const workerPromise = runWorker(config);

    // Give the worker time to start, then simulate SIGINT
    setTimeout(() => {
      process.emit("SIGINT");
    }, 100);

    const stats = await workerPromise;

    // Worker should have completed and reported stats
    expect(stats.cyclesCompleted).toBeGreaterThanOrEqual(1);
    expect(closeRuVectorPool).toHaveBeenCalled();
  });

  it("should report final stats with successful embeddings on shutdown", async () => {
    const rows = makePendingRows(3);
    const embeddings = rows.map(() => makeFakeEmbedding(768));

    mockPool.query
      .mockResolvedValueOnce({
        rows: rows.map((r) => ({ id: r.id, content: r.content })),
      })
      .mockResolvedValue({ rows: [] });

    vi.mocked(generateEmbeddingBatch).mockResolvedValueOnce(embeddings);

    const config = defaultConfig({ once: false, pollIntervalMs: 300_000 });

    const workerPromise = runWorker(config);

    setTimeout(() => {
      process.emit("SIGINT");
    }, 100);

    const stats = await workerPromise;

    expect(stats.totalProcessed).toBe(3);
    expect(stats.successfullyEmbedded).toBe(3);
    expect(stats.failed).toBe(0);
  });

  it("should stop the worker even during poll interval sleep", async () => {
    mockPool.query.mockResolvedValue({ rows: [] });

    const config = defaultConfig({ once: false, pollIntervalMs: 60_000 });
    const workerPromise = runWorker(config);

    // Simulate SIGINT while worker is sleeping between polls
    setTimeout(() => {
      process.emit("SIGINT");
    }, 200);

    const stats = await workerPromise;

    // Should have completed at least one cycle and then stopped
    expect(stats.cyclesCompleted).toBeGreaterThanOrEqual(1);
    expect(closeRuVectorPool).toHaveBeenCalled();
  });
});

describe("runBackfillCycle", () => {
  let mockPool: ReturnType<typeof makeMockPool>;

  beforeEach(() => {
    mockPool = makeMockPool();
    vi.mocked(getRuVectorPool).mockReturnValue(mockPool as never);
    vi.mocked(generateEmbeddingBatch).mockReset();
  });

  it("should return correct stats for a full batch", async () => {
    const rows = makePendingRows(5);
    const embeddings = rows.map(() => makeFakeEmbedding(768));

    mockPool.query
      .mockResolvedValueOnce({
        rows: rows.map((r) => ({ id: r.id, content: r.content })),
      })
      .mockResolvedValue({ rows: [] });

    vi.mocked(generateEmbeddingBatch).mockResolvedValueOnce(embeddings);

    const config = defaultConfig();
    const result = await runBackfillCycle(config);

    expect(result.rowsFound).toBe(5);
    expect(result.succeeded).toBe(5);
    expect(result.failed).toBe(0);
  });

  it("should return zero stats when no rows found", async () => {
    mockPool.query.mockResolvedValueOnce({ rows: [] });

    const config = defaultConfig();
    const result = await runBackfillCycle(config);

    expect(result.rowsFound).toBe(0);
    expect(result.succeeded).toBe(0);
    expect(result.failed).toBe(0);
  });

  it("should pass group_id filter to getPendingRows", async () => {
    mockPool.query.mockResolvedValueOnce({ rows: [] });

    const config = defaultConfig({ groupId: "allura-prod" });
    await runBackfillCycle(config);

    const sqlCall = mockPool.query.mock.calls[0];
    expect(sqlCall[0]).toContain("group_id = $2");
    expect(sqlCall[1]).toContain("allura-prod");
  });
});