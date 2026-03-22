/**
 * PostgreSQL Extractor
 * 
 * Extracts Event -> Outcome pairs from PostgreSQL for the import pipeline.
 * Supports incremental extraction with watermarks and pagination.
 */

import type {
  EventRecord,
  OutcomeRecord,
  EventOutcomePair,
  ExtractionOptions,
  ExtractionResult,
  ExtractionError,
  ExtractionState,
} from './types'

// =============================================================================
// Configuration
// =============================================================================

const DEFAULT_BATCH_SIZE = 100
const DEFAULT_MAX_BATCHES = 10

// =============================================================================
// PostgreSQL Connection (Mock for now - will integrate with real connection)
// =============================================================================

/**
 * PostgreSQL client interface
 * This will be replaced with actual Prisma/raw SQL connection
 */
export interface PostgresClient {
  query<T>(sql: string, params?: unknown[]): Promise<T[]>
}

/**
 * Extractor configuration
 */
export interface ExtractorConfig {
  /** PostgreSQL client */
  client?: PostgresClient
  /** Default batch size */
  defaultBatchSize?: number
  /** Default max batches */
  defaultMaxBatches?: number
}

// =============================================================================
// SQL Queries
// =============================================================================

const QUERIES = {
  /**
   * Get events with optional filtering
   */
  getEvents: `
    SELECT 
      id,
      task_run_id,
      event_type,
      event_time,
      sequence_no,
      payload,
      created_at
    FROM event
    WHERE ($1::timestamptz IS NULL OR event_time > $1)
      AND ($2::uuid IS NULL OR task_run_id = $2)
      AND ($3::text IS NULL OR event_type = $3)
      AND ($4::uuid IS NULL OR id > $4)
    ORDER BY event_time ASC, sequence_no ASC
    LIMIT $5
  `,

  /**
   * Get outcomes for events
   */
  getOutcomes: `
    SELECT 
      id,
      task_run_id,
      outcome_type,
      severity,
      summary,
      details,
      event_id,
      occurred_at,
      created_at
    FROM outcome
    WHERE event_id = ANY($1::uuid[])
  `,

  /**
   * Get total count for pagination
   */
  getEventCount: `
    SELECT COUNT(*) as count
    FROM event
    WHERE ($1::timestamptz IS NULL OR event_time > $1)
      AND ($2::uuid IS NULL OR task_run_id = $2)
      AND ($3::text IS NULL OR event_type = $3)
  `,

  /**
   * Get latest event timestamp for watermark
   */
  getLatestEventTime: `
    SELECT MAX(event_time) as latest_time
    FROM event
    WHERE ($1::uuid IS NULL OR task_run_id = $1)
      AND ($2::text IS NULL OR event_type = $2)
  `,

  /**
   * Save extraction state
   */
  saveExtractionState: `
    INSERT INTO import_extraction_state (
      id, pipeline_run_id, last_event_time, last_event_id, 
      records_processed, pairs_extracted, created_at, updated_at
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
    ON CONFLICT (id) DO UPDATE SET
      last_event_time = EXCLUDED.last_event_time,
      last_event_id = EXCLUDED.last_event_id,
      records_processed = EXCLUDED.records_processed,
      pairs_extracted = EXCLUDED.pairs_extracted,
      updated_at = EXCLUDED.updated_at
  `,

  /**
   * Get extraction state
   */
  getExtractionState: `
    SELECT *
    FROM import_extraction_state
    WHERE pipeline_run_id = $1
    LIMIT 1
  `,
}

// =============================================================================
// Extractor Class
// =============================================================================

/**
 * PostgreSQL Event-Outcome Extractor
 * 
 * Extracts Event -> Outcome pairs from PostgreSQL for ETL pipeline.
 * Supports incremental extraction, pagination, and watermarking.
 */
export class PostgresExtractor {
  private client: PostgresClient | null
  private defaultBatchSize: number
  private defaultMaxBatches: number

  constructor(config: ExtractorConfig = {}) {
    this.client = config.client ?? null
    this.defaultBatchSize = config.defaultBatchSize ?? DEFAULT_BATCH_SIZE
    this.defaultMaxBatches = config.defaultMaxBatches ?? DEFAULT_MAX_BATCHES
  }

  /**
   * Extract Event-Outcome pairs from PostgreSQL
   */
  async extract(
    pipelineRunId: string,
    options: ExtractionOptions = {}
  ): Promise<ExtractionResult> {
    const startTime = Date.now()
    const errors: ExtractionError[] = []
    const pairs: EventOutcomePair[] = []

    const batchSize = options.batchSize ?? this.defaultBatchSize
    const maxBatches = options.maxBatches ?? this.defaultMaxBatches
    const since = options.since
    const includeUnpaired = options.includeUnpairedEvents ?? true

    let totalFound = 0
    let lastEventId: string | undefined
    let hasMore = false

    try {
      // Get events (mock implementation for now)
      const events = await this.getEvents({
        since,
        taskRunId: options.taskRunId,
        eventType: options.eventType,
        limit: batchSize,
        afterId: undefined,
      })

      totalFound = events.length

      if (events.length === 0) {
        return {
          pairs: [],
          totalFound: 0,
          batchSize: 0,
          hasMore: false,
          durationMs: Date.now() - startTime,
          nextWatermark: since ?? new Date(),
          errors: [],
        }
      }

      // Get outcomes for events
      const eventIds = events.map((e) => e.id)
      const outcomes = await this.getOutcomes(eventIds)

      // Create outcome lookup map
      const outcomeMap = new Map<string, OutcomeRecord>()
      for (const outcome of outcomes) {
        if (outcome.eventId) {
          outcomeMap.set(outcome.eventId, outcome)
        }
      }

      // Create Event-Outcome pairs
      for (const event of events) {
        const outcome = outcomeMap.get(event.id) ?? null

        // Skip events without outcomes if configured
        if (!includeUnpaired && outcome === null) {
          continue
        }

        pairs.push({
          event,
          outcome,
          extractedAt: new Date(),
        })

        lastEventId = event.id
      }

      // Determine if more records available
      hasMore = events.length === batchSize && maxBatches > 1

    } catch (error) {
      const extractionError: ExtractionError = {
        message: error instanceof Error ? error.message : 'Unknown extraction error',
        code: 'EXTRACTION_ERROR',
        details: { error },
      }
      errors.push(extractionError)
    }

    const durationMs = Date.now() - startTime
    const nextWatermark = pairs.length > 0 
      ? pairs[pairs.length - 1].event.eventTime 
      : since ?? new Date()

    return {
      pairs,
      totalFound,
      batchSize: pairs.length,
      lastEventId,
      hasMore,
      durationMs,
      nextWatermark,
      errors,
    }
  }

  /**
   * Extract with pagination (multiple batches)
   */
  async extractPaginated(
    pipelineRunId: string,
    options: ExtractionOptions = {}
  ): Promise<ExtractionResult[]> {
    const results: ExtractionResult[] = []
    const batchSize = options.batchSize ?? this.defaultBatchSize
    const maxBatches = options.maxBatches ?? this.defaultMaxBatches

    let currentOptions = { ...options }
    let batchCount = 0

    while (batchCount < maxBatches) {
      const result = await this.extract(pipelineRunId, currentOptions)
      results.push(result)

      if (!result.hasMore || result.pairs.length === 0) {
        break
      }

      // Update options for next batch
      currentOptions = {
        ...options,
        since: result.nextWatermark,
      }

      batchCount++
    }

    return results
  }

  /**
   * Get extraction state for a pipeline run
   */
  async getExtractionState(pipelineRunId: string): Promise<ExtractionState | null> {
    if (!this.client) {
      return this.getMockExtractionState(pipelineRunId)
    }

    const result = await this.client.query<ExtractionState>(
      QUERIES.getExtractionState,
      [pipelineRunId]
    )

    return result[0] ?? null
  }

  /**
   * Save extraction state (watermark)
   */
  async saveExtractionState(state: ExtractionState): Promise<void> {
    if (!this.client) {
      // Mock implementation - no-op
      return
    }

    await this.client.query(QUERIES.saveExtractionState, [
      state.id,
      state.pipelineRunId,
      state.lastEventTime,
      state.lastEventId,
      state.recordsProcessed,
      state.pairsExtracted,
      state.createdAt,
      state.updatedAt,
    ])
  }

  // =============================================================================
  // Mock Implementations (for testing/development)
  // =============================================================================

  /**
   * Get mock events (simulates PostgreSQL query)
   */
  private async getEvents(options: {
    since?: Date
    taskRunId?: string
    eventType?: string
    limit: number
    afterId?: string
  }): Promise<EventRecord[]> {
    // Simulate network delay
    await new Promise((resolve) => setTimeout(resolve, Math.random() * 20 + 5))

    // Generate mock events
    const events: EventRecord[] = []
    const count = Math.min(options.limit, Math.floor(Math.random() * 50) + 10)

    for (let i = 0; i < count; i++) {
      const id = `event-${Date.now()}-${i}`
      events.push({
        id,
        taskRunId: options.taskRunId ?? `task-run-${Math.floor(Math.random() * 100)}`,
        eventType: options.eventType ?? this.getRandomEventType(),
        eventTime: new Date(Date.now() - Math.random() * 86400000), // Last 24h
        sequenceNo: i,
        payload: {
          action: ['read', 'write', 'update', 'delete'][Math.floor(Math.random() * 4)],
          resource: ['user', 'task', 'insight', 'memory'][Math.floor(Math.random() * 4)],
          details: { processed: true },
        },
        createdAt: new Date(),
      })
    }

    // Sort by event time
    events.sort((a, b) => a.eventTime.getTime() - b.eventTime.getTime())

    return events
  }

  /**
   * Get mock outcomes for events (simulates PostgreSQL query)
   */
  private async getOutcomes(eventIds: string[]): Promise<OutcomeRecord[]> {
    // Simulate network delay
    await new Promise((resolve) => setTimeout(resolve, Math.random() * 10 + 2))

    const outcomes: OutcomeRecord[] = []
    const severities: Array<'info' | 'low' | 'medium' | 'high' | 'critical'> = 
      ['info', 'low', 'medium', 'high', 'critical']

    // Only create outcomes for ~70% of events
    for (const eventId of eventIds) {
      if (Math.random() > 0.3) {
        outcomes.push({
          id: `outcome-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
          taskRunId: `task-run-${Math.floor(Math.random() * 100)}`,
          outcomeType: this.getRandomOutcomeType(),
          severity: severities[Math.floor(Math.random() * severities.length)],
          summary: `Outcome for event ${eventId}`,
          details: { result: 'success', confidence: Math.random() },
          eventId,
          occurredAt: new Date(),
          createdAt: new Date(),
        })
      }
    }

    return outcomes
  }

  /**
   * Get mock extraction state
   */
  private getMockExtractionState(pipelineRunId: string): ExtractionState {
    return {
      id: `state-${pipelineRunId}`,
      pipelineRunId,
      lastEventTime: new Date(Date.now() - 3600000), // 1 hour ago
      lastEventId: `event-${Date.now()}-last`,
      recordsProcessed: 100,
      pairsExtracted: 85,
      createdAt: new Date(Date.now() - 7200000),
      updatedAt: new Date(Date.now() - 3600000),
    }
  }

  /**
   * Random event types
   */
  private getRandomEventType(): string {
    const types = [
      'task.started',
      'task.completed',
      'task.failed',
      'insight.created',
      'insight.approved',
      'insight.rejected',
      'memory.stored',
      'memory.retrieved',
      'graph.node.created',
      'graph.edge.created',
      'agent.action',
      'agent.decision',
    ]
    return types[Math.floor(Math.random() * types.length)]
  }

  /**
   * Random outcome types
   */
  private getRandomOutcomeType(): string {
    const types = [
      'success',
      'failure',
      'partial',
      'pending',
      'cancelled',
      'timeout',
    ]
    return types[Math.floor(Math.random() * types.length)]
  }
}

// =============================================================================
// Factory Function
// =============================================================================

/**
 * Create a PostgreSQL extractor
 */
export function createExtractor(config: ExtractorConfig = {}): PostgresExtractor {
  return new PostgresExtractor(config)
}

// =============================================================================
// Default Export
// =============================================================================

export default PostgresExtractor