/**
 * Sanitizer Tests
 * Story 4-1: Sanitization Engine
 */

import { describe, it, expect } from 'vitest';
import { Sanitizer, getSanitizer } from './sanitizer';
import { validateSanitization, validateForPlatform } from './validator';
import { DEFAULT_SANITIZATION_RULES } from './rules';

describe('Sanitization Engine', () => {
  describe('Sanitizer', () => {
    it('should remove tenant identifiers', () => {
      const sanitizer = getSanitizer();
      const result = sanitizer.sanitize('Workspace: allura-faith-meats');
      
      expect(result.sanitized).toContain('platform-tenant');
      expect(result.rules).toContain('tenant_identifier');
    });

    it('should redact email addresses', () => {
      const sanitizer = getSanitizer();
      const result = sanitizer.sanitize('Contact: user@example.com');
      
      expect(result.sanitized).toContain('[email-redacted]');
    });

    it('should redact phone numbers', () => {
      const sanitizer = getSanitizer();
      const result = sanitizer.sanitize('Phone: 555-123-4567');
      
      expect(result.sanitized).toContain('[phone-redacted]');
    });

    it('should detect all violations', () => {
      const sanitizer = getSanitizer();
      const result = sanitizer.sanitize(
        'Email: test@test.com, Group: allura-test, Phone: 555-123-4567'
      );
      
      expect(result.violations.length).toBe(3);
      expect(result.is_clean).toBe(false);
    });

    it('should pass clean content', () => {
      const sanitizer = getSanitizer();
      const result = sanitizer.sanitize('This is clean content without PII');
      
      expect(result.is_clean).toBe(true);
      expect(result.violations.length).toBe(0);
    });
  });

  describe('Validator', () => {
    it('should validate sanitized content', () => {
      const result = validateSanitization('No PII here');
      
      expect(result.is_valid).toBe(true);
    });

    it('should detect violations', () => {
      const result = validateSanitization('Group: allura-test');
      
      expect(result.is_valid).toBe(false);
      expect(result.violations.length).toBeGreaterThan(0);
    });

    it('should validate for platform submission', () => {
      const result = validateForPlatform('allura-test-workspace');
      
      expect(result.can_submit).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });
  });

  describe('Rules', () => {
    it('should have default rules defined', () => {
      expect(DEFAULT_SANITIZATION_RULES.length).toBeGreaterThan(0);
    });

    it('should match tenant identifiers', () => {
      const rule = DEFAULT_SANITIZATION_RULES.find(r => r.type === 'tenant_identifier');
      expect(rule).toBeDefined();
      expect(rule?.pattern.test('allura-faith-meats')).toBe(true);
    });
  });
});