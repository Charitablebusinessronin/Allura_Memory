/**
 * Sanitizer Class
 * Story 4-1: Sanitization Engine
 */

import type { SanitizationRule, SanitizationResult, SanitizationViolation } from './types';
import { DEFAULT_SANITIZATION_RULES } from './rules';

/**
 * Sanitization Engine
 * 
 * Removes tenant-specific data before platform library submission
 */
export class Sanitizer {
  private rules: SanitizationRule[];

  constructor(rules?: SanitizationRule[]) {
    this.rules = rules || DEFAULT_SANITIZATION_RULES;
  }

  /**
   * Sanitize content by applying all rules
   */
  sanitize(content: string): SanitizationResult {
    let sanitized = content;
    const appliedRules: string[] = [];
    const violations: SanitizationViolation[] = [];

    for (const rule of this.rules) {
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

      const before = sanitized;
      sanitized = sanitized.replace(rule.pattern, rule.replacement);
      
      if (before !== sanitized) {
        appliedRules.push(rule.type);
      }
    }

    return {
      original: content,
      sanitized,
      rules: [...new Set(appliedRules)],
      violations,
      is_clean: violations.length === 0,
    };
  }

  /**
   * Anonymize data using strategy
   */
  anonymize(data: Record<string, unknown>, strategy: 'hash' | 'redact' = 'hash'): Record<string, unknown> {
    const anonymized: Record<string, unknown> = {};

    for (const [key, value] of Object.entries(data)) {
      if (this.isPII(key, value)) {
        anonymized[key] = strategy === 'hash' 
          ? this.hashValue(String(value))
          : '[REDACTED]';
      } else {
        anonymized[key] = value;
      }
    }

    return anonymized;
  }

  /**
   * Abstract domain-specific terms to general patterns
   */
  abstract(content: string, patterns: Map<string, string>): string {
    let abstracted = content;
    
    for (const [specific, general] of patterns) {
      const regex = new RegExp(specific, 'gi');
      abstracted = abstracted.replace(regex, general);
    }
    
    return abstracted;
  }

  /**
   * Check if field is PII
   */
  private isPII(key: string, value: unknown): boolean {
    const piiFields = ['email', 'phone', 'name', 'address', 'ssn', 'password'];
    
    if (piiFields.some(field => key.toLowerCase().includes(field))) {
      return true;
    }
    
    if (typeof value === 'string') {
      return DEFAULT_SANITIZATION_RULES.some(
        rule => rule.pattern.test(value)
      );
    }
    
    return false;
  }

  /**
   * Hash value for anonymization
   */
  private hashValue(value: string): string {
    // Simple hash for demonstration
    // In production, use crypto hash
    let hash = 0;
    for (let i = 0; i < value.length; i++) {
      const char = value.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    return `hashed_${Math.abs(hash).toString(16)}`;
  }
}

/**
 * Singleton instance
 */
let instance: Sanitizer | null = null;

export function getSanitizer(): Sanitizer {
  if (!instance) {
    instance = new Sanitizer();
  }
  return instance;
}