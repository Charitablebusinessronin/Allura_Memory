/**
 * Policy Engine Implementation
 * Story 3.1: Mediate Tool Calls via Policy Gateway
 *
 * Core policy evaluation engine that determines whether actions are allowed,
 * denied, or require human review.
 */

import type {
  PolicySpec,
  PolicyRule,
  PolicyCondition,
  PolicyDecision,
  PolicyEvaluationResult,
  ExecutionContext,
  Permission,
  RolePermission,
  ConditionOperator,
} from "./types";

/**
 * Default policy specification
 */
const DEFAULT_POLICY: PolicySpec = {
  version: "1.0.0",
  name: "default-policy",
  description: "Default deny-all policy for safety",
  defaultDecision: "deny",
  roles: [],
  rules: [],
};

/**
 * Policy evaluation cache entry
 */
interface CacheEntry {
  result: PolicyEvaluationResult;
  timestamp: number;
  key: string;
}

/**
 * Policy Engine - evaluates actions against policy specifications
 */
export class PolicyEngine {
  private policy: PolicySpec;
  private cache: Map<string, CacheEntry> = new Map();
  private options: {
    strictMode: boolean;
    enableCaching: boolean;
    cacheTtlMs: number;
    logEvaluations: boolean;
  };
  private evaluationLog: PolicyEvaluationResult[] = [];

  constructor(
    policy: PolicySpec = DEFAULT_POLICY,
    options: {
      strictMode?: boolean;
      enableCaching?: boolean;
      cacheTtlMs?: number;
      logEvaluations?: boolean;
    } = {},
  ) {
    this.policy = policy;
    this.options = {
      strictMode: options.strictMode ?? true,
      enableCaching: options.enableCaching ?? true,
      cacheTtlMs: options.cacheTtlMs ?? 60000,
      logEvaluations: options.logEvaluations ?? false,
    };
  }

  /**
   * Update the policy specification (supports hot-reload)
   */
  updatePolicy(newPolicy: PolicySpec): void {
    this.policy = newPolicy;
    this.clearCache();
  }

  /**
   * Clear the evaluation cache
   */
  clearCache(): void {
    this.cache.clear();
  }

  /**
   * Evaluate whether an action is permitted
   */
  evaluate(
    resource: string,
    action: string,
    context: ExecutionContext,
  ): PolicyEvaluationResult {
    const startTime = Date.now();
    const cacheKey = this.getCacheKey(resource, action, context);

    if (this.options.enableCaching) {
      const cached = this.cache.get(cacheKey);
      if (cached && Date.now() - cached.timestamp < this.options.cacheTtlMs) {
        return cached.result;
      }
    }

    const result = this.performEvaluation(resource, action, context);
    result.evaluationTimeMs = Date.now() - startTime;

    if (this.options.logEvaluations) {
      this.evaluationLog.push(result);
    }

    if (this.options.enableCaching) {
      this.cache.set(cacheKey, {
        result,
        timestamp: Date.now(),
        key: cacheKey,
      });
    }

    return result;
  }

  /**
   * Check if a role has a specific permission
   */
  hasPermission(
    role: RolePermission["role"],
    action: string,
    resource: string,
    context: ExecutionContext,
  ): boolean {
    const roleConfig = this.policy.roles.find((r) => r.role === role);
    if (!roleConfig) return false;

    return roleConfig.permissions.some(
      (p) =>
        this.matchesPattern(resource, p.resource) &&
        p.action === action &&
        this.evaluateConditions(p.conditions ?? [], context),
    );
  }

  /**
   * Get all permissions for a role
   */
  getPermissionsForRole(role: RolePermission["role"]): Permission[] {
    const roleConfig = this.policy.roles.find((r) => r.role === role);
    return roleConfig?.permissions ?? [];
  }

  /**
   * Get all enabled rules sorted by priority
   */
  getApplicableRules(): PolicyRule[] {
    return this.policy.rules
      .filter((rule) => rule.enabled !== false)
      .sort((a, b) => (b.priority ?? 0) - (a.priority ?? 0));
  }

  /**
   * Get evaluation log for audit purposes
   */
  getEvaluationLog(): PolicyEvaluationResult[] {
    return [...this.evaluationLog];
  }

  /**
   * Clear evaluation log
   */
  clearEvaluationLog(): void {
    this.evaluationLog = [];
  }

  /**
   * Perform the actual policy evaluation
   */
  private performEvaluation(
    resource: string,
    action: string,
    context: ExecutionContext,
  ): PolicyEvaluationResult {
    const matchedRules: string[] = [];
    const deniedRules: string[] = [];
    const passedConditions: PolicyCondition[] = [];
    const failedConditions: PolicyCondition[] = [];

    const sortedRules = this.getApplicableRules();

    for (const rule of sortedRules) {
      const ruleMatch = this.ruleMatches(rule, resource, action, context);

      if (ruleMatch.matched) {
        matchedRules.push(rule.id);

        if (ruleMatch.passedConditions) {
          passedConditions.push(...ruleMatch.passedConditions);
        }
        if (ruleMatch.failedConditions) {
          failedConditions.push(...ruleMatch.failedConditions);
        }

        if (rule.effect === "deny") {
          deniedRules.push(rule.id);
          return {
            decision: "deny",
            matchedRules,
            deniedRules,
            evaluationTimeMs: 0,
            reason: `Rule '${rule.name}' denied access`,
            conditions: { passed: passedConditions, failed: failedConditions },
          };
        }
      }
    }

    const rolePermissions = this.policy.roles.find(
      (r) => r.role === context.role,
    );
    const hasRolePermission =
      rolePermissions?.permissions.some(
        (p) =>
          this.matchesPattern(resource, p.resource) &&
          p.action === action &&
          this.evaluateConditions(p.conditions ?? [], context),
      ) ?? false;

    if (!hasRolePermission && this.options.strictMode) {
      return {
        decision: this.policy.defaultDecision,
        matchedRules,
        deniedRules,
        evaluationTimeMs: 0,
        reason: "No matching allow rule and role lacks permission",
        conditions: { passed: passedConditions, failed: failedConditions },
      };
    }

    return {
      decision: "allow",
      matchedRules,
      deniedRules,
      evaluationTimeMs: 0,
      conditions: { passed: passedConditions, failed: failedConditions },
    };
  }

  /**
   * Check if a rule matches the request
   */
  private ruleMatches(
    rule: PolicyRule,
    resource: string,
    action: string,
    context: ExecutionContext,
  ): {
    matched: boolean;
    passedConditions?: PolicyCondition[];
    failedConditions?: PolicyCondition[];
  } {
    const resourceMatch = rule.resources.some((r) =>
      this.matchesPattern(resource, r),
    );
    if (!resourceMatch) return { matched: false };

    const actionMatch = rule.actions.some((a) => a === action);
    if (!actionMatch) return { matched: false };

    const passedConditions: PolicyCondition[] = [];
    const failedConditions: PolicyCondition[] = [];

    if (rule.conditions && rule.conditions.length > 0) {
      for (const condition of rule.conditions) {
        if (this.evaluateCondition(condition, context)) {
          passedConditions.push(condition);
        } else {
          failedConditions.push(condition);
        }
      }
      // A rule only matches if ALL conditions pass
      if (failedConditions.length > 0) {
        return { matched: false, passedConditions, failedConditions };
      }
    }

    return { matched: true, passedConditions, failedConditions };
  }

  /**
   * Evaluate all conditions against context
   */
  private evaluateConditions(
    conditions: PolicyCondition[],
    context: ExecutionContext,
  ): boolean {
    return conditions.every((condition) =>
      this.evaluateCondition(condition, context),
    );
  }

  /**
   * Evaluate a single condition
   */
  private evaluateCondition(
    condition: PolicyCondition,
    context: ExecutionContext,
  ): boolean {
    const fieldValue = this.getFieldValue(condition.field, context);

    switch (condition.operator) {
      case "equals":
        return fieldValue === condition.value;
      case "not_equals":
        return fieldValue !== condition.value;
      case "contains":
        return Array.isArray(fieldValue)
          ? fieldValue.includes(condition.value)
          : String(fieldValue).includes(String(condition.value));
      case "not_contains":
        return Array.isArray(fieldValue)
          ? !fieldValue.includes(condition.value)
          : !String(fieldValue).includes(String(condition.value));
      case "starts_with":
        return String(fieldValue).startsWith(String(condition.value));
      case "ends_with":
        return String(fieldValue).endsWith(String(condition.value));
      case "greater_than":
        return Number(fieldValue) > Number(condition.value);
      case "less_than":
        return Number(fieldValue) < Number(condition.value);
      case "in":
        return Array.isArray(condition.value)
          ? condition.value.includes(fieldValue)
          : false;
      case "not_in":
        return Array.isArray(condition.value)
          ? !condition.value.includes(fieldValue)
          : true;
      case "exists":
        return fieldValue !== undefined && fieldValue !== null;
      case "not_exists":
        return fieldValue === undefined || fieldValue === null;
      case "matches":
        try {
          const regex = new RegExp(String(condition.value));
          return regex.test(String(fieldValue));
        } catch {
          return false;
        }
      default:
        return false;
    }
  }

  /**
   * Get field value from context using dot notation
   */
  private getFieldValue(
    field: string,
    context: ExecutionContext,
  ): unknown {
    const parts = field.split(".");
    let value: unknown = context;

    for (const part of parts) {
      if (value && typeof value === "object" && part in value) {
        value = (value as Record<string, unknown>)[part];
      } else {
        return undefined;
      }
    }

    return value;
  }

  /**
   * Check if resource matches a pattern (supports wildcards)
   */
  private matchesPattern(resource: string, pattern: string): boolean {
    if (pattern === "*") return true;
    if (pattern === resource) return true;

    const regex = new RegExp(
      "^" + pattern.replace(/\*/g, ".*").replace(/\?/g, ".") + "$",
    );
    return regex.test(resource);
  }

  /**
   * Generate cache key
   */
  private getCacheKey(
    resource: string,
    action: string,
    context: ExecutionContext,
  ): string {
    return `${context.groupId}:${context.role}:${context.agentId}:${resource}:${action}`;
  }
}

/**
 * Create a policy engine instance
 */
export function createPolicyEngine(
  policy: PolicySpec,
  options?: {
    strictMode?: boolean;
    enableCaching?: boolean;
    cacheTtlMs?: number;
    logEvaluations?: boolean;
  },
): PolicyEngine {
  return new PolicyEngine(policy, options);
}

/**
 * Validate a policy specification
 */
export function validatePolicySpec(policy: unknown): {
  valid: boolean;
  errors: string[];
} {
  const errors: string[] = [];

  if (!policy || typeof policy !== "object") {
    return { valid: false, errors: ["Policy must be an object"] };
  }

  const p = policy as Partial<PolicySpec>;

  if (!p.version || typeof p.version !== "string") {
    errors.push("Policy must have a version string");
  }

  if (!p.name || typeof p.name !== "string") {
    errors.push("Policy must have a name");
  }

  if (!["allow", "deny", "review"].includes(p.defaultDecision ?? "")) {
    errors.push("Default decision must be 'allow', 'deny', or 'review'");
  }

  if (!Array.isArray(p.roles)) {
    errors.push("Policy must have a roles array");
  }

  if (!Array.isArray(p.rules)) {
    errors.push("Policy must have a rules array");
  }

  for (const role of p.roles ?? []) {
    if (!role.role || typeof role.role !== "string") {
      errors.push("Each role must have a role name");
    }
    if (!Array.isArray(role.permissions)) {
      errors.push(`Role ${role.role} must have permissions array`);
    }
  }

  for (const rule of p.rules ?? []) {
    if (!rule.id || typeof rule.id !== "string") {
      errors.push("Each rule must have an id");
    }
    if (!rule.name || typeof rule.name !== "string") {
      errors.push("Each rule must have a name");
    }
    if (!["allow", "deny"].includes(rule.effect ?? "")) {
      errors.push(`Rule ${rule.id} must have effect 'allow' or 'deny'`);
    }
  }

  return { valid: errors.length === 0, errors };
}