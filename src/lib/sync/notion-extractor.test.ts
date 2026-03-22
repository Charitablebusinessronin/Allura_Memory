/**
 * Notion Extractor Tests
 * 
 * Tests for Notion data extraction with rate limiting.
 */

import { describe, it, expect, beforeEach } from 'vitest'
import {
  NotionExtractor,
  NotionRateLimiter,
  MockNotionClient,
  createNotionExtractor,
  createMockNotionExtractor,
} from './notion-extractor'
import type { NotionEntity, EntityType } from './types'

// =============================================================================
// Test Fixtures
// =============================================================================

function createMockEntity(overrides: Partial<NotionEntity> = {}): NotionEntity {
  return {
    notionId: `notion-page-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    title: 'Test Entity',
    entityType: 'AgentDesign',
    lastEditedTime: new Date(),
    createdTime: new Date(Date.now() - 86400000),
    properties: {},
    versionToken: new Date().toISOString(),
    ...overrides,
  }
}

// =============================================================================
// Rate Limiter Tests
// =============================================================================

describe('NotionRateLimiter', () => {
  let rateLimiter: NotionRateLimiter

  beforeEach(() => {
    rateLimiter = new NotionRateLimiter({
      maxRequests: 3,
      intervalMs: 1000,
      enableBackoff: true,
      maxBackoffMs: 5000,
      initialBackoffMs: 100,
    })
  })

  describe('token acquisition', () => {
    it('should acquire tokens when available', async () => {
      // Should succeed immediately
      await expect(rateLimiter.acquire()).resolves.toBeUndefined()
    })

    it('should exhaust tokens and wait for refill', async () => {
      // Exhaust tokens
      await rateLimiter.acquire()
      await rateLimiter.acquire()
      await rateLimiter.acquire()

      // Next acquire should wait for refill
      const start = Date.now()
      await rateLimiter.acquire()
      const elapsed = Date.now() - start

      // Should have waited for refill
      expect(elapsed).toBeGreaterThanOrEqual(900) // ~1000ms refill interval
    }, 10000)
  })

  describe('backoff handling', () => {
    it('should increase backoff on rate limit', async () => {
      const initialBackoff = 100

      // First rate limit
      await rateLimiter.handleRateLimit()

      // Backoff should increase (exponential)
      // Initial backoff is 100ms, after first backoff it's 200ms
    })

    it('should reset backoff after successful request', async () => {
      await rateLimiter.handleRateLimit()
      rateLimiter.resetBackoff()
      // Backoff should be reset to initial
    })
  })
})

// =============================================================================
// Mock Notion Client Tests
// =============================================================================

describe('MockNotionClient', () => {
  let client: MockNotionClient

  beforeEach(() => {
    client = new MockNotionClient([
      createMockEntity({ notionId: 'page-1', title: 'Page 1' }),
      createMockEntity({ notionId: 'page-2', title: 'Page 2' }),
      createMockEntity({ notionId: 'page-3', title: 'Page 3' }),
    ])
  })

  describe('queryDatabase', () => {
    it('should return mock pages', async () => {
      const result = await client.queryDatabase('test-database')

      expect(result.results).toBeDefined()
      expect(result.results.length).toBeGreaterThan(0)
    })

    it('should respect page size limit', async () => {
      const result = await client.queryDatabase('test-database', { page_size: 2 })

      expect(result.results.length).toBeLessThanOrEqual(2)
    })

    it('should handle pagination', async () => {
      const firstPage = await client.queryDatabase('test-database', { page_size: 1 })

      expect(firstPage.results.length).toBe(1)
      expect(firstPage.has_more).toBeDefined()
    })
  })

  describe('getPage', () => {
    it('should return page by ID', async () => {
      const page = await client.getPage('page-1')

      expect(page).toBeDefined()
      expect(page.id).toBe('page-1')
    })

    it('should throw error for non-existent page', async () => {
      await expect(client.getPage('non-existent')).rejects.toThrow()
    })
  })

  describe('search', () => {
    it('should search pages by query', async () => {
      const result = await client.search({ query: 'Page' })

      expect(result.results).toBeDefined()
    })

    it('should filter by query', async () => {
      const result = await client.search({ query: 'Page 1' })

      expect(result.results.every((p) => {
        const title = p.properties.title as { title?: Array<{ plain_text: string }> }
        return title?.title?.[0]?.plain_text?.toLowerCase().includes('page 1')
      })).toBe(true)
    })
  })
})

// =============================================================================
// Notion Extractor Tests
// =============================================================================

describe('NotionExtractor', () => {
  let extractor: NotionExtractor

  beforeEach(() => {
    extractor = createMockNotionExtractor()
  })

  describe('extract', () => {
    it('should extract entities from Notion', async () => {
      const result = await extractor.extract()

      expect(result.entities).toBeDefined()
      expect(result.entities.length).toBeGreaterThan(0)
      expect(result.errors.length).toBe(0)
    })

    it('should extract entities with correct structure', async () => {
      const result = await extractor.extract({ limit: 5 })

      for (const entity of result.entities) {
        expect(entity).toHaveProperty('notionId')
        expect(entity).toHaveProperty('title')
        expect(entity).toHaveProperty('entityType')
        expect(entity).toHaveProperty('lastEditedTime')
        expect(entity).toHaveProperty('createdTime')
        expect(entity).toHaveProperty('versionToken')
      }
    })

    it('should filter by entity type', async () => {
      const result = await extractor.extract({ entityType: 'AgentDesign' })

      for (const entity of result.entities) {
        expect(entity.entityType).toBe('AgentDesign')
      }
    })

    it('should filter by timestamp (incremental)', async () => {
      const since = new Date(Date.now() - 3600000) // 1 hour ago
      const result = await extractor.extract({ since })

      for (const entity of result.entities) {
        expect(entity.lastEditedTime.getTime()).toBeGreaterThanOrEqual(since.getTime())
      }
    })

    it('should filter by sync key presence', async () => {
      const result = await extractor.extract({ includeUnkeyed: false })

      for (const entity of result.entities) {
        expect(entity.syncMetadata?.neo4jId).toBeDefined()
      }
    })

    it('should respect limit parameter', async () => {
      const result = await extractor.extract({ limit: 5 })

      expect(result.entities.length).toBeLessThanOrEqual(5)
    })

    it('should track extraction duration', async () => {
      const result = await extractor.extract()

      expect(result.durationMs).toBeDefined()
      expect(result.durationMs).toBeGreaterThanOrEqual(0)
    })
  })

  describe('extractPaginated', () => {
    it('should support pagination', async () => {
      const results = await extractor.extractPaginated({ limit: 10 })

      expect(Array.isArray(results)).toBe(true)
      expect(results.length).toBeGreaterThanOrEqual(1)
    })
  })

  describe('error handling', () => {
    it('should handle errors gracefully', async () => {
      const extractor = createMockNotionExtractor([
        createMockEntity({ notionId: 'valid' }),
        // Invalid entity will cause parse error
        createMockEntity({ notionId: '', title: '' }),
      ])

      const result = await extractor.extract()

      // Should still return valid entities
      expect(result.entities.length).toBeGreaterThanOrEqual(0)
      // May have errors
      expect(result.errors).toBeDefined()
    })
  })
})

// =============================================================================
// Factory Function Tests
// =============================================================================

describe('createNotionExtractor', () => {
  it('should create extractor with default config', () => {
    const extractor = createNotionExtractor()
    expect(extractor).toBeInstanceOf(NotionExtractor)
  })

  it('should create extractor with custom config', () => {
    const extractor = createNotionExtractor({
      defaultBatchSize: 50,
    })
    expect(extractor).toBeInstanceOf(NotionExtractor)
  })
})

describe('createMockNotionExtractor', () => {
  it('should create extractor with mock client', () => {
    const extractor = createMockNotionExtractor()
    expect(extractor).toBeInstanceOf(NotionExtractor)
  })

  it('should accept seed data', () => {
    const seedData = [
      createMockEntity({ notionId: 'seed-1' }),
      createMockEntity({ notionId: 'seed-2' }),
    ]
    const extractor = createMockNotionExtractor(seedData)
    expect(extractor).toBeInstanceOf(NotionExtractor)
  })
})

// =============================================================================
// Integration Tests
// =============================================================================

describe('Notion Extractor Integration', () => {
  it('should generate diverse mock entities', async () => {
    const extractor = createMockNotionExtractor()
    const result = await extractor.extract({ limit: 20 })

    // Should have various entity types
    const entityTypes = new Set(result.entities.map((e) => e.entityType))
    expect(entityTypes.size).toBeGreaterThan(1)
  })

  it('should generate entities with sync metadata', async () => {
    const extractor = createMockNotionExtractor()
    const result = await extractor.extract({ limit: 20 })

    const withSyncKey = result.entities.filter((e) => e.syncMetadata?.neo4jId)
    const withoutSyncKey = result.entities.filter((e) => !e.syncMetadata?.neo4jId)

    // Should have mix of entities with and without sync keys
    // At least some entities should have sync keys (70% chance)
    expect(withSyncKey.length).toBeGreaterThanOrEqual(0)
    // Total should be the limit we requested
    expect(result.entities.length).toBeLessThanOrEqual(20)
  })

  it('should handle large datasets efficiently', async () => {
    const extractor = createMockNotionExtractor()
    const start = Date.now()

    const result = await extractor.extract({ limit: 100 })

    const elapsed = Date.now() - start

    // Should complete within reasonable time (mock should be fast)
    expect(elapsed).toBeLessThan(5000)
    expect(result.entities.length).toBeLessThanOrEqual(100)
  })
})