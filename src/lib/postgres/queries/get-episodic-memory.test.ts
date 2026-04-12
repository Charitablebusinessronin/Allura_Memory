import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import {
  getEpisodicMemory,
  getWorkingMemoryContext,
  getEventsAfterParent,
  getEventsByTimeWindow,
  getRecentEvents,
  getEventById,
  QueryError,
  type EpisodicQueryParams,
} from "./get-episodic-memory";
import { getPool, closePool } from "../connection";
import { insertEvent, type EventInsert } from "./insert-trace";

/**
 * Test suite for episodic memory retrieval
 * Tests tenant isolation, time windows, pagination, and summary formatting
 * Requires a running PostgreSQL instance.
 * Run with: RUN_E2E_TESTS=true bun vitest run src/lib/postgres/queries/get-episodic-memory.test.ts
 */
const shouldRunE2E = process.env.RUN_E2E_TESTS === "true";

describe.skipIf(!shouldRunE2E)("get-episodic-memory", () => {
  // Test data
  const testGroupId = "allura-test-episodic-group";
  const otherGroupId = "allura-other-group-isolation-test";
  const testAgentId = "test-agent-001";
  const testWorkflowId = "test-workflow-001";

  // Store event IDs created during tests
  let eventIds: number[] = [];

  beforeAll(async () => {
    // Ensure environment is configured for tests
    process.env.POSTGRES_HOST = process.env.POSTGRES_HOST || "localhost";
    process.env.POSTGRES_PORT = process.env.POSTGRES_PORT || "5432";
    process.env.POSTGRES_DB = process.env.POSTGRES_DB || "memory";
    process.env.POSTGRES_USER = process.env.POSTGRES_USER || "ronin4life";
    process.env.POSTGRES_PASSWORD = process.env.POSTGRES_PASSWORD || "KaminaTHC*";

    // Ensure schema is applied
    const pool = getPool();

    // Clean up any previous test data
    await pool.query("DELETE FROM events WHERE group_id = $1 OR group_id = $2", [
      testGroupId,
      otherGroupId,
    ]);
  });

  afterAll(async () => {
    // Clean up test data
    const pool = getPool();
    await pool.query("DELETE FROM events WHERE group_id = $1 OR group_id = $2", [
      testGroupId,
      otherGroupId,
    ]);
    await closePool();
  });

  beforeEach(async () => {
    // Reset event IDs for each test
    eventIds = [];
  });

  /**
   * Helper to create test events
   */
  async function createTestEvent(
    overrides: Partial<EventInsert> = {}
  ): Promise<number> {
    const event = await insertEvent({
      group_id: testGroupId,
      event_type: "test_event",
      agent_id: testAgentId,
      ...overrides,
    });
    eventIds.push(event.id);
    return event.id;
  }

  // =========================================================================
  // Validation Tests
  // =========================================================================

  describe("validation", () => {
    it("should require group_id", async () => {
      const params = {} as EpisodicQueryParams;

      await expect(getEpisodicMemory(params)).rejects.toThrow(QueryError);
      await expect(getEpisodicMemory(params)).rejects.toThrow(
        "group_id is required"
      );
    });

    it("should reject empty group_id", async () => {
      const params: EpisodicQueryParams = { group_id: "" };

      await expect(getEpisodicMemory(params)).rejects.toThrow(
        "group_id is required"
      );
    });

    it("should reject whitespace-only group_id", async () => {
      const params: EpisodicQueryParams = { group_id: "   " };

      await expect(getEpisodicMemory(params)).rejects.toThrow(
        "group_id is required"
      );
    });

    it("should reject negative offset", async () => {
      const params: EpisodicQueryParams = {
        group_id: testGroupId,
        offset: -1,
      };

      await expect(getEpisodicMemory(params)).rejects.toThrow(
        "offset must be a non-negative number"
      );
    });

    it("should reject limit less than 1", async () => {
      const params: EpisodicQueryParams = {
        group_id: testGroupId,
        limit: 0,
      };

      await expect(getEpisodicMemory(params)).rejects.toThrow(
        "limit must be a positive number"
      );
    });

    it("should reject since > until", async () => {
      const now = new Date();
      const past = new Date(now.getTime() - 10000);

      const params: EpisodicQueryParams = {
        group_id: testGroupId,
        since: now,
        until: past,
      };

      await expect(getEpisodicMemory(params)).rejects.toThrow(
        "since must be before until"
      );
    });
  });

  // =========================================================================
  // Tenant Isolation Tests
  // =========================================================================

  describe("tenant isolation", () => {
    it("should only return events for specified group_id", async () => {
      // Create events for different groups
      await createTestEvent({ group_id: testGroupId });
      const otherEvent = await insertEvent({
        group_id: otherGroupId,
        event_type: "other_event",
        agent_id: testAgentId,
      });
      eventIds.push(otherEvent.id);

      const result = await getEpisodicMemory({ group_id: testGroupId });

      expect(result.items.length).toBe(1);
      expect(result.items[0].group_id).toBe(testGroupId);
      expect(result.items[0].id).not.toBe(otherEvent.id);
    });

    it("should return empty for non-existent group_id", async () => {
      const result = await getEpisodicMemory({
        group_id: "allura-non-existent-group",
      });

      expect(result.items).toHaveLength(0);
      expect(result.total).toBe(0);
    });

    it("should not leak data between tenants in working memory context", async () => {
      // Create events for different groups
      await createTestEvent({ group_id: testGroupId, event_type: "group1_event" });
      await insertEvent({
        group_id: otherGroupId,
        event_type: "group2_event",
        agent_id: testAgentId,
      });

      const context = await getWorkingMemoryContext({ group_id: testGroupId });

      expect(context.recent_events.every((e) => e.group_id === testGroupId)).toBe(true);
      expect(context.context.group_id).toBe(testGroupId);
    });

    it("should not return event from another tenant when querying by ID", async () => {
      const otherEvent = await insertEvent({
        group_id: otherGroupId,
        event_type: "other_event",
        agent_id: testAgentId,
      });
      eventIds.push(otherEvent.id);

      const result = await getEventById(otherEvent.id, testGroupId);

      expect(result).toBeNull();
    });
  });

  // =========================================================================
  // Time Window Tests
  // =========================================================================

  describe("time window filtering", () => {
    it("should filter events by since parameter", async () => {
      // Create events at different times
      await createTestEvent({ event_type: "old_event" });

      // Wait a bit
      await new Promise((resolve) => setTimeout(resolve, 100));

      const newEventId = await createTestEvent({ event_type: "new_event" });

      // Query for events after the pause
      const since = new Date(Date.now() - 50);
      const result = await getEpisodicMemory({
        group_id: testGroupId,
        since,
      });

      // Should only get the new event
      expect(result.items.some((e) => e.id === newEventId)).toBe(true);
      expect(result.items.every((e) => e.created_at >= since)).toBe(true);
    });

    it("should filter events by until parameter", async () => {
      // Create old event
      const oldEventId = await createTestEvent({ event_type: "old_event" });

      // Wait
      await new Promise((resolve) => setTimeout(resolve, 100));

      // Create new event
      await createTestEvent({ event_type: "new_event" });

      // Query for events before the pause
      const until = new Date(Date.now() - 50);
      const result = await getEpisodicMemory({
        group_id: testGroupId,
        until,
      });

      // Should only get the old event
      expect(result.items.some((e) => e.id === oldEventId)).toBe(true);
      expect(result.items.every((e) => e.created_at <= until)).toBe(true);
    });

    it("should support both since and until together", async () => {
      // Create events before window
      await createTestEvent({ event_type: "before_window" });

      await new Promise((resolve) => setTimeout(resolve, 50));
      const windowStart = new Date();

      // Create events in window
      await createTestEvent({ event_type: "in_window_1" });
      await createTestEvent({ event_type: "in_window_2" });

      await new Promise((resolve) => setTimeout(resolve, 50));
      const windowEnd = new Date();

      // Create events after window
      await createTestEvent({ event_type: "after_window" });

      const result = await getEpisodicMemory({
        group_id: testGroupId,
        since: windowStart,
        until: windowEnd,
      });

      expect(result.items).toHaveLength(2);
      expect(result.items.every((e) => e.event_type.startsWith("in_window"))).toBe(true);
    });

    it("should return correct time range in working memory context", async () => {
      // Create some events
      await createTestEvent();
      await createTestEvent();

      const context = await getWorkingMemoryContext({ group_id: testGroupId });

      expect(context.time_range.earliest).toBeInstanceOf(Date);
      expect(context.time_range.latest).toBeInstanceOf(Date);
      expect(context.time_range.earliest!.getTime()).toBeLessThanOrEqual(
        context.time_range.latest!.getTime()
      );
    });
  });

  // =========================================================================
  // Pagination Tests
  // =========================================================================

  describe("pagination", () => {
    beforeEach(async () => {
      // Create multiple events for pagination testing
      for (let i = 0; i < 15; i++) {
        await createTestEvent({ event_type: `paginated_event_${i}` });
      }
    });

    it("should respect limit parameter", async () => {
      const result = await getEpisodicMemory({
        group_id: testGroupId,
        limit: 5,
      });

      expect(result.items).toHaveLength(5);
      expect(result.limit).toBe(5);
    });

    it("should use default limit of 100", async () => {
      const result = await getEpisodicMemory({
        group_id: testGroupId,
      });

      expect(result.limit).toBe(100);
    });

    it("should respect offset parameter", async () => {
      const result1 = await getEpisodicMemory({
        group_id: testGroupId,
        limit: 5,
        offset: 0,
      });

      const result2 = await getEpisodicMemory({
        group_id: testGroupId,
        limit: 5,
        offset: 5,
      });

      // Results should be different (no overlap)
      const ids1 = result1.items.map((e) => e.id);
      const ids2 = result2.items.map((e) => e.id);
      const overlap = ids1.some((id) => ids2.includes(id));
      expect(overlap).toBe(false);
    });

    it("should return correct has_more flag", async () => {
      const result1 = await getEpisodicMemory({
        group_id: testGroupId,
        limit: 5,
        offset: 0,
      });

      // Should have more since we created 15 events
      expect(result1.has_more).toBe(true);
      expect(result1.total).toBeGreaterThanOrEqual(15);

      const result2 = await getEpisodicMemory({
        group_id: testGroupId,
        limit: 100,
        offset: 0,
      });

      // Should not have more when limit >= total
      expect(result2.has_more).toBe(false);
    });

    it("should return total count regardless of pagination", async () => {
      const result1 = await getEpisodicMemory({
        group_id: testGroupId,
        limit: 1,
        offset: 0,
      });

      const result2 = await getEpisodicMemory({
        group_id: testGroupId,
        limit: 5,
        offset: 5,
      });

      // Total should be consistent across different pagination params
      expect(result1.total).toBe(result2.total);
    });
  });

  // =========================================================================
  // Filtering Tests
  // =========================================================================

  describe("filtering", () => {
    beforeEach(async () => {
      // Create events with different attributes
      await createTestEvent({
        event_type: "type_a",
        agent_id: "agent_1",
        workflow_id: "workflow_1",
        status: "completed",
      });
      await createTestEvent({
        event_type: "type_b",
        agent_id: "agent_2",
        workflow_id: "workflow_1",
        status: "failed",
      });
      await createTestEvent({
        event_type: "type_a",
        agent_id: "agent_1",
        workflow_id: "workflow_2",
        status: "pending",
      });
    });

    it("should filter by agent_id", async () => {
      const result = await getEpisodicMemory({
        group_id: testGroupId,
        agent_id: "agent_1",
      });

      expect(result.items.every((e) => e.agent_id === "agent_1")).toBe(true);
    });

    it("should filter by workflow_id", async () => {
      const result = await getEpisodicMemory({
        group_id: testGroupId,
        workflow_id: "workflow_1",
      });

      expect(result.items.every((e) => e.workflow_id === "workflow_1")).toBe(true);
    });

    it("should filter by event_type", async () => {
      const result = await getEpisodicMemory({
        group_id: testGroupId,
        event_type: "type_a",
      });

      expect(result.items.every((e) => e.event_type === "type_a")).toBe(true);
    });

    it("should filter by status", async () => {
      const result = await getEpisodicMemory({
        group_id: testGroupId,
        status: "completed",
      });

      expect(result.items.every((e) => e.status === "completed")).toBe(true);
    });

    it("should support combined filters", async () => {
      const result = await getEpisodicMemory({
        group_id: testGroupId,
        agent_id: "agent_1",
        event_type: "type_a",
        status: "completed",
      });

      expect(result.items.every((e) => 
        e.agent_id === "agent_1" &&
        e.event_type === "type_a" &&
        e.status === "completed"
      )).toBe(true);
    });
  });

  // =========================================================================
  // Summary Formatting Tests
  // =========================================================================

  describe("summary formatting", () => {
    it("should return event summaries with all required fields", async () => {
      await createTestEvent({
        event_type: "summary_test",
        metadata: { key: "value", count: 42 },
        outcome: { result: "success" },
      });

      const result = await getEpisodicMemory({ group_id: testGroupId });

      expect(result.items.length).toBeGreaterThan(0);
      const event = result.items[0];

      // Required fields
      expect(event.id).toBeDefined();
      expect(event.group_id).toBe(testGroupId);
      expect(event.event_type).toBeDefined();
      expect(event.created_at).toBeInstanceOf(Date);
      expect(event.agent_id).toBeDefined();
      expect(event.status).toBeDefined();

      // Summary fields
      expect(event.metadata_summary).toBeDefined();
      expect(event.outcome_summary).toBeDefined();
    });

    it("should truncate large metadata in summary", async () => {
      // Create event with large metadata
      const largeMetadata: Record<string, unknown> = {};
      for (let i = 0; i < 100; i++) {
        largeMetadata[`key_${i}`] = `value_${i}`.repeat(20);
      }

      await createTestEvent({
        event_type: "large_metadata_test",
        metadata: largeMetadata,
      });

      const result = await getEpisodicMemory({ group_id: testGroupId });
      const event = result.items.find((e) => e.event_type === "large_metadata_test");

      expect(event).toBeDefined();
      expect(event?.metadata_summary.__truncated).toBe(true);
      expect(typeof event?.metadata_summary.__original_size).toBe("number");
    });

    it("should include error fields for failed events", async () => {
      await createTestEvent({
        event_type: "failed_test",
        status: "failed",
        error_message: "Something went wrong",
        error_code: "ERR_001",
      });

      const result = await getEpisodicMemory({ group_id: testGroupId });
      const event = result.items.find((e) => e.event_type === "failed_test");

      expect(event).toBeDefined();
      expect(event?.status).toBe("failed");
      expect(event?.error_message).toBe("Something went wrong");
      expect(event?.error_code).toBe("ERR_001");
    });
  });

  // =========================================================================
  // Convenience Functions Tests
  // =========================================================================

  describe("convenience functions", () => {
    beforeEach(async () => {
      for (let i = 0; i < 5; i++) {
        await createTestEvent({ event_type: `recent_${i}` });
      }
    });

    it("getRecentEvents should return most recent events", async () => {
      const events = await getRecentEvents(testGroupId, 3);

      expect(events).toHaveLength(3);
      // Should be ordered by created_at DESC
      expect(events[0].created_at.getTime()).toBeGreaterThanOrEqual(
        events[events.length - 1].created_at.getTime()
      );
    });

    it("getEventById should return single event", async () => {
      const id = await createTestEvent({ event_type: "single_fetch" });
      const event = await getEventById(id, testGroupId);

      expect(event).not.toBeNull();
      expect(event?.id).toBe(id);
      expect(event?.event_type).toBe("single_fetch");
    });

    it("getEventsAfterParent should return events after specified ID", async () => {
      // Create parent event
      const parentId = await createTestEvent({ event_type: "parent" });

      // Create child events
      const child1 = await createTestEvent({ event_type: "child_1" });
      const child2 = await createTestEvent({ event_type: "child_2" });

      const events = await getEventsAfterParent(parentId, { group_id: testGroupId });

      // Should include events created after parent
      expect(events.some((e) => e.id === child1)).toBe(true);
      expect(events.some((e) => e.id === child2)).toBe(true);

      // Should not include parent
      expect(events.every((e) => e.id !== parentId)).toBe(true);
    });

    it("getEventsByTimeWindow should filter by time range", async () => {
      const since = new Date(Date.now() - 60000); // 1 minute ago
      const until = new Date();

      const events = await getEventsByTimeWindow(
        { group_id: testGroupId },
        since,
        until,
        10
      );

      expect(events.every((e) => e.created_at >= since)).toBe(true);
      expect(events.every((e) => e.created_at <= until)).toBe(true);
    });
  });

  // =========================================================================
  // Working Memory Context Tests
  // =========================================================================

  describe("working memory context", () => {
    beforeEach(async () => {
      for (let i = 0; i < 15; i++) {
        await createTestEvent({ event_type: `context_${i}` });
      }
    });

    it("should return context with recent events", async () => {
      const context = await getWorkingMemoryContext(
        { group_id: testGroupId },
        5
      );

      expect(context.recent_events.length).toBeLessThanOrEqual(5);
      expect(context.total_count).toBeGreaterThanOrEqual(15);
      expect(context.context.group_id).toBe(testGroupId);
    });

    it("should include agent and workflow in context if provided", async () => {
      const context = await getWorkingMemoryContext({
        group_id: testGroupId,
        agent_id: testAgentId,
        workflow_id: testWorkflowId,
      });

      expect(context.context.agent_id).toBe(testAgentId);
      expect(context.context.workflow_id).toBe(testWorkflowId);
    });

    it("should return ordered events (most recent first)", async () => {
      const context = await getWorkingMemoryContext(
        { group_id: testGroupId },
        10
      );

      for (let i = 1; i < context.recent_events.length; i++) {
        expect(
          context.recent_events[i - 1].created_at.getTime()
        ).toBeGreaterThanOrEqual(
          context.recent_events[i].created_at.getTime()
        );
      }
    });
  });

  // =========================================================================
  // Edge Cases Tests
  // =========================================================================

  describe("edge cases", () => {
    it("should handle empty result set", async () => {
      const result = await getEpisodicMemory({
        group_id: "allura-non-existent-group",
      });

      expect(result.items).toHaveLength(0);
      expect(result.total).toBe(0);
      expect(result.has_more).toBe(false);
    });

    it("should handle large offset (beyond data)", async () => {
      const result = await getEpisodicMemory({
        group_id: testGroupId,
        limit: 10,
        offset: 999999,
      });

      expect(result.items).toHaveLength(0);
      expect(result.total).toBeGreaterThan(0); // Total should still reflect actual count
    });

    it("should handle null workflow_id in results", async () => {
      await createTestEvent({
        workflow_id: undefined, // Will be null in DB
      });

      const result = await getEpisodicMemory({ group_id: testGroupId });
      const event = result.items.find((e) => e.workflow_id === null);

      expect(event).toBeDefined();
    });

    it("should handle null parent_event_id", async () => {
      await createTestEvent({
        parent_event_id: undefined,
      });

      const result = await getEpisodicMemory({ group_id: testGroupId });
      const event = result.items.find((e) => e.parent_event_id === null);

      expect(event).toBeDefined();
    });
  });
});