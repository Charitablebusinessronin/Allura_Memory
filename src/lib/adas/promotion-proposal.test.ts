import { describe, it, expect, beforeAll, beforeEach, vi } from "vitest";
import {
  PromotionProposalManager,
  createPromotionProposal,
  getPendingProposals,
  type CreateProposalPayload,
  type CreateProposalResult,
  type AgentDesignNode,
} from "./promotion-proposal";
import type { PromotionCandidate, PromotionStatus } from "./promotion-detector";
import type { EvaluationMetrics } from "./types";

vi.mock("../neo4j/connection", () => ({
  writeTransaction: vi.fn(),
}));

vi.mock("../postgres/connection", () => ({
  getPool: vi.fn(),
}));

vi.mock("../postgres/queries/insert-trace", () => ({
  insertEvent: vi.fn().mockResolvedValue({ id: 1 }),
  insertOutcome: vi.fn().mockResolvedValue({ id: 1 }),
}));

vi.mock("../neo4j/queries/insert-insight", () => ({
  createInsight: vi.fn(),
  createInsightVersion: vi.fn(),
}));

describe("PromotionProposalManager", () => {
  let manager: PromotionProposalManager;
  let mockPool: { query: ReturnType<typeof vi.fn> };
  let mockWriteTransaction: ReturnType<typeof vi.fn>;

  const defaultMetrics: EvaluationMetrics = {
    accuracy: 0.85,
    cost: 0.05,
    latency: 450,
    composite: 0.82,
    tokens: {
      promptTokens: 1000,
      completionTokens: 500,
      totalTokens: 1500,
    },
    details: {
      testCasesExecuted: 10,
      testCasesPassed: 9,
    },
  };

  const createTestCandidate = (overrides: Partial<PromotionCandidate> = {}): PromotionCandidate => ({
    designId: "design-001",
    runId: "run-001",
    groupId: "test-group",
    domain: "test-domain",
    score: 0.85,
    design: {
      design_id: "design-001",
      name: "Test Design",
      version: "1.0",
      domain: "test-domain",
      description: "A test design for promotion",
      config: {
        systemPrompt: "Test prompt",
        model: {
          provider: "ollama", modelId: "qwen3-coder-next:cloud", tier: "stable",
        },
      },
    },
    metrics: defaultMetrics,
    evidenceRef: "event:123",
    evaluatedAt: new Date(),
    status: "candidate",
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
    manager = new PromotionProposalManager();

    mockPool.query.mockResolvedValue({ rows: [] });

    mockWriteTransaction.mockImplementation(async (fn: (tx: unknown) => Promise<unknown>) => {
      const mockTx = {
        run: vi.fn().mockResolvedValue({
          records: [
            {
              get: vi.fn((key: string) => ({
                properties: {
                  id: "neo4j-id-001",
                  design_id: "design-001",
                  name: "adas-promotion-design-001",
                  version: { toNumber: () => 1 },
                  domain: "test-domain",
                  description: "ADAS-generated design",
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
        }),
      };
      return fn(mockTx);
    });
  });

  describe("createProposal", () => {
    it("should create proposal for promotion candidate", async () => {
      const candidate = createTestCandidate();
      const payload: CreateProposalPayload = {
        candidate,
        groupId: "test-group",
      };

      mockWriteTransaction.mockImplementation(async (fn: (tx: unknown) => Promise<unknown>) => {
        const mockTx = {
          run: vi.fn()
            .mockResolvedValueOnce({ records: [] })
            .mockResolvedValueOnce({ records: [] })
            .mockResolvedValueOnce({
              records: [
                {
                  get: vi.fn(() => ({
                    properties: {
                      id: "neo4j-id-001",
                      design_id: "design-001",
                      version: { toNumber: () => 1 },
                      status: "pending_approval",
                      evidence_ref: "event:123",
                      created_at: new Date().toISOString(),
                    },
                  })),
                },
              ],
            }),
        };
        return fn(mockTx);
      });

      const result = await manager.createProposal(payload);

      expect(result.success).toBe(true);
      expect(result.designId).toBe("design-001");
      expect(result.status).toBe("pending_approval");
    });

    it("should reject duplicate proposals", async () => {
      const candidate = createTestCandidate();

      mockWriteTransaction.mockImplementation(async (fn: (tx: unknown) => Promise<unknown>) => {
        const mockTx = {
          run: vi.fn().mockResolvedValue({
            records: [
              {
                get: vi.fn(() => ({
                  properties: {
                    id: "existing-neo4j-id",
                    design_id: "design-001",
                    version: { toNumber: () => 1 },
                    status: "pending_approval",
                    evidence_ref: "event:123",
                    created_at: new Date().toISOString(),
                  },
                })),
              },
            ],
          }),
        };
        return fn(mockTx);
      });

      const result = await manager.createProposal({
        candidate,
        groupId: "test-group",
      });

      expect(result.designId).toBe("design-001");
    });

    it("should link to PostgreSQL evidence", async () => {
      const candidate = createTestCandidate({ evidenceRef: "event:456" });

      mockWriteTransaction.mockImplementation(async (fn: (tx: unknown) => Promise<unknown>) => {
        const mockTx = {
          run: vi.fn()
            .mockResolvedValueOnce({ records: [] })
            .mockResolvedValueOnce({ records: [] })
            .mockResolvedValueOnce({
              records: [
                {
                  get: vi.fn(() => ({
                    properties: {
                      id: "neo4j-id-001",
                      design_id: "design-001",
                      version: { toNumber: () => 1 },
                      status: "pending_approval",
                      evidence_ref: "event:456",
                      created_at: new Date().toISOString(),
                    },
                  })),
                },
              ],
            }),
        };
        return fn(mockTx);
      });

      const result = await manager.createProposal({
        candidate,
        groupId: "test-group",
      });

      expect(result.evidenceRef).toBe("event:456");
    });
  });

  describe("getPendingProposals", () => {
    it("should return all pending proposals for group", async () => {
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
                    adas_run_id: "run-001",
                    score: { toNumber: () => 0.85 },
                    metrics: "{}",
                    group_id: "test-group",
                    status: "pending_approval",
                    evidence_ref: "event:1",
                    approved_by: null,
                    approved_at: null,
                    rejection_reason: null,
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
                    adas_run_id: "run-002",
                    score: { toNumber: () => 0.78 },
                    metrics: "{}",
                    group_id: "test-group",
                    status: "pending_approval",
                    evidence_ref: "event:2",
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

      const proposals = await manager.getPendingProposals("test-group");

      expect(proposals).toHaveLength(2);
      expect(proposals[0]?.status).toBe("pending_approval");
    });
  });

  describe("getProposal", () => {
    it("should return proposal by design ID", async () => {
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
                    evidence_ref: "event:1",
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

      const proposal = await manager.getProposal("design-001", "test-group");

      expect(proposal).not.toBeNull();
      expect(proposal?.design_id).toBe("design-001");
    });

    it("should return null for non-existent proposal", async () => {
      mockWriteTransaction.mockImplementation(async (fn: (tx: unknown) => Promise<unknown>) => {
        const mockTx = {
          run: vi.fn().mockResolvedValue({ records: [] }),
        };
        return fn(mockTx);
      });

      const proposal = await manager.getProposal("non-existent", "test-group");

      expect(proposal).toBeNull();
    });
  });

  describe("createPromotionProposal convenience function", () => {
    it("should create proposal using default manager", async () => {
      const candidate = createTestCandidate();

      mockWriteTransaction.mockImplementation(async (fn: (tx: unknown) => Promise<unknown>) => {
        const mockTx = {
          run: vi.fn()
            .mockResolvedValueOnce({ records: [] })
            .mockResolvedValueOnce({ records: [] })
            .mockResolvedValueOnce({
              records: [
                {
                  get: vi.fn(() => ({
                    properties: {
                      id: "neo4j-id-001",
                      design_id: "design-001",
                      version: { toNumber: () => 1 },
                      status: "pending_approval",
                      evidence_ref: "event:123",
                      created_at: new Date().toISOString(),
                    },
                  })),
                },
              ],
            }),
        };
        return fn(mockTx);
      });

      const result = await createPromotionProposal(candidate, "test-group");

      expect(result.success).toBe(true);
      expect(result.designId).toBe("design-001");
    });
  });

  describe("getPendingProposals convenience function", () => {
    it("should return pending proposals", async () => {
      mockWriteTransaction.mockImplementation(async (fn: (tx: unknown) => Promise<unknown>) => {
        const mockTx = {
          run: vi.fn().mockResolvedValue({ records: [] }),
        };
        return fn(mockTx);
      });

      const proposals = await getPendingProposals("test-group");

      expect(Array.isArray(proposals)).toBe(true);
    });
  });
});