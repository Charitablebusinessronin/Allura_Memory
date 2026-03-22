import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import {
  runCurator,
  runCuratorBatch,
  getCuratorStatistics,
  previewDrafts,
  validateCuratorOptions,
  formatCuratorResult,
  CuratorError,
} from "./curator";
import { getPool, closePool } from "../postgres/connection";
import { insertEvent } from "../postgres/queries/insert-trace";

describe("curator", () => {
  const testGroupId = "curator-test-group";

  beforeAll(async () => {
    process.env.POSTGRES_HOST = process.env.POSTGRES_HOST || "localhost";
    process.env.POSTGRES_PORT = process.env.POSTGRES_PORT || "5432";
    process.env.POSTGRES_DB = process.env.POSTGRES_DB || "memory";
    process.env.POSTGRES_USER = process.env.POSTGRES_USER || "ronin4life";
    process.env.POSTGRES_PASSWORD = process.env.POSTGRES_PASSWORD || "KaminaTHC*";
  });

  afterAll(async () => {
    await closePool();
  });

  beforeEach(async () => {
    const pool = getPool();
    await pool.query("DELETE FROM events WHERE group_id = $1", [testGroupId]);
  });

  // =========================================================================
  // Validation Tests
  // =========================================================================

  describe("validateCuratorOptions", () => {
    it("should require group_id", () => {
      expect(() => validateCuratorOptions({} as { group_id: string })).toThrow(CuratorError);
    });

    it("should reject empty group_id", () => {
      expect(() => validateCuratorOptions({ group_id: "" })).toThrow("group_id is required");
    });

    it("should reject invalid min_frequency", () => {
      expect(() =>
        validateCuratorOptions({ group_id: "test", min_frequency: 0 })
      ).toThrow("min_frequency must be at least 1");
    });

    it("should reject invalid min_success_rate", () => {
      expect(() =>
        validateCuratorOptions({ group_id: "test", min_success_rate: 1.5 })
      ).toThrow("min_success_rate must be between 0 and 1");
    });

    it("should reject invalid min_confidence", () => {
      expect(() =>
        validateCuratorOptions({ group_id: "test", min_confidence: -0.1 })
      ).toThrow("min_confidence must be between 0 and 1");
    });

    it("should reject invalid max_drafts", () => {
      expect(() =>
        validateCuratorOptions({ group_id: "test", max_drafts: 0 })
      ).toThrow("max_drafts must be at least 1");
    });

    it("should reject invalid lookback_days", () => {
      expect(() =>
        validateCuratorOptions({ group_id: "test", lookback_days: 0 })
      ).toThrow("lookback_days must be at least 1");
    });

    it("should accept valid options", () => {
      expect(() =>
        validateCuratorOptions({
          group_id: "test",
          min_frequency: 5,
          min_success_rate: 0.8,
          min_confidence: 0.7,
          max_drafts: 10,
          lookback_days: 30,
        })
      ).not.toThrow();
    });
  });

  // =========================================================================
  // runCurator Tests
  // =========================================================================

  describe("runCurator", () => {
    it("should return empty result for group with no events", async () => {
      const result = await runCurator({ group_id: "empty-group-curator" });

      expect(result.patterns_detected).toBe(0);
      expect(result.drafts_generated).toBe(0);
      expect(result.drafts_created).toBe(0);
      expect(result.insights).toHaveLength(0);
      expect(result.errors).toHaveLength(0);
    });

    it("should detect patterns and generate drafts", async () => {
      // Create successful events
      for (let i = 0; i < 10; i++) {
        await insertEvent({
          group_id: testGroupId,
          event_type: "curator-pattern-test",
          agent_id: "test-agent",
          status: "completed",
          metadata: { environment: "test" },
        });
      }

      const result = await runCurator({
        group_id: testGroupId,
        min_frequency: 5,
        dry_run: true, // Don't create in Neo4j
      });

      expect(result.patterns_detected).toBeGreaterThanOrEqual(1);
      expect(result.drafts_generated).toBeGreaterThanOrEqual(1);
      expect(result.dry_run).toBe(true);
    });

    it("should respect tenant isolation", async () => {
      // Create events in test group
      for (let i = 0; i < 5; i++) {
        await insertEvent({
          group_id: testGroupId,
          event_type: "tenant-isolated-curator",
          agent_id: "test-agent",
          status: "completed",
        });
      }

      // Create events in other group
      for (let i = 0; i < 5; i++) {
        await insertEvent({
          group_id: "other-curator-group",
          event_type: "other-tenant-curator",
          agent_id: "test-agent",
          status: "completed",
        });
      }

      const result = await runCurator({
        group_id: testGroupId,
        min_frequency: 1,
        dry_run: true,
      });

      expect(result.group_id).toBe(testGroupId);
      expect(result.patterns_detected).toBeGreaterThanOrEqual(1);
    });

    it("should filter by confidence", async () => {
      // High confidence pattern
      for (let i = 0; i < 20; i++) {
        await insertEvent({
          group_id: testGroupId,
          event_type: "high-conf-curator",
          agent_id: "test-agent",
          status: "completed",
        });
      }

      // Low confidence pattern (few events)
      for (let i = 0; i < 3; i++) {
        await insertEvent({
          group_id: testGroupId,
          event_type: "low-conf-curator",
          agent_id: "test-agent",
          status: "completed",
        });
      }

      const result = await runCurator({
        group_id: testGroupId,
        min_frequency: 5,
        min_confidence: 0.5,
        dry_run: true,
      });

      // Should only include high confidence pattern
      expect(result.drafts_generated).toBe(1);
    });
  });

  // =========================================================================
  // previewDrafts Tests
  // =========================================================================

  describe("previewDrafts", () => {
    it("should return drafts without creating insights", async () => {
      for (let i = 0; i < 10; i++) {
        await insertEvent({
          group_id: testGroupId,
          event_type: "preview-test",
          agent_id: "test-agent",
          status: "completed",
        });
      }

      const result = await previewDrafts({
        group_id: testGroupId,
        min_frequency: 5,
      });

      expect(result.dry_run).toBe(true);
      expect(result.insights).toHaveLength(0);
      expect(result.drafts_created).toBe(0);
    });
  });

  // =========================================================================
  // getCuratorStatistics Tests
  // =========================================================================

  describe("getCuratorStatistics", () => {
    it("should return statistics for group", async () => {
      for (let i = 0; i < 10; i++) {
        await insertEvent({
          group_id: testGroupId,
          event_type: "stats-test-curator",
          agent_id: "test-agent",
          status: "completed",
        });
      }

      const stats = await getCuratorStatistics(testGroupId);

      expect(stats.total_events).toBeGreaterThanOrEqual(10);
    });
  });

  // =========================================================================
  // formatCuratorResult Tests
  // =========================================================================

  describe("formatCuratorResult", () => {
    it("should format result for logging", () => {
      const result = {
        group_id: "test-group",
        patterns_detected: 5,
        drafts_generated: 3,
        drafts_created: 3,
        insights: [],
        summaries: ["Pattern 1", "Pattern 2", "Pattern 3"],
        avg_quality: 0.85,
        timestamp: new Date("2024-01-15T12:00:00Z"),
        errors: [],
        dry_run: false,
      };

      const formatted = formatCuratorResult(result);

      expect(formatted).toContain("test-group");
      expect(formatted).toContain("Patterns detected: 5");
      expect(formatted).toContain("Drafts generated: 3");
      expect(formatted).toContain("Average quality: 0.85");
    });

    it("should include errors in formatted output", () => {
      const result = {
        group_id: "test-group",
        patterns_detected: 0,
        drafts_generated: 0,
        drafts_created: 0,
        insights: [],
        summaries: [],
        avg_quality: 0,
        timestamp: new Date(),
        errors: ["Connection failed", "Query timeout"],
        dry_run: false,
      };

      const formatted = formatCuratorResult(result);

      expect(formatted).toContain("Errors:");
      expect(formatted).toContain("Connection failed");
      expect(formatted).toContain("Query timeout");
    });
  });

  // =========================================================================
  // runCuratorBatch Tests
  // =========================================================================

  describe("runCuratorBatch", () => {
    it("should run curator for multiple groups", async () => {
      // Create events for first group
      for (let i = 0; i < 5; i++) {
        await insertEvent({
          group_id: "batch-group-1",
          event_type: "batch-test-1",
          agent_id: "test-agent",
          status: "completed",
        });
      }

      // Create events for second group
      for (let i = 0; i < 5; i++) {
        await insertEvent({
          group_id: "batch-group-2",
          event_type: "batch-test-2",
          agent_id: "test-agent",
          status: "completed",
        });
      }

      const results = await runCuratorBatch(["batch-group-1", "batch-group-2"], {
        min_frequency: 1,
        dry_run: true,
      });

      expect(results).toHaveLength(2);
      expect(results[0].group_id).toBe("batch-group-1");
      expect(results[1].group_id).toBe("batch-group-2");
    });
  });
});