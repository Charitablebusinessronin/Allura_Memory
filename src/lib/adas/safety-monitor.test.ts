import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  SafetyMonitor,
  createSafetyMonitor,
  shouldTerminateExecution,
  formatViolation,
  DEFAULT_RESOURCE_LIMITS,
  SafetyViolation,
  ResourceUsageStats,
  ViolationType,
} from "./safety-monitor";

/**
 * Safety Monitor Tests
 * Story 2.3: Integrate Sandboxed Execution for ADAS
 */

describe("SafetyMonitor", () => {
  let monitor: SafetyMonitor;

  beforeEach(() => {
    monitor = createSafetyMonitor({
      timeoutMs: 5000,
      maxCpuPercent: 80,
      maxMemoryMB: 256,
      maxSteps: 10,
    });
  });

  describe("constructor", () => {
    it("should create monitor with default limits", () => {
      const defaultMonitor = createSafetyMonitor();
      expect(defaultMonitor).toBeInstanceOf(SafetyMonitor);
    });

    it("should merge custom limits with defaults", () => {
      const customMonitor = createSafetyMonitor({
        maxMemoryMB: 1024,
        maxSteps: 50,
      });

      expect(customMonitor).toBeInstanceOf(SafetyMonitor);
    });
  });

  describe("recordStep", () => {
    it("should record steps and return true when within limit", () => {
      const result = monitor.recordStep("Initialize");
      expect(result).toBe(true);
      expect(monitor.getStepCount()).toBe(1);
    });

    it("should return false when Kmax exceeded", () => {
      for (let i = 0; i < 10; i++) {
        monitor.recordStep(`Step ${i}`);
      }

      const exceeded = monitor.recordStep("Step 11");
      expect(exceeded).toBe(false);
      expect(monitor.getStepCount()).toBe(11);
    });

    it("should detect when Kmax exceeded", () => {
      expect(monitor.isKmaxExceeded()).toBe(false);

      for (let i = 0; i < 12; i++) {
        monitor.recordStep(`Step ${i}`);
      }

      expect(monitor.isKmaxExceeded()).toBe(true);
    });
  });

  describe("getViolations", () => {
    it("should return empty array when no violations", () => {
      const violations = monitor.getViolations();
      expect(violations).toEqual([]);
    });

    it("should track violations when Kmax exceeded", () => {
      for (let i = 0; i < 12; i++) {
        monitor.recordStep(`Step ${i}`);
      }

      const violations = monitor.getViolations();
      expect(violations.some(v => v.type === "kmax_exceeded")).toBe(true);
    });
  });

  describe("shouldTerminate", () => {
    it("should return false when no violations", () => {
      expect(monitor.shouldTerminate()).toBe(false);
    });

    it("should return true when violations exist", () => {
      for (let i = 0; i < 12; i++) {
        monitor.recordStep(`Step ${i}`);
      }

      expect(monitor.shouldTerminate()).toBe(true);
    });
  });

  describe("getMostSevereViolation", () => {
    it("should return null when no violations", () => {
      expect(monitor.getMostSevereViolation()).toBeNull();
    });

    it("should return most severe violation", () => {
      const localMonitor = createSafetyMonitor({ maxSteps: 1 });
      localMonitor.recordStep("Step 1");
      localMonitor.recordStep("Step 2");

      const severe = localMonitor.getMostSevereViolation();
      expect(severe?.type).toBe("kmax_exceeded");
    });
  });

  describe("reset", () => {
    it("should reset step count and violations", () => {
      monitor.recordStep("Step 1");
      monitor.recordStep("Step 2");

      monitor.reset();

      expect(monitor.getStepCount()).toBe(0);
      expect(monitor.getViolations().length).toBe(0);
    });
  });
});

describe("shouldTerminateExecution", () => {
  it("should not terminate when no violations", () => {
    const result = shouldTerminateExecution([]);
    expect(result.terminate).toBe(false);
    expect(result.reason).toBeNull();
  });

  it("should terminate on timeout violation", () => {
    const violations: SafetyViolation[] = [
      {
        type: "timeout",
        timestamp: new Date(),
        usage: { cpuPercent: 50, memoryMB: 100, diskMB: 10, processCount: 5, networkRxBytes: 0, networkTxBytes: 0, uptimeSeconds: 10 },
        limit: 60000,
        actual: 65000,
        description: "Execution timed out",
      },
    ];

    const result = shouldTerminateExecution(violations);
    expect(result.terminate).toBe(true);
    expect(result.reason).toBe("timeout");
  });

  it("should terminate on memory_exceeded violation", () => {
    const violations: SafetyViolation[] = [
      {
        type: "memory_exceeded",
        timestamp: new Date(),
        usage: { cpuPercent: 30, memoryMB: 600, diskMB: 20, processCount: 3, networkRxBytes: 0, networkTxBytes: 0, uptimeSeconds: 5 },
        limit: 512,
        actual: 600,
        description: "Memory exceeded limit",
      },
    ];

    const result = shouldTerminateExecution(violations);
    expect(result.terminate).toBe(true);
    expect(result.reason).toBe("memory_exceeded");
  });

  it("should terminate on kmax_exceeded violation", () => {
    const violations: SafetyViolation[] = [
      {
        type: "kmax_exceeded",
        timestamp: new Date(),
        usage: { cpuPercent: 20, memoryMB: 100, diskMB: 10, processCount: 2, networkRxBytes: 0, networkTxBytes: 0, uptimeSeconds: 3 },
        limit: 100,
        actual: 101,
        description: "Kmax exceeded",
      },
    ];

    const result = shouldTerminateExecution(violations);
    expect(result.terminate).toBe(true);
    expect(result.reason).toBe("kmax_exceeded");
  });

  it("should not terminate on non-critical violations", () => {
    const violations: SafetyViolation[] = [
      {
        type: "network_violation",
        timestamp: new Date(),
        usage: { cpuPercent: 20, memoryMB: 50, diskMB: 10, processCount: 2, networkRxBytes: 100, networkTxBytes: 50, uptimeSeconds: 5 },
        limit: 1000,
        actual: 150,
        description: "Network violation",
      },
    ];

    const result = shouldTerminateExecution(violations);
    expect(result.terminate).toBe(false);
  });
});

describe("formatViolation", () => {
  it("should format violation for logging", () => {
    const violation: SafetyViolation = {
      type: "timeout",
      timestamp: new Date("2024-01-15T10:30:00.000Z"),
      usage: { cpuPercent: 50, memoryMB: 100, diskMB: 20, processCount: 5, networkRxBytes: 0, networkTxBytes: 0, uptimeSeconds: 10 },
      limit: 60000,
      actual: 65000,
      description: "Execution timed out after 65 seconds",
    };

    const formatted = formatViolation(violation);
    expect(formatted).toContain("timeout");
    expect(formatted).toContain("Execution timed out");
    expect(formatted).toContain("2024-01-15");
  });
});

describe("DEFAULT_RESOURCE_LIMITS", () => {
  it("should have sensible defaults", () => {
    expect(DEFAULT_RESOURCE_LIMITS.timeoutMs).toBe(60000);
    expect(DEFAULT_RESOURCE_LIMITS.maxCpuPercent).toBe(80);
    expect(DEFAULT_RESOURCE_LIMITS.maxMemoryMB).toBe(512);
    expect(DEFAULT_RESOURCE_LIMITS.maxSteps).toBe(100);
  });

  it("should include all limit types", () => {
    expect(DEFAULT_RESOURCE_LIMITS).toHaveProperty("timeoutMs");
    expect(DEFAULT_RESOURCE_LIMITS).toHaveProperty("maxCpuPercent");
    expect(DEFAULT_RESOURCE_LIMITS).toHaveProperty("maxMemoryMB");
    expect(DEFAULT_RESOURCE_LIMITS).toHaveProperty("maxDiskMB");
    expect(DEFAULT_RESOURCE_LIMITS).toHaveProperty("maxProcesses");
    expect(DEFAULT_RESOURCE_LIMITS).toHaveProperty("maxNetworkBytes");
    expect(DEFAULT_RESOURCE_LIMITS).toHaveProperty("maxSteps");
  });
});

describe("ResourceUsageStats", () => {
  it("should define all resource metrics", () => {
    const stats: ResourceUsageStats = {
      cpuPercent: 45.5,
      memoryMB: 128.7,
      diskMB: 50.0,
      processCount: 5,
      networkRxBytes: 1024,
      networkTxBytes: 512,
      uptimeSeconds: 30,
    };

    expect(stats.cpuPercent).toBe(45.5);
    expect(stats.memoryMB).toBe(128.7);
    expect(stats.processCount).toBe(5);
  });
});

describe("ViolationType", () => {
  it("should define all violation types", () => {
    const types: ViolationType[] = [
      "timeout",
      "memory_exceeded",
      "cpu_exceeded",
      "disk_exceeded",
      "process_limit_exceeded",
      "kmax_exceeded",
      "network_violation",
      "unexpected_exit",
    ];

    expect(types.length).toBe(8);
  });
});

describe("Safety integration scenarios", () => {
  it("should handle multiple violations correctly", () => {
    const localMonitor = createSafetyMonitor({
      timeoutMs: 100,
      maxCpuPercent: 50,
      maxMemoryMB: 50,
      maxSteps: 2,
    });

    localMonitor.recordStep("Step 1");
    localMonitor.recordStep("Step 2");
    localMonitor.recordStep("Step 3");

    const violations = localMonitor.getViolations();
    expect(violations.length).toBeGreaterThan(0);

    const shouldTerminate = localMonitor.shouldTerminate();
    expect(shouldTerminate).toBe(true);

    const severeViolation = localMonitor.getMostSevereViolation();
    expect(severeViolation?.type).toBe("kmax_exceeded");
  });

  it("should allow execution within limits", () => {
    const localMonitor = createSafetyMonitor({
      maxSteps: 100,
      timeoutMs: 60000,
    });

    for (let i = 0; i < 50; i++) {
      localMonitor.recordStep(`Step ${i}`);
    }

    expect(localMonitor.isKmaxExceeded()).toBe(false);
    expect(localMonitor.shouldTerminate()).toBe(false);
    expect(localMonitor.getStepCount()).toBe(50);
  });
});