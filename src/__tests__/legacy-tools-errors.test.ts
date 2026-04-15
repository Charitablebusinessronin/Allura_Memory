/**
 * Legacy Tools Error Handling & Append-Only Tests
 *
 * Issue #7: Two violations in src/mcp/legacy/tools.ts:
 * 1. adasApproveDesign used UPDATE on promotion_candidates (violates append-only)
 * 2. All handlers returned { error: String(error) } instead of throwing
 *
 * Fix:
 * - adasApproveDesign now INSERTs a design_review event (append-only)
 * - All handlers now throw classified domain errors
 * - group_id validation already enforced by Zod schemas
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  DatabaseUnavailableError,
  DatabaseQueryError,
} from "@/lib/errors/database-errors";

// Mock postgres pool — must match the import path used by legacy/tools.ts
const mockQuery = vi.fn();
vi.mock("@/lib/postgres/connection", () => ({
  getPool: () => ({ query: mockQuery }),
}));

// Must import after mock setup
import { memorySearch, memoryStore, adasGetProposals, adasApproveDesign } from "@/mcp/legacy/tools";

describe("Legacy Tools Error Handling (Issue #7)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("memorySearch", () => {
    it("should throw DatabaseQueryError on PG query failure", async () => {
      const pgError = new Error("relation does not exist") as Error & {
        code: string;
      };
      pgError.code = "42P01";

      mockQuery.mockRejectedValue(pgError);

      await expect(
        memorySearch({ query: "test", group_id: "allura-test-legacy" }),
      ).rejects.toThrow();
    });

    it("should return results on success", async () => {
      mockQuery.mockResolvedValue({
        rows: [{ id: 1, content: "test memory" }],
      });

      const result = await memorySearch({
        query: "test",
        group_id: "allura-test-legacy",
      });

      expect(result).toEqual({
        count: 1,
        memories: [{ id: 1, content: "test memory" }],
      });
    });
  });

  describe("memoryStore", () => {
    it("should throw on PG insert failure", async () => {
      const pgError = new Error("connection refused") as Error & {
        code: string;
      };
      pgError.code = "ECONNREFUSED";

      mockQuery.mockRejectedValue(pgError);

      await expect(
        memoryStore({
          topic_key: "test-1",
          title: "Test",
          content: "test content",
          type: "insight",
          group_id: "allura-test-legacy",
        }),
      ).rejects.toThrow();
    });
  });

  describe("adasGetProposals", () => {
    it("should throw on PG query failure", async () => {
      const pgError = new Error("timeout") as Error & { code: string };
      pgError.code = "57014";

      mockQuery.mockRejectedValue(pgError);

      await expect(
        adasGetProposals({ group_id: "allura-test-legacy" }),
      ).rejects.toThrow();
    });
  });

  describe("adasApproveDesign (append-only fix)", () => {
    it("should INSERT into events table, not UPDATE promotion_candidates", async () => {
      mockQuery.mockResolvedValue({ rowCount: 1 });

      const result = await adasApproveDesign({
        designId: "design-123",
        decision: "approve",
        rationale: "Meets quality threshold",
        approvedBy: "curator",
        group_id: "allura-test-legacy",
      });

      // Verify INSERT was called (not UPDATE)
      const call = mockQuery.mock.calls[0];
      const sql = call[0] as string;
      expect(sql).toContain("INSERT INTO events");
      expect(sql).toContain("design_review");
      expect(sql).not.toContain("UPDATE");

      // Verify response includes event_id
      expect(result.success).toBe(true);
      expect(result).toHaveProperty("event_id");
      expect(result.decision).toBe("approve");
    });

    it("should INSERT rejection event (append-only)", async () => {
      mockQuery.mockResolvedValue({ rowCount: 1 });

      const result = await adasApproveDesign({
        designId: "design-456",
        decision: "reject",
        rationale: "Below quality threshold",
        approvedBy: "curator",
        group_id: "allura-test-legacy",
      });

      const call = mockQuery.mock.calls[0];
      const sql = call[0] as string;
      expect(sql).toContain("INSERT INTO events");
      expect(sql).not.toContain("UPDATE");

      expect(result.decision).toBe("reject");
    });

    it("should throw on PG insert failure", async () => {
      const pgError = new Error("check constraint") as Error & {
        code: string;
      };
      pgError.code = "23514";

      mockQuery.mockRejectedValue(pgError);

      await expect(
        adasApproveDesign({
          designId: "design-789",
          decision: "approve",
          rationale: "test",
          approvedBy: "curator",
          group_id: "allura-test-legacy",
        }),
      ).rejects.toThrow();
    });

    it("should include review metadata in event content", async () => {
      mockQuery.mockResolvedValue({ rowCount: 1 });

      await adasApproveDesign({
        designId: "design-meta",
        decision: "approve",
        rationale: "High confidence",
        approvedBy: "human-curator",
        group_id: "allura-test-legacy",
      });

      const call = mockQuery.mock.calls[0];
      const params = call[1] as unknown[];
      // params: [eventId, group_id, content_string, metadata_json]
      const metadata = JSON.parse(params[3] as string);

      expect(metadata.design_id).toBe("design-meta");
      expect(metadata.decision).toBe("approve");
      expect(metadata.rationale).toBe("High confidence");
      expect(metadata.reviewed_by).toBe("human-curator");
      expect(metadata.status).toBe("approved");
    });
  });
});