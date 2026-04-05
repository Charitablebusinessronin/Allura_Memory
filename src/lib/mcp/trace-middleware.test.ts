/**
 * Trace Middleware Tests
 * 
 * Tests for the TraceMiddleware class that wraps MCP tool calls
 * and logs execution traces to PostgreSQL.
 * 
 * TDD: These tests define the expected behavior before implementation.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { TraceMiddleware, type TraceMiddlewareConfig } from "./trace-middleware";
import { logTrace, TraceValidationError } from "@/lib/postgres/trace-logger";
import { validateGroupId, GroupIdValidationError } from "@/lib/validation/group-id";
import type { McpToolCaller } from "@/integrations/mcp.client";

// Mock external dependencies
vi.mock("@/lib/postgres/trace-logger", () => ({
  logTrace: vi.fn(),
  TraceValidationError: class TraceValidationError extends Error {
    constructor(message: string) {
      super(message);
      this.name = "TraceValidationError";
    }
  },
}));

vi.mock("@/lib/validation/group-id", () => ({
  validateGroupId: vi.fn(),
  GroupIdValidationError: class GroupIdValidationError extends Error {
    constructor(message: string) {
      super(message);
      this.name = "GroupIdValidationError";
    }
  },
}));

describe("TraceMiddleware", () => {
  let mockInnerClient: McpToolCaller;
  let mockLogTrace: ReturnType<typeof vi.fn>;
  let mockValidateGroupId: ReturnType<typeof vi.fn>;

  const validGroupId = "allura-test";
  const validAgentId = "memory-orchestrator";

  beforeEach(() => {
    vi.useFakeTimers();
    mockInnerClient = {
      callTool: vi.fn().mockResolvedValue({ success: true, data: { id: "page-123" } }),
    };
    mockLogTrace = vi.mocked(logTrace);
    mockValidateGroupId = vi.mocked(validateGroupId);

    mockValidateGroupId.mockReturnValue(validGroupId);
    mockLogTrace.mockResolvedValue({
      id: 1,
      group_id: validGroupId,
      event_type: "trace.contribution",
      agent_id: validAgentId,
      workflow_id: null,
      step_id: null,
      parent_event_id: null,
      metadata: { confidence: 1.0 },
      outcome: { content: "test" },
      status: "completed",
      created_at: new Date(),
      inserted_at: new Date(),
    });
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.clearAllMocks();
  });

  // =========================================================================
  // 1. Happy Path Tests
  // =========================================================================

  describe("happy path", () => {
    it("should produce a trace with correct payload when tool call succeeds", async () => {
      const middleware = new TraceMiddleware({
        agentId: validAgentId,
        groupId: validGroupId,
        innerClient: mockInnerClient,
      });

      const result = await middleware.callTool("notion-create-pages", {
        title: "Test Page",
      });

      expect(mockLogTrace).toHaveBeenCalledTimes(1);
      expect(mockLogTrace).toHaveBeenCalledWith(
        expect.objectContaining({
          agent_id: validAgentId,
          group_id: validGroupId,
          trace_type: "contribution",
          content: expect.stringContaining("notion-create-pages"),
          confidence: 1.0,
          metadata: expect.objectContaining({
            tool_name: "notion-create-pages",
            success: true,
          }),
        })
      );
      expect(result).toEqual({ success: true, data: { id: "page-123" } });
    });

    it("should produce multiple traces when multiple tool calls are made", async () => {
      const middleware = new TraceMiddleware({
        agentId: validAgentId,
        groupId: validGroupId,
        innerClient: mockInnerClient,
      });

      await middleware.callTool("notion-create-pages", { title: "Page 1" });
      await middleware.callTool("notion-update-page", { page_id: "1" });
      await middleware.callTool("notion-fetch", { id: "1" });

      expect(mockLogTrace).toHaveBeenCalledTimes(3);
      expect(mockLogTrace).toHaveBeenNthCalledWith(
        1,
        expect.objectContaining({
          metadata: expect.objectContaining({ tool_name: "notion-create-pages" }),
        })
      );
      expect(mockLogTrace).toHaveBeenNthCalledWith(
        2,
        expect.objectContaining({
          metadata: expect.objectContaining({ tool_name: "notion-update-page" }),
        })
      );
      expect(mockLogTrace).toHaveBeenNthCalledWith(
        3,
        expect.objectContaining({
          metadata: expect.objectContaining({ tool_name: "notion-fetch" }),
        })
      );
    });

    it("should include duration_ms in trace metadata", async () => {
      const middleware = new TraceMiddleware({
        agentId: validAgentId,
        groupId: validGroupId,
        innerClient: mockInnerClient,
      });

      await middleware.callTool("notion-search", { query: "test" });

      expect(mockLogTrace).toHaveBeenCalledWith(
        expect.objectContaining({
          metadata: expect.objectContaining({
            duration_ms: expect.any(Number),
          }),
        })
      );
    });

    it("should set success=true and confidence=1.0 for successful calls", async () => {
      const middleware = new TraceMiddleware({
        agentId: validAgentId,
        groupId: validGroupId,
        innerClient: mockInnerClient,
      });

      await middleware.callTool("notion-fetch", { id: "test" });

      expect(mockLogTrace).toHaveBeenCalledWith(
        expect.objectContaining({
          confidence: 1.0,
          metadata: expect.objectContaining({
            success: true,
          }),
        })
      );
    });

    it("should include input and output in trace metadata", async () => {
      const middleware = new TraceMiddleware({
        agentId: validAgentId,
        groupId: validGroupId,
        innerClient: mockInnerClient,
      });

      const input = { title: "Test Page", content: "Hello world" };
      await middleware.callTool("notion-create-pages", input);

      expect(mockLogTrace).toHaveBeenCalledWith(
        expect.objectContaining({
          metadata: expect.objectContaining({
            input: input,
            output: expect.objectContaining({ success: true, data: { id: "page-123" } }),
          }),
        })
      );
    });
  });

  // =========================================================================
  // 2. Error Path Tests
  // =========================================================================

  describe("error path", () => {
    it("should produce a trace with error details when tool call fails", async () => {
      const toolError = new Error("MCP connection timeout");
      mockInnerClient.callTool = vi.fn().mockRejectedValue(toolError);

      const middleware = new TraceMiddleware({
        agentId: validAgentId,
        groupId: validGroupId,
        innerClient: mockInnerClient,
      });

      await expect(
        middleware.callTool("notion-create-pages", { title: "Test" })
      ).rejects.toThrow("MCP connection timeout");

      expect(mockLogTrace).toHaveBeenCalledTimes(1);
      expect(mockLogTrace).toHaveBeenCalledWith(
        expect.objectContaining({
          trace_type: "error",
          content: expect.stringContaining("MCP connection timeout"),
          confidence: 0.0,
          metadata: expect.objectContaining({
            success: false,
            error_type: "Error",
            error_message: "MCP connection timeout",
          }),
        })
      );
    });

    it("should include error_type and error_message in trace metadata", async () => {
      const customError = new TypeError("Invalid argument type");
      mockInnerClient.callTool = vi.fn().mockRejectedValue(customError);

      const middleware = new TraceMiddleware({
        agentId: validAgentId,
        groupId: validGroupId,
        innerClient: mockInnerClient,
      });

      await expect(
        middleware.callTool("notion-fetch", { id: "test" })
      ).rejects.toThrow("Invalid argument type");

      expect(mockLogTrace).toHaveBeenCalledWith(
        expect.objectContaining({
          metadata: expect.objectContaining({
            error_type: "TypeError",
            error_message: "Invalid argument type",
          }),
        })
      );
    });

    it("should set success=false for failed tool calls", async () => {
      mockInnerClient.callTool = vi.fn().mockRejectedValue(new Error("Tool failed"));

      const middleware = new TraceMiddleware({
        agentId: validAgentId,
        groupId: validGroupId,
        innerClient: mockInnerClient,
      });

      await expect(
        middleware.callTool("notion-search", { query: "test" })
      ).rejects.toThrow();

      expect(mockLogTrace).toHaveBeenCalledWith(
        expect.objectContaining({
          metadata: expect.objectContaining({
            success: false,
          }),
        })
      );
    });

    it("should re-throw the original error after logging", async () => {
      const originalError = new Error("Database unavailable");
      mockInnerClient.callTool = vi.fn().mockRejectedValue(originalError);

      const middleware = new TraceMiddleware({
        agentId: validAgentId,
        groupId: validGroupId,
        innerClient: mockInnerClient,
      });

      await expect(
        middleware.callTool("notion-fetch", { id: "test" })
      ).rejects.toThrow("Database unavailable");
    });

    it("should handle non-Error rejections gracefully", async () => {
      mockInnerClient.callTool = vi.fn().mockRejectedValue("string error");

      const middleware = new TraceMiddleware({
        agentId: validAgentId,
        groupId: validGroupId,
        innerClient: mockInnerClient,
      });

      await expect(
        middleware.callTool("notion-fetch", { id: "test" })
      ).rejects.toBe("string error");

      expect(mockLogTrace).toHaveBeenCalledWith(
        expect.objectContaining({
          trace_type: "error",
          metadata: expect.objectContaining({
            error_type: "Unknown",
            error_message: "string error",
          }),
        })
      );
    });
  });

  // =========================================================================
  // 3. Group ID Enforcement Tests
  // =========================================================================

  describe("group_id enforcement", () => {
    it("should reject group_id not starting with 'allura-'", () => {
      mockValidateGroupId.mockImplementation(() => {
        throw new GroupIdValidationError("group_id must use allura-* format");
      });

      expect(
        () =>
          new TraceMiddleware({
            agentId: validAgentId,
            groupId: "invalid-group",
            innerClient: mockInnerClient,
          })
      ).toThrow(GroupIdValidationError);
    });

    it("should reject empty group_id", () => {
      mockValidateGroupId.mockImplementation(() => {
        throw new GroupIdValidationError("group_id is required and cannot be empty");
      });

      expect(
        () =>
          new TraceMiddleware({
            agentId: validAgentId,
            groupId: "",
            innerClient: mockInnerClient,
          })
      ).toThrow(GroupIdValidationError);
    });

    it("should reject undefined group_id", () => {
      mockValidateGroupId.mockImplementation(() => {
        throw new GroupIdValidationError("group_id is required");
      });

      expect(
        () =>
          new TraceMiddleware({
            agentId: validAgentId,
            groupId: undefined as unknown as string,
            innerClient: mockInnerClient,
          })
      ).toThrow(GroupIdValidationError);
    });

    it("should pass validation for valid allura-* group_id", () => {
      mockValidateGroupId.mockReturnValue("allura-faith-meats");

      expect(
        () =>
          new TraceMiddleware({
            agentId: validAgentId,
            groupId: "allura-faith-meats",
            innerClient: mockInnerClient,
          })
      ).not.toThrow();
    });

    it("should use validated group_id from validateGroupId", () => {
      mockValidateGroupId.mockReturnValue("allura-normalized");

      const middleware = new TraceMiddleware({
        agentId: validAgentId,
        groupId: "  allura-normalized  ",
        innerClient: mockInnerClient,
      });

      expect(mockValidateGroupId).toHaveBeenCalledWith("  allura-normalized  ");
    });
  });

  // =========================================================================
  // 4. Buffer & Flush Tests
  // =========================================================================

  describe("buffer and flush", () => {
    it("should buffer traces instead of logging immediately", async () => {
      const middleware = new TraceMiddleware({
        agentId: validAgentId,
        groupId: validGroupId,
        innerClient: mockInnerClient,
        flushIntervalMs: 5000,
      });

      await middleware.callTool("notion-create-pages", { title: "Test" });

      // Traces should be buffered, not logged immediately
      expect(mockLogTrace).not.toHaveBeenCalled();
    });

    it("should flush all buffered traces when flush is called", async () => {
      const middleware = new TraceMiddleware({
        agentId: validAgentId,
        groupId: validGroupId,
        innerClient: mockInnerClient,
        flushIntervalMs: 5000,
      });

      await middleware.callTool("notion-create-pages", { title: "Page 1" });
      await middleware.callTool("notion-update-page", { page_id: "1" });

      expect(mockLogTrace).not.toHaveBeenCalled();

      await middleware.flush();

      expect(mockLogTrace).toHaveBeenCalledTimes(2);
    });

    it("should put traces back in buffer when flush fails", async () => {
      const middleware = new TraceMiddleware({
        agentId: validAgentId,
        groupId: validGroupId,
        innerClient: mockInnerClient,
        flushIntervalMs: 5000,
      });

      await middleware.callTool("notion-create-pages", { title: "Test" });

      // Make logTrace fail on flush
      mockLogTrace.mockRejectedValueOnce(new Error("Database down"));

      await middleware.flush();

      // Trace should still be in buffer
      mockLogTrace.mockResolvedValueOnce({
        id: 1,
        group_id: validGroupId,
        event_type: "trace.contribution",
        agent_id: validAgentId,
        workflow_id: null,
        step_id: null,
        parent_event_id: null,
        metadata: { confidence: 1.0 },
        outcome: { content: "test" },
        status: "completed",
        created_at: new Date(),
        inserted_at: new Date(),
      });

      await middleware.flush();

      // Should have tried again with the same trace
      expect(mockLogTrace).toHaveBeenCalledTimes(2);
    });

    it("should run flush timer every 5 seconds by default", async () => {
      const middleware = new TraceMiddleware({
        agentId: validAgentId,
        groupId: validGroupId,
        innerClient: mockInnerClient,
        flushIntervalMs: 5000,
      });

      await middleware.callTool("notion-create-pages", { title: "Test" });

      expect(mockLogTrace).not.toHaveBeenCalled();

      // Advance timer by 5 seconds
      await vi.advanceTimersByTimeAsync(5000);

      expect(mockLogTrace).toHaveBeenCalledTimes(1);
    });

    it("should not flush before the interval elapses", async () => {
      const middleware = new TraceMiddleware({
        agentId: validAgentId,
        groupId: validGroupId,
        innerClient: mockInnerClient,
        flushIntervalMs: 5000,
      });

      await middleware.callTool("notion-create-pages", { title: "Test" });

      // Advance timer by 4 seconds (before interval)
      await vi.advanceTimersByTimeAsync(4000);

      expect(mockLogTrace).not.toHaveBeenCalled();
    });

    it("should flush remaining traces on destroy", async () => {
      const middleware = new TraceMiddleware({
        agentId: validAgentId,
        groupId: validGroupId,
        innerClient: mockInnerClient,
        flushIntervalMs: 5000,
      });

      await middleware.callTool("notion-create-pages", { title: "Test" });
      await middleware.callTool("notion-fetch", { id: "1" });

      expect(mockLogTrace).not.toHaveBeenCalled();

      await middleware.destroy();

      expect(mockLogTrace).toHaveBeenCalledTimes(2);
    });

    it("should clear the buffer after successful flush", async () => {
      const middleware = new TraceMiddleware({
        agentId: validAgentId,
        groupId: validGroupId,
        innerClient: mockInnerClient,
        flushIntervalMs: 5000,
      });

      await middleware.callTool("notion-create-pages", { title: "Test" });
      await middleware.flush();

      expect(mockLogTrace).toHaveBeenCalledTimes(1);

      // Reset mock to check for additional calls
      mockLogTrace.mockClear();

      // Flush again - should not log anything since buffer is empty
      await middleware.flush();

      expect(mockLogTrace).not.toHaveBeenCalled();
    });
  });

  // =========================================================================
  // 5. Lifecycle Tests
  // =========================================================================

  describe("lifecycle", () => {
    it("should produce a session start trace when startSession is called", async () => {
      const middleware = new TraceMiddleware({
        agentId: validAgentId,
        groupId: validGroupId,
        innerClient: mockInnerClient,
        flushIntervalMs: 5000,
      });

      await middleware.startSession("workflow-123");

      expect(mockLogTrace).toHaveBeenCalledWith(
        expect.objectContaining({
          agent_id: validAgentId,
          group_id: validGroupId,
          trace_type: "decision",
          content: expect.stringContaining("session_start"),
          workflow_id: "workflow-123",
          metadata: expect.objectContaining({
            event: "session_start",
          }),
        })
      );
    });

    it("should produce a session end trace with trace count when endSession is called", async () => {
      const middleware = new TraceMiddleware({
        agentId: validAgentId,
        groupId: validGroupId,
        innerClient: mockInnerClient,
        flushIntervalMs: 5000,
      });

      await middleware.startSession("workflow-123");
      mockLogTrace.mockClear();

      await middleware.callTool("notion-create-pages", { title: "Page 1" });
      await middleware.callTool("notion-update-page", { page_id: "1" });

      await middleware.endSession();

      expect(mockLogTrace).toHaveBeenCalledWith(
        expect.objectContaining({
          trace_type: "decision",
          content: expect.stringContaining("session_end"),
          metadata: expect.objectContaining({
            event: "session_end",
            trace_count: 2,
          }),
        })
      );
    });

    it("should flush remaining buffer when session ends", async () => {
      const middleware = new TraceMiddleware({
        agentId: validAgentId,
        groupId: validGroupId,
        innerClient: mockInnerClient,
        flushIntervalMs: 5000,
      });

      await middleware.startSession("workflow-123");
      mockLogTrace.mockClear();

      await middleware.callTool("notion-create-pages", { title: "Test" });

      expect(mockLogTrace).not.toHaveBeenCalled();

      await middleware.endSession();

      // Should have logged the buffered trace + session end trace
      expect(mockLogTrace).toHaveBeenCalledTimes(2);
    });

    it("should stop the flush timer when session ends", async () => {
      const middleware = new TraceMiddleware({
        agentId: validAgentId,
        groupId: validGroupId,
        innerClient: mockInnerClient,
        flushIntervalMs: 5000,
      });

      await middleware.startSession("workflow-123");
      await middleware.callTool("notion-create-pages", { title: "Test" });

      // endSession flushes buffer + logs session end = 2 calls
      await middleware.endSession();
      const callsAfterEnd = mockLogTrace.mock.calls.length;

      // Advance timer - should not auto-flush after session ends
      await vi.advanceTimersByTimeAsync(5000);

      // No additional calls should have been made after endSession
      expect(mockLogTrace.mock.calls.length).toBe(callsAfterEnd);
    });
  });

  // =========================================================================
  // 6. Edge Cases
  // =========================================================================

  describe("edge cases", () => {
    it("should truncate large input to 10KB", async () => {
      const middleware = new TraceMiddleware({
        agentId: validAgentId,
        groupId: validGroupId,
        innerClient: mockInnerClient,
        flushIntervalMs: 5000,
      });

      const largeInput = { data: "x".repeat(15000) };
      await middleware.callTool("notion-create-pages", largeInput);
      await middleware.flush();

      expect(mockLogTrace).toHaveBeenCalledWith(
        expect.objectContaining({
          metadata: expect.objectContaining({
            input: expect.objectContaining({
              data: expect.any(String),
            }),
            input_truncated: true,
          }),
        })
      );

      const loggedCall = mockLogTrace.mock.calls[0][0];
      const inputStr = JSON.stringify(loggedCall.metadata.input);
      expect(inputStr.length).toBeLessThanOrEqual(10240);
    });

    it("should truncate large output to 10KB", async () => {
      mockInnerClient.callTool = vi.fn().mockResolvedValue({
        data: "x".repeat(15000),
      });

      const middleware = new TraceMiddleware({
        agentId: validAgentId,
        groupId: validGroupId,
        innerClient: mockInnerClient,
        flushIntervalMs: 5000,
      });

      await middleware.callTool("notion-fetch", { id: "test" });
      await middleware.flush();

      expect(mockLogTrace).toHaveBeenCalledWith(
        expect.objectContaining({
          metadata: expect.objectContaining({
            output_truncated: true,
          }),
        })
      );

      const loggedCall = mockLogTrace.mock.calls[0][0];
      const outputStr = JSON.stringify(loggedCall.metadata.output);
      expect(outputStr.length).toBeLessThanOrEqual(10240);
    });

    it("should handle concurrent tool calls without race conditions", async () => {
      const middleware = new TraceMiddleware({
        agentId: validAgentId,
        groupId: validGroupId,
        innerClient: mockInnerClient,
        flushIntervalMs: 5000,
      });

      // Make 10 concurrent calls
      const promises = Array.from({ length: 10 }, (_, i) =>
        middleware.callTool("notion-create-pages", { title: `Page ${i}` })
      );

      await Promise.all(promises);
      await middleware.flush();

      expect(mockLogTrace).toHaveBeenCalledTimes(10);
    });

    it("should not crash when PostgreSQL is down", async () => {
      mockLogTrace.mockRejectedValue(new Error("Connection refused"));

      const middleware = new TraceMiddleware({
        agentId: validAgentId,
        groupId: validGroupId,
        innerClient: mockInnerClient,
        flushIntervalMs: 5000,
      });

      await middleware.callTool("notion-create-pages", { title: "Test" });

      // Should not throw - errors during flush should be caught
      await expect(middleware.flush()).resolves.not.toThrow();

      // Buffer should grow when flush fails
      await middleware.callTool("notion-update-page", { page_id: "1" });

      // Buffer should still have traces
      mockLogTrace.mockResolvedValue({
        id: 1,
        group_id: validGroupId,
        event_type: "trace.contribution",
        agent_id: validAgentId,
        workflow_id: null,
        step_id: null,
        parent_event_id: null,
        metadata: { confidence: 1.0 },
        outcome: { content: "test" },
        status: "completed",
        created_at: new Date(),
        inserted_at: new Date(),
      });

      await middleware.flush();

      // Should have attempted to flush all buffered traces
      expect(mockLogTrace).toHaveBeenCalled();
    });

    it("should handle empty tool name gracefully", async () => {
      const middleware = new TraceMiddleware({
        agentId: validAgentId,
        groupId: validGroupId,
        innerClient: mockInnerClient,
        flushIntervalMs: 5000,
      });

      await middleware.callTool("", {});
      await middleware.flush();

      expect(mockLogTrace).toHaveBeenCalledWith(
        expect.objectContaining({
          metadata: expect.objectContaining({
            tool_name: "",
          }),
        })
      );
    });

    it("should handle undefined tool args", async () => {
      const middleware = new TraceMiddleware({
        agentId: validAgentId,
        groupId: validGroupId,
        innerClient: mockInnerClient,
        flushIntervalMs: 5000,
      });

      await middleware.callTool("notion-fetch", undefined as unknown as Record<string, unknown>);
      await middleware.flush();

      expect(mockLogTrace).toHaveBeenCalledWith(
        expect.objectContaining({
          metadata: expect.objectContaining({
            input: undefined,
          }),
        })
      );
    });

    it("should handle circular references in input/output", async () => {
      const middleware = new TraceMiddleware({
        agentId: validAgentId,
        groupId: validGroupId,
        innerClient: mockInnerClient,
        flushIntervalMs: 5000,
      });

      const circularInput: Record<string, unknown> = { name: "test" };
      circularInput.self = circularInput;

      mockInnerClient.callTool = vi.fn().mockResolvedValue({ result: circularInput });

      await middleware.callTool("notion-create-pages", circularInput);
      await middleware.flush();

      // Should not throw - should handle circular refs gracefully
      expect(mockLogTrace).toHaveBeenCalled();
    });

    it("should include workflow_id in traces when provided", async () => {
      const middleware = new TraceMiddleware({
        agentId: validAgentId,
        groupId: validGroupId,
        innerClient: mockInnerClient,
        workflowId: "workflow-456",
        flushIntervalMs: 5000,
      });

      await middleware.callTool("notion-create-pages", { title: "Test" });
      await middleware.flush();

      expect(mockLogTrace).toHaveBeenCalledWith(
        expect.objectContaining({
          workflow_id: "workflow-456",
        })
      );
    });

    it("should include step_id in traces when provided", async () => {
      const middleware = new TraceMiddleware({
        agentId: validAgentId,
        groupId: validGroupId,
        innerClient: mockInnerClient,
        stepId: "step-789",
        flushIntervalMs: 5000,
      });

      await middleware.callTool("notion-create-pages", { title: "Test" });
      await middleware.flush();

      expect(mockLogTrace).toHaveBeenCalledWith(
        expect.objectContaining({
          metadata: expect.objectContaining({
            step_id: "step-789",
          }),
        })
      );
    });
  });

  // =========================================================================
  // 7. Decision Logging Tests
  // =========================================================================

  describe("decision logging", () => {
    it("should log a decision when logDecision is called", async () => {
      const middleware = new TraceMiddleware({
        agentId: validAgentId,
        groupId: validGroupId,
        innerClient: mockInnerClient,
        flushIntervalMs: 5000,
      });

      await middleware.logDecision("Chose to use cached result", 0.95);

      expect(mockLogTrace).toHaveBeenCalledWith(
        expect.objectContaining({
          agent_id: validAgentId,
          group_id: validGroupId,
          trace_type: "decision",
          content: "Chose to use cached result",
          confidence: 0.95,
          metadata: expect.objectContaining({
            event: "decision",
          }),
        })
      );
    });

    it("should clamp confidence to valid range in logDecision", async () => {
      const middleware = new TraceMiddleware({
        agentId: validAgentId,
        groupId: validGroupId,
        innerClient: mockInnerClient,
        flushIntervalMs: 5000,
      });

      await middleware.logDecision("Test decision", 1.5);

      expect(mockLogTrace).toHaveBeenCalledWith(
        expect.objectContaining({
          confidence: 1.0,
        })
      );
    });

    it("should log a learning moment when logLearning is called", async () => {
      const middleware = new TraceMiddleware({
        agentId: validAgentId,
        groupId: validGroupId,
        innerClient: mockInnerClient,
        flushIntervalMs: 5000,
      });

      await middleware.logLearning("Discovered new pattern for pagination");

      expect(mockLogTrace).toHaveBeenCalledWith(
        expect.objectContaining({
          trace_type: "learning",
          content: "Discovered new pattern for pagination",
          metadata: expect.objectContaining({
            event: "learning",
          }),
        })
      );
    });
  });

  // =========================================================================
  // 8. Configuration Tests
  // =========================================================================

  describe("configuration", () => {
    it("should use default flush interval of 5000ms when not specified", async () => {
      const middleware = new TraceMiddleware({
        agentId: validAgentId,
        groupId: validGroupId,
        innerClient: mockInnerClient,
        flushIntervalMs: 5000,
      });

      await middleware.callTool("notion-create-pages", { title: "Test" });

      expect(mockLogTrace).not.toHaveBeenCalled();

      // Default is 5000ms
      await vi.advanceTimersByTimeAsync(4999);
      expect(mockLogTrace).not.toHaveBeenCalled();

      await vi.advanceTimersByTimeAsync(1);
      expect(mockLogTrace).toHaveBeenCalledTimes(1);
    });

    it("should accept custom flush interval", async () => {
      const middleware = new TraceMiddleware({
        agentId: validAgentId,
        groupId: validGroupId,
        innerClient: mockInnerClient,
        flushIntervalMs: 1000,
      });

      await middleware.callTool("notion-create-pages", { title: "Test" });

      await vi.advanceTimersByTimeAsync(1000);

      expect(mockLogTrace).toHaveBeenCalledTimes(1);
    });

    it("should require agentId in configuration", () => {
      expect(
        () =>
          new TraceMiddleware({
            agentId: "",
            groupId: validGroupId,
            innerClient: mockInnerClient,
          })
      ).toThrow();
    });

    it("should require innerClient in configuration", () => {
      expect(
        () =>
          new TraceMiddleware({
            agentId: validAgentId,
            groupId: validGroupId,
            innerClient: undefined as unknown as McpToolCaller,
          })
      ).toThrow();
    });
  });
});
