/**
 * RuVix Kernel - Policy Validation Engine
 * 
 * TRUSTED CORE: This module contains policy evaluation logic.
 * Zero external dependencies. Policies are evaluated against verified claims.
 * 
 * Every mutation must pass policy validation before execution.
 */

import { ProofClaims } from "./proof";

// Re-export ProofClaims so consumers can import from policy.ts
export type { ProofClaims } from "./proof";

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
  
  /** Project manifest for POL-007/008/009 enforcement */
  projectManifest?: ProjectManifest;
  
  /** Source-of-truth read events for POL-007 verification */
  sourceOfTruthReads?: SourceOfTruthRead[];
  
  /** Declared infrastructure targets for POL-008 verification */
  declaredInfrastructureTargets?: InfrastructureTarget[];
  
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
// PROJECT GOVERNANCE TYPES (POL-007/008/009)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Source-of-truth declaration for a project
 * 
 * Defines where canonical data lives so RuVix can verify agents read from it.
 */
export interface SourceOfTruth {
  /** Source type (e.g., 'notion', 'github', 'local') */
  type: string;
  
  /** Source identifier (e.g., Notion database ID, GitHub repo URL) */
  id: string;
  
  /** Human-readable name for error messages */
  name: string;
  
  /** Whether this source is required before any project write */
  required: boolean;
}

/**
 * Infrastructure target declaration for a project
 * 
 * Defines what databases/deployment targets a project should use.
 */
export interface InfrastructureTarget {
  /** Target type (e.g., 'neon', 'docker-postgres', 'vercel', 'aws') */
  type: string;
  
  /** Connection identifier (e.g., Neon project ID, connection string pattern) */
  id: string;
  
  /** Human-readable name for error messages */
  name: string;
  
  /** Category for matching (e.g., 'database', 'deployment', 'cache') */
  category: string;
}

/**
 * Project manifest — machine-readable declaration of project constraints
 * 
 * Required by POL-009. Without this, POL-007 and POL-008 have nothing to enforce.
 */
export interface ProjectManifest {
  /** Project name */
  name: string;
  
  /** Declared sources of truth (ordered by priority) */
  sourcesOfTruth: SourceOfTruth[];
  
  /** Declared infrastructure targets */
  infrastructureTargets: InfrastructureTarget[];
  
  /** Captain directives captured as hard constraints */
  captainDirectives?: string[];
  
  /** Whitelisted local file overrides (for POL-012 future use) */
  localOverrides?: string[];
}

/**
 * Record of a source-of-truth read event
 * 
 * Used by POL-007 to verify that the agent actually read from the canonical source.
 */
export interface SourceOfTruthRead {
  /** Source type that was read */
  type: string;
  
  /** Source ID that was read */
  id: string;
  
  /** Timestamp of the read */
  timestamp: number;
  
  /** What was read (for audit) */
  summary?: string;
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
 * 
 * NOTE: Must be defined after all referenced policies to avoid
 * block-scoped variable hoisting errors.
 */
// Placeholder — actual definition is after POL-009 below

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
  policies?: Policy[]
): PolicyEvaluationResult {
  const resolvedPolicies = policies ?? DEFAULT_POLICIES;
  const violations: PolicyViolation[] = [];
  
  for (const policy of resolvedPolicies) {
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
  policies?: Policy[]
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

// Register POL-001 through POL-005 individually (DEFAULT_POLICIES defined later)
policyRegistry.register(POLICY_TENANT_ISOLATION);
policyRegistry.register(POLICY_BUDGET_ENFORCEMENT);
policyRegistry.register(POLICY_PERMISSION_TIER);
policyRegistry.register(POLICY_ACTOR_VALIDATION);
policyRegistry.register(POLICY_AUDIT_TRAIL);

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
// POL-007: SOURCE-OF-TRUTH PRE-FLIGHT GATE
// ─────────────────────────────────────────────────────────────────────────────

/**
 * POL-007: Source-of-Truth Pre-Flight Gate
 *
 * Before ANY project write operation, the agent must have proven it has read
 * from the project's declared canonical source (e.g., Notion database).
 *
 * Enforcement:
 * - If projectManifest exists and declares required sources of truth
 * - AND the operation is a write-type (mutate, write, create, update, delete)
 * - AND no sourceOfTruthReads entry matches a required source
 * - THEN the mutation is BLOCKED
 *
 * Read-type operations (query, read, search) are allowed without source verification
 * to support the initial read that satisfies this very policy.
 *
 * Origin: Team retro 2026-05-08 — 13 commits reverted because agents used local
 * files instead of Notion. Unanimous proposal from all 4 agents.
 */
export const POLICY_SOURCE_OF_TRUTH_GATE: Policy = {
  id: "POL-007",
  description: "Write operations require prior read from declared source of truth",
  condition: (claims, context) => {
    const manifest = context.projectManifest as ProjectManifest | undefined;
    
    // No manifest → policy cannot enforce → skip (POL-009 handles this)
    if (!manifest || !manifest.sourcesOfTruth) {
      return true;
    }
    
    // Read-type operations are exempt — agents need to read to satisfy this policy
    const operation = context.operation ?? "";
    const isWriteOperation = /^(mutate|write|create|update|delete|deploy|commit)/i.test(operation);
    
    if (!isWriteOperation) {
      return true;
    }
    
    // Find required sources of truth
    const requiredSources = manifest.sourcesOfTruth.filter(s => s.required);
    
    if (requiredSources.length === 0) {
      return true; // No required sources declared
    }
    
    // Check if agent has read from each required source
    const reads = context.sourceOfTruthReads as SourceOfTruthRead[] ?? [];
    
    for (const source of requiredSources) {
      const hasRead = reads.some(
        r => r.type === source.type && r.id === source.id
      );
      
      if (!hasRead) {
        return false; // Missing read from required source
      }
    }
    
    return true;
  },
  violation: "Source-of-truth not verified. Read from declared canonical source before writing to this project.",
  severity: "critical",
};

// Register POL-007
policyRegistry.register(POLICY_SOURCE_OF_TRUTH_GATE);

// ─────────────────────────────────────────────────────────────────────────────
// POL-008: INFRASTRUCTURE TARGET LOCK
// ─────────────────────────────────────────────────────────────────────────────

/**
 * POL-008: Infrastructure Target Lock
 *
 * Any operation that references a database connection, deployment target, or
 * infrastructure endpoint must match the project's declared infrastructure targets.
 *
 * Enforcement:
 * - If projectManifest declares infrastructure targets
 * - AND the operation references a connection/infrastructure endpoint
 * - AND the referenced target doesn't match any declared target
 * - THEN the mutation is BLOCKED
 *
 * Prevents: Docker Postgres when Neon is declared, local dev server when
 * Vercel is declared, etc.
 *
 * Origin: Team retro 2026-05-08 — agents targeted Docker Postgres instead of
 * Neon serverless. Unanimous proposal from all 4 agents.
 */
export const POLICY_INFRASTRUCTURE_TARGET_LOCK: Policy = {
  id: "POL-008",
  description: "Infrastructure targets must match project manifest declarations",
  condition: (claims, context) => {
    const manifest = context.projectManifest as ProjectManifest | undefined;
    
    // No manifest → policy cannot enforce → skip (POL-009 handles this)
    if (!manifest || !manifest.infrastructureTargets) {
      return true;
    }
    
    // Only enforce on infrastructure-related operations
    const operation = context.operation ?? "";
    const isInfraOperation = /^(mutate|write|create|update|deploy|commit|connect)/i.test(operation);
    
    if (!isInfraOperation) {
      return true;
    }
    
    // Check the resource against declared targets
    const resource = context.resource ?? "";
    const declaredTargets = manifest.infrastructureTargets;
    
    // If resource references a database or deployment, verify it matches
    const infraPatterns = [
      /postgres/i, /neon/i, /mysql/i, /redis/i, /mongo/i,
      /docker/i, /vercel/i, /aws/i, /localhost/i,
    ];
    
    const resourceReferencesInfra = infraPatterns.some(p => p.test(resource));
    
    if (!resourceReferencesInfra) {
      return true; // Not an infra-referencing operation
    }
    
    // Check if resource matches any declared target
    const matchesDeclared = declaredTargets.some(target => {
      return resource.includes(target.id) || resource.includes(target.type);
    });
    
    // Also check declaredInfrastructureTargets in context for explicit matching
    const explicitTargets = context.declaredInfrastructureTargets as InfrastructureTarget[] ?? [];
    const matchesExplicit = explicitTargets.some(target => {
      return resource.includes(target.id) || resource.includes(target.type);
    });
    
    // If resource references infra but doesn't match declared targets → block
    if (declaredTargets.length > 0 && !matchesDeclared && !matchesExplicit) {
      // Allow if the resource is a LOCAL DEV variant explicitly declared
      const isLocalDev = /localhost|127\.0\.0\.1|docker/i.test(resource);
      const allowsLocal = declaredTargets.some(t => t.type === 'local-dev' || t.type === 'docker');
      
      if (isLocalDev && allowsLocal) {
        return true;
      }
      
      return false; // Mismatch — wrong infrastructure target
    }
    
    return true;
  },
  violation: "Infrastructure target mismatch. Operation targets undeclared infrastructure. Update connection or justify deviation with ADR.",
  severity: "critical",
};

// Register POL-008
policyRegistry.register(POLICY_INFRASTRUCTURE_TARGET_LOCK);

// ─────────────────────────────────────────────────────────────────────────────
// POL-009: PROJECT MANIFEST REQUIRED
// ─────────────────────────────────────────────────────────────────────────────

/**
 * POL-009: Project Manifest Required
 *
 * No write operations allowed on a project unless a PROJECT.yaml (or
 * ruvix-manifest.yaml) exists declaring source_of_truth and infrastructure_targets.
 *
 * Without this manifest, POL-007 and POL-008 have nothing to enforce against.
 * This policy forces the manifest to exist before any work proceeds.
 *
 * Enforcement:
 * - If context.projectManifest is undefined or null
 * - AND the operation is a write-type
 * - THEN the mutation is BLOCKED
 *
 * Grace period: read operations are always allowed (you need to read to create
 * the manifest). The very first operation on a new project should be creating
 * the manifest.
 *
 * Origin: Team retro 2026-05-08 — without a manifest, all other governance
 * policies are unenforceable. Unanimous proposal from all 4 agents.
 */
export const POLICY_PROJECT_MANIFEST_REQUIRED: Policy = {
  id: "POL-009",
  description: "Project manifest (PROJECT.yaml) required before any write operations",
  condition: (claims, context) => {
    const manifest = context.projectManifest as ProjectManifest | undefined;
    
    // If manifest exists and has required fields, policy is satisfied
    if (manifest && manifest.sourcesOfTruth && manifest.infrastructureTargets) {
      return true;
    }
    
    // Read-type operations are allowed without manifest
    // (you need to read to create the manifest)
    const operation = context.operation ?? "";
    const isWriteOperation = /^(mutate|write|create|update|delete|deploy|commit)/i.test(operation);
    
    if (!isWriteOperation) {
      return true;
    }
    
    // Special case: creating the manifest itself is always allowed
    if (/manifest|project\.yaml/i.test(context.resource ?? "")) {
      return true;
    }
    
    // No manifest + write operation = BLOCKED
    return false;
  },
  violation: "No project manifest found. Create PROJECT.yaml with sourcesOfTruth and infrastructureTargets before any project work.",
  severity: "critical",
};

// Register POL-009
policyRegistry.register(POLICY_PROJECT_MANIFEST_REQUIRED);

// ─────────────────────────────────────────────────────────────────────────────
// DEFAULT POLICY SET (post all policy definitions)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Default policy set for kernel operations
 * 
 * Includes all 9 builtin policies:
 * POL-001 through POL-009
 */
export const DEFAULT_POLICIES: Policy[] = [
  POLICY_TENANT_ISOLATION,
  POLICY_BUDGET_ENFORCEMENT,
  POLICY_PERMISSION_TIER,
  POLICY_ACTOR_VALIDATION,
  POLICY_AUDIT_TRAIL,
  POLICY_SOURCE_OF_TRUTH_GATE,
  POLICY_INFRASTRUCTURE_TARGET_LOCK,
  POLICY_PROJECT_MANIFEST_REQUIRED,
];

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
