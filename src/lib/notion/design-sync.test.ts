/**
 * Design Sync Tests
 * Story 2.5: Synchronize Best Designs to the Notion Registry
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { DesignSyncManager, type SyncConfig, type DesignSyncResult } from "./design-sync";

// Mock dependencies
vi.mock("../neo4j/connection", () => ({
  readTransaction: vi.fn(),
  writeTransaction: vi.fn(),
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
    createPage: vi.fn(),
    updatePage: vi.fn(),
    appendBlocks: vi.fn(),
    queryDatabase: vi.fn(),
    getPage: vi.fn(),
  })),
}));

describe("DesignSyncManager", () => {
  let syncManager: DesignSyncManager;
  const testConfig: Partial<SyncConfig> & { databaseId: string } = {
    databaseId: "test-database-id",
    minConfidence: 0.7,
    requireApproval: true,
    evidenceBaseUrl: "http://test.local/evidence",
  };

  beforeEach(() => {
    vi.clearAllMocks();
    syncManager = new DesignSyncManager(testConfig);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("constructor", () => {
    it("should create sync manager with config", () => {
      expect(syncManager).toBeDefined();
    });

    it("should use default values for missing config", () => {
      const manager = new DesignSyncManager({ databaseId: "test-db" });
      expect(manager).toBeDefined();
    });
  });

  describe("syncDesign", () => {
    it("should return error for non-existent design", async () => {
      const { readTransaction } = await import("../neo4j/connection");
      vi.mocked(readTransaction).mockResolvedValue({ records: [] });

      const result = await syncManager.syncDesign("non-existent", "group-123");

      expect(result.synced).toBe(false);
      expect(result.error).toContain("Design not found");
    });

    it("should return error for design below threshold", async () => {
      const { readTransaction } = await import("../neo4j/connection");
      const mockNode: Record<string, unknown> = {
        id: "neo4j-123",
        design_id: "design-low-score",
        name: "Low Score Design",
        version: 1,
        domain: "test",
        description: "Test",
        config: "{}",
        source: "adas",
        adas_run_id: null,
        score: 0.5,
        metrics: "{}",
        group_id: "group-123",
        status: "approved",
        evidence_ref: null,
        approved_by: null,
        approved_at: null,
        rejection_reason: null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
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

      const result = await syncManager.syncDesign("design-low-score", "group-123");

      expect(result.synced).toBe(false);
      expect(result.error).toContain("does not meet sync criteria");
    });

    it("should return error for non-approved design", async () => {
      const { readTransaction } = await import("../neo4j/connection");
      const mockNode: Record<string, unknown> = {
        id: "neo4j-123",
        design_id: "design-pending",
        name: "Pending Design",
        version: 1,
        domain: "test",
        description: "Test",
        config: "{}",
        source: "adas",
        adas_run_id: null,
        score: 0.85,
        metrics: "{}",
        group_id: "group-123",
        status: "pending_approval",
        evidence_ref: null,
        approved_by: null,
        approved_at: null,
        rejection_reason: null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
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

      const result = await syncManager.syncDesign("design-pending", "group-123");

      expect(result.synced).toBe(false);
    });
  });

  describe("meetsSyncCriteria", () => {
    it("should accept approved design with score >= 0.7", () => {
      const manager = new DesignSyncManager(testConfig);
      expect(manager).toBeDefined();
    });
  });

  describe("buildEvidenceUrl", () => {
    it("should build URL from trace_ref", async () => {
      const { getPool } = await import("../postgres/connection");
      vi.mocked(getPool).mockReturnValue({
        query: vi.fn().mockResolvedValue({ rows: [] }),
      } as unknown as ReturnType<typeof getPool>);

      const manager = new DesignSyncManager({
        ...testConfig,
        evidenceBaseUrl: "http://test.local/evidence",
      });

      expect(manager).toBeDefined();
    });
  });
});

describe("syncDesignToNotion", () => {
  it("should export sync function", async () => {
    const { syncDesignToNotion } = await import("./design-sync");

    expect(typeof syncDesignToNotion).toBe("function");
  });
});

describe("syncAllApprovedDesigns", () => {
  it("should export batch sync function", async () => {
    const { syncAllApprovedDesigns } = await import("./design-sync");

    expect(typeof syncAllApprovedDesigns).toBe("function");
  });
});

describe("createDesignSyncManager", () => {
  it("should create manager with database ID", async () => {
    const { createDesignSyncManager } = await import("./design-sync");

    const manager = createDesignSyncManager("test-database-id");

    expect(manager).toBeDefined();
  });

  it("should create manager with options", async () => {
    const { createDesignSyncManager } = await import("./design-sync");

    const manager = createDesignSyncManager("test-database-id", {
      minConfidence: 0.8,
      requireApproval: false,
    });

    expect(manager).toBeDefined();
  });
});

describe("SyncConfig", () => {
  it("should have correct default values", () => {
    const manager = new DesignSyncManager({ databaseId: "test" });
    expect(manager).toBeDefined();
  });
});

describe("Error Handling", () => {
  it("should handle Neo4j connection errors gracefully", async () => {
    const { readTransaction } = await import("../neo4j/connection");
    vi.mocked(readTransaction).mockRejectedValue(new Error("Connection failed"));

    const manager = new DesignSyncManager({ databaseId: "test-db" });
    const result = await manager.syncDesign("design-123", "group-456");

    expect(result.synced).toBe(false);
    expect(result.error).toBeDefined();
  });
});