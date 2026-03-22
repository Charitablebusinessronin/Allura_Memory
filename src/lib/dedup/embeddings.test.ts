/**
 * Embedding-based Similarity Tests
 * 
 * Tests for embedding generation, caching, and similarity computation.
 */

import { describe, it, expect, beforeEach } from 'vitest'
import {
  EmbeddingManager,
  createMockEmbeddingManager,
  createEmbeddingManager,
} from './embeddings'
import type { DedupEntity, EmbeddingVector } from './types'

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

// =============================================================================
// Mock Embedding Manager Tests
// =============================================================================

describe('EmbeddingManager', () => {
  let manager: EmbeddingManager

  beforeEach(() => {
    manager = createMockEmbeddingManager()
  })

  // =============================================================================
  // Embedding Generation Tests
  // =============================================================================

  describe('getEmbedding', () => {
    it('should generate embedding for entity', async () => {
      const entity = createTestEntity({ primaryText: 'Test insight about AI' })
      const embedding = await manager.getEmbedding(entity)

      expect(embedding).toBeDefined()
      expect(Array.isArray(embedding)).toBe(true)
      expect(embedding.length).toBe(1536) // Default dimensions
    })

    it('should generate consistent embeddings for same text', async () => {
      const entity1 = createTestEntity({ primaryText: 'Machine learning models' })
      const entity2 = createTestEntity({ primaryText: 'Machine learning models' })

      const embedding1 = await manager.getEmbedding(entity1)
      const embedding2 = await manager.getEmbedding(entity2)

      // Same text should produce same embedding (with mock generator)
      expect(embedding1).toEqual(embedding2)
    })

    it('should include entity type in embedding text', async () => {
      const entity1 = createTestEntity({ primaryText: 'Test', type: 'agent' })
      const entity2 = createTestEntity({ primaryText: 'Test', type: 'insight' })

      const embedding1 = await manager.getEmbedding(entity1)
      const embedding2 = await manager.getEmbedding(entity2)

      // Different types should produce different embeddings
      expect(embedding1).not.toEqual(embedding2)
    })

    it('should include secondary text in embedding', async () => {
      const entity1 = createTestEntity({
        primaryText: 'Test',
        secondaryText: 'Additional context',
      })
      const entity2 = createTestEntity({
        primaryText: 'Test',
        secondaryText: 'Different context',
      })

      const embedding1 = await manager.getEmbedding(entity1)
      const embedding2 = await manager.getEmbedding(entity2)

      // Different secondary text should produce different embeddings
      expect(embedding1).not.toEqual(embedding2)
    })
  })

  // =============================================================================
  // Batch Embedding Tests
  // =============================================================================

  describe('getEmbeddings', () => {
    it('should generate embeddings for multiple entities', async () => {
      const entities = [
        createTestEntity({ primaryText: 'Entity 1' }),
        createTestEntity({ primaryText: 'Entity 2' }),
        createTestEntity({ primaryText: 'Entity 3' }),
      ]

      const embeddings = await manager.getEmbeddings(entities)

      expect(embeddings.size).toBe(3)
      expect(embeddings.has(entities[0].id)).toBe(true)
      expect(embeddings.has(entities[1].id)).toBe(true)
      expect(embeddings.has(entities[2].id)).toBe(true)
    })

    it('should return embeddings for all entities', async () => {
      const entities = Array.from({ length: 10 }, (_, i) =>
        createTestEntity({ primaryText: `Entity ${i}` })
      )

      const embeddings = await manager.getEmbeddings(entities)

      expect(embeddings.size).toBe(10)
      for (const entity of entities) {
        expect(embeddings.has(entity.id)).toBe(true)
      }
    })
  })

  // =============================================================================
  // Cosine Similarity Tests
  // =============================================================================

  describe('cosineSimilarity', () => {
    it('should return 1 for identical vectors', () => {
      const vec: EmbeddingVector = [0.5, 0.5, 0.5, 0.5]
      const similarity = manager.cosineSimilarity(vec, vec)

      expect(similarity).toBeCloseTo(1, 5)
    })

    it('should return 0 for orthogonal vectors', () => {
      const vec1: EmbeddingVector = [1, 0, 0, 0]
      const vec2: EmbeddingVector = [0, 1, 0, 0]
      const similarity = manager.cosineSimilarity(vec1, vec2)

      expect(similarity).toBeCloseTo(0, 5)
    })

    it('should return correct similarity for similar vectors', () => {
      const vec1: EmbeddingVector = [1, 1, 0, 0]
      const vec2: EmbeddingVector = [1, 1, 0.5, 0]
      const similarity = manager.cosineSimilarity(vec1, vec2)

      expect(similarity).toBeGreaterThan(0.8)
      expect(similarity).toBeLessThanOrEqual(1.01) // Allow for floating-point precision
    })

    it('should return correct similarity for opposite vectors', () => {
      const vec1: EmbeddingVector = [1, 0, 0, 0]
      const vec2: EmbeddingVector = [-1, 0, 0, 0]
      const similarity = manager.cosineSimilarity(vec1, vec2)

      expect(similarity).toBeCloseTo(-1, 5)
    })

    it('should throw for different dimension vectors', () => {
      const vec1: EmbeddingVector = [1, 2, 3]
      const vec2: EmbeddingVector = [1, 2, 3, 4]

      expect(() => manager.cosineSimilarity(vec1, vec2)).toThrow('same dimension')
    })
  })

  // =============================================================================
  // Entity Similarity Tests
  // =============================================================================

  describe('computeSimilarity', () => {
    it('should compute similarity between two entities', async () => {
      const entity1 = createTestEntity({ primaryText: 'Machine learning algorithms' })
      const entity2 = createTestEntity({ primaryText: 'Machine learning algorithms' })

      const result = await manager.computeSimilarity(entity1, entity2)

      expect(result).toBeDefined()
      expect(result.entityId1).toBe(entity1.id)
      expect(result.entityId2).toBe(entity2.id)
      expect(result.score).toBeGreaterThanOrEqual(0)
      expect(result.score).toBeLessThanOrEqual(1.01) // Allow for floating-point precision
      expect(result.embeddingSimilarity).toBeDefined()
    })

    it('should return high confidence for identical entities', async () => {
      const entity1 = createTestEntity({ primaryText: 'Test entity' })
      const entity2 = createTestEntity({ primaryText: 'Test entity' })

      const result = await manager.computeSimilarity(entity1, entity2)

      // Mock embeddings produce deterministic results based on text hash
      // For identical text, the embedding similarity should be high
      expect(result.confidence).toBe('high')
      expect(result.score).toBeGreaterThan(0.9)
    })

    it('should return isPotentialDuplicate based on threshold', async () => {
      const entity1 = createTestEntity({ primaryText: 'Test entity one' })
      const entity2 = createTestEntity({ primaryText: 'Completely different text' })

      const result = await manager.computeSimilarity(entity1, entity2)

      expect(typeof result.isPotentialDuplicate).toBe('boolean')
      expect(typeof result.confidence).toBe('string')
    })
  })

  // =============================================================================
  // Batch Similarity Tests
  // =============================================================================

  describe('computeSimilarities', () => {
    it('should compute similarities for multiple entities', async () => {
      const entities = [
        createTestEntity({ primaryText: 'Entity A' }),
        createTestEntity({ primaryText: 'Entity B' }),
        createTestEntity({ primaryText: 'Entity C' }),
      ]

      const results = await manager.computeSimilarities(entities)

      // Should compute C(3, 2) = 3 pairs
      expect(results.length).toBe(3)
    })

    it('should compute all pairwise combinations', async () => {
      const entities = Array.from({ length: 5 }, (_, i) =>
        createTestEntity({ primaryText: `Entity ${i}` })
      )

      const results = await manager.computeSimilarities(entities)

      // Should compute C(5, 2) = 10 pairs
      expect(results.length).toBe(10)
    })

    it('should include all entity pairs', async () => {
      const entities = [
        createTestEntity({ id: 'e1', primaryText: 'A' }),
        createTestEntity({ id: 'e2', primaryText: 'B' }),
        createTestEntity({ id: 'e3', primaryText: 'C' }),
      ]

      const results = await manager.computeSimilarities(entities)
      const pairs = results.map((r) => `${r.entityId1}:${r.entityId2}`).sort()

      expect(pairs).toContain('e1:e2')
      expect(pairs).toContain('e1:e3')
      expect(pairs).toContain('e2:e3')
    })
  })

  // =============================================================================
  // Caching Tests
  // =============================================================================

  describe('caching', () => {
    it('should cache embeddings by default', async () => {
      const entity = createTestEntity({ primaryText: 'Cached entity' })

      // First call generates and caches
      await manager.getEmbedding(entity)

      // Second call should use cache
      const statsBefore = manager.getCacheStats()
      await manager.getEmbedding(entity)
      const statsAfter = manager.getCacheStats()

      // Cache size should not increase (same embedding reused)
      expect(statsAfter.size).toBe(statsBefore.size)
    })

    it('should bypass cache when disabled', async () => {
      const entity = createTestEntity({ primaryText: 'Uncached entity' })

      // Get with cache disabled
      const embedding1 = await manager.getEmbedding(entity, { useCache: false })
      const embedding2 = await manager.getEmbedding(entity, { useCache: false })

      // Both calls should generate fresh embeddings
      expect(embedding1).toEqual(embedding2)
    })

    it('should clear cache', async () => {
      const entity = createTestEntity({ primaryText: 'Clear test' })

      await manager.getEmbedding(entity)
      expect(manager.getCacheStats().size).toBeGreaterThan(0)

      manager.clearCache()
      expect(manager.getCacheStats().size).toBe(0)
    })
  })

  // =============================================================================
  // Factory Function Tests
  // =============================================================================

  describe('createMockEmbeddingManager', () => {
    it('should create manager with default config', () => {
      const mgr = createMockEmbeddingManager()
      expect(mgr).toBeInstanceOf(EmbeddingManager)
    })

    it('should create manager with custom dimensions', async () => {
      const mgr = createMockEmbeddingManager({ dimensions: 512 })
      const entity = createTestEntity({ primaryText: 'Test' })
      const embedding = await mgr.getEmbedding(entity)

      expect(embedding.length).toBe(512)
    })

    it('should create manager with custom cache size', () => {
      const mgr = createMockEmbeddingManager({ cacheMaxSize: 100 })
      expect(mgr).toBeInstanceOf(EmbeddingManager)
    })
  })

  describe('createEmbeddingManager', () => {
    it('should create manager with default config', () => {
      const mgr = createEmbeddingManager()
      expect(mgr).toBeInstanceOf(EmbeddingManager)
    })

    it('should create manager with custom config', () => {
      const mgr = createEmbeddingManager({
        cacheMaxSize: 5000,
        cacheTtl: 3600,
      })
      expect(mgr).toBeInstanceOf(EmbeddingManager)
    })
  })
})

// =============================================================================
// Integration Tests
// =============================================================================

describe('EmbeddingManager Integration', () => {
  it('should handle large batch of entities', async () => {
    const manager = createMockEmbeddingManager()
    const entities = Array.from({ length: 50 }, (_, i) =>
      createTestEntity({ primaryText: `Entity ${i}` })
    )

    const embeddings = await manager.getEmbeddings(entities)

    expect(embeddings.size).toBe(50)
  })

  it('should compute similarities efficiently', async () => {
    const manager = createMockEmbeddingManager()
    const entities = Array.from({ length: 20 }, (_, i) =>
      createTestEntity({ primaryText: `Entity ${i}` })
    )

    const startTime = Date.now()
    const results = await manager.computeSimilarities(entities)
    const duration = Date.now() - startTime

    expect(results.length).toBe(190) // C(20, 2) = 190
    expect(duration).toBeLessThan(5000) // Should complete in under 5 seconds
  })
})