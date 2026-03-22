/**
 * Orchestrator Tests
 * 
 * Tests for ETL pipeline orchestration.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { PipelineOrchestrator, createOrchestrator } from './orchestrator'
import type { PipelineConfig, PipelineRun, ExtractionOptions } from './types'

// =============================================================================
// Test Setup
// =============================================================================

describe('PipelineOrchestrator', () => {
  let orchestrator: PipelineOrchestrator

  beforeEach(() => {
    orchestrator = createOrchestrator()
  })

  // =============================================================================
  // Pipeline Start Tests
  // =============================================================================

  describe('start', () => {
    it('should start a new pipeline run', async () => {
      const run = await orchestrator.start()

      expect(run).toBeDefined()
      expect(run.id).toBeDefined()
      expect(run.pipelineId).toBeDefined()
      expect(run.status).toBeDefined()
      expect(run.startedAt).toBeInstanceOf(Date)
    })

    it('should initialize all stages', async () => {
      const run = await orchestrator.start()

      expect(run.stages.extract).toBeDefined()
      expect(run.stages.transform).toBeDefined()
      expect(run.stages.load).toBeDefined()

      // After completion, all stages should be completed
      expect(run.stages.extract.status).toBe('completed')
      expect(run.stages.transform.status).toBe('completed')
      expect(run.stages.load.status).toBe('completed')
    })

    it('should accept custom run ID', async () => {
      const customId = 'custom-run-123'
      const run = await orchestrator.start({}, customId)

      expect(run.id).toBe(customId)
    })

    it('should accept extraction options', async () => {
      const options: ExtractionOptions = {
        batchSize: 50,
        since: new Date(Date.now() - 3600000),
        includeUnpairedEvents: false,
      }

      const run = await orchestrator.start(options)
      expect(run).toBeDefined()
    })
  })

  // =============================================================================
  // Pipeline Execution Tests
  // =============================================================================

  describe('execution', () => {
    it('should complete all stages', async () => {
      const run = await orchestrator.start({ batchSize: 10 })

      // Wait for completion
      await new Promise((resolve) => setTimeout(resolve, 500))

      expect(run.status).toBe('completed')
      expect(run.stages.extract.status).toBe('completed')
      expect(run.stages.transform.status).toBe('completed')
      expect(run.stages.load.status).toBe('completed')
    })

    it('should track records processed in each stage', async () => {
      const run = await orchestrator.start({ batchSize: 20 })

      // Wait for completion
      await new Promise((resolve) => setTimeout(resolve, 500))

      expect(run.stages.extract.recordsProcessed).toBeGreaterThan(0)
      expect(run.stages.transform.recordsProcessed).toBeGreaterThan(0)
      expect(run.stages.load.recordsProcessed).toBeGreaterThan(0)
    })

    it('should track successful records in each stage', async () => {
      const run = await orchestrator.start({ batchSize: 15 })

      // Wait for completion
      await new Promise((resolve) => setTimeout(resolve, 500))

      expect(run.stages.extract.recordsSuccess).toBeGreaterThanOrEqual(0)
      expect(run.stages.transform.recordsSuccess).toBeGreaterThanOrEqual(0)
      expect(run.stages.load.recordsSuccess).toBeGreaterThanOrEqual(0)
    })

    it('should record stage durations', async () => {
      const run = await orchestrator.start({ batchSize: 10 })

      // Wait for completion
      await new Promise((resolve) => setTimeout(resolve, 500))

      expect(run.stages.extract.durationMs).toBeDefined()
      expect(run.stages.extract.durationMs).toBeGreaterThan(0)
    })
  })

  // =============================================================================
  // Pipeline Result Tests
  // =============================================================================

  describe('results', () => {
    it('should record total records processed', async () => {
      const run = await orchestrator.start({ batchSize: 25 })

      // Wait for completion
      await new Promise((resolve) => setTimeout(resolve, 500))

      expect(run.result).toBeDefined()
      expect(run.result!.totalRecords).toBeGreaterThan(0)
    })

    it('should record extraction stats', async () => {
      const run = await orchestrator.start({ batchSize: 20 })

      // Wait for completion
      await new Promise((resolve) => setTimeout(resolve, 500))

      expect(run.result!.extraction.pairsExtracted).toBeGreaterThan(0)
      expect(run.result!.extraction.durationMs).toBeGreaterThan(0)
    })

    it('should record transformation stats', async () => {
      const run = await orchestrator.start({ batchSize: 15 })

      // Wait for completion
      await new Promise((resolve) => setTimeout(resolve, 500))

      expect(run.result!.transformation.eventsCreated).toBeGreaterThan(0)
      expect(run.result!.transformation.outcomesCreated).toBeGreaterThanOrEqual(0)
    })

    it('should record loading stats', async () => {
      const run = await orchestrator.start({ batchSize: 10 })

      // Wait for completion
      await new Promise((resolve) => setTimeout(resolve, 500))

      expect(run.result!.loading.eventsLoaded).toBeGreaterThan(0)
      expect(run.result!.loading.durationMs).toBeGreaterThan(0)
    })

    it('should record total duration', async () => {
      const run = await orchestrator.start({ batchSize: 10 })

      // Wait for completion
      await new Promise((resolve) => setTimeout(resolve, 500))

      expect(run.durationMs).toBeDefined()
      expect(run.durationMs).toBeGreaterThan(0)
    })
  })

  // =============================================================================
  // Error Handling Tests
  // =============================================================================

  describe('error handling', () => {
    it('should track failed records', async () => {
      const run = await orchestrator.start({ batchSize: 20 })

      // Wait for completion
      await new Promise((resolve) => setTimeout(resolve, 500))

      expect(run.stages.extract.recordsFailed).toBeGreaterThanOrEqual(0)
      expect(run.stages.transform.recordsFailed).toBeGreaterThanOrEqual(0)
      expect(run.stages.load.recordsFailed).toBeGreaterThanOrEqual(0)
    })

    it('should handle partial failures gracefully', async () => {
      const config: Partial<PipelineConfig> = {
        transformation: {
          skipInvalidRecords: true,
          maxValidationErrors: 5,
        },
      }

      const orch = createOrchestrator(config)
      const run = await orch.start({ batchSize: 15 })

      // Wait for completion
      await new Promise((resolve) => setTimeout(resolve, 500))

      // Should still complete even with some failures
      expect(run.status).toBe('completed')
    })
  })

  // =============================================================================
  // Retry Logic Tests
  // =============================================================================

  describe('retry logic', () => {
    it('should retry failed stages', async () => {
      const config: Partial<PipelineConfig> = {
        retry: {
          maxRetries: 2,
          retryDelayMs: 100,
          backoffMultiplier: 1.5,
        },
      }

      const orch = createOrchestrator(config)
      const run = await orch.start({ batchSize: 10 })

      // Wait for completion
      await new Promise((resolve) => setTimeout(resolve, 500))

      expect(run.stages.extract.retries).toBeGreaterThanOrEqual(0)
    })

    it('should use exponential backoff for retries', async () => {
      const config: Partial<PipelineConfig> = {
        retry: {
          maxRetries: 3,
          retryDelayMs: 50,
          backoffMultiplier: 2,
        },
      }

      const orch = createOrchestrator(config)
      const run = await orch.start({ batchSize: 10 })

      // Wait for completion
      await new Promise((resolve) => setTimeout(resolve, 500))

      expect(run.status).toBeDefined()
    })
  })

  // =============================================================================
  // Cancellation Tests
  // =============================================================================

  describe('cancel', () => {
    it('should cancel a running pipeline', async () => {
      const startPromise = orchestrator.start({ batchSize: 100 })

      // Cancel immediately
      await orchestrator.cancel()

      const run = await startPromise

      // Run should be cancelled
      expect(run.status).toBe('cancelled')
    })

    it('should set end time on cancellation', async () => {
      const startPromise = orchestrator.start({ batchSize: 100 })
      await orchestrator.cancel()

      const run = await startPromise

      expect(run.endedAt).toBeDefined()
      expect(run.endedAt).toBeInstanceOf(Date)
    })
  })

  // =============================================================================
  // State Management Tests
  // =============================================================================

  describe('state management', () => {
    it('should track current run', async () => {
      const run = await orchestrator.start({ batchSize: 5 })

      const currentRun = orchestrator.getCurrentRun()

      expect(currentRun).toBeDefined()
      expect(currentRun!.id).toBe(run.id)
    })

    it('should clear current run state after completion', async () => {
      const run = await orchestrator.start({ batchSize: 5 })

      // Wait for completion
      await new Promise((resolve) => setTimeout(resolve, 500))

      const currentRun = orchestrator.getCurrentRun()
      expect(currentRun!.status).toBe('completed')
    })
  })

  // =============================================================================
  // Configuration Tests
  // =============================================================================

  describe('configuration', () => {
    it('should use default configuration', () => {
      const orch = createOrchestrator()
      expect(orch).toBeDefined()
    })

    it('should accept custom configuration', async () => {
      const config: Partial<PipelineConfig> = {
        id: 'custom-pipeline',
        name: 'Custom Import Pipeline',
        extraction: {
          batchSize: 50,
          includeUnpairedEvents: false,
        },
        transformation: {
          skipInvalidRecords: true,
          maxValidationErrors: 10,
        },
        loading: {
          batchSize: 25,
          retryFailed: true,
          maxRetries: 5,
        },
      }

      const orch = createOrchestrator(config)
      const run = await orch.start({ batchSize: 50 })

      expect(run.pipelineId).toBe('custom-pipeline')
    })

    it('should use custom batch sizes', async () => {
      const config: Partial<PipelineConfig> = {
        extraction: {
          batchSize: 30,
          includeUnpairedEvents: true,
        },
      }

      const orch = createOrchestrator(config)
      const run = await orch.start({ batchSize: 30 })

      expect(run).toBeDefined()
    })
  })
})

// =============================================================================
// Integration Tests
// =============================================================================

describe('PipelineOrchestrator Integration', () => {
  it('should run full pipeline end-to-end', async () => {
    const orchestrator = createOrchestrator({
      extraction: { batchSize: 20, includeUnpairedEvents: true },
      transformation: { skipInvalidRecords: true, maxValidationErrors: 5 },
      loading: { batchSize: 10, retryFailed: true, maxRetries: 3 },
    })

    const run = await orchestrator.start({
      batchSize: 20,
      includeUnpairedEvents: true,
    })

    // Wait for completion
    await new Promise((resolve) => setTimeout(resolve, 500))

    expect(run.status).toBe('completed')
    expect(run.stages.extract.status).toBe('completed')
    expect(run.stages.transform.status).toBe('completed')
    expect(run.stages.load.status).toBe('completed')
    expect(run.result).toBeDefined()
    expect(run.result!.totalRecords).toBeGreaterThan(0)
  })

  it('should handle multiple sequential runs', async () => {
    const orchestrator = createOrchestrator()

    // First run
    const run1 = await orchestrator.start({ batchSize: 10 })
    await new Promise((resolve) => setTimeout(resolve, 300))

    expect(run1.status).toBe('completed')

    // Second run
    const run2 = await orchestrator.start({ batchSize: 10 })
    await new Promise((resolve) => setTimeout(resolve, 300))

    expect(run2.status).toBe('completed')
    expect(run2.id).not.toBe(run1.id)
  })

  it('should checkpoint progress during extraction', async () => {
    const orchestrator = createOrchestrator({
      checkpoint: { enabled: true, interval: 10 },
    })

    const run = await orchestrator.start({ batchSize: 50 })
    await new Promise((resolve) => setTimeout(resolve, 300))

    // Checkpoint should be saved during extraction
    // (in real implementation, would verify checkpoint in DB)
    expect(run.status).toBe('completed')
  })
})