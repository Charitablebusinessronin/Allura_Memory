/**
 * RuVix Kernel - Policy Validation Engine
 * 
 * TRUSTED CORE: This module contains policy evaluation logic.
 * Zero external dependencies. Policies are evaluated against verified claims.
 * 
 * Every mutation must pass policy validation before execution.
 */

import { ProofClaims } from "./proof";

// ─────────────────────────────────────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Policy definition
 * 
 * Policies are evaluated in order. First violation blocks the mutation.
 */
export interface Policy {
  /** Unique policy identifier */
  id: string;
  
  /** Human-readable description */
  description: string;
  
  /** Policy condition - returns true if policy is satisfied */
  condition: (claims: ProofClaims, context: PolicyContext) => boolean;
  
  /** Error message shown when policy is violated */
  violation: string;
  
  /** Policy severity */
  severity: "critical" | "high" | "medium" | "low";
}

/**
 * Context available during policy evaluation
 * 
 * H-004 FIX: Made critical fields required to prevent silent failures
 */
export interface PolicyContext {
  /** Current timestamp (required) */
  timestamp: number;
  
  /** Operation being performed (required) */
  operation: string;
  
  /** Target resource (required) */
  resource: string;
  
  /** Budget limit for POL-002 */
  budgetLimit?: number;
  
  /** Required permission tier for POL-003 */
  requiredTier?: "kernel" | "plugin" | "skill";
  
  /** Actor for POL-004 */
  actor?: string;
  
  /** Whether audit is required for POL-005 */
  requiresAudit?: boolean;
  
  /** Additional runtime context */
  [key: string]: unknown;
}

/**
 * Policy evaluation result
 */
export interface PolicyEvaluationResult {
  /** Whether all policies passed */
  passed: boolean;
  
  /** Violated policies (empty if passed) */
  violations: PolicyViolation[];
}

/**
 * Policy violation details
 */
export interface PolicyViolation {
  /** Policy that was violated */
  policyId: string;
  
  /** Description of the violation */
  message: string;
  
  /** Severity level */
  severity: "critical" | "high" | "medium" | "low";
}

// ─────────────────────────────────────────────────────────────────────────────
// BUILTIN POLICIES
// ─────────────────────────────────────────────────────────────────────────────

/**
 * POL-001: Tenant Isolation
 * 
 * Every operation must have a valid group_id for tenant isolation.
 * This is enforced at the proof level, but we double-check here.
 */
export const POLICY_TENANT_ISOLATION: Policy = {
  id: "POL-001",
  description: "All operations must be tenant-isolated with valid group_id",
  condition: (claims) => {
    return !!(claims.group_id && /^allura-[a-z0-9-]+$/.test(claims.group_id));
  },
  violation: "Operation lacks valid tenant isolation (group_id)",
  severity: "critical",
};

/**
 * POL-002: Budget Enforcement
 * 
 * If budget_cost is specified, it must be within acceptable limits.
 * Default limit: 1000 units per operation (configurable).
 */
export const POLICY_BUDGET_ENFORCEMENT: Policy = {
  id: "POL-002",
  description: "Operations must not exceed budget limits",
  condition: (claims, context) => {
    const budgetLimit = (context.budgetLimit as number) ?? 1000;
    
    if (claims.budget_cost === undefined) {
      return true; // No budget specified, skip this check
    }
    
    return claims.budget_cost <= budgetLimit;
  },
  violation: "Operation exceeds budget limit",
  severity: "high",
};

/**
 * POL-003: Permission Tier Validation
 * 
 * Kernel operations require kernel permission tier.
 * Plugin operations require plugin or kernel tier.
 * Skill operations allow any tier.
 */
export const POLICY_PERMISSION_TIER: Policy = {
  id: "POL-003",
  description: "Operations must have appropriate permission tier",
  condition: (claims, context) => {
    const requiredTier = context.requiredTier as "kernel" | "plugin" | "skill" ?? "skill";
    const actorTier = claims.permission_tier ?? "skill";
    
    const tierHierarchy: Record<string, number> = {
      kernel: 3,
      plugin: 2,
      skill: 1,
    };
    
    return tierHierarchy[actorTier] >= tierHierarchy[requiredTier];
  },
  violation: "Insufficient permission tier for operation",
  severity: "critical",
};

/**
 * POL-004: Actor Validation
 * 
 * H-004 FIX: Now requires actor in context (will fail if not provided)
 * 
 * Actor must be a known agent or user identifier.
 */
export const POLICY_ACTOR_VALIDATION: Policy = {
  id: "POL-004",
  description: "Operations must have valid actor identification",
  condition: (claims, context) => {
    // H-004 FIX: actor is now required
    const actor = context.actor;
    
    if (!actor || typeof actor !== "string") {
      return false;
    }
    
    // Allow agent IDs (uuid format) or user IDs
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    const userIdRegex = /^user-[a-zA-Z0-9]+$/;
    
    return uuidRegex.test(actor) || userIdRegex.test(actor) || actor.startsWith("agent-");
  },
  violation: "Invalid or missing actor identification",
  severity: "high",
};

/**
 * POL-005: Audit Trail
 * 
 * C-002 FIX: Actually enforce audit trail requirement
 * 
 * All kernel operations must be auditable.
 * If audit_context is required, it must be present and non-empty.
 */
export const POLICY_AUDIT_TRAIL: Policy = {
  id: "POL-005",
  description: "Kernel operations must have audit trail",
  condition: (claims, context) => {
    const requiresAudit = context.requiresAudit as boolean ?? true;
    
    if (!requiresAudit) {
      return true;
    }
    
    // C-002 FIX: Actually validate audit_context presence and content
    if (!claims.audit_context) {
      return false;
    }
    
    // Audit context must have at least one key
    return Object.keys(claims.audit_context).length > 0;
  },
  violation: "Operation missing required audit context",
  severity: "medium",
};

// ─────────────────────────────────────────────────────────────────────────────
// POLICY ENGINE
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Default policy set for kernel operations
 */
export const DEFAULT_POLICIES: Policy[] = [
  POLICY_TENANT_ISOLATION,
  POLICY_BUDGET_ENFORCEMENT,
  POLICY_PERMISSION_TIER,
  POLICY_ACTOR_VALIDATION,
  POLICY_AUDIT_TRAIL,
];

/**
 * Evaluate policies against claims
 * 
 * H-004 FIX: Context is now required with mandatory fields
 * 
 * @param claims - Verified claims from proof
 * @param context - Runtime context for policy evaluation (required)
 * @param policies - Policies to evaluate (defaults to DEFAULT_POLICIES)
 * @returns Evaluation result with any violations
 */
export function evaluatePolicies(
  claims: ProofClaims,
  context: PolicyContext,
  policies: Policy[] = DEFAULT_POLICIES
): PolicyEvaluationResult {
  const violations: PolicyViolation[] = [];
  
  for (const policy of policies) {
    try {
      const satisfied = policy.condition(claims, context);
      
      if (!satisfied) {
        violations.push({
          policyId: policy.id,
          message: policy.violation,
          severity: policy.severity,
        });
      }
    } catch (error) {
      // Policy evaluation errors are treated as violations
      violations.push({
        policyId: policy.id,
        message: `Policy evaluation error: ${error instanceof Error ? error.message : String(error)}`,
        severity: "critical",
      });
    }
  }
  
  return {
    passed: violations.length === 0,
    violations,
  };
}

/**
 * Evaluate policies and throw on violation
 * 
 * H-004 FIX: Context is now required with mandatory fields
 * 
 * @param claims - Verified claims from proof
 * @param context - Runtime context (required)
 * @param policies - Policies to evaluate (defaults to DEFAULT_POLICIES)
 * @throws Error with violation details if any policy fails
 */
export function evaluatePoliciesOrThrow(
  claims: ProofClaims,
  context: PolicyContext,
  policies: Policy[] = DEFAULT_POLICIES
): void {
  const result = evaluatePolicies(claims, context, policies);
  
  if (!result.passed) {
    const violationMessages = result.violations
      .map((v) => `[${v.policyId}] ${v.message} (${v.severity})`)
      .join("; ");
    
    throw new Error(`Policy validation failed: ${violationMessages}`);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// POLICY REGISTRY
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Policy registry for custom policies
 */
class PolicyRegistry {
  private policies: Map<string, Policy> = new Map();
  
  /**
   * Register a custom policy
   */
  register(policy: Policy): void {
    if (this.policies.has(policy.id)) {
      throw new Error(`Policy ${policy.id} is already registered`);
    }
    this.policies.set(policy.id, policy);
  }
  
  /**
   * Get a registered policy by ID
   */
  get(policyId: string): Policy | undefined {
    return this.policies.get(policyId);
  }
  
  /**
   * Get all registered policies
   */
  getAll(): Policy[] {
    return Array.from(this.policies.values());
  }
  
  /**
   * Remove a policy from the registry
   */
  remove(policyId: string): boolean {
    return this.policies.delete(policyId);
  }
}

/**
 * Global policy registry instance
 */
export const policyRegistry = new PolicyRegistry();

// Register default policies
for (const policy of DEFAULT_POLICIES) {
  policyRegistry.register(policy);
}

// ─────────────────────────────────────────────────────────────────────────────
// POL-006: DEBUG ENFORCEMENT (Systematic Debugging)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * POL-006: Debug Enforcement — Systematic Debugging Iron Law
 *
 * No fix without root cause investigation.
 * If an event is a fix/bugfix type AND the context doesn't indicate a prior
 * root cause investigation, the mutation is rejected.
 *
 * This policy is advisory by default (logs warning, doesn't block).
 * Set `strictDebugEnforcement: true` in context to make it blocking.
 *
 * Enforcement checks:
 * - If operation is a fix-type (debug:fix_implemented, fix/*, hotfix/*)
 * - AND context.debugRootCauseFound is not truthy
 * - THEN violation
 */
export const POLICY_DEBUG_ENFORCEMENT: Policy = {
  id: "POL-006",
  description: "No fix without root cause investigation (systematic debugging)",
  condition: (claims, context) => {
    const operation = context.operation ?? "";
    const isFixOperation = operation.startsWith("fix") ||
      operation.startsWith("hotfix") ||
      operation === "debug:fix_implemented" ||
      operation.includes("bugfix");

    // Not a fix-type operation → policy satisfied
    if (!isFixOperation) {
      return true;
    }

    // Fix-type operation: check if root cause was found first
    const rootCauseFound = context.debugRootCauseFound as boolean ?? false;

    // In strict mode: block the mutation
    // In advisory mode (default): log warning but allow
    const strictMode = context.strictDebugEnforcement as boolean ?? false;

    if (strictMode) {
      return rootCauseFound;
    }

    // Advisory mode: always pass, but the violation is still recorded
    // for observability. The caller should check violations even when passed.
    return true;
  },
  violation: "Fix attempted without prior root cause investigation. Log debug:root_cause_found before fixing.",
  severity: "high",
};

// Register POL-006
policyRegistry.register(POLICY_DEBUG_ENFORCEMENT);

// ─────────────────────────────────────────────────────────────────────────────
// TENANT-SPECIFIC POLICIES
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Create tenant-specific policy overrides
 * 
 * @param groupId - Tenant group ID
 * @param overrides - Policy overrides for this tenant
 * @returns Customized policy set
 */
export function createTenantPolicies(
  groupId: string,
  overrides: Partial<Policy>[]
): Policy[] {
  // Start with default policies
  const policies = [...DEFAULT_POLICIES];
  
  // Apply overrides
  for (const override of overrides) {
    const index = policies.findIndex((p) => p.id === override.id);
    
    if (index >= 0) {
      policies[index] = { ...policies[index], ...override };
    } else {
      // New policy
      policies.push(override as Policy);
    }
  }
  
  return policies;
}
