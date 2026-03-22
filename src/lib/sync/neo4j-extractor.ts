/**
 * Neo4j Extractor
 * 
 * Extracts entity data from Neo4j knowledge graph for drift detection.
 * Queries for mirrored entities with sync keys.
 */

import type {
  EntityType,
  Neo4jEntity,
  Neo4jExtractionOptions,
  Neo4jExtractionResult,
  ExtractionError,
} from './types'
import { ENTITY_TYPES } from './types'

// =============================================================================
// Configuration
// =============================================================================

const DEFAULT_BATCH_SIZE = 100
const DEFAULT_MAX_RETRIES = 3

// =============================================================================
// Neo4j Client Interface
// =============================================================================

/**
 * Neo4j driver interface
 * Abstracts the actual Neo4j driver for testing/mocking
 */
export interface Neo4jClient {
  /**
   * Execute a Cypher query
   */
  run(
    query: string,
    params?: Record<string, unknown>
  ): Promise<{ records: Array<{ keys: string[]; _fields: unknown[] }> }>

  /**
   * Close the connection
   */
  close(): Promise<void>
}

/**
 * Neo4j session interface
 */
export interface Neo4jSession {
  run(
    query: string,
    params?: Record<string, unknown>
  ): Promise<{ records: Array<{ keys: string[]; _fields: unknown[] }> }>
  close(): Promise<void>
}

// =============================================================================
// Cypher Queries
// =============================================================================

const QUERIES = {
  /**
   * Get all entities with sync metadata
   */
  getAllEntities: `
    MATCH (n)
    WHERE n.id IS NOT NULL
    RETURN 
      n.id as neo4jId,
      n.title as title,
      labels(n) as labels,
      n.createdAt as createdAt,
      n.updatedAt as updatedAt,
      n.version as version,
      n.notionId as notionId,
      n.lastSyncTime as lastSyncTime,
      properties(n) as properties
    ORDER BY n.updatedAt DESC
    LIMIT $limit
  `,

  /**
   * Get entities by type (label)
   */
  getEntitiesByType: `
    MATCH (n:$label)
    WHERE n.id IS NOT NULL
    RETURN 
      n.id as neo4jId,
      n.title as title,
      labels(n) as labels,
      n.createdAt as createdAt,
      n.updatedAt as updatedAt,
      n.version as version,
      n.notionId as notionId,
      n.lastSyncTime as lastSyncTime,
      properties(n) as properties
    ORDER BY n.updatedAt DESC
    LIMIT $limit
  `,

  /**
   * Get entities updated after timestamp (incremental)
   */
  getEntitiesUpdatedSince: `
    MATCH (n)
    WHERE n.id IS NOT NULL 
      AND n.updatedAt > datetime($since)
    RETURN 
      n.id as neo4jId,
      n.title as title,
      labels(n) as labels,
      n.createdAt as createdAt,
      n.updatedAt as updatedAt,
      n.version as version,
      n.notionId as notionId,
      n.lastSyncTime as lastSyncTime,
      properties(n) as properties
    ORDER BY n.updatedAt DESC
    LIMIT $limit
  `,

  /**
   * Get entities with Notion sync keys
   */
  getEntitiesWithSyncKeys: `
    MATCH (n)
    WHERE n.id IS NOT NULL 
      AND n.notionId IS NOT NULL
    RETURN 
      n.id as neo4jId,
      n.title as title,
      labels(n) as labels,
      n.createdAt as createdAt,
      n.updatedAt as updatedAt,
      n.version as version,
      n.notionId as notionId,
      n.lastSyncTime as lastSyncTime,
      properties(n) as properties
    ORDER BY n.updatedAt DESC
    LIMIT $limit
  `,

  /**
   * Get entities by type updated since
   */
  getEntitiesByTypeUpdatedSince: `
    MATCH (n:$label)
    WHERE n.id IS NOT NULL 
      AND n.updatedAt > datetime($since)
    RETURN 
      n.id as neo4jId,
      n.title as title,
      labels(n) as labels,
      n.createdAt as createdAt,
      n.updatedAt as updatedAt,
      n.version as version,
      n.notionId as notionId,
      n.lastSyncTime as lastSyncTime,
      properties(n) as properties
    ORDER BY n.updatedAt DESC
    LIMIT $limit
  `,

  /**
   * Count entities by type
   */
  countEntities: `
    MATCH (n:$label)
    RETURN count(n) as count
  `,

  /**
   * Get entity by ID
   */
  getEntityById: `
    MATCH (n {id: $id})
    RETURN 
      n.id as neo4jId,
      n.title as title,
      labels(n) as labels,
      n.createdAt as createdAt,
      n.updatedAt as updatedAt,
      n.version as version,
      n.notionId as notionId,
      n.lastSyncTime as lastSyncTime,
      properties(n) as properties
    LIMIT 1
  `,
}

// =============================================================================
// Mock Neo4j Client
// =============================================================================

/**
 * Mock Neo4j client for testing
 * Generates realistic test data without actual database connection
 */
export class MockNeo4jClient implements Neo4jClient {
  private mockNodes: Map<string, Neo4jEntity> = new Map()

  constructor(seedData: Neo4jEntity[] = []) {
    // Seed with initial data
    for (const entity of seedData) {
      this.mockNodes.set(entity.neo4jId, entity)
    }
  }

  /**
   * Add mock data
   */
  addMockData(entities: Neo4jEntity[]): void {
    for (const entity of entities) {
      this.mockNodes.set(entity.neo4jId, entity)
    }
  }

  /**
   * Execute mock query
   */
  async run(
    query: string,
    params?: Record<string, unknown>
  ): Promise<{ records: Array<{ keys: string[]; _fields: unknown[] }> }> {
    await this.simulateNetworkDelay()

    // Parse query type and return appropriate results
    if (query.includes('count(n)')) {
      const label = this.extractLabel(query)
      const count = label
        ? Array.from(this.mockNodes.values()).filter((e) => e.entityType === label).length
        : this.mockNodes.size

      return {
        records: [
          {
            keys: ['count'],
            _fields: [count],
          },
        ],
      }
    }

    if (query.includes('MATCH (n:$label)') || query.includes('MATCH (n)')) {
      const label = this.extractLabel(query)
      const limit = (params?.limit as number) ?? 100
      const since = params?.since as string | undefined

      let entities = Array.from(this.mockNodes.values())

      // Filter by label if specified
      if (label) {
        entities = entities.filter((e) => e.entityType === label)
      }

      // Filter by since if specified
      if (since) {
        const sinceDate = new Date(since)
        entities = entities.filter((e) => e.updatedAt > sinceDate)
      }

      // Filter by sync key presence
      if (query.includes('n.notionId IS NOT NULL')) {
        entities = entities.filter((e) => e.syncMetadata?.notionId)
      }

      // Apply limit
      entities = entities.slice(0, limit)

      // Convert to record format
      const records = entities.map((entity) => ({
        keys: ['neo4jId', 'title', 'labels', 'createdAt', 'updatedAt', 'version', 'notionId', 'lastSyncTime', 'properties'],
        _fields: [
          entity.neo4jId,
          entity.title,
          [entity.entityType],
          entity.createdAt.toISOString(),
          entity.updatedAt.toISOString(),
          entity.version,
          entity.syncMetadata?.notionId ?? null,
          entity.syncMetadata?.lastSyncTime?.toISOString() ?? null,
          entity.properties,
        ],
      }))

      return { records }
    }

    if (query.includes('{id: $id}')) {
      const id = params?.id as string
      const entity = this.mockNodes.get(id)

      if (!entity) {
        return { records: [] }
      }

      return {
        records: [
          {
            keys: ['neo4jId', 'title', 'labels', 'createdAt', 'updatedAt', 'version', 'notionId', 'lastSyncTime', 'properties'],
            _fields: [
              entity.neo4jId,
              entity.title,
              [entity.entityType],
              entity.createdAt.toISOString(),
              entity.updatedAt.toISOString(),
              entity.version,
              entity.syncMetadata?.notionId ?? null,
              entity.syncMetadata?.lastSyncTime?.toISOString() ?? null,
              entity.properties,
            ],
          },
        ],
      }
    }

    return { records: [] }
  }

  /**
   * Close connection (no-op for mock)
   */
  async close(): Promise<void> {
    // No-op
  }

  /**
   * Extract label from query
   */
  private extractLabel(query: string): string | null {
    const match = query.match(/MATCH \(n:(\w+)\)/)
    return match ? match[1] : null
  }

  /**
   * Simulate network delay
   */
  private async simulateNetworkDelay(): Promise<void> {
    await new Promise((resolve) => setTimeout(resolve, Math.random() * 10 + 2))
  }
}

// =============================================================================
// Neo4j Extractor
// =============================================================================

/**
 * Neo4j Extractor
 * 
 * Extracts entity data from Neo4j for drift detection.
 * Supports filtering by type, timestamp, and sync key presence.
 */
export class Neo4jExtractor {
  private client: Neo4jClient | null
  private defaultBatchSize: number
  private maxRetries: number

  constructor(config: {
    client?: Neo4jClient
    defaultBatchSize?: number
    maxRetries?: number
  } = {}) {
    this.client = config.client ?? null
    this.defaultBatchSize = config.defaultBatchSize ?? DEFAULT_BATCH_SIZE
    this.maxRetries = config.maxRetries ?? DEFAULT_MAX_RETRIES
  }

  /**
   * Extract entities from Neo4j
   */
  async extract(options: Neo4jExtractionOptions = {}): Promise<Neo4jExtractionResult> {
    const startTime = Date.now()
    const errors: ExtractionError[] = []
    const entities: Neo4jEntity[] = []

    try {
      // Build and execute query
      const query = this.buildQuery(options)
      const params = this.buildParams(options)

      const result = this.client
        ? await this.executeQuery(query, params)
        : await this.executeMock(options)

      // Parse results into entities
      for (const record of result.records) {
        try {
          const entity = this.recordToEntity(record)

          // Apply additional filters
          if (options.entityType && entity.entityType !== options.entityType) {
            continue
          }

          if (options.since && entity.updatedAt < options.since) {
            continue
          }

          if (!options.includeUnkeyed && !entity.syncMetadata?.notionId) {
            continue
          }

          if (options.propertyFilter) {
            const matches = Object.entries(options.propertyFilter).every(
              ([key, value]) => entity.properties[key] === value
            )
            if (!matches) {
              continue
            }
          }

          entities.push(entity)
        } catch (error) {
          errors.push({
            entityId: record._fields?.[0] as string,
            message: error instanceof Error ? error.message : 'Failed to parse record',
            code: 'PARSE_ERROR',
            details: { record },
          })
        }
      }
    } catch (error) {
      errors.push({
        message: error instanceof Error ? error.message : 'Unknown extraction error',
        code: 'EXTRACTION_ERROR',
        details: { error },
      })
    }

    const durationMs = Date.now() - startTime

    return {
      entities,
      totalFound: entities.length,
      batchSize: entities.length,
      durationMs,
      errors,
    }
  }

  /**
   * Extract by entity type
   */
  async extractByType(
    entityType: EntityType,
    options: Omit<Neo4jExtractionOptions, 'entityType'> = {}
  ): Promise<Neo4jExtractionResult> {
    return this.extract({ ...options, entityType })
  }

  /**
   * Extract with incremental updates
   */
  async extractIncremental(since: Date, options: Neo4jExtractionOptions = {}): Promise<Neo4jExtractionResult> {
    return this.extract({ ...options, since })
  }

  /**
   * Extract only entities with sync keys
   */
  async extractWithSyncKeys(options: Neo4jExtractionOptions = {}): Promise<Neo4jExtractionResult> {
    return this.extract({ ...options, includeUnkeyed: false })
  }

  /**
   * Get count of entities
   */
  async getEntityCount(entityType?: EntityType): Promise<number> {
    if (this.client) {
      const query = entityType
        ? QUERIES.countEntities.replace('$label', entityType)
        : 'MATCH (n) RETURN count(n) as count'

      const result = await this.client.run(query)
      const record = result.records[0]
      return (record?._fields?.[0] as number) ?? 0
    } else {
      // Mock implementation
      const all = Array.from((this.client as MockNeo4jClient | null)?.['mockNodes']?.values() ?? [])
      if (entityType) {
        return all.filter((e) => e.entityType === entityType).length
      }
      return all.length
    }
  }

  /**
   * Get entity by ID
   */
  async getEntityById(id: string): Promise<Neo4jEntity | null> {
    if (this.client) {
      const result = await this.client.run(QUERIES.getEntityById, { id })
      if (result.records.length === 0) {
        return null
      }
      return this.recordToEntity(result.records[0])
    } else {
      // Mock implementation
      const mockClient = new MockNeo4jClient()
      const result = await mockClient.run(QUERIES.getEntityById, { id })
      if (result.records.length === 0) {
        return null
      }
      return this.recordToEntity(result.records[0])
    }
  }

  // =============================================================================
  // Private Methods
  // =============================================================================

  /**
   * Build Cypher query based on options
   */
  private buildQuery(options: Neo4jExtractionOptions): string {
    if (options.entityType) {
      if (options.since) {
        return QUERIES.getEntitiesByTypeUpdatedSince.replace('$label', options.entityType)
      }
      return QUERIES.getEntitiesByType.replace('$label', options.entityType)
    }

    if (options.since) {
      return QUERIES.getEntitiesUpdatedSince
    }

    if (!options.includeUnkeyed) {
      return QUERIES.getEntitiesWithSyncKeys
    }

    return QUERIES.getAllEntities
  }

  /**
   * Build query parameters
   */
  private buildParams(options: Neo4jExtractionOptions): Record<string, unknown> {
    const params: Record<string, unknown> = {
      limit: options.limit ?? this.defaultBatchSize,
    }

    if (options.since) {
      params.since = options.since.toISOString()
    }

    return params
  }

  /**
   * Execute query with retry logic
   */
  private async executeQuery(
    query: string,
    params: Record<string, unknown>
  ): Promise<{ records: Array<{ keys: string[]; _fields: unknown[] }> }> {
    if (!this.client) {
      throw new Error('No Neo4j client configured')
    }

    let lastError: Error | null = null

    for (let attempt = 0; attempt < this.maxRetries; attempt++) {
      try {
        return await this.client.run(query, params)
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error))

        // Check for transient errors
        if (this.isTransientError(lastError)) {
          await this.sleep(100 * Math.pow(2, attempt))
          continue
        }

        throw lastError
      }
    }

    throw new Error(`Query failed after ${this.maxRetries} retries: ${lastError?.message}`)
  }

  /**
   * Execute mock query
   */
  private async executeMock(
    options: Neo4jExtractionOptions
  ): Promise<{ records: Array<{ keys: string[]; _fields: unknown[] }> }> {
    // Generate more mock entities for realistic testing
    const mockClient = new MockNeo4jClient(this.generateMockEntities(50))
    const query = this.buildQuery(options)
    const params = this.buildParams(options)
    return mockClient.run(query, params)
  }

  /**
   * Convert Neo4j record to entity
   */
  private recordToEntity(record: {
    keys: string[]
    _fields: unknown[]
  }): Neo4jEntity {
    const fields = record._fields
    if (!fields || fields.length < 9) {
      throw new Error('Invalid record format')
    }

    const [
      neo4jId,
      title,
      labels,
      createdAt,
      updatedAt,
      version,
      notionId,
      lastSyncTime,
      properties,
    ] = fields

    // Extract entity type from labels
    const entityType: EntityType = this.labelToEntityType(
      Array.isArray(labels) ? labels[0] as string : 'AgentDesign'
    )

    return {
      neo4jId: neo4jId as string,
      title: (title as string) ?? 'Untitled',
      entityType,
      updatedAt: new Date(updatedAt as string),
      createdAt: new Date(createdAt as string),
      version: (version as number) ?? 1,
      properties: (properties as Record<string, unknown>) ?? {},
      syncMetadata: notionId
        ? {
            notionId: notionId as string,
            lastSyncTime: lastSyncTime ? new Date(lastSyncTime as string) : undefined,
          }
        : undefined,
    }
  }

  /**
   * Convert Neo4j label to entity type
   */
  private labelToEntityType(label: string): EntityType {
    const labelMap: Record<string, EntityType> = {
      AgentDesign: 'AgentDesign',
      Task: 'Task',
      Knowledge: 'Knowledge',
      Insight: 'Insight',
      Memory: 'Memory',
      Workflow: 'Workflow',
      Resource: 'Resource',
    }

    return labelMap[label] ?? 'AgentDesign'
  }

  /**
   * Check if error is transient (worth retrying)
   */
  private isTransientError(error: Error): boolean {
    const transientPatterns = [
      'connection',
      'timeout',
      'temporary',
      'unavailable',
      'retry',
    ]

    return transientPatterns.some((pattern) =>
      error.message.toLowerCase().includes(pattern)
    )
  }

  /**
   * Sleep utility
   */
  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms))
  }

  /**
   * Generate mock entities for testing
   */
  private generateMockEntities(count: number = 50): Neo4jEntity[] {
    const entities: Neo4jEntity[] = []
    const now = Date.now()

    for (let i = 0; i < count; i++) {
      const entityType = ENTITY_TYPES[Math.floor(Math.random() * ENTITY_TYPES.length)]
      const hasSyncKey = Math.random() > 0.2 // 80% have sync keys

      entities.push({
        neo4jId: `neo4j-node-${i.toString().padStart(4, '0')}`,
        title: `${entityType} Node ${i}`,
        entityType,
        updatedAt: new Date(now - Math.random() * 86400000 * 7), // Last 7 days
        createdAt: new Date(now - Math.random() * 86400000 * 30), // Last 30 days
        version: Math.floor(Math.random() * 5) + 1,
        properties: {
          status: this.getRandomStatus(),
          confidence: Math.floor(Math.random() * 100),
        },
        syncMetadata: hasSyncKey
          ? {
              notionId: `notion-page-${i.toString().padStart(4, '0')}`,
              lastSyncTime: new Date(now - Math.random() * 86400000 * 3),
            }
          : undefined,
      })
    }

    return entities
  }

  /**
   * Get random status
   */
  private getRandomStatus(): string {
    const statuses = ['active', 'degraded', 'expired', 'superseded', 'deprecated']
    return statuses[Math.floor(Math.random() * statuses.length)]
  }
}

// =============================================================================
// Factory Functions
// =============================================================================

/**
 * Create a Neo4j extractor
 */
export function createNeo4jExtractor(config: {
  client?: Neo4jClient
  defaultBatchSize?: number
} = {}): Neo4jExtractor {
  return new Neo4jExtractor(config)
}

/**
 * Create a mock Neo4j extractor for testing
 */
export function createMockNeo4jExtractor(seedData?: Neo4jEntity[]): Neo4jExtractor {
  // If no seed data, create extractor without client - will use generateMockEntities internally
  if (!seedData) {
    return new Neo4jExtractor({ defaultBatchSize: 100 })
  }
  const mockClient = new MockNeo4jClient(seedData)
  return new Neo4jExtractor({ client: mockClient })
}

// =============================================================================
// Default Export
// =============================================================================

export default Neo4jExtractor