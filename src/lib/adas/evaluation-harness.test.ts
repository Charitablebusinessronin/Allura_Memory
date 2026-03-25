import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { getPool, closePool } from "../postgres/connection";
import { initializeSchema } from "../postgres/schema/index";
import {
  EvaluationHarness,
  createEvaluationHarness,
  evaluateCandidate,
  evaluateAndRankCandidates,
} from "./evaluation-harness";
import type {
  AgentDesign,
  DomainConfig,
  ForwardFn,
} from "./types";

describe("Evaluation Harness", () => {
  beforeAll(async () => {
    process.env.POSTGRES_HOST = process.env.POSTGRES_HOST || "localhost";
    process.env.POSTGRES_PORT = process.env.POSTGRES_PORT || "5432";
    process.env.POSTGRES_DB = process.env.POSTGRES_DB || "memory";
    process.env.POSTGRES_USER = process.env.POSTGRES_USER || "ronin4life";
    process.env.POSTGRES_PASSWORD = process.env.POSTGRES_PASSWORD || "KaminaTHC*";

    const result = await initializeSchema();
    expect(result.success).toBe(true);
  });

  afterAll(async () => {
    await closePool();
  });

  describe("AC1: Harness evaluates design and returns structured score", () => {
    it("should evaluate a simple candidate design and return metrics", async () => {
      const domain: DomainConfig = {
        domainId: "test-domain",
        name: "Test Domain",
        description: "A test domain for evaluation",
        groundTruth: [
          {
            id: "test-1",
            input: "What is 2+2?",
            expectedOutput: "4",
          },
          {
            id: "test-2",
            input: "What is 3+3?",
            expectedOutput: "6",
          },
        ],
        accuracyWeight: 0.5,
        costWeight: 0.25,
        latencyWeight: 0.25,
      };

      const design: AgentDesign = {
        design_id: "test-design-001",
        name: "Test Agent",
        version: "1.0.0",
        domain: "test-domain",
        description: "A simple test agent",
        config: {
          model: {
            provider: "ollama",
            modelId: "qwen3-coder-next:cloud",
            tier: "stable",
          },
        },
      };

      const forwardFn: ForwardFn = async (input: unknown) => {
        const inputStr = String(input);
        if (inputStr.includes("2+2")) return "4";
        if (inputStr.includes("3+3")) return "6";
        return "unknown";
      };

      const harness = createEvaluationHarness({
        groupId: "test-group-ac1",
        domain,
      });

      const result = await harness.evaluateCandidate(design, forwardFn);

      expect(result.design).toBeDefined();
      expect(result.design.design_id).toBe("test-design-001");
      expect(result.metrics).toBeDefined();
      expect(result.metrics.accuracy).toBeGreaterThanOrEqual(0);
      expect(result.metrics.accuracy).toBeLessThanOrEqual(1);
      expect(result.metrics.cost).toBeGreaterThanOrEqual(0);
      expect(result.metrics.latency).toBeGreaterThanOrEqual(0);
      expect(result.metrics.composite).toBeGreaterThanOrEqual(0);
      expect(result.metrics.composite).toBeLessThanOrEqual(1);
      expect(result.runId).toBeDefined();
      expect(result.groupId).toBe("test-group-ac1");
      expect(result.evaluatedAt).toBeInstanceOf(Date);
    });

    it("should compute accuracy against ground truth", async () => {
      const domain: DomainConfig = {
        domainId: "math-domain",
        name: "Math Domain",
        groundTruth: [
          { id: "add-1", input: "1+1", expectedOutput: "2" },
          { id: "add-2", input: "2+2", expectedOutput: "4" },
          { id: "add-3", input: "3+3", expectedOutput: "6" },
          { id: "add-4", input: "5+5", expectedOutput: "10" },
        ],
        minAccuracy: 0.75,
      };

      const design: AgentDesign = {
        design_id: "math-agent-001",
        name: "Math Agent",
        version: "1.0.0",
        domain: "math-domain",
        description: "Basic math agent",
        config: {
          model: { provider: "ollama", modelId: "qwen3-coder-next:cloud", tier: "stable" },
        },
      };

      const forwardFn: ForwardFn = async (input: unknown) => {
        const answers: Record<string, string> = {
          "1+1": "2",
          "2+2": "4",
          "3+3": "6",
          "5+5": "wrong",
        };
        return answers[String(input)] ?? "unknown";
      };

      const harness = new EvaluationHarness({
        groupId: "test-group-accuracy",
        domain,
      });

      const result = await harness.evaluateCandidate(design, forwardFn);

      expect(result.metrics.accuracy).toBe(0.75);
      expect(result.passed).toBe(true);
    });

    it("should track token usage", async () => {
      const domain: DomainConfig = {
        domainId: "token-domain",
        name: "Token Test Domain",
        groundTruth: [
          { id: "test-1", input: "Hello", expectedOutput: "World" },
        ],
      };

      const design: AgentDesign = {
        design_id: "token-agent-001",
        name: "Token Agent",
        version: "1.0.0",
        domain: "token-domain",
        description: "Token tracking agent",
        config: {
          model: { provider: "ollama", modelId: "qwen3-coder-next:cloud", tier: "stable" },
        },
      };

      const forwardFn: ForwardFn = async () => "World";

      const harness = new EvaluationHarness({
        groupId: "test-group-tokens",
        domain,
      });

      const result = await harness.evaluateCandidate(design, forwardFn);

      expect(result.metrics.tokens).toBeDefined();
      expect(result.metrics.tokens?.promptTokens).toBeGreaterThan(0);
      expect(result.metrics.tokens?.completionTokens).toBeGreaterThan(0);
      expect(result.metrics.tokens?.totalTokens).toBeGreaterThan(0);
    });

    it("should measure latency accurately", async () => {
      const domain: DomainConfig = {
        domainId: "latency-domain",
        name: "Latency Test Domain",
        groundTruth: [
          { id: "test-1", input: "test", expectedOutput: "result" },
        ],
      };

      const design: AgentDesign = {
        design_id: "latency-agent-001",
        name: "Latency Agent",
        version: "1.0.0",
        domain: "latency-domain",
        description: "Latency testing agent",
        config: {
          model: { provider: "ollama", modelId: "deepseek-v3.2:cloud", tier: "stable" },
        },
      };

      const forwardFn: ForwardFn = async () => {
        await new Promise((resolve) => setTimeout(resolve, 50));
        return "result";
      };

      const harness = new EvaluationHarness({
        groupId: "test-group-latency",
        domain,
      });

      const result = await harness.evaluateCandidate(design, forwardFn);

      // Latency may be slightly under 50ms on fast systems - allow for variance
      expect(result.metrics.latency).toBeGreaterThanOrEqual(40);
    });
  });

  describe("AC2: Metrics are logged to raw trace layer", () => {
    it("should create adas_runs record on evaluation", async () => {
      const domain: DomainConfig = {
        domainId: "log-domain",
        name: "Logging Test Domain",
        groundTruth: [
          { id: "test-1", input: "test", expectedOutput: "result" },
        ],
      };

      const design: AgentDesign = {
        design_id: "log-agent-001",
        name: "Log Agent",
        version: "1.0.0",
        domain: "log-domain",
        description: "Test logging agent",
        config: {
          model: { provider: "ollama", modelId: "qwen3-coder-next:cloud", tier: "stable" },
        },
      };

      const forwardFn: ForwardFn = async () => "result";

      const harness = new EvaluationHarness({
        groupId: "test-group-logging",
        domain,
      });

      const runId = harness.getRunId();
      expect(runId).toBeDefined();

      const result = await harness.evaluateCandidate(design, forwardFn);

      expect(result.runId).toBe(runId);

      const pool = getPool();
      const runResult = await pool.query(
        "SELECT * FROM adas_runs WHERE run_id = $1",
        [runId]
      );

      expect(runResult.rows).toHaveLength(1);
      const run = runResult.rows[0];
      expect(run.group_id).toBe("test-group-logging");
      expect(run.domain).toBe("log-domain");
      expect(run.status).toBe("completed");
      expect(run.best_design_id).toBe("log-agent-001");
    });

    it("should store metrics in outcomes linked to events", async () => {
      const domain: DomainConfig = {
        domainId: "outcome-domain",
        name: "Outcome Test Domain",
        groundTruth: [
          { id: "test-1", input: "test", expectedOutput: "result" },
        ],
      };

      const design: AgentDesign = {
        design_id: "outcome-agent-001",
        name: "Outcome Agent",
        version: "1.0.0",
        domain: "outcome-domain",
        description: "Test outcome storage",
        config: {
          model: { provider: "ollama", modelId: "qwen3-coder-next:cloud", tier: "stable" },
        },
      };

      const forwardFn: ForwardFn = async () => "result";

      const harness = new EvaluationHarness({
        groupId: "test-group-outcomes",
        domain,
      });

      await harness.evaluateCandidate(design, forwardFn);

      const pool = getPool();

      const eventsResult = await pool.query(
        `SELECT * FROM events 
         WHERE group_id = $1 
         AND event_type = 'evaluation_completed' 
         ORDER BY created_at DESC 
         LIMIT 1`,
        ["test-group-outcomes"]
      );

      expect(eventsResult.rows).toHaveLength(1);

      const event = eventsResult.rows[0];
      expect(event.metadata).toBeDefined();
      expect(event.metadata.runId).toBeDefined();
      expect(event.metadata.designId).toBe("outcome-agent-001");

      const outcomesResult = await pool.query(
        `SELECT * FROM outcomes 
         WHERE event_id = $1`,
        [event.id]
      );

      expect(outcomesResult.rows).toHaveLength(1);

      const outcome = outcomesResult.rows[0];
      expect(outcome.outcome_type).toBe("evaluation_metrics");
      expect(outcome.data.designId).toBe("outcome-agent-001");
      expect(outcome.data.accuracy).toBeGreaterThanOrEqual(0);
      expect(outcome.data.cost).toBeGreaterThanOrEqual(0);
      expect(outcome.data.latency).toBeGreaterThanOrEqual(0);
      expect(outcome.data.composite).toBeGreaterThanOrEqual(0);
    });

    it("should log evaluation_started event", async () => {
      const domain: DomainConfig = {
        domainId: "start-domain",
        name: "Start Test Domain",
        groundTruth: [
          { id: "test-1", input: "test", expectedOutput: "result" },
        ],
      };

      const design: AgentDesign = {
        design_id: "start-agent-001",
        name: "Start Agent",
        version: "1.0.0",
        domain: "start-domain",
        description: "Test start logging",
        config: {
          model: { provider: "ollama", modelId: "qwen3-coder-next:cloud", tier: "stable" },
        },
      };

      const harness = new EvaluationHarness({
        groupId: "test-group-start",
        domain,
      });

      await harness.evaluateCandidate(design, async () => "result");

      const pool = getPool();
      const eventsResult = await pool.query(
        `SELECT * FROM events 
         WHERE group_id = $1 
         AND event_type = 'evaluation_started'`,
        ["test-group-start"]
      );

      expect(eventsResult.rows.length).toBeGreaterThanOrEqual(1);
      const startEvent = eventsResult.rows[0];
      expect(startEvent.metadata.domain).toBe("start-domain");
    });
  });

  describe("AC3: Rank candidates by composite score", () => {
    it("should rank multiple candidates correctly", async () => {
      const domain: DomainConfig = {
        domainId: "rank-domain",
        name: "Ranking Test Domain",
        groundTruth: [
          { id: "test-1", input: "1+1", expectedOutput: "2" },
          { id: "test-2", input: "2+2", expectedOutput: "4" },
        ],
        accuracyWeight: 0.5,
        costWeight: 0.25,
        latencyWeight: 0.25,
      };

      const designA: AgentDesign = {
        design_id: "rank-agent-a",
        name: "Agent A",
        version: "1.0.0",
        domain: "rank-domain",
        description: "Higher accuracy agent",
        config: {
          model: { provider: "ollama", modelId: "deepseek-v3.2:cloud", tier: "stable" },
        },
      };

      const designB: AgentDesign = {
        design_id: "rank-agent-b",
        name: "Agent B",
        version: "1.0.0",
        domain: "rank-domain",
        description: "Lower accuracy agent",
        config: {
          model: { provider: "ollama", modelId: "minimax-m2.7:cloud", tier: "experimental" },
        },
      };

      const forwardFnA: ForwardFn = async () => {
        await new Promise((resolve) => setTimeout(resolve, 10));
        return "correct";
      };

      const forwardFnB: ForwardFn = async () => {
        await new Promise((resolve) => setTimeout(resolve, 5));
        if (Math.random() > 0.5) return "correct";
        return "wrong";
      };

      const candidates = [
        { design: designA, forwardFn: forwardFnA },
        { design: designB, forwardFn: forwardFnB },
      ];

      const harness = createEvaluationHarness({
        groupId: "test-group-ranking",
        domain,
      });

      const ranking = await harness.evaluateAndRank(candidates);

      expect(ranking).toHaveLength(2);

      expect(ranking[0]?.rank).toBe(1);
      expect(ranking[1]?.rank).toBe(2);

      for (let i = 1; i < ranking.length; i++) {
        if (ranking[i - 1] && ranking[i]) {
          expect(ranking[i - 1].composite).toBeGreaterThanOrEqual(
            ranking[i].composite
          );
        }
      }
    });

    it("should include all metric components in ranking", async () => {
      const domain: DomainConfig = {
        domainId: "component-domain",
        name: "Component Test Domain",
        groundTruth: [
          { id: "test-1", input: "test", expectedOutput: "result" },
        ],
      };

      const design: AgentDesign = {
        design_id: "component-agent-001",
        name: "Component Agent",
        version: "1.0.0",
        domain: "component-domain",
        description: "Test component metrics",
        config: {
          model: { provider: "ollama", modelId: "qwen3-coder-next:cloud", tier: "stable" },
        },
      };

      const ranking = await evaluateAndRankCandidates(
        [{ design, forwardFn: async () => "result" }],
        domain,
        "test-group-components"
      );

      expect(ranking).toHaveLength(1);
      expect(ranking[0]).toBeDefined();
      
      const entry = ranking[0]!;
      expect(entry.composite).toBeGreaterThanOrEqual(0);
      expect(entry.accuracy).toBeGreaterThanOrEqual(0);
      expect(entry.accuracy).toBeLessThanOrEqual(1);
      expect(entry.cost).toBeGreaterThanOrEqual(0);
      expect(entry.latency).toBeGreaterThanOrEqual(0);
      expect(entry.rank).toBe(1);
    });
  });

  describe("Edge cases and error handling", () => {
    it("should handle empty ground truth", async () => {
      const domain: DomainConfig = {
        domainId: "empty-domain",
        name: "Empty Test Domain",
        groundTruth: [],
      };

      const design: AgentDesign = {
        design_id: "empty-agent-001",
        name: "Empty Agent",
        version: "1.0.0",
        domain: "empty-domain",
        description: "Agent with no test cases",
        config: {
          model: { provider: "ollama", modelId: "qwen3-coder-next:cloud", tier: "stable" },
        },
      };

      const harness = new EvaluationHarness({
        groupId: "test-group-empty",
        domain,
      });

      const result = await harness.evaluateCandidate(design, async () => "result");

      expect(result.metrics.accuracy).toBe(0);
      expect(result.details?.testCasesExecuted).toBe(0);
    });

    it("should handle timeout in forward function", async () => {
      const domain: DomainConfig = {
        domainId: "timeout-domain",
        name: "Timeout Test Domain",
        groundTruth: [
          { id: "test-1", input: "test", expectedOutput: "result" },
        ],
      };

      const design: AgentDesign = {
        design_id: "timeout-agent-001",
        name: "Timeout Agent",
        version: "1.0.0",
        domain: "timeout-domain",
        description: "Agent that times out",
        config: {
          model: { provider: "ollama", modelId: "qwen3-coder-next:cloud", tier: "stable" },
        },
      };

      const forwardFn: ForwardFn = async () => {
        await new Promise((resolve) => setTimeout(resolve, 5000));
        return "result";
      };

      const harness = new EvaluationHarness({
        groupId: "test-group-timeout",
        domain,
        timeout: 100,
      });

      const result = await harness.evaluateCandidate(design, forwardFn);

      expect(result.metrics.accuracy).toBeLessThan(1);
    });

    it("should handle errors in forward function gracefully", async () => {
      const domain: DomainConfig = {
        domainId: "error-domain",
        name: "Error Test Domain",
        groundTruth: [
          { id: "test-1", input: "test", expectedOutput: "result" },
          { id: "test-2", input: "error", expectedOutput: "should-not-matter" },
        ],
      };

      const design: AgentDesign = {
        design_id: "error-agent-001",
        name: "Error Agent",
        version: "1.0.0",
        domain: "error-domain",
        description: "Agent with errors",
        config: {
          model: { provider: "ollama", modelId: "qwen3-coder-next:cloud", tier: "stable" },
        },
      };

      const forwardFn: ForwardFn = async (input: unknown) => {
        if (String(input) === "error") {
          throw new Error("Forward function error");
        }
        return "result";
      };

      const harness = new EvaluationHarness({
        groupId: "test-group-error",
        domain,
      });

      const result = await harness.evaluateCandidate(design, forwardFn);

      expect(result.metrics.accuracy).toBe(0.5);
    });
  });

  describe("Convenience functions", () => {
    it("should provide evaluateCandidate helper", async () => {
      const domain: DomainConfig = {
        domainId: "helper-domain",
        name: "Helper Test Domain",
        groundTruth: [{ id: "test-1", input: "test", expectedOutput: "result" }],
      };

      const design: AgentDesign = {
        design_id: "helper-agent-001",
        name: "Helper Agent",
        version: "1.0.0",
        domain: "helper-domain",
        description: "Test helper function",
        config: {
          model: { provider: "ollama", modelId: "qwen3-coder-next:cloud", tier: "stable" },
        },
      };

      const result = await evaluateCandidate(
        design,
        async () => "result",
        domain,
        "test-group-helper"
      );

      expect(result).toBeDefined();
      expect(result.metrics).toBeDefined();
    });

    it("should provide evaluateAndRankCandidates helper", async () => {
      const domain: DomainConfig = {
        domainId: "rank-helper-domain",
        name: "Rank Helper Test Domain",
        groundTruth: [{ id: "test-1", input: "test", expectedOutput: "result" }],
      };

      const design: AgentDesign = {
        design_id: "rank-helper-agent-001",
        name: "Rank Helper Agent",
        version: "1.0.0",
        domain: "rank-helper-domain",
        description: "Test rank helper function",
        config: {
          model: { provider: "ollama", modelId: "qwen3-coder-next:cloud", tier: "stable" },
        },
      };

      const ranking = await evaluateAndRankCandidates(
        [{ design, forwardFn: async () => "result" }],
        domain,
        "test-group-rank-helper"
      );

      expect(ranking).toBeDefined();
      expect(ranking).toHaveLength(1);
      expect(ranking[0]?.designId).toBe("rank-helper-agent-001");
    });
  });
});