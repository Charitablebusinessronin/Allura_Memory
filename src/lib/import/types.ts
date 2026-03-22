/**
 * Import Pipeline Types
 * 
 * Type definitions for the PostgreSQL to Neo4j import manager.
 * Handles ETL pipeline for knowledge creation.
 */

// =============================================================================
// Core Pipeline Types
// =============================================================================

/**
 * Pipeline stage names
 */
export type PipelineStage = 'extract' | 'transform' | 'load'

/**
 * Pipeline status for a run
 */
export type PipelineStatus = 
  | 'pending'
  | 'running'
  | 'completed'
  | 'failed'
  | 'cancelled'
  | 'paused'

/**
 * Stage-level status
 */
export type StageStatus = 
  | 'pending'
  | 'running'
  | 'completed'
  | 'failed'
  | 'skipped'

// =============================================================================
// Extraction Types
// =============================================================================

/**
 * Event record from PostgreSQL
 * Represents an execution trace event
 */
export interface EventRecord {
  id: string
  taskRunId: string
  eventType: string
  eventTime: Date
  sequenceNo: number
  payload: Record<string, unknown>
  createdAt: Date
}

/**
 * Outcome record from PostgreSQL
 * Represents a result or finding from an event
 */
export interface OutcomeRecord {
  id: string
  taskRunId: string
  outcomeType: string
  severity: 'info' | 'low' | 'medium' | 'high' | 'critical'
  summary: string
  details: Record<string, unknown>
  eventId?: string
  occurredAt: Date
  createdAt: Date
}

/**
 * Event-Outcome pair for extraction
 * This is the primary unit of data moved through the pipeline
 */
export interface EventOutcomePair {
  event: EventRecord
  outcome: OutcomeRecord | null
  extractedAt: Date
}

/**
 * Extraction options
 */
export interface ExtractionOptions {
  /** Only extract records after this timestamp (incremental extraction) */
  since?: Date
  /** Maximum number of records to extract in one batch */
  batchSize?: number
  /** Maximum number of batches to process (for pagination) */
  maxBatches?: number
  /** Filter by task run ID */
  taskRunId?: string
  /** Filter by event type */
  eventType?: string
  /** Include events without outcomes */
  includeUnpairedEvents?: boolean
}

/**
 * Extraction result
 */
export interface ExtractionResult {
  /** Successfully extracted pairs */
  pairs: EventOutcomePair[]
  /** Total records found matching criteria */
  totalFound: number
  /** Number of pairs in this batch */
  batchSize: number
  /** Cursor for pagination (last processed event ID) */
  lastEventId?: string
  /** Whether more records are available */
  hasMore: boolean
  /** Time taken for extraction */
  durationMs: number
  /** Watermark for next incremental extraction */
  nextWatermark: Date
  /** Any errors encountered */
  errors: ExtractionError[]
}

/**
 * Extraction error
 */
export interface ExtractionError {
  eventId?: string
  message: string
  code: string
  details?: Record<string, unknown>
}

/**
 * Extraction state / watermark
 * Tracks progress for incremental extraction
 */
export interface ExtractionState {
  /** Unique identifier for this state */
  id: string
  /** Pipeline run this state belongs to */
  pipelineRunId: string
  /** Last processed event timestamp */
  lastEventTime: Date
  /** Last processed event ID */
  lastEventId?: string
  /** Total records processed */
  recordsProcessed: number
  /** Total pairs extracted */
  pairsExtracted: number
  /** State creation time */
  createdAt: Date
  /** State update time */
  updatedAt: Date
}

// =============================================================================
// Transformation Types
// =============================================================================

/**
 * Transformation input (from extraction)
 */
export interface TransformInput {
  pairs: EventOutcomePair[]
  pipelineRunId: string
}

/**
 * Normalized event for Neo4j
 */
export interface NormalizedEvent {
  id: string
  sourceId: string
  type: string
  timestamp: string
  properties: Record<string, unknown>
  metadata: {
    extractedAt: string
    source: 'postgresql'
  }
}

/**
 * Normalized outcome for Neo4j
 */
export interface NormalizedOutcome {
  id: string
  sourceId: string
  eventId: string
  type: string
  timestamp: string
  severity: string
  summary: string
  properties: Record<string, unknown>
  metadata: {
    extractedAt: string
    source: 'postgresql'
  }
}

/**
 * Normalized relationship between event and outcome
 */
export interface NormalizedRelationship {
  eventId: string
  outcomeId: string
  type: 'DERIVED_FROM' | 'CAUSED' | 'LEADS_TO' | 'PART_OF' | 'PRODUCED' | string
  properties: Record<string, unknown>
}

/**
 * Transformation result
 */
export interface TransformResult {
  events: NormalizedEvent[]
  outcomes: NormalizedOutcome[]
  relationships: NormalizedRelationship[]
  /** Records that failed transformation */
  failed: TransformError[]
  /** Stats */
  stats: {
    inputPairs: number
    outputEvents: number
    outputOutcomes: number
    outputRelationships: number
    failedCount: number
    durationMs: number
  }
}

/**
 * Transformation error
 */
export interface TransformError {
  pair: EventOutcomePair
  error: string
  code: string
}

// =============================================================================
// Loading Types
// =============================================================================

/**
 * Load input (from transformation)
 */
export interface LoadInput {
  events: NormalizedEvent[]
  outcomes: NormalizedOutcome[]
  relationships: NormalizedRelationship[]
  pipelineRunId: string
}

/**
 * Load result
 */
export interface LoadResult {
  /** Successfully loaded event IDs */
  loadedEvents: string[]
  /** Successfully loaded outcome IDs */
  loadedOutcomes: string[]
  /** Successfully loaded relationship IDs */
  loadedRelationships: string[]
  /** Records that failed to load */
  failed: LoadError[]
  /** Stats */
  stats: {
    eventsLoaded: number
    outcomesLoaded: number
    relationshipsLoaded: number
    failedCount: number
    durationMs: number
  }
}

/**
 * Load error
 */
export interface LoadError {
  type: 'event' | 'outcome' | 'relationship'
  id: string
  error: string
  code: string
}

// =============================================================================
// Orchestration Types
// =============================================================================

/**
 * Pipeline configuration
 */
export interface PipelineConfig {
  /** Pipeline identifier */
  id: string
  /** Human-readable name */
  name: string
  /** Description */
  description?: string
  /** Extraction configuration */
  extraction: {
    batchSize: number
    since?: Date
    includeUnpairedEvents: boolean
  }
  /** Transformation configuration */
  transformation: {
    /** Skip invalid records or fail the batch */
    skipInvalidRecords: boolean
    /** Max validation errors before failing */
    maxValidationErrors: number
  }
  /** Loading configuration */
  loading: {
    /** Batch size for Neo4j writes */
    batchSize: number
    /** Retry failed loads */
    retryFailed: boolean
    /** Max retry attempts */
    maxRetries: number
  }
  /** Retry configuration */
  retry: {
    /** Max retries for failed stages */
    maxRetries: number
    /** Delay between retries (ms) */
    retryDelayMs: number
    /** Exponential backoff multiplier */
    backoffMultiplier: number
  }
  /** Checkpointing configuration */
  checkpoint: {
    /** Enable checkpointing */
    enabled: boolean
    /** Save checkpoint every N records */
    interval: number
  }
}

/**
 * Pipeline run state
 */
export interface PipelineRun {
  /** Run identifier */
  id: string
  /** Pipeline configuration used */
  pipelineId: string
  /** Run status */
  status: PipelineStatus
  /** Stage states */
  stages: Record<PipelineStage, StageState>
  /** Start time */
  startedAt: Date
  /** End time (if completed/failed/cancelled) */
  endedAt?: Date
  /** Checkpoint data for resume */
  checkpoint?: PipelineCheckpoint
  /** Final result */
  result?: PipelineResult
  /** Error if failed */
  error?: PipelineError
  /** Total duration */
  durationMs?: number
}

/**
 * Stage state
 */
export interface StageState {
  name: PipelineStage
  status: StageStatus
  startedAt?: Date
  endedAt?: Date
  durationMs?: number
  recordsProcessed: number
  recordsSuccess: number
  recordsFailed: number
  error?: StageError
  /** Retry count */
  retries: number
}

/**
 * Stage error
 */
export interface StageError {
  message: string
  code: string
  details?: Record<string, unknown>
}

/**
 * Pipeline checkpoint for resume capability
 */
export interface PipelineCheckpoint {
  /** Checkpoint ID */
  id: string
  /** Pipeline run ID */
  pipelineRunId: string
  /** Stage that created this checkpoint */
  stage: PipelineStage
  /** Last successfully processed record ID */
  lastRecordId: string
  /** Checkpoint timestamp */
  createdAt: Date
  /** Stage-specific checkpoint data */
  data: Record<string, unknown>
}

/**
 * Pipeline result
 */
export interface PipelineResult {
  /** Total records processed */
  totalRecords: number
  /** Successfully processed records */
  successRecords: number
  /** Failed records */
  failedRecords: number
  /** Extraction stats */
  extraction: {
    pairsExtracted: number
    durationMs: number
  }
  /** Transformation stats */
  transformation: {
    eventsCreated: number
    outcomesCreated: number
    relationshipsCreated: number
    durationMs: number
  }
  /** Loading stats */
  loading: {
    eventsLoaded: number
    outcomesLoaded: number
    relationshipsLoaded: number
    durationMs: number
  }
  /** Total pipeline duration */
  totalDurationMs: number
}

/**
 * Pipeline error
 */
export interface PipelineError {
  message: string
  code: string
  stage?: PipelineStage
  details?: Record<string, unknown>
}

// =============================================================================
// Observability Types
// =============================================================================

/**
 * Log level for pipeline events
 */
export type LogLevel = 'debug' | 'info' | 'warn' | 'error' | 'fatal'

/**
 * Pipeline event for logging
 */
export interface PipelineLogEvent {
  /** Event timestamp */
  timestamp: Date
  /** Log level */
  level: LogLevel
  /** Pipeline run ID */
  pipelineRunId: string
  /** Stage (if applicable) */
  stage?: PipelineStage
  /** Event message */
  message: string
  /** Event code */
  code: string
  /** Additional context */
  context?: Record<string, unknown>
  /** Duration in ms (if timing event) */
  durationMs?: number
}

/**
 * Pipeline metrics
 */
export interface PipelineMetrics {
  /** Pipeline run ID */
  pipelineRunId: string
  /** Metrics timestamp */
  timestamp: Date
  /** Records processed per second */
  recordsPerSecond: number
  /** Average latency per record (ms) */
  avgLatencyMs: number
  /** Error rate (errors / total records) */
  errorRate: number
  /** Success rate */
  successRate: number
  /** Memory usage (bytes) */
  memoryUsage?: number
  /** Stage-specific metrics */
  stages: Record<PipelineStage, StageMetrics>
}

/**
 * Stage metrics
 */
export interface StageMetrics {
  name: PipelineStage
  recordsProcessed: number
  recordsSuccess: number
  recordsFailed: number
  durationMs: number
  throughput: number // records per second
  errorRate: number
}

/**
 * Alert configuration
 */
export interface AlertConfig {
  /** Enable alerts */
  enabled: boolean
  /** Alert thresholds */
  thresholds: {
    /** Error rate threshold (0-1) */
    errorRate: number
    /** Latency threshold (ms) */
    latencyMs: number
    /** Failure count threshold */
    failureCount: number
  }
  /** Alert channels */
  channels: AlertChannel[]
}

/**
 * Alert channel
 */
export type AlertChannel = 
  | { type: 'log'; level: LogLevel }
  | { type: 'webhook'; url: string }
  | { type: 'email'; recipients: string[] }

/**
 * Alert event
 */
export interface AlertEvent {
  id: string
  timestamp: Date
  pipelineRunId: string
  type: 'error_rate' | 'latency' | 'failure' | 'stale'
  message: string
  severity: 'warning' | 'critical'
  context: Record<string, unknown>
}

// =============================================================================
// All types are exported via 'export interface/type' above
// =============================================================================