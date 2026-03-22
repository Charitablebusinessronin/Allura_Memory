/**
 * Lifecycle History
 * 
 * Manages immutable audit trail for insight lifecycle transitions.
 */

import {
  TransitionEvent,
  HistoryQuery,
  HistoryResult,
  LifecycleState,
  TransitionReason,
  LIFECYCLE_STATES,
} from './types'

// =============================================================================
// History Store Interface
// =============================================================================

/**
 * Interface for history persistence
 */
export interface HistoryStore {
  /** Store an event */
  store(event: TransitionEvent): Promise<void>
  
  /** Store multiple events */
  storeBatch(events: TransitionEvent[]): Promise<void>
  
  /** Query events */
  query(query: HistoryQuery): Promise<HistoryResult>
  
  /** Get event by ID */
  getById(eventId: string): Promise<TransitionEvent | null>
  
  /** Get all events for an insight */
  getByInsightId(insightId: string): Promise<TransitionEvent[]>
  
  /** Delete all events for an insight */
  deleteByInsightId(insightId: string): Promise<boolean>
  
  /** Count events */
  count(query?: HistoryQuery): Promise<number>
}

// =============================================================================
// In-Memory History Store
// =============================================================================

/**
 * In-memory implementation of history store
 */
export class InMemoryHistoryStore implements HistoryStore {
  private events: Map<string, TransitionEvent> = new Map()
  private insightIndex: Map<string, Set<string>> = new Map()
  private idCounter: number = 0

  /**
   * Generate unique event ID
   */
  private generateEventId(): string {
    this.idCounter += 1
    return `event-${Date.now()}-${this.idCounter}`
  }

  /**
   * Store an event
   */
  async store(event: TransitionEvent): Promise<void> {
    if (!event.id) {
      event.id = this.generateEventId()
    }
    
    this.events.set(event.id, { ...event })
    
    // Update insight index
    if (!this.insightIndex.has(event.insightId)) {
      this.insightIndex.set(event.insightId, new Set())
    }
    this.insightIndex.get(event.insightId)!.add(event.id)
  }

  /**
   * Store multiple events
   */
  async storeBatch(events: TransitionEvent[]): Promise<void> {
    for (const event of events) {
      await this.store(event)
    }
  }

  /**
   * Query events
   */
  async query(query: HistoryQuery): Promise<HistoryResult> {
    const startTime = Date.now()
    let results = Array.from(this.events.values())

    // Apply filters
    if (query.insightId) {
      results = results.filter(e => e.insightId === query.insightId)
    }

    if (query.fromState) {
      results = results.filter(e => e.fromState === query.fromState)
    }

    if (query.toState) {
      results = results.filter(e => e.toState === query.toState)
    }

    if (query.reason) {
      results = results.filter(e => e.reason === query.reason)
    }

    if (query.triggeredBy) {
      results = results.filter(e => e.triggeredBy === query.triggeredBy)
    }

    if (query.startDate) {
      results = results.filter(e => new Date(e.timestamp) >= query.startDate!)
    }

    if (query.endDate) {
      results = results.filter(e => new Date(e.timestamp) <= query.endDate!)
    }

    // Sort by timestamp descending
    results.sort((a, b) => 
      new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
    )

    const total = results.length

    // Apply pagination
    if (query.offset !== undefined) {
      results = results.slice(query.offset)
    }

    if (query.limit !== undefined) {
      results = results.slice(0, query.limit)
    }

    const durationMs = Date.now() - startTime

    return {
      events: results,
      total,
      durationMs,
    }
  }

  /**
   * Get event by ID
   */
  async getById(eventId: string): Promise<TransitionEvent | null> {
    return this.events.get(eventId) ?? null
  }

  /**
   * Get all events for an insight
   */
  async getByInsightId(insightId: string): Promise<TransitionEvent[]> {
    const eventIds = this.insightIndex.get(insightId)
    if (!eventIds) return []

    const events: TransitionEvent[] = []
    for (const id of Array.from(eventIds)) {
      const event = this.events.get(id)
      if (event) {
        events.push(event)
      }
    }

    // Sort by timestamp ascending (oldest first)
    events.sort((a, b) => 
      new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
    )

    return events
  }

  /**
   * Delete all events for an insight
   */
  async deleteByInsightId(insightId: string): Promise<boolean> {
    const eventIds = this.insightIndex.get(insightId)
    if (!eventIds) return false

    for (const id of Array.from(eventIds)) {
      this.events.delete(id)
    }
    this.insightIndex.delete(insightId)
    return true
  }

  /**
   * Count events
   */
  async count(query?: HistoryQuery): Promise<number> {
    if (!query) return this.events.size

    const result = await this.query(query)
    return result.total
  }

  /**
   * Clear all events (for testing)
   */
  clear(): void {
    this.events.clear()
    this.insightIndex.clear()
    this.idCounter = 0
  }

  /**
   * Export all events
   */
  export(): TransitionEvent[] {
    return Array.from(this.events.values())
  }

  /**
   * Import events
   */
  import(events: TransitionEvent[]): void {
    for (const event of events) {
      this.events.set(event.id, {
        ...event,
        timestamp: new Date(event.timestamp),
      })
      
      if (!this.insightIndex.has(event.insightId)) {
        this.insightIndex.set(event.insightId, new Set())
      }
      this.insightIndex.get(event.insightId)!.add(event.id)
    }
  }
}

// =============================================================================
// History Manager Class
// =============================================================================

/**
 * History Manager
 * 
 * Manages immutable audit trail for lifecycle transitions.
 */
export class HistoryManager {
  private store: HistoryStore
  private idCounter: number = 0

  constructor(store?: HistoryStore) {
    this.store = store ?? new InMemoryHistoryStore()
  }

  /**
   * Generate unique event ID
   */
  private generateEventId(): string {
    this.idCounter += 1
    return `transition-${Date.now()}-${this.idCounter}`
  }

  /**
   * Record a transition event
   */
  async recordTransition(
    insightId: string,
    fromState: LifecycleState | null,
    toState: LifecycleState,
    reason: TransitionReason,
    options: {
      triggeredBy?: string
      details?: Record<string, unknown>
      policyId?: string
      confidence?: number
      ageDays?: number
    } = {}
  ): Promise<TransitionEvent> {
    const event: TransitionEvent = {
      id: this.generateEventId(),
      insightId,
      fromState,
      toState,
      reason,
      timestamp: new Date(),
      triggeredBy: options.triggeredBy ?? 'system',
      details: options.details,
      policyId: options.policyId,
      confidence: options.confidence,
      ageDays: options.ageDays,
    }

    await this.store.store(event)
    return event
  }

  /**
   * Record multiple transitions
   */
  async recordBatch(events: Array<{
    insightId: string
    fromState: LifecycleState | null
    toState: LifecycleState
    reason: TransitionReason
    triggeredBy?: string
    details?: Record<string, unknown>
    policyId?: string
    confidence?: number
    ageDays?: number
  }>): Promise<TransitionEvent[]> {
    const recordedEvents: TransitionEvent[] = []

    for (const data of events) {
      const event = await this.recordTransition(
        data.insightId,
        data.fromState,
        data.toState,
        data.reason,
        {
          triggeredBy: data.triggeredBy,
          details: data.details,
          policyId: data.policyId,
          confidence: data.confidence,
          ageDays: data.ageDays,
        }
      )
      recordedEvents.push(event)
    }

    return recordedEvents
  }

  /**
   * Query events
   */
  async queryEvents(query: HistoryQuery): Promise<HistoryResult> {
    return this.store.query(query)
  }

  /**
   * Get event by ID
   */
  async getEvent(eventId: string): Promise<TransitionEvent | null> {
    return this.store.getById(eventId)
  }

  /**
   * Get all events for an insight
   */
  async getInsightHistory(insightId: string): Promise<TransitionEvent[]> {
    return this.store.getByInsightId(insightId)
  }

  /**
   * Get the last event for an insight
   */
  async getLastEvent(insightId: string): Promise<TransitionEvent | null> {
    const events = await this.store.getByInsightId(insightId)
    if (events.length === 0) return null
    return events[events.length - 1]
  }

  /**
   * Get current state for an insight
   */
  async getCurrentState(insightId: string): Promise<LifecycleState | null> {
    const lastEvent = await this.getLastEvent(insightId)
    return lastEvent?.toState ?? null
  }

  /**
   * Get state at a specific point in time
   */
  async getStateAtTime(
    insightId: string,
    timestamp: Date
  ): Promise<LifecycleState | null> {
    const events = await this.store.getByInsightId(insightId)
    
    // Find the last event before or at the timestamp
    const relevantEvents = events.filter(e => 
      new Date(e.timestamp) <= timestamp
    )
    
    if (relevantEvents.length === 0) return null
    
    const lastEvent = relevantEvents[relevantEvents.length - 1]
    return lastEvent.toState
  }

  /**
   * Get state transition timeline for an insight
   */
  async getTimeline(insightId: string): Promise<{
    events: TransitionEvent[]
    currentState: LifecycleState | null
    totalTransitions: number
    durationMs: number
  }> {
    const startTime = Date.now()
    const events = await this.store.getByInsightId(insightId)
    const currentState = events.length > 0 
      ? events[events.length - 1].toState 
      : null
    
    return {
      events,
      currentState,
      totalTransitions: events.length,
      durationMs: Date.now() - startTime,
    }
  }

  /**
   * Get insights that transitioned within a time range
   */
  async getTransitionedInsights(
    fromState?: LifecycleState,
    toState?: LifecycleState,
    startDate?: Date,
    endDate?: Date
  ): Promise<string[]> {
    const result = await this.store.query({
      fromState,
      toState,
      startDate,
      endDate,
    })

    const uniqueInsightIds = new Set(result.events.map(e => e.insightId))
    return Array.from(uniqueInsightIds)
  }

  /**
   * Get statistics for a time range
   */
  async getStatistics(startDate?: Date, endDate?: Date): Promise<{
    totalTransitions: number
    byState: Record<LifecycleState, number>
    byReason: Record<TransitionReason, number>
    uniqueInsights: number
    averageTransitionsPerInsight: number
  }> {
    const result = await this.store.query({ startDate, endDate })
    const events = result.events

    const byState: Record<string, number> = {}
    const byReason: Record<string, number> = {}
    const uniqueInsights = new Set(events.map(e => e.insightId))

    for (const event of events) {
      // Count by target state
      const toState = event.toState
      byState[toState] = (byState[toState] ?? 0) + 1

      // Count by reason
      byReason[event.reason] = (byReason[event.reason] ?? 0) + 1
    }

    const averageTransitionsPerInsight = uniqueInsights.size > 0
      ? events.length / uniqueInsights.size
      : 0

    return {
      totalTransitions: events.length,
      byState: byState as Record<LifecycleState, number>,
      byReason: byReason as Record<TransitionReason, number>,
      uniqueInsights: uniqueInsights.size,
      averageTransitionsPerInsight,
    }
  }

  /**
   * Verify history integrity
   */
  async verifyIntegrity(insightId: string): Promise<{
    valid: boolean
    errors: string[]
  }> {
    const errors: string[] = []
    const events = await this.store.getByInsightId(insightId)

    // Check sequential transitions
    for (let i = 1; i < events.length; i++) {
      const prev = events[i - 1]
      const curr = events[i]

      if (prev.toState !== curr.fromState) {
        errors.push(
          `Invalid transition at index ${i}: ${curr.fromState} -> ${curr.toState} ` +
          `(expected ${prev.toState} -> ${curr.toState})`
        )
      }
    }

    // Check for duplicate event IDs
    const seenIds = new Set<string>()
    for (const event of events) {
      if (seenIds.has(event.id)) {
        errors.push(`Duplicate event ID: ${event.id}`)
      }
      seenIds.add(event.id)
    }

    // Check for out-of-order timestamps
    for (let i = 1; i < events.length; i++) {
      const prev = events[i - 1]
      const curr = events[i]
      if (new Date(curr.timestamp) < new Date(prev.timestamp)) {
        errors.push(`Out-of-order timestamp at index ${i}`)
      }
    }

    return {
      valid: errors.length === 0,
      errors,
    }
  }

  /**
   * Delete history for an insight
   */
  async deleteHistory(insightId: string): Promise<boolean> {
    return this.store.deleteByInsightId(insightId)
  }

  /**
   * Count events matching criteria
   */
  async count(query?: HistoryQuery): Promise<number> {
    return this.store.count(query)
  }
}

// =============================================================================
// Factory Functions
// =============================================================================

/**
 * Create a history manager with default store
 */
export function createHistoryManager(): HistoryManager {
  return new HistoryManager()
}

/**
 * Create a history manager with custom store
 */
export function createHistoryManagerWithStore(store: HistoryStore): HistoryManager {
  return new HistoryManager(store)
}

/**
 * Create an in-memory history store
 */
export function createInMemoryStore(): InMemoryHistoryStore {
  return new InMemoryHistoryStore()
}

// =============================================================================
// Default Export
// =============================================================================

export default HistoryManager