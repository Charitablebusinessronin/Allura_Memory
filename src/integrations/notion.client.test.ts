import { describe, it, expect, vi } from "vitest";

import { NotionClientImpl } from "./notion.client";
import type { McpToolCaller } from "./mcp.client";

function buildInsightRow(input: {
  id: string;
  title: string;
  sourceInsightId?: string;
  canonicalTag?: string;
  reviewStatus?: string;
  aiAccessible?: boolean;
  status?: string;
  approvedAt?: string;
  confidence?: number;
}) {
  return {
    id: input.id,
    properties: {
      Name: {
        title: [{ text: { content: input.title }, plain_text: input.title }],
      },
      Summary: {
        rich_text: [{ text: { content: "summary" }, plain_text: "summary" }],
      },
      "Canonical Tag": {
        rich_text: [
          {
            text: { content: input.canonicalTag ?? "test.tag" },
            plain_text: input.canonicalTag ?? "test.tag",
          },
        ],
      },
      "Source Insight ID": {
        rich_text: [
          {
            text: { content: input.sourceInsightId ?? "" },
            plain_text: input.sourceInsightId ?? "",
          },
        ],
      },
      Status: {
        select: { name: input.status ?? "Approved" },
      },
      "Review Status": {
        select: { name: input.reviewStatus ?? "Completed" },
      },
      "AI Accessible": {
        checkbox: input.aiAccessible ?? true,
      },
      Confidence: {
        number: input.confidence ?? 0.9,
      },
      "Approved At": {
        date: { start: input.approvedAt ?? "2026-03-18T00:00:00.000Z" },
      },
      "Source Project": {
        rich_text: [{ text: { content: "memory" }, plain_text: "memory" }],
      },
      "Display Tags": {
        multi_select: [{ name: "Memory" }],
      },
    },
  };
}

describe("NotionClientImpl duplicate cleanup", () => {
  it("filters approved insights by Review Status + AI Accessible", async () => {
    const rows = [
      buildInsightRow({ id: "p1", title: "A", reviewStatus: "Completed", aiAccessible: true }),
      buildInsightRow({ id: "p2", title: "B", reviewStatus: "Pending", aiAccessible: true }),
      buildInsightRow({ id: "p3", title: "C", reviewStatus: "Completed", aiAccessible: false }),
    ];

    const mcp: McpToolCaller = {
      callTool: vi.fn().mockResolvedValue({
        content: [{ type: "text", text: JSON.stringify({ results: rows }) }],
      }),
    };

    const client = new NotionClientImpl(mcp, "test-db");
    const approved = await client.listApprovedInsights();

    expect(approved).toHaveLength(1);
    expect(approved[0].pageId).toBe("p1");
  });

  it("groups duplicates and selects canonical record", async () => {
    const rows = [
      buildInsightRow({ id: "p1", title: "A", sourceInsightId: "ins-1", approvedAt: "2026-03-17T00:00:00.000Z", confidence: 0.8 }),
      buildInsightRow({ id: "p2", title: "A", sourceInsightId: "ins-1", approvedAt: "2026-03-18T00:00:00.000Z", confidence: 0.7 }),
      buildInsightRow({ id: "p3", title: "B", canonicalTag: "tag-only" }),
      buildInsightRow({ id: "p4", title: "B", canonicalTag: "tag-only", approvedAt: "2026-03-19T00:00:00.000Z" }),
    ];

    const mcp: McpToolCaller = {
      callTool: vi.fn().mockResolvedValue({
        content: [{ type: "text", text: JSON.stringify({ results: rows }) }],
      }),
    };

    const client = new NotionClientImpl(mcp, "test-db");
    const groups = await client.findApprovedDuplicateGroups();

    expect(groups).toHaveLength(3);
    const sourceGroup = groups.find((group) => group.identityType === "source_insight_id");
    const tagGroup = groups.find(
      (group) => group.identityType === "canonical_tag" && group.identityValue === "tag-only",
    );

    expect(sourceGroup?.canonical.pageId).toBe("p2");
    expect(tagGroup?.canonical.pageId).toBe("p4");
  });

  it("archives duplicate pages and leaves ambiguous records untouched", async () => {
    const rows = [
      buildInsightRow({ id: "p1", title: "A", sourceInsightId: "ins-1", approvedAt: "2026-03-17T00:00:00.000Z" }),
      buildInsightRow({ id: "p2", title: "A", sourceInsightId: "ins-1", approvedAt: "2026-03-19T00:00:00.000Z" }),
      buildInsightRow({ id: "p3", title: "No Identity", sourceInsightId: "", canonicalTag: "" }),
    ];

    const callTool = vi.fn().mockImplementation(async (toolName: string) => {
      if (toolName === "notion-fetch") {
        return {
          content: [{ type: "text", text: JSON.stringify({ results: rows }) }],
        };
      }
      return {};
    });

    const mcp: McpToolCaller = { callTool };
    const client = new NotionClientImpl(mcp, "test-db");
    const result = await client.cleanupApprovedDuplicates();

    expect(result.groupsFound).toBe(2);
    expect(result.archivedCount).toBe(1);
    expect(result.canonicalPageIds).toEqual(["p2"]);
    expect(result.archivedPageIds).toEqual(["p1"]);
    expect(result.ambiguousRecords).toEqual(["p3"]);
    expect(result.failedPageIds).toEqual([]);

    const updateCalls = callTool.mock.calls.filter((call) => call[0] === "notion-update-page");
    expect(updateCalls).toHaveLength(1);
    expect(updateCalls[0][1]).toMatchObject({ page_id: "p1" });
  });

  it("is idempotent when rerun against already superseded duplicate", async () => {
    const rows = [
      buildInsightRow({ id: "p1", title: "A", sourceInsightId: "ins-1", approvedAt: "2026-03-17T00:00:00.000Z" }),
      buildInsightRow({ id: "p2", title: "A", sourceInsightId: "ins-1", approvedAt: "2026-03-19T00:00:00.000Z" }),
    ];

    const callTool = vi.fn().mockImplementation(async (toolName: string, payload: Record<string, unknown>) => {
      if (toolName === "notion-fetch") {
        return {
          content: [{ type: "text", text: JSON.stringify({ results: rows }) }],
        };
      }

      if (toolName === "notion-update-page") {
        const pageId = payload.page_id as string;
        const row = rows.find((candidate) => candidate.id === pageId);
        if (row) {
          row.properties.Status.select.name = "Superseded";
          row.properties["AI Accessible"].checkbox = false;
        }
      }

      return {};
    });

    const mcp: McpToolCaller = { callTool };
    const client = new NotionClientImpl(mcp, "test-db");

    const first = await client.cleanupApprovedDuplicates();
    const second = await client.cleanupApprovedDuplicates();

    expect(first.archivedCount).toBe(1);
    expect(second.archivedCount).toBe(0);
    expect(second.failedPageIds).toEqual([]);
  });

  it("continues cleanup when a duplicate page update fails", async () => {
    const rows = [
      buildInsightRow({ id: "p1", title: "A", sourceInsightId: "ins-1", approvedAt: "2026-03-15T00:00:00.000Z" }),
      buildInsightRow({ id: "p2", title: "A", sourceInsightId: "ins-1", approvedAt: "2026-03-16T00:00:00.000Z" }),
      buildInsightRow({ id: "p3", title: "A", sourceInsightId: "ins-1", approvedAt: "2026-03-17T00:00:00.000Z" }),
    ];

    const callTool = vi.fn().mockImplementation(async (toolName: string, payload: Record<string, unknown>) => {
      if (toolName === "notion-fetch") {
        return {
          content: [{ type: "text", text: JSON.stringify({ results: rows }) }],
        };
      }

      if (toolName === "notion-update-page" && payload.page_id === "p1") {
        throw new Error("simulated update failure");
      }

      return {};
    });

    const mcp: McpToolCaller = { callTool };
    const client = new NotionClientImpl(mcp, "test-db");
    const result = await client.cleanupApprovedDuplicates();

    expect(result.canonicalPageIds).toEqual(["p3"]);
    expect(result.archivedPageIds).toContain("p2");
    expect(result.failedPageIds).toEqual(["p1"]);
  });
});
