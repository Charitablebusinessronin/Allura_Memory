/**
 * Observability Tests
 * 
 * Tests for pipeline logging, metrics, and alerting.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { PipelineLogger, MetricsCollector, AlertManager, createObservability } from './observability'
import type { PipelineLogEvent, PipelineMetrics, StageMetrics, LogLevel } from './types'

// =============================================================================
// Logger Tests
// =============================================================================

describe('PipelineLogger', () => {
  let logger: PipelineLogger

  beforeEach(() => {
    logger = new PipelineLogger({ minLevel: 'debug' })
    vi.spyOn(console, 'debug').mockImplementation(() => {})
    vi.spyOn(console, 'info').mockImplementation(() => {})
    vi.spyOn(console, 'warn').mockImplementation(() => {})
    vi.spyOn(console, 'error').mockImplementation(() => {})
  })

  describe('logging', () => {
    it('should log debug events', () => {
      logger.debug({
        pipelineRunId: 'test-run-1',
        message: 'Debug message',
        code: 'DEBUG_TEST',
      })

      const logs = logger.getLogs()
      expect(logs.length).toBe(1)
      expect(logs[0].level).toBe('debug')
      expect(logs[0].message).toBe('Debug message')
    })

    it('should log info events', () => {
      logger.info({
        pipelineRunId: 'test-run-2',
        message: 'Info message',
        code: 'INFO_TEST',
      })

      const logs = logger.getLogs()
      expect(logs.length).toBe(1)
      expect(logs[0].level).toBe('info')
    })

    it('should log warn events', () => {
      logger.warn({
        pipelineRunId: 'test-run-3',
        message: 'Warning message',
        code: 'WARN_TEST',
      })

      const logs = logger.getLogs()
      expect(logs.length).toBe(1)
      expect(logs[0].level).toBe('warn')
    })

    it('should log error events', () => {
      logger.error({
        pipelineRunId: 'test-run-4',
        message: 'Error message',
        code: 'ERROR_TEST',
      })

      const logs = logger.getLogs()
      expect(logs.length).toBe(1)
      expect(logs[0].level).toBe('error')
    })

    it('should log fatal events', () => {
      logger.fatal({
        pipelineRunId: 'test-run-5',
        message: 'Fatal message',
        code: 'FATAL_TEST',
      })

      const logs = logger.getLogs()
      expect(logs.length).toBe(1)
      expect(logs[0].level).toBe('fatal')
    })
  })

  describe('log filtering', () => {
    it('should filter logs by level', () => {
      logger.debug({ pipelineRunId: 'test', message: 'debug', code: 'D' })
      logger.info({ pipelineRunId: 'test', message: 'info', code: 'I' })
      logger.warn({ pipelineRunId: 'test', message: 'warn', code: 'W' })
      logger.error({ pipelineRunId: 'test', message: 'error', code: 'E' })

      const errorLogs = logger.getLogs({ level: 'error' })
      expect(errorLogs.length).toBe(1)
      expect(errorLogs[0].message).toBe('error')
    })

    it('should filter logs by pipeline run ID', () => {
      logger.info({ pipelineRunId: 'run-a', message: 'msg a1', code: 'A' })
      logger.info({ pipelineRunId: 'run-b', message: 'msg b1', code: 'B' })
      logger.info({ pipelineRunId: 'run-a', message: 'msg a2', code: 'A' })

      const runALogs = logger.getLogs({ pipelineRunId: 'run-a' })
      expect(runALogs.length).toBe(2)
      expect(runALogs.every((l) => l.pipelineRunId === 'run-a')).toBe(true)
    })

    it('should filter logs by stage', () => {
      logger.info({ pipelineRunId: 'test', stage: 'extract', message: 'extract log', code: 'E' })
      logger.info({ pipelineRunId: 'test', stage: 'transform', message: 'transform log', code: 'T' })
      logger.info({ pipelineRunId: 'test', stage: 'extract', message: 'another extract log', code: 'E' })

      const extractLogs = logger.getLogs({ stage: 'extract' })
      expect(extractLogs.length).toBe(2)
      expect(extractLogs.every((l) => l.stage === 'extract')).toBe(true)
    })

    it('should limit log results', () => {
      for (let i = 0; i < 10; i++) {
        logger.info({ pipelineRunId: 'test', message: `msg ${i}`, code: 'M' })
      }

      const limitedLogs = logger.getLogs({ limit: 5 })
      expect(limitedLogs.length).toBe(5)
    })
  })

  describe('log storage', () => {
    it('should store logs with timestamps', () => {
      logger.info({ pipelineRunId: 'test', message: 'timed log', code: 'T' })

      const logs = logger.getLogs()
      expect(logs[0].timestamp).toBeInstanceOf(Date)
    })

    it('should store logs with context', () => {
      logger.info({
        pipelineRunId: 'test',
        message: 'context log',
        code: 'C',
        context: { key: 'value', count: 42 },
      })

      const logs = logger.getLogs()
      expect(logs[0].context).toEqual({ key: 'value', count: 42 })
    })

    it('should store logs with duration', () => {
      logger.info({
        pipelineRunId: 'test',
        message: 'timing log',
        code: 'T',
        durationMs: 150,
      })

      const logs = logger.getLogs()
      expect(logs[0].durationMs).toBe(150)
    })

    it('should trim logs over max', () => {
      const smallLogger = new PipelineLogger({ minLevel: 'debug', maxLogs: 10 })

      for (let i = 0; i < 20; i++) {
        smallLogger.info({ pipelineRunId: 'test', message: `msg ${i}`, code: 'M' })
      }

      const logs = smallLogger.getLogs()
      expect(logs.length).toBe(10)
    })
  })

  describe('log retrieval', () => {
    it('should get logs for a specific run', () => {
      logger.info({ pipelineRunId: 'run-1', message: 'msg 1', code: 'M' })
      logger.info({ pipelineRunId: 'run-2', message: 'msg 2', code: 'M' })
      logger.info({ pipelineRunId: 'run-1', message: 'msg 3', code: 'M' })

      const run1Logs = logger.getLogsForRun('run-1')
      expect(run1Logs.length).toBe(2)
    })

    it('should clear all logs', () => {
      logger.info({ pipelineRunId: 'test', message: 'msg 1', code: 'M' })
      logger.info({ pipelineRunId: 'test', message: 'msg 2', code: 'M' })

      logger.clearLogs()

      const logs = logger.getLogs()
      expect(logs.length).toBe(0)
    })

    it('should export logs as JSON', () => {
      logger.info({ pipelineRunId: 'test', message: 'export test', code: 'E' })

      const json = logger.exportLogs()
      expect(json).toBeDefined()
      expect(typeof json).toBe('string')

      const parsed = JSON.parse(json)
      expect(Array.isArray(parsed)).toBe(true)
    })
  })

  describe('log levels', () => {
    it('should respect minimum log level', () => {
      const warnLogger = new PipelineLogger({ minLevel: 'warn' })

      warnLogger.debug({ pipelineRunId: 'test', message: 'debug', code: 'D' })
      warnLogger.info({ pipelineRunId: 'test', message: 'info', code: 'I' })

      const logs = warnLogger.getLogs()
      expect(logs.length).toBe(0)
    })

    it('should log warnings and above', () => {
      const warnLogger = new PipelineLogger({ minLevel: 'warn' })

      warnLogger.warn({ pipelineRunId: 'test', message: 'warn', code: 'W' })
      warnLogger.error({ pipelineRunId: 'test', message: 'error', code: 'E' })

      const logs = warnLogger.getLogs()
      expect(logs.length).toBe(2)
    })
  })
})

// =============================================================================
// Metrics Collector Tests
// =============================================================================

describe('MetricsCollector', () => {
  let metrics: MetricsCollector

  beforeEach(() => {
    metrics = new MetricsCollector()
  })

  describe('recording metrics', () => {
    it('should record pipeline metrics', () => {
      const pipelineMetrics: PipelineMetrics = {
        pipelineRunId: 'run-1',
        timestamp: new Date(),
        recordsPerSecond: 100,
        avgLatencyMs: 50,
        errorRate: 0.01,
        successRate: 0.99,
        stages: {
          extract: {
            name: 'extract',
            recordsProcessed: 100,
            recordsSuccess: 99,
            recordsFailed: 1,
            durationMs: 1000,
            throughput: 100,
            errorRate: 0.01,
          },
          transform: {
            name: 'transform',
            recordsProcessed: 99,
            recordsSuccess: 98,
            recordsFailed: 1,
            durationMs: 500,
            throughput: 198,
            errorRate: 0.01,
          },
          load: {
            name: 'load',
            recordsProcessed: 98,
            recordsSuccess: 97,
            recordsFailed: 1,
            durationMs: 200,
            throughput: 490,
            errorRate: 0.01,
          },
        },
      }

      metrics.recordMetrics(pipelineMetrics)

      const retrieved = metrics.getMetrics('run-1')
      expect(retrieved).toEqual(pipelineMetrics)
    })

    it('should record stage metrics', () => {
      const stageMetrics: StageMetrics = {
        name: 'extract',
        recordsProcessed: 100,
        recordsSuccess: 100,
        recordsFailed: 0,
        durationMs: 1000,
        throughput: 100,
        errorRate: 0,
      }

      metrics.recordStageMetrics('extract', stageMetrics)

      const retrieved = metrics.getStageMetrics('extract')
      expect(retrieved.length).toBe(1)
      expect(retrieved[0]).toEqual(stageMetrics)
    })
  })

  describe('retrieving metrics', () => {
    it('should return undefined for unknown run', () => {
      const retrieved = metrics.getMetrics('unknown-run')
      expect(retrieved).toBeUndefined()
    })

    it('should calculate aggregate metrics', () => {
      const pipelineMetrics: PipelineMetrics = {
        pipelineRunId: 'run-1',
        timestamp: new Date(),
        recordsPerSecond: 100,
        avgLatencyMs: 50,
        errorRate: 0.01,
        successRate: 0.99,
        stages: {
          extract: {
            name: 'extract',
            recordsProcessed: 100,
            recordsSuccess: 99,
            recordsFailed: 1,
            durationMs: 1000,
            throughput: 100,
            errorRate: 0.01,
          },
          transform: {
            name: 'transform',
            recordsProcessed: 99,
            recordsSuccess: 98,
            recordsFailed: 1,
            durationMs: 500,
            throughput: 198,
            errorRate: 0.01,
          },
          load: {
            name: 'load',
            recordsProcessed: 98,
            recordsSuccess: 97,
            recordsFailed: 1,
            durationMs: 200,
            throughput: 490,
            errorRate: 0.01,
          },
        },
      }

      metrics.recordMetrics(pipelineMetrics)

      const aggregate = metrics.calculateAggregateMetrics('run-1')

      expect(aggregate).toBeDefined()
      expect(aggregate!.totalRecords).toBe(297) // 100 + 99 + 98
      expect(aggregate!.totalSuccess).toBe(294) // 99 + 98 + 97
      expect(aggregate!.totalFailed).toBe(3) // 1 + 1 + 1
    })

    it('should return null for unknown run', () => {
      const aggregate = metrics.calculateAggregateMetrics('unknown-run')
      expect(aggregate).toBeNull()
    })

    it('should provide metrics summary', () => {
      const pipelineMetrics: PipelineMetrics = {
        pipelineRunId: 'run-1',
        timestamp: new Date(),
        recordsPerSecond: 100,
        avgLatencyMs: 50,
        errorRate: 0.01,
        successRate: 0.99,
        stages: {
          extract: {
            name: 'extract',
            recordsProcessed: 100,
            recordsSuccess: 100,
            recordsFailed: 0,
            durationMs: 1000,
            throughput: 100,
            errorRate: 0,
          },
          transform: {
            name: 'transform',
            recordsProcessed: 100,
            recordsSuccess: 100,
            recordsFailed: 0,
            durationMs: 500,
            throughput: 200,
            errorRate: 0,
          },
          load: {
            name: 'load',
            recordsProcessed: 100,
            recordsSuccess: 100,
            recordsFailed: 0,
            durationMs: 200,
            throughput: 500,
            errorRate: 0,
          },
        },
      }

      metrics.recordMetrics(pipelineMetrics)

      const summary = metrics.getMetricsSummary()
      expect(summary.totalRuns).toBe(1)
      expect(summary.totalRecordsProcessed).toBe(300) // 100 per stage * 3 stages
    })
  })

  describe('clearing metrics', () => {
    it('should clear all metrics', () => {
      const pipelineMetrics: PipelineMetrics = {
        pipelineRunId: 'run-1',
        timestamp: new Date(),
        recordsPerSecond: 100,
        avgLatencyMs: 50,
        errorRate: 0.01,
        successRate: 0.99,
        stages: {
          extract: { name: 'extract', recordsProcessed: 100, recordsSuccess: 100, recordsFailed: 0, durationMs: 1000, throughput: 100, errorRate: 0 },
          transform: { name: 'transform', recordsProcessed: 100, recordsSuccess: 100, recordsFailed: 0, durationMs: 500, throughput: 200, errorRate: 0 },
          load: { name: 'load', recordsProcessed: 100, recordsSuccess: 100, recordsFailed: 0, durationMs: 200, throughput: 500, errorRate: 0 },
        },
      }

      metrics.recordMetrics(pipelineMetrics)
      metrics.clearMetrics()

      const retrieved = metrics.getMetrics('run-1')
      expect(retrieved).toBeUndefined()
    })

    it('should export metrics as JSON', () => {
      const pipelineMetrics: PipelineMetrics = {
        pipelineRunId: 'run-1',
        timestamp: new Date(),
        recordsPerSecond: 100,
        avgLatencyMs: 50,
        errorRate: 0.01,
        successRate: 0.99,
        stages: {
          extract: { name: 'extract', recordsProcessed: 100, recordsSuccess: 100, recordsFailed: 0, durationMs: 1000, throughput: 100, errorRate: 0 },
          transform: { name: 'transform', recordsProcessed: 100, recordsSuccess: 100, recordsFailed: 0, durationMs: 500, throughput: 200, errorRate: 0 },
          load: { name: 'load', recordsProcessed: 100, recordsSuccess: 100, recordsFailed: 0, durationMs: 200, throughput: 500, errorRate: 0 },
        },
      }

      metrics.recordMetrics(pipelineMetrics)

      const json = metrics.exportMetrics()
      expect(json).toBeDefined()
      expect(typeof json).toBe('string')
    })
  })
})

// =============================================================================
// Alert Manager Tests
// =============================================================================

describe('AlertManager', () => {
  let alertManager: AlertManager
  let logger: PipelineLogger

  beforeEach(() => {
    logger = new PipelineLogger({ minLevel: 'debug' })
    alertManager = new AlertManager({}, logger)
    vi.spyOn(console, 'error').mockImplementation(() => {})
    vi.spyOn(console, 'warn').mockImplementation(() => {})
  })

  describe('alert configuration', () => {
    it('should use default thresholds', () => {
      const am = new AlertManager()

      expect(am).toBeDefined()
    })

    it('should accept custom thresholds', () => {
      const am = new AlertManager({
        thresholds: {
          errorRate: 0.1,
          latencyMs: 5000,
          failureCount: 20,
        },
      })

      expect(am).toBeDefined()
    })
  })

  describe('alert checking', () => {
    it('should detect high error rate', () => {
      const metrics: PipelineMetrics = {
        pipelineRunId: 'run-1',
        timestamp: new Date(),
        recordsPerSecond: 100,
        avgLatencyMs: 50,
        errorRate: 0.1, // 10% - above default threshold of 5%
        successRate: 0.9,
        stages: {
          extract: { name: 'extract', recordsProcessed: 100, recordsSuccess: 90, recordsFailed: 10, durationMs: 1000, throughput: 90, errorRate: 0.1 },
          transform: { name: 'transform', recordsProcessed: 90, recordsSuccess: 90, recordsFailed: 0, durationMs: 500, throughput: 180, errorRate: 0 },
          load: { name: 'load', recordsProcessed: 90, recordsSuccess: 90, recordsFailed: 0, durationMs: 200, throughput: 450, errorRate: 0 },
        },
      }

      const alerts = alertManager.checkMetrics(metrics)

      expect(alerts.length).toBeGreaterThan(0)
      expect(alerts.some((a) => a.type === 'error_rate')).toBe(true)
    })

    it('should detect high latency', () => {
      const metrics: PipelineMetrics = {
        pipelineRunId: 'run-2',
        timestamp: new Date(),
        recordsPerSecond: 10,
        avgLatencyMs: 15000, // 15 seconds - above default threshold of 10s
        errorRate: 0,
        successRate: 1,
        stages: {
          extract: { name: 'extract', recordsProcessed: 100, recordsSuccess: 100, recordsFailed: 0, durationMs: 5000, throughput: 20, errorRate: 0 },
          transform: { name: 'transform', recordsProcessed: 100, recordsSuccess: 100, recordsFailed: 0, durationMs: 5000, throughput: 20, errorRate: 0 },
          load: { name: 'load', recordsProcessed: 100, recordsSuccess: 100, recordsFailed: 0, durationMs: 5000, throughput: 20, errorRate: 0 },
        },
      }

      const alerts = alertManager.checkMetrics(metrics)

      expect(alerts.length).toBeGreaterThan(0)
      expect(alerts.some((a) => a.type === 'latency')).toBe(true)
    })

    it('should detect high failure count', () => {
      const metrics: PipelineMetrics = {
        pipelineRunId: 'run-3',
        timestamp: new Date(),
        recordsPerSecond: 100,
        avgLatencyMs: 50,
        errorRate: 0.2,
        successRate: 0.8,
        stages: {
          extract: { name: 'extract', recordsProcessed: 100, recordsSuccess: 80, recordsFailed: 20, durationMs: 1000, throughput: 80, errorRate: 0.2 },
          transform: { name: 'transform', recordsProcessed: 80, recordsSuccess: 80, recordsFailed: 0, durationMs: 500, throughput: 160, errorRate: 0 },
          load: { name: 'load', recordsProcessed: 80, recordsSuccess: 80, recordsFailed: 0, durationMs: 200, throughput: 400, errorRate: 0 },
        },
      }

      const alerts = alertManager.checkMetrics(metrics)

      expect(alerts.some((a) => a.type === 'failure')).toBe(true)
    })

    it('should not alert on normal metrics', () => {
      const metrics: PipelineMetrics = {
        pipelineRunId: 'run-4',
        timestamp: new Date(),
        recordsPerSecond: 100,
        avgLatencyMs: 500,
        errorRate: 0.01,
        successRate: 0.99,
        stages: {
          extract: { name: 'extract', recordsProcessed: 100, recordsSuccess: 99, recordsFailed: 1, durationMs: 100, throughput: 990, errorRate: 0.01 },
          transform: { name: 'transform', recordsProcessed: 99, recordsSuccess: 99, recordsFailed: 0, durationMs: 50, throughput: 1980, errorRate: 0 },
          load: { name: 'load', recordsProcessed: 99, recordsSuccess: 99, recordsFailed: 0, durationMs: 25, throughput: 3960, errorRate: 0 },
        },
      }

      const alerts = alertManager.checkMetrics(metrics)

      expect(alerts.length).toBe(0)
    })
  })

  describe('alert management', () => {
    it('should store alerts', () => {
      const metrics: PipelineMetrics = {
        pipelineRunId: 'run-5',
        timestamp: new Date(),
        recordsPerSecond: 100,
        avgLatencyMs: 15000,
        errorRate: 0.2,
        successRate: 0.8,
        stages: {
          extract: { name: 'extract', recordsProcessed: 100, recordsSuccess: 80, recordsFailed: 20, durationMs: 1000, throughput: 80, errorRate: 0.2 },
          transform: { name: 'transform', recordsProcessed: 80, recordsSuccess: 80, recordsFailed: 0, durationMs: 500, throughput: 160, errorRate: 0 },
          load: { name: 'load', recordsProcessed: 80, recordsSuccess: 80, recordsFailed: 0, durationMs: 200, throughput: 400, errorRate: 0 },
        },
      }

      alertManager.checkMetrics(metrics)

      const alerts = alertManager.getAlerts()
      expect(alerts.length).toBeGreaterThan(0)
    })

    it('should filter alerts by pipeline run', () => {
      const metrics: PipelineMetrics = {
        pipelineRunId: 'run-6',
        timestamp: new Date(),
        recordsPerSecond: 100,
        avgLatencyMs: 15000,
        errorRate: 0.1,
        successRate: 0.9,
        stages: {
          extract: { name: 'extract', recordsProcessed: 100, recordsSuccess: 90, recordsFailed: 10, durationMs: 1000, throughput: 90, errorRate: 0.1 },
          transform: { name: 'transform', recordsProcessed: 90, recordsSuccess: 90, recordsFailed: 0, durationMs: 500, throughput: 180, errorRate: 0 },
          load: { name: 'load', recordsProcessed: 90, recordsSuccess: 90, recordsFailed: 0, durationMs: 200, throughput: 450, errorRate: 0 },
        },
      }

      alertManager.checkMetrics(metrics)

      const alerts = alertManager.getAlerts({ pipelineRunId: 'run-6' })
      expect(alerts.every((a) => a.pipelineRunId === 'run-6')).toBe(true)
    })

    it('should clear alerts', () => {
      const metrics: PipelineMetrics = {
        pipelineRunId: 'run-7',
        timestamp: new Date(),
        recordsPerSecond: 100,
        avgLatencyMs: 15000,
        errorRate: 0.2,
        successRate: 0.8,
        stages: {
          extract: { name: 'extract', recordsProcessed: 100, recordsSuccess: 80, recordsFailed: 20, durationMs: 1000, throughput: 80, errorRate: 0.2 },
          transform: { name: 'transform', recordsProcessed: 80, recordsSuccess: 80, recordsFailed: 0, durationMs: 500, throughput: 160, errorRate: 0 },
          load: { name: 'load', recordsProcessed: 80, recordsSuccess: 80, recordsFailed: 0, durationMs: 200, throughput: 400, errorRate: 0 },
        },
      }

      alertManager.checkMetrics(metrics)
      alertManager.clearAlerts()

      const alerts = alertManager.getAlerts()
      expect(alerts.length).toBe(0)
    })
  })

  describe('disabled alerts', () => {
    it('should not create alerts when disabled', () => {
      const disabledManager = new AlertManager({ enabled: false }, logger)

      const metrics: PipelineMetrics = {
        pipelineRunId: 'run-8',
        timestamp: new Date(),
        recordsPerSecond: 100,
        avgLatencyMs: 15000,
        errorRate: 0.5,
        successRate: 0.5,
        stages: {
          extract: { name: 'extract', recordsProcessed: 100, recordsSuccess: 50, recordsFailed: 50, durationMs: 1000, throughput: 50, errorRate: 0.5 },
          transform: { name: 'transform', recordsProcessed: 50, recordsSuccess: 50, recordsFailed: 0, durationMs: 500, throughput: 100, errorRate: 0 },
          load: { name: 'load', recordsProcessed: 50, recordsSuccess: 50, recordsFailed: 0, durationMs: 200, throughput: 250, errorRate: 0 },
        },
      }

      const alerts = disabledManager.checkMetrics(metrics)
      expect(alerts.length).toBe(0)
    })
  })
})

// =============================================================================
// Observability Factory Tests
// =============================================================================

describe('createObservability', () => {
  it('should create all observability components', () => {
    const obs = createObservability()

    expect(obs.logger).toBeInstanceOf(PipelineLogger)
    expect(obs.metrics).toBeInstanceOf(MetricsCollector)
    expect(obs.alerts).toBeInstanceOf(AlertManager)
  })

  it('should create components with custom config', () => {
    const obs = createObservability({
      logLevel: 'warn',
      maxLogs: 100,
      alertConfig: {
        enabled: true,
        thresholds: {
          errorRate: 0.1,
          latencyMs: 5000,
          failureCount: 50,
        },
      },
    })

    expect(obs.logger).toBeInstanceOf(PipelineLogger)
    expect(obs.metrics).toBeInstanceOf(MetricsCollector)
    expect(obs.alerts).toBeInstanceOf(AlertManager)
  })
})