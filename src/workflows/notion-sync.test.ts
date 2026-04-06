/**
 * Notion Sync Workflow Tests
 * Story 1.2: PostgreSQL to Notion sync
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  getUnsyncedTraces,
  syncTraceToNotionWorkflow,
  runSyncWorkflow,
  getSyncStatus,
  DEFAULT_SYNC_CONFIG,
  type SyncWorkflowResult,
} from "./notion-sync";
import type { TraceRecord } from "@/lib/postgres/trace-logger";

// Mock dependencies
const mockQuery = vi.fn();
const mockPool = {
  query: mockQuery,
};

vi.mock("@/lib/postgres/connection", () => ({
  getPool: () => mockPool,
}));

vi.mock("@/lib/validation/group-id", () => ({
  validateGroupId: (groupId: string) => {
    if (!groupId || !groupId.startsWith("allura-")) {
      throw new Error("Invalid group_id: must start with 'allura-'");
    }
    return groupId;
  },
  GroupIdValidationError: class GroupIdValidationError extends Error {},
}));

describe("Notion Sync Workflow", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("getUnsyncedTraces", () => {
    it("should query for unsynced traces with correct filters", async () => {
      const mockTraces: TraceRecord[] = [
        {
          id: 1,
          group_id: "allura-system",
          event_type: "trace.contribution",
          agent_id: "memory-orchestrator",
          workflow_id: null,
          step_id: null,
          parent_event_id: null,
          metadata: { confidence: 0.8 },
          outcome: { content: "Test trace" },
          status: "completed",
          created_at: new Date(),
        confidence: null,
        evidence_ref: null,
          inserted_at: new Date(),
        },
      ];

      mockQuery.mockResolvedValue({ rows: mockTraces });

      const result = await getUnsyncedTraces({
        group_id: "allura-system",
        confidenceThreshold: 0.7,
      });

      expect(result).toHaveLength(1);
      expect(result[0].id).toBe(1);
      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining("FROM events"),
        expect.arrayContaining([
          "allura-system",
          expect.arrayContaining(["trace.contribution", "trace.decision"]),
          0.7,
          10,
        ])
      );
    });

    it("should return empty array when no traces found", async () => {
      mockQuery.mockResolvedValue({ rows: [] });

      const result = await getUnsyncedTraces({
        group_id: "allura-system",
      });

      expect(result).toHaveLength(0);
    });

    it("should throw error for invalid group_id", async () => {
      await expect(
        getUnsyncedTraces({ group_id: "invalid-group" })
      ).rejects.toThrow("Invalid group_id");
    });
  });

  describe("syncTraceToNotionWorkflow", () => {
    it("should sync a valid trace", async () => {
      const trace: TraceRecord = {
        id: 1,
        group_id: "allura-system",
        event_type: "trace.contribution",
        agent_id: "memory-orchestrator",
        workflow_id: null,
        step_id: null,
        parent_event_id: null,
        metadata: { confidence: 0.8 },
        outcome: { content: "Test contribution" },
        status: "completed",
        created_at: new Date(),
        confidence: null,
        evidence_ref: null,
        inserted_at: new Date(),
      };

      mockQuery.mockResolvedValue({ rows: [] });

      const result = await syncTraceToNotionWorkflow(trace, "allura-system");

      expect(result.success).toBe(true);
      expect(result.notionPageId).toBeDefined();
      expect(result.error).toBeUndefined();
    });

    it("should fail if group_id doesn't match", async () => {
      const trace: TraceRecord = {
        id: 1,
        group_id: "allura-system",
        event_type: "trace.contribution",
        agent_id: "memory-orchestrator",
        workflow_id: null,
        step_id: null,
        parent_event_id: null,
        metadata: { confidence: 0.8 },
        outcome: {},
        status: "completed",
        created_at: new Date(),
        confidence: null,
        evidence_ref: null,
        inserted_at: new Date(),
      };

      const result = await syncTraceToNotionWorkflow(trace, "allura-other");

      expect(result.success).toBe(false);
      expect(result.error).toContain("Group ID mismatch");
    });

    it("should skip traces that don't meet sync criteria", async () => {
      const trace: TraceRecord = {
        id: 1,
        group_id: "allura-system",
        event_type: "trace.error",
        agent_id: "memory-orchestrator",
        workflow_id: null,
        step_id: null,
        parent_event_id: null,
        metadata: { confidence: 0.5, notion_page_id: "already-synced" },
        outcome: {},
        status: "completed",
        created_at: new Date(),
        confidence: null,
        evidence_ref: null,
        inserted_at: new Date(),
      };

      const result = await syncTraceToNotionWorkflow(trace, "allura-system");

      expect(result.success).toBe(false);
      expect(result.error).toContain("does not meet sync criteria");
    });
  });

  describe("runSyncWorkflow", () => {
    it("should process batch of traces", async () => {
      const mockTraces: TraceRecord[] = [
        {
          id: 1,
          group_id: "allura-system",
          event_type: "trace.contribution",
          agent_id: "memory-orchestrator",
          workflow_id: null,
          step_id: null,
          parent_event_id: null,
          metadata: { confidence: 0.8 },
          outcome: { content: "Trace 1" },
          status: "completed",
          created_at: new Date(),
        confidence: null,
        evidence_ref: null,
          inserted_at: new Date(),
        },
        {
          id: 2,
          group_id: "allura-system",
          event_type: "trace.decision",
          agent_id: "memory-architect",
          workflow_id: null,
          step_id: null,
          parent_event_id: null,
          metadata: { confidence: 0.9 },
          outcome: { content: "Trace 2" },
          status: "completed",
          created_at: new Date(),
        confidence: null,
        evidence_ref: null,
          inserted_at: new Date(),
        },
      ];

      mockQuery.mockResolvedValueOnce({ rows: mockTraces });
      mockQuery.mockResolvedValue({ rows: [] }); // For update calls

      const result = await runSyncWorkflow({
        group_id: "allura-system",
        batchSize: 10,
      });

      expect(result.processed).toBe(2);
      expect(result.synced).toBe(2);
      expect(result.failed).toBe(0);
      expect(result.results).toHaveLength(2);
    });

    it("should return empty result when no traces to sync", async () => {
      mockQuery.mockResolvedValue({ rows: [] });

      const result = await runSyncWorkflow({ group_id: "allura-system" });

      expect(result.processed).toBe(0);
      expect(result.synced).toBe(0);
      expect(result.failed).toBe(0);
    });

    it("should track failures separately", async () => {
      // First trace succeeds, second fails (group_id mismatch)
      const mockTraces: TraceRecord[] = [
        {
          id: 1,
          group_id: "allura-system",
          event_type: "trace.contribution",
          agent_id: "memory-orchestrator",
          workflow_id: null,
          step_id: null,
          parent_event_id: null,
          metadata: { confidence: 0.8 },
          outcome: { content: "Trace 1" },
          status: "completed",
          created_at: new Date(),
        confidence: null,
        evidence_ref: null,
          inserted_at: new Date(),
        },
        {
          id: 2,
          group_id: "allura-wrong", // Different group_id
          event_type: "trace.decision",
          agent_id: "memory-architect",
          workflow_id: null,
          step_id: null,
          parent_event_id: null,
          metadata: { confidence: 0.9 },
          outcome: { content: "Trace 2" },
          status: "completed",
          created_at: new Date(),
        confidence: null,
        evidence_ref: null,
          inserted_at: new Date(),
        },
      ];

      mockQuery.mockResolvedValueOnce({ rows: mockTraces });
      mockQuery.mockResolvedValue({ rows: [] });

      const result = await runSyncWorkflow({
        group_id: "allura-system",
      });

      expect(result.processed).toBe(2);
      expect(result.synced).toBe(1);
      expect(result.failed).toBe(1);
    });
  });

  describe("getSyncStatus", () => {
    it("should return sync statistics", async () => {
      mockQuery.mockResolvedValue({
        rows: [
          {
            total: "100",
            synced: "30",
            unsynced: "70",
            high_confidence: "45",
          },
        ],
      });

      const result = await getSyncStatus("allura-system");

      expect(result.total).toBe(100);
      expect(result.synced).toBe(30);
      expect(result.unsynced).toBe(70);
      expect(result.highConfidence).toBe(45);
    });

    it("should throw error for invalid group_id", async () => {
      await expect(getSyncStatus("invalid-group")).rejects.toThrow(
        "Invalid group_id"
      );
    });
  });

  describe("DEFAULT_SYNC_CONFIG", () => {
    it("should have sensible defaults", () => {
      expect(DEFAULT_SYNC_CONFIG.confidenceThreshold).toBe(0.7);
      expect(DEFAULT_SYNC_CONFIG.batchSize).toBe(10);
      expect(DEFAULT_SYNC_CONFIG.allowedTypes).toContain("contribution");
      expect(DEFAULT_SYNC_CONFIG.allowedTypes).toContain("decision");
      expect(DEFAULT_SYNC_CONFIG.allowedTypes).not.toContain("error");
    });
  });
});
