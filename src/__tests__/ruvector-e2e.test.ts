/**
 * RuVector Bridge E2E Tests
 * Tests the RuVector bridge against a live PostgreSQL instance with RuVector extension.
 *
 * Prerequisites:
 * - PostgreSQL with RuVector extension accessible via RUVECTOR_* env vars
 * - RUVECTOR_ENABLED=true must be set
 * - allura_memories and allura_feedback tables must exist
 *
 * Run with: RUN_E2E_TESTS=true RUVECTOR_ENABLED=true bun vitest run src/__tests__/ruvector-e2e.test.ts
 *
 * If the database is unreachable, tests will be skipped gracefully.
 */

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { Pool } from "pg";
import { config } from "dotenv";

// Load environment variables
config();

// ── E2E gate: skip entire suite unless explicitly enabled ──────────────────────
const shouldRunE2E = process.env.RUN_E2E_TESTS === "true";

// ── Connection configuration ───────────────────────────────────────────────────
const E2E_CONFIG = {
  host: process.env.RUVECTOR_HOST || "localhost",
  port: parseInt(process.env.RUVECTOR_PORT || "5433", 10),
  database: process.env.RUVECTOR_DB || "memory",
  user: process.env.RUVECTOR_USER || "ronin4life",
  password: process.env.RUVECTOR_PASSWORD || "ronin4life",
};

// ── Constants ──────────────────────────────────────────────────────────────────
const GROUP_ID = "allura-e2e-ruvector";
const E2E_TIMEOUT = 30000; // 30 seconds for integration tests

// ── Import bridge functions (server-only modules) ──────────────────────────────
// We import the bridge functions AND bypass the module-level pool by providing
// our own pg Pool. To do this cleanly, we use the bridge module's own
// getRuVectorPool which reads from env vars. We set RUVECTOR_ENABLED=true before
// the import so the bridge considers itself enabled, and we set the RUVECTOR_*
// connection env vars so getRuVectorPool() connects to the right instance.

// Set env vars BEFORE importing bridge so the singleton pool picks them up
process.env.RUVECTOR_ENABLED = "true";
process.env.RUVECTOR_HOST = E2E_CONFIG.host;
process.env.RUVECTOR_PORT = String(E2E_CONFIG.port);
process.env.RUVECTOR_DB = E2E_CONFIG.database;
process.env.RUVECTOR_USER = E2E_CONFIG.user;
process.env.RUVECTOR_PASSWORD = E2E_CONFIG.password;

import {
  storeMemory,
  retrieveMemories,
  postFeedback,
  isRuVectorReady,
  RuVectorBridgeValidationError,
} from "../lib/ruvector/bridge";
import { GroupIdValidationError } from "../lib/validation/group-id";
import { closeRuVectorPool } from "../lib/ruvector/connection";

// ── Direct pool for cleanup ────────────────────────────────────────────────────
let cleanupPool: Pool | null = null;

describe.skipIf(!shouldRunE2E)("RuVector Bridge E2E", () => {
  let connected = false;

  beforeAll(async () => {
    // Verify we can reach the RuVector database
    try {
      cleanupPool = new Pool({
        host: E2E_CONFIG.host,
        port: E2E_CONFIG.port,
        database: E2E_CONFIG.database,
        user: E2E_CONFIG.user,
        password: E2E_CONFIG.password,
        connectionTimeoutMillis: 10000,
      });

      await cleanupPool.query("SELECT 1");
      connected = true;
    } catch (error) {
      // If we can't connect, skip all tests gracefully
      console.warn(
        "[RuVector E2E] Cannot connect to RuVector database — skipping tests.",
        error instanceof Error ? error.message : String(error)
      );
    }
  }, E2E_TIMEOUT);

  afterAll(async () => {
    if (!connected || !cleanupPool) return;

    // Clean up test data
    try {
      await cleanupPool.query(
        "DELETE FROM allura_feedback WHERE group_id = $1",
        [GROUP_ID]
      );
      await cleanupPool.query(
        "DELETE FROM allura_memories WHERE group_id = $1",
        [GROUP_ID]
      );
    } catch {
      // Best-effort cleanup — don't fail the suite
    }

    // Close pools
    try {
      await cleanupPool.end();
    } catch {
      // Ignore pool close errors
    }

    try {
      await closeRuVectorPool();
    } catch {
      // Ignore bridge pool close errors
    }
  }, E2E_TIMEOUT);

  // ── Test 1: storeMemory stores and returns id ────────────────────────────────
  it(
    "storeMemory stores and returns id",
    async () => {
      if (!connected) return;

      const result = await storeMemory({
        userId: GROUP_ID,
        sessionId: "e2e-session-001",
        content: "E2E test: I prefer TypeScript with strict mode enabled for allura-e2e-ruvector",
        memoryType: "episodic",
        metadata: { source: "e2e-test", testRun: true },
      });

      // Verify shape
      expect(result).toBeDefined();
      expect(result.id).toBeDefined();
      expect(typeof result.id).toBe("string");
      // BIGSERIAL id should parse to a number
      expect(Number.isNaN(Number(result.id))).toBe(false);
      expect(result.status).toBe("stored_pending_embedding");
      expect(result.groupId).toBe(GROUP_ID);
      expect(result.createdAt).toBeDefined();
      // Verify ISO-8601 timestamp
      expect(new Date(result.createdAt).getTime()).not.toBeNaN();
    },
    E2E_TIMEOUT
  );

  // ── Test 2: storeMemory rejects invalid group_id ─────────────────────────────
  it(
    "storeMemory rejects invalid group_id",
    async () => {
      if (!connected) return;

      await expect(
        storeMemory({
          userId: "bad-group",
          sessionId: "e2e-session-002",
          content: "This should be rejected",
        })
      ).rejects.toThrow(GroupIdValidationError);
    },
    E2E_TIMEOUT
  );

  // ── Test 3: retrieveMemories finds stored content ────────────────────────────
  it(
    "retrieveMemories finds stored content",
    async () => {
      if (!connected) return;

      // First, store a memory that we'll search for
      const storeResult = await storeMemory({
        userId: GROUP_ID,
        sessionId: "e2e-session-003",
        content:
          "E2E test retrieval: TypeScript strict mode is my preferred configuration for allura-e2e-ruvector",
        memoryType: "episodic",
        metadata: { source: "e2e-test" },
      });

      expect(storeResult.id).toBeDefined();

      // Now retrieve it using ts_rank text search
      const result = await retrieveMemories({
        userId: GROUP_ID,
        query: "TypeScript strict mode",
        limit: 5,
        threshold: 0.0, // Low threshold to ensure we find results
      });

      // Verify shape
      expect(result).toBeDefined();
      expect(Array.isArray(result.memories)).toBe(true);
      expect(result.total).toBeGreaterThan(0);
      expect(typeof result.latencyMs).toBe("number");
      expect(result.trajectoryId).toBeDefined();
      expect(typeof result.trajectoryId).toBe("string");

      // At least one result should contain our stored content
      // (ts_rank may return multiple matches, including those from test 1)
      const matchingMemories = result.memories.filter(
        (m) => m.content.includes("TypeScript")
      );
      expect(matchingMemories.length).toBeGreaterThan(0);

      // Score should be between 0 and 1 after normalization
      for (const memory of result.memories) {
        expect(memory.score).toBeGreaterThanOrEqual(0);
        expect(memory.score).toBeLessThanOrEqual(1);
        expect(typeof memory.id).toBe("string");
        expect(memory.content).toBeTruthy();
      }
    },
    E2E_TIMEOUT
  );

  // ── Test 4: retrieveMemories rejects empty query ────────────────────────────
  it(
    "retrieveMemories rejects empty query",
    async () => {
      if (!connected) return;

      await expect(
        retrieveMemories({
          userId: GROUP_ID,
          query: "",
        })
      ).rejects.toThrow(RuVectorBridgeValidationError);
    },
    E2E_TIMEOUT
  );

  // ── Test 5: postFeedback records feedback when memories are used ─────────────
  it(
    "postFeedback records feedback when memories are used",
    async () => {
      if (!connected) return;

      // First retrieve memories to get a trajectoryId
      const retrieveResult = await retrieveMemories({
        userId: GROUP_ID,
        query: "TypeScript",
        limit: 1,
        threshold: 0.0,
      });

      expect(retrieveResult.trajectoryId).toBeDefined();
      expect(retrieveResult.memories.length).toBeGreaterThan(0);

      const memoryId = retrieveResult.memories[0].id;

      // Post feedback using the trajectoryId from the retrieval
      // This should resolve without error
      await expect(
        postFeedback({
          trajectoryId: retrieveResult.trajectoryId,
          relevanceScores: [0.9],
          usedMemoryIds: [memoryId],
          userId: GROUP_ID,
        })
      ).resolves.toBeUndefined();

      // Verify feedback was recorded in the database
      const feedbackResult = await cleanupPool!.query(
        "SELECT * FROM allura_feedback WHERE group_id = $1 AND trajectory_id = $2",
        [GROUP_ID, retrieveResult.trajectoryId]
      );

      expect(feedbackResult.rows.length).toBe(1);
      expect(feedbackResult.rows[0].trajectory_id).toBe(
        retrieveResult.trajectoryId
      );
      expect(feedbackResult.rows[0].group_id).toBe(GROUP_ID);
    },
    E2E_TIMEOUT
  );

  // ── Test 6: postFeedback skips when no memories used ─────────────────────────
  it(
    "postFeedback skips when no memories used",
    async () => {
      if (!connected) return;

      // Record count before the call
      const beforeResult = await cleanupPool!.query(
        "SELECT COUNT(*) as count FROM allura_feedback WHERE group_id = $1",
        [GROUP_ID]
      );
      const countBefore = Number(beforeResult.rows[0].count);

      // Call with empty usedMemoryIds — should skip entirely
      await expect(
        postFeedback({
          trajectoryId: "traj-skip-test-e2e",
          relevanceScores: [0.5],
          usedMemoryIds: [],
          userId: GROUP_ID,
        })
      ).resolves.toBeUndefined();

      // Verify no new feedback row was created
      const afterResult = await cleanupPool!.query(
        "SELECT COUNT(*) as count FROM allura_feedback WHERE group_id = $1",
        [GROUP_ID]
      );
      const countAfter = Number(afterResult.rows[0].count);

      expect(countAfter).toBe(countBefore);
    },
    E2E_TIMEOUT
  );

  // ── Test 7: isRuVectorReady returns ready ────────────────────────────────────
  it(
    "isRuVectorReady returns ready",
    async () => {
      if (!connected) return;

      // We already set RUVECTOR_ENABLED=true above, and the database is reachable
      const result = await isRuVectorReady();

      expect(result).toBeDefined();
      expect(result.ready).toBe(true);
      // When ready, reason should be undefined
      expect(result.reason).toBeUndefined();
    },
    E2E_TIMEOUT
  );
});