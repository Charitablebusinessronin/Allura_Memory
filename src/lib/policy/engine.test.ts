/**
 * Policy Engine Tests
 * Story 3.1: Mediate Tool Calls via Policy Gateway
 */

import { describe, it, expect, beforeEach } from "vitest";
import {
  PolicyEngine,
  createPolicyEngine,
  validatePolicySpec,
} from "./engine";
import type { PolicySpec, ExecutionContext, RolePermission } from "./types";

describe("PolicyEngine", () => {
  let engine: PolicyEngine;

  const testPolicy: PolicySpec = {
    version: "1.0.0",
    name: "test-policy",
    description: "Test policy for unit tests",
    defaultDecision: "deny",
    roles: [
      {
        role: "admin",
        permissions: [
          { action: "execute", resource: "*" },
          { action: "read", resource: "*" },
          { action: "write", resource: "*" },
        ],
      },
      {
        role: "operator",
        permissions: [
          { action: "execute", resource: "tool:*" },
          { action: "read", resource: "*" },
        ],
      },
      {
        role: "agent",
        permissions: [
          { action: "execute", resource: "tool:postgres.query" },
          { action: "read", resource: "database:postgres" },
        ],
      },
    ],
    rules: [
      {
        id: "deny-dangerous",
        name: "Deny Dangerous Tools",
        effect: "deny",
        priority: 100,
        actions: ["execute"],
        resources: ["tool:system.shutdown", "tool:system.restart"],
        conditions: [{ field: "role", operator: "not_equals", value: "admin" }],
      },
      {
        id: "allow-read",
        name: "Allow Read Operations",
        effect: "allow",
        priority: 50,
        actions: ["read"],
        resources: ["*"],
        conditions: [{ field: "role", operator: "not_equals", value: "guest" }],
      },
      {
        id: "allow-agent-tools",
        name: "Allow Agent Tools",
        effect: "allow",
        priority: 30,
        actions: ["execute"],
        resources: ["tool:postgres.query", "tool:neo4j.query"],
        conditions: [{ field: "role", operator: "equals", value: "agent" }],
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
    agentId: "guest-agent",
    role: "guest",
    timestamp: new Date(),
  };

  beforeEach(() => {
    engine = createPolicyEngine(testPolicy, { strictMode: true });
  });

  describe("AC1: Policy Evaluation", () => {
    it("should evaluate allow rules correctly", () => {
      const result = engine.evaluate("tool:postgres.query", "execute", agentContext);

      expect(result.decision).toBe("allow");
      expect(result.matchedRules).toContain("allow-agent-tools");
    });

    it("should evaluate deny rules correctly", () => {
      const result = engine.evaluate("tool:system.shutdown", "execute", agentContext);

      expect(result.decision).toBe("deny");
      expect(result.matchedRules).toContain("deny-dangerous");
      expect(result.deniedRules).toContain("deny-dangerous");
    });

    it("should deny when no matching rules", () => {
      const result = engine.evaluate("tool:unknown.tool", "execute", guestContext);

      expect(result.decision).toBe("deny");
    });

    it("should use default decision when no rules match", () => {
      const denyEngine = createPolicyEngine(
        { ...testPolicy, defaultDecision: "deny" },
        { strictMode: true },
      );

      const result = denyEngine.evaluate("tool:unknown", "execute", guestContext);

      expect(result.decision).toBe("deny");
    });

    it("should track evaluation time", () => {
      const result = engine.evaluate("tool:postgres.query", "execute", agentContext);

      expect(result.evaluationTimeMs).toBeGreaterThanOrEqual(0);
    });
  });

  describe("RBAC Permission Checking", () => {
    it("should check role permissions correctly", () => {
      expect(engine.hasPermission("admin", "execute", "tool:any", adminContext)).toBe(true);
      expect(engine.hasPermission("admin", "read", "system:any", adminContext)).toBe(true);
    });

    it("should deny permissions not granted to role", () => {
      expect(engine.hasPermission("agent", "execute", "tool:postgres.query", agentContext)).toBe(true);
      expect(engine.hasPermission("agent", "execute", "tool:unknown", agentContext)).toBe(false);
    });

    it("should respect resource pattern matching", () => {
      expect(engine.hasPermission("operator", "execute", "tool:any", { ...agentContext, role: "operator" })).toBe(true);
      expect(engine.hasPermission("operator", "admin", "system:any", { ...agentContext, role: "operator" })).toBe(false);
    });

    it("should return correct permissions for role", () => {
      const adminPerms = engine.getPermissionsForRole("admin");
      expect(adminPerms).toHaveLength(3);
      expect(adminPerms.some((p) => p.action === "execute")).toBe(true);

      const guestPerms = engine.getPermissionsForRole("guest");
      expect(guestPerms).toHaveLength(0);

      const agentPerms = engine.getPermissionsForRole("agent");
      expect(agentPerms).toHaveLength(2);
    });
  });

  describe("Condition Evaluation", () => {
    it("should evaluate equals condition", () => {
      const context: ExecutionContext = {
        ...agentContext,
        metadata: { testValue: "test" },
      };

      const result = engine.evaluate("tool:postgres.query", "execute", context);

      expect(result.decision).toBe("allow");
      expect(result.matchedRules).toContain("allow-agent-tools");
    });

    it("should evaluate not_equals condition", () => {
      const operatorContext: ExecutionContext = {
        ...agentContext,
        role: "operator",
      };

      const result = engine.evaluate("tool:system.shutdown", "execute", operatorContext);

      expect(result.decision).toBe("deny");
      expect(result.matchedRules).toContain("deny-dangerous");
    });

    it("should evaluate exists condition", () => {
      // Create engine with strictMode: false to test condition evaluation directly
    const relaxedEngine = new PolicyEngine(
      {
        version: "1.0.0",
        name: "test",
        defaultDecision: "allow",
        roles: [],
        rules: [
          {
            id: "deny-without-session",
            name: "Deny Without Session",
            effect: "deny",
            priority: 100,
            actions: ["execute"],
            resources: ["tool:*"],
            conditions: [
              { field: "sessionId", operator: "not_exists" },
            ],
          },
        ],
      },
      { strictMode: false, enableCaching: false },
    );

    const withSession: ExecutionContext = {
      ...agentContext,
      sessionId: "session-123",
    };
    const withoutSession: ExecutionContext = {
      ...agentContext,
    };

    const resultWith = relaxedEngine.evaluate("tool:postgres.query", "execute", withSession);
    const resultWithout = relaxedEngine.evaluate("tool:postgres.query", "execute", withoutSession);

    expect(resultWith.decision).toBe("allow");
    expect(resultWithout.decision).toBe("deny");
    });
  });

  describe("Rule Priority", () => {
    it("should apply rules in priority order", () => {
      const highPriorityDeny: PolicySpec = {
        ...testPolicy,
        rules: [
          {
            id: "deny-all-tools",
            name: "Deny All Tools",
            effect: "deny",
            priority: 200,
            actions: ["execute"],
            resources: ["tool:*"],
          },
          ...testPolicy.rules,
        ],
      };

      engine.updatePolicy(highPriorityDeny);
      const result = engine.evaluate("tool:postgres.query", "execute", agentContext);

      expect(result.decision).toBe("deny");
      expect(result.matchedRules[0]).toBe("deny-all-tools");
    });
  });

  describe("Caching", () => {
    it("should cache evaluation results", () => {
      const cachedEngine = createPolicyEngine(testPolicy, { enableCaching: true });

      const result1 = cachedEngine.evaluate("tool:postgres.query", "execute", agentContext);
      const result2 = cachedEngine.evaluate("tool:postgres.query", "execute", agentContext);

      expect(result1.evaluationTimeMs).toEqual(result2.evaluationTimeMs);
    });

    it("should clear cache on policy update", () => {
      const cachedEngine = createPolicyEngine(testPolicy, { enableCaching: true });

      cachedEngine.evaluate("tool:postgres.query", "execute", agentContext);
      cachedEngine.updatePolicy(testPolicy);

      expect(() => cachedEngine.clearCache()).not.toThrow();
    });
  });

  describe("Audit Logging", () => {
    it("should log evaluations when enabled", () => {
      const auditEngine = createPolicyEngine(testPolicy, { logEvaluations: true });

      auditEngine.evaluate("tool:postgres.query", "execute", agentContext);
      auditEngine.evaluate("tool:system.shutdown", "execute", agentContext);

      const log = auditEngine.getEvaluationLog();
      expect(log).toHaveLength(2);

      auditEngine.clearEvaluationLog();
      expect(auditEngine.getEvaluationLog()).toHaveLength(0);
    });
  });
});

describe("validatePolicySpec", () => {
  it("should validate a valid policy", () => {
    const validPolicy: PolicySpec = {
      version: "1.0.0",
      name: "valid-policy",
      defaultDecision: "deny",
      roles: [],
      rules: [],
    };

    const result = validatePolicySpec(validPolicy);
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it("should reject missing version", () => {
    const result = validatePolicySpec({
      name: "test",
      defaultDecision: "deny",
      roles: [],
      rules: [],
    });

    expect(result.valid).toBe(false);
    expect(result.errors).toContain("Policy must have a version string");
  });

  it("should reject missing name", () => {
    const result = validatePolicySpec({
      version: "1.0.0",
      defaultDecision: "deny",
      roles: [],
      rules: [],
    });

    expect(result.valid).toBe(false);
    expect(result.errors).toContain("Policy must have a name");
  });

  it("should reject invalid default decision", () => {
    const result = validatePolicySpec({
      version: "1.0.0",
      name: "test",
      defaultDecision: "invalid" as "allow" | "deny" | "review",
      roles: [],
      rules: [],
    });

    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes("Default decision must be"))).toBe(true);
  });

  it("should reject missing roles array", () => {
    const result = validatePolicySpec({
      version: "1.0.0",
      name: "test",
      defaultDecision: "deny",
      roles: "invalid" as unknown as RolePermission[],
      rules: [],
    });

    expect(result.valid).toBe(false);
    expect(result.errors).toContain("Policy must have a roles array");
  });

  it("should reject invalid rule effect", () => {
    const result = validatePolicySpec({
      version: "1.0.0",
      name: "test",
      defaultDecision: "deny",
      roles: [],
      rules: [
        {
          id: "test-rule",
          name: "Test",
          effect: "invalid" as "allow" | "deny",
          actions: ["execute"],
          resources: ["*"],
        },
      ],
    });

    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes("must have effect"))).toBe(true);
  });
});

describe("Policy Hot Reload", () => {
  it("should update policy without restart", () => {
    const engine = createPolicyEngine(
      {
        version: "1.0.0",
        name: "initial",
        defaultDecision: "deny",
        roles: [],
        rules: [],
      },
      { strictMode: true },
    );

    const context: ExecutionContext = {
      groupId: "test",
      agentId: "test",
      role: "agent",
      timestamp: new Date(),
    };

    const beforeResult = engine.evaluate("tool:test", "execute", context);
    expect(beforeResult.decision).toBe("deny");

    engine.updatePolicy({
      version: "1.0.1",
      name: "updated",
      defaultDecision: "allow",
      roles: [],
      rules: [],
    });

    const afterResult = engine.evaluate("tool:test", "execute", context);
    expect(afterResult.decision).toBe("allow");
  });
});