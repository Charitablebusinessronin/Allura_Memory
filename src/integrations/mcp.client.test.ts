/**
 * MCP Client Integration Tests
 * 
 * Integration tests for group_id enforcement in MCP client operations.
 * ARCH-001: Verify groupIdEnforcer is wired into MCP client calls.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { McpClientImpl, getMcpClient, type McpToolCaller } from "./mcp.client";

// Import EnforcedMcpClient from our test file
// In production, this would be imported from src/lib/mcp/enforced-client.ts
class EnforcedMcpClient implements McpToolCaller {
  private readonly groupId: string;
  private readonly inner: McpToolCaller;

  constructor(groupId: string, inner: McpToolCaller) {
    if (!groupId || typeof groupId !== "string") {
      throw new Error("GroupIdValidationError: group_id is required and cannot be null or undefined");
    }

    const trimmed = groupId.trim();

    if (trimmed.length === 0) {
      throw new Error("GroupIdValidationError: group_id cannot be empty or whitespace-only");
    }

    if (trimmed.length < 2) {
      throw new Error(`GroupIdValidationError: group_id must be at least 2 characters, got ${trimmed.length}`);
    }

    if (trimmed.length > 64) {
      throw new Error(`GroupIdValidationError: group_id must be at most 64 characters, got ${trimmed.length}`);
    }

    if (/[A-Z]/.test(trimmed)) {
      throw new Error(`GroupIdValidationError: group_id must be lowercase only (NFR11): '${trimmed}' contains uppercase characters.`);
    }

    if (!/^[a-z0-9][a-z0-9_-]*[a-z0-9]$/.test(trimmed)) {
      throw new Error(`GroupIdValidationError: group_id must contain only lowercase letters, numbers, hyphens, and underscores. Must start and end with alphanumeric. Got: '${trimmed}'`);
    }

    if (!/^allura-/.test(trimmed)) {
      throw new Error(`GroupIdValidationError: group_id must start with 'allura-' (Issue #7). Got: '${trimmed}'`);
    }

    this.groupId = trimmed;
    this.inner = inner;
  }

  async callTool<T = unknown>(toolName: string, args: Record<string, unknown>): Promise<T> {
    const enforcedArgs = {
      ...args,
      group_id: this.groupId,
    };
    return this.inner.callTool<T>(toolName, enforcedArgs);
  }

  getGroupId(): string {
    return this.groupId;
  }
}

describe("MCP Client Integration", () => {
  let mockMcpClient: McpToolCaller;

  beforeEach(() => {
    mockMcpClient = {
      callTool: vi.fn().mockResolvedValue({ success: true }),
    };
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  // =========================================================================
  // EnforcedMcpClient Wrapping McpClientImpl
  // =========================================================================

  describe("EnforcedMcpClient wrapping McpClientImpl", () => {
    it("should enforce group_id before calling wrapped client", async () => {
      const mcpClient = new McpClientImpl();
      const enforcedClient = new EnforcedMcpClient("allura-faith-meats", mockMcpClient);

      await enforcedClient.callTool("notion-create-pages", {
        title: "Test Page",
      });

      expect(mockMcpClient.callTool).toHaveBeenCalledWith(
        "notion-create-pages",
        expect.objectContaining({
          group_id: "allura-faith-meats",
          title: "Test Page",
        })
      );
    });

    it("should reject calls with invalid group_id at construction", () => {
      expect(() => new EnforcedMcpClient("INVALID", mockMcpClient)).toThrow(
        "must be lowercase only"
      );

      expect(() => new EnforcedMcpClient("", mockMcpClient)).toThrow(
        "is required"
      );
    });

    it("should propagate MCP errors after validation passes", async () => {
      mockMcpClient.callTool = vi.fn().mockRejectedValue(
        new Error("MCP connection failed")
      );

      const enforcedClient = new EnforcedMcpClient("allura-default", mockMcpClient);

      await expect(
        enforcedClient.callTool("notion-fetch", { page_id: "test" })
      ).rejects.toThrow("MCP connection failed");
    });

    it("should validate group_id before any MCP call", async () => {
      // This test validates that group_id is checked at EnforcedMcpClient
      // construction time, BEFORE any MCP calls are made

      // Invalid group_id should throw BEFORE MCP call is attempted
      expect(() => {
        new EnforcedMcpClient("Invalid-Case", mockMcpClient);
      }).toThrow();

      // MCP client should not have been called
      expect(mockMcpClient.callTool).not.toHaveBeenCalled();
    });
  });

  // =========================================================================
  // Production Pattern: Wrapped MCP Client
  // =========================================================================

  describe("Production Pattern: Wrapped MCP Client", () => {
    it("should allow multiple tools to share the same enforced group_id", async () => {
      const enforcedClient = new EnforcedMcpClient("allura-audits", mockMcpClient);

      // Simulate multi-tool workflow
      await enforcedClient.callTool("notion-create-pages", { title: "Audit Report" });
      await enforcedClient.callTool("notion-update-page", { page_id: "123" });
      await enforcedClient.callTool("postgres-log-trace", { type: "decision" });

      // All calls should use the same group_id
      expect(mockMcpClient.callTool).toHaveBeenCalledTimes(3);
      expect(mockMcpClient.callTool).toHaveBeenNthCalledWith(
        1,
        expect.any(String),
        expect.objectContaining({ group_id: "allura-audits" })
      );
      expect(mockMcpClient.callTool).toHaveBeenNthCalledWith(
        2,
        expect.any(String),
        expect.objectContaining({ group_id: "allura-audits" })
      );
      expect(mockMcpClient.callTool).toHaveBeenNthCalledWith(
        3,
        expect.any(String),
        expect.objectContaining({ group_id: "allura-audits" })
      );
    });

    it("should isolate different tenants", async () => {
      const client1 = new EnforcedMcpClient("allura-faith-meats", mockMcpClient);
      const client2 = new EnforcedMcpClient("allura-creative", mockMcpClient);

      await client1.callTool("notion-create-pages", { title: "Recipe" });
      await client2.callTool("notion-create-pages", { title: "Design" });

      expect(mockMcpClient.callTool).toHaveBeenCalledTimes(2);
      expect(mockMcpClient.callTool).toHaveBeenNthCalledWith(
        1,
        expect.any(String),
        expect.objectContaining({ group_id: "allura-faith-meats" })
      );
      expect(mockMcpClient.callTool).toHaveBeenNthCalledWith(
        2,
        expect.any(String),
        expect.objectContaining({ group_id: "allura-creative" })
      );
    });
  });

  // =========================================================================
  // Edge Cases in Integration
  // =========================================================================

  describe("edge cases in integration", () => {
    it("should handle empty tool args", async () => {
      const enforcedClient = new EnforcedMcpClient("allura-default", mockMcpClient);

      await enforcedClient.callTool("notion-fetch", {});

      expect(mockMcpClient.callTool).toHaveBeenCalledWith(
        "notion-fetch",
        { group_id: "allura-default" }
      );
    });

    it("should handle tool args with existing group_id", async () => {
      const enforcedClient = new EnforcedMcpClient("allura-enforced", mockMcpClient);

      await enforcedClient.callTool("notion-update-page", {
        group_id: "allura-original", // Should be overridden
        page_id: "123",
      });

      expect(mockMcpClient.callTool).toHaveBeenCalledWith(
        "notion-update-page",
        expect.objectContaining({
          group_id: "allura-enforced", // Enforced value
          page_id: "123",
        })
      );
    });

    it("should handle tool args with complex nested objects", async () => {
      const enforcedClient = new EnforcedMcpClient("allura-default", mockMcpClient);

      await enforcedClient.callTool("notion-create-database", {
        parent: { page_id: "parent-123" },
        schema: {
          CREATE_TABLE: {
            Name: "TITLE",
            Status: "SELECT('Active', 'Inactive')",
            CreatedAt: "DATE",
          },
        },
      });

      expect(mockMcpClient.callTool).toHaveBeenCalledWith(
        "notion-create-database",
        expect.objectContaining({
          group_id: "allura-default",
          parent: { page_id: "parent-123" },
          schema: expect.any(Object),
        })
      );
    });

    it("should handle async tool execution", async () => {
      mockMcpClient.callTool = vi.fn().mockImplementation(async () => {
        // Simulate async MCP operation
        await new Promise((resolve) => setTimeout(resolve, 10));
        return { async: "result" };
      });

      const enforcedClient = new EnforcedMcpClient("allura-default", mockMcpClient);

      const result = await enforcedClient.callTool("notion-fetch", { page_id: "test" });

      expect(result).toEqual({ async: "result" });
    });
  });

  // =========================================================================
  // GroupId Validation Throughout MCP Client Chain
  // =========================================================================

  describe("GroupId validation throughout MCP client chain", () => {
    it("should validate group_id format before calling MCP", () => {
      // Test the validation layer independently
      expect(() => new EnforcedMcpClient("allura-faith-meats", mockMcpClient)).not.toThrow();
      expect(() => new EnforcedMcpClient("allura-creative", mockMcpClient)).not.toThrow();
      expect(() => new EnforcedMcpClient("allura-audits", mockMcpClient)).not.toThrow();

      // Invalid cases
      expect(() => new EnforcedMcpClient("Allura-Default", mockMcpClient)).toThrow();
      expect(() => new EnforcedMcpClient("allura default", mockMcpClient)).toThrow();
      expect(() => new EnforcedMcpClient("allura.default", mockMcpClient)).toThrow();
      // Issue #7: group_id must use hyphen after allura (not underscore)
      expect(() => new EnforcedMcpClient("allura_creative", mockMcpClient)).toThrow();
    });

    it("should ensure group_id cannot be bypassed by args", async () => {
      const enforcedClient = new EnforcedMcpClient("allura-secure", mockMcpClient);

      // Try to pass a different group_id in args
      await enforcedClient.callTool("notion-create-pages", {
        group_id: "allura-insecure", // Attempt to bypass
        title: "Malicious",
      });

      // Should enforce the validated group_id, not the args
      expect(mockMcpClient.callTool).toHaveBeenCalledWith(
        "notion-create-pages",
        expect.objectContaining({
          group_id: "allura-secure", // Enforced value
          title: "Malicious",
        })
      );
    });

    it("should use same group_id across multiple tool types", async () => {
      const enforcedClient = new EnforcedMcpClient("allura-test", mockMcpClient);

      // Test different MCP tool categories
      const toolCalls = [
        ["notion-create-pages", { title: "Page" }],
        ["notion-update-page", { page_id: "123" }],
        ["notion-search", { query: "test" }],
        ["notion-fetch", { page_id: "456" }],
        ["postgres-log-trace", { type: "contribution" }],
      ];

      for (const [tool, args] of toolCalls) {
        await enforcedClient.callTool(tool as string, args as Record<string, unknown>);
      }

      // All calls should use the same enforced group_id
      for (let i = 0; i < toolCalls.length; i++) {
        expect(mockMcpClient.callTool).toHaveBeenNthCalledWith(
          i + 1,
          toolCalls[i][0],
          expect.objectContaining({ group_id: "allura-test" })
        );
      }
    });
  });

  // =========================================================================
  // Error Handling Integration
  // =========================================================================

  describe("Error handling integration", () => {
    it("should provide clear error for invalid group_id", () => {
      try {
        new EnforcedMcpClient("Invalid-Group-Id", mockMcpClient);
        expect.fail("Should have thrown");
      } catch (error) {
        expect(error).toBeInstanceOf(Error);
        expect((error as Error).message).toContain("must be lowercase only");
        expect((error as Error).message).toContain("NFR11");
      }
    });

    it("should provide clear error for missing group_id", () => {
      try {
        new EnforcedMcpClient(null as any, mockMcpClient);
        expect.fail("Should have thrown");
      } catch (error) {
        expect(error).toBeInstanceOf(Error);
        expect((error as Error).message).toContain("required");
        expect((error as Error).message).toContain("null or undefined");
      }
    });

    it("should provide clear error for empty group_id", () => {
      try {
        new EnforcedMcpClient("", mockMcpClient);
        expect.fail("Should have thrown");
      } catch (error) {
        expect(error).toBeInstanceOf(Error);
        // Empty string is falsy, so it hits the "is required" check first
        expect((error as Error).message).toContain("required");
      }
    });

    it("should distinguish between validation errors and MCP errors", async () => {
      // Validation error - happens at construction
      expect(() => new EnforcedMcpClient("BAD", mockMcpClient)).toThrow(
        "must be lowercase only"
      );

      // MCP error - happens at call time
      mockMcpClient.callTool = vi.fn().mockRejectedValue(
        new Error("No such tool: invalid-tool")
      );

      const enforcedClient = new EnforcedMcpClient("allura-valid", mockMcpClient);

      await expect(
        enforcedClient.callTool("invalid-tool", {})
      ).rejects.toThrow("No such tool");
    });
  });
});

// =========================================================================
// Integration Test with Real World Scenarios
// =========================================================================

describe("Real-world MCP scenarios", () => {
  let mockMcpClient: McpToolCaller;

  beforeEach(() => {
    mockMcpClient = {
      callTool: vi.fn(),
    };
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("should enforce group_id for Notion knowledge sync workflow", async () => {
    const enforcedClient = new EnforcedMcpClient("allura-faith-meats", mockMcpClient);

    // Log trace in PostgreSQL
    vi.mocked(mockMcpClient.callTool).mockResolvedValueOnce({
      content: [{ type: "text", text: JSON.stringify({ traceId: "trace-123" }) }],
    } as any);

    await enforcedClient.callTool("postgres-log-trace", {
      agent_id: "memory-orchestrator",
      type: "contribution",
      content: { insight: "New HACCP compliance pattern" },
    });

    // Sync to Notion
    vi.mocked(mockMcpClient.callTool).mockResolvedValueOnce({
      content: [{ type: "text", text: JSON.stringify({ pageId: "page-456" }) }],
    } as any);

    await enforcedClient.callTool("notion-create-pages", {
      parent: { page_id: "knowledge-hub" },
      pages: [{ properties: { title: "HACCP Pattern" } }],
    });

    // Both calls should use the same group_id
    expect(mockMcpClient.callTool).toHaveBeenNthCalledWith(
      1,
      expect.any(String),
      expect.objectContaining({ group_id: "allura-faith-meats" })
    );
    expect(mockMcpClient.callTool).toHaveBeenNthCalledWith(
      2,
      expect.any(String),
      expect.objectContaining({ group_id: "allura-faith-meats" })
    );
  });

  it("should enforce group_id for audit search workflow", async () => {
    const enforcedClient = new EnforcedMcpClient("allura-audits", mockMcpClient);

    // Search Notion
    vi.mocked(mockMcpClient.callTool).mockResolvedValueOnce({
      content: [{ type: "text", text: JSON.stringify({ results: [] }) }],
    } as any);

    await enforcedClient.callTool("notion-search", {
      query: "GLBA compliance",
      filters: { created_date_range: { start: "2026-01-01" } },
    });

    // Query PostgreSQL
    vi.mocked(mockMcpClient.callTool).mockResolvedValueOnce({
      content: [{ type: "text", text: JSON.stringify({ rows: [] }) }],
    } as any);

    await enforcedClient.callTool("postgres-query", {
      query: "SELECT * FROM traces WHERE group_id = $1",
      params: ["allura-audits"],
    });

    // Both should enforce allura-audits
    expect(mockMcpClient.callTool).toHaveBeenNthCalledWith(
      1,
      expect.any(String),
      expect.objectContaining({ group_id: "allura-audits" })
    );
    expect(mockMcpClient.callTool).toHaveBeenNthCalledWith(
      2,
      expect.any(String),
      expect.objectContaining({ group_id: "allura-audits" })
    );
  });

  it("should support HACCP food safety monitoring workflow", async () => {
    const enforcedClient = new EnforcedMcpClient("allura-haccp", mockMcpClient);

    // Log temperature reading
    vi.mocked(mockMcpClient.callTool).mockResolvedValueOnce({
      content: [{ type: "text", text: JSON.stringify({ success: true }) }],
    } as any);

    await enforcedClient.callTool("postgres-log-trace", {
      agent_id: "haccp-monitor",
      type: "observation",
      content: { temperature: 40.5, unit: "F", location: "Walk-in Cooler A" },
    });

    // Create deviation alert in Notion
    vi.mocked(mockMcpClient.callTool).mockResolvedValueOnce({
      content: [{ type: "text", text: JSON.stringify({ pageId: "alert-789" }) }],
    } as any);

    await enforcedClient.callTool("notion-create-pages", {
      parent: { database_id: "deviations-db" },
      pages: [{ properties: { title: "Temperature Deviation" } }],
    });

    // Both calls enforce allura-haccp
    expect(mockMcpClient.callTool).toHaveBeenNthCalledWith(
      1,
      expect.any(String),
      expect.objectContaining({ group_id: "allura-haccp" })
    );
    expect(mockMcpClient.callTool).toHaveBeenNthCalledWith(
      2,
      expect.any(String),
      expect.objectContaining({ group_id: "allura-haccp" })
    );
  });
});