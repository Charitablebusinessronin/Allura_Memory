/**
 * Sync Monitor Tests
 * Story 2.5: Synchronize Best Designs to the Notion Registry
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { SyncMonitor, type DriftConfig, type DriftCheckResult } from "./sync-monitor";

// Mock dependencies
vi.mock("../neo4j/connection", () => ({
  readTransaction: vi.fn(),
}));

vi.mock("../postgres/connection", () => ({
  getPool: vi.fn(() => ({
    query: vi.fn(),
  })),
}));

vi.mock("../postgres/queries/insert-trace", () => ({
  insertEvent: vi.fn(),
}));

vi.mock("./client", () => ({
  getNotionClient: vi.fn(() => ({
    getPage: vi.fn(),
    queryDatabase: vi.fn(),
  })),
}));

vi.mock("./design-sync", () => ({
  createDesignSyncManager: vi.fn(() => ({
    syncDesign: vi.fn(),
  })),
}));

describe("SyncMonitor", () => {
  let monitor: SyncMonitor;
  const testConfig: Partial<DriftConfig> & { databaseId: string } = {
    databaseId: "test-database-id",
    driftThresholdSeconds: 300,
    neo4jAheadAction: "resync",
    notionAheadAction: "notify",
    missingAction: "resync",
  };

  beforeEach(() => {
    vi.clearAllMocks();
    monitor = new SyncMonitor(testConfig);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("constructor", () => {
    it("should create sync monitor with config", () => {
      expect(monitor).toBeDefined();
    });

    it("should use default values for missing config", () => {
      const defaultMonitor = new SyncMonitor({ databaseId: "test-db" });
      expect(defaultMonitor).toBeDefined();
    });
  });

  describe("checkDrift", () => {
    it("should return missing for non-existent design", async () => {
      const { readTransaction } = await import("../neo4j/connection");
      const { getPool } = await import("../postgres/connection");
      
      vi.mocked(readTransaction).mockResolvedValue({ records: [] });
      vi.mocked(getPool).mockReturnValue({
        query: vi.fn().mockResolvedValue({ rows: [] }),
      } as unknown as ReturnType<typeof getPool>);

      const result = await monitor.checkDrift("non-existent", "group-123");

      expect(result.status).toBe("missing");
      expect(result.message).toContain("Design not found");
    });

    it("should return missing when no sync record exists", async () => {
      const { readTransaction } = await import("../neo4j/connection");
      const { getPool } = await import("../postgres/connection");

      const mockNode: Record<string, unknown> = {
        id: "neo4j-123",
        design_id: "design-123",
        version: 1,
        updated_at: { toString: () => new Date().toISOString() },
      };
      vi.mocked(readTransaction).mockResolvedValue({
        records: [
          {
            get: (key: string) => {
              if (key === "d") {
                return { properties: mockNode };
              }
              return mockNode[key];
            },
          },
        ],
      });

      vi.mocked(getPool).mockReturnValue({
        query: vi.fn().mockResolvedValue({ rows: [] }),
      } as unknown as ReturnType<typeof getPool>);

      const result = await monitor.checkDrift("design-123", "group-456");

      expect(result.status).toBe("missing");
      expect(result.message).toContain("No sync record found");
    });

    it("should return missing when Notion page not found", async () => {
      const { readTransaction } = await import("../neo4j/connection");
      const { getPool } = await import("../postgres/connection");
      const { getNotionClient } = await import("./client");

      const mockNode: Record<string, unknown> = {
        id: "neo4j-123",
        design_id: "design-123",
        version: 1,
        updated_at: { toString: () => new Date().toISOString() },
      };
      vi.mocked(readTransaction).mockResolvedValue({
        records: [
          {
            get: (key: string) => {
              if (key === "d") {
                return { properties: mockNode };
              }
              return mockNode[key];
            },
          },
        ],
      });

      vi.mocked(getPool).mockReturnValue({
        query: vi.fn().mockResolvedValue({
          rows: [
            {
              id: "sync-123",
              design_id: "design-123",
              group_id: "group-456",
              notion_page_id: "notion-page-123",
              notion_page_url: "https://notion.so/page-123",
              neo4j_id: "neo4j-123",
              version: 1,
              synced_at: new Date(),
              neo4j_updated_at: new Date(),
              status: "synced",
              error_message: null,
            },
          ],
        }),
      } as unknown as ReturnType<typeof getPool>);

      vi.mocked(getNotionClient).mockReturnValue({
        getPage: vi.fn().mockResolvedValue(null),
        queryDatabase: vi.fn(),
      } as unknown as ReturnType<typeof getNotionClient>);

      const result = await monitor.checkDrift("design-123", "group-456");

      expect(result.status).toBe("missing");
      expect(result.message).toContain("Notion page not found");
    });

    it("should return synced when timestamps match within threshold", async () => {
      const { readTransaction } = await import("../neo4j/connection");
      const { getPool } = await import("../postgres/connection");
      const { getNotionClient } = await import("./client");

      const now = new Date();
      const mockNode: Record<string, unknown> = {
        id: "neo4j-123",
        design_id: "design-123",
        version: 1,
        updated_at: { toString: () => now.toISOString() },
      };
      vi.mocked(readTransaction).mockResolvedValue({
        records: [
          {
            get: (key: string) => {
              if (key === "d") {
                return { properties: mockNode };
              }
              return mockNode[key];
            },
          },
        ],
      });

      vi.mocked(getPool).mockReturnValue({
        query: vi.fn().mockResolvedValue({
          rows: [
            {
              id: "sync-123",
              design_id: "design-123",
              group_id: "group-456",
              notion_page_id: "notion-page-123",
              notion_page_url: "https://notion.so/page-123",
              neo4j_id: "neo4j-123",
              version: 1,
              synced_at: now,
              neo4j_updated_at: now,
              status: "synced",
              error_message: null,
            },
          ],
        }),
      } as unknown as ReturnType<typeof getPool>);

      vi.mocked(getNotionClient).mockReturnValue({
        getPage: vi.fn().mockResolvedValue({
          id: "notion-page-123",
          url: "https://notion.so/page-123",
          createdTime: now,
          lastEditedTime: now,
          properties: {},
          archived: false,
        }),
        queryDatabase: vi.fn(),
      } as unknown as ReturnType<typeof getNotionClient>);

      const result = await monitor.checkDrift("design-123", "group-456");

      expect(result.status).toBe("synced");
      expect(result.message).toContain("Systems are in sync");
    });
  });

  describe("checkAllDrift", () => {
    it("should return summary of drift checks", async () => {
      const { getPool } = await import("../postgres/connection");

      vi.mocked(getPool).mockReturnValue({
        query: vi.fn().mockResolvedValue({ rows: [] }),
      } as unknown as ReturnType<typeof getPool>);

      const result = await monitor.checkAllDrift("group-123");

      expect(result.results).toBeDefined();
      expect(typeof result.syncedCount).toBe("number");
      expect(typeof result.driftedCount).toBe("number");
      expect(typeof result.missingCount).toBe("number");
    });
  });

  describe("resolveDrift", () => {
    it("should skip if no drift detected", async () => {
      const { readTransaction } = await import("../neo4j/connection");
      const { getPool } = await import("../postgres/connection");
      const { getNotionClient } = await import("./client");

      const now = new Date();
      const mockNode: Record<string, unknown> = {
        id: "neo4j-123",
        design_id: "design-123",
        version: 1,
        updated_at: { toString: () => now.toISOString() },
      };
      vi.mocked(readTransaction).mockResolvedValue({
        records: [
          {
            get: (key: string) => {
              if (key === "d") {
                return { properties: mockNode };
              }
              return mockNode[key];
            },
          },
        ],
      });

      vi.mocked(getPool).mockReturnValue({
        query: vi.fn().mockResolvedValue({
          rows: [
            {
              id: "sync-123",
              design_id: "design-123",
              group_id: "group-456",
              notion_page_id: "notion-page-123",
              notion_page_url: "https://notion.so/page-123",
              neo4j_id: "neo4j-123",
              version: 1,
              synced_at: now,
              neo4j_updated_at: now,
              status: "synced",
              error_message: null,
            },
          ],
        }),
      } as unknown as ReturnType<typeof getPool>);

      vi.mocked(getNotionClient).mockReturnValue({
        getPage: vi.fn().mockResolvedValue({
          id: "notion-page-123",
          url: "https://notion.so/page-123",
          createdTime: now,
          lastEditedTime: now,
          properties: {},
          archived: false,
        }),
        queryDatabase: vi.fn(),
      } as unknown as ReturnType<typeof getNotionClient>);

      const result = await monitor.resolveDrift("design-123", "group-456");

      expect(result.success).toBe(true);
      expect(result.action).toBe("skip");
      expect(result.message).toContain("No drift detected");
    });
  });
});

describe("checkDrift function", () => {
  it("should export checkDrift function", async () => {
    const { checkDrift } = await import("./sync-monitor");

    expect(typeof checkDrift).toBe("function");
  });
});

describe("checkAllDrift function", () => {
  it("should export checkAllDrift function", async () => {
    const { checkAllDrift } = await import("./sync-monitor");

    expect(typeof checkAllDrift).toBe("function");
  });
});

describe("resolveDrift function", () => {
  it("should export resolveDrift function", async () => {
    const { resolveDrift } = await import("./sync-monitor");

    expect(typeof resolveDrift).toBe("function");
  });
});

describe("createSyncMonitor", () => {
  it("should create monitor with database ID", async () => {
    const { createSyncMonitor } = await import("./sync-monitor");

    const monitor = createSyncMonitor("test-database-id");

    expect(monitor).toBeDefined();
  });

  it("should create monitor with options", async () => {
    const { createSyncMonitor } = await import("./sync-monitor");

    const monitor = createSyncMonitor("test-database-id", {
      driftThresholdSeconds: 600,
      neo4jAheadAction: "mark_drift",
    });

    expect(monitor).toBeDefined();
  });
});

describe("DriftStatus", () => {
  it("should support all status types", () => {
    const statuses: DriftCheckResult["status"][] = [
      "synced",
      "drift",
      "notion_ahead",
      "neo4j_ahead",
      "missing",
    ];

    expect(statuses.length).toBe(5);
  });
});

describe("Error Handling", () => {
  it("should handle Neo4j connection errors gracefully", async () => {
    const { readTransaction } = await import("../neo4j/connection");
    vi.mocked(readTransaction).mockRejectedValue(new Error("Connection failed"));

    const monitor = new SyncMonitor({ databaseId: "test-db" });
    const result = await monitor.checkDrift("design-123", "group-456");

    expect(result.status).toBe("missing");
    expect(result.message).toContain("Error checking drift");
  });
});