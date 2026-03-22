/**
 * Notion Extractor
 * 
 * Extracts AgentDesign and other entity data from Notion for drift detection.
 * Handles Notion API pagination and rate limiting.
 */

import type {
  EntityType,
  NotionEntity,
  NotionExtractionOptions,
  NotionExtractionResult,
  ExtractionError,
  RateLimiterConfig,
} from './types'
import { ENTITY_TYPES, DEFAULT_NOTION_RATE_LIMITER } from './types'

// =============================================================================
// Configuration
// =============================================================================

const DEFAULT_BATCH_SIZE = 100
const DEFAULT_MAX_RETRIES = 5

// =============================================================================
// Rate Limiter
// =============================================================================

/**
 * Token bucket rate limiter for Notion API
 * Enforces 3 requests per second limit with exponential backoff
 */
export class NotionRateLimiter {
  private tokens: number
  private maxTokens: number
  private refillInterval: number
  private lastRefill: number
  private backoffMs: number
  private maxBackoffMs: number
  private enableBackoff: boolean

  constructor(config: RateLimiterConfig = DEFAULT_NOTION_RATE_LIMITER) {
    this.maxTokens = config.maxRequests
    this.tokens = this.maxTokens
    this.refillInterval = config.intervalMs
    this.lastRefill = Date.now()
    this.backoffMs = config.initialBackoffMs
    this.maxBackoffMs = config.maxBackoffMs
    this.enableBackoff = config.enableBackoff
  }

  /**
   * Acquire a token, waiting if necessary
   */
  async acquire(): Promise<void> {
    // Refill tokens if interval has passed
    this.refill()

    // If we have tokens, use one
    if (this.tokens > 0) {
      this.tokens--
      return
    }

    // No tokens available, wait for refill
    const waitTime = this.refillInterval - (Date.now() - this.lastRefill)
    if (waitTime > 0) {
      await this.sleep(waitTime)
    }

    // Try again
    return this.acquire()
  }

  /**
   * Handle rate limit error with exponential backoff
   */
  async handleRateLimit(): Promise<void> {
    if (!this.enableBackoff) {
      throw new Error('Rate limit exceeded and backoff disabled')
    }

    // Wait with exponential backoff
    await this.sleep(this.backoffMs)

    // Increase backoff for next time
    this.backoffMs = Math.min(this.backoffMs * 2, this.maxBackoffMs)
  }

  /**
   * Reset backoff after successful request
   */
  resetBackoff(): void {
    this.backoffMs = DEFAULT_NOTION_RATE_LIMITER.initialBackoffMs
  }

  /**
   * Refill tokens based on time elapsed
   */
  private refill(): void {
    const now = Date.now()
    const elapsed = now - this.lastRefill

    if (elapsed >= this.refillInterval) {
      // Refill tokens for each interval that has passed
      const intervals = Math.floor(elapsed / this.refillInterval)
      this.tokens = Math.min(this.maxTokens, this.tokens + intervals)
      this.lastRefill = now
    }
  }

  /**
   * Sleep utility
   */
  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms))
  }
}

// =============================================================================
// Notion Client Interface
// =============================================================================

/**
 * Notion API client interface
 * This abstracts the actual Notion SDK for testing/mocking
 */
export interface NotionClient {
  /**
   * Query a Notion database
   */
  queryDatabase(
    databaseId: string,
    options?: {
      filter?: Record<string, unknown>
      sorts?: Array<{ property: string; direction: 'ascending' | 'descending' }>
      start_cursor?: string
      page_size?: number
    }
  ): Promise<{
    results: Array<{
      id: string
      properties: Record<string, unknown>
      created_time: string
      last_edited_time: string
    }>
    has_more: boolean
    next_cursor?: string
  }>

  /**
   * Get a page by ID
   */
  getPage(pageId: string): Promise<{
    id: string
    properties: Record<string, unknown>
    created_time: string
    last_edited_time: string
  }>

  /**
   * Search pages
   */
  search(options?: {
    query?: string
    filter?: { property: 'object'; value: 'page' | 'database' }
    start_cursor?: string
    page_size?: number
  }): Promise<{
    results: Array<{
      id: string
      properties: Record<string, unknown>
      created_time: string
      last_edited_time: string
    }>
    has_more: boolean
    next_cursor?: string
  }>
}

// =============================================================================
// Mock Notion Client
// =============================================================================

/**
 * Mock Notion client for testing
 * Generates realistic test data without actual API calls
 */
export class MockNotionClient implements NotionClient {
  private mockPages: Map<string, NotionEntity> = new Map()

  constructor(seedData: NotionEntity[] = []) {
    // Seed with initial data
    for (const entity of seedData) {
      this.mockPages.set(entity.notionId, entity)
    }
  }

  /**
   * Add mock data
   */
  addMockData(entities: NotionEntity[]): void {
    for (const entity of entities) {
      this.mockPages.set(entity.notionId, entity)
    }
  }

  /**
   * Query mock database
   */
  async queryDatabase(
    databaseId: string,
    options?: {
      filter?: Record<string, unknown>
      sorts?: Array<{ property: string; direction: 'ascending' | 'descending' }>
      start_cursor?: string
      page_size?: number
    }
  ): Promise<{
    results: Array<{
      id: string
      properties: Record<string, unknown>
      created_time: string
      last_edited_time: string
    }>
    has_more: boolean
    next_cursor?: string
  }> {
    await this.simulateNetworkDelay()

    const pageSize = options?.page_size ?? 100
    const startCursor = options?.start_cursor

    // Convert mock pages to API response format
    const allPages = Array.from(this.mockPages.values())
      .filter((entity) => entity.entityType === 'AgentDesign') // Filter by type if needed
      .map((entity) => this.entityToPage(entity))

    // Handle pagination
    const startIndex = startCursor
      ? parseInt(Buffer.from(startCursor, 'base64').toString('utf-8'), 10)
      : 0
    const endIndex = startIndex + pageSize
    const pageResults = allPages.slice(startIndex, endIndex)

    return {
      results: pageResults,
      has_more: endIndex < allPages.length,
      next_cursor: endIndex < allPages.length ? Buffer.from(String(endIndex)).toString('base64') : undefined,
    }
  }

  /**
   * Get mock page by ID
   */
  async getPage(pageId: string): Promise<{
    id: string
    properties: Record<string, unknown>
    created_time: string
    last_edited_time: string
  }> {
    await this.simulateNetworkDelay()

    const entity = this.mockPages.get(pageId)
    if (!entity) {
      throw new Error(`Page not found: ${pageId}`)
    }

    return this.entityToPage(entity)
  }

  /**
   * Search mock pages
   */
  async search(options?: {
    query?: string
    filter?: { property: 'object'; value: 'page' | 'database' }
    start_cursor?: string
    page_size?: number
  }): Promise<{
    results: Array<{
      id: string
      properties: Record<string, unknown>
      created_time: string
      last_edited_time: string
    }>
    has_more: boolean
    next_cursor?: string
  }> {
    await this.simulateNetworkDelay()

    const pageSize = options?.page_size ?? 100
    const startCursor = options?.start_cursor
    const query = options?.query?.toLowerCase()

    // Filter by query if provided
    let filtered = Array.from(this.mockPages.values())
    if (query) {
      filtered = filtered.filter((entity) =>
        entity.title.toLowerCase().includes(query)
      )
    }

    // Convert to API response format
    const allPages = filtered.map((entity) => this.entityToPage(entity))

    // Handle pagination
    const startIndex = startCursor
      ? parseInt(Buffer.from(startCursor, 'base64').toString('utf-8'), 10)
      : 0
    const endIndex = startIndex + pageSize
    const pageResults = allPages.slice(startIndex, endIndex)

    return {
      results: pageResults,
      has_more: endIndex < allPages.length,
      next_cursor: endIndex < allPages.length ? Buffer.from(String(endIndex)).toString('base64') : undefined,
    }
  }

  /**
   * Convert entity to page format
   */
  private entityToPage(entity: NotionEntity): {
    id: string
    properties: Record<string, unknown>
    created_time: string
    last_edited_time: string
  } {
    return {
      id: entity.notionId,
      properties: {
        title: { title: [{ plain_text: entity.title }] },
        entityType: { select: { name: entity.entityType } },
        neo4jId: { rich_text: [{ plain_text: entity.syncMetadata?.neo4jId ?? '' }] },
        lastSyncTime: { date: entity.syncMetadata?.lastSyncTime?.toISOString() ?? null },
        ...entity.properties,
      },
      created_time: entity.createdTime.toISOString(),
      last_edited_time: entity.lastEditedTime.toISOString(),
    }
  }

  /**
   * Simulate network delay
   */
  private async simulateNetworkDelay(): Promise<void> {
    await new Promise((resolve) => setTimeout(resolve, Math.random() * 20 + 5))
  }
}

// =============================================================================
// Notion Extractor
// =============================================================================

/**
 * Notion Extractor
 * 
 * Extracts entity data from Notion for drift detection.
 * Handles rate limiting, pagination, and incremental extraction.
 */
export class NotionExtractor {
  private client: NotionClient | null
  private rateLimiter: NotionRateLimiter
  private defaultBatchSize: number
  private maxRetries: number

  constructor(config: {
    client?: NotionClient
    rateLimiter?: NotionRateLimiter
    defaultBatchSize?: number
    maxRetries?: number
  } = {}) {
    this.client = config.client ?? null
    this.rateLimiter = config.rateLimiter ?? new NotionRateLimiter()
    this.defaultBatchSize = config.defaultBatchSize ?? DEFAULT_BATCH_SIZE
    this.maxRetries = config.maxRetries ?? DEFAULT_MAX_RETRIES
  }

  /**
   * Extract entities from Notion database
   */
  async extract(options: NotionExtractionOptions = {}): Promise<NotionExtractionResult> {
    const startTime = Date.now()
    const errors: ExtractionError[] = []
    const entities: NotionEntity[] = []

    const limit = options.limit ?? this.defaultBatchSize

    try {
      // Extract with rate limiting
      const pages = await this.extractWithRateLimit(options)

      // Convert pages to entities
      for (const page of pages) {
        try {
          const entity = this.pageToEntity(page)
          
          // Filter by entity type if specified
          if (options.entityType && entity.entityType !== options.entityType) {
            continue
          }

          // Filter by timestamp if specified (incremental extraction)
          if (options.since && entity.lastEditedTime < options.since) {
            continue
          }

          // Filter by sync key presence if specified
          if (!options.includeUnkeyed && !entity.syncMetadata?.neo4jId) {
            continue
          }

          entities.push(entity)
        } catch (error) {
          errors.push({
            entityId: page.id,
            message: error instanceof Error ? error.message : 'Failed to parse page',
            code: 'PARSE_ERROR',
            details: { page },
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
      hasMore: false,
      durationMs,
      errors,
    }
  }

  /**
   * Extract with pagination support
   */
  async extractPaginated(
    options: NotionExtractionOptions = {}
  ): Promise<NotionExtractionResult[]> {
    const results: NotionExtractionResult[] = []
    let cursor: string | undefined = options.startCursor

    do {
      const result = await this.extract({ ...options, startCursor: cursor })
      results.push(result)

      if (!result.hasMore) {
        break
      }

      // Update cursor for next page
      // In real implementation, this would come from the API response
      cursor = undefined
    } while (cursor)

    return results
  }

  /**
   * Extract pages with rate limiting
   */
  private async extractWithRateLimit(
    options: NotionExtractionOptions
  ): Promise<Array<{
    id: string
    properties: Record<string, unknown>
    created_time: string
    last_edited_time: string
  }>> {
    if (this.client) {
      // Use real client with rate limiting
      return this.extractFromClient(options)
    } else {
      // Use mock data
      return this.extractFromMock(options)
    }
  }

  /**
   * Extract from real Notion client
   */
  private async extractFromClient(options: NotionExtractionOptions): Promise<Array<{
    id: string
    properties: Record<string, unknown>
    created_time: string
    last_edited_time: string
  }>> {
    if (!this.client) {
      throw new Error('No Notion client configured')
    }

    const pages: Array<{
      id: string
      properties: Record<string, unknown>
      created_time: string
      last_edited_time: string
    }> = []

    let cursor: string | undefined = options.startCursor
    let hasMore = true

    while (hasMore) {
      // Acquire rate limit token
      await this.rateLimiter.acquire()

      try {
        const response = options.databaseId
          ? await this.client.queryDatabase(options.databaseId, {
              start_cursor: cursor,
              page_size: options.limit ?? this.defaultBatchSize,
            })
          : await this.client.search({
              start_cursor: cursor,
              page_size: options.limit ?? this.defaultBatchSize,
            })

        pages.push(...response.results)
        hasMore = response.has_more
        cursor = response.next_cursor

        // Reset backoff on success
        this.rateLimiter.resetBackoff()

        // Stop if we have enough pages
        if (options.limit && pages.length >= options.limit) {
          break
        }
      } catch (error) {
        // Handle rate limit with backoff
        if (error instanceof Error && error.message.includes('rate limit')) {
          await this.rateLimiter.handleRateLimit()
          continue
        }
        throw error
      }
    }

    return pages
  }

  /**
   * Extract from mock data
   */
  private async extractFromMock(options: NotionExtractionOptions): Promise<Array<{
    id: string
    properties: Record<string, unknown>
    created_time: string
    last_edited_time: string
  }>> {
    // Generate mock pages - use a higher count for more realistic testing
    const mockClient = new MockNotionClient(this.generateMockEntities(50))
    const limit = options.limit ?? this.defaultBatchSize

    const response = options.databaseId
      ? await mockClient.queryDatabase(options.databaseId, { page_size: limit })
      : await mockClient.search({ page_size: limit })

    return response.results
  }

  /**
   * Convert Notion page to entity
   */
  private pageToEntity(page: {
    id: string
    properties: Record<string, unknown>
    created_time: string
    last_edited_time: string
  }): NotionEntity {
    const properties = page.properties
    const titleProperty = properties.title as { title?: Array<{ plain_text: string }> } | undefined
    const entityTypeProperty = properties.entityType as { select?: { name: string } } | undefined
    const neo4jIdProperty = properties.neo4jId as { rich_text?: Array<{ plain_text: string }> } | undefined
    const lastSyncTimeProperty = properties.lastSyncTime as { date?: string | null } | undefined

    const title = titleProperty?.title?.[0]?.plain_text ?? 'Untitled'
    const entityType: EntityType = (entityTypeProperty?.select?.name as EntityType) ?? 'AgentDesign'
    const neo4jId = neo4jIdProperty?.rich_text?.[0]?.plain_text
    const lastSyncTime = lastSyncTimeProperty?.date ? new Date(lastSyncTimeProperty.date) : undefined

    return {
      notionId: page.id,
      title,
      entityType,
      lastEditedTime: new Date(page.last_edited_time),
      createdTime: new Date(page.created_time),
      properties,
      versionToken: page.last_edited_time,
      syncMetadata: neo4jId
        ? {
            neo4jId,
            lastSyncTime,
          }
        : undefined,
    }
  }

  /**
   * Generate mock entities for testing
   */
  private generateMockEntities(count: number = 50): NotionEntity[] {
    const entities: NotionEntity[] = []
    const now = Date.now()

    for (let i = 0; i < count; i++) {
      const entityType = ENTITY_TYPES[Math.floor(Math.random() * ENTITY_TYPES.length)]
      const hasSyncKey = Math.random() > 0.3 // 70% have sync keys

      entities.push({
        notionId: `notion-page-${i.toString().padStart(4, '0')}`,
        title: `${entityType} - ${this.getRandomTitle(entityType)}`,
        entityType,
        lastEditedTime: new Date(now - Math.random() * 86400000 * 30), // Last 30 days
        createdTime: new Date(now - Math.random() * 86400000 * 90), // Last 90 days
        properties: {
          status: { select: { name: this.getRandomStatus() } },
          priority: { select: { name: this.getRandomPriority() } },
          tags: { multi_select: [{ name: 'sync' }, { name: 'drift-detection' }] },
        },
        versionToken: new Date(now - Math.random() * 86400000).toISOString(),
        syncMetadata: hasSyncKey
          ? {
              neo4jId: `neo4j-node-${i.toString().padStart(4, '0')}`,
              lastSyncTime: new Date(now - Math.random() * 86400000 * 7),
            }
          : undefined,
      })
    }

    return entities
  }

  /**
   * Get random title by entity type
   */
  private getRandomTitle(entityType: EntityType): string {
    const titles: Record<EntityType, string[]> = {
      AgentDesign: ['Agent Architecture v2', 'Memory System Design', 'Task Orchestration Flow'],
      Task: ['Implement authentication', 'Fix dashboard bug', 'Update documentation'],
      Knowledge: ['API Reference', 'Architecture Overview', 'Deployment Guide'],
      Insight: ['User behavior pattern', 'Performance optimization', 'Security vulnerability'],
      Memory: ['Session 2024-01-15', 'Project context', 'User preferences'],
      Workflow: ['Deployment pipeline', 'CI/CD workflow', 'Release process'],
      Resource: ['Database schema', 'API credentials', 'Configuration file'],
    }

    const options = titles[entityType] ?? ['Untitled']
    return options[Math.floor(Math.random() * options.length)]
  }

  /**
   * Get random status
   */
  private getRandomStatus(): string {
    const statuses = ['active', 'in_progress', 'completed', 'archived', 'deprecated']
    return statuses[Math.floor(Math.random() * statuses.length)]
  }

  /**
   * Get random priority
   */
  private getRandomPriority(): string {
    const priorities = ['low', 'medium', 'high', 'critical']
    return priorities[Math.floor(Math.random() * priorities.length)]
  }
}

// =============================================================================
// Factory Functions
// =============================================================================

/**
 * Create a Notion extractor
 */
export function createNotionExtractor(config: {
  client?: NotionClient
  rateLimiter?: NotionRateLimiter
  defaultBatchSize?: number
} = {}): NotionExtractor {
  return new NotionExtractor(config)
}

/**
 * Create a mock Notion extractor for testing
 */
export function createMockNotionExtractor(seedData?: NotionEntity[]): NotionExtractor {
  // If no seed data, generate mock entities
  if (!seedData) {
    // Create extractor without client - will use generateMockEntities internally
    return new NotionExtractor({ defaultBatchSize: 100 })
  }
  const mockClient = new MockNotionClient(seedData)
  return new NotionExtractor({ client: mockClient })
}

// =============================================================================
// Default Export
// =============================================================================

export default NotionExtractor