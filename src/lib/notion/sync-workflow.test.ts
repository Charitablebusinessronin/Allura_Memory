/**
 * Tests for Notion Sync Workflow - Story 1.2: NOTION_SYNC Workflow
 * 
 * Tests:
 * - Sync trace to Notion
 * - Get sync status
 * - Mark as reviewed
 * - Promote from Notion
 * - Reject sync
 * - Get sync status counts
 * - Group ID enforcement (RK-01)
 */

import { describe, it, expect, beforeEach, vi, type Mock } from "vitest";
import {
  syncTraceToNotion,
  getSyncStatus,
  markAsReviewed,
  promoteFromNotion,
  getSyncStatusCounts,
  rejectSync,
  NotionSyncValidationError,
  type SyncStatusRecord,
} from "./sync-workflow";
import { getPool } from "../postgres/connection";
import { getNotionClient, type NotionClient } from "./client";
import { validateTenantGroupId } from "../validation/tenant-group-id";

// Mock dependencies
vi.mock("../postgres/connection");
vi.mock("./client");
vi.mock("../validation/tenant-group-id");

describe("Notion Sync Workflow", () => {
  let mockPool: { query: Mock };
  let mockNotionClient: { createPage: Mock };

  const validGroupId = "allura-faith-meats";
  const validTraceId = "trace-123";
  const validNotionPageId = "notion-page-456";
  const validReviewer = "human-reviewer";

  beforeEach(() => {
    // Reset mocks
    vi.clearAllMocks();

    // Mock validateTenantGroupId to pass for valid IDs
    (validateTenantGroupId as Mock).mockImplementation((groupId: string) => {
      if (!groupId || !groupId.startsWith("allura-")) {
        throw new Error(`Invalid group_id format: ${groupId}`);
      }
      return groupId;
    });

    // Mock pool
    mockPool = {
      query: vi.fn(),
    };
    (getPool as Mock).mockReturnValue(mockPool);

    // Mock Notion client
    mockNotionClient = {
      createPage: vi.fn().mockResolvedValue({
        id: validNotionPageId,
        url: `https://notion.so/${validNotionPageId}`,
        createdTime: new Date(),
        lastEditedTime: new Date(),
      }),
    };
    (getNotionClient as Mock).mockReturnValue(mockNotionClient);
  });

  describe("syncTraceToNotion", () => {
    it("should sync a trace to Notion with valid parameters", async () => {
      // Arrange
      mockPool.query.mockResolvedValueOnce({
        rows: [{
          id: "sync-log-id",
          group_id: validGroupId,
          trace_id: validTraceId,
          notion_page_id: validNotionPageId,
          status: "draft",
          synced_at: new Date(),
          reviewed_by: null,
          reviewed_at: null,
          promoted: false,
          created_at: new Date(),
          updated_at: new Date(),
        }],
      });

      // Act
      const result = await syncTraceToNotion({
        traceId: validTraceId,
        group_id: validGroupId,
      });

      // Assert
      expect(result.notionPageId).toBe(validNotionPageId);
      expect(result.status).toBe("draft");
      expect(validateTenantGroupId).toHaveBeenCalledWith(validGroupId);
      expect(mockNotionClient.createPage).toHaveBeenCalled();
      expect(mockPool.query).toHaveBeenCalled();
    });

    it("should reject invalid group_id format", async () => {
      // Arrange
      (validateTenantGroupId as Mock).mockImplementation(() => {
        throw new Error("RK-01: Invalid group_id format");
      });

      // Act & Assert
      await expect(
        syncTraceToNotion({
          traceId: validTraceId,
          group_id: "invalid-format",
        })
      ).rejects.toThrow(NotionSyncValidationError);
    });

    it("should reject empty traceId", async () => {
      // Act & Assert
      await expect(
        syncTraceToNotion({
          traceId: "",
          group_id: validGroupId,
        })
      ).rejects.toThrow(NotionSyncValidationError);
    });

    it("should enforce RK-01 error code on validation failure", async () => {
      // Arrange
      (validateTenantGroupId as Mock).mockImplementation(() => {
        throw new Error("RK-01: Invalid group_id format");
      });

      // Act & Assert
      try {
        await syncTraceToNotion({
          traceId: validTraceId,
          group_id: "invalid",
        });
        fail("Expected NotionSyncValidationError");
      } catch (error) {
        expect(error).toBeInstanceOf(NotionSyncValidationError);
        expect((error as NotionSyncValidationError).code).toBe("RK-01");
        expect((error as Error).message).toContain("RK-01");
      }
    });

    it("should pass custom database ID to Notion", async () => {
      // Arrange
      const customDatabaseId = "custom-db-id";
      mockPool.query.mockResolvedValueOnce({
        rows: [{
          id: "sync-log-id",
          group_id: validGroupId,
          trace_id: validTraceId,
          notion_page_id: validNotionPageId,
          status: "draft",
          synced_at: new Date(),
          reviewed_by: null,
          reviewed_at: null,
          promoted: false,
          created_at: new Date(),
          updated_at: new Date(),
        }],
      });

      // Act
      await syncTraceToNotion({
        traceId: validTraceId,
        group_id: validGroupId,
        databaseId: customDatabaseId,
      });

      // Assert
      expect(mockNotionClient.createPage).toHaveBeenCalledWith(
        expect.objectContaining({
          parent: { database_id: customDatabaseId },
        })
      );
    });
  });

  describe("getSyncStatus", () => {
    it("should return sync status records for a group", async () => {
      // Arrange
      const mockRecords: SyncStatusRecord[] = [
        {
          id: "sync-1",
          group_id: validGroupId,
          trace_id: "trace-1",
          notion_page_id: "page-1",
          status: "draft",
          synced_at: new Date(),
          reviewed_by: null,
          reviewed_at: null,
          promoted: false,
          created_at: new Date(),
          updated_at: new Date(),
        },
        {
          id: "sync-2",
          group_id: validGroupId,
          trace_id: "trace-2",
          notion_page_id: "page-2",
          status: "reviewed",
          synced_at: new Date(),
          reviewed_by: validReviewer,
          reviewed_at: new Date(),
          promoted: false,
          created_at: new Date(),
          updated_at: new Date(),
        },
      ];

      mockPool.query.mockResolvedValueOnce({ rows: mockRecords });

      // Act
      const result = await getSyncStatus({
        group_id: validGroupId,
        limit: 10,
      });

      // Assert
      expect(result).toHaveLength(2);
      expect(result[0].status).toBe("draft");
      expect(result[1].status).toBe("reviewed");
      expect(validateTenantGroupId).toHaveBeenCalledWith(validGroupId);
    });

    it("should filter by status when provided", async () => {
      // Arrange
      mockPool.query.mockResolvedValueOnce({ rows: [] });

      // Act
      await getSyncStatus({
        group_id: validGroupId,
        status: "draft",
        limit: 5,
      });

      // Assert
      expect(mockPool.query).toHaveBeenCalledWith(
        expect.stringContaining("AND status ="),
        expect.arrayContaining([validGroupId, "draft", 5])
      );
    });

    it("should reject invalid group_id (RK-01)", async () => {
      // Arrange
      (validateTenantGroupId as Mock).mockImplementation(() => {
        throw new Error("RK-01: Invalid group_id format");
      });

      // Act & Assert
      await expect(
        getSyncStatus({ group_id: "invalid-format" })
      ).rejects.toThrow(NotionSyncValidationError);
    });

    it("should protect against cross-tenant queries", async () => {
      // Arrange
      (validateTenantGroupId as Mock).mockImplementation(() => {
        throw new Error("RK-01: Invalid group_id format");
      });

      // Act & Assert
      await expect(
        getSyncStatus({ group_id: "roninclaw-invalid" })
      ).rejects.toThrow();
    });
  });

  describe("markAsReviewed", () => {
    it("should mark a synced trace as reviewed", async () => {
      // Arrange
      mockPool.query.mockResolvedValueOnce({
        rowCount: 1,
        rows: [{ id: "sync-log-id" }],
      });

      // Act
      await markAsReviewed({
        notionPageId: validNotionPageId,
        group_id: validGroupId,
        reviewedBy: validReviewer,
      });

      // Assert
      expect(validateTenantGroupId).toHaveBeenCalledWith(validGroupId);
      expect(mockPool.query).toHaveBeenCalledWith(
        expect.stringContaining("UPDATE notion_sync_log"),
        expect.arrayContaining([validReviewer, validNotionPageId, validGroupId])
      );
    });

    it("should reject missing notionPageId", async () => {
      // Act & Assert
      await expect(
        markAsReviewed({
          notionPageId: "",
          group_id: validGroupId,
          reviewedBy: validReviewer,
        })
      ).rejects.toThrow(NotionSyncValidationError);
    });

    it("should reject missing reviewedBy", async () => {
      // Act & Assert
      await expect(
        markAsReviewed({
          notionPageId: validNotionPageId,
          group_id: validGroupId,
          reviewedBy: "",
        })
      ).rejects.toThrow(NotionSyncValidationError);
    });

    it("should throw if record not found or not in draft status", async () => {
      // Arrange
      mockPool.query.mockResolvedValueOnce({ rowCount: 0, rows: [] });

      // Act & Assert
      await expect(
        markAsReviewed({
          notionPageId: validNotionPageId,
          group_id: validGroupId,
          reviewedBy: validReviewer,
        })
      ).rejects.toThrow("Sync record not found or not in draft status");
    });
  });

  describe("promoteFromNotion", () => {
    it("should promote a reviewed trace to Neo4j", async () => {
      // Arrange
      mockPool.query
        .mockResolvedValueOnce({
          rows: [{
            id: "sync-log-id",
            trace_id: validTraceId,
            status: "reviewed",
          }],
        })
        .mockResolvedValueOnce({
          rowCount: 1,
          rows: [{ id: "sync-log-id" }],
        })
        .mockResolvedValueOnce({
          rowCount: 1,
          rows: [],
        });

      // Act
      const result = await promoteFromNotion({
        notionPageId: validNotionPageId,
        group_id: validGroupId,
      });

      // Assert
      expect(result.promoted).toBe(true);
      expect(result.insightId).toBeDefined();
      expect(validateTenantGroupId).toHaveBeenCalledWith(validGroupId);
    });

    it("should use provided insight ID", async () => {
      // Arrange
      const customInsightId = "custom-insight-789";
      mockPool.query
        .mockResolvedValueOnce({
          rows: [{
            id: "sync-log-id",
            trace_id: validTraceId,
            status: "reviewed",
          }],
        })
        .mockResolvedValueOnce({
          rowCount: 1,
          rows: [{ id: "sync-log-id" }],
        })
        .mockResolvedValueOnce({
          rowCount: 1,
          rows: [],
        });

      // Act
      const result = await promoteFromNotion({
        notionPageId: validNotionPageId,
        group_id: validGroupId,
        insightId: customInsightId,
      });

      // Assert
      expect(result.insightId).toBe(customInsightId);
    });

    it("should reject promotion of non-reviewed records", async () => {
      // Arrange
      mockPool.query.mockResolvedValueOnce({
        rows: [{
          id: "sync-log-id",
          trace_id: validTraceId,
          status: "draft",
        }],
      });

      // Act & Assert
      await expect(
        promoteFromNotion({
          notionPageId: validNotionPageId,
          group_id: validGroupId,
        })
      ).rejects.toThrow("Cannot promote record with status 'draft'");
    });

    it("should throw if record not found", async () => {
      // Arrange
      mockPool.query.mockResolvedValueOnce({ rowCount: 0, rows: [] });

      // Act & Assert
      await expect(
        promoteFromNotion({
          notionPageId: validNotionPageId,
          group_id: validGroupId,
        })
      ).rejects.toThrow("Sync record not found");
    });
  });

  describe("getSyncStatusCounts", () => {
    it("should return counts by status", async () => {
      // Arrange
      mockPool.query.mockResolvedValueOnce({
        rows: [
          { status: "draft", count: "5" },
          { status: "reviewed", count: "3" },
          { status: "promoted", count: "2" },
          { status: "rejected", count: "1" },
        ],
      });

      // Act
      const counts = await getSyncStatusCounts(validGroupId);

      // Assert
      expect(counts.draft).toBe(5);
      expect(counts.reviewed).toBe(3);
      expect(counts.promoted).toBe(2);
      expect(counts.rejected).toBe(1);
      expect(validateTenantGroupId).toHaveBeenCalledWith(validGroupId);
    });

    it("should return zeros for missing statuses", async () => {
      // Arrange
      mockPool.query.mockResolvedValueOnce({
        rows: [{ status: "draft", count: "10" }],
      });

      // Act
      const counts = await getSyncStatusCounts(validGroupId);

      // Assert
      expect(counts.draft).toBe(10);
      expect(counts.reviewed).toBe(0);
      expect(counts.promoted).toBe(0);
      expect(counts.rejected).toBe(0);
    });

    it("should reject invalid group_id (RK-01)", async () => {
      // Arrange
      (validateTenantGroupId as Mock).mockImplementation(() => {
        throw new Error("RK-01: Invalid group_id format");
      });

      // Act & Assert
      await expect(
        getSyncStatusCounts("invalid-format")
      ).rejects.toThrow(NotionSyncValidationError);
    });
  });

  describe("rejectSync", () => {
    it("should reject a synced trace", async () => {
      // Arrange
      mockPool.query
        .mockResolvedValueOnce({
          rowCount: 1,
          rows: [{ id: "sync-log-id" }],
        })
        .mockResolvedValueOnce({
          rowCount: 1,
          rows: [],
        });

      // Act
      await rejectSync(validNotionPageId, validGroupId, "Low quality insight");

      // Assert
      expect(validateTenantGroupId).toHaveBeenCalledWith(validGroupId);
      expect(mockPool.query).toHaveBeenCalledWith(
        expect.stringContaining("UPDATE notion_sync_log"),
        expect.arrayContaining([validNotionPageId, validGroupId])
      );
    });

    it("should reject missing notionPageId", async () => {
      // Act & Assert
      await expect(
        rejectSync("", validGroupId, "Reason")
      ).rejects.toThrow(NotionSyncValidationError);
    });

    it("should throw if record cannot be rejected", async () => {
      // Arrange
      mockPool.query.mockResolvedValueOnce({ rowCount: 0, rows: [] });

      // Act & Assert
      await expect(
        rejectSync(validNotionPageId, validGroupId, "Reason")
      ).rejects.toThrow("Cannot reject record");
    });
  });

  describe("RK-01: Tenant Isolation Validation", () => {
    it("should accept valid allura-{org} group_id", async () => {
      const validWorkspaces = [
        "allura-faith-meats",
        "allura-creative",
        "allura-personal",
        "allura-nonprofit",
        "allura-audits",
        "allura-haccp",
        "allura-default",
      ];

      mockPool.query.mockResolvedValue({
        rows: [{
          id: "test",
          group_id: "test",
          trace_id: "test",
          notion_page_id: "test",
          status: "draft",
          synced_at: new Date(),
          reviewed_by: null,
          reviewed_at: null,
          promoted: false,
          created_at: new Date(),
          updated_at: new Date(),
        }],
        rowCount: 1,
      });

      for (const workspace of validWorkspaces) {
        await expect(
          syncTraceToNotion({ traceId: "test", group_id: workspace })
        ).resolves.toBeDefined();
      }
    });

    it("should reject legacy roninclaw-* naming", async () => {
      // Arrange
      (validateTenantGroupId as Mock).mockImplementation(() => {
        throw new Error("RK-01: Invalid group_id format");
      });

      // Act & Assert
      await expect(
        syncTraceToNotion({ traceId: "test", group_id: "roninclaw-test" })
      ).rejects.toThrow(NotionSyncValidationError);
    });

    it("should reject non-allura group_id", async () => {
      // Arrange
      (validateTenantGroupId as Mock).mockImplementation(() => {
        throw new Error("RK-01: Invalid group_id format");
      });

      // Act & Assert
      await expect(
        syncTraceToNotion({ traceId: "test", group_id: "invalid-workspace" })
      ).rejects.toThrow(NotionSyncValidationError);
    });

    it("should include RK-01 error code in all validation errors", async () => {
      // Arrange
      (validateTenantGroupId as Mock).mockImplementation(() => {
        throw new Error("RK-01: Invalid group_id format");
      });

      const operations = [
        () => syncTraceToNotion({ traceId: "test", group_id: "invalid" }),
        () => getSyncStatus({ group_id: "invalid" }),
        () => markAsReviewed({ notionPageId: "test", group_id: "invalid", reviewedBy: "test" }),
        () => promoteFromNotion({ notionPageId: "test", group_id: "invalid" }),
        () => getSyncStatusCounts("invalid"),
        () => rejectSync("test", "invalid", "reason"),
      ];

      for (const operation of operations) {
        try {
          await operation();
        } catch (error) {
          expect(error).toBeInstanceOf(NotionSyncValidationError);
          expect((error as NotionSyncValidationError).code).toBe("RK-01");
          expect((error as Error).message).toContain("RK-01");
        }
      }
    });
  });

  describe("Error Handling", () => {
    it("should handle Notion API errors gracefully", async () => {
      // Arrange
      mockNotionClient.createPage.mockRejectedValueOnce(new Error("Notion API error"));

      // Act & Assert
      await expect(
        syncTraceToNotion({ traceId: validTraceId, group_id: validGroupId })
      ).rejects.toThrow();
    });

    it("should handle database connection errors", async () => {
      // Arrange
      mockPool.query.mockRejectedValueOnce(new Error("Database connection failed"));

      // Act & Assert
      await expect(
        getSyncStatus({ group_id: validGroupId })
      ).rejects.toThrow("Database connection failed");
    });
  });
});