/**
 * Neo4j Loader
 * 
 * Loads normalized Event and Outcome data into Neo4j knowledge graph.
 * Creates nodes with canonical labels and relationships.
 * Handles idempotency to prevent duplicate nodes.
 */

import type {
  NormalizedEvent,
  NormalizedOutcome,
  NormalizedRelationship,
  LoadInput,
  LoadResult,
  LoadError,
} from './types'

// =============================================================================
// Configuration
// =============================================================================

const DEFAULT_BATCH_SIZE = 100
const DEFAULT_MAX_RETRIES = 3

// =============================================================================
// Neo4j Client Interface
// =============================================================================

/**
 * Neo4j driver interface
 * This will be replaced with actual Neo4j driver connection
 */
export interface Neo4jClient {
  run(query: string, params?: Record<string, unknown>): Promise<{ records: unknown[] }>
  close(): Promise<void>
}

/**
 * Neo4j session interface
 */
export interface Neo4jSession {
  run(query: string, params?: Record<string, unknown>): Promise<{ records: unknown[] }>
  close(): Promise<void>
}

/**
 * Loader configuration
 */
export interface LoaderConfig {
  /** Neo4j client */
  client?: Neo4jClient
  /** Default batch size for writes */
  defaultBatchSize?: number
  /** Max retry attempts */
  maxRetries?: number
  /** Retry delay in ms */
  retryDelayMs?: number
  /** Enable idempotency checks */
  enableIdempotency?: boolean
}

// =============================================================================
// Cypher Queries
// =============================================================================

const QUERIES = {
  /**
   * Create or merge event node
   */
  mergeEvent: `
    MERGE (e:Event {id: $id})
    ON CREATE SET 
      e.type = $type,
      e.timestamp = datetime($timestamp),
      e.category = $category,
      e.sourceId = $sourceId,
      e.source = $source,
      e.createdAt = datetime()
    ON MATCH SET
      e.type = $type,
      e.timestamp = datetime($timestamp),
      e.category = $category,
      e.updatedAt = datetime()
    SET e += $properties
    RETURN e.id as id
  `,

  /**
   * Create or merge outcome node
   */
  mergeOutcome: `
    MERGE (o:Outcome {id: $id})
    ON CREATE SET 
      o.type = $type,
      o.timestamp = datetime($timestamp),
      o.severity = $severity,
      o.summary = $summary,
      o.sourceId = $sourceId,
      o.source = $source,
      o.createdAt = datetime()
    ON MATCH SET
      o.type = $type,
      o.timestamp = datetime($timestamp),
      o.severity = $severity,
      o.summary = $summary,
      o.updatedAt = datetime()
    SET o += $properties
    RETURN o.id as id
  `,

  /**
   * Create relationship between nodes
   */
  mergeRelationship: `
    MATCH (source {id: $sourceId})
    MATCH (target {id: $targetId})
    MERGE (source)-[r:$relationshipType]->(target)
    ON CREATE SET r.createdAt = datetime()
    SET r += $properties
    RETURN type(r) as type
  `,

  /**
   * Create PART_OF relationship
   */
  createPartOfRelationship: `
    MATCH (e:Event {id: $eventId})
    MERGE (tr:TaskRun {id: $taskRunId})
    MERGE (e)-[r:PART_OF]->(tr)
    ON CREATE SET r.createdAt = datetime()
    RETURN e.id as eventId, tr.id as taskRunId
  `,

  /**
   * Create DERIVED_FROM relationship
   */
  createDerivedFromRelationship: `
    MATCH (o:Outcome {id: $outcomeId})
    MATCH (e:Event {id: $eventId})
    MERGE (o)-[r:DERIVED_FROM]->(e)
    ON CREATE SET r.createdAt = datetime()
    RETURN o.id as outcomeId, e.id as eventId
  `,

  /**
   * Create CAUSED relationship
   */
  createCausedRelationship: `
    MATCH (e:Event {id: $eventId})
    MATCH (o:Outcome {id: $outcomeId})
    MERGE (e)-[r:CAUSED]->(o)
    ON CREATE SET r.createdAt = datetime()
    RETURN e.id as eventId, o.id as outcomeId
  `,

  /**
   * Check if node exists
   */
  nodeExists: `
    MATCH (n {id: $id}) 
    RETURN n.id as id
  `,

  /**
   * Get node count by label
   */
  getNodeCount: `
    MATCH (n:$label)
    RETURN count(n) as count
  `,

  /**
   * Get relationship count by type
   */
  getRelationshipCount: `
    MATCH ()-[r:$type]->()
    RETURN count(r) as count
  `,
}

// =============================================================================
// Loader Class
// =============================================================================

/**
 * Neo4j Loader
 * 
 * Loads normalized events and outcomes into Neo4j knowledge graph.
 * Uses MERGE for idempotency (create if not exists, match if exists).
 */
export class Neo4jLoader {
  private client: Neo4jClient | null
  private defaultBatchSize: number
  private maxRetries: number
  private retryDelayMs: number
  private enableIdempotency: boolean

  constructor(config: LoaderConfig = {}) {
    this.client = config.client ?? null
    this.defaultBatchSize = config.defaultBatchSize ?? DEFAULT_BATCH_SIZE
    this.maxRetries = config.maxRetries ?? DEFAULT_MAX_RETRIES
    this.retryDelayMs = config.retryDelayMs ?? 100
    this.enableIdempotency = config.enableIdempotency ?? true
  }

  /**
   * Load normalized data into Neo4j
   */
  async load(input: LoadInput): Promise<LoadResult> {
    const startTime = Date.now()
    const loadedEvents: string[] = []
    const loadedOutcomes: string[] = []
    const loadedRelationships: string[] = []
    const failed: LoadError[] = []

    // Load events in batches
    const eventBatches = this.batch(input.events, this.defaultBatchSize)
    for (const batch of eventBatches) {
      const result = await this.loadEventBatch(batch)
      loadedEvents.push(...result.loaded)
      failed.push(...result.failed)
    }

    // Load outcomes in batches
    const outcomeBatches = this.batch(input.outcomes, this.defaultBatchSize)
    for (const batch of outcomeBatches) {
      const result = await this.loadOutcomeBatch(batch)
      loadedOutcomes.push(...result.loaded)
      failed.push(...result.failed)
    }

    // Load relationships in batches
    const relationshipBatches = this.batch(input.relationships, this.defaultBatchSize)
    for (const batch of relationshipBatches) {
      const result = await this.loadRelationshipBatch(batch)
      loadedRelationships.push(...result.loaded)
      failed.push(...result.failed)
    }

    const durationMs = Date.now() - startTime

    return {
      loadedEvents,
      loadedOutcomes,
      loadedRelationships,
      failed,
      stats: {
        eventsLoaded: loadedEvents.length,
        outcomesLoaded: loadedOutcomes.length,
        relationshipsLoaded: loadedRelationships.length,
        failedCount: failed.length,
        durationMs,
      },
    }
  }

  /**
   * Load a batch of events
   */
  private async loadEventBatch(events: NormalizedEvent[]): Promise<{
    loaded: string[]
    failed: LoadError[]
  }> {
    const loaded: string[] = []
    const failed: LoadError[] = []

    for (const event of events) {
      try {
        await this.loadEvent(event)
        loaded.push(event.id)
      } catch (error) {
        failed.push({
          type: 'event',
          id: event.id,
          error: error instanceof Error ? error.message : 'Unknown error',
          code: 'LOAD_ERROR',
        })
      }
    }

    return { loaded, failed }
  }

  /**
   * Load a single event
   */
  private async loadEvent(event: NormalizedEvent): Promise<void> {
    if (this.client) {
      // Real Neo4j write
      const result = await this.client.run(QUERIES.mergeEvent, {
        id: event.id,
        type: event.type,
        timestamp: event.timestamp,
        category: event.properties.category ?? 'unknown',
        sourceId: event.sourceId,
        source: event.metadata.source,
        properties: this.flattenProperties(event.properties),
      })

      if (!result.records || result.records.length === 0) {
        throw new Error(`Failed to create event node: ${event.id}`)
      }
    } else {
      // Mock implementation
      await this.mockWrite()
    }
  }

  /**
   * Load a batch of outcomes
   */
  private async loadOutcomeBatch(outcomes: NormalizedOutcome[]): Promise<{
    loaded: string[]
    failed: LoadError[]
  }> {
    const loaded: string[] = []
    const failed: LoadError[] = []

    for (const outcome of outcomes) {
      try {
        await this.loadOutcome(outcome)
        loaded.push(outcome.id)
      } catch (error) {
        failed.push({
          type: 'outcome',
          id: outcome.id,
          error: error instanceof Error ? error.message : 'Unknown error',
          code: 'LOAD_ERROR',
        })
      }
    }

    return { loaded, failed }
  }

  /**
   * Load a single outcome
   */
  private async loadOutcome(outcome: NormalizedOutcome): Promise<void> {
    if (this.client) {
      // Real Neo4j write
      const result = await this.client.run(QUERIES.mergeOutcome, {
        id: outcome.id,
        type: outcome.type,
        timestamp: outcome.timestamp,
        severity: outcome.severity,
        summary: outcome.summary,
        sourceId: outcome.sourceId,
        source: outcome.metadata.source,
        properties: this.flattenProperties(outcome.properties),
      })

      if (!result.records || result.records.length === 0) {
        throw new Error(`Failed to create outcome node: ${outcome.id}`)
      }
    } else {
      // Mock implementation
      await this.mockWrite()
    }
  }

  /**
   * Load a batch of relationships
   */
  private async loadRelationshipBatch(
    relationships: NormalizedRelationship[]
  ): Promise<{ loaded: string[]; failed: LoadError[] }> {
    const loaded: string[] = []
    const failed: LoadError[] = []

    for (const relationship of relationships) {
      try {
        await this.loadRelationship(relationship)
        loaded.push(`${relationship.eventId}-${relationship.outcomeId}`)
      } catch (error) {
        failed.push({
          type: 'relationship',
          id: `${relationship.eventId}-${relationship.outcomeId}`,
          error: error instanceof Error ? error.message : 'Unknown error',
          code: 'LOAD_ERROR',
        })
      }
    }

    return { loaded, failed }
  }

  /**
   * Load a single relationship
   */
  private async loadRelationship(relationship: NormalizedRelationship): Promise<void> {
    if (this.client) {
      // Real Neo4j write
      let query: string
      let params: Record<string, unknown>

      switch (relationship.type) {
        case 'DERIVED_FROM':
          query = QUERIES.createDerivedFromRelationship
          params = {
            outcomeId: relationship.outcomeId,
            eventId: relationship.eventId,
          }
          break
        case 'CAUSED':
          query = QUERIES.createCausedRelationship
          params = {
            eventId: relationship.eventId,
            outcomeId: relationship.outcomeId,
          }
          break
        case 'PART_OF':
          query = QUERIES.createPartOfRelationship
          params = {
            eventId: relationship.eventId,
            taskRunId: relationship.outcomeId.replace('neo-taskrun-', ''),
          }
          break
        default:
          // Generic relationship merge
          query = QUERIES.mergeRelationship
          params = {
            sourceId: relationship.eventId,
            targetId: relationship.outcomeId,
            relationshipType: relationship.type,
            properties: this.flattenProperties(relationship.properties),
          }
      }

      const result = await this.client.run(query, params)

      if (!result.records || result.records.length === 0) {
        throw new Error(
          `Failed to create relationship: ${relationship.eventId} -> ${relationship.outcomeId}`
        )
      }
    } else {
      // Mock implementation
      await this.mockWrite()
    }
  }

  /**
   * Check if a node exists (for idempotency)
   */
  async nodeExists(id: string): Promise<boolean> {
    if (this.client) {
      const result = await this.client.run(QUERIES.nodeExists, { id })
      return result.records && result.records.length > 0
    } else {
      // Mock implementation - always return false for new nodes
      return false
    }
  }

  /**
   * Get count of nodes by label
   */
  async getNodeCount(label: string): Promise<number> {
    if (this.client) {
      const result = await this.client.run(QUERIES.getNodeCount, { label })
      const record = result.records?.[0] as { count: number } | undefined
      return record?.count ?? 0
    } else {
      // Mock implementation
      return Math.floor(Math.random() * 100)
    }
  }

  /**
   * Get count of relationships by type
   */
  async getRelationshipCount(type: string): Promise<number> {
    if (this.client) {
      const result = await this.client.run(QUERIES.getRelationshipCount, { type })
      const record = result.records?.[0] as { count: number } | undefined
      return record?.count ?? 0
    } else {
      // Mock implementation
      return Math.floor(Math.random() * 100)
    }
  }

  /**
   * Load with retry logic
   */
  async loadWithRetry<T>(
    operation: () => Promise<T>,
    operationName: string
  ): Promise<T> {
    let lastError: Error | null = null

    for (let attempt = 0; attempt < this.maxRetries; attempt++) {
      try {
        return await operation()
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error))

        if (attempt < this.maxRetries - 1) {
          await this.sleep(this.retryDelayMs * Math.pow(2, attempt))
        }
      }
    }

    throw new Error(
      `Operation ${operationName} failed after ${this.maxRetries} retries: ${lastError?.message}`
    )
  }

  // =============================================================================
  // Utility Methods
  // =============================================================================

  /**
   * Split array into batches
   */
  private batch<T>(items: T[], batchSize: number): T[][] {
    const batches: T[][] = []
    for (let i = 0; i < items.length; i += batchSize) {
      batches.push(items.slice(i, i + batchSize))
    }
    return batches
  }

  /**
   * Flatten properties for Neo4j
   */
  private flattenProperties(props: Record<string, unknown>): Record<string, unknown> {
    const flat: Record<string, unknown> = {}
    for (const [key, value] of Object.entries(props)) {
      if (value !== undefined && value !== null) {
        flat[key] = value
      }
    }
    return flat
  }

  /**
   * Mock write operation
   */
  private async mockWrite(): Promise<void> {
    // Simulate network delay
    await new Promise((resolve) => setTimeout(resolve, Math.random() * 10 + 5))
  }

  /**
   * Sleep utility
   */
  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms))
  }
}

// =============================================================================
// Factory Function
// =============================================================================

/**
 * Create a Neo4j loader
 */
export function createLoader(config: LoaderConfig = {}): Neo4jLoader {
  return new Neo4jLoader(config)
}

// =============================================================================
// Default Export
// =============================================================================

export default Neo4jLoader