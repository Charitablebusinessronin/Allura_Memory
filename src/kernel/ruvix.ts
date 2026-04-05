/**
 * RuVix Kernel - Core Orchestrator
 * 
 * The L1 kernel for Allura Agent-OS.
 * Provides proof-gated mutation and zero-trust enforcement.
 * 
 * 6 PRIMITIVES:
 * - mutate: State change (requires proof)
 * - attest: Cryptographic proof of state
 * - verify: Validate proof/attestation
 * - isolate: Tenant boundary enforcement
 * - sandbox: Execution isolation
 * - audit: Append-only trace logging
 * 
 * GOVERNANCE RULE: Allura governs. Runtimes execute. Curators promote.
 */

import {
  ProofOfIntent,
  ProofClaims,
  createProof,
  verifyProof,
  verifyProofOrThrow,
  getKernelSecretKey,
  validateKernelSecret,
} from "./proof";
import {
  Policy,
  PolicyContext,
  PolicyEvaluationResult,
  evaluatePolicies,
  evaluatePoliciesOrThrow,
  DEFAULT_POLICIES,
  POLICY_TENANT_ISOLATION,
  POLICY_BUDGET_ENFORCEMENT,
  POLICY_PERMISSION_TIER,
  POLICY_ACTOR_VALIDATION,
  POLICY_AUDIT_TRAIL,
  policyRegistry,
  createTenantPolicies,
} from "./policy";
import {
  SyscallResult,
  SyscallContext,
  MutationRequest,
  QueryRequest,
  syscall_mutate,
  syscall_query,
  syscall_spawn,
  syscall_kill,
  syscall_trace,
  syscall_budget,
  syscall_policy,
  syscall_attest,
  syscall_verify,
  syscall_isolate,
  syscall_sandbox,
  syscall_audit,
  syscallTable,
  getAvailableSyscalls,
} from "./syscalls";

// ─────────────────────────────────────────────────────────────────────────────
// KERNEL VERSION
// ─────────────────────────────────────────────────────────────────────────────

export const KERNEL_VERSION = "1.0.0-alpha";
export const KERNEL_BUILD = "ruvix-l1-core";

// ─────────────────────────────────────────────────────────────────────────────
// KERNEL INITIALIZATION
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Kernel initialization status
 */
export interface KernelStatus {
  /** Whether kernel is initialized */
  initialized: boolean;
  
  /** Kernel version */
  version: string;
  
  /** Secret key configured */
  secretConfigured: boolean;
  
  /** Available syscalls */
  syscalls: string[];
  
  /** Registered policies count */
  policies: number;
  
  /** Any initialization errors */
  errors: string[];
}

/**
 * Initialize the RuVix kernel
 * 
 * Must be called before any kernel operations.
 * Validates environment, loads policies, and prepares syscalls.
 * 
 * @returns Kernel status
 */
export function initializeKernel(): KernelStatus {
  const errors: string[] = [];
  
  // Check 1: Secret key
  const secretConfigured = validateKernelSecret();
  if (!secretConfigured) {
    errors.push(
      "RUVIX_KERNEL_SECRET environment variable is not configured. " +
      "Kernel cannot operate without cryptographic proof verification."
    );
  }
  
  // Check 2: Syscall table
  const syscalls = getAvailableSyscalls();
  if (syscalls.length !== 12) {
    errors.push(`Expected 12 syscalls, found ${syscalls.length}`);
  }
  
  // Check 3: Policy registry
  const policies = policyRegistry.getAll().length;
  if (policies < 5) {
    errors.push(`Expected at least 5 default policies, found ${policies}`);
  }
  
  return {
    initialized: errors.length === 0,
    version: KERNEL_VERSION,
    secretConfigured,
    syscalls,
    policies,
    errors,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// THE 6 PRIMITIVES
// ─────────────────────────────────────────────────────────────────────────────

/**
 * PRIMITIVE 1: mutate
 * 
 * State change with proof-gated enforcement.
 * This is the LINCHPIN primitive - every state change flows through here.
 * 
 * @param request - Mutation request
 * @param context - Syscall context
 * @returns Mutation result
 */
export async function mutate(
  request: MutationRequest,
  context: SyscallContext
): Promise<SyscallResult> {
  return syscall_mutate(request, context);
}

/**
 * PRIMITIVE 2: attest
 * 
 * Create cryptographic proof of state.
 * 
 * @param state - State to attest
 * @param context - Syscall context
 * @returns Attestation result
 */
export async function attest(
  state: unknown,
  context: SyscallContext
): Promise<SyscallResult> {
  return syscall_attest(state, context);
}

/**
 * PRIMITIVE 3: verify
 * 
 * Validate proof or attestation.
 * 
 * @param attestation - Attestation to verify
 * @param context - Syscall context
 * @returns Verification result
 */
export async function verify(
  attestation: string,
  context: SyscallContext
): Promise<SyscallResult> {
  return syscall_verify(attestation, context);
}

/**
 * PRIMITIVE 4: isolate
 * 
 * Enforce tenant isolation boundary.
 * 
 * @param groupId - Group to isolate
 * @param context - Syscall context
 * @returns Isolation result
 */
export async function isolate(
  groupId: string,
  context: SyscallContext
): Promise<SyscallResult> {
  return syscall_isolate(groupId, context);
}

/**
 * PRIMITIVE 5: sandbox
 * 
 * Execute code in sandboxed environment.
 * 
 * @param code - Code to execute
 * @param context - Syscall context
 * @returns Sandbox result
 */
export async function sandbox(
  code: string,
  context: SyscallContext
): Promise<SyscallResult> {
  return syscall_sandbox(code, context);
}

/**
 * PRIMITIVE 6: audit
 * 
 * Query append-only audit trail.
 * 
 * @param query - Audit query
 * @param context - Syscall context
 * @returns Audit result
 */
export async function audit(
  query: { startTime?: number; endTime?: number; actor?: string; intent?: string },
  context: SyscallContext
): Promise<SyscallResult> {
  return syscall_audit(query, context);
}

// ─────────────────────────────────────────────────────────────────────────────
// SYSCALL DISPATCH
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Execute a syscall by name
 * 
 * @param name - Syscall name
 * @param args - Syscall arguments
 * @returns Syscall result
 */
export async function syscall(
  name: string,
  ...args: unknown[]
): Promise<SyscallResult> {
  const fn = syscallTable[name];
  
  if (!fn) {
    return {
      success: false,
      error: `Unknown syscall: ${name}. Available: ${getAvailableSyscalls().join(", ")}`,
    };
  }
  
  return fn(...args);
}

// ─────────────────────────────────────────────────────────────────────────────
// KERNEL EXPORTS
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Full kernel API export
 */
export const RuVixKernel = {
  // Initialization
  initializeKernel,
  KERNEL_VERSION,
  KERNEL_BUILD,
  
  // 6 Primitives
  mutate,
  attest,
  verify,
  isolate,
  sandbox,
  audit,
  
  // Syscall dispatch
  syscall,
  getAvailableSyscalls,
  
  // Proof engine (exported for SDK wrapper)
  createProof,
  verifyProof,
  verifyProofOrThrow,
  getKernelSecretKey,
  validateKernelSecret,
  
  // Policy engine (exported for SDK wrapper)
  evaluatePolicies,
  evaluatePoliciesOrThrow,
  DEFAULT_POLICIES,
  policyRegistry,
  createTenantPolicies,
  
  // Policy constants
  POLICY_TENANT_ISOLATION,
  POLICY_BUDGET_ENFORCEMENT,
  POLICY_PERMISSION_TIER,
  POLICY_ACTOR_VALIDATION,
  POLICY_AUDIT_TRAIL,
};

// ─────────────────────────────────────────────────────────────────────────────
// DEFAULT EXPORT
// ─────────────────────────────────────────────────────────────────────────────

export default RuVixKernel;
