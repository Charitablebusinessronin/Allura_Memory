/**
 * Pipeline Orchestrator
 * 
 * Manages the ETL pipeline workflow: Extract -> Transform -> Load.
 * Coordinates stages, handles retries, and manages checkpoints.
 */

import type {
  PipelineStage,
  PipelineStatus,
  StageStatus,
  PipelineConfig,
  PipelineRun,
  StageState,
  StageError,
  PipelineCheckpoint,
  PipelineResult,
  PipelineError,
  ExtractionOptions,
  ExtractionResult,
  TransformResult,
  LoadResult,
  EventOutcomePair,
  NormalizedEvent,
  NormalizedOutcome,
  NormalizedRelationship,
} from './types'
import { PostgresExtractor, createExtractor } from './extractor'
import { PipelineLogger, MetricsCollector, createObservability } from './observability'

// =============================================================================
// Configuration
// =============================================================================

const DEFAULT_PIPELINE_CONFIG: PipelineConfig = {
  id: 'default-import-pipeline',
  name: 'PostgreSQL to Neo4j Import Pipeline',
  description: 'ETL pipeline for knowledge creation',
  extraction: {
    batchSize: 100,
    includeUnpairedEvents: true,
  },
  transformation: {
    skipInvalidRecords: true,
    maxValidationErrors: 10,
  },
  loading: {
    batchSize: 50,
    retryFailed: true,
    maxRetries: 3,
  },
  retry: {
    maxRetries: 3,
    retryDelayMs: 1000,
    backoffMultiplier: 2,
  },
  checkpoint: {
    enabled: true,
    interval: 100,
  },
}

// =============================================================================
// Stage Names
// =============================================================================

const STAGE_NAMES: PipelineStage[] = ['extract', 'transform', 'load']

// =============================================================================
// Orchestrator Class
// =============================================================================

/**
 * Pipeline Orchestrator
 * 
 * Coordinates the ETL pipeline stages:
 * 1. Extract: Read Event-Outcome pairs from PostgreSQL
 * 2. Transform: Normalize data for Neo4j
 * 3. Load: Write to Neo4j knowledge graph
 * 
 * Features:
 * - Stage coordination
 * - Retry logic with exponential backoff
 * - Checkpointing for resume capability
 * - Observability (logging, metrics)
 */
export class PipelineOrchestrator {
  private config: PipelineConfig
  private extractor: PostgresExtractor
  private logger: PipelineLogger
  private metrics: MetricsCollector
  private currentRun: PipelineRun | null = null

  constructor(config: Partial<PipelineConfig> = {}) {
    this.config = { ...DEFAULT_PIPELINE_CONFIG, ...config }
    this.extractor = createExtractor()
    
    const observability = createObservability()
    this.logger = observability.logger
    this.metrics = observability.metrics
  }

  /**
   * Start a new pipeline run
   */
  async start(
    extractionOptions: ExtractionOptions = {},
    runId?: string
  ): Promise<PipelineRun> {
    const pipelineRunId = runId ?? `run-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`

    // Initialize run state
    this.currentRun = {
      id: pipelineRunId,
      pipelineId: this.config.id,
      status: 'pending',
      stages: {
        extract: this.createStageState('extract'),
        transform: this.createStageState('transform'),
        load: this.createStageState('load'),
      },
      startedAt: new Date(),
    }

    this.logger.info({
      pipelineRunId,
      message: 'Pipeline run started',
      code: 'PIPELINE_STARTED',
      context: { config: this.config.id },
    })

    // Run the pipeline
    await this.runPipeline(extractionOptions)

    return this.currentRun
  }

  /**
   * Resume a pipeline run from checkpoint
   */
  async resume(checkpoint: PipelineCheckpoint): Promise<PipelineRun> {
    if (!this.currentRun) {
      this.currentRun = {
        id: checkpoint.pipelineRunId,
        pipelineId: this.config.id,
        status: 'pending',
        stages: {
          extract: this.createStageState('extract'),
          transform: this.createStageState('transform'),
          load: this.createStageState('load'),
        },
        startedAt: new Date(),
        checkpoint,
      }
    } else {
      this.currentRun.checkpoint = checkpoint
    }

    this.logger.info({
      pipelineRunId: this.currentRun.id,
      stage: checkpoint.stage,
      message: 'Resuming pipeline from checkpoint',
      code: 'PIPELINE_RESUMED',
      context: { checkpointId: checkpoint.id },
    })

    // Determine which stage to resume from
    const stageOrder: PipelineStage[] = ['extract', 'transform', 'load']
    const stageIndex = stageOrder.indexOf(checkpoint.stage)

    // Resume from next stage
    if (stageIndex < stageOrder.length - 1) {
      const nextStage = stageOrder[stageIndex + 1]
      await this.runStage(nextStage, {})
    }

    return this.currentRun
  }

  /**
   * Cancel a running pipeline
   */
  async cancel(): Promise<void> {
    if (this.currentRun && this.currentRun.status === 'running') {
      this.currentRun.status = 'cancelled'
      this.currentRun.endedAt = new Date()
      
      this.logger.warn({
        pipelineRunId: this.currentRun.id,
        message: 'Pipeline run cancelled',
        code: 'PIPELINE_CANCELLED',
      })
    }
  }

  /**
   * Get current run state
   */
  getCurrentRun(): PipelineRun | null {
    return this.currentRun
  }

  // =============================================================================
  // Private Methods
  // =============================================================================

  /**
   * Run the full pipeline
   */
  private async runPipeline(extractionOptions: ExtractionOptions): Promise<void> {
    if (!this.currentRun) return

    try {
      this.currentRun.status = 'running'
      
      // Stage 1: Extract
      const extractResult = await this.runStage('extract', extractionOptions)
      if (this.shouldStop()) return

      // Stage 2: Transform
      const transformResult = await this.runStage('transform', extractResult)
      if (this.shouldStop()) return

      // Stage 3: Load
      await this.runStage('load', transformResult)

      // Mark complete
      this.currentRun.status = 'completed'
      this.currentRun.endedAt = new Date()
      this.currentRun.durationMs = 
        this.currentRun.endedAt.getTime() - this.currentRun.startedAt.getTime()

      this.logger.info({
        pipelineRunId: this.currentRun.id,
        message: 'Pipeline run completed successfully',
        code: 'PIPELINE_COMPLETED',
        durationMs: this.currentRun.durationMs,
      })

    } catch (error) {
      this.handlePipelineError(error)
    }
  }

  /**
   * Run a single stage with retry logic
   */
  private async runStage(
    stage: PipelineStage,
    input: unknown
  ): Promise<unknown> {
    if (!this.currentRun) throw new Error('No active pipeline run')

    const stageState = this.currentRun.stages[stage]
    stageState.status = 'running'
    stageState.startedAt = new Date()

    this.logger.info({
      pipelineRunId: this.currentRun.id,
      stage,
      message: `Stage ${stage} started`,
      code: 'STAGE_STARTED',
    })

    let lastError: Error | null = null
    let retries = 0
    const maxRetries = this.config.retry.maxRetries

    while (retries <= maxRetries) {
      try {
        let result: unknown

        switch (stage) {
          case 'extract':
            result = await this.executeExtract(input as ExtractionOptions)
            break
          case 'transform':
            result = await this.executeTransform(input as ExtractionResult)
            break
          case 'load':
            result = await this.executeLoad(input as TransformResult)
            break
        }

        // Success
        stageState.status = 'completed'
        stageState.endedAt = new Date()
        stageState.durationMs = 
          stageState.endedAt.getTime() - stageState.startedAt.getTime()

        this.logger.info({
          pipelineRunId: this.currentRun.id,
          stage,
          message: `Stage ${stage} completed`,
          code: 'STAGE_COMPLETED',
          durationMs: stageState.durationMs,
        })

        return result

      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error))
        retries++

        const stageError: StageError = {
          message: lastError.message,
          code: 'STAGE_ERROR',
          details: { stage, retry: retries },
        }
        stageState.error = stageError
        stageState.retries = retries

        this.logger.error({
          pipelineRunId: this.currentRun.id,
          stage,
          message: `Stage ${stage} failed, attempt ${retries}/${maxRetries}`,
          code: 'STAGE_ERROR',
          context: { error: lastError.message },
        })

        if (retries > maxRetries) {
          throw lastError
        }

        // Exponential backoff
        const delay = this.config.retry.retryDelayMs * 
          Math.pow(this.config.retry.backoffMultiplier, retries - 1)
        await this.sleep(delay)
      }
    }

    throw lastError ?? new Error(`Stage ${stage} failed`)
  }

  /**
   * Execute extraction stage
   */
  private async executeExtract(options: ExtractionOptions): Promise<ExtractionResult> {
    if (!this.currentRun) throw new Error('No active pipeline run')

    const startTime = Date.now()

    // Use watermark from checkpoint if resuming
    if (this.currentRun.checkpoint?.stage === 'extract') {
      options.since = this.currentRun.checkpoint.data.lastEventTime as Date
    }

    const result = await this.extractor.extract(this.currentRun.id, options)

    // Update stage state
    const stageState = this.currentRun.stages.extract
    stageState.recordsProcessed = result.totalFound
    stageState.recordsSuccess = result.pairs.length
    stageState.recordsFailed = result.errors.length

    // Record metrics
    this.metrics.recordStageMetrics('extract', {
      name: 'extract',
      recordsProcessed: result.totalFound,
      recordsSuccess: result.pairs.length,
      recordsFailed: result.errors.length,
      durationMs: result.durationMs,
      throughput: result.pairs.length / (result.durationMs / 1000),
      errorRate: result.errors.length / (result.totalFound || 1),
    })

    // Save checkpoint if enabled
    if (this.config.checkpoint.enabled && result.hasMore) {
      await this.saveCheckpoint('extract', {
        lastEventTime: result.nextWatermark,
        lastEventId: result.lastEventId,
      })
    }

    return result
  }

  /**
   * Execute transformation stage
   */
  private async executeTransform(
    extractionResult: ExtractionResult
  ): Promise<TransformResult> {
    if (!this.currentRun) throw new Error('No active pipeline run')

    const startTime = Date.now()

    const result = await this.transformPairs(extractionResult.pairs)

    // Update stage state
    const stageState = this.currentRun.stages.transform
    stageState.recordsProcessed = extractionResult.pairs.length
    stageState.recordsSuccess = result.events.length + result.outcomes.length
    stageState.recordsFailed = result.failed.length

    // Record metrics
    this.metrics.recordStageMetrics('transform', {
      name: 'transform',
      recordsProcessed: extractionResult.pairs.length,
      recordsSuccess: result.events.length + result.outcomes.length,
      recordsFailed: result.failed.length,
      durationMs: result.stats.durationMs,
      throughput: result.events.length / (result.stats.durationMs / 1000),
      errorRate: result.failed.length / (extractionResult.pairs.length || 1),
    })

    return result
  }

  /**
   * Execute loading stage
   */
  private async executeLoad(transformResult: TransformResult): Promise<LoadResult> {
    if (!this.currentRun) throw new Error('No active pipeline run')

    const startTime = Date.now()

    const result = await this.loadToNeo4j(transformResult)

    // Update stage state
    const stageState = this.currentRun.stages.load
    stageState.recordsProcessed = 
      transformResult.events.length + transformResult.outcomes.length
    stageState.recordsSuccess = 
      result.loadedEvents.length + result.loadedOutcomes.length
    stageState.recordsFailed = result.failed.length

    // Record metrics
    this.metrics.recordStageMetrics('load', {
      name: 'load',
      recordsProcessed: stageState.recordsProcessed,
      recordsSuccess: stageState.recordsSuccess,
      recordsFailed: stageState.recordsFailed,
      durationMs: result.stats.durationMs,
      throughput: stageState.recordsSuccess / (result.stats.durationMs / 1000),
      errorRate: result.failed.length / (stageState.recordsProcessed || 1),
    })

    // Create pipeline result
    this.currentRun.result = {
      totalRecords: this.currentRun.stages.extract.recordsProcessed,
      successRecords: stageState.recordsSuccess,
      failedRecords: stageState.recordsFailed,
      extraction: {
        pairsExtracted: this.currentRun.stages.extract.recordsSuccess,
        durationMs: this.currentRun.stages.extract.durationMs ?? 0,
      },
      transformation: {
        eventsCreated: transformResult.events.length,
        outcomesCreated: transformResult.outcomes.length,
        relationshipsCreated: transformResult.relationships.length,
        durationMs: transformResult.stats.durationMs,
      },
      loading: {
        eventsLoaded: result.loadedEvents.length,
        outcomesLoaded: result.loadedOutcomes.length,
        relationshipsLoaded: result.loadedRelationships.length,
        durationMs: result.stats.durationMs,
      },
      totalDurationMs: 
        (this.currentRun.endedAt?.getTime() ?? Date.now()) - 
        this.currentRun.startedAt.getTime(),
    }

    return result
  }

  /**
   * Transform Event-Outcome pairs to Neo4j format
   */
  private async transformPairs(pairs: EventOutcomePair[]): Promise<TransformResult> {
    const startTime = Date.now()
    const events: NormalizedEvent[] = []
    const outcomes: NormalizedOutcome[] = []
    const relationships: NormalizedRelationship[] = []
    const failed: Array<{ pair: EventOutcomePair; error: string; code: string }> = []

    for (const pair of pairs) {
      try {
        // Transform event
        const normalizedEvent: NormalizedEvent = {
          id: `neo-event-${pair.event.id}`,
          sourceId: pair.event.id,
          type: pair.event.eventType,
          timestamp: pair.event.eventTime.toISOString(),
          properties: {
            ...pair.event.payload,
            taskRunId: pair.event.taskRunId,
            sequenceNo: pair.event.sequenceNo,
          },
          metadata: {
            extractedAt: pair.extractedAt.toISOString(),
            source: 'postgresql',
          },
        }
        events.push(normalizedEvent)

        // Transform outcome if present
        if (pair.outcome) {
          const normalizedOutcome: NormalizedOutcome = {
            id: `neo-outcome-${pair.outcome.id}`,
            sourceId: pair.outcome.id,
            eventId: normalizedEvent.id,
            type: pair.outcome.outcomeType,
            timestamp: pair.outcome.occurredAt.toISOString(),
            severity: pair.outcome.severity,
            summary: pair.outcome.summary,
            properties: {
              ...pair.outcome.details,
              taskRunId: pair.outcome.taskRunId,
            },
            metadata: {
              extractedAt: pair.extractedAt.toISOString(),
              source: 'postgresql',
            },
          }
          outcomes.push(normalizedOutcome)

          // Create relationship
          relationships.push({
            eventId: normalizedEvent.id,
            outcomeId: normalizedOutcome.id,
            type: 'PRODUCED',
            properties: {
              createdAt: new Date().toISOString(),
            },
          })
        }

      } catch (error) {
        if (this.config.transformation.skipInvalidRecords) {
          failed.push({
            pair,
            error: error instanceof Error ? error.message : 'Unknown transform error',
            code: 'TRANSFORM_ERROR',
          })
        } else {
          throw error
        }
      }
    }

    const durationMs = Date.now() - startTime

    return {
      events,
      outcomes,
      relationships,
      failed,
      stats: {
        inputPairs: pairs.length,
        outputEvents: events.length,
        outputOutcomes: outcomes.length,
        outputRelationships: relationships.length,
        failedCount: failed.length,
        durationMs,
      },
    }
  }

  /**
   * Load transformed data to Neo4j (mock implementation)
   */
  private async loadToNeo4j(transformResult: TransformResult): Promise<LoadResult> {
    const startTime = Date.now()

    // Simulate network delay
    await new Promise((resolve) => setTimeout(resolve, Math.random() * 50 + 10))

    const loadedEvents: string[] = []
    const loadedOutcomes: string[] = []
    const loadedRelationships: string[] = []
    const failed: Array<{ type: 'event' | 'outcome' | 'relationship'; id: string; error: string; code: string }> = []

    // Simulate loading with random failures
    for (const event of transformResult.events) {
      if (Math.random() > 0.01) { // 99% success rate
        loadedEvents.push(event.id)
      } else {
        failed.push({
          type: 'event',
          id: event.id,
          error: 'Neo4j write failed',
          code: 'LOAD_ERROR',
        })
      }
    }

    for (const outcome of transformResult.outcomes) {
      if (Math.random() > 0.01) {
        loadedOutcomes.push(outcome.id)
      } else {
        failed.push({
          type: 'outcome',
          id: outcome.id,
          error: 'Neo4j write failed',
          code: 'LOAD_ERROR',
        })
      }
    }

    for (const rel of transformResult.relationships) {
      if (Math.random() > 0.01) {
        loadedRelationships.push(`${rel.eventId}-${rel.outcomeId}`)
      } else {
        failed.push({
          type: 'relationship',
          id: `${rel.eventId}-${rel.outcomeId}`,
          error: 'Neo4j write failed',
          code: 'LOAD_ERROR',
        })
      }
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
   * Save checkpoint for resume capability
   */
  private async saveCheckpoint(
    stage: PipelineStage,
    data: Record<string, unknown>
  ): Promise<void> {
    if (!this.currentRun) return

    const checkpoint: PipelineCheckpoint = {
      id: `checkpoint-${Date.now()}`,
      pipelineRunId: this.currentRun.id,
      stage,
      lastRecordId: data.lastEventId as string ?? '',
      createdAt: new Date(),
      data,
    }

    this.currentRun.checkpoint = checkpoint

    this.logger.debug({
      pipelineRunId: this.currentRun.id,
      stage,
      message: 'Checkpoint saved',
      code: 'CHECKPOINT_SAVED',
      context: { checkpointId: checkpoint.id },
    })
  }

  /**
   * Create initial stage state
   */
  private createStageState(name: PipelineStage): StageState {
    return {
      name,
      status: 'pending',
      recordsProcessed: 0,
      recordsSuccess: 0,
      recordsFailed: 0,
      retries: 0,
    }
  }

  /**
   * Handle pipeline error
   */
  private handlePipelineError(error: unknown): void {
    if (!this.currentRun) return

    const pipelineError: PipelineError = {
      message: error instanceof Error ? error.message : 'Unknown pipeline error',
      code: 'PIPELINE_ERROR',
      details: { error },
    }

    this.currentRun.status = 'failed'
    this.currentRun.error = pipelineError
    this.currentRun.endedAt = new Date()
    this.currentRun.durationMs = 
      this.currentRun.endedAt.getTime() - this.currentRun.startedAt.getTime()

    this.logger.error({
      pipelineRunId: this.currentRun.id,
      message: 'Pipeline run failed',
      code: 'PIPELINE_FAILED',
      context: { error: pipelineError.message },
    })
  }

  /**
   * Check if pipeline should stop
   */
  private shouldStop(): boolean {
    return (
      !this.currentRun ||
      this.currentRun.status === 'cancelled' ||
      this.currentRun.status === 'failed'
    )
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
 * Create a pipeline orchestrator
 */
export function createOrchestrator(config?: Partial<PipelineConfig>): PipelineOrchestrator {
  return new PipelineOrchestrator(config)
}

// =============================================================================
// Default Export
// =============================================================================

export default PipelineOrchestrator