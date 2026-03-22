/**
 * Completion Promise Detector
 * Story 3.4: Execute Iterative Ralph Development Loops
 * 
 * Detects when a completion promise is met.
 * Supports exact string matching, regex patterns, condition functions, and multi-promises.
 */

import type { CompletionPromise } from "./types";

/**
 * Result of checking a completion promise
 */
export interface CompletionCheckResult {
  isComplete: boolean;
  matchedPromise?: string;
  matchedValue?: string;
  matchDetails?: {
    type: string;
    pattern?: string;
    position?: { start: number; end: number };
    groups?: Record<string, string>;
  };
  iteration: number;
  timestamp: Date;
  errorMessage?: string;
}

/**
 * Detector configuration
 */
export interface CompletionDetectorConfig {
  enableLogging: boolean;
  onMatch?: (result: CompletionCheckResult) => void;
  onCheck?: (result: CompletionCheckResult) => void;
}

/**
 * Completion Promise Detector
 * Checks if output satisfies the completion promise
 */
export class CompletionDetector {
  private config: CompletionDetectorConfig;
  private checkHistory: CompletionCheckResult[] = [];

  constructor(config: Partial<CompletionDetectorConfig> = {}) {
    this.config = {
      enableLogging: config.enableLogging ?? false,
      onMatch: config.onMatch,
      onCheck: config.onCheck,
    };
  }

  /**
   * Check if the output satisfies the completion promise
   * AC 2: Loop terminates only when exact promise string is detected or Kmax is reached
   */
  async isComplete<T = unknown>(
    output: T,
    promise: CompletionPromise<T>,
    iteration: number,
  ): Promise<CompletionCheckResult> {
    const result = await this.checkPromise(output, promise, iteration);
    this.checkHistory.push(result);

    if (this.config.onCheck) {
      this.config.onCheck(result);
    }

    if (result.isComplete && this.config.onMatch) {
      this.config.onMatch(result);
    }

    if (this.config.enableLogging) {
      this.logResult(result);
    }

    return result;
  }

  /**
   * Internal check method that handles different promise types
   */
  private async checkPromise<T>(
    output: T,
    promise: CompletionPromise<T>,
    iteration: number,
  ): Promise<CompletionCheckResult> {
    if (typeof promise === "string") {
      return this.checkExactString(output, promise, iteration);
    }

    switch (promise.type) {
      case "exact":
        return this.checkExactString(output, promise.value, iteration);
      case "regex":
        return this.checkRegex(output, promise.pattern, iteration);
      case "condition":
        return this.checkCondition(output, promise.check, iteration);
      case "multi":
        return this.checkMultiPromise(output, promise.promises, iteration);
      default:
        return {
          isComplete: false,
          iteration,
          timestamp: new Date(),
          errorMessage: `Unknown promise type: ${(promise as { type: string }).type}`,
        };
    }
  }

  /**
   * Check for exact string match
   * AC 2: "exact promise string is detected"
   */
  private checkExactString<T>(
    output: T,
    target: string,
    iteration: number,
  ): CompletionCheckResult {
    const outputString = this.stringifyOutput(output);
    const isComplete = outputString.includes(target);

    return {
      isComplete,
      matchedPromise: isComplete ? target : undefined,
      matchedValue: isComplete ? target : undefined,
      matchDetails: isComplete
        ? {
            type: "exact",
            position: this.findPosition(outputString, target),
          }
        : undefined,
      iteration,
      timestamp: new Date(),
    };
  }

  /**
   * Check against a regex pattern
   */
  private checkRegex<T>(
    output: T,
    pattern: string | RegExp,
    iteration: number,
  ): CompletionCheckResult {
    const outputString = this.stringifyOutput(output);
    const regex = typeof pattern === "string" ? new RegExp(pattern, "g") : pattern;
    const match = regex.exec(outputString);

    const isComplete = match !== null;

    // Build groups object from match
    let groups: Record<string, string> | undefined;
    if (isComplete && match) {
      groups = match.groups ?? {};
      // Also add numeric indices for capture groups
      for (let i = 1; i < match.length; i++) {
        if (match[i] !== undefined) {
          groups[i.toString()] = match[i];
        }
      }
    }

    return {
      isComplete,
      matchedPromise: isComplete ? match[0] : undefined,
      matchedValue: isComplete ? match[0] : undefined,
      matchDetails: isComplete
        ? {
            type: "regex",
            pattern: regex.source,
            position: match.index !== undefined ? { start: match.index, end: match.index + match[0].length } : undefined,
            groups,
          }
        : undefined,
      iteration,
      timestamp: new Date(),
    };
  }

  /**
   * Check using a condition function
   */
  private checkCondition<T>(
    output: T,
    check: (output: T, iteration: number) => boolean,
    iteration: number,
  ): CompletionCheckResult {
    try {
      const isComplete = check(output, iteration);

      return {
        isComplete,
        matchedPromise: isComplete ? "condition_function" : undefined,
        matchedValue: isComplete ? "condition_satisfied" : undefined,
        matchDetails: isComplete
          ? { type: "condition" }
          : undefined,
        iteration,
        timestamp: new Date(),
      };
    } catch (error) {
      return {
        isComplete: false,
        iteration,
        timestamp: new Date(),
        errorMessage: error instanceof Error ? error.message : "Condition check failed",
      };
    }
  }

  /**
   * Check multiple promises (all must match)
   */
  private async checkMultiPromise<T>(
    output: T,
    promises: CompletionPromise<T>[],
    iteration: number,
  ): Promise<CompletionCheckResult> {
    const results: CompletionCheckResult[] = [];

    for (const p of promises) {
      const result = await this.checkPromise(output, p, iteration);
      results.push(result);
      if (!result.isComplete) {
        return {
          isComplete: false,
          iteration,
          timestamp: new Date(),
          errorMessage: `Multi-promise failed at: ${result.errorMessage ?? "not matched"}`,
        };
      }
    }

    return {
      isComplete: true,
      matchedPromise: "multi_promise",
      matchedValue: "all_promises_satisfied",
      matchDetails: {
        type: "multi",
      },
      iteration,
      timestamp: new Date(),
    };
  }

  /**
   * Convert output to string for matching
   */
  private stringifyOutput<T>(output: T): string {
    if (typeof output === "string") {
      return output;
    }
    if (output === null || output === undefined) {
      return "";
    }
    try {
      return JSON.stringify(output);
    } catch {
      return String(output);
    }
  }

  /**
   * Find position of target in string
   */
  private findPosition(str: string, target: string): { start: number; end: number } {
    const index = str.indexOf(target);
    if (index === -1) {
      return { start: -1, end: -1 };
    }
    return { start: index, end: index + target.length };
  }

  /**
   * Log check result for debugging
   */
  private logResult(result: CompletionCheckResult): void {
    const status = result.isComplete ? "COMPLETE" : "INCOMPLETE";
    console.log(`[CompletionDetector] [${result.timestamp.toISOString()}] Iteration ${result.iteration}: ${status}`);
    if (result.isComplete) {
      console.log(`[CompletionDetector] Matched: ${result.matchedPromise}`);
    }
    if (result.errorMessage) {
      console.log(`[CompletionDetector] Error: ${result.errorMessage}`);
    }
  }

  /**
   * Get check history
   */
  getHistory(): CompletionCheckResult[] {
    return [...this.checkHistory];
  }

  /**
   * Clear check history
   */
  clearHistory(): void {
    this.checkHistory = [];
  }

  /**
   * Check if promise is valid
   */
  static isValidPromise(promise: CompletionPromise): boolean {
    if (typeof promise === "string") {
      return promise.length > 0;
    }

    switch (promise.type) {
      case "exact":
        return typeof promise.value === "string" && promise.value.length > 0;
      case "regex":
        try {
          new RegExp(typeof promise.pattern === "string" ? promise.pattern : promise.pattern);
          return true;
        } catch {
          return false;
        }
      case "condition":
        return typeof promise.check === "function";
      case "multi":
        return Array.isArray(promise.promises) && promise.promises.length > 0;
      default:
        return false;
    }
  }

  /**
   * Create a simple string promise
   */
  static exactPromise(value: string): CompletionPromise {
    return { type: "exact", value };
  }

  /**
   * Create a regex promise
   */
  static regexPromise(pattern: string | RegExp): CompletionPromise {
    return { type: "regex", pattern };
  }

  /**
   * Create a condition promise
   */
  static conditionPromise<T>(check: (output: T, iteration: number) => boolean): CompletionPromise<T> {
    return { type: "condition", check };
  }

  /**
   * Create a multi-promise (all must match)
   */
  static multiPromise<T>(...promises: CompletionPromise<T>[]): CompletionPromise<T> {
    return { type: "multi", promises };
  }
}

/**
 * Create a completion detector instance
 */
export function createCompletionDetector(
  config?: Partial<CompletionDetectorConfig>,
): CompletionDetector {
  return new CompletionDetector(config);
}

/**
 * Check Kmax integration - ensure we don't exceed max iterations
 * This integrates with budget enforcer for bounded autonomy
 */
export function checkKmax(
  currentIteration: number,
  maxIterations: number,
): { exceeded: boolean; remaining: number; percentUsed: number } {
  const exceeded = currentIteration >= maxIterations;
  const remaining = Math.max(0, maxIterations - currentIteration);
  const percentUsed = maxIterations > 0 ? (currentIteration / maxIterations) * 100 : 0;

  return {
    exceeded,
    remaining,
    percentUsed,
  };
}

/**
 * Combine completion and Kmax checks
 */
export interface CombinedCheckResult {
  isComplete: boolean;
  kmaxExceeded: boolean;
  shouldTerminate: boolean;
  terminateReason?: "completion" | "kmax" | "both";
  completionResult: CompletionCheckResult;
  kmaxResult: {
    exceeded: boolean;
    remaining: number;
    percentUsed: number;
  };
}

/**
 * Check both completion promise and Kmax in one call
 */
export async function checkCompletionAndKmax<T>(
  detector: CompletionDetector,
  output: T,
  promise: CompletionPromise<T>,
  iteration: number,
  maxIterations: number,
): Promise<CombinedCheckResult> {
  const completionResult = await detector.isComplete(output, promise, iteration);
  const kmaxResult = checkKmax(iteration, maxIterations);

  const isComplete = completionResult.isComplete;
  const kmaxExceeded = kmaxResult.exceeded;

  const shouldTerminate = isComplete || kmaxExceeded;
  let terminateReason: "completion" | "kmax" | "both" | undefined;

  if (isComplete && kmaxExceeded) {
    terminateReason = "both";
  } else if (isComplete) {
    terminateReason = "completion";
  } else if (kmaxExceeded) {
    terminateReason = "kmax";
  }

  return {
    isComplete,
    kmaxExceeded,
    shouldTerminate,
    terminateReason,
    completionResult,
    kmaxResult,
  };
}