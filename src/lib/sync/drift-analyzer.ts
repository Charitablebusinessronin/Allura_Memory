/**
 * Drift Analyzer
 * 
 * Compares Notion and Neo4j entity data to detect drift.
 * Identifies missing, stale, and conflicting entities.
 * Generates actionable reconciliation recommendations.
 */

import type {
  SyncKey,
  EntityType,
  NotionEntity,
  Neo4jEntity,
  DriftResult,
  DriftReport,
  DriftSummary,
  DriftStatus,
  DriftType,
  DriftAnalyzerConfig,
  ReconciliationRecommendation,
  ReconciliationPriority,
  ReconciliationDirection,
} from './types'
import {
  ENTITY_TYPES,
  DEFAULT_ANALYZER_CONFIG,
} from './types'

// =============================================================================
// Drift Analyzer
// =============================================================================

/**
 * Drift Analyzer
 * 
 * Analyzes drift between Notion and Neo4j data.
 * Identifies missing entities, stale entities, and conflicts.
 * Generates actionable reconciliation recommendations.
 */
export class DriftAnalyzer {
  private config: DriftAnalyzerConfig

  constructor(config: Partial<DriftAnalyzerConfig> = {}) {
    this.config = { ...DEFAULT_ANALYZER_CONFIG, ...config }
  }

  /**
   * Analyze drift between Notion and Neo4j data
   */
  async analyze(
    notionEntities: NotionEntity[],
    neo4jEntities: Neo4jEntity[]
  ): Promise<DriftReport> {
    const startTime = Date.now()
    const results: DriftResult[] = []
    const recommendations: ReconciliationRecommendation[] = []

    // Build lookup maps
    const notionMap = new Map<string, NotionEntity>()
    const neo4jMap = new Map<string, Neo4jEntity>()
    const notionByNeo4jId = new Map<string, NotionEntity>()
    const neo4jByNotionId = new Map<string, Neo4jEntity>()

    // Populate Notion maps
    for (const entity of notionEntities) {
      notionMap.set(entity.notionId, entity)
      if (entity.syncMetadata?.neo4jId) {
        notionByNeo4jId.set(entity.syncMetadata.neo4jId, entity)
      }
    }

    // Populate Neo4j maps
    for (const entity of neo4jEntities) {
      neo4jMap.set(entity.neo4jId, entity)
      if (entity.syncMetadata?.notionId) {
        neo4jByNotionId.set(entity.syncMetadata.notionId, entity)
      }
    }

    // Find all unique sync keys
    const allSyncKeys = this.buildSyncKeys(notionEntities, neo4jEntities)

    // Analyze each sync key
    for (const syncKey of allSyncKeys) {
      const result = this.analyzeSyncKey(syncKey, notionMap, neo4jMap, notionByNeo4jId, neo4jByNotionId)
      results.push(result)

      // Generate recommendation if drift detected
      if (result.status !== 'in_sync') {
        const recommendation = this.generateRecommendation(result)
        recommendations.push(recommendation)
      }
    }

    // Calculate summary statistics
    const summary = this.calculateSummary(results, recommendations)

    const durationMs = Date.now() - startTime

    return {
      id: `drift-report-${Date.now()}`,
      generatedAt: new Date(),
      totalEntities: results.length,
      inSyncCount: results.filter((r) => r.status === 'in_sync').length,
      driftCount: results.filter((r) => r.status !== 'in_sync').length,
      missingNotionCount: results.filter((r) => r.status === 'missing_notion').length,
      missingNeo4jCount: results.filter((r) => r.status === 'missing_neo4j').length,
      staleCount: results.filter((r) => r.status === 'stale').length,
      conflictCount: results.filter((r) => r.status === 'conflicting').length,
      results,
      recommendations,
      summary,
      durationMs,
    }
  }

  /**
   * Build sync keys from Notion and Neo4j entities
   */
  private buildSyncKeys(
    notionEntities: NotionEntity[],
    neo4jEntities: Neo4jEntity[]
  ): SyncKey[] {
    const syncKeys = new Map<string, SyncKey>()

    // Add Notion entities
    for (const entity of notionEntities) {
      const key = `${entity.notionId}-${entity.entityType}`
      if (!syncKeys.has(key)) {
        syncKeys.set(key, {
          notionId: entity.notionId,
          neo4jId: entity.syncMetadata?.neo4jId ?? `pending-${entity.notionId}`,
          entityType: entity.entityType,
          source: entity.syncMetadata?.neo4jId ? 'notion_generated' : 'custom',
        })
      }
    }

    // Add Neo4j entities
    for (const entity of neo4jEntities) {
      const notionId = entity.syncMetadata?.notionId ?? `pending-${entity.neo4jId}`
      const key = `${notionId}-${entity.entityType}`
      if (!syncKeys.has(key)) {
        syncKeys.set(key, {
          notionId,
          neo4jId: entity.neo4jId,
          entityType: entity.entityType,
          source: entity.syncMetadata?.notionId ? 'neo4j_generated' : 'custom',
        })
      }
    }

    return Array.from(syncKeys.values())
  }

  /**
   * Analyze a single sync key for drift
   */
  private analyzeSyncKey(
    syncKey: SyncKey,
    notionMap: Map<string, NotionEntity>,
    neo4jMap: Map<string, Neo4jEntity>,
    notionByNeo4jId: Map<string, NotionEntity>,
    neo4jByNotionId: Map<string, Neo4jEntity>
  ): DriftResult {
    // Find entities by sync key
    const notionEntity = notionMap.get(syncKey.notionId) ?? 
      (syncKey.neo4jId ? notionByNeo4jId.get(syncKey.neo4jId) : null) ?? null
    const neo4jEntity = neo4jMap.get(syncKey.neo4jId) ?? 
      neo4jByNotionId.get(syncKey.notionId) ?? null

    // Determine drift status
    const { status, driftType, timestampComparison } = this.determineDriftStatus(
      notionEntity,
      neo4jEntity
    )

    // Calculate severity
    const severity = this.calculateSeverity(status, driftType, timestampComparison)

    // Generate description
    const description = this.generateDescription(syncKey, status, notionEntity, neo4jEntity)

    return {
      syncKey,
      status,
      driftType,
      notionEntity,
      neo4jEntity,
      timestampComparison,
      severity,
      description,
      detectedAt: new Date(),
    }
  }

  /**
   * Determine drift status for an entity pair
   */
  private determineDriftStatus(
    notionEntity: NotionEntity | null,
    neo4jEntity: Neo4jEntity | null
  ): {
    status: DriftStatus
    driftType: DriftType | null
    timestampComparison: DriftResult['timestampComparison']
  } {
    // Both missing (shouldn't happen, but handle gracefully)
    if (!notionEntity && !neo4jEntity) {
      return {
        status: 'in_sync',
        driftType: null,
        timestampComparison: {
          notionTime: null,
          neo4jTime: null,
          newerSystem: 'none',
          timeDifferenceMs: null,
        },
      }
    }

    // Missing from Neo4j
    if (notionEntity && !neo4jEntity) {
      return {
        status: 'missing_neo4j',
        driftType: 'missing',
        timestampComparison: {
          notionTime: notionEntity.lastEditedTime,
          neo4jTime: null,
          newerSystem: 'notion',
          timeDifferenceMs: null,
        },
      }
    }

    // Missing from Notion
    if (!notionEntity && neo4jEntity) {
      return {
        status: 'missing_notion',
        driftType: 'missing',
        timestampComparison: {
          notionTime: null,
          neo4jTime: neo4jEntity.updatedAt,
          newerSystem: 'neo4j',
          timeDifferenceMs: null,
        },
      }
    }

    // Both exist - check for staleness or conflict
    if (notionEntity && neo4jEntity) {
      const notionTime = notionEntity.lastEditedTime
      const neo4jTime = neo4jEntity.updatedAt
      const timeDiff = Math.abs(notionTime.getTime() - neo4jTime.getTime())

      // Check if timestamps match (within threshold)
      if (timeDiff <= this.config.staleThresholdMs) {
        return {
          status: 'in_sync',
          driftType: null,
          timestampComparison: {
            notionTime,
            neo4jTime,
            newerSystem: 'equal',
            timeDifferenceMs: timeDiff,
          },
        }
      }

      // Stale - one is newer than the other
      const newerSystem = notionTime > neo4jTime ? 'notion' : 'neo4j'
      return {
        status: 'stale',
        driftType: 'stale',
        timestampComparison: {
          notionTime,
          neo4jTime,
          newerSystem,
          timeDifferenceMs: timeDiff,
        },
      }
    }

    // Conflict (both exist but have conflicting data)
    // For now, treat as stale - in real implementation, would compare properties
    return {
      status: 'stale',
      driftType: 'stale',
      timestampComparison: {
        notionTime: notionEntity!.lastEditedTime,
        neo4jTime: neo4jEntity!.updatedAt,
        newerSystem: 'notion', // Default to Notion as source of truth
        timeDifferenceMs: Math.abs(
          notionEntity!.lastEditedTime.getTime() - neo4jEntity!.updatedAt.getTime()
        ),
      },
    }
  }

  /**
   * Calculate severity score for drift
   */
  private calculateSeverity(
    status: DriftStatus,
    driftType: DriftType | null,
    timestampComparison: DriftResult['timestampComparison']
  ): number {
    // Base severity by status
    const baseSeverity: Record<DriftStatus, number> = {
      in_sync: 0,
      missing_notion: 70,
      missing_neo4j: 80,
      stale: 50,
      conflicting: 90,
    }

    let severity = baseSeverity[status]

    // Increase severity based on time difference
    if (status === 'stale' && timestampComparison.timeDifferenceMs) {
      const hoursDiff = timestampComparison.timeDifferenceMs / (1000 * 60 * 60)
      const daysDiff = hoursDiff / 24

      // Increase severity for larger time differences
      if (daysDiff > 7) {
        severity += 20
      } else if (daysDiff > 3) {
        severity += 10
      } else if (daysDiff > 1) {
        severity += 5
      }
    }

    // Cap at 100
    return Math.min(100, severity)
  }

  /**
   * Generate human-readable description
   */
  private generateDescription(
    syncKey: SyncKey,
    status: DriftStatus,
    notionEntity: NotionEntity | null,
    neo4jEntity: Neo4jEntity | null
  ): string {
    const title = notionEntity?.title ?? neo4jEntity?.title ?? 'Unknown'
    const entityType = syncKey.entityType

    switch (status) {
      case 'in_sync':
        return `${entityType} "${title}" is in sync between Notion and Neo4j`

      case 'missing_notion':
        return `${entityType} "${title}" exists in Neo4j but not in Notion. ` +
          `This may indicate an orphaned node in the knowledge graph.`

      case 'missing_neo4j':
        return `${entityType} "${title}" exists in Notion but not in Neo4j. ` +
          `This may indicate a failed sync or new entry not yet propagated.`

      case 'stale':
        return `${entityType} "${title}" exists in both systems but timestamps differ. ` +
          `Notion last edited: ${notionEntity?.lastEditedTime.toISOString()}, ` +
          `Neo4j last updated: ${neo4jEntity?.updatedAt.toISOString()}`

      case 'conflicting':
        return `${entityType} "${title}" has conflicting data between Notion and Neo4j. ` +
          `Manual review required to resolve discrepancies.`

      default:
        return `${entityType} "${title}" has unknown drift status.`
    }
  }

  /**
   * Generate reconciliation recommendation
   */
  private generateRecommendation(result: DriftResult): ReconciliationRecommendation {
    const priority = this.determinePriority(result)
    const direction = this.determineDirection(result)
    const action = this.determineAction(result)
    const steps = this.determineSteps(result, direction)
    const { impact, effort, risks } = this.assessReconciliation(result)

    return {
      id: `rec-${result.syncKey.notionId}-${Date.now()}`,
      syncKey: result.syncKey,
      priority,
      direction,
      reason: this.generateReason(result),
      impact,
      effort,
      entityType: result.syncKey.entityType,
      action,
      steps,
      autoReconcilable: this.canAutoReconcile(result),
      risks,
    }
  }

  /**
   * Determine priority for reconciliation
   */
  private determinePriority(result: DriftResult): ReconciliationPriority {
    // Critical: Missing from Notion or high severity conflict
    if (result.status === 'missing_notion' || result.severity >= this.config.criticalSeverityThreshold) {
      return 'critical'
    }

    // High: Missing from Neo4j or high severity stale
    if (result.status === 'missing_neo4j' || result.severity >= this.config.highSeverityThreshold) {
      return 'high'
    }

    // Medium: Stale with moderate severity
    if (result.status === 'stale' && result.severity >= 30) {
      return 'medium'
    }

    // Low: Everything else
    return 'low'
  }

  /**
   * Determine reconciliation direction
   */
  private determineDirection(result: DriftResult): ReconciliationDirection {
    switch (result.status) {
      case 'missing_notion':
        // Neo4j has it but Notion doesn't - sync to Notion
        return 'neo4j_to_notion'

      case 'missing_neo4j':
        // Notion has it but Neo4j doesn't - sync to Neo4j
        return 'notion_to_neo4j'

      case 'stale':
        // Both have it - sync from newer system
        return result.timestampComparison.newerSystem === 'notion'
          ? 'notion_to_neo4j'
          : 'neo4j_to_notion'

      case 'conflicting':
        // Can't auto-resolve conflicts
        return 'manual_review'

      default:
        return 'manual_review'
    }
  }

  /**
   * Determine action to take
   */
  private determineAction(result: DriftResult): string {
    const title = result.notionEntity?.title ?? result.neo4jEntity?.title ?? 'entity'

    switch (result.status) {
      case 'missing_notion':
        return `Create "${title}" in Notion from Neo4j data`

      case 'missing_neo4j':
        return `Create "${title}" in Neo4j from Notion data`

      case 'stale':
        const newer = result.timestampComparison.newerSystem
        return `Update "${title}" in ${newer === 'notion' ? 'Neo4j' : 'Notion'} from ${newer === 'notion' ? 'Notion' : 'Neo4j'}`

      case 'conflicting':
        return `Review and manually resolve conflicts for "${title}"`

      default:
        return `No action needed for "${title}"`
    }
  }

  /**
   * Determine steps for reconciliation
   */
  private determineSteps(
    result: DriftResult,
    direction: ReconciliationDirection
  ): string[] {
    const steps: string[] = []

    switch (result.status) {
      case 'missing_notion':
        steps.push('Verify Neo4j entity is valid and should exist')
        steps.push('Create corresponding page in Notion')
        steps.push('Add sync metadata (notionId) to Neo4j node')
        steps.push('Verify sync by re-running drift detection')
        break

      case 'missing_neo4j':
        steps.push('Verify Notion page is valid and should be synced')
        steps.push('Create corresponding node in Neo4j')
        steps.push('Update Notion page with neo4jId sync metadata')
        steps.push('Verify sync by re-running drift detection')
        break

      case 'stale':
        if (direction === 'notion_to_neo4j') {
          steps.push('Pull latest data from Notion')
          steps.push('Update Neo4j node properties')
          steps.push('Update lastSyncTime in both systems')
          steps.push('Verify timestamps match')
        } else {
          steps.push('Pull latest data from Neo4j')
          steps.push('Update Notion page properties')
          steps.push('Update lastSyncTime in both systems')
          steps.push('Verify timestamps match')
        }
        break

      case 'conflicting':
        steps.push('Review both Notion and Neo4j versions')
        steps.push('Determine which version is correct')
        steps.push('Manually update the incorrect version')
        steps.push('Update sync metadata')
        steps.push('Verify sync by re-running drift detection')
        break
    }

    return steps
  }

  /**
   * Assess reconciliation impact and effort
   */
  private assessReconciliation(result: DriftResult): {
    impact: number
    effort: number
    risks: string[]
  } {
    const risks: string[] = []

    // Impact is based on severity
    const impact = result.severity

    // Effort is based on status
    let effort: number
    switch (result.status) {
      case 'missing_notion':
        effort = 30 // Requires Notion API write
        risks.push('May create duplicate if sync key is incorrect')
        break
      case 'missing_neo4j':
        effort = 20 // Requires Neo4j write
        risks.push('May create duplicate node if sync key is incorrect')
        break
      case 'stale':
        effort = 10 // Update existing entity
        risks.push('May overwrite newer changes if timestamp is wrong')
        break
      case 'conflicting':
        effort = 50 // Requires manual review
        risks.push('High risk of data loss without proper review')
        break
      default:
        effort = 0
    }

    // Add time-based risks
    if (result.timestampComparison.timeDifferenceMs && result.timestampComparison.timeDifferenceMs > 7 * 24 * 60 * 60 * 1000) {
      risks.push('Entity has been out of sync for over 7 days')
      effort += 10
    }

    return { impact, effort, risks }
  }

  /**
   * Generate reason for recommendation
   */
  private generateReason(result: DriftResult): string {
    const timeDiff = result.timestampComparison.timeDifferenceMs
    const hoursDiff = timeDiff ? timeDiff / (1000 * 60 * 60) : 0
    const daysDiff = hoursDiff / 24

    switch (result.status) {
      case 'missing_notion':
        return `Entity exists in Neo4j but not in Notion. This creates a gap in the human-managed source of truth.`

      case 'missing_neo4j':
        return `Entity exists in Notion but not in Neo4j. Agent memory will be incomplete without this data.`

      case 'stale':
        if (daysDiff > 7) {
          return `Entity has been out of sync for ${Math.floor(daysDiff)} days. Immediate reconciliation recommended.`
        } else if (daysDiff > 1) {
          return `Entity has been out of sync for ${Math.floor(daysDiff)} days. Sync recommended.`
        }
        return `Entity timestamps differ by ${Math.floor(hoursDiff)} hours. Sync recommended.`

      case 'conflicting':
        return `Entity has conflicting data between systems. Manual review required to determine correct version.`

      default:
        return `Unknown drift status detected.`
    }
  }

  /**
   * Check if drift can be auto-reconciled
   */
  private canAutoReconcile(result: DriftResult): boolean {
    // Only auto-reconcile if auto-reconciliation is enabled and risk is low
    if (!this.config.enableAutoReconciliation) {
      return false
    }

    // Can auto-reconcile missing entities (low risk)
    if (result.status === 'missing_neo4j' && result.severity < 80) {
      return true
    }

    // Can auto-reconcile stale entities with low severity
    if (result.status === 'stale' && result.severity < 50) {
      return true
    }

    // Never auto-reconcile missing from Notion or conflicts
    return false
  }

  /**
   * Calculate summary statistics
   */
  private calculateSummary(
    results: DriftResult[],
    recommendations: ReconciliationRecommendation[]
  ): DriftSummary {
    const totalEntities = results.length
    const inSyncCount = results.filter((r) => r.status === 'in_sync').length
    const driftCount = results.filter((r) => r.status !== 'in_sync').length

    // Calculate percentages
    const syncPercentage = totalEntities > 0 ? (inSyncCount / totalEntities) * 100 : 0
    const driftPercentage = totalEntities > 0 ? (driftCount / totalEntities) * 100 : 0

    // Calculate average severity for drifts
    const driftResults = results.filter((r) => r.status !== 'in_sync')
    const avgSeverity = driftResults.length > 0
      ? driftResults.reduce((sum, r) => sum + r.severity, 0) / driftResults.length
      : 0

    // Count by entity type
    const typeCounts = new Map<EntityType, number>()
    for (const result of driftResults) {
      const count = typeCounts.get(result.syncKey.entityType) ?? 0
      typeCounts.set(result.syncKey.entityType, count + 1)
    }

    // Sort by count
    const topDriftTypes = Array.from(typeCounts.entries())
      .map(([entityType, count]) => ({
        entityType,
        count,
        percentage: (count / driftCount) * 100,
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5)

    // Count by status
    const driftByStatus: Record<DriftStatus, number> = {
      in_sync: inSyncCount,
      missing_notion: results.filter((r) => r.status === 'missing_notion').length,
      missing_neo4j: results.filter((r) => r.status === 'missing_neo4j').length,
      stale: results.filter((r) => r.status === 'stale').length,
      conflicting: results.filter((r) => r.status === 'conflicting').length,
    }

    // Count recommendations by priority
    const recommendationsByPriority = {
      critical: recommendations.filter((r) => r.priority === 'critical').length,
      high: recommendations.filter((r) => r.priority === 'high').length,
      medium: recommendations.filter((r) => r.priority === 'medium').length,
      low: recommendations.filter((r) => r.priority === 'low').length,
    }

    return {
      syncPercentage,
      driftPercentage,
      avgSeverity,
      topDriftTypes,
      driftByStatus,
      recommendationsByPriority,
    }
  }

  /**
   * Analyze drift for a specific entity type
   */
  async analyzeByType(
    notionEntities: NotionEntity[],
    neo4jEntities: Neo4jEntity[],
    entityType: EntityType
  ): Promise<DriftReport> {
    const filteredNotion = notionEntities.filter((e) => e.entityType === entityType)
    const filteredNeo4j = neo4jEntities.filter((e) => e.entityType === entityType)
    return this.analyze(filteredNotion, filteredNeo4j)
  }

  /**
   * Get critical drifts from a report
   */
  getCriticalDrifts(report: DriftReport): DriftResult[] {
    return report.results.filter((r) => r.severity >= this.config.criticalSeverityThreshold)
  }

  /**
   * Get high priority recommendations
   */
  getHighPriorityRecommendations(report: DriftReport): ReconciliationRecommendation[] {
    return report.recommendations.filter(
      (r) => r.priority === 'critical' || r.priority === 'high'
    )
  }

  /**
   * Get auto-reconcilable drifts
   */
  getAutoReconcilable(report: DriftReport): DriftResult[] {
    return report.results.filter((r) => this.canAutoReconcile(r))
  }
}

// =============================================================================
// Factory Functions
// =============================================================================

/**
 * Create a drift analyzer
 */
export function createDriftAnalyzer(config: Partial<DriftAnalyzerConfig> = {}): DriftAnalyzer {
  return new DriftAnalyzer(config)
}

// =============================================================================
// Default Export
// =============================================================================

export default DriftAnalyzer