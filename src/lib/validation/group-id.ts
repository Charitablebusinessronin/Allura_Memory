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
 */
export const RESERVED_GROUP_IDS = ["global", "system", "admin", "public"] as const;
export type ReservedGroupId = (typeof RESERVED_GROUP_IDS)[number];

/**
 * Validation rules for group IDs
 */
export const GROUP_ID_RULES = {
  /** Minimum length for group_id */
  MIN_LENGTH: 2,
  /** Maximum length for group_id */
  MAX_LENGTH: 64,
  /** Allowed characters: lowercase letters, numbers, hyphens, underscores */
  PATTERN: /^[a-z0-9][a-z0-9_-]*[a-z0-9]$/,
} as const;

/**
 * Validate group_id format
 * NFR11 compliance: lowercase-only
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

  // Check for valid characters (alphanumeric, hyphens, underscores)
  if (!GROUP_ID_RULES.PATTERN.test(trimmed)) {
    throw new GroupIdValidationError(
      `group_id must contain only lowercase letters, numbers, hyphens, and underscores. ` +
      `Must start and end with alphanumeric. Got: '${trimmed}'`
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
 * 
 * @param groupId - The group_id to check
 * @returns true if global, false otherwise
 */
export function isGlobalGroupId(groupId: string): boolean {
  return normalizeGroupId(groupId) === "global";
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

  let validated: string;

  if (!allowUppercase) {
    validated = validateGroupId(groupId);
  } else {
    if (typeof groupId !== "string" || groupId.trim().length === 0) {
      throw new GroupIdValidationError("group_id is required and cannot be empty");
    }
    validated = groupId.trim();
  }

  if (!allowReserved && isReservedGroupId(validated)) {
    throw new GroupIdValidationError(
      `group_id '${validated}' is reserved and cannot be used`
    );
  }

  if (customPattern && !customPattern.test(validated)) {
    throw new GroupIdValidationError(
      `group_id '${validated}' does not match required pattern ${customPattern}`
    );
  }

  return validated;
}