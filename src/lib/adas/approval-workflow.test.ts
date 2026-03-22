import { describe, it, expect, beforeAll, beforeEach, vi } from "vitest";
import {
  ApprovalWorkflowManager,
  approveProposal,
  rejectProposal,
  getApprovalStatus,
  listProposalsByStatus,
  type ApprovalResult,
  type RejectionResult,
} from "./approval-workflow";
import type { AgentDesignNode, ApprovalHistoryRecord } from "./promotion-proposal";
import type { PromotionStatus } from "./promotion-detector";

vi.mock("../neo4j/connection", () => ({
  writeTransaction: vi.fn(),
}));

vi.mock("../postgres/connection", () => ({
  getPool: vi.fn(),
}));

vi.mock("../postgres/queries/insert-trace", () => ({
  insertEvent: vi.fn().mockResolvedValue({ id: 1 }),
}));

vi.mock("../neo4j/queries/insert-insight", () => ({
  createInsight: vi.fn().mockResolvedValue({
    id: "insight-001",
    insight_id: "adas-design-001",
    version: 1,
    content: "ADAS Design",
    confidence: 0.85,
    group_id: "test-group",
    source_type: "promotion",
    source_ref: "event:123",
    created_at: new Date(),
    created_by: "approver:user-001",
    status: "active",
    metadata: {},
  }),
  createInsightVersion: vi.fn(),
}));

describe("ApprovalWorkflowManager", () => {
  let manager: ApprovalWorkflowManager;
  let mockPool: { query: ReturnType<typeof vi.fn> };
  let mockWriteTransaction: ReturnType<typeof vi.fn>;

  const createMockNode = (overrides: Partial<AgentDesignNode> = {}): AgentDesignNode => ({
    id: "neo4j-id-001",
    design_id: "design-001",
    name: "Test Design",
    version: 1,
    domain: "test-domain",
    description: "A test design",
    config: {},
    source: "adas",
    adas_run_id: "run-001",
    score: 0.85,
    metrics: {
      accuracy: 0.85,
      cost: 0.05,
      latency: 450,
      composite: 0.82,
    },
    group_id: "test-group",
    status: "pending_approval" as PromotionStatus,
    evidence_ref: "event:123",
    approved_by: null,
    approved_at: null,
    rejection_reason: null,
    created_at: new Date(),
    updated_at: new Date(),
    ...overrides,
  });

  beforeAll(async () => {
    mockPool = {
      query: vi.fn().mockResolvedValue({ rows: [] }),
    };
    mockWriteTransaction = vi.fn();

    const pg = await import("../postgres/connection");
    vi.mocked(pg.getPool).mockReturnValue(mockPool as unknown as ReturnType<typeof pg.getPool>);

    const neo4j = await import("../neo4j/connection");
    vi.mocked(neo4j.writeTransaction).mockImplementation(mockWriteTransaction);
  });

  beforeEach(() => {
    vi.clearAllMocks();
    manager = new ApprovalWorkflowManager();
    mockPool.query.mockResolvedValue({ rows: [] });
  });

  describe("approveProposal", () => {
    it("should approve a pending proposal", async () => {
      mockWriteTransaction.mockImplementation(async (fn: (tx: unknown) => Promise<unknown>) => {
        const mockTx = {
          run: vi.fn()
            .mockResolvedValueOnce({
              records: [
                {
                  get: vi.fn(() => ({
                    properties: {
                      id: "neo4j-id-001",
                      design_id: "design-001",
                      name: "Test Design",
                      version: { toNumber: () => 1 },
                      domain: "test-domain",
                      description: "Test",
                      config: "{}",
                      source: "adas",
                      adas_run_id: "run-001",
                      score: { toNumber: () => 0.85 },
                      metrics: "{}",
                      group_id: "test-group",
                      status: "pending_approval",
                      evidence_ref: "event:123",
                      approved_by: null,
                      approved_at: null,
                      rejection_reason: null,
                      created_at: new Date().toISOString(),
                      updated_at: new Date().toISOString(),
                    },
                  })),
                },
              ],
            })
            .mockResolvedValueOnce({
              records: [
                {
                  get: vi.fn(() => ({
                    properties: {
                      id: "neo4j-id-001",
                      design_id: "design-001",
                      status: "approved",
                      approved_by: "user-001",
                      approved_at: new Date().toISOString(),
                      updated_at: new Date().toISOString(),
                    },
                  })),
                },
              ],
            }),
        };
        return fn(mockTx);
      });

      const result = await manager.approveProposal({
        designId: "design-001",
        groupId: "test-group",
        approverId: "user-001",
        reason: "Excellent performance",
      });

      expect(result.success).toBe(true);
      expect(result.status).toBe("approved");
      expect(result.approvedBy).toBe("user-001");
    });

    it("should reject approval for non-pending proposals", async () => {
      mockWriteTransaction.mockImplementation(async (fn: (tx: unknown) => Promise<unknown>) => {
        const mockTx = {
          run: vi.fn().mockResolvedValue({
            records: [
              {
                get: vi.fn(() => ({
                  properties: {
                    id: "neo4j-id-001",
                    design_id: "design-001",
                    status: "approved",
                  },
                })),
              },
            ],
          }),
        };
        return fn(mockTx);
      });

      await expect(manager.approveProposal({
        designId: "design-001",
        groupId: "test-group",
        approverId: "user-001",
      })).rejects.toThrow(/status 'approved', cannot approve/);
    });

    it("should throw error for non-existent proposal", async () => {
      mockWriteTransaction.mockImplementation(async (fn: (tx: unknown) => Promise<unknown>) => {
        const mockTx = {
          run: vi.fn().mockResolvedValue({ records: [] }),
        };
        return fn(mockTx);
      });

      await expect(manager.approveProposal({
        designId: "non-existent",
        groupId: "test-group",
        approverId: "user-001",
      })).rejects.toThrow(/not found/);
    });

    it("should create active insight after approval", async () => {
      const createInsight = await import("../neo4j/queries/insert-insight");

      mockWriteTransaction.mockImplementation(async (fn: (tx: unknown) => Promise<unknown>) => {
        const mockTx = {
          run: vi.fn()
            .mockResolvedValueOnce({
              records: [
                {
                  get: vi.fn(() => ({
                    properties: {
                      id: "neo4j-id-001",
                      design_id: "design-001",
                      name: "Test Design",
                      version: { toNumber: () => 1 },
                      domain: "test-domain",
                      description: "Test design",
                      config: JSON.stringify({ model: { provider: "openai" } }),
                      source: "adas",
                      adas_run_id: "run-001",
                      score: { toNumber: () => 0.85 },
                      metrics: JSON.stringify({ accuracy: 0.85, cost: 0.05, latency: 450, composite: 0.82 }),
                      group_id: "test-group",
                      status: "pending_approval",
                      evidence_ref: "event:123",
                      created_at: new Date().toISOString(),
                    },
                  })),
                },
              ],
            })
            .mockResolvedValueOnce({
              records: [
                {
                  get: vi.fn(() => ({
                    properties: {
                      id: "neo4j-id-001",
                      design_id: "design-001",
                      name: "Test Design",
                      version: { toNumber: () => 1 },
                      domain: "test-domain",
                      description: "Test design",
                      config: JSON.stringify({ model: { provider: "openai" } }),
                      source: "adas",
                      adas_run_id: "run-001",
                      score: 0.85,
                      metrics: JSON.stringify({ accuracy: 0.85, cost: 0.05, latency: 450, composite: 0.82 }),
                      group_id: "test-group",
                      status: "approved",
                      approved_by: "user-001",
                      approved_at: new Date().toISOString(),
                    },
                  })),
                },
              ],
            }),
        };
        return fn(mockTx);
      });

      mockPool.query.mockResolvedValue({ rows: [] });

      await manager.approveProposal({
        designId: "design-001",
        groupId: "test-group",
        approverId: "user-001",
      });

      expect(createInsight.createInsight).toHaveBeenCalledWith(
        expect.objectContaining({
          insight_id: "adas-design-001",
          group_id: "test-group",
          source_type: "promotion",
        })
      );
    });
  });

  describe("rejectProposal", () => {
    it("should reject a pending proposal with reason", async () => {
      mockWriteTransaction.mockImplementation(async (fn: (tx: unknown) => Promise<unknown>) => {
        const mockTx = {
          run: vi.fn()
            .mockResolvedValueOnce({
              records: [
                {
                  get: vi.fn(() => ({
                    properties: {
                      id: "neo4j-id-001",
                      design_id: "design-001",
                      status: "pending_approval",
                    },
                  })),
                },
              ],
            })
            .mockResolvedValueOnce({
              records: [
                {
                  get: vi.fn(() => ({
                    properties: {
                      id: "neo4j-id-001",
                      design_id: "design-001",
                      status: "rejected",
                      rejection_reason: "Insufficient accuracy",
                    },
                  })),
                },
              ],
            }),
        };
        return fn(mockTx);
      });

      const result = await manager.rejectProposal({
        designId: "design-001",
        groupId: "test-group",
        rejectorId: "user-001",
        reason: "Insufficient accuracy",
      });

      expect(result.success).toBe(true);
      expect(result.status).toBe("rejected");
      expect(result.reason).toBe("Insufficient accuracy");
    });

    it("should require rejection reason", async () => {
      await expect(manager.rejectProposal({
        designId: "design-001",
        groupId: "test-group",
        rejectorId: "user-001",
        reason: "",
      })).rejects.toThrow(/Rejection reason is required/);
    });

    it("should reject rejection for non-pending proposals", async () => {
      mockWriteTransaction.mockImplementation(async (fn: (tx: unknown) => Promise<unknown>) => {
        const mockTx = {
          run: vi.fn().mockResolvedValue({
            records: [
              {
                get: vi.fn(() => ({
                  properties: {
                    id: "neo4j-id-001",
                    design_id: "design-001",
                    status: "rejected",
                  },
                })),
              },
            ],
          }),
        };
        return fn(mockTx);
      });

      await expect(manager.rejectProposal({
        designId: "design-001",
        groupId: "test-group",
        rejectorId: "user-001",
        reason: "Test reason",
      })).rejects.toThrow(/status 'rejected', cannot reject/);
    });
  });

  describe("getApprovalStatus", () => {
    it("should return approval status for pending proposal", async () => {
      mockWriteTransaction.mockImplementation(async (fn: (tx: unknown) => Promise<unknown>) => {
        const mockTx = {
          run: vi.fn().mockResolvedValue({
            records: [
              {
                get: vi.fn(() => ({
                  properties: {
                    id: "neo4j-id-001",
                    design_id: "design-001",
                    name: "Test Design",
                    version: { toNumber: () => 1 },
                    domain: "test-domain",
                    description: "Test",
                    config: "{}",
                    source: "adas",
                    score: { toNumber: () => 0.85 },
                    metrics: "{}",
                    group_id: "test-group",
                    status: "pending_approval",
                    evidence_ref: "event:123",
                    approved_by: null,
                    approved_at: null,
                    rejection_reason: null,
                    created_at: new Date().toISOString(),
                    updated_at: new Date().toISOString(),
                  },
                })),
              },
            ],
          }),
        };
        return fn(mockTx);
      });

      const status = await manager.getApprovalStatus("design-001", "test-group");

      expect(status).not.toBeNull();
      expect(status?.canApprove).toBe(true);
      expect(status?.canReject).toBe(true);
    });

    it("should return null for non-existent proposal", async () => {
      mockWriteTransaction.mockImplementation(async (fn: (tx: unknown) => Promise<unknown>) => {
        const mockTx = {
          run: vi.fn().mockResolvedValue({ records: [] }),
        };
        return fn(mockTx);
      });

      const status = await manager.getApprovalStatus("non-existent", "test-group");

      expect(status).toBeNull();
    });
  });

  describe("listProposalsByStatus", () => {
    it("should list all proposals with given status", async () => {
      mockWriteTransaction.mockImplementation(async (fn: (tx: unknown) => Promise<unknown>) => {
        const mockTx = {
          run: vi.fn().mockResolvedValue({
            records: [
              {
                get: vi.fn(() => ({
                  properties: {
                    id: "neo4j-id-001",
                    design_id: "design-001",
                    name: "Test Design 1",
                    version: { toNumber: () => 1 },
                    domain: "test-domain",
                    description: "Test",
                    config: "{}",
                    source: "adas",
                    score: { toNumber: () => 0.85 },
                    metrics: "{}",
                    group_id: "test-group",
                    status: "pending_approval",
                    evidence_ref: "event:1",
                    created_at: new Date().toISOString(),
                    updated_at: new Date().toISOString(),
                  },
                })),
              },
              {
                get: vi.fn(() => ({
                  properties: {
                    id: "neo4j-id-002",
                    design_id: "design-002",
                    name: "Test Design 2",
                    version: { toNumber: () => 1 },
                    domain: "test-domain",
                    description: "Test",
                    config: "{}",
                    source: "adas",
                    score: { toNumber: () => 0.78 },
                    metrics: "{}",
                    group_id: "test-group",
                    status: "pending_approval",
                    evidence_ref: "event:2",
                    created_at: new Date().toISOString(),
                    updated_at: new Date().toISOString(),
                  },
                })),
              },
            ],
          }),
        };
        return fn(mockTx);
      });

      const proposals = await manager.listProposalsByStatus("test-group", "pending_approval");

      expect(proposals).toHaveLength(2);
      expect(proposals[0]?.status).toBe("pending_approval");
    });
  });

  describe("approveProposal convenience function", () => {
    it("should approve proposal using default manager", async () => {
      mockWriteTransaction.mockImplementation(async (fn: (tx: unknown) => Promise<unknown>) => {
        const mockTx = {
          run: vi.fn()
            .mockResolvedValueOnce({
              records: [
                {
                  get: vi.fn(() => ({
                    properties: {
                      id: "neo4j-id-001",
                      design_id: "design-001",
                      status: "pending_approval",
                    },
                  })),
                },
              ],
            })
            .mockResolvedValueOnce({
              records: [
                {
                  get: vi.fn(() => ({
                    properties: {
                      id: "neo4j-id-001",
                      design_id: "design-001",
                      status: "approved",
                      approved_by: "user-001",
                      approved_at: new Date().toISOString(),
                    },
                  })),
                },
              ],
            }),
        };
        return fn(mockTx);
      });

      const result = await approveProposal("design-001", "test-group", "user-001");

      expect(result.success).toBe(true);
      expect(result.status).toBe("approved");
    });
  });

  describe("rejectProposal convenience function", () => {
    it("should reject proposal using default manager", async () => {
      mockWriteTransaction.mockImplementation(async (fn: (tx: unknown) => Promise<unknown>) => {
        const mockTx = {
          run: vi.fn()
            .mockResolvedValueOnce({
              records: [
                {
                  get: vi.fn(() => ({
                    properties: {
                      id: "neo4j-id-001",
                      design_id: "design-001",
                      status: "pending_approval",
                    },
                  })),
                },
              ],
            })
            .mockResolvedValueOnce({
              records: [
                {
                  get: vi.fn(() => ({
                    properties: {
                      id: "neo4j-id-001",
                      design_id: "design-001",
                      status: "rejected",
                      rejection_reason: "Test reason",
                    },
                  })),
                },
              ],
            }),
        };
        return fn(mockTx);
      });

      const result = await rejectProposal("design-001", "test-group", "user-001", "Test reason");

      expect(result.success).toBe(true);
      expect(result.status).toBe("rejected");
    });
  });
});