/**
 * Sanitization Module - Cross-Organization Knowledge Sharing
 * Story 4.1: Remove tenant identifiers before promoting insights
 * 
 * This module provides sanitization utilities for the promotion workflow,
 * ensuring cross-tenant isolation while preserving structural patterns.
 */

export {
  sanitizeForPromotion,
  removeTenantIdentifiers,
  anonymizeSensitiveData,
  createAbstractPattern,
  validateSanitization,
  type SanitizationResult,
  type SanitizationOptions,
  type AnonymizationMethod,
} from "./engine";