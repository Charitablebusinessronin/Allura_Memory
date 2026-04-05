/**
 * Sanitization Engine - Cross-Organization Knowledge Sharing
 * Story 4.1: Remove tenant identifiers before promoting insights
 * 
 * This module sanitizes tenant-specific data before promotion to
 * platform-wide knowledge library, ensuring cross-tenant isolation
 * while preserving structural patterns.
 * 
 * Workflow:
 * 1. Remove tenant identifiers (group_id, agent_id, workflow_id, session_id, file paths)
 * 2. Anonymize sensitive data (emails, phone numbers, names, custom fields)
 * 3. Create abstracted patterns (replace concrete values with abstract types)
 * 4. Validate sanitization (check no original identifiers remain)
 */

import { createHash, randomUUID } from "crypto";

/**
 * Result of sanitization operation
 */
export interface SanitizationResult {
  /** Sanitized data with tenant identifiers removed */
  sanitized: Record<string, unknown>;
  /** List of fields that were removed */
  removed: string[];
  /** Warning messages about potential issues */
  warnings: string[];
}

/**
 * Options for sanitization behavior
 */
export interface SanitizationOptions {
  /** Remove tenant IDs (group_id, agent_id, workflow_id, session_id) */
  removeTenantIds?: boolean;
  /** Fields to anonymize (in addition to defaults) */
  anonymizeFields?: string[];
  /** Preserve object structure (use null placeholders) */
  preserveStructure?: boolean;
}

/**
 * Anonymization method for sensitive fields
 */
export type AnonymizationMethod = "hash" | "tokenize" | "redact";

/**
 * Token map for consistent anonymization within a session
 */
interface TokenMap {
  emails: Map<string, string>;
  phones: Map<string, string>;
  names: Map<string, string>;
  custom: Map<string, Map<string, string>>;
}

/**
 * Create empty token map
 */
function createTokenMap(): TokenMap {
  return {
    emails: new Map(),
    phones: new Map(),
    names: new Map(),
    custom: new Map(),
  };
}

/**
 * Hash a value using SHA-256
 */
function hashValue(value: string): string {
  return createHash("sha256").update(value).digest("hex").slice(0, 16);
}

/**
 * Generate a token (UUID-based)
 */
function generateToken(prefix: string): string {
  return `${prefix}_${randomUUID().slice(0, 8)}`;
}

/**
 * Check if a string looks like a tenant file path
 * Matches patterns like: /org-name/, /company/, /tenant/
 */
function isTenantFilePath(value: string): boolean {
  const tenantPathPatterns = [
    /\/allura-[a-z0-9-]+\//i,
    /\/org-[a-z0-9-]+\//i,
    /\/company-[a-z0-9-]+\//i,
    /\/tenant-[a-z0-9-]+\//i,
    /\/workspace-[a-z0-9-]+\//i,
    /\/client-[a-z0-9-]+\//i,
  ];

  return tenantPathPatterns.some((pattern) => pattern.test(value));
}

/**
 * Check if a string looks like an email address
 */
function isEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

/**
 * Check if a string looks like a phone number
 */
function isPhoneNumber(value: string): boolean {
  // Match various phone formats: +1-555-123-4567, (555) 123-4567, 555.123.4567
  return /^[+]?[(]?[0-9]{1,3}[)]?[-\s.]?[0-9]{1,4}[-\s.]?[0-9]{1,4}[-\s.]?[0-9]{1,9}$/.test(
    value.trim()
  );
}

/**
 * Check if a string looks like a person's name (heuristic)
 */
function isName(value: string): boolean {
  // Names typically: 2-50 chars, letters/spaces/hyphens, title case
  const trimmed = value.trim();
  if (trimmed.length < 2 || trimmed.length > 50) return false;
  if (!/^[A-Z][a-z]+(\s+[A-Z][a-z]+)*$/.test(trimmed)) return false;
  return true;
}

/**
 * Remove tenant identifiers from data
 * 
 * @param data - Data to sanitize
 * @param options - Sanitization options
 * @returns Sanitized data with identifiers removed
 */
export function removeTenantIdentifiers(
  data: unknown,
  options: SanitizationOptions = {}
): unknown {
  if (data === null || data === undefined) {
    return data;
  }

  if (typeof data !== "object") {
    return data;
  }

  if (Array.isArray(data)) {
    return data.map((item) => removeTenantIdentifiers(item, options));
  }

  const obj = data as Record<string, unknown>;
  const result: Record<string, unknown> = {};
  const preserveStructure = options.preserveStructure ?? true;

  for (const [key, value] of Object.entries(obj)) {
    // Remove tenant identifier fields
    if (key === "group_id" || key === "agent_id" || key === "workflow_id" || key === "session_id") {
      if (options.removeTenantIds !== false) {
        continue; // Remove entirely
      }
    }

    // Check for file paths containing org names
    if (typeof value === "string" && isTenantFilePath(value)) {
      if (options.preserveStructure) {
        result[key] = null;
      }
      continue;
    }

    // Recursively process nested objects
    if (value !== null && typeof value === "object") {
      result[key] = removeTenantIdentifiers(value, options);
    } else {
      result[key] = value;
    }
  }

  return result;
}

/**
 * Anonymize sensitive data using specified method
 * 
 * @param params - Anonymization parameters
 * @returns Anonymized data
 */
export function anonymizeSensitiveData(params: {
  data: Record<string, unknown>;
  fields: string[];
  method: AnonymizationMethod;
  tokenMap?: TokenMap;
}): Record<string, unknown> {
  const { data, fields, method, tokenMap = createTokenMap() } = params;

  // Build reverse lookup for custom fields
  if (!tokenMap.custom.has("__fields__")) {
    tokenMap.custom.set("__fields__", new Map());
  }
  const fieldTokenMap = tokenMap.custom.get("__fields__")!;

  /**
   * Anonymize a single value
   */
  function anonymizeValue(key: string, value: unknown): unknown {
    if (value === null || value === undefined) {
      return value;
    }

    if (typeof value !== "string") {
      // For non-string values in specified fields, redact
      if (fields.includes(key)) {
        return method === "redact" ? "[REDACTED]" : hashValue(String(value));
      }
      return value;
    }

    // Email anonymization
    if (isEmail(value)) {
      if (method === "hash") {
        return `email_anonymized:${hashValue(value)}`;
      }
      if (method === "tokenize") {
        let token = tokenMap.emails.get(value);
        if (!token) {
          token = generateToken("email");
          tokenMap.emails.set(value, token);
        }
        return token;
      }
      return "[EMAIL REDACTED]";
    }

    // Phone anonymization
    if (isPhoneNumber(value)) {
      if (method === "hash") {
        return `phone_anonymized:${hashValue(value)}`;
      }
      if (method === "tokenize") {
        let token = tokenMap.phones.get(value);
        if (!token) {
          token = generateToken("phone");
          tokenMap.phones.set(value, token);
        }
        return token;
      }
      return "[PHONE REDACTED]";
    }

    // Custom field anonymization
    if (fields.includes(key)) {
      if (method === "hash") {
        return hashValue(value);
      }
      if (method === "tokenize") {
        let token = fieldTokenMap.get(value);
        if (!token) {
          token = generateToken(key.replace(/[^a-z0-9]/gi, "").toLowerCase());
          fieldTokenMap.set(value, token);
        }
        return token;
      }
      return "[REDACTED]";
    }

    return value;
  }

  /**
   * Recursively process object
   */
  function processObject(obj: Record<string, unknown>): Record<string, unknown> {
    const result: Record<string, unknown> = {};

    for (const [key, value] of Object.entries(obj)) {
      if (value !== null && typeof value === "object") {
        if (Array.isArray(value)) {
          result[key] = value.map((item) =>
            typeof item === "object" && item !== null
              ? processObject(item as Record<string, unknown>)
              : anonymizeValue(key, item)
          );
        } else {
          result[key] = processObject(value as Record<string, unknown>);
        }
      } else {
        result[key] = anonymizeValue(key, value);
      }
    }

    return result;
  }

  return processObject(data);
}

/**
 * Create abstracted pattern from insight
 * Replaces concrete values with abstract types while preserving structure
 * 
 * @param params - Pattern creation parameters
 * @returns Abstracted pattern
 */
export function createAbstractPattern(params: {
  insight: Record<string, unknown>;
}): Record<string, unknown> {
  const { insight } = params;

  /**
   * Abstract a single value
   */
  function abstractValue(value: unknown): { abstracted: unknown; type: string } {
    if (value === null) return { abstracted: null, type: "null" };
    if (value === undefined) return { abstracted: undefined, type: "undefined" };

    if (typeof value === "string") {
      // Abstract identifiable strings
      if (isEmail(value)) return { abstracted: "{{EMAIL}}", type: "email" };
      if (isPhoneNumber(value)) return { abstracted: "{{PHONE}}", type: "phone" };
      if (/^https?:\/\//.test(value)) return { abstracted: "{{URL}}", type: "url" };
      if (/^\d{4}-\d{2}-\d{2}/.test(value)) return { abstracted: "{{DATE}}", type: "date" };
      if (/^allura-/.test(value)) return { abstracted: "{{TENANT_ID}}", type: "tenant" };
      if (/agent\.[a-z]+/.test(value)) return { abstracted: "{{AGENT_ID}}", type: "agent" };

      // Generic string
      return { abstracted: "{{STRING}}", type: "string" };
    }

    if (typeof value === "number") {
      if (Number.isInteger(value)) return { abstracted: "{{INTEGER}}", type: "integer" };
      return { abstracted: "{{NUMBER}}", type: "number" };
    }

    if (typeof value === "boolean") {
      return { abstracted: "{{BOOLEAN}}", type: "boolean" };
    }

    if (typeof value === "object") {
      if (Array.isArray(value)) {
        return { abstracted: value.map(abstractValue), type: "array" };
      }
      return { abstracted: abstractObject(value as Record<string, unknown>), type: "object" };
    }

    return { abstracted: value, type: "unknown" };
  }

  /**
   * Abstract an object's values
   */
  function abstractObject(obj: Record<string, unknown>): Record<string, unknown> {
    const result: Record<string, unknown> = {};

    for (const [key, value] of Object.entries(obj)) {
      // Keep structure but abstract values
      const { abstracted } = abstractValue(value);
      result[key] = abstracted;
    }

    return result;
  }

  return abstractObject(insight);
}

/**
 * Validate that sanitization was successful
 * Checks that no original tenant identifiers remain
 * 
 * @param params - Validation parameters
 * @returns true if validation passes, false otherwise
 */
export function validateSanitization(params: {
  sanitized: Record<string, unknown>;
  group_id: string;
}): boolean {
  const { sanitized, group_id } = params;

  /**
   * Recursively check for tenant identifiers
   */
  function checkForTenantIdentifiers(obj: unknown, path: string): string[] {
    const violations: string[] = [];

    if (obj === null || obj === undefined) {
      return violations;
    }

    if (typeof obj !== "object") {
      // Check string values for tenant patterns
      if (typeof obj === "string") {
        // Check for original group_id
        if (obj === group_id) {
          violations.push(`${path}: contains original group_id "${group_id}"`);
        }

        // Check for allura-* patterns (tenant identifiers)
        if (/allura-[a-z0-9-]+/.test(obj)) {
          violations.push(`${path}: contains tenant identifier pattern`);
        }

        // Check for email patterns that weren't anonymized
        if (isEmail(obj) && !obj.includes("anonymized") && !obj.startsWith("[EMAIL")) {
          violations.push(`${path}: contains unanonymized email`);
        }

        // Check for phone patterns that weren't anonymized
        if (isPhoneNumber(obj) && !obj.includes("anonymized") && !obj.startsWith("[PHONE")) {
          violations.push(`${path}: contains unanonymized phone`);
        }

        // Check for file paths with org names
        if (isTenantFilePath(obj)) {
          violations.push(`${path}: contains tenant file path`);
        }
      }
      return violations;
    }

    if (Array.isArray(obj)) {
      for (let i = 0; i < obj.length; i++) {
        violations.push(...checkForTenantIdentifiers(obj[i], `${path}[${i}]`));
      }
      return violations;
    }

    const record = obj as Record<string, unknown>;

    // Check for identifier fields that should have been removed
    const tenantIdFields = ["group_id", "agent_id", "workflow_id", "session_id"];
    for (const field of tenantIdFields) {
      if (field in record && record[field] !== undefined && record[field] !== null) {
        violations.push(`${path}.${field}: tenant identifier field should have been removed`);
      }
    }

    // Recursively check nested objects
    for (const [key, value] of Object.entries(record)) {
      violations.push(...checkForTenantIdentifiers(value, `${path}.${key}`));
    }
      return violations;
    }

    const record = obj as Record<string, unknown>;

    // Check for identifier fields that should have been removed
    const tenantIdFields = ["group_id", "agent_id", "workflow_id", "session_id"];
    for (const field of tenantIdFields) {
      if (field in record && record[field] !== undefined && record[field] !== null) {
        violations.push(`${path}.${field}: tenant identifier field should have been removed`);
      }
    }

    // Recursively check nested objects
    for (const [key, value] of Object.entries(record)) {
      violations.push(...checkForTenantIdentifiers(value, `${path}.${key}`));
    }

    return violations;
  }

  const violations = checkForTenantIdentifiers(sanitized, "root");

  if (violations.length > 0) {
    console.warn("Sanitization validation failed:", violations);
    return false;
  }

  return true;
}

/**
 * Main sanitization function for promotion workflow
 * Combines all sanitization steps
 * 
 * @param params - Sanitization parameters
 * @returns Sanitization result with sanitized data and metadata
 */
export async function sanitizeForPromotion(params: {
  data: Record<string, unknown>;
  group_id: string;
  options?: SanitizationOptions;
}): Promise<SanitizationResult> {
  const { data, group_id, options = {} } = params;

  const removed: string[] = [];
  const warnings: string[] = [];
  const tokenMap = createTokenMap();

  // Track what gets removed
  const fieldsToCheck = [
    "group_id",
    "agent_id",
    "workflow_id",
    "session_id",
  ];

  // Step 1: Remove tenant identifiers
  const afterRemoval = removeTenantIdentifiers(data, {
    removeTenantIds: options.removeTenantIds ?? true,
    preserveStructure: options.preserveStructure ?? true,
  }) as Record<string, unknown>;

  // Track removed fields
  if (options.removeTenantIds !== false) {
    for (const field of fieldsToCheck) {
      if (field in data) {
        removed.push(field);
      }
    }
  }

  // Check for file paths
  function findFilePaths(obj: unknown, path: string): void {
    if (typeof obj === "string" && isTenantFilePath(obj)) {
      removed.push(`${path}: ${obj}`);
    } else if (obj !== null && typeof obj === "object") {
      if (Array.isArray(obj)) {
        obj.forEach((item, i) => findFilePaths(item, `${path}[${i}]`));
      } else {
        Object.entries(obj as Record<string, unknown>).forEach(([k, v]) =>
          findFilePaths(v, `${path}.${k}`)
        );
      }
    }
  }
  findFilePaths(data, "data");

  // Step 2: Anonymize sensitive data
  const defaultSensitiveFields = ["email", "phone", "name", "username"];
  const allFields = [...defaultSensitiveFields, ...(options.anonymizeFields ?? [])];

  // Find additional sensitive fields in data
  function findSensitiveFields(obj: unknown, fields: Set<string>): void {
    if (obj !== null && typeof obj === "object") {
      if (Array.isArray(obj)) {
        obj.forEach((item) => findSensitiveFields(item, fields));
      } else {
        Object.keys(obj as Record<string, unknown>).forEach((key) => {
          if (key.toLowerCase().includes("email") ||
              key.toLowerCase().includes("phone") ||
              key.toLowerCase().includes("name") ||
              key.toLowerCase().includes("user")) {
            fields.add(key);
          }
        });
        Object.values(obj as Record<string, unknown>).forEach((v) => findSensitiveFields(v, fields));
      }
    }
  }
  const detectedFields = new Set<string>();
  findSensitiveFields(data, detectedFields);
  const fieldsToAnonymize = [...new Set([...allFields, ...detectedFields])];

  const afterAnonymization = anonymizeSensitiveData({
    data: afterRemoval,
    fields: fieldsToAnonymize,
    method: "hash",
    tokenMap,
  });

  // Add warnings for detected sensitive fields not in original list
  detectedFields.forEach((field) => {
    if (!allFields.includes(field) && !field.startsWith("_")) {
      warnings.push(`Detected sensitive field "${field}" that may need anonymization`);
    }
  });

  // Step 3: Validate sanitization
  const isValid = validateSanitization({
    sanitized: afterAnonymization,
    group_id,
  });

  if (!isValid) {
    warnings.push("Sanitization validation found remaining tenant identifiers");
  }

  return {
    sanitized: afterAnonymization,
    removed,
    warnings,
  };
}