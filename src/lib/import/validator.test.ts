/**
 * Mapping Validator Tests
 * 
 * Tests for validating normalized data before Neo4j loading.
 */

import { describe, it, expect, beforeEach } from 'vitest'
import { MappingValidator, createValidator } from './validator'
import type {
  NormalizedEvent,
  NormalizedOutcome,
  NormalizedRelationship,
} from './types'

// =============================================================================
// Test Fixtures
// =============================================================================

function createTestEvent(overrides: Partial<NormalizedEvent> = {}): NormalizedEvent {
  return {
    id: `neo-event-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    sourceId: `event-${Math.random().toString(36).substr(2, 9)}`,
    type: 'task.started',
    timestamp: new Date().toISOString(),
    properties: {
      category: 'task',
      taskRunId: 'task-run-123',
      sequenceNo: 0,
    },
    metadata: {
      extractedAt: new Date().toISOString(),
      source: 'postgresql',
    },
    ...overrides,
  }
}

function createTestOutcome(overrides: Partial<NormalizedOutcome> = {}): NormalizedOutcome {
  return {
    id: `neo-outcome-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    sourceId: `outcome-${Math.random().toString(36).substr(2, 9)}`,
    eventId: `neo-event-${Math.random().toString(36).substr(2, 9)}`,
    type: 'success',
    timestamp: new Date().toISOString(),
    severity: 'info',
    summary: 'Task completed successfully',
    properties: {
      category: 'result',
      taskRunId: 'task-run-123',
    },
    metadata: {
      extractedAt: new Date().toISOString(),
      source: 'postgresql',
    },
    ...overrides,
  }
}

function createTestRelationship(
  overrides: Partial<NormalizedRelationship> = {}
): NormalizedRelationship {
  return {
    eventId: `neo-event-${Math.random().toString(36).substr(2, 9)}`,
    outcomeId: `neo-outcome-${Math.random().toString(36).substr(2, 9)}`,
    type: 'DERIVED_FROM',
    properties: {
      createdAt: new Date().toISOString(),
    },
    ...overrides,
  }
}

// =============================================================================
// Mapping Validator Tests
// =============================================================================

describe('MappingValidator', () => {
  let validator: MappingValidator

  beforeEach(() => {
    validator = createValidator()
  })

  // =============================================================================
  // Basic Validation Tests
  // =============================================================================

  describe('validate', () => {
    it('should validate valid input', () => {
      const result = validator.validate({
        events: [createTestEvent()],
        outcomes: [createTestOutcome()],
        relationships: [createTestRelationship()],
      })

      expect(result.valid).toBe(true)
      expect(result.errors.length).toBe(0)
    })

    it('should return validation statistics', () => {
      const result = validator.validate({
        events: [createTestEvent()],
        outcomes: [createTestOutcome()],
        relationships: [createTestRelationship()],
      })

      expect(result.stats).toBeDefined()
      expect(result.stats.eventsValidated).toBe(1)
      expect(result.stats.outcomesValidated).toBe(1)
      expect(result.stats.relationshipsValidated).toBe(1)
      expect(result.stats.durationMs).toBeGreaterThanOrEqual(0)
    })

    it('should validate empty input', () => {
      const result = validator.validate({
        events: [],
        outcomes: [],
        relationships: [],
      })

      expect(result.valid).toBe(true)
      expect(result.stats.eventsValidated).toBe(0)
      expect(result.stats.outcomesValidated).toBe(0)
      expect(result.stats.relationshipsValidated).toBe(0)
    })

    it('should collect all errors', () => {
      const result = validator.validate({
        events: [createTestEvent({ id: '' })],
        outcomes: [createTestOutcome({ severity: 'invalid' as 'info' })],
        relationships: [createTestRelationship({ type: 'INVALID' as 'DERIVED_FROM' })],
      })

      expect(result.errors.length).toBeGreaterThan(0)
    })

    it('should collect all warnings', () => {
      const result = validator.validate({
        events: [createTestEvent({ type: 'unknown.type' })],
        outcomes: [createTestOutcome({ eventId: '' })],
        relationships: [createTestRelationship()],
      })

      expect(result.warnings.length).toBeGreaterThan(0)
    })
  })

  // =============================================================================
  // Event Validation Tests
  // =============================================================================

  describe('event validation', () => {
    it('should validate required event properties', () => {
      const event: NormalizedEvent = {
        id: '',
        sourceId: 'source',
        type: '',
        timestamp: '',
        properties: {},
        metadata: { extractedAt: '', source: 'postgresql' },
      }

      const result = validator.validate({
        events: [event],
        outcomes: [],
        relationships: [],
      })

      expect(result.valid).toBe(false)
      expect(result.errors.some(e => e.code === 'MISSING_REQUIRED_PROPERTY')).toBe(true)
    })

    it('should require event id', () => {
      const result = validator.validate({
        events: [createTestEvent({ id: '' })],
        outcomes: [],
        relationships: [],
      })

      expect(result.errors.some(e => e.property === 'id')).toBe(true)
    })

    it('should require event type', () => {
      const result = validator.validate({
        events: [createTestEvent({ type: '' })],
        outcomes: [],
        relationships: [],
      })

      expect(result.errors.some(e => e.property === 'type')).toBe(true)
    })

    it('should require event timestamp', () => {
      const result = validator.validate({
        events: [createTestEvent({ timestamp: '' })],
        outcomes: [],
        relationships: [],
      })

      expect(result.errors.some(e => e.property === 'timestamp')).toBe(true)
    })

    it('should validate timestamp format', () => {
      const result = validator.validate({
        events: [createTestEvent({ timestamp: 'invalid-date' })],
        outcomes: [],
        relationships: [],
      })

      expect(result.errors.some(e => e.code === 'INVALID_TIMESTAMP')).toBe(true)
    })

    it('should accept valid ISO 8601 timestamps', () => {
      const result = validator.validate({
        events: [createTestEvent({ timestamp: '2024-01-15T10:30:00.000Z' })],
        outcomes: [],
        relationships: [],
      })

      expect(result.errors.some(e => e.code === 'INVALID_TIMESTAMP')).toBe(false)
    })

    it('should warn on unknown event types', () => {
      const result = validator.validate({
        events: [createTestEvent({ type: 'completely.unknown.type' })],
        outcomes: [],
        relationships: [],
      })

      // In non-strict mode, unknown types should generate warnings
      expect(result.warnings.some(w => w.code === 'UNKNOWN_EVENT_TYPE')).toBe(true)
    })

    it('should warn on missing metadata source', () => {
      const event = createTestEvent()
      event.metadata = { extractedAt: '', source: 'postgresql' }

      const result = validator.validate({
        events: [event],
        outcomes: [],
        relationships: [],
      })

      expect(result.warnings.some(w => w.code === 'MISSING_METADATA_SOURCE')).toBe(true)
    })
  })

  // =============================================================================
  // Outcome Validation Tests
  // =============================================================================

  describe('outcome validation', () => {
    it('should validate required outcome properties', () => {
      const outcome: NormalizedOutcome = {
        id: '',
        sourceId: 'source',
        eventId: '',
        type: '',
        timestamp: '',
        severity: 'info',
        summary: '',
        properties: {},
        metadata: { extractedAt: '', source: 'postgresql' },
      }

      const result = validator.validate({
        events: [],
        outcomes: [outcome],
        relationships: [],
      })

      expect(result.valid).toBe(false)
      expect(result.errors.some(e => e.code === 'MISSING_REQUIRED_PROPERTY')).toBe(true)
    })

    it('should require outcome id', () => {
      const result = validator.validate({
        events: [],
        outcomes: [createTestOutcome({ id: '' })],
        relationships: [],
      })

      expect(result.errors.some(e => e.property === 'id')).toBe(true)
    })

    it('should require outcome type', () => {
      const result = validator.validate({
        events: [],
        outcomes: [createTestOutcome({ type: '' })],
        relationships: [],
      })

      expect(result.errors.some(e => e.property === 'type')).toBe(true)
    })

    it('should validate severity levels', () => {
      const result = validator.validate({
        events: [],
        outcomes: [createTestOutcome({ severity: 'invalid' as 'info' })],
        relationships: [],
      })

      expect(result.errors.some(e => e.code === 'INVALID_SEVERITY')).toBe(true)
    })

    it('should accept valid severity levels', () => {
      const severities: Array<'info' | 'low' | 'medium' | 'high' | 'critical'> = 
        ['info', 'low', 'medium', 'high', 'critical']

      for (const severity of severities) {
        const result = validator.validate({
          events: [],
          outcomes: [createTestOutcome({ severity })],
          relationships: [],
        })

        expect(result.errors.some(e => e.code === 'INVALID_SEVERITY')).toBe(false)
      }
    })

    it('should validate outcome timestamp', () => {
      const result = validator.validate({
        events: [],
        outcomes: [createTestOutcome({ timestamp: 'invalid' })],
        relationships: [],
      })

      expect(result.errors.some(e => e.code === 'INVALID_TIMESTAMP')).toBe(true)
    })

    it('should warn on unknown outcome types', () => {
      const result = validator.validate({
        events: [],
        outcomes: [createTestOutcome({ type: 'unknown.outcome' })],
        relationships: [],
      })

      expect(result.warnings.some(w => w.code === 'UNKNOWN_OUTCOME_TYPE')).toBe(true)
    })

    it('should warn on missing event reference', () => {
      const result = validator.validate({
        events: [],
        outcomes: [createTestOutcome({ eventId: '' })],
        relationships: [],
      })

      expect(result.warnings.some(w => w.code === 'MISSING_EVENT_REFERENCE')).toBe(true)
    })
  })

  // =============================================================================
  // Relationship Validation Tests
  // =============================================================================

  describe('relationship validation', () => {
    it('should validate relationship types', () => {
      const result = validator.validate({
        events: [],
        outcomes: [],
        relationships: [createTestRelationship({ type: 'INVALID' as 'DERIVED_FROM' })],
      })

      expect(result.errors.some(e => e.code === 'INVALID_RELATIONSHIP_TYPE')).toBe(true)
    })

    it('should accept valid relationship types', () => {
      const types: Array<'DERIVED_FROM' | 'CAUSED' | 'LEADS_TO' | 'PART_OF'> = 
        ['DERIVED_FROM', 'CAUSED', 'LEADS_TO', 'PART_OF']

      for (const type of types) {
        const result = validator.validate({
          events: [],
          outcomes: [],
          relationships: [createTestRelationship({ type })],
        })

        expect(result.errors.some(e => e.code === 'INVALID_RELATIONSHIP_TYPE')).toBe(false)
      }
    })

    it('should require event ID', () => {
      const result = validator.validate({
        events: [],
        outcomes: [],
        relationships: [createTestRelationship({ eventId: '' })],
      })

      expect(result.errors.some(e => e.code === 'MISSING_EVENT_ID')).toBe(true)
    })

    it('should require outcome ID', () => {
      const result = validator.validate({
        events: [],
        outcomes: [],
        relationships: [createTestRelationship({ outcomeId: '' })],
      })

      expect(result.errors.some(e => e.code === 'MISSING_OUTCOME_ID')).toBe(true)
    })
  })

  // =============================================================================
  // Reference Validation Tests
  // =============================================================================

  describe('reference validation', () => {
    it('should validate references when enabled', () => {
      const refValidator = createValidator({ rules: { validateReferences: true } })

      const event = createTestEvent({ id: 'neo-event-1' })
      const outcome = createTestOutcome({ id: 'neo-outcome-1' })
      const relationship = createTestRelationship({
        eventId: 'neo-event-missing',
        outcomeId: 'neo-outcome-1',
      })

      const result = refValidator.validate({
        events: [event],
        outcomes: [outcome],
        relationships: [relationship],
      })

      expect(result.warnings.some(w => w.code === 'EVENT_NOT_FOUND')).toBe(true)
    })

    it('should not validate references when disabled', () => {
      const noRefValidator = createValidator({ rules: { validateReferences: false } })

      const event = createTestEvent({ id: 'neo-event-1' })
      const relationship = createTestRelationship({
        eventId: 'neo-event-missing',
        outcomeId: 'neo-outcome-1',
      })

      const result = noRefValidator.validate({
        events: [event],
        outcomes: [],
        relationships: [relationship],
      })

      // Reference validation should be skipped
      expect(result.warnings.some(w => w.code === 'EVENT_NOT_FOUND')).toBe(false)
    })
  })

  // =============================================================================
  // Property Validation Tests
  // =============================================================================

  describe('property validation', () => {
    it('should warn on excessive property length', () => {
      const longValue = 'a'.repeat(20000)
      const event = createTestEvent({
        properties: { description: longValue },
      })

      const result = validator.validate({
        events: [event],
        outcomes: [],
        relationships: [],
      })

      expect(result.warnings.some(w => w.code === 'PROPERTY_LENGTH_EXCEEDED')).toBe(true)
    })

    it('should accept properties within length limits', () => {
      const event = createTestEvent({
        properties: { description: 'Normal length description' },
      })

      const result = validator.validate({
        events: [event],
        outcomes: [],
        relationships: [],
      })

      expect(result.warnings.some(w => w.code === 'PROPERTY_LENGTH_EXCEEDED')).toBe(false)
    })
  })

  // =============================================================================
  // Error Details Tests
  // =============================================================================

  describe('error details', () => {
    it('should include entity type in errors', () => {
      const result = validator.validate({
        events: [createTestEvent({ id: '' })],
        outcomes: [],
        relationships: [],
      })

      expect(result.errors[0].entityType).toBe('event')
    })

    it('should include entity ID in errors', () => {
      const event = createTestEvent({ id: 'test-event-id', type: '' })
      const result = validator.validate({
        events: [event],
        outcomes: [],
        relationships: [],
      })

      expect(result.errors[0].entityId).toBe('test-event-id')
    })

    it('should include error code', () => {
      const result = validator.validate({
        events: [createTestEvent({ id: '' })],
        outcomes: [],
        relationships: [],
      })

      expect(result.errors[0].code).toBe('MISSING_REQUIRED_PROPERTY')
    })

    it('should include property name in errors', () => {
      const result = validator.validate({
        events: [createTestEvent({ id: '' })],
        outcomes: [],
        relationships: [],
      })

      expect(result.errors[0].property).toBe('id')
    })

    it('should include expected value in errors', () => {
      const result = validator.validate({
        events: [createTestEvent({ id: '' })],
        outcomes: [],
        relationships: [],
      })

      expect(result.errors[0].expected).toBeDefined()
    })

    it('should include actual value in errors', () => {
      const result = validator.validate({
        events: [createTestEvent({ id: '' })],
        outcomes: [],
        relationships: [],
      })

      expect(result.errors[0].actual).toBeDefined()
    })
  })

  // =============================================================================
  // Configuration Tests
  // =============================================================================

  describe('configuration', () => {
    it('should use default validation rules', () => {
      const rules = validator.getRules()

      expect(rules.requiredEventProperties).toBeDefined()
      expect(rules.requiredOutcomeProperties).toBeDefined()
      expect(rules.validRelationshipTypes).toBeDefined()
      expect(rules.validSeverities).toBeDefined()
    })

    it('should accept custom validation rules', () => {
      const customValidator = createValidator({
        rules: {
          requiredEventProperties: ['id', 'type', 'timestamp', 'customField'],
          maxPropertyLength: 5000,
        },
      })

      const rules = customValidator.getRules()

      expect(rules.requiredEventProperties).toContain('customField')
      expect(rules.maxPropertyLength).toBe(5000)
    })

    it('should update validation rules', () => {
      validator.updateRules({
        maxPropertyLength: 500,
      })

      const rules = validator.getRules()
      expect(rules.maxPropertyLength).toBe(500)
    })

    it('should configure strict mode', () => {
      const strictValidator = createValidator({ strict: true })
      expect(strictValidator).toBeInstanceOf(MappingValidator)
    })
  })

  // =============================================================================
  // Warning Tests
  // =============================================================================

  describe('warnings', () => {
    it('should not mark warnings as errors', () => {
      const result = validator.validate({
        events: [createTestEvent({ type: 'unknown.type' })],
        outcomes: [],
        relationships: [],
      })

      expect(result.valid).toBe(true) // Warnings don't fail validation
      expect(result.warnings.length).toBeGreaterThan(0)
    })

    it('should count warnings separately', () => {
      const result = validator.validate({
        events: [createTestEvent({ type: 'unknown.event' })],
        outcomes: [createTestOutcome({ eventId: '' })],
        relationships: [],
      })

      expect(result.stats.warningCount).toBe(result.warnings.length)
      expect(result.stats.errorCount).toBe(result.errors.length)
    })
  })
})

// =============================================================================
// Integration Tests
// =============================================================================

describe('MappingValidator Integration', () => {
  it('should validate complete pipeline output', () => {
    const validator = createValidator()

    const result = validator.validate({
      events: [
        createTestEvent({ id: 'neo-event-1', type: 'task.started' }),
        createTestEvent({ id: 'neo-event-2', type: 'task.completed' }),
        createTestEvent({ id: 'neo-event-3', type: 'insight.created' }),
      ],
      outcomes: [
        createTestOutcome({ id: 'neo-outcome-1', eventId: 'neo-event-1', severity: 'info' }),
        createTestOutcome({ id: 'neo-outcome-2', eventId: 'neo-event-2', severity: 'high' }),
      ],
      relationships: [
        createTestRelationship({ eventId: 'neo-event-1', outcomeId: 'neo-outcome-1', type: 'DERIVED_FROM' }),
        createTestRelationship({ eventId: 'neo-event-2', outcomeId: 'neo-outcome-2', type: 'DERIVED_FROM' }),
      ],
    })

    expect(result.valid).toBe(true)
    expect(result.errors.length).toBe(0)
    expect(result.stats.eventsValidated).toBe(3)
    expect(result.stats.outcomesValidated).toBe(2)
    expect(result.stats.relationshipsValidated).toBe(2)
  })

  it('should handle mixed valid and invalid data', () => {
    const validator = createValidator()

    const result = validator.validate({
      events: [
        createTestEvent({ id: 'neo-event-1' }), // Valid
        createTestEvent({ id: '', type: '' }), // Invalid
        createTestEvent({ id: 'neo-event-3' }), // Valid
      ],
      outcomes: [
        createTestOutcome({ id: 'neo-outcome-1' }), // Valid
        createTestOutcome({ id: '', severity: 'invalid' as 'info' }), // Invalid
      ],
      relationships: [
        createTestRelationship({ eventId: 'neo-event-1', outcomeId: 'neo-outcome-1' }), // Valid
        createTestRelationship({ type: 'INVALID' as 'DERIVED_FROM' }), // Invalid
      ],
    })

    expect(result.valid).toBe(false)
    expect(result.errors.length).toBeGreaterThan(0)
    expect(result.stats.errorCount).toBeGreaterThan(0)
  })

  it('should validate large batches efficiently', () => {
    const validator = createValidator()

    const events: NormalizedEvent[] = Array.from({ length: 100 }, () => createTestEvent())
    const outcomes: NormalizedOutcome[] = Array.from({ length: 100 }, () => createTestOutcome())
    const relationships: NormalizedRelationship[] = Array.from(
      { length: 100 },
      () => createTestRelationship()
    )

    const startTime = Date.now()
    const result = validator.validate({ events, outcomes, relationships })
    const duration = Date.now() - startTime

    expect(result.valid).toBe(true)
    expect(duration).toBeLessThan(1000) // Should validate in under 1 second
  })
})

// =============================================================================
// Factory Function Tests
// =============================================================================

describe('createValidator', () => {
  it('should create validator with default config', () => {
    const validator = createValidator()
    expect(validator).toBeInstanceOf(MappingValidator)
  })

  it('should create validator with custom config', () => {
    const validator = createValidator({
      rules: {
        requiredEventProperties: ['id', 'type'],
        maxPropertyLength: 5000,
      },
      strict: true,
    })
    expect(validator).toBeInstanceOf(MappingValidator)
  })
})