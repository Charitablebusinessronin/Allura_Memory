import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import {
  detectPatterns,
  getPatternByEventType,
  getEventTypes,
  getPatternStats,
  PatternDetectionError,
} from "./pattern-detector";
import { getPool, closePool } from "../postgres/connection";
import { insertEvent, type EventInsert } from "../postgres/queries/insert-trace";

describe("pattern-detector", () => {
  const testGroupId = "pattern-detector-test";
  const otherGroupId = "other-pattern-group";

  beforeAll(async () => {
    process.env.POSTGRES_HOST = process.env.POSTGRES_HOST || "localhost";
    process.env.POSTGRES_PORT = process.env.POSTGRES_PORT || "5432";
    process.env.POSTGRES_DB = process.env.POSTGRES_DB || "memory";
    process.env.POSTGRES_USER = process.env.POSTGRES_USER || "ronin4life";
    process.env.POSTGRES_PASSWORD = process.env.POSTGRES_PASSWORD || "KaminaTHC*";

    const pool = getPool();
    await pool.query("DELETE FROM events WHERE group_id = $1 OR group_id = $2", [testGroupId, otherGroupId]);
  });

  afterAll(async () => {
    const pool = getPool();
    await pool.query("DELETE FROM events WHERE group_id = $1 OR group_id = $2", [testGroupId, otherGroupId]);
    await closePool();
  });

  beforeEach(async () => {
    const pool = getPool();
    await pool.query("DELETE FROM events WHERE group_id = $1", [testGroupId]);
  });

  // =========================================================================
  // Validation Tests
  // =========================================================================

  describe("validation", () => {
    it("should require group_id", async () => {
      await expect(detectPatterns({} as { group_id: string })).rejects.toThrow(
        PatternDetectionError
      );
      await expect(detectPatterns({ group_id: "" })).rejects.toThrow("group_id is required");
    });

    it("should reject empty group_id", async () => {
      await expect(detectPatterns({ group_id: "   " })).rejects.toThrow("group_id is required");
    });
  });

  // =========================================================================
  // Pattern Detection Tests
  // =========================================================================

  describe("detectPatterns", () => {
    it("should return empty array for group with no events", async () => {
      const patterns = await detectPatterns({ group_id: "empty-group-test" });
      expect(patterns).toHaveLength(0);
    });

    it("should detect patterns from successful events", async () => {
      // Create successful events
      for (let i = 0; i < 5; i++) {
        await insertEvent({
          group_id: testGroupId,
          event_type: "successful-task",
          agent_id: "test-agent",
          status: "completed",
          outcome: { result: "success" },
        });
      }

      const patterns = await detectPatterns({
        group_id: testGroupId,
        min_frequency: 1,
      });

      expect(patterns.length).toBeGreaterThanOrEqual(1);
      const taskPattern = patterns.find((p) => p.event_type === "successful-task");
      expect(taskPattern).toBeDefined();
      expect(taskPattern?.frequency).toBe(5);
      expect(taskPattern?.success_rate).toBe(1.0);
    });

    it("should filter by minimum frequency", async () => {
      // Create events with different frequencies
      for (let i = 0; i < 10; i++) {
        await insertEvent({
          group_id: testGroupId,
          event_type: "frequent-event",
          agent_id: "test-agent",
          status: "completed",
        });
      }

      for (let i = 0; i < 2; i++) {
        await insertEvent({
          group_id: testGroupId,
          event_type: "rare-event",
          agent_id: "test-agent",
          status: "completed",
        });
      }

      const patterns = await detectPatterns({
        group_id: testGroupId,
        min_frequency: 5,
      });

      expect(patterns.some((p) => p.event_type === "frequent-event")).toBe(true);
      expect(patterns.some((p) => p.event_type === "rare-event")).toBe(false);
    });

    it("should filter by minimum success rate", async () => {
      // Create successful events
      for (let i = 0; i < 8; i++) {
        await insertEvent({
          group_id: testGroupId,
          event_type: "mostly-successful",
          agent_id: "test-agent",
          status: "completed",
        });
      }

      // Create failed events
      for (let i = 0; i < 2; i++) {
        await insertEvent({
          group_id: testGroupId,
          event_type: "mostly-successful",
          agent_id: "test-agent",
          status: "failed",
        });
      }

      // Create low success rate events
      for (let i = 0; i < 2; i++) {
        await insertEvent({
          group_id: testGroupId,
          event_type: "mostly-failed",
          agent_id: "test-agent",
          status: "completed",
        });
      }

      for (let i = 0; i < 8; i++) {
        await insertEvent({
          group_id: testGroupId,
          event_type: "mostly-failed",
          agent_id: "test-agent",
          status: "failed",
        });
      }

      const patterns = await detectPatterns({
        group_id: testGroupId,
        min_frequency: 1,
        min_success_rate: 0.7,
      });

      expect(patterns.some((p) => p.event_type === "mostly-successful")).toBe(true);
      expect(patterns.some((p) => p.event_type === "mostly-failed")).toBe(false);
    });

    it("should respect tenant isolation", async () => {
      // Create events in test group
      for (let i = 0; i < 5; i++) {
        await insertEvent({
          group_id: testGroupId,
          event_type: "tenant-isolated",
          agent_id: "test-agent",
          status: "completed",
        });
      }

      // Create events in other group
      for (let i = 0; i < 5; i++) {
        await insertEvent({
          group_id: otherGroupId,
          event_type: "other-tenant",
          agent_id: "test-agent",
          status: "completed",
        });
      }

      const patterns = await detectPatterns({
        group_id: testGroupId,
        min_frequency: 1,
      });

      expect(patterns.every((p) => p.group_id === testGroupId)).toBe(true);
      expect(patterns.some((p) => p.event_type === "tenant-isolated")).toBe(true);
      expect(patterns.some((p) => p.event_type === "other-tenant")).toBe(false);
    });

    it("should extract metadata patterns", async () => {
      // Create events with consistent metadata
      for (let i = 0; i < 10; i++) {
        await insertEvent({
          group_id: testGroupId,
          event_type: "metadata-test",
          agent_id: "test-agent",
          status: "completed",
          metadata: {
            environment: "production",
            region: "us-east-1",
            iteration: i,
          },
        });
      }

      const patterns = await detectPatterns({
        group_id: testGroupId,
        min_frequency: 1,
      });

      const metadataPattern = patterns.find((p) => p.event_type === "metadata-test");
      expect(metadataPattern).toBeDefined();
      expect(metadataPattern?.metadata_patterns.environment).toBe("production");
      expect(metadataPattern?.metadata_patterns.region).toBe("us-east-1");
    });

    it("should calculate confidence based on frequency and success rate", async () => {
      // High frequency, high success rate
      for (let i = 0; i < 100; i++) {
        await insertEvent({
          group_id: testGroupId,
          event_type: "high-confidence",
          agent_id: "test-agent",
          status: "completed",
        });
      }

      // Low frequency, low success rate
      for (let i = 0; i < 5; i++) {
        await insertEvent({
          group_id: testGroupId,
          event_type: "low-confidence",
          agent_id: "test-agent",
          status: i < 2 ? "completed" : "failed",
        });
      }

      const patterns = await detectPatterns({
        group_id: testGroupId,
        min_frequency: 1,
      });

      const highConf = patterns.find((p) => p.event_type === "high-confidence");
      const lowConf = patterns.find((p) => p.event_type === "low-confidence");

      expect(highConf?.confidence).toBeGreaterThan(lowConf?.confidence ?? 0);
    });
  });

  // =========================================================================
  // getPatternByEventType Tests
  // =========================================================================

  describe("getPatternByEventType", () => {
    it("should return pattern for existing event type", async () => {
      for (let i = 0; i < 5; i++) {
        await insertEvent({
          group_id: testGroupId,
          event_type: "specific-pattern",
          agent_id: "test-agent",
          status: "completed",
        });
      }

      const pattern = await getPatternByEventType(testGroupId, "specific-pattern");

      expect(pattern).toBeDefined();
      expect(pattern?.event_type).toBe("specific-pattern");
      expect(pattern?.frequency).toBe(5);
    });

    it("should return null for non-existent event type", async () => {
      const pattern = await getPatternByEventType(testGroupId, "non-existent-type");
      expect(pattern).toBeNull();
    });
  });

  // =========================================================================
  // getEventTypes Tests
  // =========================================================================

  describe("getEventTypes", () => {
    it("should return event types with counts", async () => {
      for (let i = 0; i < 10; i++) {
        await insertEvent({
          group_id: testGroupId,
          event_type: "type-a",
          agent_id: "test-agent",
        });
      }

      for (let i = 0; i < 5; i++) {
        await insertEvent({
          group_id: testGroupId,
          event_type: "type-b",
          agent_id: "test-agent",
        });
      }

      const types = await getEventTypes(testGroupId);

      expect(types.some((t) => t.event_type === "type-a" && t.count === 10)).toBe(true);
      expect(types.some((t) => t.event_type === "type-b" && t.count === 5)).toBe(true);
    });

    it("should respect limit parameter", async () => {
      for (let i = 0; i < 5; i++) {
        await insertEvent({
          group_id: testGroupId,
          event_type: `type-${i}`,
          agent_id: "test-agent",
        });
      }

      const types = await getEventTypes(testGroupId, 2);
      expect(types.length).toBeLessThanOrEqual(2);
    });
  });

  // =========================================================================
  // getPatternStats Tests
  // =========================================================================

  describe("getPatternStats", () => {
    it("should return statistics for patterns", async () => {
      for (let i = 0; i < 10; i++) {
        await insertEvent({
          group_id: testGroupId,
          event_type: "stats-test",
          agent_id: "test-agent",
          status: i < 8 ? "completed" : "failed",
        });
      }

      const stats = await getPatternStats(testGroupId);

      expect(stats.total_patterns).toBeGreaterThanOrEqual(1);
      expect(stats.total_events).toBeGreaterThanOrEqual(10);
      expect(stats.avg_success_rate).toBeGreaterThanOrEqual(0);
      expect(stats.top_event_types).toContain("stats-test");
    });
  });
});