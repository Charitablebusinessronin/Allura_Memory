/**
 * Sanitization Validator
 * Story 4-1: Sanitization Engine
 */

import type { SanitizationViolation } from './types';
import { DEFAULT_SANITIZATION_RULES } from './rules';

/**
 * Validate that content is properly sanitized
 */
export function validateSanitization(content: string): {
  is_valid: boolean;
  violations: SanitizationViolation[];
} {
  const violations: SanitizationViolation[] = [];

  for (const rule of DEFAULT_SANITIZATION_RULES) {
    const matches = content.matchAll(rule.pattern);
    
    for (const match of matches) {
      if (match.index !== undefined) {
        violations.push({
          type: rule.type,
          matched_pattern: match[0],
          location: { start: match.index, end: match.index + match[0].length },
          suggested_replacement: rule.replacement,
        });
      }
    }
  }

  return {
    is_valid: violations.length === 0,
    violations,
  };
}

/**
 * Validate for platform library submission
 */
export function validateForPlatform(content: string): {
  can_submit: boolean;
  errors: string[];
} {
  const { is_valid, violations } = validateSanitization(content);
  
  const errors: string[] = [];
  
  if (!is_valid) {
    for (const violation of violations) {
      errors.push(
        `Found ${violation.type}: "${violation.matched_pattern}" at position ${violation.location.start}. ` +
        `Suggested replacement: ${violation.suggested_replacement}`
      );
    }
  }
  
  return {
    can_submit: is_valid,
    errors,
  };
}