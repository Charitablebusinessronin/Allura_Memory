import type { Container } from "dockerode";

/**
 * Safety Monitor for ADAS Sandbox Execution
 * Story 2.3: Integrate Sandboxed Execution for ADAS
 *
 * Implements resource monitoring, step counting, and violation detection
 * for the sandbox executor to enforce safety constraints.
 */

/**
 * Safety constraint violations
 */
export type ViolationType =
  | "timeout"
  | "memory_exceeded"
  | "cpu_exceeded"
  | "disk_exceeded"
  | "process_limit_exceeded"
  | "kmax_exceeded"
  | "network_violation"
  | "unexpected_exit";

/**
 * Safety violation record
 */
export interface SafetyViolation {
  /** Violation type */
  type: ViolationType;
  /** Timestamp of violation */
  timestamp: Date;
  /** Current resource usage at violation time */
  usage: ResourceUsageStats;
  /** Limit that was exceeded */
  limit: number;
  /** Actual value that exceeded limit */
  actual: number;
  /** Description of violation */
  description: string;
}

/**
 * Resource usage statistics
 */
export interface ResourceUsageStats {
  /** CPU usage percentage (0-100) */
  cpuPercent: number;
  /** Memory usage in MB */
  memoryMB: number;
  /** Disk usage in MB */
  diskMB: number;
  /** Number of active processes */
  processCount: number;
  /** Network bytes received */
  networkRxBytes: number;
  /** Network bytes transmitted */
  networkTxBytes: number;
  /** Uptime in seconds */
  uptimeSeconds: number;
}

/**
 * Resource limits configuration
 */
export interface ResourceLimits {
  /** Maximum execution time in milliseconds */
  timeoutMs: number;
  /** Maximum CPU percentage */
  maxCpuPercent: number;
  /** Maximum memory in MB */
  maxMemoryMB: number;
  /** Maximum disk usage in MB */
  maxDiskMB: number;
  /** Maximum number of processes */
  maxProcesses: number;
  /** Maximum network bytes (if network enabled) */
  maxNetworkBytes: number;
  /** Kmax step limit */
  maxSteps: number;
}

/**
 * Default resource limits
 */
export const DEFAULT_RESOURCE_LIMITS: ResourceLimits = {
  timeoutMs: 60000,
  maxCpuPercent: 80,
  maxMemoryMB: 512,
  maxDiskMB: 100,
  maxProcesses: 100,
  maxNetworkBytes: 10 * 1024 * 1024,
  maxSteps: 100,
};

/**
 * Safety check result
 */
export interface SafetyCheckResult {
  /** Whether all checks passed */
  safe: boolean;
  /** Violations detected */
  violations: SafetyViolation[];
  /** Current resource usage */
  usage: ResourceUsageStats;
}

/**
 * Safety Monitor class
 * Monitors Docker containers for resource violations
 */
export class SafetyMonitor {
  private limits: ResourceLimits;
  private violations: SafetyViolation[] = [];
  private monitoringInterval: NodeJS.Timeout | null = null;
  private stepCount: number = 0;
  private maxSteps: number;
  private startTime: number = 0;

  constructor(limits?: Partial<ResourceLimits>) {
    this.limits = { ...DEFAULT_RESOURCE_LIMITS, ...limits };
    this.maxSteps = this.limits.maxSteps;
  }

  /**
   * Start monitoring a container
   */
  async startMonitoring(
    container: Container,
    onViolation: (violation: SafetyViolation) => void
  ): Promise<void> {
    this.startTime = Date.now();
    this.violations = [];
    this.stepCount = 0;

    this.monitoringInterval = setInterval(async () => {
      const result = await this.checkSafety(container);
      
      for (const violation of result.violations) {
        this.violations.push(violation);
        onViolation(violation);
      }
    }, 1000);
  }

  /**
   * Stop monitoring
   */
  stopMonitoring(): void {
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
      this.monitoringInterval = null;
    }
  }

  /**
   * Check current safety status
   */
  async checkSafety(container: Container): Promise<SafetyCheckResult> {
    const usage = await this.getResourceUsage(container);
    const violations: SafetyViolation[] = [];

    const elapsedMs = Date.now() - this.startTime;
    if (elapsedMs > this.limits.timeoutMs) {
      violations.push({
        type: "timeout",
        timestamp: new Date(),
        usage,
        limit: this.limits.timeoutMs,
        actual: elapsedMs,
        description: `Execution timed out after ${elapsedMs}ms (limit: ${this.limits.timeoutMs}ms)`,
      });
    }

    if (usage.cpuPercent > this.limits.maxCpuPercent) {
      violations.push({
        type: "cpu_exceeded",
        timestamp: new Date(),
        usage,
        limit: this.limits.maxCpuPercent,
        actual: usage.cpuPercent,
        description: `CPU usage ${usage.cpuPercent}% exceeds limit ${this.limits.maxCpuPercent}%`,
      });
    }

    if (usage.memoryMB > this.limits.maxMemoryMB) {
      violations.push({
        type: "memory_exceeded",
        timestamp: new Date(),
        usage,
        limit: this.limits.maxMemoryMB,
        actual: usage.memoryMB,
        description: `Memory usage ${usage.memoryMB}MB exceeds limit ${this.limits.maxMemoryMB}MB`,
      });
    }

    if (usage.diskMB > this.limits.maxDiskMB) {
      violations.push({
        type: "disk_exceeded",
        timestamp: new Date(),
        usage,
        limit: this.limits.maxDiskMB,
        actual: usage.diskMB,
        description: `Disk usage ${usage.diskMB}MB exceeds limit ${this.limits.maxDiskMB}MB`,
      });
    }

    if (usage.processCount > this.limits.maxProcesses) {
      violations.push({
        type: "process_limit_exceeded",
        timestamp: new Date(),
        usage,
        limit: this.limits.maxProcesses,
        actual: usage.processCount,
        description: `Process count ${usage.processCount} exceeds limit ${this.limits.maxProcesses}`,
      });
    }

    if (
      this.limits.maxNetworkBytes > 0 &&
      (usage.networkRxBytes + usage.networkTxBytes) > this.limits.maxNetworkBytes
    ) {
      violations.push({
        type: "network_violation",
        timestamp: new Date(),
        usage,
        limit: this.limits.maxNetworkBytes,
        actual: usage.networkRxBytes + usage.networkTxBytes,
        description: `Network usage exceeds limit ${this.limits.maxNetworkBytes} bytes`,
      });
    }

    return {
      safe: violations.length === 0,
      violations,
      usage,
    };
  }

  /**
   * Record a step for Kmax enforcement
   */
  recordStep(description: string): boolean {
    this.stepCount++;

    if (this.stepCount >= this.maxSteps) {
      this.violations.push({
        type: "kmax_exceeded",
        timestamp: new Date(),
        usage: this.getCurrentUsage(),
        limit: this.maxSteps,
        actual: this.stepCount,
        description: `Step count ${this.stepCount} exceeds Kmax limit ${this.maxSteps}: ${description}`,
      });
      return false;
    }

    return true;
  }

  /**
   * Check if Kmax exceeded
   */
  isKmaxExceeded(): boolean {
    return this.stepCount >= this.maxSteps;
  }

  /**
   * Get current step count
   */
  getStepCount(): number {
    return this.stepCount;
  }

  /**
   * Get all violations recorded
   */
  getViolations(): SafetyViolation[] {
    return [...this.violations];
  }

  /**
   * Get resource usage from container
   */
  private async getResourceUsage(container: Container): Promise<ResourceUsageStats> {
    try {
      const stats = await container.stats({ stream: false });

      const cpuDelta =
        (stats.cpu_stats?.cpu_usage?.total_usage ?? 0) -
        (stats.precpu_stats?.cpu_usage?.total_usage ?? 0);
      const systemDelta =
        (stats.cpu_stats?.system_cpu_usage ?? 0) -
        (stats.precpu_stats?.system_cpu_usage ?? 0);

      const cpuPercent = systemDelta > 0 ? (cpuDelta / systemDelta) * 100.0 : 0;

      const memoryMB = (stats.memory_stats?.usage ?? 0) / (1024 * 1024);

      const networks = stats.networks ?? {};
      let rxBytes = 0;
      let txBytes = 0;
      for (const net of Object.values(networks)) {
        const netStats = net as { rx_bytes?: number; tx_bytes?: number };
        rxBytes += netStats.rx_bytes ?? 0;
        txBytes += netStats.tx_bytes ?? 0;
      }

      return {
        cpuPercent: Math.min(cpuPercent, 100),
        memoryMB: Math.round(memoryMB * 100) / 100,
        diskMB: 0,
        processCount: stats.pids_stats?.current ?? 1,
        networkRxBytes: rxBytes,
        networkTxBytes: txBytes,
        uptimeSeconds: (Date.now() - this.startTime) / 1000,
      };
    } catch {
      return this.getCurrentUsage();
    }
  }

  /**
   * Get current usage placeholder
   */
  private getCurrentUsage(): ResourceUsageStats {
    return {
      cpuPercent: 0,
      memoryMB: 0,
      diskMB: 0,
      processCount: this.stepCount,
      networkRxBytes: 0,
      networkTxBytes: 0,
      uptimeSeconds: (Date.now() - this.startTime) / 1000,
    };
  }

  /**
   * Check if container should be terminated
   */
  shouldTerminate(): boolean {
    return this.violations.length > 0;
  }

  /**
   * Get the most severe violation
   */
  getMostSevereViolation(): SafetyViolation | null {
    if (this.violations.length === 0) {
      return null;
    }

    const severityOrder: ViolationType[] = [
      "timeout",
      "memory_exceeded",
      "kmax_exceeded",
      "cpu_exceeded",
      "disk_exceeded",
      "process_limit_exceeded",
      "network_violation",
      "unexpected_exit",
    ];

    for (const type of severityOrder) {
      const violation = this.violations.find((v) => v.type === type);
      if (violation) {
        return violation;
      }
    }

    return this.violations[0] ?? null;
  }

  /**
   * Reset the monitor for a new execution
   */
  reset(): void {
    this.violations = [];
    this.stepCount = 0;
    this.startTime = Date.now();
  }
}

/**
 * Create a safety monitor with specified limits
 */
export function createSafetyMonitor(
  limits?: Partial<ResourceLimits>
): SafetyMonitor {
  return new SafetyMonitor(limits);
}

/**
 * Check if execution should be terminated based on violations
 */
export function shouldTerminateExecution(
  violations: SafetyViolation[]
): { terminate: boolean; reason: ViolationType | null } {
  if (violations.length === 0) {
    return { terminate: false, reason: null };
  }

  const criticalViolations: ViolationType[] = [
    "timeout",
    "memory_exceeded",
    "kmax_exceeded",
  ];

  for (const violation of violations) {
    if (criticalViolations.includes(violation.type)) {
      return { terminate: true, reason: violation.type };
    }
  }

  return { terminate: false, reason: null };
}

/**
 * Format violation for logging
 */
export function formatViolation(violation: SafetyViolation): string {
  return `[${violation.timestamp.toISOString()}] ${violation.type}: ${violation.description}`;
}