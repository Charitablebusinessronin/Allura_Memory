/**
 * Pipeline Observability
 * 
 * Provides logging, metrics collection, and alerting for the import pipeline.
 */

import type {
  PipelineStage,
  LogLevel,
  PipelineLogEvent,
  PipelineMetrics,
  StageMetrics,
  AlertConfig,
  AlertEvent,
} from './types'

// =============================================================================
// Log Levels
// =============================================================================

const LOG_LEVEL_PRIORITY: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
  fatal: 4,
}

// =============================================================================
// Pipeline Logger
// =============================================================================

/**
 * Pipeline Logger
 * 
 * Provides structured logging for pipeline events.
 */
export class PipelineLogger {
  private minLevel: LogLevel
  private logs: PipelineLogEvent[] = []
  private maxLogs: number

  constructor(config: { minLevel?: LogLevel; maxLogs?: number } = {}) {
    this.minLevel = config.minLevel ?? 'debug'
    this.maxLogs = config.maxLogs ?? 10000
  }

  /**
   * Log a debug event
   */
  debug(event: Omit<PipelineLogEvent, 'level' | 'timestamp'>): void {
    this.log({ ...event, level: 'debug' })
  }

  /**
   * Log an info event
   */
  info(event: Omit<PipelineLogEvent, 'level' | 'timestamp'>): void {
    this.log({ ...event, level: 'info' })
  }

  /**
   * Log a warning event
   */
  warn(event: Omit<PipelineLogEvent, 'level' | 'timestamp'>): void {
    this.log({ ...event, level: 'warn' })
  }

  /**
   * Log an error event
   */
  error(event: Omit<PipelineLogEvent, 'level' | 'timestamp'>): void {
    this.log({ ...event, level: 'error' })
  }

  /**
   * Log a fatal event
   */
  fatal(event: Omit<PipelineLogEvent, 'level' | 'timestamp'>): void {
    this.log({ ...event, level: 'fatal' })
  }

  /**
   * Log an event (public method for external use)
   */
  logEvent(event: Omit<PipelineLogEvent, 'timestamp'>): void {
    this.log(event)
  }

  /**
   * Log an event
   */
  private log(event: Omit<PipelineLogEvent, 'timestamp'>): void {
    if (!this.shouldLog(event.level)) return

    const logEvent: PipelineLogEvent = {
      ...event,
      timestamp: new Date(),
    }

    this.logs.push(logEvent)

    // Trim logs if over max
    if (this.logs.length > this.maxLogs) {
      this.logs = this.logs.slice(-this.maxLogs)
    }

    // Also output to console
    this.outputToConsole(logEvent)
  }

  /**
   * Check if log level should be logged
   */
  private shouldLog(level: LogLevel): boolean {
    return LOG_LEVEL_PRIORITY[level] >= LOG_LEVEL_PRIORITY[this.minLevel]
  }

  /**
   * Output log to console
   */
  private outputToConsole(event: PipelineLogEvent): void {
    const prefix = `[${event.timestamp.toISOString()}] [${event.level.toUpperCase()}]`
    const pipelineInfo = event.pipelineRunId ? `[${event.pipelineRunId}]` : ''
    const stageInfo = event.stage ? `[${event.stage}]` : ''
    const durationInfo = event.durationMs ? ` (${event.durationMs}ms)` : ''

    const message = `${prefix}${pipelineInfo}${stageInfo} ${event.message}${durationInfo}`

    switch (event.level) {
      case 'debug':
        console.debug(message, event.context ?? '')
        break
      case 'info':
        console.info(message, event.context ?? '')
        break
      case 'warn':
        console.warn(message, event.context ?? '')
        break
      case 'error':
      case 'fatal':
        console.error(message, event.context ?? '')
        break
    }
  }

  /**
   * Get all logs
   */
  getLogs(options?: {
    level?: LogLevel
    pipelineRunId?: string
    stage?: PipelineStage
    limit?: number
  }): PipelineLogEvent[] {
    let logs = [...this.logs]

    if (options?.level) {
      logs = logs.filter((l) => l.level === options.level)
    }

    if (options?.pipelineRunId) {
      logs = logs.filter((l) => l.pipelineRunId === options.pipelineRunId)
    }

    if (options?.stage) {
      logs = logs.filter((l) => l.stage === options.stage)
    }

    if (options?.limit) {
      logs = logs.slice(-options.limit)
    }

    return logs
  }

  /**
   * Get logs for a specific pipeline run
   */
  getLogsForRun(pipelineRunId: string): PipelineLogEvent[] {
    return this.logs.filter((l) => l.pipelineRunId === pipelineRunId)
  }

  /**
   * Clear all logs
   */
  clearLogs(): void {
    this.logs = []
  }

  /**
   * Export logs as JSON
   */
  exportLogs(): string {
    return JSON.stringify(this.logs, null, 2)
  }
}

// =============================================================================
// Metrics Collector
// =============================================================================

/**
 * Metrics Collector
 * 
 * Collects and aggregates pipeline metrics.
 */
export class MetricsCollector {
  private metrics: Map<string, PipelineMetrics> = new Map()
  private stageMetrics: Map<string, StageMetrics[]> = new Map()

  /**
   * Record metrics for a pipeline run
   */
  recordMetrics(metrics: PipelineMetrics): void {
    this.metrics.set(metrics.pipelineRunId, metrics)
  }

  /**
   * Record metrics for a stage
   */
  recordStageMetrics(stage: PipelineStage, metrics: StageMetrics): void {
    const key = `${metrics.name}-${Date.now()}`
    if (!this.stageMetrics.has(stage)) {
      this.stageMetrics.set(stage, [])
    }
    this.stageMetrics.get(stage)?.push(metrics)
  }

  /**
   * Get metrics for a pipeline run
   */
  getMetrics(pipelineRunId: string): PipelineMetrics | undefined {
    return this.metrics.get(pipelineRunId)
  }

  /**
   * Get stage metrics
   */
  getStageMetrics(stage: PipelineStage): StageMetrics[] {
    return this.stageMetrics.get(stage) ?? []
  }

  /**
   * Calculate aggregate metrics for a pipeline run
   */
  calculateAggregateMetrics(pipelineRunId: string): {
    totalRecords: number
    totalSuccess: number
    totalFailed: number
    avgLatencyMs: number
    totalDurationMs: number
    throughput: number
    errorRate: number
    successRate: number
  } | null {
    const metrics = this.metrics.get(pipelineRunId)
    if (!metrics) return null

    const stageValues = Object.values(metrics.stages)
    const totalRecords = stageValues.reduce((sum, s) => sum + s.recordsProcessed, 0)
    const totalSuccess = stageValues.reduce((sum, s) => sum + s.recordsSuccess, 0)
    const totalFailed = stageValues.reduce((sum, s) => sum + s.recordsFailed, 0)
    const totalDurationMs = stageValues.reduce((sum, s) => sum + s.durationMs, 0)

    return {
      totalRecords,
      totalSuccess,
      totalFailed,
      avgLatencyMs: totalDurationMs / stageValues.length || 0,
      totalDurationMs,
      throughput: totalSuccess / (totalDurationMs / 1000) || 0,
      errorRate: totalFailed / (totalRecords || 1),
      successRate: totalSuccess / (totalRecords || 1),
    }
  }

  /**
   * Get metrics summary
   */
  getMetricsSummary(): {
    totalRuns: number
    totalRecordsProcessed: number
    avgErrorRate: number
    avgLatencyMs: number
    runsByStatus: Record<string, number>
  } {
    const runs = Array.from(this.metrics.values())
    const totalRuns = runs.length
    const totalRecordsProcessed = runs.reduce(
      (sum, m) => sum + Object.values(m.stages).reduce((s, st) => s + st.recordsProcessed, 0),
      0
    )
    const avgErrorRate = 
      runs.reduce((sum, m) => sum + m.errorRate, 0) / (totalRuns || 1)
    const avgLatencyMs = 
      runs.reduce((sum, m) => sum + m.avgLatencyMs, 0) / (totalRuns || 1)

    return {
      totalRuns,
      totalRecordsProcessed,
      avgErrorRate,
      avgLatencyMs,
      runsByStatus: {}, // Would need to track status separately
    }
  }

  /**
   * Clear all metrics
   */
  clearMetrics(): void {
    this.metrics.clear()
    this.stageMetrics.clear()
  }

  /**
   * Export metrics as JSON
   */
  exportMetrics(): string {
    const data = {
      metrics: Object.fromEntries(this.metrics),
      stageMetrics: Object.fromEntries(
        Array.from(this.stageMetrics.entries()).map(([k, v]) => [k, v])
      ),
    }
    return JSON.stringify(data, null, 2)
  }
}

// =============================================================================
// Alert Manager
// =============================================================================

/**
 * Alert Manager
 * 
 * Monitors pipeline metrics and triggers alerts when thresholds are exceeded.
 */
export class AlertManager {
  private config: AlertConfig
  private alerts: AlertEvent[] = []
  private logger: PipelineLogger

  constructor(config: Partial<AlertConfig> = {}, logger?: PipelineLogger) {
    this.config = {
      enabled: config.enabled ?? true,
      thresholds: {
        errorRate: config.thresholds?.errorRate ?? 0.05, // 5%
        latencyMs: config.thresholds?.latencyMs ?? 10000, // 10 seconds
        failureCount: config.thresholds?.failureCount ?? 10,
      },
      channels: config.channels ?? [{ type: 'log', level: 'error' }],
    }
    this.logger = logger ?? new PipelineLogger()
  }

  /**
   * Check metrics against thresholds and trigger alerts
   */
  checkMetrics(metrics: PipelineMetrics): AlertEvent[] {
    if (!this.config.enabled) return []

    const alerts: AlertEvent[] = []
    const pipelineRunId = metrics.pipelineRunId

    // Check error rate
    if (metrics.errorRate > this.config.thresholds.errorRate) {
      const alert = this.createAlert({
        pipelineRunId,
        type: 'error_rate',
        message: `Error rate ${metrics.errorRate.toFixed(4)} exceeds threshold ${this.config.thresholds.errorRate}`,
        severity: metrics.errorRate > this.config.thresholds.errorRate * 2 ? 'critical' : 'warning',
        context: { errorRate: metrics.errorRate, threshold: this.config.thresholds.errorRate },
      })
      alerts.push(alert)
    }

    // Check latency
    if (metrics.avgLatencyMs > this.config.thresholds.latencyMs) {
      const alert = this.createAlert({
        pipelineRunId,
        type: 'latency',
        message: `Average latency ${metrics.avgLatencyMs}ms exceeds threshold ${this.config.thresholds.latencyMs}ms`,
        severity: metrics.avgLatencyMs > this.config.thresholds.latencyMs * 2 ? 'critical' : 'warning',
        context: { avgLatencyMs: metrics.avgLatencyMs, threshold: this.config.thresholds.latencyMs },
      })
      alerts.push(alert)
    }

    // Check stage metrics for failures
    for (const [stage, stageMetrics] of Object.entries(metrics.stages)) {
      if (stageMetrics.recordsFailed > this.config.thresholds.failureCount) {
        const alert = this.createAlert({
          pipelineRunId,
          type: 'failure',
          message: `Stage ${stage} has ${stageMetrics.recordsFailed} failures, exceeding threshold of ${this.config.thresholds.failureCount}`,
          severity: 'warning',
          context: { stage, recordsFailed: stageMetrics.recordsFailed, threshold: this.config.thresholds.failureCount },
        })
        alerts.push(alert)
      }
    }

    // Send alerts
    for (const alert of alerts) {
      this.sendAlert(alert)
    }

    return alerts
  }

  /**
   * Create an alert event
   */
  private createAlert(params: {
    pipelineRunId: string
    type: AlertEvent['type']
    message: string
    severity: AlertEvent['severity']
    context: Record<string, unknown>
  }): AlertEvent {
    return {
      id: `alert-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      timestamp: new Date(),
      pipelineRunId: params.pipelineRunId,
      type: params.type,
      message: params.message,
      severity: params.severity,
      context: params.context,
    }
  }

  /**
   * Send alert through configured channels
   */
  private sendAlert(alert: AlertEvent): void {
    for (const channel of this.config.channels) {
      switch (channel.type) {
        case 'log':
          this.sendLogAlert(channel.level, alert)
          break
        case 'webhook':
          // Would implement webhook posting
          console.warn('Webhook alerts not implemented yet')
          break
        case 'email':
          // Would implement email sending
          console.warn('Email alerts not implemented yet')
          break
      }
    }

    this.alerts.push(alert)
  }

  /**
   * Send alert via log channel
   */
  private sendLogAlert(level: LogLevel, alert: AlertEvent): void {
    this.logger.logEvent({
      level,
      pipelineRunId: alert.pipelineRunId,
      message: alert.message,
      code: `ALERT_${alert.type.toUpperCase()}`,
      context: alert.context,
    })
  }

  /**
   * Get all alerts
   */
  getAlerts(options?: {
    pipelineRunId?: string
    type?: AlertEvent['type']
    severity?: AlertEvent['severity']
    limit?: number
  }): AlertEvent[] {
    let alerts = [...this.alerts]

    if (options?.pipelineRunId) {
      alerts = alerts.filter((a) => a.pipelineRunId === options.pipelineRunId)
    }

    if (options?.type) {
      alerts = alerts.filter((a) => a.type === options.type)
    }

    if (options?.severity) {
      alerts = alerts.filter((a) => a.severity === options.severity)
    }

    if (options?.limit) {
      alerts = alerts.slice(-options.limit)
    }

    return alerts
  }

  /**
   * Clear alerts
   */
  clearAlerts(): void {
    this.alerts = []
  }
}

// =============================================================================
// Observability Factory
// =============================================================================

/**
 * Observability components
 */
export interface Observability {
  logger: PipelineLogger
  metrics: MetricsCollector
  alerts: AlertManager
}

/**
 * Create observability components
 */
export function createObservability(config: {
  logLevel?: LogLevel
  maxLogs?: number
  alertConfig?: Partial<AlertConfig>
} = {}): Observability {
  const logger = new PipelineLogger({
    minLevel: config.logLevel,
    maxLogs: config.maxLogs,
  })

  const metrics = new MetricsCollector()

  const alerts = new AlertManager(config.alertConfig, logger)

  return { logger, metrics, alerts }
}

// =============================================================================
// Default Exports
// =============================================================================

const ObservabilityModule = {
  PipelineLogger,
  MetricsCollector,
  AlertManager,
  createObservability,
}

export default ObservabilityModule