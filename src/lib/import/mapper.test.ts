/**
 * Semantic Mapper Tests
 * 
 * Tests for mapping heterogeneous trace data to normalized Neo4j schema.
 */

import { describe, it, expect, beforeEach } from 'vitest'
import { SemanticMapper, createMapper } from './mapper'
import type { EventOutcomePair, EventRecord, OutcomeRecord } from './types'
import type { EventTypeMapping, OutcomeTypeMapping, MappingResult } from './mapper'

// =============================================================================
// Test Fixtures
// =============================================================================

function createTestEvent(overrides: Partial<EventRecord> = {}): EventRecord {
  return {
    id: `event-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    taskRunId: 'task-run-123',
    eventType: 'task.started',
    eventTime: new Date(),
    sequenceNo: 0,
    payload: { action: 'read', resource: 'user' },
    createdAt: new Date(),
    ...overrides,
  }
}

function createTestOutcome(overrides: Partial<OutcomeRecord> = {}): OutcomeRecord {
  return {
    id: `outcome-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    taskRunId: 'task-run-123',
    outcomeType: 'success',
    severity: 'info',
    summary: 'Test outcome',
    details: { result: 'ok', confidence: 0.95 },
    eventId: undefined,
    occurredAt: new Date(),
    createdAt: new Date(),
    ...overrides,
  }
}

function createTestPair(
  eventOverrides: Partial<EventRecord> = {},
  outcomeOverrides: Partial<OutcomeRecord> = {}
): EventOutcomePair {
  return {
    event: createTestEvent(eventOverrides),
    outcome: createTestOutcome(outcomeOverrides),
    extractedAt: new Date(),
  }
}

// =============================================================================
// Semantic Mapper Tests
// =============================================================================

describe('SemanticMapper', () => {
  let mapper: SemanticMapper

  beforeEach(() => {
    mapper = createMapper()
  })

  // =============================================================================
  // Basic Mapping Tests
  // =============================================================================

  describe('map', () => {
    it('should map Event-Outcome pairs to normalized format', async () => {
      const pairs: EventOutcomePair[] = [createTestPair()]

      const result = await mapper.map(pairs)

      expect(result.events).toBeDefined()
      expect(result.events.length).toBe(1)
      expect(result.outcomes).toBeDefined()
      expect(result.outcomes.length).toBe(1)
    })

    it('should return mapping statistics', async () => {
      const pairs: EventOutcomePair[] = [
        createTestPair(),
        createTestPair({ eventType: 'task.completed' }),
      ]

      const result = await mapper.map(pairs)

      expect(result.stats).toBeDefined()
      expect(result.stats.inputPairs).toBe(2)
      expect(result.stats.outputEvents).toBe(2)
      expect(result.stats.outputOutcomes).toBe(2)
      expect(result.stats.durationMs).toBeGreaterThanOrEqual(0)
    })

    it('should return empty arrays for empty input', async () => {
      const result = await mapper.map([])

      expect(result.events).toEqual([])
      expect(result.outcomes).toEqual([])
      expect(result.relationships).toEqual([])
      expect(result.stats.inputPairs).toBe(0)
    })

    it('should handle events without outcomes', async () => {
      const pairs: EventOutcomePair[] = [
        {
          event: createTestEvent(),
          outcome: null,
          extractedAt: new Date(),
        },
      ]

      const result = await mapper.map(pairs)

      expect(result.events.length).toBe(1)
      expect(result.outcomes.length).toBe(0)
    })

    it('should preserve event properties', async () => {
      const pairs: EventOutcomePair[] = [
        createTestPair({
          eventType: 'task.completed',
          payload: { action: 'write', resource: 'document', details: { count: 5 } },
        }),
      ]

      const result = await mapper.map(pairs)

      expect(result.events[0].properties.action).toBe('write')
      expect(result.events[0].properties.resource).toBe('document')
    })

    it('should preserve outcome properties', async () => {
      const pairs: EventOutcomePair[] = [
        createTestPair(
          {},
          {
            outcomeType: 'failure',
            severity: 'high',
            summary: 'Task failed',
            details: { result: 'error', error: 'Connection timeout', confidence: 0.8 },
          }
        ),
      ]

      const result = await mapper.map(pairs)

      expect(result.outcomes[0].severity).toBe('high')
      expect(result.outcomes[0].summary).toBe('Task failed')
      expect(result.outcomes[0].properties.result).toBe('error')
    })
  })

  // =============================================================================
  // Event Type Mapping Tests
  // =============================================================================

  describe('event type mappings', () => {
    it('should map task.started events', async () => {
      const pairs: EventOutcomePair[] = [
        createTestPair({ eventType: 'task.started' }),
      ]

      const result = await mapper.map(pairs)

      expect(result.events[0].type).toBe('task.started')
      expect(result.events[0].properties.category).toBe('task')
    })

    it('should map task.completed events', async () => {
      const pairs: EventOutcomePair[] = [
        createTestPair({ eventType: 'task.completed' }),
      ]

      const result = await mapper.map(pairs)

      expect(result.events[0].type).toBe('task.completed')
      expect(result.events[0].properties.category).toBe('task')
    })

    it('should map task.failed events with high severity', async () => {
      const pairs: EventOutcomePair[] = [
        createTestPair({ eventType: 'task.failed' }),
      ]

      const result = await mapper.map(pairs)

      expect(result.events[0].type).toBe('task.failed')
      expect(result.events[0].properties.severity).toBe('high')
    })

    it('should map insight.created events', async () => {
      const pairs: EventOutcomePair[] = [
        createTestPair({ eventType: 'insight.created' }),
      ]

      const result = await mapper.map(pairs)

      expect(result.events[0].type).toBe('insight.created')
      expect(result.events[0].properties.category).toBe('insight')
    })

    it('should map insight.approved events', async () => {
      const pairs: EventOutcomePair[] = [
        createTestPair({ eventType: 'insight.approved' }),
      ]

      const result = await mapper.map(pairs)

      expect(result.events[0].type).toBe('insight.approved')
      expect(result.events[0].properties.category).toBe('insight')
    })

    it('should map insight.rejected events', async () => {
      const pairs: EventOutcomePair[] = [
        createTestPair({ eventType: 'insight.rejected' }),
      ]

      const result = await mapper.map(pairs)

      expect(result.events[0].type).toBe('insight.rejected')
      expect(result.events[0].properties.category).toBe('insight')
    })

    it('should map memory.stored events', async () => {
      const pairs: EventOutcomePair[] = [
        createTestPair({ eventType: 'memory.stored' }),
      ]

      const result = await mapper.map(pairs)

      expect(result.events[0].type).toBe('memory.stored')
      expect(result.events[0].properties.category).toBe('memory')
    })

    it('should map memory.retrieved events', async () => {
      const pairs: EventOutcomePair[] = [
        createTestPair({ eventType: 'memory.retrieved' }),
      ]

      const result = await mapper.map(pairs)

      expect(result.events[0].type).toBe('memory.retrieved')
      expect(result.events[0].properties.category).toBe('memory')
    })

    it('should map graph.node.created events', async () => {
      const pairs: EventOutcomePair[] = [
        createTestPair({ eventType: 'graph.node.created' }),
      ]

      const result = await mapper.map(pairs)

      expect(result.events[0].type).toBe('graph.node.created')
      expect(result.events[0].properties.category).toBe('graph')
    })

    it('should map graph.edge.created events', async () => {
      const pairs: EventOutcomePair[] = [
        createTestPair({ eventType: 'graph.edge.created' }),
      ]

      const result = await mapper.map(pairs)

      expect(result.events[0].type).toBe('graph.edge.created')
      expect(result.events[0].properties.category).toBe('graph')
    })

    it('should map agent.action events', async () => {
      const pairs: EventOutcomePair[] = [
        createTestPair({
          eventType: 'agent.action',
          payload: { agentId: 'agent-001' },
        }),
      ]

      const result = await mapper.map(pairs)

      expect(result.events[0].type).toBe('agent.action')
      expect(result.events[0].properties.category).toBe('agent')
    })

    it('should map agent.decision events', async () => {
      const pairs: EventOutcomePair[] = [
        createTestPair({
          eventType: 'agent.decision',
          payload: { agentId: 'agent-002' },
        }),
      ]

      const result = await mapper.map(pairs)

      expect(result.events[0].type).toBe('agent.decision')
      expect(result.events[0].properties.category).toBe('agent')
    })

    it('should handle unknown event types', async () => {
      const pairs: EventOutcomePair[] = [
        createTestPair({ eventType: 'unknown.event.type' }),
      ]

      const result = await mapper.map(pairs)

      expect(result.events[0].type).toBe('unknown.event.type')
      expect(result.events[0].properties.category).toBe('unknown')
    })
  })

  // =============================================================================
  // Outcome Type Mapping Tests
  // =============================================================================

  describe('outcome type mappings', () => {
    it('should map success outcomes', async () => {
      const pairs: EventOutcomePair[] = [
        createTestPair({}, { outcomeType: 'success', severity: 'info' }),
      ]

      const result = await mapper.map(pairs)

      expect(result.outcomes[0].type).toBe('success')
      expect(result.outcomes[0].severity).toBe('info')
    })

    it('should map failure outcomes with high severity', async () => {
      const pairs: EventOutcomePair[] = [
        createTestPair({}, { outcomeType: 'failure', severity: 'high' }),
      ]

      const result = await mapper.map(pairs)

      expect(result.outcomes[0].type).toBe('failure')
      expect(result.outcomes[0].severity).toBe('high')
    })

    it('should map partial outcomes with medium severity', async () => {
      const pairs: EventOutcomePair[] = [
        createTestPair({}, { outcomeType: 'partial', severity: 'medium' }),
      ]

      const result = await mapper.map(pairs)

      expect(result.outcomes[0].type).toBe('partial')
      expect(result.outcomes[0].severity).toBe('medium')
    })

    it('should map pending outcomes', async () => {
      const pairs: EventOutcomePair[] = [
        createTestPair({}, { outcomeType: 'pending', severity: 'info' }),
      ]

      const result = await mapper.map(pairs)

      expect(result.outcomes[0].type).toBe('pending')
    })

    it('should map cancelled outcomes with low severity', async () => {
      const pairs: EventOutcomePair[] = [
        createTestPair({}, { outcomeType: 'cancelled', severity: 'low' }),
      ]

      const result = await mapper.map(pairs)

      expect(result.outcomes[0].type).toBe('cancelled')
      expect(result.outcomes[0].severity).toBe('low')
    })

    it('should map timeout outcomes with medium severity', async () => {
      const pairs: EventOutcomePair[] = [
        createTestPair({}, { outcomeType: 'timeout', severity: 'medium' }),
      ]

      const result = await mapper.map(pairs)

      expect(result.outcomes[0].type).toBe('timeout')
      expect(result.outcomes[0].severity).toBe('medium')
    })

    it('should handle unknown outcome types', async () => {
      const pairs: EventOutcomePair[] = [
        createTestPair({}, { outcomeType: 'unknown.outcome' }),
      ]

      const result = await mapper.map(pairs)

      expect(result.outcomes[0].type).toBe('unknown.outcome')
      expect(result.outcomes[0].properties.category).toBe('unknown')
    })
  })

  // =============================================================================
  // Relationship Tests
  // =============================================================================

  describe('relationships', () => {
    it('should create PART_OF relationship for events', async () => {
      const pairs: EventOutcomePair[] = [createTestPair()]

      const result = await mapper.map(pairs)

      expect(result.relationships.length).toBeGreaterThan(0)
      expect(result.relationships.some(r => r.type === 'PART_OF')).toBe(true)
    })

    it('should create DERIVED_FROM relationship for outcomes', async () => {
      const pairs: EventOutcomePair[] = [createTestPair()]

      const result = await mapper.map(pairs)

      expect(result.relationships.some(r => r.type === 'DERIVED_FROM')).toBe(true)
    })

    it('should link outcomes to their source events', async () => {
      const pairs: EventOutcomePair[] = [createTestPair()]

      const result = await mapper.map(pairs)

      // Outcome should reference the event
      expect(result.outcomes[0].eventId).toBe(result.events[0].id)
    })
  })

  // =============================================================================
  // Property Transformation Tests
  // =============================================================================

  describe('property transformations', () => {
    it('should generate Neo4j-compatible IDs', async () => {
      const pairs: EventOutcomePair[] = [createTestPair()]

      const result = await mapper.map(pairs)

      expect(result.events[0].id).toMatch(/^neo-event-/)
      expect(result.outcomes[0].id).toMatch(/^neo-outcome-/)
    })

    it('should include source ID', async () => {
      const pairs: EventOutcomePair[] = [createTestPair()]

      const result = await mapper.map(pairs)

      expect(result.events[0].sourceId).toBeDefined()
      expect(result.outcomes[0].sourceId).toBeDefined()
    })

    it('should include timestamps in ISO format', async () => {
      const pairs: EventOutcomePair[] = [createTestPair()]

      const result = await mapper.map(pairs)

      expect(result.events[0].timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T/)
      expect(result.outcomes[0].timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T/)
    })

    it('should include metadata', async () => {
      const pairs: EventOutcomePair[] = [createTestPair()]

      const result = await mapper.map(pairs)

      expect(result.events[0].metadata).toBeDefined()
      expect(result.events[0].metadata.source).toBe('postgresql')
      expect(result.events[0].metadata.extractedAt).toBeDefined()
    })

    it('should include task run ID in properties', async () => {
      const pairs: EventOutcomePair[] = [
        createTestPair(
          { taskRunId: 'task-run-456' },
          { taskRunId: 'task-run-456' }
        ),
      ]

      const result = await mapper.map(pairs)

      expect(result.events[0].properties.taskRunId).toBe('task-run-456')
      expect(result.outcomes[0].properties.taskRunId).toBe('task-run-456')
    })

    it('should include sequence number in event properties', async () => {
      const pairs: EventOutcomePair[] = [
        createTestPair({ sequenceNo: 42 }),
      ]

      const result = await mapper.map(pairs)

      expect(result.events[0].properties.sequenceNo).toBe(42)
    })
  })

  // =============================================================================
  // Error Handling Tests
  // =============================================================================

  describe('error handling', () => {
    it('should collect validation errors', async () => {
      const pairs: EventOutcomePair[] = [createTestPair()]

      const result = await mapper.map(pairs)

      expect(result.errors).toBeDefined()
      expect(Array.isArray(result.errors)).toBe(true)
    })

    it('should skip invalid records when configured', async () => {
      const skipMapper = createMapper({ skipInvalidRecords: true })

      const pairs: EventOutcomePair[] = [createTestPair()]

      const result = await skipMapper.map(pairs)

      // Should not throw and should process valid records
      expect(result.events.length).toBe(1)
    })

    it('should track error count in stats', async () => {
      const pairs: EventOutcomePair[] = [createTestPair()]

      const result = await mapper.map(pairs)

      expect(result.stats.errorCount).toBe(result.errors.length)
    })

    it('should respect max validation errors limit', async () => {
      const limitedMapper = createMapper({ maxValidationErrors: 5 })

      // Create many pairs
      const pairs: EventOutcomePair[] = Array.from({ length: 10 }, () => createTestPair())

      const result = await limitedMapper.map(pairs)

      // Should process all pairs since they're valid
      expect(result.events.length).toBe(10)
    })
  })

  // =============================================================================
  // Custom Mapping Tests
  // =============================================================================

  describe('custom mappings', () => {
    it('should register custom event type mapping', async () => {
      const customMapping: EventTypeMapping = {
        nodeLabels: ['Event'],
        properties: { type: 'custom.event', category: 'custom' },
        relationships: [
          { type: 'PART_OF', target: 'TaskRun', targetProperty: 'taskRunId' },
        ],
      }

      mapper.registerEventTypeMapping('custom.event', customMapping)

      const pairs: EventOutcomePair[] = [
        createTestPair({ eventType: 'custom.event' }),
      ]

      const result = await mapper.map(pairs)

      expect(result.events[0].type).toBe('custom.event')
      expect(result.events[0].properties.category).toBe('custom')
    })

    it('should register custom outcome type mapping', async () => {
      const customMapping: OutcomeTypeMapping = {
        nodeLabels: ['Outcome'],
        properties: { type: 'custom.outcome', category: 'custom', severity: 'critical' },
        relationships: [
          { type: 'DERIVED_FROM', target: 'Event' },
        ],
      }

      mapper.registerOutcomeTypeMapping('custom.outcome', customMapping)

      const pairs: EventOutcomePair[] = [
        createTestPair({}, { outcomeType: 'custom.outcome' }),
      ]

      const result = await mapper.map(pairs)

      expect(result.outcomes[0].type).toBe('custom.outcome')
      expect(result.outcomes[0].properties.category).toBe('custom')
    })

    it('should get all registered event type mappings', () => {
      const mappings = mapper.getEventTypeMappings()

      expect(mappings).toBeDefined()
      expect(mappings['task.started']).toBeDefined()
      expect(mappings['task.completed']).toBeDefined()
    })

    it('should get all registered outcome type mappings', () => {
      const mappings = mapper.getOutcomeTypeMappings()

      expect(mappings).toBeDefined()
      expect(mappings['success']).toBeDefined()
      expect(mappings['failure']).toBeDefined()
    })
  })

  // =============================================================================
  // Configuration Tests
  // =============================================================================

  describe('configuration', () => {
    it('should use custom event type mappings', async () => {
      const customMapper = createMapper({
        eventTypeMappings: {
          'custom.event': {
            nodeLabels: ['Event'],
            properties: { type: 'custom.event', category: 'custom' },
          },
        },
      })

      const pairs: EventOutcomePair[] = [
        createTestPair({ eventType: 'custom.event' }),
      ]

      const result = await customMapper.map(pairs)

      expect(result.events[0].type).toBe('custom.event')
      expect(result.events[0].properties.category).toBe('custom')
    })

    it('should use custom outcome type mappings', async () => {
      const customMapper = createMapper({
        outcomeTypeMappings: {
          'custom.outcome': {
            nodeLabels: ['Outcome'],
            properties: { type: 'custom.outcome', category: 'custom' },
          },
        },
      })

      const pairs: EventOutcomePair[] = [
        createTestPair({}, { outcomeType: 'custom.outcome' }),
      ]

      const result = await customMapper.map(pairs)

      expect(result.outcomes[0].type).toBe('custom.outcome')
    })

    it('should configure skip invalid records', () => {
      const skipMapper = createMapper({ skipInvalidRecords: false })
      expect(skipMapper).toBeInstanceOf(SemanticMapper)
    })

    it('should configure max validation errors', () => {
      const limitedMapper = createMapper({ maxValidationErrors: 50 })
      expect(limitedMapper).toBeInstanceOf(SemanticMapper)
    })
  })
})

// =============================================================================
// Integration Tests
// =============================================================================

describe('SemanticMapper Integration', () => {
  it('should process realistic batch of events', async () => {
    const mapper = createMapper()

    const pairs: EventOutcomePair[] = [
      createTestPair({ eventType: 'task.started', sequenceNo: 0 }),
      createTestPair({ eventType: 'task.completed', sequenceNo: 1 }),
      createTestPair({ eventType: 'insight.created', sequenceNo: 2 }),
      createTestPair({ eventType: 'memory.stored', sequenceNo: 3 }),
      createTestPair({ eventType: 'agent.action', sequenceNo: 4 }),
    ]

    const result = await mapper.map(pairs)

    expect(result.events.length).toBe(5)
    expect(result.outcomes.length).toBe(5)
    expect(result.relationships.length).toBeGreaterThan(5)
  })

  it('should process heterogeneous events', async () => {
    const mapper = createMapper()

    const pairs: EventOutcomePair[] = [
      createTestPair(
        { eventType: 'task.failed' },
        { outcomeType: 'failure', severity: 'high' }
      ),
      createTestPair(
        { eventType: 'task.completed' },
        { outcomeType: 'success', severity: 'info' }
      ),
      createTestPair(
        { eventType: 'insight.created' },
        { outcomeType: 'pending', severity: 'info' }
      ),
    ]

    const result = await mapper.map(pairs)

    // All events should be mapped
    expect(result.events.length).toBe(3)

    // All outcomes should be mapped
    expect(result.outcomes.length).toBe(3)

    // Categories should be preserved
    expect(result.events[0].properties.category).toBe('task')
    expect(result.events[1].properties.category).toBe('task')
    expect(result.events[2].properties.category).toBe('insight')
  })

  it('should handle large batches efficiently', async () => {
    const mapper = createMapper()

    // Create 100 pairs
    const pairs: EventOutcomePair[] = Array.from({ length: 100 }, (_, i) =>
      createTestPair({ eventType: 'task.started', sequenceNo: i })
    )

    const startTime = Date.now()
    const result = await mapper.map(pairs)
    const duration = Date.now() - startTime

    expect(result.events.length).toBe(100)
    expect(result.outcomes.length).toBe(100)
    expect(duration).toBeLessThan(1000) // Should process in under 1 second
  })
})

// =============================================================================
// Factory Function Tests
// =============================================================================

describe('createMapper', () => {
  it('should create mapper with default config', () => {
    const mapper = createMapper()
    expect(mapper).toBeInstanceOf(SemanticMapper)
  })

  it('should create mapper with custom config', () => {
    const mapper = createMapper({
      skipInvalidRecords: false,
      maxValidationErrors: 50,
    })
    expect(mapper).toBeInstanceOf(SemanticMapper)
  })
})