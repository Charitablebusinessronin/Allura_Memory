/**
 * Insight Mirror
 * 
 * Mirrors high-confidence insights from Neo4j to Notion knowledge base.
 * Creates structured pages with trace_ref linking back to source evidence.
 */

import type {
  EntityType,
  Neo4jEntity,
  NotionEntity,
  ExtractionError,
} from './types'

// =============================================================================
// Types
// =============================================================================

/**
 * Insight data from Neo4j
 */
export interface InsightNode {
  /** Unique identifier in Neo4j */
  id: string
  
  /** Insight title/summary */
  title: string
  
  /** Detailed description */
  description?: string
  
  /** Confidence score (0.0-1.0) */
  confidence: number
  
  /** Approval status */
  status: 'pending' | 'approved' | 'rejected' | 'archived'
  
  /** Primary topic/category */
  topic?: string
  
  /** Topic key for categorization */
  topicKey?: string
  
  /** Risk level assessment */
  riskLevel?: 'low' | 'medium' | 'high' | 'critical'
  
  /** Source of the insight (agent, system, user) */
  source: string
  
  /** Creation timestamp */
  createdAt: Date
  
  /** Last update timestamp */
  updatedAt?: Date
  
  /** Approval timestamp */
  approvedAt?: Date
  
  /** Associated claims */
  claims?: InsightClaim[]
  
  /** Associated evidence */
  evidence?: InsightEvidence[]
  
  /** Recommended actions */
  actions?: string[]
  
  /** Trace reference to source evidence in PostgreSQL */
  traceRef?: string
  
  /** Notion page ID (if already synced) */
  notionPageId?: string
  
  /** Whether needs re-sync */
  needsReSync?: boolean
  
  /** Additional metadata */
  metadata?: Record<string, unknown>
}

/**
 * Claim associated with an insight
 */
export interface InsightClaim {
  id: string
  text: string
  confidence?: number
  verificationStatus?: 'unverified' | 'verified' | 'disputed'
}

/**
 * Evidence associated with an insight
 */
export interface InsightEvidence {
  id: string
  type: string
  content: string
  source: string
  sourceUrl?: string
  timestamp: Date
  relevanceScore?: 'high' | 'medium' | 'low'
}

/**
 * Notion page content structure
 */
export interface NotionPageContent {
  /** Page title */
  title: string
  
  /** Database properties */
  properties: Record<string, unknown>
  
  /** Page blocks */
  blocks: NotionBlock[]
}

/**
 * Notion block structure
 */
export interface NotionBlock {
  type: string
  [key: string]: unknown
}

/**
 * Mirror configuration
 */
export interface MirrorConfig {
  /** Confidence threshold (default: 0.7) */
  confidenceThreshold: number
  
  /** Only mirror approved insights */
  requireApproval: boolean
  
  /** Batch size for processing */
  batchSize: number
  
  /** Max retries for API calls */
  maxRetries: number
  
  /** Enable dry run (no actual writes) */
  dryRun: boolean
}

/**
 * Mirror result for a single insight
 */
export interface MirrorResult {
  /** Neo4j insight ID */
  insightId: string
  
  /** Created Notion page ID */
  notionPageId?: string
  
  /** Notion page URL */
  notionUrl?: string
  
  /** Success status */
  success: boolean
  
  /** Error message if failed */
  error?: string
  
  /** Trace reference */
  traceRef?: string
  
  /** Sync timestamp */
  syncedAt: Date
}

/**
 * Batch mirror result
 */
export interface BatchMirrorResult {
  /** Total insights processed */
  total: number
  
  /** Successfully mirrored */
  mirrored: number
  
  /** Failed to mirror */
  failed: number
  
  /** Skipped (below threshold or not approved) */
  skipped: number
  
  /** Individual results */
  results: MirrorResult[]
  
  /** Duration in ms */
  durationMs: number
  
  /** Errors */
  errors: ExtractionError[]
}

// =============================================================================
// Default Configuration
// =============================================================================

const DEFAULT_CONFIG: MirrorConfig = {
  confidenceThreshold: 0.7,
  requireApproval: true,
  batchSize: 10,
  maxRetries: 3,
  dryRun: false,
}

// =============================================================================
// Notion Client Interface
// =============================================================================

/**
 * Notion API client interface for creating pages
 */
export interface NotionMirrorClient {
  /**
   * Create a page in a database
   */
  createPage(params: {
    parent: { database_id: string }
    properties: Record<string, unknown>
    children?: NotionBlock[]
  }): Promise<{ id: string; url: string }>

  /**
   * Update a page
   */
  updatePage(params: {
    page_id: string
    properties: Record<string, unknown>
    archived?: boolean
  }): Promise<{ id: string; url: string }>

  /**
   * Query a database
   */
  queryDatabase(params: {
    database_id: string
    filter?: Record<string, unknown>
    sorts?: Array<{ property: string; direction: 'ascending' | 'descending' }>
    start_cursor?: string
    page_size?: number
  }): Promise<{
    results: Array<{ id: string; properties: Record<string, unknown> }>
    has_more: boolean
    next_cursor?: string
  }>

  /**
   * Append blocks to a page
   */
  appendBlocks(params: {
    block_id: string
    children: NotionBlock[]
  }): Promise<{ results: Array<{ id: string }> }>
}

// =============================================================================
// Neo4j Client Interface for Insights
// =============================================================================

/**
 * Neo4j client interface for querying insights
 */
export interface Neo4jInsightClient {
  /**
   * Execute a Cypher query
   */
  run(query: string, params?: Record<string, unknown>): Promise<{
    records: Array<{ keys: string[]; _fields: unknown[] }>
  }>
}

// =============================================================================
// Queries
// =============================================================================

const QUERIES = {
  /**
   * Get high-confidence approved insights
   */
  getHighConfidenceInsights: `
    MATCH (i:Insight)
    WHERE i.confidence >= $confidenceThreshold
      AND i.status = 'approved'
      AND (i.notionPageId IS NULL OR i.needsReSync = true)
    OPTIONAL MATCH (i)-[:HAS_CLAIM]->(c:Claim)
    OPTIONAL MATCH (i)-[:HAS_EVIDENCE]->(e:Evidence)
    WITH i, 
      collect(DISTINCT {id: c.id, text: c.text, confidence: c.confidence, verificationStatus: c.verificationStatus}) AS claims,
      collect(DISTINCT {id: e.id, type: e.type, content: e.content, source: e.source, sourceUrl: e.sourceUrl, timestamp: e.timestamp, relevanceScore: e.relevanceScore}) AS evidence
    RETURN 
      i.id AS id,
      i.title AS title,
      i.description AS description,
      i.confidence AS confidence,
      i.status AS status,
      i.topic AS topic,
      i.topicKey AS topicKey,
      i.risk AS riskLevel,
      i.source AS source,
      i.createdAt AS createdAt,
      i.updatedAt AS updatedAt,
      i.approvedAt AS approvedAt,
      i.traceRef AS traceRef,
      i.notionPageId AS notionPageId,
      i.needsReSync AS needsReSync,
      claims,
      evidence
    ORDER BY i.confidence DESC, i.approvedAt DESC
    LIMIT $limit
  `,

  /**
   * Get insight by ID
   */
  getInsightById: `
    MATCH (i:Insight {id: $id})
    OPTIONAL MATCH (i)-[:HAS_CLAIM]->(c:Claim)
    OPTIONAL MATCH (i)-[:HAS_EVIDENCE]->(e:Evidence)
    WITH i,
      collect(DISTINCT {id: c.id, text: c.text, confidence: c.confidence, verificationStatus: c.verificationStatus}) AS claims,
      collect(DISTINCT {id: e.id, type: e.type, content: e.content, source: e.source, sourceUrl: e.sourceUrl, timestamp: e.timestamp, relevanceScore: e.relevanceScore}) AS evidence
    RETURN 
      i.id AS id,
      i.title AS title,
      i.description AS description,
      i.confidence AS confidence,
      i.status AS status,
      i.topic AS topic,
      i.topicKey AS topicKey,
      i.risk AS riskLevel,
      i.source AS source,
      i.createdAt AS createdAt,
      i.updatedAt AS updatedAt,
      i.approvedAt AS approvedAt,
      i.traceRef AS traceRef,
      i.notionPageId AS notionPageId,
      claims,
      evidence
  `,

  /**
   * Update insight with Notion page ID
   */
  updateInsightNotionId: `
    MATCH (i:Insight {id: $id})
    SET i.notionPageId = $notionPageId,
        i.notionUrl = $notionUrl,
        i.lastSyncedAt = datetime($syncedAt),
        i.needsReSync = false
    RETURN i.id AS id
  `,

  /**
   * Get recently updated insights for re-sync
   */
  getUpdatedInsights: `
    MATCH (i:Insight)
    WHERE i.confidence >= $confidenceThreshold
      AND i.status = 'approved'
      AND i.notionPageId IS NOT NULL
      AND i.updatedAt > i.lastSyncedAt
    RETURN 
      i.id AS id,
      i.notionPageId AS notionPageId
    LIMIT $limit
  `,
}

// =============================================================================
// Mock Clients
// =============================================================================

/**
 * Mock Notion client for testing
 */
export class MockNotionMirrorClient implements NotionMirrorClient {
  private pages: Map<string, { id: string; url: string; properties: Record<string, unknown> }> = new Map()
  private databaseId: string

  constructor(databaseId: string = 'test-database-id') {
    this.databaseId = databaseId
  }

  async createPage(params: {
    parent: { database_id: string }
    properties: Record<string, unknown>
    children?: NotionBlock[]
  }): Promise<{ id: string; url: string }> {
    await this.simulateNetworkDelay()
    
    const id = `notion-page-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
    const url = `https://notion.so/${id.replace(/-/g, '')}`
    
    this.pages.set(id, { id, url, properties: params.properties })
    
    return { id, url }
  }

  async updatePage(params: {
    page_id: string
    properties: Record<string, unknown>
    archived?: boolean
  }): Promise<{ id: string; url: string }> {
    await this.simulateNetworkDelay()
    
    const existing = this.pages.get(params.page_id)
    if (!existing) {
      throw new Error(`Page not found: ${params.page_id}`)
    }
    
    existing.properties = { ...existing.properties, ...params.properties }
    return { id: existing.id, url: existing.url }
  }

  async queryDatabase(params: {
    database_id: string
    filter?: Record<string, unknown>
    sorts?: Array<{ property: string; direction: 'ascending' | 'descending' }>
    start_cursor?: string
    page_size?: number
  }): Promise<{
    results: Array<{ id: string; properties: Record<string, unknown> }>
    has_more: boolean
    next_cursor?: string
  }> {
    await this.simulateNetworkDelay()
    
    const results = Array.from(this.pages.entries()).map(([id, page]) => ({
      id,
      properties: page.properties,
    }))
    
    return {
      results,
      has_more: false,
    }
  }

  async appendBlocks(params: {
    block_id: string
    children: NotionBlock[]
  }): Promise<{ results: Array<{ id: string }> }> {
    await this.simulateNetworkDelay()
    
    return {
      results: params.children.map(() => ({
        id: `block-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      })),
    }
  }

  private async simulateNetworkDelay(): Promise<void> {
    await new Promise((resolve) => setTimeout(resolve, Math.random() * 20 + 5))
  }
}

/**
 * Mock Neo4j client for testing
 */
export class MockNeo4jInsightClient implements Neo4jInsightClient {
  private insights: Map<string, InsightNode> = new Map()

  constructor(seedData: InsightNode[] = []) {
    for (const insight of seedData) {
      this.insights.set(insight.id, insight)
    }
  }

  addInsight(insight: InsightNode): void {
    this.insights.set(insight.id, insight)
  }

  async run(query: string, params?: Record<string, unknown>): Promise<{
    records: Array<{ keys: string[]; _fields: unknown[] }>
  }> {
    await this.simulateNetworkDelay()

    if (query.includes('getHighConfidenceInsights') || query.includes('MATCH (i:Insight)')) {
      const confidenceThreshold = (params?.confidenceThreshold as number) ?? 0.7
      const limit = (params?.limit as number) ?? 100

      const filtered = Array.from(this.insights.values())
        .filter((i) => i.confidence >= confidenceThreshold && i.status === 'approved')
        .slice(0, limit)

      const records = filtered.map((insight) => ({
        keys: ['id', 'title', 'description', 'confidence', 'status', 'topic', 'topicKey', 'riskLevel', 'source', 'createdAt', 'updatedAt', 'approvedAt', 'traceRef', 'notionPageId', 'claims', 'evidence'],
        _fields: [
          insight.id,
          insight.title,
          insight.description ?? null,
          insight.confidence,
          insight.status,
          insight.topic ?? null,
          insight.topicKey ?? null,
          insight.riskLevel ?? null,
          insight.source,
          insight.createdAt.toISOString(),
          insight.updatedAt?.toISOString() ?? null,
          insight.approvedAt?.toISOString() ?? null,
          insight.traceRef ?? null,
          null,
          insight.claims ?? [],
          insight.evidence ?? [],
        ],
      }))

      return { records }
    }

    if (query.includes('updateInsightNotionId')) {
      const id = params?.id as string
      const notionPageId = params?.notionPageId as string
      const notionUrl = params?.notionUrl as string

      const insight = this.insights.get(id)
      if (insight) {
        (insight as any).notionPageId = notionPageId
        ;(insight as any).notionUrl = notionUrl
        ;(insight as any).lastSyncedAt = new Date(params?.syncedAt as string)
      }

      return { records: [{ keys: ['id'], _fields: [id] }] }
    }

    return { records: [] }
  }

  private async simulateNetworkDelay(): Promise<void> {
    await new Promise((resolve) => setTimeout(resolve, Math.random() * 10 + 2))
  }
}

// =============================================================================
// Insight Mirror Class
// =============================================================================

/**
 * Insight Mirror
 * 
 * Mirrors high-confidence approved insights from Neo4j to Notion.
 * Creates structured pages with trace_ref linking to source evidence.
 */
export class InsightMirror {
  private notionClient: NotionMirrorClient | null
  private neo4jClient: Neo4jInsightClient | null
  private config: MirrorConfig
  private databaseId: string

  constructor(config: Partial<MirrorConfig> & {
    notionClient?: NotionMirrorClient
    neo4jClient?: Neo4jInsightClient
    databaseId?: string
  } = {}) {
    this.notionClient = config.notionClient ?? null
    this.neo4jClient = config.neo4jClient ?? null
    this.config = { ...DEFAULT_CONFIG, ...config }
    this.databaseId = config.databaseId ?? process.env.NOTION_INSIGHTS_DATABASE_ID ?? 'insights-database'
  }

  /**
   * Mirror high-confidence approved insights to Notion
   */
  async mirrorInsights(options: {
    confidenceThreshold?: number
    requireApproval?: boolean
    limit?: number
  } = {}): Promise<BatchMirrorResult> {
    const startTime = Date.now()
    const errors: ExtractionError[] = []
    const results: MirrorResult[] = []

    const confidenceThreshold = options.confidenceThreshold ?? this.config.confidenceThreshold
    const requireApproval = options.requireApproval ?? this.config.requireApproval
    const limit = options.limit ?? this.config.batchSize

    try {
      // Step 1: Fetch high-confidence insights from Neo4j
      const insights = await this.fetchHighConfidenceInsights(confidenceThreshold, limit)

      // Step 2: Process each insight
      for (const insight of insights) {
        try {
          // Check if already synced
          if (insight.notionPageId && !insight.needsReSync) {
            results.push({
              insightId: insight.id,
              success: false,
              error: 'Already synced',
              syncedAt: new Date(),
            })
            continue
          }

          // Mirror to Notion
          const result = await this.mirrorInsight(insight)
          results.push(result)
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : 'Unknown error'
          errors.push({
            entityId: insight.id,
            message: errorMessage,
            code: 'MIRROR_ERROR',
          })
          results.push({
            insightId: insight.id,
            success: false,
            error: errorMessage,
            syncedAt: new Date(),
          })
        }
      }
    } catch (error) {
      errors.push({
        message: error instanceof Error ? error.message : 'Unknown error',
        code: 'FETCH_ERROR',
      })
    }

    const durationMs = Date.now() - startTime
    const mirrored = results.filter((r) => r.success).length
    const failed = results.filter((r) => !r.success && r.error !== 'Already synced').length
    const skipped = results.filter((r) => r.error === 'Already synced').length

    return {
      total: results.length,
      mirrored,
      failed,
      skipped,
      results,
      durationMs,
      errors,
    }
  }

  /**
   * Mirror a single insight to Notion
   */
  async mirrorInsight(insight: InsightNode): Promise<MirrorResult> {
    const syncedAt = new Date()

    if (this.config.dryRun) {
      return {
        insightId: insight.id,
        notionPageId: `dry-run-${insight.id}`,
        notionUrl: `https://notion.so/dry-run/${insight.id}`,
        success: true,
        traceRef: insight.traceRef,
        syncedAt,
      }
    }

    // Generate page content
    const pageContent = this.generatePageContent(insight)

    // Create Notion page
    if (!this.notionClient) {
      throw new Error('No Notion client configured')
    }

    const page = await this.notionClient.createPage({
      parent: { database_id: this.databaseId },
      properties: pageContent.properties,
      children: pageContent.blocks,
    })

    // Update Neo4j with Notion page ID
    await this.updateInsightWithNotionId(insight.id, page.id, page.url, syncedAt)

    return {
      insightId: insight.id,
      notionPageId: page.id,
      notionUrl: page.url,
      success: true,
      traceRef: insight.traceRef,
      syncedAt,
    }
  }

  /**
   * Fetch high-confidence insights from Neo4j
   */
  private async fetchHighConfidenceInsights(
    confidenceThreshold: number,
    limit: number
  ): Promise<InsightNode[]> {
    if (this.neo4jClient) {
      const result = await this.neo4jClient.run(QUERIES.getHighConfidenceInsights, {
        confidenceThreshold,
        limit,
      })

      return result.records.map((record) => this.recordToInsight(record))
    } else {
      // Generate mock data
      return this.generateMockInsights(confidenceThreshold, limit)
    }
  }

  /**
   * Update insight with Notion page ID in Neo4j
   */
  private async updateInsightWithNotionId(
    insightId: string,
    notionPageId: string,
    notionUrl: string,
    syncedAt: Date
  ): Promise<void> {
    if (this.neo4jClient) {
      await this.neo4jClient.run(QUERIES.updateInsightNotionId, {
        id: insightId,
        notionPageId,
        notionUrl,
        syncedAt: syncedAt.toISOString(),
      })
    }
    // For mock, we don't need to do anything
  }

  /**
   * Generate Notion page content from insight
   */
  private generatePageContent(insight: InsightNode): NotionPageContent {
    const properties: Record<string, unknown> = {
      Title: {
        title: [{ text: { content: insight.title } }],
      },
      Confidence: {
        number: insight.confidence,
      },
      Status: {
        select: { name: insight.status },
      },
      'Neo4j ID': {
        rich_text: [{ text: { content: insight.id } }],
      },
      'Created At': {
        date: { start: insight.createdAt.toISOString() },
      },
      'Synced At': {
        date: { start: new Date().toISOString() },
      },
    }

    if (insight.topic) {
      properties.Topic = { select: { name: insight.topic } }
    }

    if (insight.riskLevel) {
      properties['Risk Level'] = { select: { name: insight.riskLevel } }
    }

    if (insight.source) {
      properties.Source = { rich_text: [{ text: { content: insight.source } }] }
    }

    if (insight.approvedAt) {
      properties['Approved At'] = { date: { start: insight.approvedAt.toISOString() } }
    }

    if (insight.traceRef) {
      properties['Trace Ref'] = { url: insight.traceRef }
    }

    const blocks: NotionBlock[] = [
      // Summary section
      {
        type: 'heading_1',
        heading_1: { rich_text: [{ text: { content: 'Insight Summary' } }] },
      },
      {
        type: 'paragraph',
        paragraph: {
          rich_text: [{
            text: { content: insight.description ?? insight.title },
          }],
        },
      },
      {
        type: 'callout',
        callout: {
          icon: { emoji: '💡' },
          rich_text: [{
            text: {
              content: `This insight was automatically generated and approved based on evidence analysis with ${(insight.confidence * 100).toFixed(0)}% confidence.`,
            },
          }],
        },
      },
      { type: 'divider', divider: {} },
    ]

    // Claims section
    if (insight.claims && insight.claims.length > 0) {
      blocks.push({
        type: 'heading_2',
        heading_2: { rich_text: [{ text: { content: 'Claims' } }] },
      })
      
      for (const claim of insight.claims) {
        blocks.push({
          type: 'bulleted_list_item',
          bulleted_list_item: {
            rich_text: [{
              text: { content: claim.text },
            }],
          },
        })
      }
    }

    // Actions section
    if (insight.actions && insight.actions.length > 0) {
      blocks.push({ type: 'divider', divider: {} })
      blocks.push({
        type: 'heading_2',
        heading_2: { rich_text: [{ text: { content: 'Recommended Actions' } }] },
      })
      
      for (const action of insight.actions) {
        blocks.push({
          type: 'numbered_list_item',
          numbered_list_item: {
            rich_text: [{ text: { content: action } }],
          },
        })
      }
    }

    // Evidence trail section
    if (insight.traceRef) {
      blocks.push({ type: 'divider', divider: {} })
      blocks.push({
        type: 'heading_2',
        heading_2: { rich_text: [{ text: { content: 'Evidence Trail' } }] },
      })
      blocks.push({
        type: 'paragraph',
        paragraph: {
          rich_text: [{
            text: { content: 'Source Evidence: ', link: { url: insight.traceRef } },
          }],
        },
      })
    }

    // Sync metadata
    blocks.push({ type: 'divider', divider: {} })
    blocks.push({
      type: 'heading_2',
      heading_2: { rich_text: [{ text: { content: 'Sync Metadata' } }] },
    })
    blocks.push({
      type: 'code',
      code: {
        language: 'json',
        rich_text: [{
          text: {
            content: JSON.stringify({
              neo4jId: insight.id,
              confidence: insight.confidence,
              status: insight.status,
              syncedAt: new Date().toISOString(),
            }, null, 2),
          },
        }],
      },
    })

    return {
      title: insight.title,
      properties,
      blocks,
    }
  }

  /**
   * Convert Neo4j record to InsightNode
   */
  private recordToInsight(record: { keys: string[]; _fields: unknown[] }): InsightNode {
    const fields = record._fields
    if (!fields || fields.length < 16) {
      throw new Error('Invalid record format')
    }

    const [
      id,
      title,
      description,
      confidence,
      status,
      topic,
      topicKey,
      riskLevel,
      source,
      createdAt,
      updatedAt,
      approvedAt,
      traceRef,
      notionPageId,
      claims,
      evidence,
    ] = fields

    return {
      id: id as string,
      title: title as string,
      description: description as string | undefined,
      confidence: confidence as number,
      status: status as InsightNode['status'],
      topic: topic as string | undefined,
      topicKey: topicKey as string | undefined,
      riskLevel: riskLevel as InsightNode['riskLevel'],
      source: source as string,
      createdAt: new Date(createdAt as string),
      updatedAt: updatedAt ? new Date(updatedAt as string) : undefined,
      approvedAt: approvedAt ? new Date(approvedAt as string) : undefined,
      traceRef: traceRef as string | undefined,
      claims: (claims as InsightClaim[]) ?? undefined,
      evidence: (evidence as InsightEvidence[]) ?? undefined,
      metadata: { notionPageId },
    }
  }

  /**
   * Generate mock insights for testing
   */
  private generateMockInsights(confidenceThreshold: number, limit: number): InsightNode[] {
    const insights: InsightNode[] = []
    const now = Date.now()

    for (let i = 0; i < limit; i++) {
      const confidence = confidenceThreshold + (Math.random() * (1 - confidenceThreshold))
      
      insights.push({
        id: `insight-${i.toString().padStart(4, '0')}`,
        title: `High-Confidence Insight ${i}`,
        description: `This is a generated insight with ${(confidence * 100).toFixed(0)}% confidence based on evidence analysis.`,
        confidence,
        status: 'approved',
        topic: ['Performance', 'Security', 'Architecture', 'User Behavior'][i % 4],
        riskLevel: ['low', 'medium', 'high'][Math.floor(Math.random() * 3)] as InsightNode['riskLevel'],
        source: ['agent', 'system', 'analysis'][i % 3],
        createdAt: new Date(now - Math.random() * 86400000 * 30),
        approvedAt: new Date(now - Math.random() * 86400000 * 7),
        traceRef: `postgresql://evidence/event-${i}`,
        claims: [
          {
            id: `claim-${i}-1`,
            text: `Claim derived from evidence analysis ${i}`,
            confidence: confidence - 0.05,
            verificationStatus: 'verified',
          },
        ],
        actions: [
          'Review evidence trail',
          'Validate claims with additional data',
          'Implement recommended changes',
        ],
      })
    }

    return insights
  }
}

// =============================================================================
// Factory Functions
// =============================================================================

/**
 * Create an insight mirror
 */
export function createInsightMirror(config: Partial<MirrorConfig> & {
  notionClient?: NotionMirrorClient
  neo4jClient?: Neo4jInsightClient
  databaseId?: string
} = {}): InsightMirror {
  return new InsightMirror(config)
}

/**
 * Create a mock insight mirror for testing
 */
export function createMockInsightMirror(
  seedData?: InsightNode[],
  databaseId?: string
): { mirror: InsightMirror; notionClient: MockNotionMirrorClient; neo4jClient: MockNeo4jInsightClient } {
  const notionClient = new MockNotionMirrorClient(databaseId)
  const neo4jClient = new MockNeo4jInsightClient(seedData)
  
  const mirror = new InsightMirror({
    notionClient,
    neo4jClient,
    databaseId,
  })

  return { mirror, notionClient, neo4jClient }
}

// =============================================================================
// Default Export
// =============================================================================

export default InsightMirror