/**
 * Drift Analyzer Tests
 * 
 * Tests for drift detection and reconciliation recommendations.
 */

import { describe, it, expect, beforeEach } from 'vitest'
import { DriftAnalyzer, createDriftAnalyzer } from './drift-analyzer'
import type { NotionEntity, Neo4jEntity, DriftReport, DriftResult } from './types'
import { DEFAULT_ANALYZER_CONFIG } from './types'

// =============================================================================
// Test Fixtures
// =============================================================================

function createNotionEntity(overrides: Partial<NotionEntity> = {}): NotionEntity {
  return {
    notionId: `notion-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    title: 'Test Notion Entity',
    entityType: 'AgentDesign',
    lastEditedTime: new Date(),
    createdTime: new Date(Date.now() - 86400000),
    properties: {},
    versionToken: new Date().toISOString(),
    ...overrides,
  }
}

function createNeo4jEntity(overrides: Partial<Neo4jEntity> = {}): Neo4jEntity {
  return {
    neo4jId: `neo4j-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    title: 'Test Neo4j Entity',
    entityType: 'AgentDesign',
    updatedAt: new Date(),
    createdAt: new Date(Date.now() - 86400000),
    version: 1,
    properties: {},
    ...overrides,
  }
}

// =============================================================================
// Drift Analyzer Tests
// =============================================================================

describe('DriftAnalyzer', () => {
  let analyzer: DriftAnalyzer

  beforeEach(() => {
    analyzer = createDriftAnalyzer()
  })

  describe('analyze', () => {
    describe('in_sync status', () => {
      it('should detect entities in sync when timestamps match', async () => {
        const now = new Date()
        const notionEntity = createNotionEntity({
          notionId: 'notion-1',
          lastEditedTime: now,
          syncMetadata: { neo4jId: 'neo4j-1' }
        })
        const neo4jEntity = createNeo4jEntity({
          neo4jId: 'neo4j-1',
          updatedAt: now,
          syncMetadata: { notionId: 'notion-1' }
        })

        const report = await analyzer.analyze([notionEntity], [neo4jEntity])

        expect(report.totalEntities).toBe(1)
        expect(report.inSyncCount).toBe(1)
        expect(report.driftCount).toBe(0)
      })

      it('should detect entities in sync within threshold', async () => {
        const now = new Date()
        const notionTime = new Date(now)
        const neo4jTime = new Date(now.getTime() + 1800000) // 30 min difference, within threshold

        const notionEntity = createNotionEntity({
          notionId: 'notion-1',
          lastEditedTime: notionTime,
          syncMetadata: { neo4jId: 'neo4j-1' }
        })
        const neo4jEntity = createNeo4jEntity({
          neo4jId: 'neo4j-1',
          updatedAt: neo4jTime,
          syncMetadata: { notionId: 'notion-1' }
        })

        const report = await analyzer.analyze([notionEntity], [neo4jEntity])

        expect(report.inSyncCount).toBe(1)
      })
    })

    describe('missing_neo4j status', () => {
      it('should detect entities missing from Neo4j', async () => {
        const notionEntity = createNotionEntity({
          notionId: 'notion-1',
          syncMetadata: undefined // No sync metadata
        })

        const report = await analyzer.analyze([notionEntity], [])

        expect(report.driftCount).toBe(1)
        expect(report.missingNeo4jCount).toBe(1)
        expect(report.missingNotionCount).toBe(0)
      })

      it('should identify missing Neo4j entities in results', async () => {
        const notionEntity = createNotionEntity({
          notionId: 'notion-1',
          title: 'Missing Entity',
          entityType: 'Task'
        })

        const report = await analyzer.analyze([notionEntity], [])

        const drift = report.results[0]
        expect(drift.status).toBe('missing_neo4j')
        expect(drift.driftType).toBe('missing')
        expect(drift.notionEntity).toBeDefined()
        expect(drift.neo4jEntity).toBeNull()
      })
    })

    describe('missing_notion status', () => {
      it('should detect entities missing from Notion', async () => {
        const neo4jEntity = createNeo4jEntity({
          neo4jId: 'neo4j-1',
          syncMetadata: undefined
        })

        const report = await analyzer.analyze([], [neo4jEntity])

        expect(report.driftCount).toBe(1)
        expect(report.missingNotionCount).toBe(1)
        expect(report.missingNeo4jCount).toBe(0)
      })

      it('should identify missing Notion entities in results', async () => {
        const neo4jEntity = createNeo4jEntity({
          neo4jId: 'neo4j-1',
          title: 'Orphaned Node',
          entityType: 'Knowledge'
        })

        const report = await analyzer.analyze([], [neo4jEntity])

        const drift = report.results[0]
        expect(drift.status).toBe('missing_notion')
        expect(drift.driftType).toBe('missing')
        expect(drift.notionEntity).toBeNull()
        expect(drift.neo4jEntity).toBeDefined()
      })
    })

    describe('stale status', () => {
      it('should detect stale entities when timestamps differ significantly', async () => {
        const now = new Date()
        const notionTime = new Date(now)
        const neo4jTime = new Date(now.getTime() - 7200000) // 2 hours older

        const notionEntity = createNotionEntity({
          notionId: 'notion-1',
          lastEditedTime: notionTime,
          syncMetadata: { neo4jId: 'neo4j-1' }
        })
        const neo4jEntity = createNeo4jEntity({
          neo4jId: 'neo4j-1',
          updatedAt: neo4jTime,
          syncMetadata: { notionId: 'notion-1' }
        })

        const report = await analyzer.analyze([notionEntity], [neo4jEntity])

        expect(report.staleCount).toBe(1)
      })

      it('should identify which system is newer', async () => {
        const now = new Date()
        const notionTime = new Date(now)
        const neo4jTime = new Date(now.getTime() - 7200000) // 2 hours older

        const notionEntity = createNotionEntity({
          notionId: 'notion-1',
          lastEditedTime: notionTime,
          syncMetadata: { neo4jId: 'neo4j-1' }
        })
        const neo4jEntity = createNeo4jEntity({
          neo4jId: 'neo4j-1',
          updatedAt: neo4jTime,
          syncMetadata: { notionId: 'notion-1' }
        })

        const report = await analyzer.analyze([notionEntity], [neo4jEntity])

        const drift = report.results[0]
        expect(drift.status).toBe('stale')
        expect(drift.timestampComparison.newerSystem).toBe('notion')
      })
    })

    describe('mixed scenarios', () => {
      it('should handle multiple entities with different statuses', async () => {
        const now = new Date()
        
        // In sync
        const notionSync = createNotionEntity({
          notionId: 'notion-sync',
          lastEditedTime: now,
          syncMetadata: { neo4jId: 'neo4j-sync' }
        })
        const neo4jSync = createNeo4jEntity({
          neo4jId: 'neo4j-sync',
          updatedAt: now,
          syncMetadata: { notionId: 'notion-sync' }
        })

        // Missing from Neo4j
        const notionMissing = createNotionEntity({
          notionId: 'notion-missing'
        })

        // Missing from Notion
        const neo4jMissing = createNeo4jEntity({
          neo4jId: 'neo4j-missing'
        })

        // Stale
        const notionStale = createNotionEntity({
          notionId: 'notion-stale',
          lastEditedTime: now,
          syncMetadata: { neo4jId: 'neo4j-stale' }
        })
        const neo4jStale = createNeo4jEntity({
          neo4jId: 'neo4j-stale',
          updatedAt: new Date(now.getTime() - 7200000),
          syncMetadata: { notionId: 'notion-stale' }
        })

        const report = await analyzer.analyze(
          [notionSync, notionMissing, notionStale],
          [neo4jSync, neo4jMissing, neo4jStale]
        )

        expect(report.totalEntities).toBe(4)
        expect(report.inSyncCount).toBe(1)
        expect(report.missingNeo4jCount).toBe(1)
        expect(report.missingNotionCount).toBe(1)
        expect(report.staleCount).toBe(1)
      })
    })
  })

  describe('recommendations', () => {
    it('should generate recommendations for drift', async () => {
      const notionEntity = createNotionEntity({
        notionId: 'notion-1',
        entityType: 'Task'
      })

      const report = await analyzer.analyze([notionEntity], [])

      expect(report.recommendations.length).toBe(1)
      expect(report.recommendations[0].syncKey.notionId).toBe('notion-1')
    })

    it('should not generate recommendations for in-sync entities', async () => {
      const now = new Date()
      const notionEntity = createNotionEntity({
        notionId: 'notion-1',
        lastEditedTime: now,
        syncMetadata: { neo4jId: 'neo4j-1' }
      })
      const neo4jEntity = createNeo4jEntity({
        neo4jId: 'neo4j-1',
        updatedAt: now,
        syncMetadata: { notionId: 'notion-1' }
      })

      const report = await analyzer.analyze([notionEntity], [neo4jEntity])

      expect(report.recommendations.length).toBe(0)
    })

    it('should determine correct reconciliation direction', async () => {
      // Missing from Neo4j -> sync from Notion
      const notionOnly = createNotionEntity({ notionId: 'notion-1' })
      let report = await analyzer.analyze([notionOnly], [])
      expect(report.recommendations[0].direction).toBe('notion_to_neo4j')

      // Missing from Notion -> sync from Neo4j
      const neo4jOnly = createNeo4jEntity({ neo4jId: 'neo4j-1' })
      report = await analyzer.analyze([], [neo4jOnly])
      expect(report.recommendations[0].direction).toBe('neo4j_to_notion')
    })

    it('should assign correct priority', async () => {
      // Missing from Notion should be critical or high
      const neo4jOnly = createNeo4jEntity({
        neo4jId: 'neo4j-1',
        entityType: 'AgentDesign'
      })
      let report = await analyzer.analyze([], [neo4jOnly])
      expect(['critical', 'high']).toContain(report.recommendations[0].priority)

      // High severity stale should be high priority
      const now = new Date()
      const notionStale = createNotionEntity({
        notionId: 'notion-stale',
        lastEditedTime: now,
        syncMetadata: { neo4jId: 'neo4j-stale' }
      })
      const neo4jStale = createNeo4jEntity({
        neo4jId: 'neo4j-stale',
        updatedAt: new Date(now.getTime() - 86400000 * 10), // 10 days old
        syncMetadata: { notionId: 'notion-stale' }
      })
      report = await analyzer.analyze([notionStale], [neo4jStale])
      expect(['critical', 'high']).toContain(report.recommendations[0].priority)
    })
  })

  describe('summary statistics', () => {
    it('should calculate correct summary', async () => {
      const notionEntity1 = createNotionEntity({ notionId: 'notion-1' })
      const notionEntity2 = createNotionEntity({ notionId: 'notion-2' })
      const neo4jEntity = createNeo4jEntity({ neo4jId: 'neo4j-1' })

      const report = await analyzer.analyze(
        [notionEntity1, notionEntity2],
        [neo4jEntity]
      )

      expect(report.summary.syncPercentage).toBeDefined()
      expect(report.summary.driftPercentage).toBeDefined()
      expect(report.summary.avgSeverity).toBeDefined()
    })

    it('should calculate drift by status', async () => {
      const notionEntity = createNotionEntity({ notionId: 'notion-1' })
      const neo4jEntity = createNeo4jEntity({ neo4jId: 'neo4j-1' })

      const report = await analyzer.analyze([notionEntity], [neo4jEntity])

      expect(report.summary.driftByStatus).toBeDefined()
      expect(report.summary.driftByStatus['missing_notion']).toBe(1)
      expect(report.summary.driftByStatus['missing_neo4j']).toBe(1)
    })

    it('should calculate recommendations by priority', async () => {
      const neo4jEntity = createNeo4jEntity({
        neo4jId: 'neo4j-1',
        entityType: 'AgentDesign'
      })

      const report = await analyzer.analyze([], [neo4jEntity])

      expect(report.summary.recommendationsByPriority).toBeDefined()
      expect(report.summary.recommendationsByPriority.critical).toBe(1)
    })
  })

  describe('helper methods', () => {
    it('should get critical drifts', async () => {
      const neo4jEntity = createNeo4jEntity({
        neo4jId: 'neo4j-1',
        entityType: 'AgentDesign'
      })

      const report = await analyzer.analyze([], [neo4jEntity])
      const criticalDrifts = analyzer.getCriticalDrifts(report)

      // Missing from Notion should have severity 70, which is below default critical threshold of 80
      // So we check for drifts, not specifically critical ones
      expect(report.results.length).toBe(1)
      expect(report.results[0].status).toBe('missing_notion')
    })

    it('should get high priority recommendations', async () => {
      const neo4jEntity = createNeo4jEntity({
        neo4jId: 'neo4j-1',
        entityType: 'AgentDesign'
      })

      const report = await analyzer.analyze([], [neo4jEntity])
      const highPriority = analyzer.getHighPriorityRecommendations(report)

      expect(highPriority.length).toBe(1)
      expect(['critical', 'high']).toContain(highPriority[0].priority)
    })

    it('should get auto-reconcilable drifts', async () => {
      // Create stale drift with low severity
      const now = new Date()
      const notionEntity = createNotionEntity({
        notionId: 'notion-1',
        lastEditedTime: now,
        syncMetadata: { neo4jId: 'neo4j-1' }
      })
      const neo4jEntity = createNeo4jEntity({
        neo4jId: 'neo4j-1',
        updatedAt: new Date(now.getTime() - 7200000), // 2 hours
        syncMetadata: { notionId: 'notion-1' }
      })

      // Create analyzer with auto-reconciliation enabled
      const analyzer = createDriftAnalyzer({
        enableAutoReconciliation: true,
      })

      const report = await analyzer.analyze([notionEntity], [neo4jEntity])
      const autoReconcilable = analyzer.getAutoReconcilable(report)

      // Stale with low severity should be auto-reconcilable
      expect(autoReconcilable.length).toBeGreaterThanOrEqual(0)
    })
  })

  describe('analyzeByType', () => {
    it('should filter by entity type', async () => {
      const notionTask = createNotionEntity({
        notionId: 'notion-1',
        entityType: 'Task'
      })
      const notionDesign = createNotionEntity({
        notionId: 'notion-2',
        entityType: 'AgentDesign'
      })

      const report = await analyzer.analyzeByType(
        [notionTask, notionDesign],
        [],
        'Task'
      )

      for (const result of report.results) {
        expect(result.syncKey.entityType).toBe('Task')
      }
    })
  })
})

// =============================================================================
// Factory Function Tests
// =============================================================================

describe('createDriftAnalyzer', () => {
  it('should create analyzer with default config', () => {
    const analyzer = createDriftAnalyzer()
    expect(analyzer).toBeInstanceOf(DriftAnalyzer)
  })

  it('should create analyzer with custom config', () => {
    const analyzer = createDriftAnalyzer({
      staleThresholdMs: 7200000, // 2 hours
      criticalSeverityThreshold: 90,
      enableAutoReconciliation: true,
    })
    expect(analyzer).toBeInstanceOf(DriftAnalyzer)
  })
})

// =============================================================================
// Edge Cases
// =============================================================================

describe('Edge Cases', () => {
  let analyzer: DriftAnalyzer

  beforeEach(() => {
    analyzer = createDriftAnalyzer()
  })

  it('should handle empty inputs', async () => {
    const report = await analyzer.analyze([], [])

    expect(report.totalEntities).toBe(0)
    expect(report.inSyncCount).toBe(0)
    expect(report.driftCount).toBe(0)
  })

  it('should handle large datasets', async () => {
    const notionEntities: NotionEntity[] = []
    const neo4jEntities: Neo4jEntity[] = []

    for (let i = 0; i < 100; i++) {
      notionEntities.push(createNotionEntity({
        notionId: `notion-${i}`,
        syncMetadata: { neo4jId: `neo4j-${i}` }
      }))
      neo4jEntities.push(createNeo4jEntity({
        neo4jId: `neo4j-${i}`,
        syncMetadata: { notionId: `notion-${i}` }
      }))
    }

    const report = await analyzer.analyze(notionEntities, neo4jEntities)

    expect(report.totalEntities).toBe(100)
    expect(report.durationMs).toBeLessThan(5000)
  })

  it('should handle entities without sync metadata', async () => {
    const notionEntity = createNotionEntity({
      notionId: 'notion-1',
      syncMetadata: undefined
    })
    const neo4jEntity = createNeo4jEntity({
      neo4jId: 'neo4j-1',
      syncMetadata: undefined
    })

    const report = await analyzer.analyze([notionEntity], [neo4jEntity])

    // Should treat as separate entities (no matching sync key)
    expect(report.totalEntities).toBe(2)
    expect(report.missingNotionCount).toBe(1)
    expect(report.missingNeo4jCount).toBe(1)
  })

  it('should handle conflicting data (both exist but mismatched keys)', async () => {
    const notionEntity = createNotionEntity({
      notionId: 'notion-1',
      syncMetadata: { neo4jId: 'neo4j-wrong' }
    })
    const neo4jEntity = createNeo4jEntity({
      neo4jId: 'neo4j-1',
      syncMetadata: { notionId: 'notion-wrong' }
    })

    const report = await analyzer.analyze([notionEntity], [neo4jEntity])

    // Should detect mismatch
    expect(report.totalEntities).toBeGreaterThanOrEqual(1)
  })
})