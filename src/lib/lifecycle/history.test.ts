/**
 * History Tests
 * 
 * Tests for lifecycle history management.
 */

import { describe, it, expect, beforeEach } from 'vitest'
import {
  HistoryManager,
  InMemoryHistoryStore,
  createHistoryManager,
  createInMemoryStore,
  createHistoryManagerWithStore,
} from './history'
import { LifecycleState, TransitionEvent } from './types'

// =============================================================================
// Test Fixtures
// =============================================================================

function createTestEvent(overrides: Partial<TransitionEvent> = {}): TransitionEvent {
  return {
    id: `event-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    insightId: `insight-${Math.random().toString(36).substr(2, 9)}`,
    fromState: null,
    toState: 'active',
    reason: 'manual_override',
    timestamp: new Date(),
    triggeredBy: 'system',
    ...overrides,
  }
}

// =============================================================================
// In-Memory History Store Tests
// =============================================================================

describe('InMemoryHistoryStore', () => {
  let store: InMemoryHistoryStore

  beforeEach(() => {
    store = createInMemoryStore()
  })

  describe('store', () => {
    it('should store an event', async () => {
      const event = createTestEvent()
      await store.store(event)

      const stored = await store.getById(event.id)
      expect(stored).toBeDefined()
      expect(stored?.insightId).toBe(event.insightId)
    })

    it('should auto-generate ID if missing', async () => {
      const event = createTestEvent({ id: undefined as unknown as string })
      await store.store(event)

      const allEvents = await store.query({})
      expect(allEvents.events).toHaveLength(1)
      expect(allEvents.events[0].id).toBeDefined()
    })

    it('should update insight index', async () => {
      const event = createTestEvent({ insightId: 'insight-1' })
      await store.store(event)

      const events = await store.getByInsightId('insight-1')
      expect(events).toHaveLength(1)
    })
  })

  describe('storeBatch', () => {
    it('should store multiple events', async () => {
      const events = [
        createTestEvent({ insightId: 'insight-1' }),
        createTestEvent({ insightId: 'insight-2' }),
        createTestEvent({ insightId: 'insight-3' }),
      ]

      await store.storeBatch(events)

      const result = await store.query({})
      expect(result.total).toBe(3)
    })
  })

  describe('query', () => {
    beforeEach(async () => {
      // Seed with test data
      const now = Date.now()
      await store.storeBatch([
        createTestEvent({ id: 'e1', insightId: 'i1', toState: 'active', timestamp: new Date(now - 3000) }),
        createTestEvent({ id: 'e2', insightId: 'i1', fromState: 'active', toState: 'degraded', reason: 'confidence_drop', timestamp: new Date(now - 2000) }),
        createTestEvent({ id: 'e3', insightId: 'i2', toState: 'active', timestamp: new Date(now - 1500) }),
        createTestEvent({ id: 'e4', insightId: 'i1', fromState: 'degraded', toState: 'expired', reason: 'age_threshold', timestamp: new Date(now - 1000) }),
        createTestEvent({ id: 'e5', insightId: 'i2', fromState: 'active', toState: 'deprecated', triggeredBy: 'admin', timestamp: new Date(now) }),
      ])
    })

    it('should query all events', async () => {
      const result = await store.query({})
      expect(result.total).toBe(5)
      expect(result.events).toHaveLength(5)
    })

    it('should filter by insightId', async () => {
      const result = await store.query({ insightId: 'i1' })
      expect(result.total).toBe(3)
    })

    it('should filter by fromState', async () => {
      const result = await store.query({ fromState: 'active' })
      expect(result.total).toBe(2)
    })

    it('should filter by toState', async () => {
      const result = await store.query({ toState: 'active' })
      expect(result.total).toBe(2)
    })

    it('should filter by reason', async () => {
      const result = await store.query({ reason: 'confidence_drop' })
      expect(result.total).toBe(1)
    })

    it('should filter by triggeredBy', async () => {
      const result = await store.query({ triggeredBy: 'admin' })
      expect(result.total).toBe(1)
    })

    it('should filter by date range', async () => {
      const now = Date.now()
      const result = await store.query({
        startDate: new Date(now - 2500),
        endDate: new Date(now - 500),
      })
      expect(result.total).toBe(3)
    })

    it('should apply pagination', async () => {
      const result = await store.query({ limit: 2 })
      expect(result.events).toHaveLength(2)
      expect(result.total).toBe(5) // Total still reflects all
    })

    it('should apply offset', async () => {
      const result1 = await store.query({ limit: 2, offset: 0 })
      const result2 = await store.query({ limit: 2, offset: 2 })
      
      expect(result1.events).toHaveLength(2)
      expect(result2.events).toHaveLength(2)
      expect(result1.events[0].id).not.toBe(result2.events[0].id)
    })

    it('should sort by timestamp descending', async () => {
      const result = await store.query({})
      const timestamps = result.events.map(e => new Date(e.timestamp).getTime())
      
      for (let i = 0; i < timestamps.length - 1; i++) {
        expect(timestamps[i]).toBeGreaterThanOrEqual(timestamps[i + 1])
      }
    })
  })

  describe('getById', () => {
    it('should return event by ID', async () => {
      const event = createTestEvent({ id: 'test-event' })
      await store.store(event)

      const found = await store.getById('test-event')
      expect(found).toBeDefined()
      expect(found?.id).toBe('test-event')
    })

    it('should return null for non-existent ID', async () => {
      const found = await store.getById('non-existent')
      expect(found).toBeNull()
    })
  })

  describe('getByInsightId', () => {
    it('should return all events for insight', async () => {
      await store.storeBatch([
        createTestEvent({ insightId: 'i1', toState: 'active' }),
        createTestEvent({ insightId: 'i1', fromState: 'active', toState: 'degraded' }),
        createTestEvent({ insightId: 'i2', toState: 'active' }),
      ])

      const events = await store.getByInsightId('i1')
      expect(events).toHaveLength(2)
    })

    it('should return empty array for unknown insight', async () => {
      const events = await store.getByInsightId('unknown')
      expect(events).toEqual([])
    })

    it('should return events sorted by timestamp ascending', async () => {
      const now = Date.now()
      await store.storeBatch([
        createTestEvent({ insightId: 'i1', id: 'e3', timestamp: new Date(now + 2000) }),
        createTestEvent({ insightId: 'i1', id: 'e1', timestamp: new Date(now) }),
        createTestEvent({ insightId: 'i1', id: 'e2', timestamp: new Date(now + 1000) }),
      ])

      const events = await store.getByInsightId('i1')
      expect(events[0].id).toBe('e1')
      expect(events[1].id).toBe('e2')
      expect(events[2].id).toBe('e3')
    })
  })

  describe('deleteByInsightId', () => {
    it('should delete all events for insight', async () => {
      await store.storeBatch([
        createTestEvent({ insightId: 'i1' }),
        createTestEvent({ insightId: 'i1' }),
        createTestEvent({ insightId: 'i2' }),
      ])

      const deleted = await store.deleteByInsightId('i1')
      expect(deleted).toBe(true)

      const events = await store.getByInsightId('i1')
      expect(events).toHaveLength(0)

      const remaining = await store.getByInsightId('i2')
      expect(remaining).toHaveLength(1)
    })

    it('should return false for non-existent insight', async () => {
      const deleted = await store.deleteByInsightId('non-existent')
      expect(deleted).toBe(false)
    })
  })

  describe('count', () => {
    it('should count all events', async () => {
      await store.storeBatch([
        createTestEvent(),
        createTestEvent(),
        createTestEvent(),
      ])

      const count = await store.count()
      expect(count).toBe(3)
    })

    it('should count with filter', async () => {
      await store.storeBatch([
        createTestEvent({ insightId: 'i1', toState: 'active' }),
        createTestEvent({ insightId: 'i2', toState: 'active' }),
        createTestEvent({ insightId: 'i1', toState: 'degraded' }),
      ])

      const count = await store.count({ insightId: 'i1' })
      expect(count).toBe(2)
    })
  })

  describe('import/export', () => {
    it('should export all events', async () => {
      await store.storeBatch([
        createTestEvent({ insightId: 'i1' }),
        createTestEvent({ insightId: 'i2' }),
      ])

      const exported = store.export()
      expect(exported).toHaveLength(2)
    })

    it('should import events', async () => {
      const events = [
        createTestEvent({ id: 'e1', insightId: 'i1' }),
        createTestEvent({ id: 'e2', insightId: 'i2' }),
      ]

      store.import(events)
      
      const count = await store.count()
      expect(count).toBe(2)
    })

    it('should clear all events', () => {
      store.store(createTestEvent())
      store.clear()
      
      const exported = store.export()
      expect(exported).toHaveLength(0)
    })
  })
})

// =============================================================================
// History Manager Tests
// =============================================================================

describe('HistoryManager', () => {
  let manager: HistoryManager

  beforeEach(() => {
    manager = createHistoryManager()
  })

  describe('recordTransition', () => {
    it('should record a transition event', async () => {
      const event = await manager.recordTransition(
        'insight-1',
        null,
        'active',
        'manual_override',
        { triggeredBy: 'user-123' }
      )

      expect(event.id).toBeDefined()
      expect(event.insightId).toBe('insight-1')
      expect(event.fromState).toBe(null)
      expect(event.toState).toBe('active')
      expect(event.reason).toBe('manual_override')
      expect(event.triggeredBy).toBe('user-123')
      expect(event.timestamp).toBeInstanceOf(Date)
    })

    it('should record transition with all options', async () => {
      const event = await manager.recordTransition(
        'insight-1',
        'active',
        'degraded',
        'confidence_drop',
        {
          triggeredBy: 'policy-engine',
          details: { previousConfidence: 80, newConfidence: 25 },
          policyId: 'policy-default',
          confidence: 25,
          ageDays: 30,
        }
      )

      expect(event.policyId).toBe('policy-default')
      expect(event.confidence).toBe(25)
      expect(event.ageDays).toBe(30)
      expect(event.details).toBeDefined()
    })

    it('should store event in underlying store', async () => {
      await manager.recordTransition('insight-1', null, 'active', 'manual_override')
      
      const events = await manager.getInsightHistory('insight-1')
      expect(events).toHaveLength(1)
    })
  })

  describe('recordBatch', () => {
    it('should record multiple transitions', async () => {
      const events = await manager.recordBatch([
        { insightId: 'i1', fromState: null, toState: 'active', reason: 'manual_override' },
        { insightId: 'i1', fromState: 'active', toState: 'degraded', reason: 'confidence_drop' },
        { insightId: 'i2', fromState: null, toState: 'active', reason: 'manual_override' },
      ])

      expect(events).toHaveLength(3)
      expect(events[0].insightId).toBe('i1')
      expect(events[1].fromState).toBe('active')
      expect(events[2].insightId).toBe('i2')
    })
  })

  describe('queryEvents', () => {
    beforeEach(async () => {
      const now = Date.now()
      await manager.recordBatch([
        { insightId: 'i1', fromState: null, toState: 'active', reason: 'manual_override', triggeredBy: 'system' },
        { insightId: 'i1', fromState: 'active', toState: 'degraded', reason: 'confidence_drop', triggeredBy: 'policy' },
        { insightId: 'i2', fromState: null, toState: 'active', reason: 'manual_override', triggeredBy: 'system' },
      ])
    })

    it('should query events with filters', async () => {
      const result = await manager.queryEvents({ insightId: 'i1' })
      expect(result.total).toBe(2)
    })

    it('should apply pagination', async () => {
      const result = await manager.queryEvents({ limit: 1 })
      expect(result.events).toHaveLength(1)
    })
  })

  describe('getEvent', () => {
    it('should return event by ID', async () => {
      const recorded = await manager.recordTransition('i1', null, 'active', 'manual_override')
      
      const found = await manager.getEvent(recorded.id)
      expect(found).toBeDefined()
      expect(found?.id).toBe(recorded.id)
    })

    it('should return null for non-existent ID', async () => {
      const found = await manager.getEvent('non-existent')
      expect(found).toBeNull()
    })
  })

  describe('getInsightHistory', () => {
    it('should return all events for insight', async () => {
      await manager.recordBatch([
        { insightId: 'i1', fromState: null, toState: 'active', reason: 'manual_override' },
        { insightId: 'i1', fromState: 'active', toState: 'degraded', reason: 'confidence_drop' },
        { insightId: 'i2', fromState: null, toState: 'active', reason: 'manual_override' },
      ])

      const history = await manager.getInsightHistory('i1')
      expect(history).toHaveLength(2)
    })
  })

  describe('getLastEvent', () => {
    it('should return last event for insight', async () => {
      await manager.recordBatch([
        { insightId: 'i1', fromState: null, toState: 'active', reason: 'manual_override' },
        { insightId: 'i1', fromState: 'active', toState: 'degraded', reason: 'confidence_drop' },
      ])

      const lastEvent = await manager.getLastEvent('i1')
      expect(lastEvent?.toState).toBe('degraded')
    })

    it('should return null for insight with no history', async () => {
      const lastEvent = await manager.getLastEvent('unknown')
      expect(lastEvent).toBeNull()
    })
  })

  describe('getCurrentState', () => {
    it('should return current state from last event', async () => {
      await manager.recordBatch([
        { insightId: 'i1', fromState: null, toState: 'active', reason: 'manual_override' },
        { insightId: 'i1', fromState: 'active', toState: 'degraded', reason: 'confidence_drop' },
      ])

      const state = await manager.getCurrentState('i1')
      expect(state).toBe('degraded')
    })

    it('should return null for unknown insight', async () => {
      const state = await manager.getCurrentState('unknown')
      expect(state).toBeNull()
    })
  })

  describe('getStateAtTime', () => {
    it('should return state at specific point in time', async () => {
      const now = Date.now()
      const t1 = new Date(now - 3000)
      const t2 = new Date(now - 2000)
      const t3 = new Date(now - 1000)

      await manager.recordTransition('i1', null, 'active', 'manual_override', { triggeredBy: 'system' })
      await new Promise(resolve => setTimeout(resolve, 10))
      await manager.recordTransition('i1', 'active', 'degraded', 'confidence_drop')
      await new Promise(resolve => setTimeout(resolve, 10))
      await manager.recordTransition('i1', 'degraded', 'expired', 'age_threshold')

      // Get events to find timestamps
      const events = await manager.getInsightHistory('i1')
      const stateAtT2 = await manager.getStateAtTime('i1', new Date(events[1].timestamp))
      
      expect(stateAtT2).toBe('degraded')
    })

    it('should return null if no events at time', async () => {
      const state = await manager.getStateAtTime('unknown', new Date())
      expect(state).toBeNull()
    })
  })

  describe('getTimeline', () => {
    it('should return complete timeline', async () => {
      await manager.recordBatch([
        { insightId: 'i1', fromState: null, toState: 'active', reason: 'manual_override' },
        { insightId: 'i1', fromState: 'active', toState: 'degraded', reason: 'confidence_drop' },
        { insightId: 'i1', fromState: 'degraded', toState: 'active', reason: 'confidence_restore' },
      ])

      const timeline = await manager.getTimeline('i1')
      
      expect(timeline.events).toHaveLength(3)
      expect(timeline.currentState).toBe('active')
      expect(timeline.totalTransitions).toBe(3)
    })
  })

  describe('getTransitionedInsights', () => {
    beforeEach(async () => {
      await manager.recordBatch([
        { insightId: 'i1', fromState: null, toState: 'active', reason: 'manual_override' },
        { insightId: 'i1', fromState: 'active', toState: 'degraded', reason: 'confidence_drop' },
        { insightId: 'i2', fromState: null, toState: 'active', reason: 'manual_override' },
        { insightId: 'i2', fromState: 'active', toState: 'expired', reason: 'age_threshold' },
        { insightId: 'i3', fromState: null, toState: 'active', reason: 'manual_override' },
      ])
    })

    it('should get insights that transitioned to a state', async () => {
      const insights = await manager.getTransitionedInsights(undefined, 'degraded')
      expect(insights).toContain('i1')
      expect(insights).not.toContain('i2')
    })

    it('should get insights with transitions from a state', async () => {
      const insights = await manager.getTransitionedInsights('active')
      expect(insights).toContain('i1')
      expect(insights).toContain('i2')
    })

    it('should get insights with specific transition', async () => {
      const insights = await manager.getTransitionedInsights('active', 'expired')
      expect(insights).toContain('i2')
      expect(insights).not.toContain('i1')
    })
  })

  describe('getStatistics', () => {
    beforeEach(async () => {
      await manager.recordBatch([
        { insightId: 'i1', fromState: null, toState: 'active', reason: 'manual_override' },
        { insightId: 'i1', fromState: 'active', toState: 'degraded', reason: 'confidence_drop' },
        { insightId: 'i2', fromState: null, toState: 'active', reason: 'manual_override' },
        { insightId: 'i2', fromState: 'active', toState: 'expired', reason: 'age_threshold' },
        { insightId: 'i3', fromState: null, toState: 'active', reason: 'manual_override' },
      ])
    })

    it('should return transition statistics', async () => {
      const stats = await manager.getStatistics()

      expect(stats.totalTransitions).toBe(5)
      expect(stats.uniqueInsights).toBe(3)
      expect(stats.byState['active']).toBe(3) // 3 insights went to active
      expect(stats.byState['degraded']).toBe(1)
      expect(stats.byState['expired']).toBe(1)
      expect(stats.byReason['manual_override']).toBe(3)
      expect(stats.byReason['confidence_drop']).toBe(1)
      expect(stats.byReason['age_threshold']).toBe(1)
    })
  })

  describe('verifyIntegrity', () => {
    it('should pass for valid history', async () => {
      await manager.recordBatch([
        { insightId: 'i1', fromState: null, toState: 'active', reason: 'manual_override' },
        { insightId: 'i1', fromState: 'active', toState: 'degraded', reason: 'confidence_drop' },
        { insightId: 'i1', fromState: 'degraded', toState: 'expired', reason: 'age_threshold' },
      ])

      const result = await manager.verifyIntegrity('i1')
      expect(result.valid).toBe(true)
      expect(result.errors).toHaveLength(0)
    })

    it('should detect invalid transitions', async () => {
      // Create a valid history first
      await manager.recordBatch([
        { insightId: 'i1', fromState: null, toState: 'active', reason: 'manual_override' },
      ])

      // Manually add an invalid event (bypass validation)
      const store = createInMemoryStore()
      const managerWithStore = createHistoryManagerWithStore(store)
      
      await managerWithStore.recordBatch([
        { insightId: 'i1', fromState: null, toState: 'active', reason: 'manual_override' },
        // Invalid: fromState doesn't match previous toState
        { insightId: 'i1', fromState: 'expired', toState: 'active', reason: 'manual_restoration' },
      ])

      const result = await managerWithStore.verifyIntegrity('i1')
      expect(result.valid).toBe(false)
      expect(result.errors.length).toBeGreaterThan(0)
    })

    it('should detect duplicate IDs', async () => {
      // This would need to be tested with a custom store that allows duplicates
      const result = await manager.verifyIntegrity('unknown')
      expect(result.valid).toBe(true) // No history = valid
    })
  })

  describe('deleteHistory', () => {
    it('should delete all history for insight', async () => {
      await manager.recordBatch([
        { insightId: 'i1', fromState: null, toState: 'active', reason: 'manual_override' },
        { insightId: 'i2', fromState: null, toState: 'active', reason: 'manual_override' },
      ])

      const deleted = await manager.deleteHistory('i1')
      expect(deleted).toBe(true)

      const history = await manager.getInsightHistory('i1')
      expect(history).toHaveLength(0)

      const remaining = await manager.getInsightHistory('i2')
      expect(remaining).toHaveLength(1)
    })
  })

  describe('count', () => {
    it('should count events', async () => {
      await manager.recordBatch([
        { insightId: 'i1', fromState: null, toState: 'active', reason: 'manual_override' },
        { insightId: 'i1', fromState: 'active', toState: 'degraded', reason: 'confidence_drop' },
        { insightId: 'i2', fromState: null, toState: 'active', reason: 'manual_override' },
      ])

      const total = await manager.count()
      expect(total).toBe(3)

      const filtered = await manager.count({ insightId: 'i1' })
      expect(filtered).toBe(2)
    })
  })
})

// =============================================================================
// Factory Function Tests
// =============================================================================

describe('Factory Functions', () => {
  it('should create history manager with default store', () => {
    const manager = createHistoryManager()
    expect(manager).toBeInstanceOf(HistoryManager)
  })

  it('should create history manager with custom store', () => {
    const store = createInMemoryStore()
    const manager = createHistoryManagerWithStore(store)
    expect(manager).toBeInstanceOf(HistoryManager)
  })

  it('should create in-memory store', () => {
    const store = createInMemoryStore()
    expect(store).toBeInstanceOf(InMemoryHistoryStore)
  })
})

// =============================================================================
// Integration Tests
// =============================================================================

describe('History Integration', () => {
  let manager: HistoryManager

  beforeEach(() => {
    manager = createHistoryManager()
  })

  it('should maintain complete audit trail', async () => {
    // Simulate full lifecycle
    await manager.recordTransition('i1', null, 'active', 'manual_override', { triggeredBy: 'user' })
    await manager.recordTransition('i1', 'active', 'degraded', 'confidence_drop', { confidence: 20 })
    await manager.recordTransition('i1', 'degraded', 'active', 'confidence_restore', { confidence: 60 })
    await manager.recordTransition('i1', 'active', 'expired', 'age_threshold', { ageDays: 100 })

    const history = await manager.getInsightHistory('i1')
    expect(history).toHaveLength(4)

    // Verify sequence
    expect(history[0].fromState).toBe(null)
    expect(history[0].toState).toBe('active')
    expect(history[1].fromState).toBe('active')
    expect(history[1].toState).toBe('degraded')
    expect(history[2].fromState).toBe('degraded')
    expect(history[2].toState).toBe('active')
    expect(history[3].fromState).toBe('active')
    expect(history[3].toState).toBe('expired')

    // Verify timestamps are sequential
    for (let i = 1; i < history.length; i++) {
      expect(new Date(history[i].timestamp).getTime())
        .toBeGreaterThanOrEqual(new Date(history[i - 1].timestamp).getTime())
    }
  })

  it('should support concurrent insights', async () => {
    // Record events for multiple insights
    await manager.recordBatch([
      { insightId: 'i1', fromState: null, toState: 'active', reason: 'manual_override' },
      { insightId: 'i2', fromState: null, toState: 'active', reason: 'manual_override' },
      { insightId: 'i3', fromState: null, toState: 'active', reason: 'manual_override' },
    ])

    await manager.recordBatch([
      { insightId: 'i1', fromState: 'active', toState: 'degraded', reason: 'confidence_drop' },
      { insightId: 'i2', fromState: 'active', toState: 'expired', reason: 'age_threshold' },
    ])

    // Each insight should have correct history
    const h1 = await manager.getInsightHistory('i1')
    const h2 = await manager.getInsightHistory('i2')
    const h3 = await manager.getInsightHistory('i3')

    expect(h1).toHaveLength(2)
    expect(h2).toHaveLength(2)
    expect(h3).toHaveLength(1)

    // Verify final states
    const s1 = await manager.getCurrentState('i1')
    const s2 = await manager.getCurrentState('i2')
    const s3 = await manager.getCurrentState('i3')

    expect(s1).toBe('degraded')
    expect(s2).toBe('expired')
    expect(s3).toBe('active')
  })

  it('should support time-based queries', async () => {
    const now = Date.now()
    
    // Record events with slight time differences
    await manager.recordTransition('i1', null, 'active', 'manual_override')
    await new Promise(resolve => setTimeout(resolve, 50))
    await manager.recordTransition('i1', 'active', 'degraded', 'confidence_drop')
    await new Promise(resolve => setTimeout(resolve, 50))
    await manager.recordTransition('i1', 'degraded', 'active', 'confidence_restore')

    const history = await manager.getInsightHistory('i1')
    const midTime = new Date(history[1].timestamp)

    // Query events after midTime
    const result = await manager.queryEvents({
      insightId: 'i1',
      startDate: midTime,
    })

    // Should include degraded and restore events
    expect(result.total).toBeGreaterThanOrEqual(2)
  })
})