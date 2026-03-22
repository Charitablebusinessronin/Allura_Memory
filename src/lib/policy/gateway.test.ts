/**
 * Policy Gateway Tests
 * Story 3.1: Mediate Tool Calls via Policy Gateway
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import { PolicyGateway, GatewayError, createPolicyGateway, wrapWithGateway } from "./gateway";
import { createApprovalRouter } from "./approval-router";
import type {
  PolicySpec,
  ExecutionContext,
  ToolContract,
  ToolExecutionRequest,
} from "./types";

describe("PolicyGateway", () => {
  let gateway: PolicyGateway;
  let approvalRouter: ReturnType<typeof createApprovalRouter>;

  const testPolicy: PolicySpec = {
    version: "1.0.0",
    name: "test-policy",
    defaultDecision: "deny",
    roles: [
      {
        role: "admin",
        permissions: [
          { action: "execute", resource: "*" },
        ],
      },
      {
        role: "agent",
        permissions: [
          { action: "execute", resource: "tool:query" },
        ],
      },
    ],
    rules: [
      {
        id: "deny-dangerous",
        name: "Deny Dangerous",
        effect: "deny",
        priority: 100,
        actions: ["execute"],
        resources: ["tool:dangerous"],
        conditions: [{ field: "role", operator: "not_equals", value: "admin" }],
      },
      {
        id: "allow-query",
        name: "Allow Query",
        effect: "allow",
        priority: 50,
        actions: ["execute"],
        resources: ["tool:query"],
        conditions: [{ field: "role", operator: "equals", value: "agent" }],
      },
      {
        id: "allow-admin-all",
        name: "Allow Admin All",
        effect: "allow",
        priority: 200,
        actions: ["execute"],
        resources: ["*"],
        conditions: [{ field: "role", operator: "equals", value: "admin" }],
      },
    ],
  };

  const adminContext: ExecutionContext = {
    groupId: "test-group",
    agentId: "admin-agent",
    role: "admin",
    timestamp: new Date(),
  };

  const agentContext: ExecutionContext = {
    groupId: "test-group",
    agentId: "test-agent",
    role: "agent",
    timestamp: new Date(),
  };

  const guestContext: ExecutionContext = {
    groupId: "test-group",
    agentId: "guest",
    role: "guest",
    timestamp: new Date(),
  };

  const queryToolContract: ToolContract = {
    name: "query",
    description: "Database query tool",
    inputSchema: { query: { type: "string", required: true } },
    riskLevel: "low",
    resourceType: "database",
    requiredPermissions: [{ action: "execute", resource: "tool:query" }],
    sideEffects: false,
  };

  const dangerousToolContract: ToolContract = {
    name: "dangerous",
    description: "Dangerous system tool",
    inputSchema: {},
    riskLevel: "critical",
    resourceType: "system",
    requiredPermissions: [{ action: "execute", resource: "tool:dangerous" }],
    sideEffects: true,
  };

  const mockExecutor = vi.fn().mockImplementation(async (input: unknown) => {
    return { success: true, data: input };
  });

  beforeEach(() => {
    vi.clearAllMocks();
    approvalRouter = createApprovalRouter();
    gateway = createPolicyGateway(testPolicy, approvalRouter);
  });

  describe("Tool Registration", () => {
    it("should register a tool with contract", () => {
      gateway.registerTool(queryToolContract, mockExecutor);
      expect(gateway.getRegisteredTools()).toContain("query");
    });

    it("should throw on duplicate tool registration", () => {
      gateway.registerTool(queryToolContract, mockExecutor);
      expect(() => gateway.registerTool(queryToolContract, mockExecutor)).toThrow(
        "already registered",
      );
    });

    it("should get tool contract", () => {
      gateway.registerTool(queryToolContract, mockExecutor);
      const contract = gateway.getToolContract("query");
      expect(contract?.name).toBe("query");
      expect(contract?.riskLevel).toBe("low");
    });
  });

  describe("AC1: Gateway Validates Before Execution", () => {
    it("should allow authorized tool calls", async () => {
      gateway.registerTool(queryToolContract, mockExecutor);

      const request: ToolExecutionRequest = {
        toolName: "query",
        input: { query: "SELECT 1" },
        context: agentContext,
      };

      const result = await gateway.execute(request);

      expect(result.success).toBe(true);
      expect(result.policyResult.decision).toBe("allow");
      expect(mockExecutor).toHaveBeenCalled();
    });

    it("should block unauthorized tool calls", async () => {
      gateway.registerTool(queryToolContract, mockExecutor);

      const request: ToolExecutionRequest = {
        toolName: "query",
        input: { query: "SELECT 1" },
        context: guestContext,
      };

      const result = await gateway.execute(request);

      expect(result.success).toBe(false);
      expect(result.policyResult.decision).toBe("deny");
      expect(mockExecutor).not.toHaveBeenCalled();
    });

    it("should block unregistered tools", async () => {
      const request: ToolExecutionRequest = {
        toolName: "unknown",
        input: {},
        context: adminContext,
      };

      const result = await gateway.execute(request);

      expect(result.success).toBe(false);
      expect(result.error).toContain("not registered");
    });

    it("should validate contract input schema", async () => {
      const strictContract: ToolContract = {
        ...queryToolContract,
        inputSchema: {
          query: { type: "string", required: true },
          limit: { type: "number", required: true },
        },
      };

      gateway.registerTool(strictContract, mockExecutor);

      const request: ToolExecutionRequest = {
        toolName: "query",
        input: { query: "SELECT 1" },
        context: adminContext,
      };

      const result = await gateway.execute(request);

      expect(result.success).toBe(false);
      expect(result.error).toContain("Missing required field");
    });
  });

  describe("AC2: Gateway Executes Authorized Calls", () => {
    it("should execute and return results for authorized calls", async () => {
      gateway.registerTool(queryToolContract, mockExecutor);

      const request: ToolExecutionRequest = {
        toolName: "query",
        input: { query: "SELECT * FROM users" },
        context: agentContext,
      };

      const result = await gateway.execute(request);

      expect(result.success).toBe(true);
      expect(result.data).toEqual({ success: true, data: { query: "SELECT * FROM users" } });
      expect(result.executionTimeMs).toBeGreaterThanOrEqual(0);
    });

    it("should handle executor errors gracefully", async () => {
      const errorExecutor = vi.fn().mockRejectedValue(new Error("DB connection failed"));
      gateway.registerTool(queryToolContract, errorExecutor);

      const request: ToolExecutionRequest = {
        toolName: "query",
        input: { query: "SELECT 1" },
        context: agentContext,
      };

      const result = await gateway.execute(request);

      expect(result.success).toBe(false);
      expect(result.error).toContain("DB connection failed");
    });

    it("should track gateway statistics", async () => {
      gateway.registerTool(queryToolContract, mockExecutor);

      await gateway.execute({ toolName: "query", input: { query: "test" }, context: agentContext });
      await gateway.execute({ toolName: "query", input: { query: "test" }, context: guestContext });
      await gateway.execute({ toolName: "query", input: { query: "test" }, context: adminContext });

      const stats = gateway.getStats();
      expect(stats.totalRequests).toBe(3);
      expect(stats.allowedRequests).toBe(2);
      expect(stats.deniedRequests).toBe(1);
    });
  });

  describe("AC3: Block or Route Unauthorized Actions", () => {
    it("should block dangerous tools for non-admin", async () => {
      gateway.registerTool(dangerousToolContract, mockExecutor);

      const request: ToolExecutionRequest = {
        toolName: "dangerous",
        input: {},
        context: agentContext,
      };

      const result = await gateway.execute(request);

      expect(result.success).toBe(false);
      expect(result.policyResult.decision).toBe("deny");
    });

    it("should allow dangerous tools for admin", async () => {
      gateway.registerTool(queryToolContract, mockExecutor);

      const request: ToolExecutionRequest = {
        toolName: "query",
        input: { query: "test" },
        context: adminContext,
      };

      const result = await gateway.execute(request);

      expect(result.success).toBe(true);
    });

    it("should route high-risk actions for approval when configured", async () => {
      const reviewPolicy: PolicySpec = {
        version: "1.0.0",
        name: "review-policy",
        defaultDecision: "review",
        roles: [
          {
            role: "agent",
            permissions: [{ action: "execute", resource: "*" }],
          },
        ],
        rules: [
          {
            id: "deny-dangerous",
            name: "Deny Dangerous For Agents",
            effect: "deny",
            priority: 100,
            actions: ["execute"],
            resources: ["tool:dangerous"],
            conditions: [{ field: "role", operator: "equals", value: "agent" }],
          },
        ],
      };

      const reviewGateway = createPolicyGateway(reviewPolicy, approvalRouter);
      reviewGateway.registerTool(dangerousToolContract, mockExecutor);

      const request: ToolExecutionRequest = {
        toolName: "dangerous",
        input: {},
        context: agentContext,
      };

      const result = await reviewGateway.execute(request);

      expect(result.success).toBe(false);
      expect(result.policyResult.decision).toBe("deny");
      expect(result.policyResult.matchedRules).toContain("deny-dangerous");
    });
  });

  describe("Check Permission (Dry Run)", () => {
    it("should check permission without executing", () => {
      gateway.registerTool(queryToolContract, mockExecutor);

      const result = gateway.checkPermission({
        toolName: "query",
        input: {},
        context: agentContext,
      });

      expect(result.decision).toBe("allow");
    });

    it("should deny permission check for unauthorized", () => {
      gateway.registerTool(queryToolContract, mockExecutor);

      const result = gateway.checkPermission({
        toolName: "query",
        input: {},
        context: guestContext,
      });

      expect(result.decision).toBe("deny");
    });
  });

  describe("Gateway Disabled", () => {
    it("should block all calls when disabled", async () => {
      const disabledGateway = createPolicyGateway(testPolicy, approvalRouter, {
        enabled: false,
      });
      disabledGateway.registerTool(queryToolContract, mockExecutor);

      const request: ToolExecutionRequest = {
        toolName: "query",
        input: {},
        context: adminContext,
      };

      const result = await disabledGateway.execute(request);

      expect(result.success).toBe(false);
      expect(result.error).toContain("disabled");
    });
  });

  describe("Hot Reload", () => {
    it("should update policy without restart", () => {
      gateway.registerTool(queryToolContract, mockExecutor);

      const beforeResult = gateway.checkPermission({
        toolName: "query",
        input: {},
        context: guestContext,
      });
      expect(beforeResult.decision).toBe("deny");

      gateway.updatePolicy({
        version: "2.0.0",
        name: "open-policy",
        defaultDecision: "allow",
        roles: [],
        rules: [],
      });

      const afterResult = gateway.checkPermission({
        toolName: "query",
        input: {},
        context: guestContext,
      });
      expect(afterResult.decision).toBe("allow");
    });
  });
});

describe("wrapWithGateway", () => {
  let gateway: PolicyGateway;
  let approvalRouter: ReturnType<typeof createApprovalRouter>;

  const testPolicy: PolicySpec = {
    version: "1.0.0",
    name: "test-policy",
    defaultDecision: "deny",
    roles: [
      {
        role: "agent",
        permissions: [{ action: "execute", resource: "tool:query" }],
      },
    ],
    rules: [
      {
        id: "allow-query",
        name: "Allow Query",
        effect: "allow",
        actions: ["execute"],
        resources: ["tool:query"],
        conditions: [{ field: "role", operator: "equals", value: "agent" }],
      },
    ],
  };

  const agentContext: ExecutionContext = {
    groupId: "test",
    agentId: "agent",
    role: "agent",
    timestamp: new Date(),
  };

  const guestContext: ExecutionContext = {
    groupId: "test",
    agentId: "guest",
    role: "guest",
    timestamp: new Date(),
  };

  const queryContract: ToolContract = {
    name: "query",
    description: "Query tool",
    inputSchema: {},
    riskLevel: "low",
    resourceType: "database",
    requiredPermissions: [{ action: "execute", resource: "tool:query" }],
    sideEffects: false,
  };

  beforeEach(() => {
    approvalRouter = createApprovalRouter();
    gateway = createPolicyGateway(testPolicy, approvalRouter);
  });

  it("should wrap function with gateway enforcement", async () => {
    gateway.registerTool(queryContract, async (input) => input);
    const wrapped = wrapWithGateway(gateway, "query", queryContract, async (input) => input);

    const result = await wrapped({ value: 5 }, agentContext);
    expect(result).toEqual({ value: 5 });
  });

  it("should throw GatewayError when blocked", async () => {
    const original = async (input: { value: number }) => input.value * 2;
    const wrapped = wrapWithGateway(gateway, "query", queryContract, original);

    await expect(wrapped({ value: 5 }, guestContext)).rejects.toThrow(GatewayError);
  });

  it("should include policy result in error", async () => {
    const original = async (input: { value: number }) => input.value * 2;
    const wrapped = wrapWithGateway(gateway, "query", queryContract, original);

    try {
      await wrapped({ value: 5 }, guestContext);
      expect.fail("Should have thrown");
    } catch (error) {
      expect(error).toBeInstanceOf(GatewayError);
      expect((error as GatewayError).policyResult.decision).toBe("deny");
    }
  });
});