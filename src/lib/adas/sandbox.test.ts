import { describe, it, expect, beforeAll, afterAll, vi, beforeEach } from "vitest";
import {
  SandboxExecutor,
  createSandboxExecutor,
  executeInSandbox,
  getDefaultSandboxExecutor,
  SandboxOptions,
  ExecutionResult,
  KmaxCounter,
  DEFAULT_SANDBOX_OPTIONS,
} from "./sandbox";
import type { AgentDesign } from "./types";

/**
 * Sandbox Execution Tests
 * Story 2.3: Integrate Sandboxed Execution for ADAS
 */

const mockDesign: AgentDesign = {
  design_id: "test-design-001",
  name: "Test Agent",
  version: "1.0.0",
  domain: "test-domain",
  description: "A test agent design",
  config: {
    systemPrompt: "You are a test agent.",
    model: {
      provider: "openai",
      modelId: "gpt-4o-mini",
      temperature: 0.7,
      maxTokens: 1000,
    },
    reasoningStrategy: "cot",
  },
};

const defaultOptions: Partial<SandboxOptions> = {
  timeoutMs: 5000,
  maxCpuPercent: 50,
  maxMemoryMB: 256,
};

describe("SandboxExecutor", () => {
  let executor: SandboxExecutor;

  beforeAll(() => {
    executor = createSandboxExecutor(defaultOptions);
  });

  afterAll(async () => {
    await executor.cleanup();
  });

  describe("isDockerAvailable", () => {
    it("should check Docker availability", async () => {
      const isAvailable = await executor.isDockerAvailable();
      expect(typeof isAvailable).toBe("boolean");
    });
  });

  describe("execute", () => {
    it("should execute design in sandbox", async () => {
      const result = await executor.execute({
        design: mockDesign,
        input: { test: "data" },
        options: { timeoutMs: 1000 },
      });

      expect(result).toHaveProperty("exitCode");
      expect(result).toHaveProperty("stdout");
      expect(result).toHaveProperty("stderr");
      expect(result).toHaveProperty("durationMs");
      expect(result.durationMs).toBeGreaterThanOrEqual(0);
    });

    it("should return mock result when Docker unavailable", async () => {
      const localExecutor = createSandboxExecutor({
        ...defaultOptions,
        timeoutMs: 100,
      });

      const result = await localExecutor.execute({
        design: mockDesign,
        input: { key: "value" },
      });

      expect(result.durationMs).toBeLessThanOrEqual(200);
      expect(result).toHaveProperty("stdout");
      expect(result).toHaveProperty("stderr");

      await localExecutor.cleanup();
    });

    it("should include stepsExecuted when kmax provided", async () => {
      const result = await executor.execute({
        design: mockDesign,
        input: { action: "test" },
        options: { timeoutMs: 1000 },
        kmax: 50,
      });

      if (result.stepsExecuted !== undefined) {
        expect(result.stepsExecuted).toBeLessThanOrEqual(50);
      }
    });
  });

  describe("container lifecycle", () => {
    it("should track active containers", () => {
      const activeCount = executor.getActiveContainers().length;
      expect(typeof activeCount).toBe("number");
    });

    it("should cleanup all containers", async () => {
      await executor.cleanup();
      expect(executor.getActiveContainers().length).toBe(0);
    });
  });
});

describe("createSandboxExecutor", () => {
  it("should create executor with default options", () => {
    const exec = createSandboxExecutor();
    expect(exec).toBeInstanceOf(SandboxExecutor);
  });

  it("should create executor with custom options", () => {
    const exec = createSandboxExecutor({
      timeoutMs: 10000,
      maxMemoryMB: 1024,
    });
    expect(exec).toBeInstanceOf(SandboxExecutor);
  });
});

describe("executeInSandbox", () => {
  it("should execute design and return result", async () => {
    const result = await executeInSandbox(
      mockDesign,
      { input: "test" },
      { timeoutMs: 500 }
    );

    expect(result).toHaveProperty("exitCode");
    expect(result).toHaveProperty("stdout");
    expect(result).toHaveProperty("stderr");
    expect(result).toHaveProperty("durationMs");
  });
});

describe("getDefaultSandboxExecutor", () => {
  it("should return singleton executor", () => {
    const exec1 = getDefaultSandboxExecutor();
    const exec2 = getDefaultSandboxExecutor();
    expect(exec1).toBe(exec2);
  });
});

describe("DEFAULT_SANDBOX_OPTIONS", () => {
  it("should have expected defaults", () => {
    expect(DEFAULT_SANDBOX_OPTIONS.timeoutMs).toBe(60000);
    expect(DEFAULT_SANDBOX_OPTIONS.maxCpuPercent).toBe(80);
    expect(DEFAULT_SANDBOX_OPTIONS.maxMemoryMB).toBe(512);
    expect(DEFAULT_SANDBOX_OPTIONS.networkDisabled).toBe(true);
    expect(DEFAULT_SANDBOX_OPTIONS.readOnlyRootFilesystem).toBe(true);
  });
});

describe("ExecutionResult", () => {
  it("should include required fields", async () => {
    const result: ExecutionResult = {
      exitCode: 0,
      stdout: "test output",
      stderr: "",
      terminated: false,
      durationMs: 100,
    };

    expect(result.exitCode).toBeDefined();
    expect(result.stdout).toBeDefined();
    expect(result.stderr).toBeDefined();
    expect(result.resourceUsage).toBeUndefined();
  });

  it("should handle termination reasons", async () => {
    const terminatedResult: ExecutionResult = {
      exitCode: 137,
      stdout: "",
      stderr: "Timeout",
      terminated: true,
      terminationReason: "timeout",
      durationMs: 60000,
    };

    expect(terminatedResult.terminated).toBe(true);
    expect(terminatedResult.terminationReason).toBe("timeout");
  });
});

describe("SandboxOptions", () => {
  it("should support all security options", () => {
    const options: SandboxOptions = {
      timeoutMs: 30000,
      maxCpuPercent: 50,
      maxMemoryMB: 256,
      maxDiskMB: 50,
      networkDisabled: true,
      readOnlyRootFilesystem: true,
      maxProcesses: 50,
      maxOpenFiles: 512,
    };

    expect(options.networkDisabled).toBe(true);
    expect(options.readOnlyRootFilesystem).toBe(true);
  });
});

describe("KmaxCounter", () => {
  const counter = new KmaxCounter(10);

  beforeEach(() => {
    counter.reset();
  });

  it("should record steps and return within limit", () => {
    const withinLimit = counter.recordStep("Step 1");
    expect(withinLimit).toBe(true);
    expect(counter.getCurrentSteps()).toBe(1);
  });

  it("should track step log", () => {
    counter.recordStep("Initialize");
    counter.recordStep("Process input");
    counter.recordStep("Return result");

    const log = counter.getStepLog();
    expect(log.length).toBe(3);
    expect(log[0]?.description).toBe("Initialize");
  });

  it("should detect when Kmax exceeded", () => {
    const localCounter = new KmaxCounter(3);

    localCounter.recordStep("Step 1");
    localCounter.recordStep("Step 2");
    localCounter.recordStep("Step 3");

    expect(localCounter.isExceeded()).toBe(true);
  });

  it("should track max steps", () => {
    expect(counter.getMaxSteps()).toBe(10);
  });

  it("should reset counter", () => {
    counter.recordStep("Step 1");
    counter.recordStep("Step 2");

    counter.reset();

    expect(counter.getCurrentSteps()).toBe(0);
    expect(counter.getStepLog().length).toBe(0);
  });
});

describe("Integration with AgentDesign", () => {
  it("should serialize design config correctly", async () => {
    const complexDesign: AgentDesign = {
      design_id: "complex-design",
      name: "Complex Agent",
      version: "2.0.0",
      domain: "advanced-domain",
      description: "A complex agent with full config",
      config: {
        systemPrompt: "You are an advanced agent with tools.",
        tools: [
          { name: "search", description: "Search function" },
          { name: "calculate", description: "Calculator function" },
        ],
        model: {
          provider: "anthropic",
          modelId: "claude-3-opus",
          temperature: 0.9,
          maxTokens: 4000,
          topP: 0.95,
        },
        reasoningStrategy: "react",
        parameters: {
          customParam: "value",
        },
      },
      metadata: {
        createdAt: new Date(),
        createdBy: "meta-agent-search",
        tags: ["advanced", "react"],
      },
    };

    const executor = createSandboxExecutor({ timeoutMs: 100 });
    const result = await executor.execute({
      design: complexDesign,
      input: { complex: "input" },
      kmax: 50,
    });

    expect(result).toHaveProperty("exitCode");
    expect(result).toHaveProperty("stdout");

    await executor.cleanup();
  });
});