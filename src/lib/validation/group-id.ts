/**
 * Group ID Validation Utilities
 * Story 1.5: Enforce Tenant Isolation with group_ids
 * 
 * Validates group_id format and ensures NFR11 compliance (lowercase-only).
 */

/**
 * Validation error for invalid group IDs
 */
export class GroupIdValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "GroupIdValidationError";
  }
}

/**
 * Reserved group IDs that have special meaning
 * ARCH-001: These are now prefixed with allura- (e.g., allura-global, allura-system)
 */
export const RESERVED_GROUP_IDS = ["allura-global", "allura-system", "allura-admin", "allura-public"] as const;
export type ReservedGroupId = (typeof RESERVED_GROUP_IDS)[number];

/**
 * Validation rules for group IDs
 *
 * ARCH-001: All group_ids MUST match ^allura-[a-z0-9-]+$ for tenant isolation.
 */
export const GROUP_ID_RULES = {
  /** Minimum length for group_id */
  MIN_LENGTH: 2,
  /** Maximum length for group_id */
  MAX_LENGTH: 64,
  /**
   * Required pattern: allura-* naming convention.
   * ARCH-001: Enforced at all entry points to prevent tenant isolation bypass.
   */
  PATTERN: /^allura-[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/,
  /** Legacy pattern (pre-ARCH-001) — used only by validateGroupIdWithRules */
  LEGACY_PATTERN: /^[a-z0-9][a-z0-9_-]*[a-z0-9]$/,
} as const;

/**
 * Validate group_id format
 * ARCH-001: Enforces ^allura- prefix for tenant isolation.
 * NFR11 compliance: lowercase-only.
 *
 * @param groupId - The group_id to validate
 * @throws GroupIdValidationError if validation fails
 */
export function validateGroupId(groupId: unknown): string {
  // Check for null/undefined
  if (groupId === null || groupId === undefined) {
    throw new GroupIdValidationError("group_id is required and cannot be null or undefined");
  }

  // Check for empty string
  if (typeof groupId !== "string") {
    throw new GroupIdValidationError(
      `group_id must be a string, got ${typeof groupId}`
    );
  }

  const trimmed = groupId.trim();

  // Check for whitespace-only
  if (trimmed.length === 0) {
    throw new GroupIdValidationError("group_id cannot be empty or whitespace-only");
  }

  // Check for uppercase characters (NFR11)
  if (/[A-Z]/.test(trimmed)) {
    throw new GroupIdValidationError(
      `group_id must be lowercase only (NFR11): '${trimmed}' contains uppercase characters. ` +
      `Use '${trimmed.toLowerCase()}' instead.`
    );
  }

  // Check length
  if (trimmed.length < GROUP_ID_RULES.MIN_LENGTH) {
    throw new GroupIdValidationError(
      `group_id must be at least ${GROUP_ID_RULES.MIN_LENGTH} characters, got ${trimmed.length}`
    );
  }

  if (trimmed.length > GROUP_ID_RULES.MAX_LENGTH) {
    throw new GroupIdValidationError(
      `group_id must be at most ${GROUP_ID_RULES.MAX_LENGTH} characters, got ${trimmed.length}`
    );
  }

  // ARCH-001: Enforce allura-* naming convention
  if (!GROUP_ID_RULES.PATTERN.test(trimmed)) {
    throw new GroupIdValidationError(
      `Invalid group_id: must match pattern allura-* (e.g., allura-myproject). Got: '${trimmed}'`
    );
  }

  return trimmed;
}

/**
 * Normalize a group_id to lowercase and trim whitespace
 *
 * @param groupId - The group_id to normalize
 * @returns Normalized group_id
 */
export function normalizeGroupId(groupId: string): string {
  if (!groupId || typeof groupId !== 'string') return '';
  return groupId.trim().toLowerCase();
}

/**
 * Check if a group_id is valid without throwing
 *
 * @param groupId - The group_id to check
 * @returns true if valid, false otherwise
 */
export function isValidGroupId(groupId: unknown): boolean {
  try {
    validateGroupId(groupId);
    return true;
  } catch {
    return false;
  }
}

/**
 * Check if a group_id is a reserved ID
 * ARCH-001: Reserved IDs are now allura-prefixed (allura-global, allura-system, etc.)
 *
 * @param groupId - The group_id to check
 * @returns true if reserved, false otherwise
 */
export function isReservedGroupId(groupId: string): boolean {
  const normalized = normalizeGroupId(groupId);
  return RESERVED_GROUP_IDS.includes(normalized as ReservedGroupId);
}

/**
 * Check if a group_id is the global context ID
 * ARCH-001: Global ID is now allura-global
 *
 * @param groupId - The group_id to check
 * @returns true if global, false otherwise
 */
export function isGlobalGroupId(groupId: string): boolean {
  return normalizeGroupId(groupId) === "allura-global";
}

/**
 * Validate multiple group_ids and return valid ones
 * 
 * @param groupIds - Array of group_ids to validate
 * @returns Object with valid group_ids and errors
 */
export function validateGroupIds(
  groupIds: unknown[]
): { valid: string[]; errors: Array<{ value: unknown; error: string }> } {
  const valid: string[] = [];
  const errors: Array<{ value: unknown; error: string }> = [];

  for (const groupId of groupIds) {
    try {
      const validated = validateGroupId(groupId);
      valid.push(validated);
    } catch (error) {
      if (error instanceof GroupIdValidationError) {
        errors.push({ value: groupId, error: error.message });
      } else {
        errors.push({ value: groupId, error: "Unknown validation error" });
      }
    }
  }

  return { valid, errors };
}

/**
 * Assert that a group_id is valid (throws if not)
 * Use in functions that require valid group_id
 * 
 * @param groupId - The group_id to assert
 * @returns The validated group_id
 * @throws GroupIdValidationError if invalid
 */
export function assertValidGroupId(groupId: unknown): asserts groupId is string {
  validateGroupId(groupId);
}

/**
 * Create a validated group_id wrapper
 * Ensures the group_id is always valid at construction time
 */
export class ValidGroupId {
  private readonly _value: string;

  constructor(value: unknown) {
    this._value = validateGroupId(value);
  }

  get value(): string {
    return this._value;
  }

  toString(): string {
    return this._value;
  }

  equals(other: ValidGroupId | string): boolean {
    if (typeof other === "string") {
      return this._value === normalizeGroupId(other);
    }
    return this._value === other._value;
  }

  isGlobal(): boolean {
    return isGlobalGroupId(this._value);
  }

  isReserved(): boolean {
    return isReservedGroupId(this._value);
  }
}

/**
 * Validate group_id with custom rules
 * Useful for specific use cases like internal IDs
 *
 * ARCH-001: Default validation now enforces allura- prefix.
 * Use customPattern to override (e.g., for legacy compatibility).
 *
 * @param groupId - The group_id to validate
 * @param options - Custom validation options
 * @returns Validated group_id
 */
export function validateGroupIdWithRules(
  groupId: unknown,
  options: {
    allowUppercase?: boolean;
    allowReserved?: boolean;
    customPattern?: RegExp;
  }
): string {
  const { allowUppercase = false, allowReserved = false, customPattern } = options;

  if (groupId === null || groupId === undefined) {
    throw new GroupIdValidationError("group_id is required and cannot be null or undefined");
  }

  if (typeof groupId !== "string") {
    throw new GroupIdValidationError(
      `group_id must be a string, got ${typeof groupId}`
    );
  }

  let validated = groupId.trim();

  if (validated.length === 0) {
    throw new GroupIdValidationError("group_id cannot be empty or whitespace-only");
  }

  if (!allowUppercase && /[A-Z]/.test(validated)) {
    throw new GroupIdValidationError(
      `group_id must be lowercase only (NFR11): '${validated}' contains uppercase characters. ` +
      `Use '${validated.toLowerCase()}' instead.`
    );
  }

  if (!allowReserved && isReservedGroupId(validated)) {
    throw new GroupIdValidationError(
      `group_id '${validated}' is reserved and cannot be used`
    );
  }

  const pattern = customPattern || GROUP_ID_RULES.PATTERN;
  const patternInput = allowUppercase ? validated.toLowerCase() : validated;
  if (!pattern.test(patternInput)) {
    throw new GroupIdValidationError(
      `group_id '${validated}' does not match required pattern ${pattern}`
    );
  }

  return validated;
}