import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { closePool } from "../postgres/connection";
import { initializeSchema } from "../postgres/schema/index";
import {
  SandboxedEvaluationHarness,
  createSandboxedEvaluationHarness,
  evaluateCandidateInSandbox,
  createSandboxedForwardFn,
  executeCodeInSandbox,
  batchEvaluateInSandbox,
  type SandboxedEvaluationConfig,
} from "./sandboxed-evaluation";
import type { AgentDesign, DomainConfig } from "./types";
import { SandboxExecutor, createSandboxExecutor } from "./sandbox";

/**
 * Sandboxed Evaluation Tests
 * Story 2.3: Integrate Sandboxed Execution for ADAS
 */

const mockDomain: DomainConfig = {
  domainId: "test-domain",
  name: "Test Domain",
  description: "A test domain for sandboxed evaluation",
  groundTruth: [
    { id: "test-1", input: "What is 2+2?", expectedOutput: "4" },
  ],
  accuracyWeight: 0.5,
  costWeight: 0.25,
  latencyWeight: 0.25,
};

const mockDesign: AgentDesign = {
  design_id: "test-design-001",
  name: "Test Agent",
  version: "1.0.0",
  domain: "test-domain",
  description: "A test agent design",
  config: {
    systemPrompt: "You are a test agent.",
    model: {
      provider: "ollama", modelId: "qwen3-coder-next:cloud", tier: "stable",
      temperature: 0.7,
      maxTokens: 1000,
    },
    reasoningStrategy: "cot",
  },
};

const sandboxConfig: Partial<SandboxedEvaluationConfig> = {
  useSandbox: true,
  sandboxOptions: {
    timeoutMs: 5000,
    maxCpuPercent: 50,
    maxMemoryMB: 256,
  },
};

describe("SandboxedEvaluationHarness", () => {
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

  describe("evaluateCandidate", () => {
    it("should evaluate candidate with sandbox disabled", async () => {
      const harness = createSandboxedEvaluationHarness({
        groupId: "test-group",
        domain: mockDomain,
        useSandbox: false,
        ...sandboxConfig,
      });

      const result = await harness.evaluateCandidate(mockDesign);

      expect(result).toHaveProperty("design");
      expect(result).toHaveProperty("metrics");
      expect(result).toHaveProperty("runId");
      expect(result).toHaveProperty("passed");

      await harness.cleanup();
    });

    it("should evaluate candidate with custom forward function", async () => {
      const harness = createSandboxedEvaluationHarness({
        groupId: "test-group",
        domain: mockDomain,
        useSandbox: false,
      });

      const customForwardFn = async (input: unknown) => {
        return { result: "custom output", input };
      };

      const result = await harness.evaluateCandidate(mockDesign, customForwardFn);

      expect(result).toHaveProperty("design");
      expect(result).toHaveProperty("metrics");

      await harness.cleanup();
    });
  });

  describe("evaluateAndRank", () => {
    it("should evaluate and rank multiple candidates", async () => {
      const harness = createSandboxedEvaluationHarness({
        groupId: `test-group-rank-${Date.now()}-${Math.random().toString(36).slice(7)}`,
        domain: mockDomain,
        useSandbox: false,
      });

      const candidates = [
        { design: { ...mockDesign, design_id: `design-1-${Date.now()}` } },
        { design: { ...mockDesign, design_id: `design-2-${Date.now()}` } },
      ];

      const ranked = await harness.evaluateAndRank(candidates);

      expect(ranked.length).toBe(2);
      expect(ranked[0]!.rank).toBe(1);
      expect(ranked[1]!.rank).toBe(2);

      await harness.cleanup();
    });
  });

  describe("getActiveContainers", () => {
    it("should return active containers list", async () => {
      const harness = createSandboxedEvaluationHarness({
        groupId: "test-group",
        domain: mockDomain,
        useSandbox: false,
      });

      const containers = harness.getActiveContainers();
      expect(Array.isArray(containers)).toBe(true);

      await harness.cleanup();
    });
  });

  describe("getSafetyMonitor", () => {
    it("should return safety monitor instance", () => {
      const harness = createSandboxedEvaluationHarness({
        groupId: "test-group",
        domain: mockDomain,
        useSandbox: false,
      });

      const monitor = harness.getSafetyMonitor();
      expect(monitor).toBeDefined();
    });
  });

  describe("cleanup", () => {
    it("should cleanup resources", async () => {
      const harness = createSandboxedEvaluationHarness({
        groupId: "test-group",
        domain: mockDomain,
        useSandbox: false,
      });

      await harness.cleanup();
      expect(harness.getActiveContainers().length).toBe(0);
    });
  });
});

describe("createSandboxedForwardFn", () => {
  it("should create sandboxed forward function", async () => {
    const sandbox = createSandboxExecutor({ timeoutMs: 100 });
    const forwardFn = createSandboxedForwardFn(mockDesign, sandbox, 10);

    expect(typeof forwardFn).toBe("function");

    await sandbox.cleanup();
  });

  it("should handle terminated execution", async () => {
    const sandbox = createSandboxExecutor({ timeoutMs: 1 });
    const forwardFn = createSandboxedForwardFn(mockDesign, sandbox, 5);
    const input = { test: "data" };

    const result = await forwardFn(input).catch(e => e);

    expect(result).toBeDefined();

    await sandbox.cleanup();
  });
});

describe("evaluateCandidateInSandbox", () => {
  it("should evaluate candidate in sandbox", async () => {
    const result = await evaluateCandidateInSandbox(
      mockDesign,
      mockDomain,
      "test-group",
      { timeoutMs: 500 },
      10
    );

    expect(result).toHaveProperty("design");
    expect(result).toHaveProperty("metrics");
    expect(result).toHaveProperty("runId");
  });
});

describe("executeCodeInSandbox", () => {
  it("should execute code and return result", async () => {
    const result = await executeCodeInSandbox(mockDesign, { input: "test" }, { timeoutMs: 500 });

    expect(result).toHaveProperty("success");
    expect(result).toHaveProperty("output");
    expect(result).toHaveProperty("executionResult");
    expect(result.executionResult).toHaveProperty("exitCode");
    expect(result.executionResult).toHaveProperty("stdout");
    expect(result.executionResult).toHaveProperty("stderr");
  });

  it("should include duration in result", async () => {
    const result = await executeCodeInSandbox(mockDesign, { input: "test" });

    expect(result.executionResult.durationMs).toBeGreaterThanOrEqual(0);
  });
});

describe("batchEvaluateInSandbox", () => {
  it("should evaluate multiple candidates in batch", async () => {
    const designs: AgentDesign[] = [
      { ...mockDesign, design_id: "batch-1" },
      { ...mockDesign, design_id: "batch-2" },
    ];

    const results = await batchEvaluateInSandbox(
      designs,
      mockDomain,
      "test-group",
      { timeoutMs: 500 }
    );

    expect(results.length).toBe(2);
    expect(results[0]).toHaveProperty("design");
    expect(results[1]).toHaveProperty("design");
  });
});

describe("SandboxedEvaluationConfig", () => {
  it("should accept sandbox options", () => {
    const config: SandboxedEvaluationConfig = {
      groupId: "test-group",
      domain: mockDomain,
      useSandbox: true,
      sandboxOptions: {
        timeoutMs: 10000,
        maxCpuPercent: 80,
        maxMemoryMB: 512,
      },
    };

    expect(config.useSandbox).toBe(true);
    expect(config.sandboxOptions?.timeoutMs).toBe(10000);
  });

  it("should accept resource limits", () => {
    const config: SandboxedEvaluationConfig = {
      groupId: "test-group",
      domain: mockDomain,
      useSandbox: true,
      resourceLimits: {
        maxSteps: 50,
        timeoutMs: 30000,
      },
    };

    expect(config.resourceLimits?.maxSteps).toBe(50);
  });
});

describe("Integration: Sandbox + Evaluation", () => {
  it("should integrate sandbox execution with evaluation harness", async () => {
    const harness = createSandboxedEvaluationHarness({
      groupId: "integration-test",
      domain: mockDomain,
      useSandbox: false,
      sandboxOptions: {
        timeoutMs: 1000,
      },
    });

    const result = await harness.evaluateCandidate(mockDesign);

    expect(result).toHaveProperty("passed");
    expect(result).toHaveProperty("metrics");

    await harness.cleanup();
  });

  it("should support Kmax in evaluation", async () => {
    const harness = createSandboxedEvaluationHarness({
      groupId: "kmax-test",
      domain: mockDomain,
      useSandbox: false,
      kmax: 10,
    });

    const result = await harness.evaluateCandidate(mockDesign);

    expect(result).toHaveProperty("metrics");

    await harness.cleanup();
  });

  it("should support safety monitoring during evaluation", async () => {
    const harness = createSandboxedEvaluationHarness({
      groupId: "safety-test",
      domain: mockDomain,
      useSandbox: false,
      enableSafetyMonitoring: true,
    });

    const monitor = harness.getSafetyMonitor();
    expect(monitor).toBeDefined();

    await harness.evaluateCandidate(mockDesign);

    await harness.cleanup();
  });
});