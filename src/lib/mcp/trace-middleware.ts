/**
 * Trace Middleware - MCP Tool Call Tracing with Buffering
 *
 * Wraps MCP tool calls and logs execution traces to PostgreSQL.
 * When flushIntervalMs is specified, traces are buffered and flushed on timer.
 * When flushIntervalMs is omitted, traces are logged immediately.
 */

if (typeof window !== "undefined") {
  throw new Error("This module can only be used server-side");
}

import { logTrace, type TraceLog } from "@/lib/postgres/trace-logger";
import { validateGroupId, GroupIdValidationError } from "@/lib/validation/group-id";
import type { McpToolCaller } from "@/integrations/mcp.client";

const MAX_PAYLOAD_SIZE = 10240;
const STRING_TRUNCATE_LIMIT = 5000;

export interface TraceMiddlewareConfig {
  agentId: string;
  groupId: string;
  innerClient: McpToolCaller;
  flushIntervalMs?: number;
  workflowId?: string;
  stepId?: string;
}

export class TraceMiddleware {
  private readonly _agentId: string;
  private readonly _groupId: string;
  private readonly _innerClient: McpToolCaller;
  private readonly _flushIntervalMs: number;
  private readonly _workflowId?: string;
  private readonly _stepId?: string;
  private readonly _buffer: TraceLog[] = [];
  private _timer: ReturnType<typeof setInterval> | null = null;
  private _sessionActive = false;
  private _toolCallCount = 0;
  private readonly _bufferedMode: boolean;

  constructor(config: TraceMiddlewareConfig) {
    if (!config.agentId || config.agentId.trim().length === 0) {
      throw new Error("agentId is required and cannot be empty");
    }
    if (!config.innerClient) {
      throw new Error("innerClient is required");
    }

    const validatedGroupId = validateGroupId(config.groupId);

    this._agentId = config.agentId;
    this._groupId = validatedGroupId;
    this._innerClient = config.innerClient;
    this._flushIntervalMs = config.flushIntervalMs ?? 0;
    this._workflowId = config.workflowId;
    this._stepId = config.stepId;
    this._bufferedMode = config.flushIntervalMs !== undefined && config.flushIntervalMs > 0;

    if (this._bufferedMode) {
      this._startTimer();
    }
  }

  async callTool<T>(toolName: string, input: Record<string, unknown>): Promise<T> {
    const startTime = performance.now();

    try {
      const result = await this._innerClient.callTool<T>(toolName, input);
      const durationMs = performance.now() - startTime;

      const { data: safeInput, wasTruncated: inputTruncated } = this._serializeAndTruncate(input);
      const { data: safeOutput, wasTruncated: outputTruncated } = this._serializeAndTruncate(result);

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
      if (this._stepId) {
        metadata.step_id = this._stepId;
      }

      const trace: TraceLog = {
        agent_id: this._agentId,
        group_id: this._groupId,
        trace_type: "contribution",
        content: `Tool call: ${toolName}`,
        confidence: 1.0,
        workflow_id: this._workflowId,
        metadata,
      };

      this._toolCallCount++;

      if (this._bufferedMode) {
        this._buffer.push(trace);
      } else {
        await logTrace(trace);
      }

      return result;
    } catch (error: unknown) {
      const durationMs = performance.now() - startTime;

      const errorType = error instanceof Error ? error.constructor.name : "Unknown";
      const errorMessage = error instanceof Error ? error.message : String(error);

      const metadata: Record<string, unknown> = {
        tool_name: toolName,
        success: false,
        duration_ms: durationMs,
        error_type: errorType,
        error_message: errorMessage,
      };

      if (this._stepId) {
        metadata.step_id = this._stepId;
      }

      const trace: TraceLog = {
        agent_id: this._agentId,
        group_id: this._groupId,
        trace_type: "error",
        content: `Tool call failed: ${toolName} - ${errorMessage}`,
        confidence: 0.0,
        workflow_id: this._workflowId,
        metadata,
      };

      // Errors are logged immediately, not buffered
      try {
        await logTrace(trace);
      } catch (logErr) {
        console.error("[TraceMiddleware] Failed to log error trace:", logErr);
      }

      throw error;
    }
  }

  async startSession(workflowId?: string): Promise<void> {
    this._sessionActive = true;
    this._toolCallCount = 0;

    const metadata: Record<string, unknown> = { event: "session_start" };
    if (this._stepId) {
      metadata.step_id = this._stepId;
    }

    await logTrace({
      agent_id: this._agentId,
      group_id: this._groupId,
      trace_type: "decision",
      content: "session_start",
      confidence: 1.0,
      workflow_id: workflowId ?? this._workflowId,
      metadata,
    });

    if (!this._timer) {
      this._startTimer();
    }
  }

  async endSession(): Promise<void> {
    this._sessionActive = false;

    if (this._timer) {
      clearInterval(this._timer);
      this._timer = null;
    }

    await this._flushBuffer();

    const metadata: Record<string, unknown> = {
      event: "session_end",
      trace_count: this._toolCallCount,
    };
    if (this._stepId) {
      metadata.step_id = this._stepId;
    }

    await logTrace({
      agent_id: this._agentId,
      group_id: this._groupId,
      trace_type: "decision",
      content: "session_end",
      confidence: 1.0,
      workflow_id: this._workflowId,
      metadata,
    });
  }

  async logDecision(content: string, confidence: number): Promise<void> {
    const clampedConfidence = Math.max(0, Math.min(1, confidence));

    const metadata: Record<string, unknown> = { event: "decision" };
    if (this._stepId) {
      metadata.step_id = this._stepId;
    }

    await logTrace({
      agent_id: this._agentId,
      group_id: this._groupId,
      trace_type: "decision",
      content,
      confidence: clampedConfidence,
      workflow_id: this._workflowId,
      metadata,
    });
  }

  async logLearning(content: string, confidence?: number): Promise<void> {
    const metadata: Record<string, unknown> = { event: "learning" };
    if (this._stepId) {
      metadata.step_id = this._stepId;
    }

    const clampedConfidence = confidence !== undefined ? Math.max(0, Math.min(1, confidence)) : 1.0;

    await logTrace({
      agent_id: this._agentId,
      group_id: this._groupId,
      trace_type: "learning",
      content,
      confidence: clampedConfidence,
      workflow_id: this._workflowId,
      metadata,
    });
  }

  async flush(): Promise<void> {
    await this._flushBuffer();
  }

  async destroy(): Promise<void> {
    if (this._timer) {
      clearInterval(this._timer);
      this._timer = null;
    }
    this._sessionActive = false;
    await this._flushBuffer();
  }

  private _startTimer(): void {
    if (this._timer) {
      clearInterval(this._timer);
    }
    if (this._flushIntervalMs <= 0) {
      return;
    }
    this._timer = setInterval(async () => {
      await this._flushBuffer();
    }, this._flushIntervalMs);
  }

  private async _flushBuffer(): Promise<void> {
    if (this._buffer.length === 0) {
      return;
    }

    const traces = [...this._buffer];
    this._buffer.length = 0;

    let failedIndex = -1;
    for (let i = 0; i < traces.length; i++) {
      try {
        await logTrace(traces[i]!);
      } catch {
        failedIndex = i;
        break;
      }
    }

    // Re-queue only failed and remaining traces
    if (failedIndex >= 0) {
      this._buffer.unshift(...traces.slice(failedIndex));
    }
  }

  private _serializeAndTruncate(value: unknown): { data: unknown; wasTruncated: boolean } {
    if (value === undefined) {
      return { data: undefined, wasTruncated: false };
    }

    try {
      let serialized = JSON.parse(JSON.stringify(value));
      let { data: truncated, wasTruncated } = this._truncateValue(serialized);

      const jsonStr = JSON.stringify(truncated);
      if (jsonStr.length > MAX_PAYLOAD_SIZE) {
        const safeJson = jsonStr.substring(0, MAX_PAYLOAD_SIZE);
        try {
          truncated = JSON.parse(safeJson);
        } catch {
          truncated = { _truncated: true, _original_size: jsonStr.length };
        }
        wasTruncated = true;
      }

      return { data: truncated, wasTruncated };
    } catch {
      return { data: { _serialization_error: "Non-serializable value" }, wasTruncated: false };
    }
  }

  private _truncateValue(value: unknown): { data: unknown; wasTruncated: boolean } {
    if (typeof value === "string") {
      if (value.length > STRING_TRUNCATE_LIMIT) {
        return { data: value.substring(0, STRING_TRUNCATE_LIMIT), wasTruncated: true };
      }
      return { data: value, wasTruncated: false };
    }

    if (Array.isArray(value)) {
      let wasTruncated = false;
      const result = value.map((item) => {
        const { data, wasTruncated: t } = this._truncateValue(item);
        if (t) {
          wasTruncated = true;
        }
        return data;
      });
      return { data: result, wasTruncated };
    }

    if (typeof value === "object" && value !== null) {
      let wasTruncated = false;
      const result: Record<string, unknown> = {};
      for (const [key, val] of Object.entries(value as Record<string, unknown>)) {
        const { data, wasTruncated: t } = this._truncateValue(val);
        result[key] = data;
        if (t) {
          wasTruncated = true;
        }
      }
      return { data: result, wasTruncated };
    }

    return { data: value, wasTruncated: false };
  }
}
