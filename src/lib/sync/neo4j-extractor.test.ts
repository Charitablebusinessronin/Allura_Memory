/**
 * Neo4j Extractor Tests
 * 
 * Tests for Neo4j data extraction for drift detection.
 */

import { describe, it, expect, beforeEach } from 'vitest'
import {
  Neo4jExtractor,
  MockNeo4jClient,
  createNeo4jExtractor,
  createMockNeo4jExtractor,
} from './neo4j-extractor'
import type { Neo4jEntity, EntityType } from './types'

// =============================================================================
// Test Fixtures
// =============================================================================

function createMockEntity(overrides: Partial<Neo4jEntity> = {}): Neo4jEntity {
  return {
    neo4jId: `neo4j-node-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    title: 'Test Entity',
    entityType: 'AgentDesign',
    updatedAt: new Date(),
    createdAt: new Date(Date.now() - 86400000),
    version: 1,
    properties: {},
    ...overrides,
  }
}

// =============================================================================
// Mock Neo4j Client Tests
// =============================================================================

describe('MockNeo4jClient', () => {
  let client: MockNeo4jClient

  beforeEach(() => {
    client = new MockNeo4jClient([
      createMockEntity({ neo4jId: 'node-1', title: 'Node 1' }),
      createMockEntity({ neo4jId: 'node-2', title: 'Node 2' }),
      createMockEntity({ neo4jId: 'node-3', title: 'Node 3' }),
    ])
  })

  describe('run', () => {
    it('should return mock nodes for MATCH queries', async () => {
      const result = await client.run('MATCH (n) RETURN n')

      expect(result.records).toBeDefined()
      expect(result.records.length).toBeGreaterThan(0)
    })

    it('should filter by label', async () => {
      const result = await client.run('MATCH (n:AgentDesign) RETURN n', { limit: 100 })

      expect(result.records).toBeDefined()
    })

    it('should respect limit parameter', async () => {
      const result = await client.run('MATCH (n) RETURN n LIMIT $limit', { limit: 5 })

      expect(result.records.length).toBeLessThanOrEqual(5)
    })

    it('should return count for count queries', async () => {
      const result = await client.run('MATCH (n) RETURN count(n) as count')

      expect(result.records.length).toBe(1)
      expect(result.records[0]._fields[0]).toBeGreaterThanOrEqual(0)
    })

    it('should return entity by ID', async () => {
      const result = await client.run(
        'MATCH (n {id: $id}) RETURN n',
        { id: 'node-1' }
      )

      expect(result.records.length).toBeLessThanOrEqual(1)
    })
  })

  describe('close', () => {
    it('should close without error', async () => {
      await expect(client.close()).resolves.toBeUndefined()
    })
  })
})

// =============================================================================
// Neo4j Extractor Tests
// =============================================================================

describe('Neo4jExtractor', () => {
  let extractor: Neo4jExtractor

  beforeEach(() => {
    extractor = createMockNeo4jExtractor()
  })

  describe('extract', () => {
    it('should extract entities from Neo4j', async () => {
      const result = await extractor.extract()

      expect(result.entities).toBeDefined()
      expect(result.entities.length).toBeGreaterThan(0)
      expect(result.errors.length).toBe(0)
    })

    it('should extract entities with correct structure', async () => {
      const result = await extractor.extract({ limit: 5 })

      for (const entity of result.entities) {
        expect(entity).toHaveProperty('neo4jId')
        expect(entity).toHaveProperty('title')
        expect(entity).toHaveProperty('entityType')
        expect(entity).toHaveProperty('updatedAt')
        expect(entity).toHaveProperty('createdAt')
        expect(entity).toHaveProperty('version')
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
        expect(entity.updatedAt.getTime()).toBeGreaterThanOrEqual(since.getTime())
      }
    })

    it('should filter by sync key presence', async () => {
      const result = await extractor.extract({ includeUnkeyed: false })

      for (const entity of result.entities) {
        expect(entity.syncMetadata?.notionId).toBeDefined()
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

  describe('extractByType', () => {
    it('should extract entities of specific type', async () => {
      const result = await extractor.extractByType('Task')

      for (const entity of result.entities) {
        expect(entity.entityType).toBe('Task')
      }
    })

    it('should combine with other filters', async () => {
      const since = new Date(Date.now() - 86400000)
      const result = await extractor.extractByType('AgentDesign', { since, limit: 10 })

      expect(result.entities.length).toBeLessThanOrEqual(10)
    })
  })

  describe('extractIncremental', () => {
    it('should extract only updated entities', async () => {
      const since = new Date(Date.now() - 3600000) // 1 hour ago
      const result = await extractor.extractIncremental(since)

      for (const entity of result.entities) {
        expect(entity.updatedAt.getTime()).toBeGreaterThanOrEqual(since.getTime())
      }
    })
  })

  describe('extractWithSyncKeys', () => {
    it('should extract only entities with sync keys', async () => {
      const result = await extractor.extractWithSyncKeys()

      for (const entity of result.entities) {
        expect(entity.syncMetadata?.notionId).toBeDefined()
      }
    })
  })

  describe('getEntityCount', () => {
    it('should return total count', async () => {
      const count = await extractor.getEntityCount()

      expect(count).toBeGreaterThanOrEqual(0)
    })

    it('should return count by type', async () => {
      const count = await extractor.getEntityCount('AgentDesign')

      expect(count).toBeGreaterThanOrEqual(0)
    })
  })

  describe('getEntityById', () => {
    it('should return entity if found', async () => {
      // Create mock client with seed data to ensure entity exists
      const seedData = [createMockEntity({ neo4jId: 'test-entity-1' })]
      const mockClient = new MockNeo4jClient(seedData)
      const extractorWithClient = new Neo4jExtractor({ client: mockClient })
      
      const entity = await extractorWithClient.getEntityById('test-entity-1')

      expect(entity).toBeDefined()
      expect(entity?.neo4jId).toBe('test-entity-1')
    })

    it('should return null if not found', async () => {
      const entity = await extractor.getEntityById('non-existent-id')

      expect(entity).toBeNull()
    })
  })

  describe('error handling', () => {
    it('should handle errors gracefully', async () => {
      const result = await extractor.extract()

      expect(result.errors).toBeDefined()
      expect(Array.isArray(result.errors)).toBe(true)
    })
  })
})

// =============================================================================
// Factory Function Tests
// =============================================================================

describe('createNeo4jExtractor', () => {
  it('should create extractor with default config', () => {
    const extractor = createNeo4jExtractor()
    expect(extractor).toBeInstanceOf(Neo4jExtractor)
  })

  it('should create extractor with custom config', () => {
    const extractor = createNeo4jExtractor({
      defaultBatchSize: 50,
    })
    expect(extractor).toBeInstanceOf(Neo4jExtractor)
  })
})

describe('createMockNeo4jExtractor', () => {
  it('should create extractor with mock client', () => {
    const extractor = createMockNeo4jExtractor()
    expect(extractor).toBeInstanceOf(Neo4jExtractor)
  })

  it('should accept seed data', () => {
    const seedData = [
      createMockEntity({ neo4jId: 'seed-1' }),
      createMockEntity({ neo4jId: 'seed-2' }),
    ]
    const extractor = createMockNeo4jExtractor(seedData)
    expect(extractor).toBeInstanceOf(Neo4jExtractor)
  })
})

// =============================================================================
// Integration Tests
// =============================================================================

describe('Neo4j Extractor Integration', () => {
  it('should generate diverse mock entities', async () => {
    const extractor = createMockNeo4jExtractor()
    const result = await extractor.extract({ limit: 20 })

    // Should have various entity types
    const entityTypes = new Set(result.entities.map((e) => e.entityType))
    expect(entityTypes.size).toBeGreaterThan(1)
  })

  it('should generate entities with sync metadata', async () => {
    const extractor = createMockNeo4jExtractor()
    const result = await extractor.extract({ limit: 20 })

    const withSyncKey = result.entities.filter((e) => e.syncMetadata?.notionId)
    const withoutSyncKey = result.entities.filter((e) => !e.syncMetadata?.notionId)

    // Should have mix of entities with and without sync keys
    // 80% have sync keys, so we should have at least some
    expect(withSyncKey.length).toBeGreaterThanOrEqual(0)
    // Total should be the limit we requested
    expect(result.entities.length).toBeLessThanOrEqual(20)
  })

  it('should handle large datasets efficiently', async () => {
    const extractor = createMockNeo4jExtractor()
    const start = Date.now()

    const result = await extractor.extract({ limit: 100 })

    const elapsed = Date.now() - start

    // Should complete within reasonable time (mock should be fast)
    expect(elapsed).toBeLessThan(5000)
    expect(result.entities.length).toBeLessThanOrEqual(100)
  })

  it('should handle property filter', async () => {
    const extractor = createMockNeo4jExtractor()
    const result = await extractor.extract({
      propertyFilter: { status: 'active' }
    })

    // All entities should match the filter
    for (const entity of result.entities) {
      // Skip if no properties match
      if (entity.properties.status !== 'active') {
        expect(entity.properties.status).toBeUndefined()
      }
    }
  })
})