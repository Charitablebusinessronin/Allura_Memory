/**
 * Sandboxed Evaluation Integration
 * Story 2.3: Integrate Sandboxed Execution for ADAS
 *
 * Integrates sandbox execution with the evaluation harness
 * to provide safe evaluation of untrusted agent candidates.
 */

import type { AgentDesign, ForwardFn, EvaluationResult, DomainConfig, CandidateRanking } from "./types";
import { EvaluationHarness, createEvaluationHarness } from "./evaluation-harness";
import {
  SandboxExecutor,
  createSandboxExecutor,
  type SandboxOptions,
  type ExecutionResult,
} from "./sandbox";
import { SafetyMonitor, createSafetyMonitor, type ResourceLimits } from "./safety-monitor";
import { randomUUID } from "crypto";

/**
 * Configuration for sandboxed evaluation
 */
export interface SandboxedEvaluationConfig {
  /** Group ID for tenant isolation */
  groupId: string;
  /** Target domain */
  domain: DomainConfig;
  /** Sandbox options */
  sandboxOptions?: Partial<SandboxOptions>;
  /** Resource limits for safety monitoring */
  resourceLimits?: Partial<ResourceLimits>;
  /** Use sandboxed execution */
  useSandbox: boolean;
  /** Maximum Kmax steps */
  kmax?: number;
  /** Enable safety monitoring */
  enableSafetyMonitoring?: boolean;
}

/**
 * Sandboxed forward function wrapper
 * Creates a forward function that executes in the sandbox
 */
export function createSandboxedForwardFn(
  design: AgentDesign,
  sandbox: SandboxExecutor,
  kmax?: number
): ForwardFn<unknown, unknown> {
  return async (input: unknown) => {
    const result = await sandbox.execute({
      design,
      input,
      kmax,
    });

    if (result.terminated) {
      throw new Error(
        `Execution terminated: ${result.terminationReason ?? "unknown"}`
      );
    }

    if (result.exitCode !== 0) {
      throw new Error(`Execution failed with exit code ${result.exitCode}: ${result.stderr}`);
    }

    try {
      const output = JSON.parse(result.stdout);
      return output;
    } catch {
      return { output: result.stdout };
    }
  };
}

/**
 * Evaluate a candidate in sandbox
 * AC1: Execution occurs in Docker container with restricted network/file access
 */
export async function evaluateCandidateInSandbox(
  design: AgentDesign,
  domain: DomainConfig,
  groupId: string,
  options?: Partial<SandboxOptions>,
  kmax?: number
): Promise<EvaluationResult> {
  const sandbox = createSandboxExecutor(options);
  const harness = createEvaluationHarness({ groupId, domain });

  try {
    const sandboxedForwardFn = createSandboxedForwardFn(design, sandbox, kmax);
    return await harness.evaluateCandidate(design, sandboxedForwardFn);
  } finally {
    await sandbox.cleanup();
  }
}

/**
 * Sandboxed evaluation harness wrapper
 * Provides sandboxed execution for all evaluation operations
 */
export class SandboxedEvaluationHarness {
  private harness: EvaluationHarness;
  private sandbox: SandboxExecutor;
  private monitor: SafetyMonitor;
  private config: SandboxedEvaluationConfig;

  constructor(config: SandboxedEvaluationConfig) {
    this.config = config;
    this.harness = createEvaluationHarness({
      groupId: config.groupId,
      domain: config.domain,
    });
    this.sandbox = createSandboxExecutor(config.sandboxOptions);
    this.monitor = createSafetyMonitor(config.resourceLimits);
  }

  /**
   * Evaluate a candidate design
   * AC1-AC3: Executes in sandbox and captures results
   */
  async evaluateCandidate(
    design: AgentDesign,
    forwardFn?: ForwardFn<unknown, unknown>
  ): Promise<EvaluationResult> {
    const executionForwardFn = this.config.useSandbox
      ? createSandboxedForwardFn(design, this.sandbox, this.config.kmax)
      : forwardFn ?? this.createDefaultForwardFn(design);

    if (this.config.enableSafetyMonitoring) {
      this.monitor.reset();
    }

    return this.harness.evaluateCandidate(design, executionForwardFn);
  }

  /**
   * Evaluate multiple candidates and rank
   */
  async evaluateAndRank(
    candidates: Array<{
      design: AgentDesign;
      forwardFn?: ForwardFn<unknown, unknown>;
    }>
  ): Promise<CandidateRanking[]> {
    const candidatesWithForwardFns = candidates.map((candidate) => ({
      design: candidate.design,
      forwardFn: this.config.useSandbox
        ? createSandboxedForwardFn(candidate.design, this.sandbox, this.config.kmax)
        : candidate.forwardFn ?? this.createDefaultForwardFn(candidate.design),
    }));

    return this.harness.evaluateAndRank(candidatesWithForwardFns);
  }

  /**
   * Create default forward function for testing
   */
  private createDefaultForwardFn(design: AgentDesign): ForwardFn<unknown, unknown> {
    return async (input: unknown) => {
      return { input, processed: true, design: design.design_id };
    };
  }

  /**
   * Get active sandbox containers
   */
  getActiveContainers(): string[] {
    return this.sandbox.getActiveContainers();
  }

  /**
   * Clean up all resources
   */
  async cleanup(): Promise<void> {
    await this.sandbox.cleanup();
  }

  /**
   * Get safety monitor
   */
  getSafetyMonitor(): SafetyMonitor {
    return this.monitor;
  }
}

/**
 * Create a sandboxed evaluation harness
 */
export function createSandboxedEvaluationHarness(
  config: SandboxedEvaluationConfig
): SandboxedEvaluationHarness {
  return new SandboxedEvaluationHarness(config);
}

/**
 * Execute code safely in sandbox with result extraction
 */
export async function executeCodeInSandbox(
  design: AgentDesign,
  input: unknown,
  options?: Partial<SandboxOptions>
): Promise<{
  success: boolean;
  output: unknown;
  executionResult: ExecutionResult;
}> {
  const sandbox = createSandboxExecutor(options);

  try {
    const result = await sandbox.execute({
      design,
      input,
      options,
    });

    const success = result.exitCode === 0 && !result.terminated;

    let output: unknown;
    if (success) {
      try {
        output = JSON.parse(result.stdout);
      } catch {
        output = result.stdout;
      }
    } else {
      output = null;
    }

    return {
      success,
      output,
      executionResult: result,
    };
  } finally {
    await sandbox.cleanup();
  }
}

/**
 * Batch evaluate candidates in sandbox
 */
export async function batchEvaluateInSandbox(
  candidates: AgentDesign[],
  domain: DomainConfig,
  groupId: string,
  options?: Partial<SandboxOptions>,
  kmax?: number
): Promise<EvaluationResult[]> {
  const results: EvaluationResult[] = [];

  for (const design of candidates) {
    const result = await evaluateCandidateInSandbox(design, domain, groupId, options, kmax);
    results.push(result);
  }

  return results;
}