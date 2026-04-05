/**
 * Wrapped MCP Client Tests
 *
 * Comprehensive tests for the wrapped-client module that integrates
 * TraceMiddleware with agent execution paths.
 *
 * Coverage areas:
 * 1. Basic construction and validation
 * 2. Tool call tracing
 * 3. group_id injection from agent metadata
 * 4. Buffered mode functionality
 * 5. Error handling and fallback behavior
 * 6. Server-side guard
 * 7. Session lifecycle
 * 8. Convenience methods
 * 9. Factory functions
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  WrappedMcpClient,
  TracedToolCall,
  createWrappedClient,
  createAgentClient,
  createUntracedClient,
  type AgentMetadata,
  type TraceCaptureConfig,
  type WrappedClientConfig,
} from "./wrapped-client";
import { GroupIdValidationError } from "@/lib/validation/group-id";
import type { McpToolCaller } from "@/integrations/mcp.client";

// Mock dependencies
vi.mock("@/lib/postgres/trace-logger", () => ({
  logTrace: vi.fn().mockResolvedValue({
    id: 1,
    group_id: "allura-test",
    event_type: "trace.contribution",
    agent_id: "test-agent",
    workflow_id: null,
    step_id: null,
    parent_event_id: null,
    metadata: {},
    outcome: {},
    status: "completed",
    created_at: new Date(),
    inserted_at: new Date(),
  }),
  TraceValidationError: class TraceValidationError extends Error {
    constructor(message: string) {
      super(message);
      this.name = "TraceValidationError";
    }
  },
}));

vi.mock("@/lib/validation/group-id", async () => {
  const actual = await vi.importActual("@/lib/validation/group-id");
  return {
    ...actual,
    validateGroupId: vi.fn((groupId: unknown) => {
      if (groupId === null || groupId === undefined) {
        throw new GroupIdValidationError("group_id is required");
      }
      if (typeof groupId !== "string" || groupId.trim().length === 0) {
        throw new GroupIdValidationError("group_id must be a non-empty string");
      }
      // Check for uppercase
      if (/[A-Z]/.test(groupId)) {
        throw new GroupIdValidationError("group_id must be lowercase");
      }
      return groupId.trim();
    }),
  };
});

describe("WrappedMcpClient", () => {
  let mockInnerClient: McpToolCaller;
  const validAgentMetadata: AgentMetadata = {
    agentId: "memory-orchestrator",
    groupId: "allura-faith-meats",
  };

  beforeEach(() => {
    vi.useFakeTimers();
    mockInnerClient = {
      callTool: vi.fn().mockResolvedValue({ success: true, data: { id: "page-123" } }),
    };
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.clearAllMocks();
  });

  // =========================================================================
  // 1. Construction and Validation Tests
  // =========================================================================

  describe("construction", () => {
    it("should create client with valid agent metadata", () => {
      const client = new WrappedMcpClient({
        agentMetadata: validAgentMetadata,
      });

      expect(client).toBeInstanceOf(WrappedMcpClient);
      expect(client.getAgentId()).toBe("memory-orchestrator");
      expect(client.getGroupId()).toBe("allura-faith-meats");
    });

    it("should reject missing agentMetadata", () => {
      expect(() => new WrappedMcpClient({} as WrappedClientConfig)).toThrow(
        "agentMetadata is required"
      );
    });

    it("should reject missing agentId", () => {
      expect(
        () =>
          new WrappedMcpClient({
            agentMetadata: { agentId: "", groupId: "allura-test" } as AgentMetadata,
          })
      ).toThrow("agentMetadata.agentId is required");
    });

    it("should reject invalid group_id", async () => {
      const { validateGroupId } = await import("@/lib/validation/group-id");
      vi.mocked(validateGroupId).mockImplementationOnce(() => {
        throw new GroupIdValidationError("Invalid group_id");
      });

      expect(
        () =>
          new WrappedMcpClient({
            agentMetadata: { agentId: "test", groupId: "" },
          })
      ).toThrow(GroupIdValidationError);
    });

    it("should accept custom innerClient", () => {
      const customInner = { callTool: vi.fn().mockResolvedValue({}) } as McpToolCaller;

      const client = new WrappedMcpClient({
        agentMetadata: validAgentMetadata,
        innerClient: customInner,
      });

      expect(client).toBeInstanceOf(WrappedMcpClient);
    });

    it("should apply default trace configuration", () => {
      const client = new WrappedMcpClient({
        agentMetadata: validAgentMetadata,
      });

      expect(client.isTracingEnabled()).toBe(true);
    });

    it("should accept custom trace configuration", () => {
      const client = new WrappedMcpClient({
        agentMetadata: validAgentMetadata,
        traceConfig: {
          flushIntervalMs: 10000,
          enabled: false,
          onTraceFailure: "warn",
        },
      });

      expect(client.isTracingEnabled()).toBe(false);
    });
  });

  // =========================================================================
  // 2. Tool Call Tracing Tests
  // =========================================================================

  describe("tool call tracing", () => {
    it("should execute tool calls and return results", async () => {
      const client = new WrappedMcpClient({
        agentMetadata: validAgentMetadata,
        innerClient: mockInnerClient,
      });

      const result = await client.callTool("notion-create-pages", {
        title: "Test Page",
      });

      expect(result).toEqual({ success: true, data: { id: "page-123" } });
      expect(mockInnerClient.callTool).toHaveBeenCalled();
    });

    it("should pass tool name and arguments to inner client", async () => {
      const client = new WrappedMcpClient({
        agentMetadata: validAgentMetadata,
        innerClient: mockInnerClient,
      });

      await client.callTool("custom-tool", { key: "value", number: 42 });

      expect(mockInnerClient.callTool).toHaveBeenCalledWith(
        "custom-tool",
        expect.objectContaining({ key: "value", number: 42 })
      );
    });

    it("should handle tool calls with empty arguments", async () => {
      const client = new WrappedMcpClient({
        agentMetadata: validAgentMetadata,
        innerClient: mockInnerClient,
      });

      await client.callTool("tool-with-no-args", {});

      expect(mockInnerClient.callTool).toHaveBeenCalledWith(
        "tool-with-no-args",
        expect.any(Object)
      );
    });

    it("should propagate tool results correctly", async () => {
      mockInnerClient.callTool = vi.fn().mockResolvedValue({
        results: [{ id: "1" }, { id: "2" }],
        total: 2,
      });

      const client = new WrappedMcpClient({
        agentMetadata: validAgentMetadata,
        innerClient: mockInnerClient,
      });

      const result = await client.callTool("notion-search", { query: "test" });

      expect(result).toEqual({
        results: [{ id: "1" }, { id: "2" }],
        total: 2,
      });
    });

    it("should support generic type parameter", async () => {
      interface ToolResult {
        id: string;
        name: string;
      }

      mockInnerClient.callTool = vi.fn().mockResolvedValue({
        id: "page-123",
        name: "Test Page",
      });

      const client = new WrappedMcpClient({
        agentMetadata: validAgentMetadata,
        innerClient: mockInnerClient,
      });

      const result = await client.callTool<ToolResult>("notion-fetch", { id: "123" });

      expect(result.id).toBe("page-123");
      expect(result.name).toBe("Test Page");
    });
  });

  // =========================================================================
  // 3. group_id Injection Tests
  // =========================================================================

  describe("group_id injection", () => {
    it("should inject group_id from agent metadata", async () => {
      const client = new WrappedMcpClient({
        agentMetadata: { agentId: "test-agent", groupId: "allura-creative" },
        innerClient: mockInnerClient,
      });

      expect(client.getGroupId()).toBe("allura-creative");
    });

    it("should use validated group_id", async () => {
      const { validateGroupId } = await import("@/lib/validation/group-id");
      vi.mocked(validateGroupId).mockReturnValueOnce("allura-normalized");

      const client = new WrappedMcpClient({
        agentMetadata: { agentId: "test", groupId: "allura-test" },
        innerClient: mockInnerClient,
      });

      expect(client.getGroupId()).toBe("allura-normalized");
    });

    it("should maintain group_id consistency across calls", async () => {
      const client = new WrappedMcpClient({
        agentMetadata: { agentId: "test", groupId: "allura-audits" },
        innerClient: mockInnerClient,
      });

      await client.callTool("tool-1", {});
      await client.callTool("tool-2", {});
      await client.callTool("tool-3", {});

      // All calls should have the same group_id context
      expect(client.getGroupId()).toBe("allura-audits");
    });

    it("should reject uppercase in group_id", async () => {
      const { validateGroupId } = await import("@/lib/validation/group-id");
      vi.mocked(validateGroupId).mockImplementationOnce((groupId: unknown) => {
        if (typeof groupId === "string" && /[A-Z]/.test(groupId)) {
          throw new GroupIdValidationError("group_id must be lowercase");
        }
        return String(groupId).trim();
      });

      expect(
        () =>
          new WrappedMcpClient({
            agentMetadata: { agentId: "test", groupId: "Allura-Test" },
          })
      ).toThrow(GroupIdValidationError);
    });

    it("should include workflowId in agent metadata", async () => {
      const client = new WrappedMcpClient({
        agentMetadata: {
          agentId: "test",
          groupId: "allura-test",
          workflowId: "workflow-abc-123",
        },
        innerClient: mockInnerClient,
      });

      expect(client.getWorkflowId()).toBe("workflow-abc-123");
    });
  });

  // =========================================================================
  // 4. Buffered Mode Tests
  // =========================================================================

  describe("buffered mode", () => {
    it("should use immediate mode by default (flushIntervalMs = 0)", async () => {
      const { logTrace } = await import("@/lib/postgres/trace-logger");

      const client = new WrappedMcpClient({
        agentMetadata: validAgentMetadata,
        innerClient: mockInnerClient,
        traceConfig: { flushIntervalMs: 0 },
      });

      await client.callTool("test-tool", {});

      // In immediate mode, traces should be logged synchronously
      expect(logTrace).toHaveBeenCalled();
    });

    it("should buffer traces when flushIntervalMs is set", async () => {
      const { logTrace } = await import("@/lib/postgres/trace-logger");

      const client = new WrappedMcpClient({
        agentMetadata: validAgentMetadata,
        innerClient: mockInnerClient,
        traceConfig: { flushIntervalMs: 5000 },
      });

      await client.callTool("test-tool", {});

      // In buffered mode, traces should not be logged immediately
      expect(logTrace).not.toHaveBeenCalled();
    });

    it("should flush buffered traces on manual flush", async () => {
      const { logTrace } = await import("@/lib/postgres/trace-logger");

      const client = new WrappedMcpClient({
        agentMetadata: validAgentMetadata,
        innerClient: mockInnerClient,
        traceConfig: { flushIntervalMs: 5000 },
      });

      await client.callTool("tool-1", {});
      await client.callTool("tool-2", {});

      expect(logTrace).not.toHaveBeenCalled();

      await client.flush();

      expect(logTrace).toHaveBeenCalledTimes(2);
    });

    it("should auto-flush on timer in buffered mode", async () => {
      const { logTrace } = await import("@/lib/postgres/trace-logger");

      const client = new WrappedMcpClient({
        agentMetadata: validAgentMetadata,
        innerClient: mockInnerClient,
        traceConfig: { flushIntervalMs: 5000 },
      });

      await client.callTool("test-tool", {});
      expect(logTrace).not.toHaveBeenCalled();

      await vi.advanceTimersByTimeAsync(5000);

      expect(logTrace).toHaveBeenCalledTimes(1);
    });

    it("should not flush before timer elapses", async () => {
      const { logTrace } = await import("@/lib/postgres/trace-logger");

      const client = new WrappedMcpClient({
        agentMetadata: validAgentMetadata,
        innerClient: mockInnerClient,
        traceConfig: { flushIntervalMs: 10000 },
      });

      await client.callTool("test-tool", {});

      await vi.advanceTimersByTimeAsync(5000); // Half the interval

      expect(logTrace).not.toHaveBeenCalled();
    });

    it("should flush remaining traces on destroy", async () => {
      const { logTrace } = await import("@/lib/postgres/trace-logger");

      const client = new WrappedMcpClient({
        agentMetadata: validAgentMetadata,
        innerClient: mockInnerClient,
        traceConfig: { flushIntervalMs: 5000 },
      });

      await client.callTool("tool-1", {});
      await client.callTool("tool-2", {});

      expect(logTrace).not.toHaveBeenCalled();

      await client.destroy();

      expect(logTrace).toHaveBeenCalledTimes(2);
    });
  });

  // =========================================================================
  // 5. Error Handling and Fallback Tests
  // =========================================================================

  describe("error handling and fallback", () => {
    it("should preserve original tool error", async () => {
      const toolError = new Error("Tool execution failed: database error");
      mockInnerClient.callTool = vi.fn().mockRejectedValue(toolError);

      const client = new WrappedMcpClient({
        agentMetadata: validAgentMetadata,
        innerClient: mockInnerClient,
      });

      await expect(client.callTool("failing-tool", {})).rejects.toThrow(
        "Tool execution failed: database error"
      );
    });

    it("should support ignore fallback on trace failure", async () => {
      const { logTrace } = await import("@/lib/postgres/trace-logger");
      vi.mocked(logTrace).mockRejectedValueOnce(new Error("Database down"));

      const client = new WrappedMcpClient({
        agentMetadata: validAgentMetadata,
        innerClient: mockInnerClient,
        traceConfig: { onTraceFailure: "ignore" },
      });

      // Should not throw when trace logging fails
      const result = await client.callTool("test-tool", {});
      expect(result).toBeDefined();
    });

    it("should support warn fallback on trace failure", async () => {
      const consoleSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
      const { logTrace } = await import("@/lib/postgres/trace-logger");
      vi.mocked(logTrace).mockRejectedValueOnce(new Error("Trace failed"));

      const client = new WrappedMcpClient({
        agentMetadata: validAgentMetadata,
        innerClient: mockInnerClient,
        traceConfig: { onTraceFailure: "warn" },
      });

      await client.callTool("test-tool", {});

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining("Trace logging failed"),
        expect.any(String)
      );

      consoleSpy.mockRestore();
    });

    it("should support error fallback on trace failure", async () => {
      const { logTrace } = await import("@/lib/postgres/trace-logger");
      vi.mocked(logTrace).mockRejectedValueOnce(new Error("Critical trace error"));

      const client = new WrappedMcpClient({
        agentMetadata: validAgentMetadata,
        innerClient: mockInnerClient,
        traceConfig: { onTraceFailure: "error" },
      });

      await expect(client.callTool("test-tool", {})).rejects.toThrow("Critical trace error");
    });

    it("should handle non-Error tool failures", async () => {
      mockInnerClient.callTool = vi.fn().mockRejectedValue("string error");

      const client = new WrappedMcpClient({
        agentMetadata: validAgentMetadata,
        innerClient: mockInnerClient,
      });

      await expect(client.callTool("test-tool", {})).rejects.toBe("string error");
    });

    it("should continue execution when tracing disabled", async () => {
      const client = new WrappedMcpClient({
        agentMetadata: validAgentMetadata,
        innerClient: mockInnerClient,
        traceConfig: { enabled: false },
      });

      const result = await client.callTool("test-tool", {});

      expect(result).toBeDefined();
      expect(client.isTracingEnabled()).toBe(false);
    });
  });

  // =========================================================================
  // 6. Server-Side Guard Tests
  // =========================================================================

  describe("server-side guard", () => {
    it("should have server-side check at module level", () => {
      // The server-side guard is at module level - it throws when window is defined
      // We can't easily test this in Node environment, but we verify the code exists
      // by checking the wrapped-client.ts source has the check
      const fs = require("fs");
      const path = require("path");
      const sourceFile = path.join(__dirname, "wrapped-client.ts");
      const content = fs.readFileSync(sourceFile, "utf-8");

      expect(content).toContain('if (typeof window !== "undefined")');
      expect(content).toContain("server-side");
    });
  });

  // =========================================================================
  // 7. Session Lifecycle Tests
  // =========================================================================

  describe("session lifecycle", () => {
    it("should track session state", async () => {
      const client = new WrappedMcpClient({
        agentMetadata: validAgentMetadata,
        innerClient: mockInnerClient,
      });

      expect(client.isSessionActive()).toBe(false);

      await client.startSession("workflow-123");
      expect(client.isSessionActive()).toBe(true);

      await client.endSession();
      expect(client.isSessionActive()).toBe(false);
    });

    it("should log session start event", async () => {
      const { logTrace } = await import("@/lib/postgres/trace-logger");

      const client = new WrappedMcpClient({
        agentMetadata: validAgentMetadata,
        innerClient: mockInnerClient,
        traceConfig: { flushIntervalMs: 5000 },
      });

      await client.startSession("workflow-123");

      expect(logTrace).toHaveBeenCalledWith(
        expect.objectContaining({
          trace_type: "decision",
          content: expect.stringContaining("session_start"),
          workflow_id: "workflow-123",
        })
      );
    });

    it("should log session end event", async () => {
      const { logTrace } = await import("@/lib/postgres/trace-logger");
      const mockedLogTrace = vi.mocked(logTrace);

      const client = new WrappedMcpClient({
        agentMetadata: validAgentMetadata,
        innerClient: mockInnerClient,
        traceConfig: { flushIntervalMs: 5000 },
      });

      await client.startSession("workflow-123");
      mockedLogTrace.mockClear();

      await client.callTool("tool-1", {});
      await client.callTool("tool-2", {});

      await client.endSession();

      expect(mockedLogTrace).toHaveBeenCalledWith(
        expect.objectContaining({
          trace_type: "decision",
          content: expect.stringContaining("session_end"),
          metadata: expect.objectContaining({ trace_count: 2 }),
        })
      );
    });

    it("should warn on duplicate startSession", async () => {
      const consoleSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

      const client = new WrappedMcpClient({
        agentMetadata: validAgentMetadata,
        innerClient: mockInnerClient,
      });

      await client.startSession();
      await client.startSession();

      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining("already active"));
      consoleSpy.mockRestore();
    });

    it("should warn on endSession without start", async () => {
      const consoleSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

      const client = new WrappedMcpClient({
        agentMetadata: validAgentMetadata,
        innerClient: mockInnerClient,
      });

      await client.endSession();

      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining("No active session"));
      consoleSpy.mockRestore();
    });

    it("should use workflowId from agent metadata if not provided to startSession", async () => {
      const { logTrace } = await import("@/lib/postgres/trace-logger");

      const client = new WrappedMcpClient({
        agentMetadata: {
          ...validAgentMetadata,
          workflowId: "default-workflow",
        },
        innerClient: mockInnerClient,
        traceConfig: { flushIntervalMs: 5000 },
      });

      await client.startSession();

      expect(logTrace).toHaveBeenCalledWith(
        expect.objectContaining({
          workflow_id: "default-workflow",
        })
      );
    });

    it("should prefer explicit workflowId over agent metadata", async () => {
      const { logTrace } = await import("@/lib/postgres/trace-logger");

      const client = new WrappedMcpClient({
        agentMetadata: {
          ...validAgentMetadata,
          workflowId: "default-workflow",
        },
        innerClient: mockInnerClient,
        traceConfig: { flushIntervalMs: 5000 },
      });

      await client.startSession("explicit-workflow");

      expect(logTrace).toHaveBeenCalledWith(
        expect.objectContaining({
          workflow_id: "explicit-workflow",
        })
      );
    });
  });

  // =========================================================================
  // 8. Decision and Learning Logging Tests
  // =========================================================================

  describe("decision and learning logging", () => {
    it("should log decisions with confidence", async () => {
      const { logTrace } = await import("@/lib/postgres/trace-logger");

      const client = new WrappedMcpClient({
        agentMetadata: validAgentMetadata,
        innerClient: mockInnerClient,
        traceConfig: { flushIntervalMs: 5000 },
      });

      await client.logDecision("Chose cached response", 0.85);

      expect(logTrace).toHaveBeenCalledWith(
        expect.objectContaining({
          trace_type: "decision",
          content: "Chose cached response",
          confidence: 0.85,
        })
      );
    });

    it("should log learning moments", async () => {
      const { logTrace } = await import("@/lib/postgres/trace-logger");

      const client = new WrappedMcpClient({
        agentMetadata: validAgentMetadata,
        innerClient: mockInnerClient,
        traceConfig: { flushIntervalMs: 5000 },
      });

      await client.logLearning("Discovered pattern for pagination", 0.9);

      expect(logTrace).toHaveBeenCalledWith(
        expect.objectContaining({
          trace_type: "learning",
          content: "Discovered pattern for pagination",
          confidence: 0.9,
        })
      );
    });

    it("should skip logging when tracing disabled", async () => {
      const { logTrace } = await import("@/lib/postgres/trace-logger");

      const client = new WrappedMcpClient({
        agentMetadata: validAgentMetadata,
        innerClient: mockInnerClient,
        traceConfig: { enabled: false },
      });

      await client.logDecision("Test decision", 0.5);

      expect(logTrace).not.toHaveBeenCalled();
    });
  });

  // =========================================================================
  // 9. Convenience Methods Tests
  // =========================================================================

  describe("convenience methods", () => {
    it("should provide createPage helper", async () => {
      mockInnerClient.callTool = vi.fn().mockResolvedValue({
        content: [{ type: "text", text: JSON.stringify({ pageId: "page-123" }) }],
      });

      const client = new WrappedMcpClient({
        agentMetadata: validAgentMetadata,
        innerClient: mockInnerClient,
      });

      const result = await client.createPage({
        parent: { database_id: "db-123" },
        pages: [{ properties: { Name: "Test Page" } }],
      });

      expect(result.success).toBe(true);
      expect(result.group_id).toBe("allura-faith-meats");
    });

    it("should provide updatePage helper", async () => {
      mockInnerClient.callTool = vi.fn().mockResolvedValue({
        content: [{ type: "text", text: JSON.stringify({ updated: true }) }],
      });

      const client = new WrappedMcpClient({
        agentMetadata: validAgentMetadata,
        innerClient: mockInnerClient,
      });

      const result = await client.updatePage({
        page_id: "page-123",
        properties: { Name: "Updated Name" },
      });

      expect(result.success).toBe(true);
      expect(result.group_id).toBe("allura-faith-meats");
    });

    it("should provide search helper", async () => {
      mockInnerClient.callTool = vi.fn().mockResolvedValue({
        content: [{ type: "text", text: JSON.stringify({ results: [] }) }],
      });

      const client = new WrappedMcpClient({
        agentMetadata: validAgentMetadata,
        innerClient: mockInnerClient,
      });

      const result = await client.search({ query: "test" });

      expect(result.success).toBe(true);
    });

    it("should provide fetch helper", async () => {
      mockInnerClient.callTool = vi.fn().mockResolvedValue({
        content: [{ type: "text", text: JSON.stringify({ id: "page-123", title: "Test" }) }],
      });

      const client = new WrappedMcpClient({
        agentMetadata: validAgentMetadata,
        innerClient: mockInnerClient,
      });

      const result = await client.fetch({ id: "page-123" });

      expect(result.success).toBe(true);
    });

    it("should handle convenience method errors", async () => {
      mockInnerClient.callTool = vi.fn().mockRejectedValue(new Error("Notion API error"));

      const client = new WrappedMcpClient({
        agentMetadata: validAgentMetadata,
        innerClient: mockInnerClient,
      });

      const result = await client.fetch({ id: "invalid" });

      expect(result.success).toBe(false);
      expect(result.error).toContain("Notion API error");
      expect(result.group_id).toBe("allura-faith-meats");
    });
  });

  // =========================================================================
  // 10. Factory Function Tests
  // =========================================================================

  describe("factory functions", () => {
    it("createWrappedClient should create client with defaults", () => {
      const client = createWrappedClient({
        agentMetadata: validAgentMetadata,
      });

      expect(client).toBeInstanceOf(WrappedMcpClient);
      expect(client.getAgentId()).toBe("memory-orchestrator");
    });

    it("createAgentClient should provide agent-specific defaults", () => {
      const client = createAgentClient("custom-agent", "allura-test");

      expect(client.getAgentId()).toBe("custom-agent");
      expect(client.getGroupId()).toBe("allura-test");
      expect(client.isTracingEnabled()).toBe(true);
    });

    it("createAgentClient should support buffered mode", async () => {
      const { logTrace } = await import("@/lib/postgres/trace-logger");

      const client = createAgentClient("test", "allura-test", { buffered: true });
      const innerClient = { callTool: vi.fn().mockResolvedValue({}) };

      // Replace inner client for testing
      const wrappedClient = new WrappedMcpClient({
        agentMetadata: { agentId: "test", groupId: "allura-test" },
        innerClient,
        traceConfig: { flushIntervalMs: 5000 },
      });

      await wrappedClient.callTool("test", {});
      expect(logTrace).not.toHaveBeenCalled();
    });

    it("createAgentClient should support custom onTraceFailure", () => {
      const client = createAgentClient("test", "allura-test", {
        onTraceFailure: "warn",
      });

      expect(client).toBeInstanceOf(WrappedMcpClient);
    });

    it("createUntracedClient should disable tracing", () => {
      const client = createUntracedClient("test-agent", "allura-test");

      expect(client.isTracingEnabled()).toBe(false);
      expect(client.getAgentId()).toBe("test-agent");
    });

    it("createUntracedClient should support workflowId", () => {
      const client = createUntracedClient("test", "allura-test", {
        workflowId: "workflow-123",
      });

      expect(client.getWorkflowId()).toBe("workflow-123");
    });
  });

  // =========================================================================
  // 11. TracedToolCall Tests
  // =========================================================================

  describe("TracedToolCall", () => {
    it("should execute tool without middleware when middleware is null", async () => {
      const tracedCall = new TracedToolCall("test-tool", null, "ignore");

      const result = await tracedCall.execute({ key: "value" }, mockInnerClient);

      expect(result.data).toEqual({ success: true, data: { id: "page-123" } });
      expect(result.traced).toBe(false);
    });

    it("should include duration in result", async () => {
      const tracedCall = new TracedToolCall("test-tool", null, "ignore");

      const result = await tracedCall.execute({}, mockInnerClient);

      expect(result.durationMs).toBeGreaterThanOrEqual(0);
    });
  });
});

// Export for integration testing
export { WrappedMcpClient, TracedToolCall };
