/**
 * Semantic Mapper
 * 
 * Transforms heterogeneous trace data into a standardized semantic schema
 * for the Neo4j knowledge graph.
 * 
 * Handles event type-specific mappings, property transformations,
 * and relationship generation.
 */

import type {
  EventRecord,
  OutcomeRecord,
  EventOutcomePair,
  NormalizedEvent,
  NormalizedOutcome,
  NormalizedRelationship,
} from './types'

// =============================================================================
// Canonical Schema Types
// =============================================================================

/**
 * Canonical node labels in the Steel Frame model
 */
export type CanonicalNodeLabel = 
  | 'KnowledgeItem'
  | 'AIAgent'
  | 'Insight'
  | 'Event'
  | 'Outcome'

/**
 * Canonical relationship types
 */
export type CanonicalRelationshipType = 
  | 'DERIVED_FROM'
  | 'CAUSED'
  | 'LEADS_TO'
  | 'PART_OF'

/**
 * Severity levels
 */
export type Severity = 'info' | 'low' | 'medium' | 'high' | 'critical'

/**
 * Mapping configuration for an event type
 */
export interface EventTypeMapping {
  /** Node labels to apply */
  nodeLabels: string[]
  /** Property mappings */
  properties: Record<string, unknown>
  /** Relationship definitions */
  relationships?: RelationshipMapping[]
  /** Promotion rules */
  promoteTo?: {
    fromLabel: string
    toLabel: string
    relationship: string
  }
}

/**
 * Mapping configuration for an outcome type
 */
export interface OutcomeTypeMapping {
  /** Node labels to apply */
  nodeLabels: string[]
  /** Property mappings */
  properties: Record<string, unknown>
  /** Relationship definitions */
  relationships?: RelationshipMapping[]
}

/**
 * Relationship mapping definition
 */
export interface RelationshipMapping {
  /** Relationship type */
  type: string
  /** Target node type */
  target: string
  /** Property to use as target reference */
  targetProperty?: string
  /** Condition for creating relationship */
  condition?: string
  /** Source events for DERIVED_FROM */
  sourceEvents?: string
  /** Agent property for agent relationships */
  agentProperty?: string
}

/**
 * Property mapping configuration
 */
export interface PropertyMapping {
  /** Neo4j property name */
  neo4jProperty: string
  /** Whether property is required */
  required: boolean
  /** Property type */
  type: 'string' | 'integer' | 'float' | 'boolean' | 'datetime' | 'object'
  /** Default value if missing */
  default?: unknown
}

/**
 * Validation error
 */
export interface MappingValidationError {
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
 * Mapping result
 */
export interface MappingResult {
  /** Normalized events */
  events: NormalizedEvent[]
  /** Normalized outcomes */
  outcomes: NormalizedOutcome[]
  /** Normalized relationships */
  relationships: NormalizedRelationship[]
  /** Validation errors */
  errors: MappingValidationError[]
  /** Mapping statistics */
  stats: {
    inputPairs: number
    outputEvents: number
    outputOutcomes: number
    outputRelationships: number
    errorCount: number
    durationMs: number
  }
}

// =============================================================================
// Default Mappings
// =============================================================================

const DEFAULT_EVENT_TYPE_MAPPINGS: Record<string, EventTypeMapping> = {
  'task.started': {
    nodeLabels: ['Event'],
    properties: { type: 'task.started', category: 'task' },
    relationships: [
      { type: 'PART_OF', target: 'TaskRun', targetProperty: 'taskRunId' },
    ],
  },
  'task.completed': {
    nodeLabels: ['Event'],
    properties: { type: 'task.completed', category: 'task' },
    relationships: [
      { type: 'PART_OF', target: 'TaskRun', targetProperty: 'taskRunId' },
      { type: 'CAUSED', target: 'Outcome', condition: 'hasOutcome' },
    ],
  },
  'task.failed': {
    nodeLabels: ['Event'],
    properties: { type: 'task.failed', category: 'task', severity: 'high' },
    relationships: [
      { type: 'PART_OF', target: 'TaskRun', targetProperty: 'taskRunId' },
      { type: 'CAUSED', target: 'Outcome', condition: 'hasOutcome' },
    ],
  },
  'insight.created': {
    nodeLabels: ['Event'],
    properties: { type: 'insight.created', category: 'insight' },
    relationships: [
      { type: 'PART_OF', target: 'TaskRun', targetProperty: 'taskRunId' },
      { type: 'DERIVED_FROM', target: 'Event', sourceEvents: 'sourceEventIds' },
    ],
  },
  'insight.approved': {
    nodeLabels: ['Event'],
    properties: { type: 'insight.approved', category: 'insight' },
    relationships: [
      { type: 'PART_OF', target: 'TaskRun', targetProperty: 'taskRunId' },
    ],
    promoteTo: {
      fromLabel: 'Insight',
      toLabel: 'KnowledgeItem',
      relationship: 'SUPERSEDES',
    },
  },
  'insight.rejected': {
    nodeLabels: ['Event'],
    properties: { type: 'insight.rejected', category: 'insight' },
    relationships: [
      { type: 'PART_OF', target: 'TaskRun', targetProperty: 'taskRunId' },
    ],
  },
  'memory.stored': {
    nodeLabels: ['Event'],
    properties: { type: 'memory.stored', category: 'memory' },
    relationships: [
      { type: 'PART_OF', target: 'TaskRun', targetProperty: 'taskRunId' },
    ],
  },
  'memory.retrieved': {
    nodeLabels: ['Event'],
    properties: { type: 'memory.retrieved', category: 'memory' },
    relationships: [
      { type: 'PART_OF', target: 'TaskRun', targetProperty: 'taskRunId' },
    ],
  },
  'graph.node.created': {
    nodeLabels: ['Event'],
    properties: { type: 'graph.node.created', category: 'graph' },
    relationships: [
      { type: 'PART_OF', target: 'TaskRun', targetProperty: 'taskRunId' },
    ],
  },
  'graph.edge.created': {
    nodeLabels: ['Event'],
    properties: { type: 'graph.edge.created', category: 'graph' },
    relationships: [
      { type: 'PART_OF', target: 'TaskRun', targetProperty: 'taskRunId' },
    ],
  },
  'agent.action': {
    nodeLabels: ['Event'],
    properties: { type: 'agent.action', category: 'agent' },
    relationships: [
      { type: 'PART_OF', target: 'TaskRun', targetProperty: 'taskRunId' },
      { type: 'DERIVED_FROM', target: 'AIAgent', agentProperty: 'agentId' },
    ],
  },
  'agent.decision': {
    nodeLabels: ['Event'],
    properties: { type: 'agent.decision', category: 'agent' },
    relationships: [
      { type: 'PART_OF', target: 'TaskRun', targetProperty: 'taskRunId' },
      { type: 'DERIVED_FROM', target: 'AIAgent', agentProperty: 'agentId' },
    ],
  },
}

const DEFAULT_OUTCOME_TYPE_MAPPINGS: Record<string, OutcomeTypeMapping> = {
  success: {
    nodeLabels: ['Outcome'],
    properties: { type: 'success', category: 'result', severity: 'info' },
    relationships: [
      { type: 'DERIVED_FROM', target: 'Event' },
    ],
  },
  failure: {
    nodeLabels: ['Outcome'],
    properties: { type: 'failure', category: 'result', severity: 'high' },
    relationships: [
      { type: 'DERIVED_FROM', target: 'Event' },
    ],
  },
  partial: {
    nodeLabels: ['Outcome'],
    properties: { type: 'partial', category: 'result', severity: 'medium' },
    relationships: [
      { type: 'DERIVED_FROM', target: 'Event' },
    ],
  },
  pending: {
    nodeLabels: ['Outcome'],
    properties: { type: 'pending', category: 'result', severity: 'info' },
    relationships: [
      { type: 'DERIVED_FROM', target: 'Event' },
    ],
  },
  cancelled: {
    nodeLabels: ['Outcome'],
    properties: { type: 'cancelled', category: 'result', severity: 'low' },
    relationships: [
      { type: 'DERIVED_FROM', target: 'Event' },
    ],
  },
  timeout: {
    nodeLabels: ['Outcome'],
    properties: { type: 'timeout', category: 'result', severity: 'medium' },
    relationships: [
      { type: 'DERIVED_FROM', target: 'Event' },
    ],
  },
}

// =============================================================================
// Semantic Mapper Class
// =============================================================================

/**
 * Semantic Mapper
 * 
 * Transforms raw Event-Outcome pairs into normalized Neo4j graph structures.
 * Supports configurable mappings, property transformations, and relationship generation.
 */
export class SemanticMapper {
  private eventTypeMappings: Record<string, EventTypeMapping>
  private outcomeTypeMappings: Record<string, OutcomeTypeMapping>
  private skipInvalidRecords: boolean
  private maxValidationErrors: number

  constructor(config: {
    eventTypeMappings?: Record<string, EventTypeMapping>
    outcomeTypeMappings?: Record<string, OutcomeTypeMapping>
    skipInvalidRecords?: boolean
    maxValidationErrors?: number
  } = {}) {
    this.eventTypeMappings = {
      ...DEFAULT_EVENT_TYPE_MAPPINGS,
      ...config.eventTypeMappings,
    }
    this.outcomeTypeMappings = {
      ...DEFAULT_OUTCOME_TYPE_MAPPINGS,
      ...config.outcomeTypeMappings,
    }
    this.skipInvalidRecords = config.skipInvalidRecords ?? true
    this.maxValidationErrors = config.maxValidationErrors ?? 100
  }

  /**
   * Map Event-Outcome pairs to Neo4j format
   */
  async map(pairs: EventOutcomePair[]): Promise<MappingResult> {
    const startTime = Date.now()
    const events: NormalizedEvent[] = []
    const outcomes: NormalizedOutcome[] = []
    const relationships: NormalizedRelationship[] = []
    const errors: MappingValidationError[] = []

    for (const pair of pairs) {
      try {
        // Map event
        const mappedEvent = this.mapEvent(pair.event)
        if (mappedEvent) {
          events.push(mappedEvent.event)
          relationships.push(...mappedEvent.relationships)
        }

        // Map outcome if present
        if (pair.outcome) {
          const mappedOutcome = this.mapOutcome(pair.outcome, pair.event.id)
          if (mappedOutcome) {
            outcomes.push(mappedOutcome.outcome)
            relationships.push(...mappedOutcome.relationships)
          }
        }
      } catch (error) {
        const validationError: MappingValidationError = {
          entityType: 'event',
          entityId: pair.event.id,
          message: error instanceof Error ? error.message : 'Unknown mapping error',
          code: 'MAPPING_ERROR',
        }
        errors.push(validationError)

        if (!this.skipInvalidRecords) {
          throw error
        }

        if (errors.length >= this.maxValidationErrors) {
          break
        }
      }
    }

    const durationMs = Date.now() - startTime

    return {
      events,
      outcomes,
      relationships,
      errors,
      stats: {
        inputPairs: pairs.length,
        outputEvents: events.length,
        outputOutcomes: outcomes.length,
        outputRelationships: relationships.length,
        errorCount: errors.length,
        durationMs,
      },
    }
  }

  /**
   * Map a single event to Neo4j format
   */
  private mapEvent(event: EventRecord): {
    event: NormalizedEvent
    relationships: NormalizedRelationship[]
  } | null {
    const mapping = this.eventTypeMappings[event.eventType] ?? this.getDefaultEventMapping(event.eventType)
    const relationships: NormalizedRelationship[] = []

    // Create normalized event
    const normalizedEvent: NormalizedEvent = {
      id: `neo-event-${event.id}`,
      sourceId: event.id,
      type: event.eventType,
      timestamp: event.eventTime.toISOString(),
      properties: {
        ...mapping.properties,
        ...this.extractEventProperties(event),
        taskRunId: event.taskRunId,
        sequenceNo: event.sequenceNo,
      },
      metadata: {
        extractedAt: new Date().toISOString(),
        source: 'postgresql',
      },
    }

    // Generate relationships
    if (mapping.relationships) {
      for (const relMapping of mapping.relationships) {
        const relationship = this.createRelationship(normalizedEvent.id, relMapping, event)
        if (relationship) {
          relationships.push(relationship)
        }
      }
    }

    return { event: normalizedEvent, relationships }
  }

  /**
   * Map a single outcome to Neo4j format
   */
  private mapOutcome(outcome: OutcomeRecord, eventId: string): {
    outcome: NormalizedOutcome
    relationships: NormalizedRelationship[]
  } | null {
    const mapping = this.outcomeTypeMappings[outcome.outcomeType] ?? 
      this.getDefaultOutcomeMapping(outcome.outcomeType)
    const relationships: NormalizedRelationship[] = []

    // Create normalized outcome
    const normalizedOutcome: NormalizedOutcome = {
      id: `neo-outcome-${outcome.id}`,
      sourceId: outcome.id,
      eventId: `neo-event-${eventId}`,
      type: outcome.outcomeType,
      timestamp: outcome.occurredAt.toISOString(),
      severity: outcome.severity,
      summary: outcome.summary,
      properties: {
        ...mapping.properties,
        ...this.extractOutcomeProperties(outcome),
        taskRunId: outcome.taskRunId,
      },
      metadata: {
        extractedAt: new Date().toISOString(),
        source: 'postgresql',
      },
    }

    // Create DERIVED_FROM relationship
    relationships.push({
      eventId: `neo-event-${eventId}`,
      outcomeId: normalizedOutcome.id,
      type: 'DERIVED_FROM',
      properties: {
        createdAt: new Date().toISOString(),
      },
    })

    return { outcome: normalizedOutcome, relationships }
  }

  /**
   * Extract event properties
   */
  private extractEventProperties(event: EventRecord): Record<string, unknown> {
    const properties: Record<string, unknown> = {}

    // Copy payload properties
    if (event.payload) {
      const { action, resource, details } = event.payload as {
        action?: string
        resource?: string
        details?: Record<string, unknown>
      }
      if (action) properties.action = action
      if (resource) properties.resource = resource
      if (details) properties.details = details
    }

    return properties
  }

  /**
   * Extract outcome properties
   */
  private extractOutcomeProperties(outcome: OutcomeRecord): Record<string, unknown> {
    const properties: Record<string, unknown> = {}

    // Copy details properties
    if (outcome.details) {
      const { result, confidence, error, duration } = outcome.details as {
        result?: string
        confidence?: number
        error?: string
        duration?: number
      }
      if (result) properties.result = result
      if (confidence !== undefined) properties.confidence = confidence
      if (error) properties.error = error
      if (duration !== undefined) properties.duration = duration
    }

    return properties
  }

  /**
   * Create a relationship from mapping
   */
  private createRelationship(
    sourceId: string,
    mapping: RelationshipMapping,
    event: EventRecord
  ): NormalizedRelationship | null {
    // Check condition
    if (mapping.condition === 'hasOutcome' && !event) {
      return null
    }

    // Create relationship based on type
    switch (mapping.type) {
      case 'PART_OF':
        return {
          eventId: sourceId,
          outcomeId: `neo-taskrun-${event.taskRunId}`,
          type: 'PART_OF',
          properties: {
            createdAt: new Date().toISOString(),
          },
        }
      case 'CAUSED':
        return {
          eventId: sourceId,
          outcomeId: '', // Will be filled when outcome is created
          type: 'CAUSED',
          properties: {
            createdAt: new Date().toISOString(),
          },
        }
      case 'DERIVED_FROM':
        if (mapping.agentProperty) {
          const agentId = (event.payload as { agentId?: string })?.agentId
          if (agentId) {
            return {
              eventId: sourceId,
              outcomeId: `neo-agent-${agentId}`,
              type: 'DERIVED_FROM',
              properties: {
                createdAt: new Date().toISOString(),
              },
            }
          }
        }
        return null
      default:
        return null
    }
  }

  /**
   * Get default mapping for unknown event types
   */
  private getDefaultEventMapping(eventType: string): EventTypeMapping {
    return {
      nodeLabels: ['Event'],
      properties: {
        type: eventType,
        category: 'unknown',
      },
      relationships: [
        { type: 'PART_OF', target: 'TaskRun', targetProperty: 'taskRunId' },
      ],
    }
  }

  /**
   * Get default mapping for unknown outcome types
   */
  private getDefaultOutcomeMapping(outcomeType: string): OutcomeTypeMapping {
    return {
      nodeLabels: ['Outcome'],
      properties: {
        type: outcomeType,
        category: 'unknown',
        severity: 'info',
      },
      relationships: [
        { type: 'DERIVED_FROM', target: 'Event' },
      ],
    }
  }

  /**
   * Register a custom event type mapping
   */
  registerEventTypeMapping(eventType: string, mapping: EventTypeMapping): void {
    this.eventTypeMappings[eventType] = mapping
  }

  /**
   * Register a custom outcome type mapping
   */
  registerOutcomeTypeMapping(outcomeType: string, mapping: OutcomeTypeMapping): void {
    this.outcomeTypeMappings[outcomeType] = mapping
  }

  /**
   * Get all registered event type mappings
   */
  getEventTypeMappings(): Record<string, EventTypeMapping> {
    return { ...this.eventTypeMappings }
  }

  /**
   * Get all registered outcome type mappings
   */
  getOutcomeTypeMappings(): Record<string, OutcomeTypeMapping> {
    return { ...this.outcomeTypeMappings }
  }
}

// =============================================================================
// Factory Function
// =============================================================================

/**
 * Create a semantic mapper
 */
export function createMapper(config: {
  eventTypeMappings?: Record<string, EventTypeMapping>
  outcomeTypeMappings?: Record<string, OutcomeTypeMapping>
  skipInvalidRecords?: boolean
  maxValidationErrors?: number
} = {}): SemanticMapper {
  return new SemanticMapper(config)
}

// =============================================================================
// Default Export
// =============================================================================

export default SemanticMapper