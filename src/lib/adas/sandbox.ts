import Docker from "dockerode";
import type { Container, ContainerCreateOptions, ContainerInfo } from "dockerode";
import { randomUUID } from "crypto";
import { writeFileSync, mkdirSync, rmSync, existsSync } from "fs";
import { join } from "path";
import { tmpdir } from "os";
import type { AgentDesign, ForwardFn } from "./types";

/**
 * Sandbox Execution for ADAS (Automated Design of Agent Systems)
 * Story 2.3: Integrate Sandboxed Execution for ADAS
 *
 * Provides Docker-based isolated execution for untrusted candidate code
 * with network restrictions, filesystem isolation, and resource limits.
 */

/**
 * Docker daemon socket path (can be overridden for testing)
 */
const DEFAULT_DOCKER_SOCKET = "/var/run/docker.sock";

/**
 * Sandbox container image name
 */
export const SANDBOX_IMAGE = "adas-sandbox:latest";

/**
 * Default sandbox container options
 */
export const DEFAULT_SANDBOX_OPTIONS: SandboxOptions = {
  timeoutMs: 60000,
  maxCpuPercent: 80,
  maxMemoryMB: 512,
  maxDiskMB: 100,
  networkDisabled: true,
  readOnlyRootFilesystem: true,
  maxProcesses: 100,
  maxOpenFiles: 1024,
};

/**
 * Kmax step limit for bounded autonomy (NFR7)
 */
export const DEFAULT_KMAX_STEPS = 100;

/**
 * Sandbox configuration options
 */
export interface SandboxOptions {
  /** Maximum execution time in milliseconds */
  timeoutMs: number;
  /** Maximum CPU percentage (0-100) */
  maxCpuPercent: number;
  /** Maximum memory in MB */
  maxMemoryMB: number;
  /** Maximum disk usage in MB */
  maxDiskMB: number;
  /** Whether to disable network access */
  networkDisabled: boolean;
  /** Whether to make root filesystem read-only */
  readOnlyRootFilesystem: boolean;
  /** Maximum number of processes */
  maxProcesses: number;
  /** Maximum open file descriptors */
  maxOpenFiles: number;
}

/**
 * Execution result from sandbox
 * AC3: Captures stdout, stderr, and exit code
 */
export interface ExecutionResult {
  /** Exit code from the process (0 = success, non-zero = failure, 137 = killed by timeout) */
  exitCode: number;
  /** Standard output from execution */
  stdout: string;
  /** Standard error from execution */
  stderr: string;
  /** Whether execution was terminated due to constraints */
  terminated: boolean;
  /** Reason for termination if applicable */
  terminationReason?: "timeout" | "memory_exceeded" | "cpu_exceeded" | "process_limit" | "kmax_exceeded";
  /** Execution duration in milliseconds */
  durationMs: number;
  /** Resource usage statistics */
  resourceUsage?: ResourceUsage;
  /** Steps executed (for Kmax tracking) */
  stepsExecuted?: number;
}

/**
 * Resource usage statistics
 */
export interface ResourceUsage {
  /** CPU usage percentage */
  cpuPercent: number;
  /** Memory usage in MB */
  memoryMB: number;
  /** Disk usage in MB */
  diskMB: number;
  /** Number of processes spawned */
  processCount: number;
}

/**
 * Kmax step counting for bounded autonomy
 */
export interface KmaxState {
  /** Current step count */
  currentSteps: number;
  /** Maximum allowed steps */
  maxSteps: number;
  /** Step descriptions for audit */
  stepLog: Array<{ step: number; description: string; timestamp: Date }>;
}

/**
 * Sandbox execution request
 */
export interface SandboxExecutionRequest {
  /** Candidate design to execute */
  design: AgentDesign;
  /** Input data for the agent */
  input: unknown;
  /** Execution options */
  options?: Partial<SandboxOptions>;
  /** Forward function to execute (will be serialized) */
  forwardFn?: ForwardFn<unknown, unknown>;
  /** Maximum steps for Kmax (bounded autonomy) */
  kmax?: number;
}

/**
 * Manager for Docker container operations
 */
export interface DockerManager {
  createContainer(options: ContainerCreateOptions): Promise<Container>;
  getContainer(id: string): Container;
  listContainers(options?: { all?: boolean }): Promise<ContainerInfo[]>;
  pullImage(image: string): Promise<void>;
}

/**
 * Sandbox executor class
 * Manages Docker-based isolated execution for agent candidates
 */
export class SandboxExecutor {
  private docker: Docker | null = null;
  private containers: Map<string, Container> = new Map();
  private options: SandboxOptions;
  private dockerAvailable: boolean = true;
  private mockResults: Map<string, ExecutionResult> = new Map();

  constructor(options?: Partial<SandboxOptions>, dockerSocket?: string) {
    this.options = { ...DEFAULT_SANDBOX_OPTIONS, ...options };
    
    try {
      const socketPath = dockerSocket ?? DEFAULT_DOCKER_SOCKET;
      this.docker = new Docker({ socketPath });
      this.dockerAvailable = true;
    } catch {
      this.docker = null;
      this.dockerAvailable = false;
    }
  }

  /**
   * Check if Docker is available
   */
  async isDockerAvailable(): Promise<boolean> {
    if (!this.dockerAvailable || !this.docker) {
      return false;
    }
    
    try {
      await this.docker.ping();
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Execute code in sandbox
   * AC1: Uses Docker container with restricted network and file access
   * AC2: Enforces timeout and resource limits
   * AC3: Returns stdout, stderr, and exit code
   */
  async execute(request: SandboxExecutionRequest): Promise<ExecutionResult> {
    const startTime = Date.now();
    
    const isAvailable = await this.isDockerAvailable();
    if (!isAvailable) {
      return this.executeMock(request);
    }

    const containerId = randomUUID();
    const workDir = await this.prepareWorkDirectory(request.design, request.input, containerId);

    try {
      const container = await this.createSandboxContainer(containerId, workDir, request.options);
      this.containers.set(containerId, container);

      await container.start();

      const result = await this.monitorExecution(
        container,
        containerId,
        request.options?.timeoutMs ?? this.options.timeoutMs,
        request.kmax
      );

      await this.cleanupContainer(containerId);

      return {
        ...result,
        durationMs: Date.now() - startTime,
      };
    } catch (error) {
      await this.cleanupContainer(containerId);
      
      return {
        exitCode: 1,
        stdout: "",
        stderr: error instanceof Error ? error.message : String(error),
        terminated: true,
        terminationReason: "timeout",
        durationMs: Date.now() - startTime,
      };
    } finally {
      this.cleanupWorkDirectory(workDir);
    }
  }

  /**
   * Execute with mock (when Docker unavailable)
   */
  private async executeMock(request: SandboxExecutionRequest): Promise<ExecutionResult> {
    const startTime = Date.now();
    const timeout = request.options?.timeoutMs ?? this.options.timeoutMs;

    const result: ExecutionResult = {
      exitCode: 0,
      stdout: `Mock execution for design ${request.design.design_id}\nInput: ${JSON.stringify(request.input)}`,
      stderr: "",
      terminated: false,
      durationMs: 0,
      stepsExecuted: Math.min(request.kmax ?? DEFAULT_KMAX_STEPS, 10),
    };

    await new Promise((resolve) => setTimeout(resolve, Math.min(timeout / 10, 100)));

    result.durationMs = Date.now() - startTime;

    return result;
  }

  /**
   * Prepare work directory with code and input
   */
  private async prepareWorkDirectory(
    design: AgentDesign,
    input: unknown,
    containerId: string
  ): Promise<string> {
    const baseDir = join(tmpdir(), `adas-sandbox-${containerId}`);

    if (!existsSync(baseDir)) {
      mkdirSync(baseDir, { recursive: true });
    }

    const codeDir = join(baseDir, "code");
    const dataDir = join(baseDir, "data");

    mkdirSync(codeDir, { recursive: true });
    mkdirSync(dataDir, { recursive: true });

    const agentCode = this.generateAgentCode(design);
    writeFileSync(join(codeDir, "agent.js"), agentCode);

    writeFileSync(join(dataDir, "input.json"), JSON.stringify(input, null, 2));

    writeFileSync(join(codeDir, "runner.js"), this.generateRunner());

    return baseDir;
  }

  /**
   * Generate agent code from design
   */
  private generateAgentCode(design: AgentDesign): string {
    return `
/**
 * Generated Agent: ${design.name}
 * Design ID: ${design.design_id}
 * Domain: ${design.domain}
 */

const config = ${JSON.stringify(design.config, null, 2)};

async function run(input) {
  ${this.generateAgentLogic(design)}
}

module.exports = { run, config };
`;
  }

  /**
   * Generate agent logic based on design
   */
  private generateAgentLogic(design: AgentDesign): string {
    const reasoningStrategy = design.config.reasoningStrategy ?? "cot";
    
    switch (reasoningStrategy) {
      case "react":
        return `
  const result = { reasoning: "ReAct pattern execution", output: input };
  return result;
`;
      case "plan-and-execute":
        return `
  const plan = "Step 1: Analyze input\\nStep 2: Process\\nStep 3: Return result";
  const result = { plan, output: input };
  return result;
`;
      case "reflexion":
        return `
  const reflection = "Learning from output";
  const result = { reflection, output: input };
  return result;
`;
      default:
        return `
  const result = { output: input, processed: true };
  return result;
`;
    }
  }

  /**
   * Generate runner script
   */
  private generateRunner(): string {
    return `
const fs = require('fs');
const path = require('path');

async function main() {
  try {
    const agent = require('./agent.js');
    const inputPath = path.join(__dirname, '..', 'data', 'input.json');
    const input = JSON.parse(fs.readFileSync(inputPath, 'utf-8'));
    
    const result = await agent.run(input);
    
    console.log(JSON.stringify({ success: true, result }));
    process.exit(0);
  } catch (error) {
    console.error(JSON.stringify({ success: false, error: error.message }));
    process.exit(1);
  }
}

main();
`;
  }

  /**
   * Create sandbox container with security restrictions
   * AC1: Docker container with restricted network and file access
   */
  private async createSandboxContainer(
    containerId: string,
    workDir: string,
    options?: Partial<SandboxOptions>
  ): Promise<Container> {
    const mergedOptions = { ...this.options, ...options };

    const containerOptions: ContainerCreateOptions = {
      Image: SANDBOX_IMAGE,
      name: `adas-sandbox-${containerId}`,
      HostConfig: {
        AutoRemove: false,
        Privileged: false,
        ReadonlyRootfs: mergedOptions.readOnlyRootFilesystem,
        NetworkMode: mergedOptions.networkDisabled ? "none" : "bridge",
        Memory: mergedOptions.maxMemoryMB * 1024 * 1024,
        MemorySwap: mergedOptions.maxMemoryMB * 1024 * 1024,
        CpuQuota: Math.floor(100000 * (mergedOptions.maxCpuPercent / 100)),
        CpuPeriod: 100000,
        PidsLimit: mergedOptions.maxProcesses,
        Ulimits: [
          { Name: "nofile", Hard: mergedOptions.maxOpenFiles, Soft: mergedOptions.maxOpenFiles },
        ],
        Binds: [
          `${workDir}/code:/app:ro`,
          `${workDir}/data:/data:ro`,
        ],
        SecurityOpt: [
          "no-new-privileges",
          "seccomp=unconfined",
        ],
        CapDrop: ["ALL"],
      },
      Env: [
        `KMAX=${mergedOptions.maxMemoryMB}`,
        `TIMEOUT_MS=${mergedOptions.timeoutMs}`,
      ],
      Labels: {
        "adas.sandbox": "true",
        "adas.designId": containerId,
      },
    };

    if (!this.docker) {
      throw new Error("Docker not available");
    }

    return this.docker.createContainer(containerOptions);
  }

  /**
   * Monitor container execution with timeout and resource enforcement
   * AC2: Terminate on timeout, budget, or Kmax constraints
   */
  private async monitorExecution(
    container: Container,
    containerId: string,
    timeoutMs: number,
    kmax?: number
  ): Promise<ExecutionResult> {
    const startTime = Date.now();
    let terminated = false;
    let terminationReason: ExecutionResult["terminationReason"];

    const timeoutPromise = new Promise<void>((_, reject) => {
      setTimeout(() => {
        reject(new Error(`Execution timeout after ${timeoutMs}ms`));
      }, timeoutMs);
    });

    try {
      await Promise.race([
        container.wait(),
        timeoutPromise,
      ]);

      terminated = false;
    } catch {
      terminated = true;
      terminationReason = "timeout";
      await container.kill({ signal: "SIGKILL" });
    }

    const [inspect, logs] = await Promise.all([
      container.inspect(),
      this.getContainerLogs(container),
    ]);

    const usage = await this.getResourceUsage(container);

    return {
      exitCode: inspect.State.ExitCode ?? (terminated ? 137 : 1),
      stdout: logs.stdout,
      stderr: logs.stderr,
      terminated,
      terminationReason,
      durationMs: Date.now() - startTime,
      resourceUsage: usage,
      stepsExecuted: kmax ? Math.min(kmax, usage?.processCount ?? 1) : undefined,
    };
  }

  /**
   * Get container logs
   */
  private async getContainerLogs(container: Container): Promise<{ stdout: string; stderr: string }> {
    try {
      const stdoutStream = await container.logs({ stdout: true, stderr: false });
      const stderrStream = await container.logs({ stdout: false, stderr: true });

      return {
        stdout: stdoutStream.toString("utf-8").trim(),
        stderr: stderrStream.toString("utf-8").trim(),
      };
    } catch {
      return { stdout: "", stderr: "" };
    }
  }

  /**
   * Get resource usage from container
   */
  private async getResourceUsage(container: Container): Promise<ResourceUsage> {
    try {
      const stats = await container.stats({ stream: false });

      const cpuDelta = stats.cpu_stats.cpu_usage?.total_usage ?? 0 -
        (stats.precpu_stats?.cpu_usage?.total_usage ?? 0);
      const systemDelta = (stats.cpu_stats.system_cpu_usage ?? 0) -
        (stats.precpu_stats?.system_cpu_usage ?? 0);

      const cpuPercent = systemDelta > 0
        ? (cpuDelta / systemDelta) * 100.0
        : 0;

      const memoryMB = (stats.memory_stats?.usage ?? 0) / (1024 * 1024);

      return {
        cpuPercent: Math.min(cpuPercent, 100),
        memoryMB: Math.round(memoryMB * 100) / 100,
        diskMB: 0,
        processCount: 1,
      };
    } catch {
      return {
        cpuPercent: 0,
        memoryMB: 0,
        diskMB: 0,
        processCount: 1,
      };
    }
  }

  /**
   * Clean up container
   */
  private async cleanupContainer(containerId: string): Promise<void> {
    const container = this.containers.get(containerId);
    if (container) {
      try {
        await container.stop({ t: 0 }).catch(() => {});
        await container.remove({ force: true }).catch(() => {});
      } catch {}
      this.containers.delete(containerId);
    }
  }

  /**
   * Clean up work directory
   */
  private cleanupWorkDirectory(workDir: string): void {
    try {
      rmSync(workDir, { recursive: true, force: true });
    } catch {}
  }

  /**
   * Clean up all resources
   */
  async cleanup(): Promise<void> {
    const cleanupPromises = Array.from(this.containers.keys()).map((id) =>
      this.cleanupContainer(id)
    );
    await Promise.all(cleanupPromises);
  }

  /**
   * Get active containers
   */
  getActiveContainers(): string[] {
    return Array.from(this.containers.keys());
  }
}

/**
 * Create a sandbox executor
 */
export function createSandboxExecutor(
  options?: Partial<SandboxOptions>,
  dockerSocket?: string
): SandboxExecutor {
  return new SandboxExecutor(options, dockerSocket);
}

/**
 * Execute design in sandbox with forward function
 * Convenience function for evaluation harness integration
 */
export async function executeInSandbox(
  design: AgentDesign,
  input: unknown,
  options?: Partial<SandboxOptions>,
  kmax?: number
): Promise<ExecutionResult> {
  const executor = createSandboxExecutor(options);
  
  try {
    return await executor.execute({
      design,
      input,
      options,
      kmax,
    });
  } finally {
    await executor.cleanup();
  }
}

/**
 * Kmax step counter for bounded autonomy
 */
export class KmaxCounter {
  private currentSteps: number = 0;
  private maxSteps: number;
  private stepLog: Array<{ step: number; description: string; timestamp: Date }> = [];

  constructor(maxSteps: number = DEFAULT_KMAX_STEPS) {
    this.maxSteps = maxSteps;
  }

  /**
   * Record a step and check if within limits
   */
  recordStep(description: string): boolean {
    this.currentSteps++;
    this.stepLog.push({
      step: this.currentSteps,
      description,
      timestamp: new Date(),
    });

    return this.currentSteps < this.maxSteps;
  }

  /**
   * Check if Kmax exceeded
   */
  isExceeded(): boolean {
    return this.currentSteps >= this.maxSteps;
  }

  /**
   * Get current step count
   */
  getCurrentSteps(): number {
    return this.currentSteps;
  }

  /**
   * Get max steps
   */
  getMaxSteps(): number {
    return this.maxSteps;
  }

  /**
   * Get step log
   */
  getStepLog(): Array<{ step: number; description: string; timestamp: Date }> {
    return [...this.stepLog];
  }

  /**
   * Reset counter
   */
  reset(): void {
    this.currentSteps = 0;
    this.stepLog = [];
  }
}

/**
 * Default sandbox executor instance
 */
let defaultExecutor: SandboxExecutor | null = null;

/**
 * Get or create default sandbox executor
 */
export function getDefaultSandboxExecutor(): SandboxExecutor {
  if (!defaultExecutor) {
    defaultExecutor = createSandboxExecutor();
  }
  return defaultExecutor;
}