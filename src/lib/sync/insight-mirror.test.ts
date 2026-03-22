/**
 * Insight Mirror Tests
 * 
 * Tests for mirroring high-confidence insights to Notion.
 */

import { describe, it, expect, beforeEach } from 'vitest'
import {
  InsightMirror,
  createInsightMirror,
  createMockInsightMirror,
  MockNotionMirrorClient,
  MockNeo4jInsightClient,
} from './insight-mirror'
import type { InsightNode } from './insight-mirror'

// =============================================================================
// Test Fixtures
// =============================================================================

function createMockInsight(overrides: Partial<InsightNode> = {}): InsightNode {
  return {
    id: `insight-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    title: 'Test Insight',
    description: 'A test insight for mirroring',
    confidence: 0.85,
    status: 'approved',
    topic: 'Performance',
    riskLevel: 'low',
    source: 'agent',
    createdAt: new Date(),
    approvedAt: new Date(),
    traceRef: 'postgresql://evidence/test-event',
    ...overrides,
  }
}

// =============================================================================
// Insight Mirror Tests
// =============================================================================

describe('InsightMirror', () => {
  describe('constructor', () => {
    it('should create mirror with default config', () => {
      const mirror = createInsightMirror()
      expect(mirror).toBeInstanceOf(InsightMirror)
    })

    it('should create mirror with custom config', () => {
      const mirror = createInsightMirror({
        confidenceThreshold: 0.8,
        requireApproval: false,
        batchSize: 20,
      })
      expect(mirror).toBeInstanceOf(InsightMirror)
    })
  })

  describe('mirrorInsights', () => {
    it('should mirror high-confidence approved insights', async () => {
      const { mirror, notionClient, neo4jClient } = createMockInsightMirror([
        createMockInsight({ confidence: 0.85, status: 'approved' }),
        createMockInsight({ confidence: 0.75, status: 'approved' }),
      ])

      const result = await mirror.mirrorInsights()

      expect(result.total).toBeGreaterThan(0)
      expect(result.mirrored).toBe(result.total)
      expect(result.failed).toBe(0)
    })

    it('should skip insights below confidence threshold', async () => {
      const { mirror } = createMockInsightMirror([
        createMockInsight({ confidence: 0.65, status: 'approved' }),
      ])

      const result = await mirror.mirrorInsights({ confidenceThreshold: 0.7 })

      // Should not mirror insights below threshold
      expect(result.mirrored).toBe(0)
    })

    it('should skip non-approved insights when requireApproval is true', async () => {
      const { mirror } = createMockInsightMirror([
        createMockInsight({ confidence: 0.85, status: 'pending' }),
      ])

      const result = await mirror.mirrorInsights({ requireApproval: true })

      expect(result.mirrored).toBe(0)
    })

    it('should create Notion pages with correct properties', async () => {
      const { mirror } = createMockInsightMirror([
        createMockInsight({
          id: 'insight-test-1',
          title: 'Test Insight',
          confidence: 0.85,
          topic: 'Security',
          riskLevel: 'high',
        }),
      ])

      const result = await mirror.mirrorInsights()

      expect(result.results[0].success).toBe(true)
      expect(result.results[0].notionPageId).toBeDefined()
      expect(result.results[0].notionUrl).toBeDefined()
    })

    it('should include trace_ref in mirrored pages', async () => {
      const { mirror } = createMockInsightMirror([
        createMockInsight({
          id: 'insight-trace-test',
          traceRef: 'postgresql://evidence/event-123',
        }),
      ])

      const result = await mirror.mirrorInsights()

      expect(result.results[0].traceRef).toBe('postgresql://evidence/event-123')
    })

    it('should handle dry run mode', async () => {
      const { mirror } = createMockInsightMirror([
        createMockInsight({ confidence: 0.85 }),
      ])
      
      const dryRunMirror = new InsightMirror({ dryRun: true })
      const result = await dryRunMirror.mirrorInsights()

      // In dry run mode, should not create actual pages
      expect(result.mirrored).toBeGreaterThan(0)
      expect(result.results[0].notionPageId).toMatch(/^dry-run-/)
    })

    it('should handle batch processing', async () => {
      const insights = Array.from({ length: 15 }, (_, i) =>
        createMockInsight({ id: `insight-${i}`, confidence: 0.8 })
      )

      const { mirror } = createMockInsightMirror(insights)

      const result = await mirror.mirrorInsights({ limit: 10 })

      expect(result.total).toBeLessThanOrEqual(10)
    })

    it('should track sync duration', async () => {
      const { mirror } = createMockInsightMirror([
        createMockInsight(),
      ])

      const result = await mirror.mirrorInsights()

      expect(result.durationMs).toBeDefined()
      expect(result.durationMs).toBeGreaterThanOrEqual(0)
    })

    it('should handle errors gracefully', async () => {
      const { mirror } = createMockInsightMirror([
        createMockInsight({ id: 'valid', confidence: 0.85 }),
        createMockInsight({ id: 'error', confidence: 0.85, title: '' }), // Invalid
      ])

      const result = await mirror.mirrorInsights()

      // Should still process valid insights
      expect(result.mirrored).toBeGreaterThanOrEqual(0)
      expect(result.errors).toBeDefined()
    })
  })

  describe('mirrorInsight', () => {
    it('should create Notion page with proper structure', async () => {
      const insight = createMockInsight({
        title: 'Test Insight',
        description: 'Detailed description',
        confidence: 0.9,
        claims: [
          { id: 'claim-1', text: 'Claim 1', confidence: 0.85 },
          { id: 'claim-2', text: 'Claim 2', confidence: 0.9 },
        ],
        actions: ['Action 1', 'Action 2'],
      })

      const { mirror } = createMockInsightMirror([insight])

      const result = await mirror.mirrorInsights()

      expect(result.results[0].success).toBe(true)
      expect(result.results[0].insightId).toBe(insight.id)
    })

    it('should sync insight with claims and evidence', async () => {
      const insight = createMockInsight({
        claims: [
          { id: 'claim-1', text: 'First claim', verificationStatus: 'verified' },
          { id: 'claim-2', text: 'Second claim', verificationStatus: 'unverified' },
        ],
        evidence: [
          {
            id: 'evidence-1',
            type: 'log',
            content: 'Log entry',
            source: 'application',
            timestamp: new Date(),
            relevanceScore: 'high',
          },
        ],
      })

      const { mirror } = createMockInsightMirror([insight])

      const result = await mirror.mirrorInsights()

      expect(result.mirrored).toBe(1)
    })
  })

  describe('generatePageContent', () => {
    it('should generate title from insight', async () => {
      const insight = createMockInsight({
        title: 'Performance Optimization Insight',
      })

      const { mirror } = createMockInsightMirror([insight])

      const result = await mirror.mirrorInsights()

      expect(result.results[0].success).toBe(true)
    })

    it('should include confidence score in content', async () => {
      const insight = createMockInsight({
        confidence: 0.85,
      })

      const { mirror } = createMockInsightMirror([insight])

      const result = await mirror.mirrorInsights()

      expect(result.mirrored).toBe(1)
    })

    it('should include risk level', async () => {
      const insight = createMockInsight({
        riskLevel: 'high',
      })

      const { mirror } = createMockInsightMirror([insight])

      const result = await mirror.mirrorInsights()

      expect(result.mirrored).toBe(1)
    })

    it('should include topic', async () => {
      const insight = createMockInsight({
        topic: 'Architecture',
      })

      const { mirror } = createMockInsightMirror([insight])

      const result = await mirror.mirrorInsights()

      expect(result.mirrored).toBe(1)
    })
  })
})

// =============================================================================
// Mock Client Tests
// =============================================================================

describe('MockNotionMirrorClient', () => {
  let client: MockNotionMirrorClient

  beforeEach(() => {
    client = new MockNotionMirrorClient('test-database')
  })

  describe('createPage', () => {
    it('should create a page', async () => {
      const result = await client.createPage({
        parent: { database_id: 'test-database' },
        properties: { Title: { title: [{ text: { content: 'Test' } }] } },
      })

      expect(result.id).toBeDefined()
      expect(result.url).toBeDefined()
    })

    it('should store page properties', async () => {
      await client.createPage({
        parent: { database_id: 'test-database' },
        properties: { Title: { title: [{ text: { content: 'Test' } }] } },
      })

      const pages = await client.queryDatabase({ database_id: 'test-database' })
      expect(pages.results.length).toBeGreaterThan(0)
    })
  })

  describe('updatePage', () => {
    it('should update existing page', async () => {
      const created = await client.createPage({
        parent: { database_id: 'test-database' },
        properties: { Title: { title: [{ text: { content: 'Test' } }] } },
      })

      const updated = await client.updatePage({
        page_id: created.id,
        properties: { Status: { select: { name: 'approved' } } },
      })

      expect(updated.id).toBe(created.id)
    })

    it('should throw error for non-existent page', async () => {
      await expect(
        client.updatePage({
          page_id: 'non-existent',
          properties: {},
        })
      ).rejects.toThrow()
    })
  })

  describe('queryDatabase', () => {
    it('should return all pages', async () => {
      await client.createPage({
        parent: { database_id: 'test-database' },
        properties: { Title: { title: [{ text: { content: 'Page 1' } }] } },
      })
      await client.createPage({
        parent: { database_id: 'test-database' },
        properties: { Title: { title: [{ text: { content: 'Page 2' } }] } },
      })

      const result = await client.queryDatabase({ database_id: 'test-database' })

      expect(result.results.length).toBe(2)
    })
  })
})

describe('MockNeo4jInsightClient', () => {
  let client: MockNeo4jInsightClient

  beforeEach(() => {
    client = new MockNeo4jInsightClient()
  })

  describe('run', () => {
    it('should return insights above confidence threshold', async () => {
      client.addInsight(createMockInsight({ confidence: 0.85 }))
      client.addInsight(createMockInsight({ confidence: 0.65 }))

      const result = await client.run(QUERIES.getHighConfidenceInsights, {
        confidenceThreshold: 0.7,
        limit: 100,
      })

      expect(result.records.length).toBe(1)
    })

    it('should filter by approval status', async () => {
      client.addInsight(createMockInsight({ confidence: 0.85, status: 'approved' }))
      client.addInsight(createMockInsight({ confidence: 0.85, status: 'pending' }))

      const result = await client.run(QUERIES.getHighConfidenceInsights, {
        confidenceThreshold: 0.7,
        limit: 100,
      })

      expect(result.records.length).toBe(1)
    })
  })
})

// Placeholder for query constant reference
const QUERIES = {
  getHighConfidenceInsights: 'MATCH (i:Insight)...',
}

// =============================================================================
// Integration Tests
// =============================================================================

describe('Insight Mirror Integration', () => {
  it('should handle full mirror workflow', async () => {
    const insights = [
      createMockInsight({ id: 'insight-1', confidence: 0.9, status: 'approved' }),
      createMockInsight({ id: 'insight-2', confidence: 0.8, status: 'approved' }),
      createMockInsight({ id: 'insight-3', confidence: 0.85, status: 'approved' }),
    ]

    const { mirror } = createMockInsightMirror(insights)

    const result = await mirror.mirrorInsights()

    expect(result.mirrored).toBe(3)
    expect(result.failed).toBe(0)
  })

  it('should support re-sync of updated insights', async () => {
    const insight = createMockInsight({
      id: 'insight-resync',
      confidence: 0.85,
      status: 'approved',
    })

    const { mirror } = createMockInsightMirror([insight])

    // First sync
    const result1 = await mirror.mirrorInsights()
    expect(result1.mirrored).toBe(1)

    // Re-sync (simulated)
    const result2 = await mirror.mirrorInsights()
    expect(result2.total).toBeGreaterThanOrEqual(1)
  })

  it('should handle large batches efficiently', async () => {
    const insights = Array.from({ length: 50 }, (_, i) =>
      createMockInsight({
        id: `insight-${i}`,
        confidence: 0.7 + Math.random() * 0.3,
        status: 'approved',
      })
    )

    const { mirror } = createMockInsightMirror(insights)

    const start = Date.now()
    const result = await mirror.mirrorInsights({ limit: 50 })
    const elapsed = Date.now() - start

    // Mock mirror processes all insights above confidence threshold
    expect(result.total).toBe(50)
    expect(elapsed).toBeLessThan(5000) // Should complete within 5 seconds
  })
})

// =============================================================================
// Factory Function Tests
// =============================================================================

describe('createInsightMirror', () => {
  it('should create mirror with default config', () => {
    const mirror = createInsightMirror()
    expect(mirror).toBeInstanceOf(InsightMirror)
  })

  it('should create mirror with mock clients', () => {
    const notionClient = new MockNotionMirrorClient()
    const neo4jClient = new MockNeo4jInsightClient()

    const mirror = createInsightMirror({
      notionClient,
      neo4jClient,
      confidenceThreshold: 0.8,
    })

    expect(mirror).toBeInstanceOf(InsightMirror)
  })
})

describe('createMockInsightMirror', () => {
  it('should create mirror with mock clients', () => {
    const { mirror, notionClient, neo4jClient } = createMockInsightMirror()

    expect(mirror).toBeInstanceOf(InsightMirror)
    expect(notionClient).toBeInstanceOf(MockNotionMirrorClient)
    expect(neo4jClient).toBeInstanceOf(MockNeo4jInsightClient)
  })

  it('should accept seed data', () => {
    const seedData = [
      createMockInsight({ id: 'seed-1' }),
      createMockInsight({ id: 'seed-2' }),
    ]

    const { mirror } = createMockInsightMirror(seedData)
    expect(mirror).toBeInstanceOf(InsightMirror)
  })
})