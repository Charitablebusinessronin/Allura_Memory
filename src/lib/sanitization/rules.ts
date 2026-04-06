/**
 * Sanitization Rules
 * Story 4-1: Sanitization Engine
 */

import type { SanitizationRule } from './types';

/**
 * Default sanitization rules
 */
export const DEFAULT_SANITIZATION_RULES: SanitizationRule[] = [
  {
    type: 'tenant_identifier',
    pattern: /allura-[a-z0-9-]+/gi,
    strategy: 'generalize',
    replacement: 'platform-tenant',
    description: 'Remove tenant-specific group_id',
  },
  {
    type: 'tenant_identifier',
    pattern: /roninclaw-[a-z0-9-]+/gi,
    strategy: 'generalize',
    replacement: 'platform-tenant',
    description: 'Remove legacy tenant identifiers',
  },
  {
    type: 'email',
    pattern: /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g,
    strategy: 'redact',
    replacement: '[email-redacted]',
    description: 'Redact email addresses',
  },
  {
    type: 'phone',
    pattern: /\b\d{3}[-.]?\d{3}[-.]?\d{4}\b/g,
    strategy: 'redact',
    replacement: '[phone-redacted]',
    description: 'Redact phone numbers',
  },
  {
    type: 'id',
    pattern: /\b[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}\b/gi,
    strategy: 'hash',
    replacement: '[id-redacted]',
    description: 'Redact UUIDs',
  },
  {
    type: 'url',
    pattern: /https?:\/\/[^\s<>"{}|\\^`[\]]+/g,
    strategy: 'abstract',
    replacement: '[url-redacted]',
    description: 'Abstract URLs with domain context',
  },
];

/**
 * Load rules for a specific context
 */
export function loadRulesForContext(
  context: 'strict' | 'moderate' | 'minimal'
): SanitizationRule[] {
  switch (context) {
    case 'strict':
      return DEFAULT_SANITIZATION_RULES;
    case 'moderate':
      return DEFAULT_SANITIZATION_RULES.filter(
        r => r.type !== 'url'
      );
    case 'minimal':
      return DEFAULT_SANITIZATION_RULES.filter(
        r => r.type === 'tenant_identifier'
      );
  }
}