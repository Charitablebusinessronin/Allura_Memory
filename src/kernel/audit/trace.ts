/**
 * RuVix Kernel - Audit Trace Implementation
 * 
 * Migrated from src/lib/mcp/trace-middleware.ts
 * 
 * This module provides audit trail logging through the kernel.
 * All traces are logged via the kernel's audit syscall.
 * 
 * DEPRECATION: src/lib/mcp/trace-middleware.ts is now deprecated.
 * Use kernel syscalls or SDK wrapper instead.
 */

if (typeof window !== "undefined") {
  throw new Error("This module can only be used server-side");
}

import { logTrace, type TraceLog } from "@/lib/postgres/trace-logger";
import { validateTenantIsolation } from "../policy/tenant";

// ─────────────────────────────────────────────────────────────────────────────
// CONSTANTS
// ─────────────────────────────────────────────────────────────────────────────

const MAX_PAYLOAD_SIZE = 10240; // 10KB
const STRING_TRUNCATE_LIMIT = 5000;

// ─────────────────────────────────────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Kernel audit trace configuration
 */
export interface KernelTraceConfig {
  /** Agent ID */
  agentId: string;
  
  /** Tenant group ID */
  groupId: string;
  
  /** Optional workflow ID */
  workflowId?: string;
  
  /** Optional step ID */
  stepId?: string;
  
  /** Enable buffering */
  buffered?: boolean;
  
  /** Flush interval (if buffered) */
  flushIntervalMs?: number;
}

/**
 * Kernel trace result
 */
export interface KernelTraceResult {
  success: boolean;
  traceId?: string;
  error?: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// TRUNCATION UTILITIES
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Serialize and truncate data for safe logging
 */
function serializeAndTruncate<T>(data: T): { data: unknown; wasTruncated: boolean } {
  try {
    const json = JSON.stringify(data);
    
    if (json.length > MAX_PAYLOAD_SIZE) {
      // Truncate string representation
      const truncated = json.substring(0, STRING_TRUNCATE_LIMIT);
      return {
        data: truncated,
        wasTruncated: true,
      };
    }
    
    return {
      data,
      wasTruncated: false,
    };
  } catch {
    // Circular reference or other serialization error
    return {
      data: String(data),
      wasTruncated: true,
    };
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// KERNEL TRACE LOGGER
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Kernel-native trace logger
 * 
 * Logs traces through the kernel's audit syscall.
 * Replaces TraceMiddleware for kernel-backed tracing.
 */
export class KernelTraceLogger {
  private readonly agentId: string;
  private readonly groupId: string;
  private readonly workflowId?: string;
  private readonly stepId?: string;
  private readonly buffered: boolean;
  private readonly flushIntervalMs?: number;
  private readonly buffer: TraceLog[] = [];
  private timer: ReturnType<typeof setInterval> | null = null;
  private toolCallCount = 0;

  constructor(config: KernelTraceConfig) {
    if (!config.agentId || config.agentId.trim().length === 0) {
      throw new Error("agentId is required and cannot be empty");
    }

    // Validate tenant isolation
    this.groupId = validateTenantIsolation(config.groupId);
    this.agentId = config.agentId;
    this.workflowId = config.workflowId;
    this.stepId = config.stepId;
    this.buffered = config.buffered ?? false;
    this.flushIntervalMs = config.flushIntervalMs;

    // Start timer if buffered mode
    if (this.buffered && this.flushIntervalMs) {
      this.startTimer();
    }
  }

  /**
   * Log a tool call trace
   */
  async logToolCall<T>(
    toolName: string,
    input: Record<string, unknown>,
    result: T,
    durationMs: number
  ): Promise<KernelTraceResult> {
    try {
      const { data: safeInput, wasTruncated: inputTruncated } = serializeAndTruncate(input);
      const { data: safeOutput, wasTruncated: outputTruncated } = serializeAndTruncate(result);

      const metadata: Record<string, unknown> = {
        tool_name: toolName,
        success: true,
        duration_ms: durationMs,
        input: safeInput,
        output: safeOutput,
      };

      if (inputTruncated) {
        metadata.input_truncated = true;
      }
      if (outputTruncated) {
        metadata.output_truncated = true;
      }
      if (this.stepId) {
        metadata.step_id = this.stepId;
      }

      const trace: TraceLog = {
        agent_id: this.agentId,
        group_id: this.groupId,
        trace_type: "contribution",
        content: `Tool call: ${toolName}`,
        confidence: 1.0,
        workflow_id: this.workflowId,
        metadata,
      };

      this.toolCallCount++;

      if (this.buffered) {
        this.buffer.push(trace);
      } else {
        await logTrace(trace);
      }

      return {
        success: true,
        traceId: `trace-${this.toolCallCount}`,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  /**
   * Log an error trace
   */
  async logError(
    toolName: string,
    error: unknown,
    durationMs: number
  ): Promise<KernelTraceResult> {
    const errorType = error instanceof Error ? error.constructor.name : "Unknown";
    const errorMessage = error instanceof Error ? error.message : String(error);

    const metadata: Record<string, unknown> = {
      tool_name: toolName,
      success: false,
      duration_ms: durationMs,
      error_type: errorType,
      error_message: errorMessage,
    };

    if (this.stepId) {
      metadata.step_id = this.stepId;
    }

    const trace: TraceLog = {
      agent_id: this.agentId,
      group_id: this.groupId,
      trace_type: "error",
      content: `Tool call failed: ${toolName} - ${errorMessage}`,
      confidence: 0.0,
      workflow_id: this.workflowId,
      metadata,
    };

    // Errors are always logged immediately
    try {
      await logTrace(trace);
      return { success: true };
    } catch (logErr) {
      return {
        success: false,
        error: `Failed to log error trace: ${logErr instanceof Error ? logErr.message : String(logErr)}`,
      };
    }
  }

  /**
   * Flush buffered traces
   */
  async flush(): Promise<void> {
    if (this.buffer.length === 0) {
      return;
    }

    const traces = [...this.buffer];
    this.buffer.length = 0;

    for (const trace of traces) {
      await logTrace(trace);
    }
  }

  /**
   * Start flush timer
   */
  private startTimer(): void {
    if (this.timer) {
      clearInterval(this.timer);
    }

    this.timer = setInterval(async () => {
      await this.flush();
    }, this.flushIntervalMs);
  }

  /**
   * Stop flush timer
   */
  stopTimer(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  /**
   * Get trace count
   */
  getTraceCount(): number {
    return this.toolCallCount;
  }

  /**
   * Get buffer size
   */
  getBufferSize(): number {
    return this.buffer.length;
  }

  /**
   * Cleanup (call when done)
   */
  async cleanup(): Promise<void> {
    this.stopTimer();
    await this.flush();
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// KERNEL SYSCALL INTEGRATION
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Build audit claims for kernel proof
 * 
 * @param traceType - Type of trace
 * @param auditContext - Additional audit context
 * @returns Claims object for kernel proof
 */
export function buildAuditClaims(
  traceType: string,
  auditContext?: Record<string, unknown>
) {
  return {
    audit_context: {
      trace_type: traceType,
      ...auditContext,
    },
  };
}

/**
 * Create kernel trace logger
 */
export function createKernelTraceLogger(
  config: KernelTraceConfig
): KernelTraceLogger {
  return new KernelTraceLogger(config);
}

// ─────────────────────────────────────────────────────────────────────────────
// BACKWARD COMPATIBILITY WRAPPER
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Backward compatibility wrapper for TraceMiddleware migration
 * 
 * This allows gradual migration from TraceMiddleware to kernel-native tracing.
 * 
 * @deprecated Use KernelTraceLogger or kernel syscalls directly
 */
export class TraceMiddlewareCompatWrapper {
  private readonly logger: KernelTraceLogger;

  constructor(config: KernelTraceConfig) {
    this.logger = createKernelTraceLogger(config);
  }

  /**
   * Call tool with tracing (replaces TraceMiddleware.callTool)
   */
  async callTool<T>(
    toolName: string,
    input: Record<string, unknown>,
    executor: () => Promise<T>
  ): Promise<T> {
    const startTime = performance.now();

    try {
      const result = await executor();
      const durationMs = performance.now() - startTime;

      await this.logger.logToolCall(toolName, input, result, durationMs);

      return result;
    } catch (error) {
      const durationMs = performance.now() - startTime;
      await this.logger.logError(toolName, error, durationMs);
      throw error;
    }
  }

  /**
   * Cleanup
   */
  async cleanup(): Promise<void> {
    await this.logger.cleanup();
  }
}

// Types are exported inline above
