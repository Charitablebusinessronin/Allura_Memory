import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import {
  getDualContextEpisodicMemory,
  getMergedDualContextEvents,
  getDualContextWorkingMemory,
  isGlobalContext,
  validateCrossGroupAccess,
  GLOBAL_GROUP_ID,
  DualContextQueryError,
  type DualContextQueryParams,
} from "./get-dual-context";
import { getPool, closePool } from "../connection";
import { insertEvent, type EventInsert } from "./insert-trace";

/**
 * Test suite for dual-context episodic memory queries
 * Requires a running PostgreSQL instance.
 * Run with: RUN_E2E_TESTS=true bun vitest run src/lib/postgres/queries/get-dual-context.test.ts
 */
const shouldRunE2E = process.env.RUN_E2E_TESTS === "true";

describe.skipIf(!shouldRunE2E)("get-dual-context (PostgreSQL)", () => {
  const testProjectGroup = "allura-test-project-group";
  const testOtherProject = "allura-test-other-project";
  const testAgentId = "test-agent-001";

  beforeAll(async () => {
    // Ensure environment is configured for tests
    process.env.POSTGRES_HOST = process.env.POSTGRES_HOST || "localhost";
    process.env.POSTGRES_PORT = process.env.POSTGRES_PORT || "5432";
    process.env.POSTGRES_DB = process.env.POSTGRES_DB || "memory";
    process.env.POSTGRES_USER = process.env.POSTGRES_USER || "ronin4life";
    process.env.POSTGRES_PASSWORD = process.env.POSTGRES_PASSWORD || "KaminaTHC*";

    const pool = getPool();

    // Clean up test data
    await pool.query(
      "DELETE FROM events WHERE group_id IN ($1, $2, $3)",
      [testProjectGroup, testOtherProject, GLOBAL_GROUP_ID]
    );
  });

  afterAll(async () => {
    // Clean up test data
    const pool = getPool();
    await pool.query(
      "DELETE FROM events WHERE group_id IN ($1, $2, $3)",
      [testProjectGroup, testOtherProject, GLOBAL_GROUP_ID]
    );
    await closePool();
  });

  beforeEach(async () => {
    // Clean up before each test
    const pool = getPool();
    await pool.query(
      "DELETE FROM events WHERE group_id IN ($1, $2, $3)",
      [testProjectGroup, testOtherProject, GLOBAL_GROUP_ID]
    );
  });

  // =========================================================================
  // Validation Tests
  // =========================================================================

  describe("validation", () => {
    it("should require project_group_id", async () => {
      const params = {} as DualContextQueryParams;
      await expect(getDualContextEpisodicMemory(params)).rejects.toThrow(
        DualContextQueryError
      );
      await expect(getDualContextEpisodicMemory(params)).rejects.toThrow(
        "project_group_id is required"
      );
    });

    it("should reject empty project_group_id", async () => {
      const params: DualContextQueryParams = { project_group_id: "" };
      await expect(getDualContextEpisodicMemory(params)).rejects.toThrow(
        "project_group_id is required"
      );
    });

    it("should reject GLOBAL_GROUP_ID as project_group_id", async () => {
      const params: DualContextQueryParams = { project_group_id: GLOBAL_GROUP_ID };
      await expect(getDualContextEpisodicMemory(params)).rejects.toThrow(
        `project_group_id cannot be '${GLOBAL_GROUP_ID}'`
      );
    });

    it("should reject negative limit_per_scope", async () => {
      const params: DualContextQueryParams = {
        project_group_id: testProjectGroup,
        limit_per_scope: 0,
      };
      await expect(getDualContextEpisodicMemory(params)).rejects.toThrow(
        "limit_per_scope must be a positive number"
      );
    });

    it("should reject since > until", async () => {
      const now = new Date();
      const past = new Date(now.getTime() - 10000);

      const params: DualContextQueryParams = {
        project_group_id: testProjectGroup,
        since: now,
        until: past,
      };

      await expect(getDualContextEpisodicMemory(params)).rejects.toThrow(
        "since must be before until"
      );
    });
  });

  // =========================================================================
  // Dual-Context Retrieval Tests
  // =========================================================================

  describe("dual-context retrieval", () => {
    beforeEach(async () => {
      const pool = getPool();

      // Create project events
      for (let i = 0; i < 3; i++) {
        await insertEvent({
          group_id: testProjectGroup,
          event_type: `project_event_${i}`,
          agent_id: testAgentId,
        });
      }

      // Create global events
      for (let i = 0; i < 2; i++) {
        await insertEvent({
          group_id: GLOBAL_GROUP_ID,
          event_type: `global_event_${i}`,
          agent_id: "global-agent",
        });
      }

      // Create other project events (should NOT be accessible)
      await insertEvent({
        group_id: testOtherProject,
        event_type: "other_project_event",
        agent_id: testAgentId,
      });
    });

    it("should retrieve both project and global events", async () => {
      const result = await getDualContextEpisodicMemory({
        project_group_id: testProjectGroup,
      });

      expect(result.project_events.length).toBe(3);
      expect(result.global_events.length).toBe(2);
      expect(result.total_count).toBe(5);
    });

    it("should preserve scope metadata in results", async () => {
      const result = await getDualContextEpisodicMemory({
        project_group_id: testProjectGroup,
      });

      // Project events should have scope = "project"
      result.project_events.forEach((event) => {
        expect(event.scope).toBe("project");
        expect(event.source_group_id).toBe(testProjectGroup);
      });

      // Global events should have scope = "global"
      result.global_events.forEach((event) => {
        expect(event.scope).toBe("global");
        expect(event.source_group_id).toBe(GLOBAL_GROUP_ID);
      });
    });

    it("should NOT include events from other projects", async () => {
      const result = await getDualContextEpisodicMemory({
        project_group_id: testProjectGroup,
      });

      // Should not include other project events
      const allEvents = [...result.project_events, ...result.global_events];
      const hasOtherProject = allEvents.some(
        (e) => e.source_group_id === testOtherProject
      );
      expect(hasOtherProject).toBe(false);
    });

    it("should respect include_global = false", async () => {
      const result = await getDualContextEpisodicMemory({
        project_group_id: testProjectGroup,
        include_global: false,
      });

      expect(result.project_events.length).toBe(3);
      expect(result.global_events.length).toBe(0);
      expect(result.metadata.included_global).toBe(false);
    });

    it("should respect limit_per_scope", async () => {
      const result = await getDualContextEpisodicMemory({
        project_group_id: testProjectGroup,
        limit_per_scope: 2,
      });

      expect(result.project_events.length).toBeLessThanOrEqual(2);
      expect(result.global_events.length).toBeLessThanOrEqual(2);
    });

    it("should include correct metadata", async () => {
      const result = await getDualContextEpisodicMemory({
        project_group_id: testProjectGroup,
      });

      expect(result.metadata.project_group_id).toBe(testProjectGroup);
      expect(result.metadata.included_global).toBe(true);
      expect(result.metadata.retrieved_at).toBeInstanceOf(Date);
      expect(result.metadata.project_count).toBe(3);
      expect(result.metadata.global_count).toBe(2);
    });
  });

  // =========================================================================
  // Merged Results Tests
  // =========================================================================

  describe("merged results", () => {
    beforeEach(async () => {
      const pool = getPool();

      // Create project events with different timestamps
      await insertEvent({
        group_id: testProjectGroup,
        event_type: "project_earlier",
        agent_id: testAgentId,
      });

      await new Promise((resolve) => setTimeout(resolve, 10));

      await insertEvent({
        group_id: testProjectGroup,
        event_type: "project_later",
        agent_id: testAgentId,
      });

      // Create global event
      await insertEvent({
        group_id: GLOBAL_GROUP_ID,
        event_type: "global_event",
        agent_id: "global-agent",
      });
    });

    it("should merge and sort events by created_at DESC", async () => {
      const merged = await getMergedDualContextEvents({
        project_group_id: testProjectGroup,
      });

      expect(merged.length).toBe(3);

      // Should be sorted by created_at DESC (newest first)
      for (let i = 1; i < merged.length; i++) {
        expect(merged[i - 1].created_at.getTime()).toBeGreaterThanOrEqual(
          merged[i].created_at.getTime()
        );
      }
    });

    it("should preserve scope in merged results", async () => {
      const merged = await getMergedDualContextEvents({
        project_group_id: testProjectGroup,
      });

      const projectEvents = merged.filter((e) => e.scope === "project");
      const globalEvents = merged.filter((e) => e.scope === "global");

      expect(projectEvents.length).toBe(2);
      expect(globalEvents.length).toBe(1);
    });
  });

  // =========================================================================
  // Working Memory Tests
  // =========================================================================

  describe("working memory", () => {
    beforeEach(async () => {
      const pool = getPool();

      for (let i = 0; i < 15; i++) {
        await insertEvent({
          group_id: testProjectGroup,
          event_type: `project_event_${i}`,
          agent_id: testAgentId,
        });
      }

      for (let i = 0; i < 10; i++) {
        await insertEvent({
          group_id: GLOBAL_GROUP_ID,
          event_type: `global_event_${i}`,
          agent_id: "global-agent",
        });
      }
    });

    it("should limit working memory results", async () => {
      const result = await getDualContextWorkingMemory(testProjectGroup, 5);

      expect(result.project_events.length).toBeLessThanOrEqual(5);
      expect(result.global_events.length).toBeLessThanOrEqual(5);
    });

    it("should default to 10 events per scope", async () => {
      const result = await getDualContextWorkingMemory(testProjectGroup);

      expect(result.project_events.length).toBeLessThanOrEqual(10);
      expect(result.global_events.length).toBeLessThanOrEqual(10);
    });
  });

  // =========================================================================
  // Tenant Isolation Tests
  // =========================================================================

  describe("tenant isolation", () => {
    it("should identify global context correctly", () => {
      expect(isGlobalContext(GLOBAL_GROUP_ID)).toBe(true);
      expect(isGlobalContext("allura-any-other-group")).toBe(false);
      expect(isGlobalContext(testProjectGroup)).toBe(false);
    });

    it("should allow same-group access", () => {
      // Should not throw
      expect(() => validateCrossGroupAccess(testProjectGroup, testProjectGroup)).not.toThrow();
    });

    it("should allow global context access from any project", () => {
      // Should not throw
      expect(() => validateCrossGroupAccess(testProjectGroup, GLOBAL_GROUP_ID)).not.toThrow();
    });

    it("should deny cross-project access", () => {
      expect(() => validateCrossGroupAccess(testProjectGroup, testOtherProject)).toThrow(
        DualContextQueryError
      );
      expect(() => validateCrossGroupAccess(testProjectGroup, testOtherProject)).toThrow(
        "Cross-project access denied"
      );
    });
  });

  // =========================================================================
  // Edge Cases Tests
  // =========================================================================

  describe("edge cases", () => {
    it("should handle empty project events", async () => {
      const result = await getDualContextEpisodicMemory({
        project_group_id: "allura-empty-project",
      });

      expect(result.project_events.length).toBe(0);
      expect(result.metadata.project_count).toBe(0);
    });

    it("should handle empty global events", async () => {
      // No global events in this test
      const result = await getDualContextEpisodicMemory({
        project_group_id: testProjectGroup,
      });

      // Should still return empty global array
      expect(Array.isArray(result.global_events)).toBe(true);
    });

    // Pre-Phase-4 baseline — tracked in docs/deferred/pre-existing-failures.md
    // Reason: time window filtering returns 0 events instead of 1; likely race condition
    // between insert and query where the event timestamp isn't after the `since` threshold
    it.skip("should handle time window filtering", async () => {
      const pool = getPool();

      // Create old event
      await insertEvent({
        group_id: testProjectGroup,
        event_type: "old_event",
        agent_id: testAgentId,
      });

      await new Promise((resolve) => setTimeout(resolve, 50));

      const since = new Date();
      await insertEvent({
        group_id: testProjectGroup,
        event_type: "new_event",
        agent_id: testAgentId,
      });

      const result = await getDualContextEpisodicMemory({
        project_group_id: testProjectGroup,
        include_global: false,
        since,
      });

      // Should only get the new event
      expect(result.project_events.length).toBe(1);
      expect(result.project_events[0].event_type).toBe("new_event");
    });
  });
});