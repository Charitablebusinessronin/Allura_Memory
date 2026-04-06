/**
 * Sanitization Types
 * Story 4-1: Sanitization Engine
 */

/**
 * Sanitization rule types
 */
export type SanitizationRuleType = 
  | 'tenant_identifier'
  | 'email'
  | 'phone'
  | 'name'
  | 'workspace'
  | 'id'
  | 'url'
  | 'custom';

/**
 * Sanitization strategy
 */
export type SanitizationStrategy = 
  | 'redact'        // Replace with [REDACTED]
  | 'hash'          // One-way hash
  | 'generalize'    // Replace with generic value
  | 'abstract';     // Replace with abstracted pattern

/**
 * Sanitization rule
 */
export interface SanitizationRule {
  type: SanitizationRuleType;
  pattern: RegExp;
  strategy: SanitizationStrategy;
  replacement: string;
  description: string;
}

/**
 * Sanitization result
 */
export interface SanitizationResult {
  original: string;
  sanitized: string;
  rules: string[];
  violations: SanitizationViolation[];
  is_clean: boolean;
}

/**
 * Sanitization violation
 */
export interface SanitizationViolation {
  type: SanitizationRuleType;
  matched_pattern: string;
  location: { start: number; end: number };
  suggested_replacement: string;
}

/**
 * Sanitized knowledge item
 */
export interface SanitizedKnowledge {
  id: string;
  original_group_id: string;
  sanitized_content: string;
  sanitization_rules_applied: string[];
  sanitization_timestamp: Date;
  validation_passed: boolean;
  platform_compatible: boolean;
}