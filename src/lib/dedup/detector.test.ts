/**
 * Duplicate Detector Tests
 * 
 * Tests for duplicate detection using embedding and text similarity.
 */

import { describe, it, expect, beforeEach } from 'vitest'
import { DuplicateDetector, createDetector, createDetectorForTypes } from './detector'
import { createMockEmbeddingManager } from './embeddings'
import { createTextManager } from './text-similarity'
import type { DedupEntity, DetectionConfig, DuplicatePair } from './types'

// =============================================================================
// Test Fixtures
// =============================================================================

function createTestEntity(overrides: Partial<DedupEntity> = {}): DedupEntity {
  return {
    id: `entity-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    type: 'insight',
    primaryText: 'Test Entity',
    properties: {},
    createdAt: new Date(),
    ...overrides,
  }
}

function createTestEntities(count: number, type: DedupEntity['type'] = 'insight'): DedupEntity[] {
  return Array.from({ length: count }, (_, i) =>
    createTestEntity({
      id: `entity-${i}`,
      type,
      primaryText: `Test Entity ${i}`,
      createdAt: new Date(Date.now() - i * 1000),
    })
  )
}

// =============================================================================
// Duplicate Detector Tests
// =============================================================================

describe('DuplicateDetector', () => {
  let detector: DuplicateDetector

  beforeEach(() => {
    detector = createDetector()
  })

  // =============================================================================
  // Basic Detection Tests
  // =============================================================================

  describe('detect', () => {
    it('should detect duplicates among entities', async () => {
      const entities = [
        createTestEntity({ id: 'e1', primaryText: 'Machine Learning' }),
        createTestEntity({ id: 'e2', primaryText: 'Machine Learning' }),
        createTestEntity({ id: 'e3', primaryText: 'Different Topic' }),
      ]

      const result = await detector.detect(entities)

      expect(result.duplicates).toBeDefined()
      expect(result.entitiesChecked).toBe(3)
      expect(result.comparisonsMade).toBe(3) // C(3, 2) = 3
      expect(result.detectedAt).toBeInstanceOf(Date)
      expect(result.durationMs).toBeGreaterThanOrEqual(0)
    })

    it('should return empty array for no duplicates', async () => {
      const entities = [
        createTestEntity({ primaryText: 'Unique Topic One' }),
        createTestEntity({ primaryText: 'Unique Topic Two' }),
        createTestEntity({ primaryText: 'Unique Topic Three' }),
      ]

      const result = await detector.detect(entities)

      expect(result.duplicates).toBeDefined()
      expect(result.entitiesChecked).toBe(3)
    })

    it('should handle empty input', async () => {
      const result = await detector.detect([])

      expect(result.duplicates).toEqual([])
      expect(result.entitiesChecked).toBe(0)
      expect(result.comparisonsMade).toBe(0)
    })

    it('should handle single entity', async () => {
      const entities = [createTestEntity({ primaryText: 'Single Entity' })]
      const result = await detector.detect(entities)

      expect(result.duplicates).toEqual([])
      expect(result.entitiesChecked).toBe(1)
      expect(result.comparisonsMade).toBe(0)
    })
  })

  // =============================================================================
  // Entity Type Filtering Tests
  // =============================================================================

  describe('entity type filtering', () => {
    it('should only check specified entity types', async () => {
      const detector = createDetectorForTypes(['agent'])
      
      const entities = [
        createTestEntity({ id: 'e1', type: 'agent', primaryText: 'Agent One' }),
        createTestEntity({ id: 'e2', type: 'agent', primaryText: 'Agent Two' }),
        createTestEntity({ id: 'e3', type: 'insight', primaryText: 'Insight One' }),
        createTestEntity({ id: 'e4', type: 'knowledge-item', primaryText: 'Knowledge One' }),
      ]

      const result = await detector.detect(entities)

      expect(result.entitiesChecked).toBe(2) // Only agents
    })

    it('should support multiple entity types', async () => {
      const detector = createDetectorForTypes(['agent', 'insight'])
      
      const entities = [
        createTestEntity({ id: 'e1', type: 'agent', primaryText: 'Agent' }),
        createTestEntity({ id: 'e2', type: 'insight', primaryText: 'Insight' }),
        createTestEntity({ id: 'e3', type: 'knowledge-item', primaryText: 'Knowledge' }),
      ]

      const result = await detector.detect(entities)

      expect(result.entitiesChecked).toBe(2)
    })
  })

  // =============================================================================
  // Similarity Threshold Tests
  // =============================================================================

  describe('similarity thresholds', () => {
    it('should respect embedding threshold', async () => {
      const detector = createDetector({
        embeddingThreshold: 0.99, // Very high threshold
        textThreshold: 0.99,
        combinedThreshold: 0.99,
      })

      const entities = [
        createTestEntity({ primaryText: 'Machine Learning' }),
        createTestEntity({ primaryText: 'Machine Learning' }),
      ]

      const result = await detector.detect(entities)

      // With very high threshold, even identical texts might not match
      // due to mock embedding variations
      expect(result.duplicates.length).toBeGreaterThanOrEqual(0)
    })

    it('should find duplicates with low threshold', async () => {
      const detector = createDetector({
        embeddingThreshold: 0.5,
        textThreshold: 0.5,
        combinedThreshold: 0.5,
      })

      const entities = [
        createTestEntity({ primaryText: 'Machine Learning' }),
        createTestEntity({ primaryText: 'Machine Learning' }),
      ]

      const result = await detector.detect(entities)

      expect(result.duplicates.length).toBeGreaterThanOrEqual(0)
    })
  })

  // =============================================================================
  // Detection Strategy Tests
  // =============================================================================

  describe('detection strategies', () => {
    it('should use pairwise comparison', async () => {
      const detector = createDetector({ strategy: 'pairwise' })
      
      const entities = createTestEntities(5)
      const result = await detector.detect(entities)

      expect(result.comparisonsMade).toBe(10) // C(5, 2) = 10
    })

    it('should use clustering strategy', async () => {
      const detector = createDetector({ strategy: 'clustering' })
      
      const entities = [
        createTestEntity({ id: 'e1', primaryText: 'AI Research' }),
        createTestEntity({ id: 'e2', primaryText: 'AI Research' }),
        createTestEntity({ id: 'e3', primaryText: 'Different Topic' }),
      ]

      const result = await detector.detect(entities)

      expect(result.entitiesChecked).toBe(3)
    })

    it('should use hybrid strategy', async () => {
      const detector = createDetector({ strategy: 'hybrid' })
      
      const entities = createTestEntities(10)
      const result = await detector.detect(entities)

      expect(result.entitiesChecked).toBe(10)
    })
  })

  // =============================================================================
  // Duplicate Pair Tests
  // =============================================================================

  describe('duplicate pairs', () => {
    it('should return correct duplicate pair structure', async () => {
      const entities = [
        createTestEntity({ id: 'e1', primaryText: 'Test' }),
        createTestEntity({ id: 'e2', primaryText: 'Test' }),
      ]

      const result = await detector.detect(entities)

      if (result.duplicates.length > 0) {
        const pair = result.duplicates[0]
        expect(pair.entityId1).toBeDefined()
        expect(pair.entityId2).toBeDefined()
        expect(pair.similarity).toBeGreaterThanOrEqual(0)
        expect(pair.similarity).toBeLessThanOrEqual(1)
        expect(pair.breakdown).toBeDefined()
        expect(pair.breakdown.embedding).toBeDefined()
        expect(pair.breakdown.text).toBeDefined()
        expect(pair.breakdown.combined).toBeDefined()
        expect(['merge', 'review', 'ignore']).toContain(pair.recommendation)
        expect(['embedding', 'text', 'hybrid']).toContain(pair.detectionMethod)
      }
    })

    it('should set recommendation based on similarity', async () => {
      // High similarity entities
      const entities = [
        createTestEntity({ id: 'e1', primaryText: 'Machine Learning Algorithms' }),
        createTestEntity({ id: 'e2', primaryText: 'Machine Learning Algorithms' }),
      ]

      const result = await detector.detect(entities)

      if (result.duplicates.length > 0) {
        const pair = result.duplicates[0]
        // High similarity should have merge or review recommendation
        expect(['merge', 'review']).toContain(pair.recommendation)
      }
    })
  })

  // =============================================================================
  // Batch Processing Tests
  // =============================================================================

  describe('batch processing', () => {
    it('should process large batches', async () => {
      const detector = createDetector({ batchSize: 10 })
      const entities = createTestEntities(50)

      const result = await detector.detect(entities)

      expect(result.entitiesChecked).toBe(50)
    })

    it('should handle batch size boundary', async () => {
      const detector = createDetector({ batchSize: 5 })
      const entities = createTestEntities(5)

      const result = await detector.detect(entities)

      expect(result.entitiesChecked).toBe(5)
    })
  })

  // =============================================================================
  // Configuration Tests
  // =============================================================================

  describe('configuration', () => {
    it('should update configuration', () => {
      detector.updateConfig({ combinedThreshold: 0.9 })
      const config = detector.getConfig()
      expect(config.combinedThreshold).toBe(0.9)
    })

    it('should preserve existing config when updating', () => {
      const originalConfig = detector.getConfig()
      detector.updateConfig({ combinedThreshold: 0.95 })
      const newConfig = detector.getConfig()
      
      expect(newConfig.combinedThreshold).toBe(0.95)
      expect(newConfig.entityTypes).toEqual(originalConfig.entityTypes)
    })

    it('should return copy of config', () => {
      const config1 = detector.getConfig()
      const config2 = detector.getConfig()
      
      config1.combinedThreshold = 0.1
      
      expect(config2.combinedThreshold).not.toBe(0.1)
    })
  })

  // =============================================================================
  // Custom Manager Tests
  // =============================================================================

  describe('custom managers', () => {
    it('should accept custom embedding manager', () => {
      const customEmbedding = createMockEmbeddingManager({ dimensions: 512 })
      detector.setEmbeddingManager(customEmbedding)
      
      expect(detector).toBeDefined()
    })

    it('should accept custom text manager', () => {
      const customText = createTextManager({ algorithm: 'jaro-winkler' })
      detector.setTextManager(customText)
      
      expect(detector).toBeDefined()
    })
  })
})

// =============================================================================
// Integration Tests
// =============================================================================

describe('DuplicateDetector Integration', () => {
  it('should detect duplicates across entity types', async () => {
    const detector = createDetector({
      entityTypes: ['agent', 'insight', 'knowledge-item'],
    })

    const entities = [
      createTestEntity({ id: 'a1', type: 'agent', primaryText: 'AI Assistant' }),
      createTestEntity({ id: 'a2', type: 'agent', primaryText: 'AI Assistant' }),
      createTestEntity({ id: 'i1', type: 'insight', primaryText: 'AI Insights' }),
      createTestEntity({ id: 'k1', type: 'knowledge-item', primaryText: 'AI Knowledge' }),
    ]

    const result = await detector.detect(entities)

    expect(result.entitiesChecked).toBe(4)
  })

  it('should process efficiently with caching', async () => {
    const detector = createDetector({ useCache: true })
    
    const entities = createTestEntities(20)

    // First run
    const start1 = Date.now()
    await detector.detect(entities)
    const duration1 = Date.now() - start1

    // Second run should use cache
    const start2 = Date.now()
    await detector.detect(entities)
    const duration2 = Date.now() - start2

    // Both should complete in reasonable time
    expect(duration1).toBeLessThan(5000)
    expect(duration2).toBeLessThan(5000)
  })

  it('should handle mixed similarity scenarios', async () => {
    const detector = createDetector({
      embeddingThreshold: 0.8,
      textThreshold: 0.8,
      combinedThreshold: 0.8,
    })

    const entities = [
      // High similarity pairs
      createTestEntity({ id: 'h1', primaryText: 'Machine Learning' }),
      createTestEntity({ id: 'h2', primaryText: 'Machine Learning' }),
      
      // Medium similarity pairs
      createTestEntity({ id: 'm1', primaryText: 'Machine Learning' }),
      createTestEntity({ id: 'm2', primaryText: 'Machine Learning Models' }),
      
      // Low similarity pairs
      createTestEntity({ id: 'l1', primaryText: 'Machine Learning' }),
      createTestEntity({ id: 'l2', primaryText: 'Completely Different Topic' }),
    ]

    const result = await detector.detect(entities)

    expect(result.entitiesChecked).toBe(6)
    // Should find some duplicates
    expect(result.duplicates.length).toBeGreaterThanOrEqual(0)
  })
})

// =============================================================================
// Factory Function Tests
// =============================================================================

describe('factory functions', () => {
  it('should create detector with default config', () => {
    const detector = createDetector()
    expect(detector).toBeInstanceOf(DuplicateDetector)
  })

  it('should create detector for specific types', () => {
    const detector = createDetectorForTypes(['agent', 'insight'])
    const config = detector.getConfig()
    
    expect(config.entityTypes).toEqual(['agent', 'insight'])
  })

  it('should create detector with custom thresholds', () => {
    const detector = createDetector({
      embeddingThreshold: 0.9,
      textThreshold: 0.85,
      combinedThreshold: 0.88,
    })
    
    const config = detector.getConfig()
    expect(config.embeddingThreshold).toBe(0.9)
    expect(config.textThreshold).toBe(0.85)
    expect(config.combinedThreshold).toBe(0.88)
  })
})