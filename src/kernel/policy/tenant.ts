/**
 * RuVix Kernel - Tenant Isolation Policy
 * 
 * Migrated from src/lib/mcp/enforced-client.ts
 * 
 * This module provides tenant isolation enforcement through the kernel.
 * All operations must have a valid allura-* group_id.
 * 
 * DEPRECATION: src/lib/mcp/enforced-client.ts is now deprecated.
 * Use kernel syscalls or SDK wrapper instead.
 */

import { validateGroupId, GroupIdValidationError } from "@/lib/validation/group-id";

// ─────────────────────────────────────────────────────────────────────────────
// CONSTANTS
// ─────────────────────────────────────────────────────────────────────────────

/**
 * ALLURA_PREFIX - Required for all tenant IDs
 * ARCH-001: Enforce allura-* naming convention for tenant isolation
 */
const ALLURA_PREFIX = "allura-";

// ─────────────────────────────────────────────────────────────────────────────
// VALIDATION
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Validate that group_id follows allura-* naming convention
 * ARCH-001 compliance
 * 
 * @param groupId - Group ID to validate
 * @throws GroupIdValidationError if invalid format
 */
export function validateAlluraPrefix(groupId: string): void {
  if (!groupId.startsWith(ALLURA_PREFIX)) {
    throw new GroupIdValidationError(
      `group_id must use allura-* format (found: '${groupId}'). ` +
      `Example: allura-faith-meats`
    );
  }
}

/**
 * Validate group_id for kernel operations
 * 
 * Combines existing validateGroupId() with allura-* prefix check.
 * 
 * @param groupId - Group ID to validate
 * @returns Validated group_id
 * @throws GroupIdValidationError if invalid
 */
export function validateTenantIsolation(groupId: string): string {
  // First validate general format (lowercase, length, etc.)
  const validated = validateGroupId(groupId);
  
  // Then enforce allura-* naming convention
  validateAlluraPrefix(validated);
  
  return validated;
}

// ─────────────────────────────────────────────────────────────────────────────
// TENANT POLICY
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Tenant context for kernel operations
 */
export interface TenantContext {
  /** Validated group_id */
  group_id: string;
  
  /** Tenant name (derived from group_id) */
  tenant_name: string;
  
  /** Platform identifier */
  platform?: string;
  
  /** Additional tenant metadata */
  metadata?: Record<string, unknown>;
}

/**
 * Extract tenant context from group_id
 * 
 * @param groupId - Validated group_id
 * @returns Tenant context
 */
export function extractTenantContext(groupId: string): TenantContext {
  const validated = validateTenantIsolation(groupId);
  
  // Extract tenant name from group_id (e.g., "allura-faith-meats" → "faith-meats")
  const tenantName = validated.replace(ALLURA_PREFIX, "");
  
  return {
    group_id: validated,
    tenant_name: tenantName,
  };
}

/**
 * Build tenant isolation claims for kernel proof
 * 
 * @param groupId - Group ID for isolation
 * @param actor - Actor making the request
 * @param auditContext - Additional audit context
 * @returns Claims object for kernel proof
 */
export function buildTenantIsolationClaims(
  groupId: string,
  actor: string,
  auditContext?: Record<string, unknown>
) {
  const tenantContext = extractTenantContext(groupId);
  
  return {
    group_id: tenantContext.group_id,
    audit_context: {
      tenant_name: tenantContext.tenant_name,
      actor,
      ...auditContext,
    },
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// KERNEL-NATIVE TENANT ENFORCEMENT
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Kernel-native tenant enforcement
 * 
 * This class replaces EnforcedMcpClient with kernel-backed enforcement.
 * All operations flow through RuVix kernel syscalls.
 * 
 * Usage:
 * ```typescript
 * const tenant = new KernelTenantEnforcer('allura-faith-meats', 'agent-001');
 * 
 * // All operations automatically include tenant isolation
 * await tenant.callKernelSyscall('mutate', { ... });
 * ```
 */
export class KernelTenantEnforcer {
  private readonly tenantContext: TenantContext;
  private readonly actor: string;

  constructor(groupId: string, actor: string) {
    this.tenantContext = extractTenantContext(groupId);
    this.actor = actor;
  }

  /**
   * Get validated group_id
   */
  getGroupId(): string {
    return this.tenantContext.group_id;
  }

  /**
   * Get tenant context
   */
  getTenantContext(): TenantContext {
    return { ...this.tenantContext };
  }

  /**
   * Build claims for kernel proof
   * 
   * @param auditContext - Additional audit context
   * @returns Claims object
   */
  buildClaims(auditContext?: Record<string, unknown>) {
    return buildTenantIsolationClaims(
      this.tenantContext.group_id,
      this.actor,
      auditContext
    );
  }

  /**
   * Call a kernel syscall with tenant isolation
   * 
   * @param syscallName - Syscall to invoke
   * @param args - Syscall arguments
   * @returns Syscall result
   */
  async callKernelSyscall(
    syscallName: string,
    args: Record<string, unknown>
  ): Promise<unknown> {
    // Import kernel dynamically to avoid circular dependency
    const { RuVixKernel } = await import("../ruvix");
    
    // Build context with tenant isolation
    const context = {
      actor: this.actor,
      group_id: this.tenantContext.group_id,
      permission_tier: "plugin" as const,
      audit_context: this.buildClaims().audit_context,
    };
    
    // Invoke syscall
    return RuVixKernel.syscall(syscallName, args, context);
  }
}

/**
 * Factory function to create kernel tenant enforcer
 * 
 * @param groupId - Tenant group ID
 * @param actor - Actor identifier
 * @returns KernelTenantEnforcer instance
 */
export function createKernelTenantEnforcer(
  groupId: string,
  actor: string
): KernelTenantEnforcer {
  return new KernelTenantEnforcer(groupId, actor);
}

// ─────────────────────────────────────────────────────────────────────────────
// BACKWARD COMPATIBILITY WRAPPER
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Backward compatibility wrapper for EnforcedMcpClient migration
 * 
 * This allows gradual migration from EnforcedMcpClient to kernel-native enforcement.
 * 
 * @deprecated Use KernelTenantEnforcer or kernel SDK directly
 */
export class EnforcedClientCompatWrapper {
  private readonly enforcer: KernelTenantEnforcer;

  constructor(groupId: string, actor: string) {
    this.enforcer = createKernelTenantEnforcer(groupId, actor);
  }

  /**
   * Get validated group_id
   */
  getGroupId(): string {
    return this.enforcer.getGroupId();
  }

  /**
   * Call kernel syscall (replaces callTool)
   */
  async callKernelSyscall(
    syscallName: string,
    args: Record<string, unknown>
  ): Promise<unknown> {
    return this.enforcer.callKernelSyscall(syscallName, args);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// EXPORTS
// ─────────────────────────────────────────────────────────────────────────────

export { validateGroupId, GroupIdValidationError };
