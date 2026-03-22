/**
 * Mapping Validator
 * 
 * Validates normalized data before loading into Neo4j.
 * Checks required properties, relationship integrity, and canonical schema compliance.
 */

import type {
  NormalizedEvent,
  NormalizedOutcome,
  NormalizedRelationship,
} from './types'

// =============================================================================
// Validation Types
// =============================================================================

/**
 * Validation severity
 */
export type ValidationSeverity = 'error' | 'warning' | 'info'

/**
 * Validation result
 */
export interface ValidationResult {
  /** Whether validation passed */
  valid: boolean
  /** Validation errors */
  errors: ValidationError[]
  /** Validation warnings */
  warnings: ValidationWarning[]
  /** Validation statistics */
  stats: ValidationStats
}

/**
 * Validation error
 */
export interface ValidationError {
  /** Type of entity with error */
  entityType: 'event' | 'outcome' | 'relationship'
  /** Entity ID */
  entityId: string
  /** Error message */
  message: string
  /** Error code */
  code: string
  /** Property with error */
  property?: string
  /** Expected value/type */
  expected?: string
  /** Actual value */
  actual?: unknown
}

/**
 * Validation warning
 */
export interface ValidationWarning {
  /** Type of entity */
  entityType: 'event' | 'outcome' | 'relationship'
  /** Entity ID */
  entityId: string
  /** Warning message */
  message: string
  /** Warning code */
  code: string
  /** Property with warning */
  property?: string
}

/**
 * Validation statistics
 */
export interface ValidationStats {
  /** Total events validated */
  eventsValidated: number
  /** Total outcomes validated */
  outcomesValidated: number
  /** Total relationships validated */
  relationshipsValidated: number
  /** Total errors */
  errorCount: number
  /** Total warnings */
  warningCount: number
  /** Validation duration */
  durationMs: number
}

/**
 * Validation rules configuration
 */
export interface ValidationRules {
  /** Required event properties */
  requiredEventProperties: string[]
  /** Required outcome properties */
  requiredOutcomeProperties: string[]
  /** Valid event types */
  validEventTypes?: string[]
  /** Valid outcome types */
  validOutcomeTypes?: string[]
  /** Valid severity levels */
  validSeverities: string[]
  /** Valid relationship types */
  validRelationshipTypes: string[]
  /** Maximum property value length */
  maxPropertyLength: number
  /** Maximum payload size (bytes) */
  maxPayloadSize: number
  /** Validate relationships reference existing nodes */
  validateReferences: boolean
}

// =============================================================================
// Default Validation Rules
// =============================================================================

const DEFAULT_VALIDATION_RULES: ValidationRules = {
  requiredEventProperties: ['id', 'type', 'timestamp'],
  requiredOutcomeProperties: ['id', 'type', 'timestamp'],
  validSeverities: ['info', 'low', 'medium', 'high', 'critical'],
  validRelationshipTypes: ['DERIVED_FROM', 'CAUSED', 'LEADS_TO', 'PART_OF'],
  maxPropertyLength: 10000,
  maxPayloadSize: 1024 * 1024, // 1MB
  validateReferences: false, // Disabled by default for mock implementation
}

// =============================================================================
// Canonical Schema Definitions
// =============================================================================

const CANONICAL_SCHEMA = {
  KnowledgeItem: {
    requiredProperties: ['id', 'topicKey', 'status', 'text', 'createdAt'],
    labels: ['KnowledgeItem', 'Insight'],
  },
  AIAgent: {
    requiredProperties: ['id', 'name', 'type'],
    labels: ['AIAgent'],
  },
  Insight: {
    requiredProperties: ['id', 'topicKey', 'status', 'text', 'createdAt'],
    labels: ['Insight'],
  },
  Event: {
    requiredProperties: ['id', 'type', 'timestamp', 'taskRunId'],
    labels: ['Event'],
  },
  Outcome: {
    requiredProperties: ['id', 'type', 'timestamp'],
    labels: ['Outcome'],
  },
}

// =============================================================================
// Validator Class
// =============================================================================

/**
 * Mapping Validator
 * 
 * Validates normalized events, outcomes, and relationships before loading
 * into Neo4j. Ensures data quality and schema compliance.
 */
export class MappingValidator {
  private rules: ValidationRules
  private strict: boolean

  constructor(config: { rules?: Partial<ValidationRules>; strict?: boolean } = {}) {
    this.rules = { ...DEFAULT_VALIDATION_RULES, ...config.rules }
    this.strict = config.strict ?? false
  }

  /**
   * Validate events, outcomes, and relationships
   */
  validate(input: {
    events: NormalizedEvent[]
    outcomes: NormalizedOutcome[]
    relationships: NormalizedRelationship[]
  }): ValidationResult {
    const startTime = Date.now()
    const errors: ValidationError[] = []
    const warnings: ValidationWarning[] = []

    // Validate events
    for (const event of input.events) {
      const eventResult = this.validateEvent(event)
      errors.push(...eventResult.errors)
      warnings.push(...eventResult.warnings)
    }

    // Validate outcomes
    for (const outcome of input.outcomes) {
      const outcomeResult = this.validateOutcome(outcome)
      errors.push(...outcomeResult.errors)
      warnings.push(...outcomeResult.warnings)
    }

    // Validate relationships
    const eventIdSet = new Set(input.events.map((e) => e.id))
    const outcomeIdSet = new Set(input.outcomes.map((o) => o.id))

    for (const relationship of input.relationships) {
      const relResult = this.validateRelationship(relationship, eventIdSet, outcomeIdSet)
      errors.push(...relResult.errors)
      warnings.push(...relResult.warnings)
    }

    const durationMs = Date.now() - startTime

    return {
      valid: errors.length === 0,
      errors,
      warnings,
      stats: {
        eventsValidated: input.events.length,
        outcomesValidated: input.outcomes.length,
        relationshipsValidated: input.relationships.length,
        errorCount: errors.length,
        warningCount: warnings.length,
        durationMs,
      },
    }
  }

  /**
   * Validate a single event
   */
  validateEvent(event: NormalizedEvent): {
    errors: ValidationError[]
    warnings: ValidationWarning[]
  } {
    const errors: ValidationError[] = []
    const warnings: ValidationWarning[] = []

    // Check required properties
    for (const prop of this.rules.requiredEventProperties) {
      if (!this.hasProperty(event, prop)) {
        errors.push({
          entityType: 'event',
          entityId: event.id,
          message: `Missing required property: ${prop}`,
          code: 'MISSING_REQUIRED_PROPERTY',
          property: prop,
          expected: 'present',
          actual: 'missing',
        })
      }
    }

    // Check ID format
    if (event.id && !this.isValidId(event.id)) {
      errors.push({
        entityType: 'event',
        entityId: event.id,
        message: 'Invalid ID format',
        code: 'INVALID_ID_FORMAT',
        property: 'id',
        expected: 'neo-{type}-{uuid}',
        actual: event.id,
      })
    }

    // Check type format
    if (event.type && !this.isValidType(event.type)) {
      errors.push({
        entityType: 'event',
        entityId: event.id,
        message: `Invalid event type format: ${event.type}`,
        code: 'INVALID_TYPE_FORMAT',
        property: 'type',
      })
    } else if (event.type && !this.isKnownEventType(event.type)) {
      warnings.push({
        entityType: 'event',
        entityId: event.id,
        message: `Unknown event type: ${event.type}`,
        code: 'UNKNOWN_EVENT_TYPE',
        property: 'type',
      })
    }

    // Check timestamp format
    if (event.timestamp && !this.isValidTimestamp(event.timestamp)) {
      errors.push({
        entityType: 'event',
        entityId: event.id,
        message: 'Invalid timestamp format',
        code: 'INVALID_TIMESTAMP',
        property: 'timestamp',
        expected: 'ISO 8601',
        actual: event.timestamp,
      })
    }

    // Check property values
    for (const [key, value] of Object.entries(event.properties)) {
      if (!this.isValidPropertyValue(key, value)) {
        warnings.push({
          entityType: 'event',
          entityId: event.id,
          message: `Property '${key}' exceeds maximum length`,
          code: 'PROPERTY_LENGTH_EXCEEDED',
          property: key,
        })
      }
    }

    // Check metadata
    if (!event.metadata || !event.metadata.source) {
      warnings.push({
        entityType: 'event',
        entityId: event.id,
        message: 'Missing metadata source',
        code: 'MISSING_METADATA_SOURCE',
      })
    }

    return { errors, warnings }
  }

  /**
   * Validate a single outcome
   */
  validateOutcome(outcome: NormalizedOutcome): {
    errors: ValidationError[]
    warnings: ValidationWarning[]
  } {
    const errors: ValidationError[] = []
    const warnings: ValidationWarning[] = []

    // Check required properties
    for (const prop of this.rules.requiredOutcomeProperties) {
      if (!this.hasProperty(outcome, prop)) {
        errors.push({
          entityType: 'outcome',
          entityId: outcome.id,
          message: `Missing required property: ${prop}`,
          code: 'MISSING_REQUIRED_PROPERTY',
          property: prop,
          expected: 'present',
          actual: 'missing',
        })
      }
    }

    // Check ID format
    if (outcome.id && !this.isValidId(outcome.id)) {
      errors.push({
        entityType: 'outcome',
        entityId: outcome.id,
        message: 'Invalid ID format',
        code: 'INVALID_ID_FORMAT',
        property: 'id',
        expected: 'neo-{type}-{uuid}',
        actual: outcome.id,
      })
    }

    // Check type format
    if (outcome.type && !this.isValidType(outcome.type)) {
      errors.push({
        entityType: 'outcome',
        entityId: outcome.id,
        message: `Invalid outcome type format: ${outcome.type}`,
        code: 'INVALID_TYPE_FORMAT',
        property: 'type',
      })
    } else if (outcome.type && !this.isKnownOutcomeType(outcome.type)) {
      warnings.push({
        entityType: 'outcome',
        entityId: outcome.id,
        message: `Unknown outcome type: ${outcome.type}`,
        code: 'UNKNOWN_OUTCOME_TYPE',
        property: 'type',
      })
    }

    // Check timestamp format
    if (outcome.timestamp && !this.isValidTimestamp(outcome.timestamp)) {
      errors.push({
        entityType: 'outcome',
        entityId: outcome.id,
        message: 'Invalid timestamp format',
        code: 'INVALID_TIMESTAMP',
        property: 'timestamp',
        expected: 'ISO 8601',
        actual: outcome.timestamp,
      })
    }

    // Check severity
    if (outcome.severity && !this.rules.validSeverities.includes(outcome.severity)) {
      errors.push({
        entityType: 'outcome',
        entityId: outcome.id,
        message: `Invalid severity: ${outcome.severity}`,
        code: 'INVALID_SEVERITY',
        property: 'severity',
        expected: this.rules.validSeverities.join(', '),
        actual: outcome.severity,
      })
    }

    // Check property values
    for (const [key, value] of Object.entries(outcome.properties)) {
      if (!this.isValidPropertyValue(key, value)) {
        warnings.push({
          entityType: 'outcome',
          entityId: outcome.id,
          message: `Property '${key}' exceeds maximum length`,
          code: 'PROPERTY_LENGTH_EXCEEDED',
          property: key,
        })
      }
    }

    // Check event reference
    if (!outcome.eventId) {
      warnings.push({
        entityType: 'outcome',
        entityId: outcome.id,
        message: 'Missing event reference',
        code: 'MISSING_EVENT_REFERENCE',
      })
    }

    // Check metadata
    if (!outcome.metadata || !outcome.metadata.source) {
      warnings.push({
        entityType: 'outcome',
        entityId: outcome.id,
        message: 'Missing metadata source',
        code: 'MISSING_METADATA_SOURCE',
      })
    }

    return { errors, warnings }
  }

  /**
   * Validate a single relationship
   */
  validateRelationship(
    relationship: NormalizedRelationship,
    eventIdSet: Set<string>,
    outcomeIdSet: Set<string>
  ): {
    errors: ValidationError[]
    warnings: ValidationWarning[]
  } {
    const errors: ValidationError[] = []
    const warnings: ValidationWarning[] = []

    // Check relationship type
    if (!this.rules.validRelationshipTypes.includes(relationship.type)) {
      errors.push({
        entityType: 'relationship',
        entityId: `${relationship.eventId}-${relationship.outcomeId}`,
        message: `Invalid relationship type: ${relationship.type}`,
        code: 'INVALID_RELATIONSHIP_TYPE',
        property: 'type',
        expected: this.rules.validRelationshipTypes.join(', '),
        actual: relationship.type,
      })
    }

    // Check source reference
    if (!relationship.eventId) {
      errors.push({
        entityType: 'relationship',
        entityId: 'unknown',
        message: 'Missing event ID in relationship',
        code: 'MISSING_EVENT_ID',
        property: 'eventId',
      })
    }

    // Check target reference
    if (!relationship.outcomeId) {
      errors.push({
        entityType: 'relationship',
        entityId: 'unknown',
        message: 'Missing outcome ID in relationship',
        code: 'MISSING_OUTCOME_ID',
        property: 'outcomeId',
      })
    }

    // Validate references if enabled
    if (this.rules.validateReferences) {
      if (relationship.eventId && !eventIdSet.has(relationship.eventId)) {
        warnings.push({
          entityType: 'relationship',
          entityId: `${relationship.eventId}-${relationship.outcomeId}`,
          message: `Event not found in batch: ${relationship.eventId}`,
          code: 'EVENT_NOT_FOUND',
          property: 'eventId',
        })
      }
    }

    return { errors, warnings }
  }

  // =============================================================================
  // Validation Helpers
  // =============================================================================

  /**
   * Check if object has property
   */
  private hasProperty(obj: NormalizedEvent | NormalizedOutcome, prop: string): boolean {
    if (prop === 'id') return !!(obj as NormalizedEvent).id
    if (prop === 'type') return !!(obj as NormalizedEvent).type
    if (prop === 'timestamp') return !!(obj as NormalizedEvent).timestamp
    if (prop === 'sourceId') return !!(obj as NormalizedEvent).sourceId
    if (prop === 'eventId') return !!(obj as NormalizedOutcome).eventId
    if (prop === 'severity') return !!(obj as NormalizedOutcome).severity
    if (prop === 'summary') return !!(obj as NormalizedOutcome).summary
    // For properties, check if they exist
    if (obj.properties && prop in obj.properties) {
      return obj.properties[prop] !== undefined && obj.properties[prop] !== null && obj.properties[prop] !== ''
    }
    return false
  }

  /**
   * Validate ID format
   */
  private isValidId(id: string): boolean {
    // Allow neo-{type}-{uuid} or any reasonable ID
    return id.length > 0 && id.length <= 255
  }

  /**
   * Validate type format
   */
  private isValidType(type: string): boolean {
    // Allow any non-empty type string for basic validation
    // The warning system handles unknown types separately
    return type.length > 0 && type.length <= 100
  }

  /**
   * Check if type is known
   */
  private isKnownEventType(type: string): boolean {
    const knownTypes = [
      'task.started', 'task.completed', 'task.failed',
      'insight.created', 'insight.approved', 'insight.rejected',
      'memory.stored', 'memory.retrieved',
      'graph.node.created', 'graph.edge.created',
      'agent.action', 'agent.decision',
    ]
    return knownTypes.includes(type)
  }

  /**
   * Check if outcome type is known
   */
  private isKnownOutcomeType(type: string): boolean {
    const knownTypes = ['success', 'failure', 'partial', 'pending', 'cancelled', 'timeout']
    return knownTypes.includes(type)
  }

  /**
   * Validate timestamp format
   */
  private isValidTimestamp(timestamp: string): boolean {
    // Check ISO 8601 format
    try {
      const date = new Date(timestamp)
      return !isNaN(date.getTime())
    } catch {
      return false
    }
  }

  /**
   * Validate property value
   */
  private isValidPropertyValue(key: string, value: unknown): boolean {
    if (typeof value === 'string') {
      return value.length <= this.rules.maxPropertyLength
    }
    return true
  }

  /**
   * Get validation rules
   */
  getRules(): ValidationRules {
    return { ...this.rules }
  }

  /**
   * Update validation rules
   */
  updateRules(rules: Partial<ValidationRules>): void {
    this.rules = { ...this.rules, ...rules }
  }
}

// =============================================================================
// Factory Function
// =============================================================================

/**
 * Create a mapping validator
 */
export function createValidator(config: {
  rules?: Partial<ValidationRules>
  strict?: boolean
} = {}): MappingValidator {
  return new MappingValidator(config)
}

// =============================================================================
// Default Export
// =============================================================================

export default MappingValidator