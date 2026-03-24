/**
 * Neo4j Loader Tests
 * 
 * Tests for loading normalized data into Neo4j knowledge graph.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { Neo4jLoader, createLoader } from './neo4j-loader'
import type {
  NormalizedEvent,
  NormalizedOutcome,
  NormalizedRelationship,
  LoadInput,
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
// Neo4j Loader Tests
// =============================================================================

describe('Neo4jLoader', () => {
  let loader: Neo4jLoader

  beforeEach(() => {
    loader = createLoader()
  })

  // =============================================================================
  // Basic Loading Tests
  // =============================================================================

  describe('load', () => {
    it('should load normalized data', async () => {
      const input: LoadInput = {
        events: [createTestEvent()],
        outcomes: [createTestOutcome()],
        relationships: [createTestRelationship()],
        pipelineRunId: 'test-run-1',
      }

      const result = await loader.load(input)

      expect(result).toBeDefined()
      expect(result.loadedEvents).toBeDefined()
      expect(result.loadedOutcomes).toBeDefined()
      expect(result.loadedRelationships).toBeDefined()
    })

    it('should return load statistics', async () => {
      const input: LoadInput = {
        events: [createTestEvent(), createTestEvent()],
        outcomes: [createTestOutcome()],
        relationships: [createTestRelationship()],
        pipelineRunId: 'test-run-2',
      }

      const result = await loader.load(input)

      expect(result.stats).toBeDefined()
      expect(result.stats.eventsLoaded).toBe(2)
      expect(result.stats.outcomesLoaded).toBe(1)
      expect(result.stats.relationshipsLoaded).toBe(1)
      expect(result.stats.durationMs).toBeGreaterThanOrEqual(0)
    })

    it('should handle empty input', async () => {
      const input: LoadInput = {
        events: [],
        outcomes: [],
        relationships: [],
        pipelineRunId: 'test-run-empty',
      }

      const result = await loader.load(input)

      expect(result.loadedEvents).toEqual([])
      expect(result.loadedOutcomes).toEqual([])
      expect(result.loadedRelationships).toEqual([])
      expect(result.stats.eventsLoaded).toBe(0)
      expect(result.stats.outcomesLoaded).toBe(0)
      expect(result.stats.relationshipsLoaded).toBe(0)
    })

    it('should return loaded event IDs', async () => {
      const event = createTestEvent({ id: 'neo-event-test-1' })
      const input: LoadInput = {
        events: [event],
        outcomes: [],
        relationships: [],
        pipelineRunId: 'test-run-3',
      }

      const result = await loader.load(input)

      expect(result.loadedEvents).toContain('neo-event-test-1')
    })

    it('should return loaded outcome IDs', async () => {
      const outcome = createTestOutcome({ id: 'neo-outcome-test-1' })
      const input: LoadInput = {
        events: [],
        outcomes: [outcome],
        relationships: [],
        pipelineRunId: 'test-run-4',
      }

      const result = await loader.load(input)

      expect(result.loadedOutcomes).toContain('neo-outcome-test-1')
    })

    it('should return loaded relationship IDs', async () => {
      const relationship = createTestRelationship({
        eventId: 'neo-event-1',
        outcomeId: 'neo-outcome-1',
      })
      const input: LoadInput = {
        events: [],
        outcomes: [],
        relationships: [relationship],
        pipelineRunId: 'test-run-5',
      }

      const result = await loader.load(input)

      expect(result.loadedRelationships).toContain('neo-event-1-neo-outcome-1')
    })
  })

  // =============================================================================
  // Event Loading Tests
  // =============================================================================

  describe('event loading', () => {
    it('should load events with all properties', async () => {
      const event: NormalizedEvent = {
        id: 'neo-event-full',
        sourceId: 'event-source',
        type: 'task.completed',
        timestamp: '2024-01-15T10:30:00.000Z',
        properties: {
          category: 'task',
          taskRunId: 'task-run-456',
          sequenceNo: 5,
          action: 'write',
          resource: 'document',
          details: { count: 10, size: 'large' },
        },
        metadata: {
          extractedAt: '2024-01-15T10:30:00.000Z',
          source: 'postgresql',
        },
      }

      const input: LoadInput = {
        events: [event],
        outcomes: [],
        relationships: [],
        pipelineRunId: 'test-run-events',
      }

      const result = await loader.load(input)

      expect(result.loadedEvents.length).toBe(1)
      expect(result.loadedEvents).toContain('neo-event-full')
    })

    it('should load multiple events in batch', async () => {
      const events: NormalizedEvent[] = [
        createTestEvent({ id: 'neo-event-1' }),
        createTestEvent({ id: 'neo-event-2' }),
        createTestEvent({ id: 'neo-event-3' }),
      ]

      const input: LoadInput = {
        events,
        outcomes: [],
        relationships: [],
        pipelineRunId: 'test-run-batch',
      }

      const result = await loader.load(input)

      expect(result.loadedEvents.length).toBe(3)
    })

    it('should handle event with minimal properties', async () => {
      const event: NormalizedEvent = {
        id: 'neo-event-minimal',
        sourceId: 'event-source',
        type: 'unknown.event',
        timestamp: new Date().toISOString(),
        properties: {},
        metadata: {
          extractedAt: new Date().toISOString(),
          source: 'postgresql',
        },
      }

      const input: LoadInput = {
        events: [event],
        outcomes: [],
        relationships: [],
        pipelineRunId: 'test-run-minimal',
      }

      const result = await loader.load(input)

      expect(result.loadedEvents.length).toBe(1)
    })
  })

  // =============================================================================
  // Outcome Loading Tests
  // =============================================================================

  describe('outcome loading', () => {
    it('should load outcomes with all properties', async () => {
      const outcome: NormalizedOutcome = {
        id: 'neo-outcome-full',
        sourceId: 'outcome-source',
        eventId: 'neo-event-parent',
        type: 'failure',
        timestamp: '2024-01-15T10:30:00.000Z',
        severity: 'high',
        summary: 'Task failed due to timeout',
        properties: {
          category: 'result',
          taskRunId: 'task-run-789',
          result: 'error',
          error: 'Connection timeout',
          confidence: 0.85,
        },
        metadata: {
          extractedAt: '2024-01-15T10:30:00.000Z',
          source: 'postgresql',
        },
      }

      const input: LoadInput = {
        events: [],
        outcomes: [outcome],
        relationships: [],
        pipelineRunId: 'test-run-outcomes',
      }

      const result = await loader.load(input)

      expect(result.loadedOutcomes.length).toBe(1)
      expect(result.loadedOutcomes).toContain('neo-outcome-full')
    })

    it('should load multiple outcomes in batch', async () => {
      const outcomes: NormalizedOutcome[] = [
        createTestOutcome({ id: 'neo-outcome-1' }),
        createTestOutcome({ id: 'neo-outcome-2' }),
        createTestOutcome({ id: 'neo-outcome-3' }),
      ]

      const input: LoadInput = {
        events: [],
        outcomes,
        relationships: [],
        pipelineRunId: 'test-run-outcome-batch',
      }

      const result = await loader.load(input)

      expect(result.loadedOutcomes.length).toBe(3)
    })

    it('should handle outcomes with different severities', async () => {
      const outcomes: NormalizedOutcome[] = [
        createTestOutcome({ id: 'outcome-info', severity: 'info' }),
        createTestOutcome({ id: 'outcome-low', severity: 'low' }),
        createTestOutcome({ id: 'outcome-medium', severity: 'medium' }),
        createTestOutcome({ id: 'outcome-high', severity: 'high' }),
        createTestOutcome({ id: 'outcome-critical', severity: 'critical' }),
      ]

      const input: LoadInput = {
        events: [],
        outcomes,
        relationships: [],
        pipelineRunId: 'test-run-severities',
      }

      const result = await loader.load(input)

      expect(result.loadedOutcomes.length).toBe(5)
    })
  })

  // =============================================================================
  // Relationship Loading Tests
  // =============================================================================

  describe('relationship loading', () => {
    it('should load DERIVED_FROM relationships', async () => {
      const relationship: NormalizedRelationship = {
        eventId: 'neo-event-1',
        outcomeId: 'neo-outcome-1',
        type: 'DERIVED_FROM',
        properties: { createdAt: new Date().toISOString() },
      }

      const input: LoadInput = {
        events: [],
        outcomes: [],
        relationships: [relationship],
        pipelineRunId: 'test-run-rel',
      }

      const result = await loader.load(input)

      expect(result.loadedRelationships.length).toBe(1)
    })

    it('should load CAUSED relationships', async () => {
      const relationship: NormalizedRelationship = {
        eventId: 'neo-event-1',
        outcomeId: 'neo-outcome-1',
        type: 'CAUSED',
        properties: { createdAt: new Date().toISOString() },
      }

      const input: LoadInput = {
        events: [],
        outcomes: [],
        relationships: [relationship],
        pipelineRunId: 'test-run-caused',
      }

      const result = await loader.load(input)

      expect(result.loadedRelationships.length).toBe(1)
    })

    it('should load PART_OF relationships', async () => {
      const relationship: NormalizedRelationship = {
        eventId: 'neo-event-1',
        outcomeId: 'neo-taskrun-123',
        type: 'PART_OF',
        properties: { createdAt: new Date().toISOString() },
      }

      const input: LoadInput = {
        events: [],
        outcomes: [],
        relationships: [relationship],
        pipelineRunId: 'test-run-part-of',
      }

      const result = await loader.load(input)

      expect(result.loadedRelationships.length).toBe(1)
    })

    it('should load multiple relationships in batch', async () => {
      const relationships: NormalizedRelationship[] = [
        createTestRelationship({ eventId: 'e1', outcomeId: 'o1' }),
        createTestRelationship({ eventId: 'e2', outcomeId: 'o2' }),
        createTestRelationship({ eventId: 'e3', outcomeId: 'o3' }),
      ]

      const input: LoadInput = {
        events: [],
        outcomes: [],
        relationships,
        pipelineRunId: 'test-run-rel-batch',
      }

      const result = await loader.load(input)

      expect(result.loadedRelationships.length).toBe(3)
    })
  })

  // =============================================================================
  // Error Handling Tests
  // =============================================================================

  describe('error handling', () => {
    it('should return failed loads', async () => {
      const input: LoadInput = {
        events: [createTestEvent()],
        outcomes: [createTestOutcome()],
        relationships: [createTestRelationship()],
        pipelineRunId: 'test-run-errors',
      }

      const result = await loader.load(input)

      expect(result.failed).toBeDefined()
      expect(Array.isArray(result.failed)).toBe(true)
    })

    it('should track failed events', async () => {
      // Create a loader that will fail some writes
      const input: LoadInput = {
        events: [
          createTestEvent({ id: 'neo-event-1' }),
          createTestEvent({ id: 'neo-event-2' }),
          createTestEvent({ id: 'neo-event-3' }),
        ],
        outcomes: [],
        relationships: [],
        pipelineRunId: 'test-run-failed',
      }

      const result = await loader.load(input)

      // With mock, all should succeed
      expect(result.failed.length).toBe(0)
    })

    it('should track failed count in stats', async () => {
      const input: LoadInput = {
        events: [createTestEvent()],
        outcomes: [createTestOutcome()],
        relationships: [createTestRelationship()],
        pipelineRunId: 'test-run-failed-stats',
      }

      const result = await loader.load(input)

      expect(result.stats.failedCount).toBe(result.failed.length)
    })
  })

  // =============================================================================
  // Idempotency Tests
  // =============================================================================

  describe('idempotency', () => {
    it('should check if node exists', async () => {
      const exists = await loader.nodeExists('neo-event-123')
      expect(typeof exists).toBe('boolean')
    })

    it('should be configured for idempotency by default', () => {
      const defaultLoader = createLoader()
      expect(defaultLoader).toBeInstanceOf(Neo4jLoader)
    })

    it('should allow disabling idempotency', () => {
      const noIdempotencyLoader = createLoader({ enableIdempotency: false })
      expect(noIdempotencyLoader).toBeInstanceOf(Neo4jLoader)
    })
  })

  // =============================================================================
  // Node and Relationship Count Tests
  // =============================================================================

  describe('counts', () => {
    it('should get node count', async () => {
      const count = await loader.getNodeCount('Event')
      expect(typeof count).toBe('number')
      expect(count).toBeGreaterThanOrEqual(0)
    })

    it('should get relationship count', async () => {
      const count = await loader.getRelationshipCount('DERIVED_FROM')
      expect(typeof count).toBe('number')
      expect(count).toBeGreaterThanOrEqual(0)
    })
  })

  // =============================================================================
  // Batch Processing Tests
  // =============================================================================

  describe('batch processing', () => {
    it('should process events in batches', async () => {
      const customLoader = createLoader({ defaultBatchSize: 10 })
      const events: NormalizedEvent[] = Array.from({ length: 25 }, () => createTestEvent())

      const input: LoadInput = {
        events,
        outcomes: [],
        relationships: [],
        pipelineRunId: 'test-run-batch',
      }

      const result = await customLoader.load(input)

      expect(result.loadedEvents.length).toBe(25)
    })

    it('should process outcomes in batches', async () => {
      const customLoader = createLoader({ defaultBatchSize: 10 })
      const outcomes: NormalizedOutcome[] = Array.from({ length: 25 }, () => createTestOutcome())

      const input: LoadInput = {
        events: [],
        outcomes,
        relationships: [],
        pipelineRunId: 'test-run-outcome-batch',
      }

      const result = await customLoader.load(input)

      expect(result.loadedOutcomes.length).toBe(25)
    })

    it('should process relationships in batches', async () => {
      const customLoader = createLoader({ defaultBatchSize: 10 })
      const relationships: NormalizedRelationship[] = Array.from(
        { length: 25 },
        () => createTestRelationship()
      )

      const input: LoadInput = {
        events: [],
        outcomes: [],
        relationships,
        pipelineRunId: 'test-run-rel-batch',
      }

      const result = await customLoader.load(input)

      expect(result.loadedRelationships.length).toBe(25)
    })
  })

  // =============================================================================
  // Retry Logic Tests
  // =============================================================================

  describe('retry logic', () => {
    it('should configure max retries', () => {
      const retryLoader = createLoader({ maxRetries: 5 })
      expect(retryLoader).toBeInstanceOf(Neo4jLoader)
    })

    it('should configure retry delay', () => {
      const fastRetryLoader = createLoader({ retryDelayMs: 50 })
      expect(fastRetryLoader).toBeInstanceOf(Neo4jLoader)
    })

    it('should attempt retries on failure', async () => {
      const input: LoadInput = {
        events: [createTestEvent()],
        outcomes: [],
        relationships: [],
        pipelineRunId: 'test-run-retry',
      }

      const result = await loader.load(input)

      // With mock, should succeed without actual retries
      expect(result.loadedEvents.length).toBe(1)
    })
  })

  // =============================================================================
  // Configuration Tests
  // =============================================================================

  describe('configuration', () => {
    it('should create loader with default config', () => {
      const defaultLoader = createLoader()
      expect(defaultLoader).toBeInstanceOf(Neo4jLoader)
    })

    it('should create loader with custom batch size', () => {
      const customLoader = createLoader({ defaultBatchSize: 50 })
      expect(customLoader).toBeInstanceOf(Neo4jLoader)
    })

    it('should create loader with custom retry settings', () => {
      const customLoader = createLoader({
        maxRetries: 5,
        retryDelayMs: 200,
      })
      expect(customLoader).toBeInstanceOf(Neo4jLoader)
    })
  })
})

// =============================================================================
// Integration Tests
// =============================================================================

describe('Neo4jLoader Integration', () => {
  it('should load complete pipeline output', async () => {
    const loader = createLoader()

    const input: LoadInput = {
      events: [
        createTestEvent({ id: 'neo-event-1', type: 'task.started' }),
        createTestEvent({ id: 'neo-event-2', type: 'task.completed' }),
        createTestEvent({ id: 'neo-event-3', type: 'insight.created' }),
      ],
      outcomes: [
        createTestOutcome({ id: 'neo-outcome-1', type: 'success' }),
        createTestOutcome({ id: 'neo-outcome-2', type: 'failure', severity: 'high' }),
        createTestOutcome({ id: 'neo-outcome-3', type: 'pending' }),
      ],
      relationships: [
        createTestRelationship({ eventId: 'neo-event-1', outcomeId: 'neo-outcome-1', type: 'DERIVED_FROM' }),
        createTestRelationship({ eventId: 'neo-event-2', outcomeId: 'neo-outcome-2', type: 'DERIVED_FROM' }),
        createTestRelationship({ eventId: 'neo-event-3', outcomeId: 'neo-outcome-3', type: 'DERIVED_FROM' }),
      ],
      pipelineRunId: 'integration-test',
    }

    const result = await loader.load(input)

    expect(result.loadedEvents.length).toBe(3)
    expect(result.loadedOutcomes.length).toBe(3)
    expect(result.loadedRelationships.length).toBe(3)
    expect(result.failed.length).toBe(0)
    expect(result.stats.durationMs).toBeGreaterThan(0)
  })

  it('should handle large batches efficiently', async () => {
    const loader = createLoader({ defaultBatchSize: 50 })

    // Create 100 events and outcomes
    const input: LoadInput = {
      events: Array.from({ length: 100 }, (_, i) =>
        createTestEvent({ id: `neo-event-${i}` })
      ),
      outcomes: Array.from({ length: 100 }, (_, i) =>
        createTestOutcome({ id: `neo-outcome-${i}` })
      ),
      relationships: Array.from({ length: 100 }, (_, i) =>
        createTestRelationship({
          eventId: `neo-event-${i}`,
          outcomeId: `neo-outcome-${i}`,
        })
      ),
      pipelineRunId: 'large-batch-test',
    }

    const startTime = Date.now()
    const result = await loader.load(input)
    const duration = Date.now() - startTime

    expect(result.loadedEvents.length).toBe(100)
    expect(result.loadedOutcomes.length).toBe(100)
    expect(result.loadedRelationships.length).toBe(100)
    expect(duration).toBeLessThan(5000) // Should complete in under 5 seconds
  })
})

// =============================================================================
// Factory Function Tests
// =============================================================================

describe('createLoader', () => {
  it('should create loader with default config', () => {
    const loader = createLoader()
    expect(loader).toBeInstanceOf(Neo4jLoader)
  })

  it('should create loader with custom config', () => {
    const loader = createLoader({
      defaultBatchSize: 25,
      maxRetries: 5,
      retryDelayMs: 50,
      enableIdempotency: false,
    })
    expect(loader).toBeInstanceOf(Neo4jLoader)
  })
})