/**
 * Tenant Group ID Validation
 * ARCH-001: Enforce allura-{org} tenant naming convention
 * 
 * All tenant group_ids MUST match the pattern: allura-{org}
 * This ensures proper multi-tenant isolation across the platform.
 */

import { validateGroupId, GroupIdValidationError } from './group-id';

/**
 * Valid Allura workspace prefixes
 */
export const ALLURA_WORKSPACES = [
  'allura-faith-meats',
  'allura-creative',
  'allura-personal',
  'allura-nonprofit',
  'allura-audits',
  'allura-haccp',
  'allura-default', // Development/testing
] as const;

export type AlluraWorkspace = (typeof ALLURA_WORKSPACES)[number];

/**
 * Error code for tenant isolation violations
 */
export const TENANT_ERROR_CODE = 'RK-01' as const;

/**
 * Validate that group_id follows allura-{org} naming convention
 * 
 * @param groupId - The group_id to validate
 * @returns Validated group_id
 * @throws GroupIdValidationError with code RK-01 if invalid
 */
export function validateTenantGroupId(groupId: unknown): string {
  // First apply base validation
  const validated = validateGroupId(groupId);

  // Enforce allura-{org} pattern
  const alluraPattern = /^allura-[a-z0-9-]+$/;
  
  if (!alluraPattern.test(validated)) {
    throw new GroupIdValidationError(
      `RK-01: Invalid group_id format: "${validated}". ` +
      `Tenant group_ids must match pattern: allura-{org} ` +
      `(e.g., allura-faith-meats, allura-creative). ` +
      `Valid workspaces: ${ALLURA_WORKSPACES.join(', ')}`
    );
  }

  return validated;
}

/**
 * Check if group_id is a known Allura workspace
 * 
 * @param groupId - The group_id to check
 * @returns true if known workspace, false otherwise
 */
export function isKnownWorkspace(groupId: string): boolean {
  const normalized = groupId.trim().toLowerCase();
  return ALLURA_WORKSPACES.includes(normalized as AlluraWorkspace);
}

/**
 * Validate and check is known workspace
 * 
 * @param groupId - The group_id to validate
 * @returns Validated group_id
 * @throws GroupIdValidationError if not known workspace
 */
export function validateKnownWorkspace(groupId: unknown): string {
  const validated = validateTenantGroupId(groupId);

  if (!isKnownWorkspace(validated)) {
    throw new GroupIdValidationError(
      `Unknown workspace: "${validated}". ` +
      `Allowed workspaces: ${ALLURA_WORKSPACES.join(', ')}`
    );
  }

  return validated;
}