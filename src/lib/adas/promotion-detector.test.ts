import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from "vitest";
import {
  PromotionDetector,
  createPromotionDetector,
  scanForPromotionCandidates,
  getHighConfidenceDesigns,
  type PromotionConfig,
  type PromotionCandidate,
  DEFAULT_PROMOTION_CONFIG,
} from "./promotion-detector";
import type { Pool } from "pg";
import type { EvaluationMetrics } from "./types";

vi.mock("../postgres/connection", () => ({
  getPool: vi.fn(),
}));

vi.mock("../postgres/queries/insert-trace", () => ({
  insertEvent: vi.fn().mockResolvedValue({ id: 1 }),
  insertOutcome: vi.fn().mockResolvedValue({ id: 1 }),
}));

describe("PromotionDetector", () => {
  let mockPool: { query: ReturnType<typeof vi.fn> };
  let detector: PromotionDetector;

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

  const createMockRun = (overrides: Partial<{
    run_id: string;
    group_id: string;
    domain: string;
    best_design_id: string | null;
    best_score: number | null;
    status: string;
    completed_at: Date | null;
  }> = {}): {
    run_id: string;
    group_id: string;
    domain: string;
    best_design_id: string | null;
    best_score: number | null;
    status: string;
    completed_at: Date | null;
  } => ({
    run_id: "run-001",
    group_id: "test-group",
    domain: "test-domain",
    best_design_id: "design-001",
    best_score: 0.85,
    status: "completed",
    completed_at: new Date(),
    ...overrides,
  });

  beforeAll(async () => {
    mockPool = {
      query: vi.fn(),
    };
    const pg = await import("../postgres/connection");
    vi.mocked(pg.getPool).mockReturnValue(mockPool as unknown as Pool);
  });

  beforeEach(() => {
    vi.clearAllMocks();
    mockPool.query.mockReset();
    detector = new PromotionDetector({
      groupId: "test-group",
      confidenceThreshold: 0.7,
    });
  });

  describe("DEFAULT_PROMOTION_CONFIG", () => {
    it("should have confidence threshold of 0.7", () => {
      expect(DEFAULT_PROMOTION_CONFIG.confidenceThreshold).toBe(0.7);
    });

    it("should require trace evidence by default", () => {
      expect(DEFAULT_PROMOTION_CONFIG.requireTraceEvidence).toBe(true);
    });

    it("should have minimum test cases requirement", () => {
      expect(DEFAULT_PROMOTION_CONFIG.minTestCases).toBe(1);
    });
  });

  describe("scanForCandidates", () => {
    it("should find candidates with score >= threshold", async () => {
      mockPool.query.mockResolvedValueOnce({
        rows: [createMockRun({ best_score: 0.75 })],
      });

      mockPool.query.mockResolvedValueOnce({
        rows: [{
          event_id: 1,
          outcome_id: 1,
          design_id: "design-001",
          run_id: "run-001",
          accuracy: "0.75",
          composite: "0.75",
          cost: "0.05",
          latency: "450",
          timestamp: new Date(),
        }],
      });

      mockPool.query.mockResolvedValueOnce({ rows: [] });

      const result = await detector.scanForCandidates();

      expect(result.runsScanned).toBe(1);
      expect(result.candidatesFound).toBe(1);
    });

    it("should skip candidates below threshold", async () => {
      mockPool.query.mockResolvedValueOnce({
        rows: [createMockRun({ best_score: 0.65 })],
      });

      const result = await detector.scanForCandidates();

      expect(result.runsScanned).toBe(1);
      expect(result.candidatesFound).toBe(0);
    });

    it("should filter by domain when specified", async () => {
      const domainDetector = new PromotionDetector({
        groupId: "test-group",
        confidenceThreshold: 0.7,
        domain: "specific-domain",
      });

      mockPool.query.mockResolvedValueOnce({
        rows: [createMockRun({ domain: "specific-domain", best_score: 0.80 })],
      });

      mockPool.query.mockResolvedValueOnce({
        rows: [{
          event_id: 1,
          outcome_id: 1,
          design_id: "design-001",
          run_id: "run-001",
          accuracy: "0.80",
          composite: "0.80",
          cost: "0.05",
          latency: "450",
          timestamp: new Date(),
        }],
      });

      mockPool.query.mockResolvedValueOnce({ rows: [] });

      mockPool.query.mockResolvedValueOnce({ rows: [] });

      const result = await domainDetector.scanForCandidates();

      expect(result.candidatesFound).toBe(1);
    });

    it("should skip runs without best_design_id", async () => {
      mockPool.query.mockResolvedValueOnce({
        rows: [createMockRun({ best_design_id: null })],
      });

      mockPool.query.mockResolvedValueOnce({ rows: [] });

      const result = await detector.scanForCandidates();

      expect(result.candidatesFound).toBe(0);
    });

    it("should log detection run to PostgreSQL", async () => {
      mockPool.query.mockResolvedValueOnce({ rows: [] });
      mockPool.query.mockResolvedValueOnce({ rows: [] });

      const insertEvent = await import("../postgres/queries/insert-trace");
      await detector.scanForCandidates();

      expect(insertEvent.insertEvent).toHaveBeenCalled();
    });
  });

  describe("verifyEvidenceCompleteness", () => {
    it("should pass when evidence is complete", () => {
      const candidate: PromotionCandidate = {
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
          description: "Test",
          config: {},
        },
        metrics: {
          ...defaultMetrics,
          details: {
            testCasesExecuted: 10,
            testCasesPassed: 9,
          },
        },
        evidenceRef: "event:123",
        evaluatedAt: new Date(),
        status: "candidate",
      };

      const result = detector.verifyEvidenceCompleteness(candidate);
      expect(result).toBe(true);
    });

    it("should fail when evidence ref is missing", () => {
      const candidate: PromotionCandidate = {
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
          description: "Test",
          config: {},
        },
        metrics: defaultMetrics,
        evidenceRef: "",
        evaluatedAt: new Date(),
        status: "candidate",
      };

      const result = detector.verifyEvidenceCompleteness(candidate);
      expect(result).toBe(false);
    });

    it("should fail when minimum test cases not met", () => {
      const candidate: PromotionCandidate = {
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
          description: "Test",
          config: {},
        },
        metrics: {
          ...defaultMetrics,
          details: {
            testCasesExecuted: 0,
            testCasesPassed: 0,
          },
        },
        evidenceRef: "event:123",
        evaluatedAt: new Date(),
        status: "candidate",
      };

      const result = detector.verifyEvidenceCompleteness(candidate);
      expect(result).toBe(false);
    });
  });

  describe("getHighConfidenceDesigns", () => {
    it("should return only designs meeting threshold", async () => {
      mockPool.query.mockImplementation(() => Promise.resolve({
        rows: [
          {
            design_id: "design-001",
            run_id: "run-001",
            group_id: "test-group",
            domain: "test-domain",
            score: "0.85",
            status: "candidate",
            evidence_ref: "event:1",
            created_at: new Date().toISOString(),
            design_data: JSON.stringify({ design_id: "design-001", name: "Test", version: "1.0", domain: "test-domain", description: "Test", config: {} }),
            metrics: JSON.stringify({ accuracy: 0.85, cost: 0.05, latency: 450, composite: 0.82 }),
          },
        ],
      }));

      const designs = await detector.getHighConfidenceDesigns();

      expect(designs).toHaveLength(1);
      if (designs.length > 0 && designs[0]) {
        expect(designs[0].score).toBeGreaterThanOrEqual(0.7);
      }
    });

    it("should filter by custom minimum score", async () => {
      mockPool.query.mockImplementation(() => Promise.resolve({
        rows: [
          {
            design_id: "design-001",
            run_id: "run-001",
            group_id: "test-group",
            domain: "test-domain",
            score: "0.90",
            status: "candidate",
            evidence_ref: "event:1",
            created_at: new Date().toISOString(),
            design_data: JSON.stringify({ design_id: "design-001", name: "Test", version: "1.0", domain: "test-domain", description: "Test", config: {} }),
            metrics: JSON.stringify({ accuracy: 0.90, cost: 0.05, latency: 450, composite: 0.88 }),
          },
        ],
      }));

      const designs = await detector.getHighConfidenceDesigns(0.85);

      expect(designs).toHaveLength(1);
      if (designs.length > 0 && designs[0]) {
        expect(designs[0].score).toBeGreaterThanOrEqual(0.85);
      }
    });
  });

  describe("createPromotionDetector", () => {
    it("should create detector with default config", () => {
      const d = createPromotionDetector({ groupId: "test-group", confidenceThreshold: 0.7 });
      expect(d).toBeInstanceOf(PromotionDetector);
    });

    it("should merge custom config with defaults", () => {
      const d = createPromotionDetector({
        groupId: "test-group",
        confidenceThreshold: 0.8,
      });
      expect(d).toBeInstanceOf(PromotionDetector);
    });
  });

  describe("scanForPromotionCandidates convenience function", () => {
    it("should scan and return candidates", async () => {
      mockPool.query.mockResolvedValueOnce({ rows: [] });
      mockPool.query.mockResolvedValueOnce({ rows: [] });

      const result = await scanForPromotionCandidates("test-group");

      expect(result).toHaveProperty("runsScanned");
      expect(result).toHaveProperty("candidatesFound");
      expect(result).toHaveProperty("candidates");
    });
  });

  describe("getHighConfidenceDesigns convenience function", () => {
    it("should return high-confidence designs", async () => {
      mockPool.query.mockResolvedValueOnce({ rows: [] });

      const designs = await getHighConfidenceDesigns("test-group");

      expect(Array.isArray(designs)).toBe(true);
    });
  });
});