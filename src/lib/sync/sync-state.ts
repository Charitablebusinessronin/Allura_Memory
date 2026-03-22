/**
 * Sync State
 * 
 * Tracks which insights have been mirrored to Notion and their sync status.
 * Enables drift detection and re-sync capabilities.
 */

import type { EntityType, ExtractionError } from './types'

// =============================================================================
// Types
// =============================================================================

/**
 * Sync state for a single entity
 */
export interface SyncState {
  /** Entity ID (Neo4j or Notion) */
  entityId: string
  
  /** Entity type */
  entityType: EntityType
  
  /** Notion page ID */
  notionPageId: string
  
  /** Notion page URL */
  notionUrl: string
  
  /** Neo4j node ID */
  neo4jId: string
  
  /** Trace reference to source evidence */
  traceRef?: string
  
  /** Last sync timestamp */
  lastSyncedAt: Date
  
  /** Sync version for optimistic locking */
  syncVersion: number
  
  /** Sync status */
  status: SyncStatus
  
  /** Error message if failed */
  error?: string
  
  /** Number of sync attempts */
  attemptCount: number
  
  /** Created timestamp */
  createdAt: Date
  
  /** Updated timestamp */
  updatedAt: Date
}

/**
 * Sync status
 */
export type SyncStatus =
  | 'synced'      // Successfully synced
  | 'pending'     // Sync in progress
  | 'failed'     // Sync failed
  | 'stale'      // Needs re-sync
  | 'conflict'   // Conflict detected

/**
 * Sync state query options
 */
export interface SyncStateQuery {
  /** Filter by entity type */
  entityType?: EntityType
  
  /** Filter by status */
  status?: SyncStatus
  
  /** Filter by date range */
  syncedAfter?: Date
  syncedBefore?: Date
  
  /** Include trace refs */
  includeTraceRefs?: boolean
  
  /** Pagination cursor */
  cursor?: string
  
  /** Page size */
  limit?: number
}

/**
 * Sync state result
 */
export interface SyncStateResult {
  /** Sync states */
  states: SyncState[]
  
  /** Total count */
  total: number
  
  /** Has more results */
  hasMore: boolean
  
  /** Next cursor */
  nextCursor?: string
  
  /** Query duration */
  durationMs: number
}

/**
 * Sync statistics
 */
export interface SyncStatistics {
  /** Total synced entities */
  totalSynced: number
  
  /** Total pending */
  totalPending: number
  
  /** Total failed */
  totalFailed: number
  
  /** Total stale */
  totalStale: number
  
  /** Total conflicts */
  totalConflicts: number
  
  /** By entity type */
  byType: Record<EntityType, {
    synced: number
    pending: number
    failed: number
    stale: number
    conflict: number
  }>
  
  /** Average sync latency */
  avgSyncLatencyMs: number
  
  /** Last sync timestamp */
  lastSyncAt?: Date
  
  /** Drift count (entities needing re-sync) */
  driftCount: number
}

/**
 * Sync drift detection result
 */
export interface SyncDriftResult {
  /** Entity ID */
  entityId: string
  
  /** Entity type */
  entityType: EntityType
  
  /** Drift type */
  driftType: 'missing_notion' | 'missing_neo4j' | 'timestamp_mismatch' | 'content_mismatch'
  
  /** Current state */
  currentState: SyncState | null
  
  /** Expected state */
  expectedState: Partial<SyncState>
  
  /** Detected at */
  detectedAt: Date
  
  /** Severity (0-100) */
  severity: number
  
  /** Recommended action */
  recommendedAction: 'sync_to_notion' | 'sync_to_neo4j' | 'manual_review'
}

/**
 * Sync state configuration
 */
export interface SyncStateConfig {
  /** Neo4j client */
  neo4jClient?: Neo4jStateClient
  
  /** Batch size for queries */
  batchSize?: number
  
  /** Max retry attempts */
  maxRetries?: number
  
  /** Enable caching */
  enableCache?: boolean
  
  /** Cache TTL in seconds */
  cacheTtlSeconds?: number
  
  /** Stale threshold in ms */
  staleThresholdMs?: number
}

/**
 * Neo4j client interface for sync state
 */
export interface Neo4jStateClient {
  /**
   * Execute a Cypher query
   */
  run(query: string, params?: Record<string, unknown>): Promise<{
    records: Array<{ keys: string[]; _fields: unknown[] }>
  }>
}

// =============================================================================
// Default Configuration
// =============================================================================

const DEFAULT_CONFIG: Required<Omit<SyncStateConfig, 'neo4jClient'>> = {
  batchSize: 100,
  maxRetries: 3,
  enableCache: true,
  cacheTtlSeconds: 300, // 5 minutes
  staleThresholdMs: 3600000, // 1 hour
}

// =============================================================================
// Queries
// =============================================================================

const QUERIES = {
  /**
   * Get sync state by entity ID
   */
  getSyncStateById: `
    MATCH (s:SyncState {entityId: $entityId})
    RETURN 
      s.entityId AS entityId,
      s.entityType AS entityType,
      s.notionPageId AS notionPageId,
      s.notionUrl AS notionUrl,
      s.neo4jId AS neo4jId,
      s.traceRef AS traceRef,
      s.lastSyncedAt AS lastSyncedAt,
      s.syncVersion AS syncVersion,
      s.status AS status,
      s.error AS error,
      s.attemptCount AS attemptCount,
      s.createdAt AS createdAt,
      s.updatedAt AS updatedAt
    LIMIT 1
  `,

  /**
   * Get all sync states
   */
  getAllSyncStates: `
    MATCH (s:SyncState)
    WHERE ($entityType IS NULL OR s.entityType = $entityType)
      AND ($status IS NULL OR s.status = $status)
    RETURN 
      s.entityId AS entityId,
      s.entityType AS entityType,
      s.notionPageId AS notionPageId,
      s.notionUrl AS notionUrl,
      s.neo4jId AS neo4jId,
      s.traceRef AS traceRef,
      s.lastSyncedAt AS lastSyncedAt,
      s.syncVersion AS syncVersion,
      s.status AS status,
      s.error AS error,
      s.attemptCount AS attemptCount,
      s.createdAt AS createdAt,
      s.updatedAt AS updatedAt
    ORDER BY s.lastSyncedAt DESC
    SKIP $skip
    LIMIT $limit
  `,

  /**
   * Create or update sync state
   */
  upsertSyncState: `
    MERGE (s:SyncState {entityId: $entityId})
    ON CREATE SET
      s.entityType = $entityType,
      s.notionPageId = $notionPageId,
      s.notionUrl = $notionUrl,
      s.neo4jId = $neo4jId,
      s.traceRef = $traceRef,
      s.lastSyncedAt = datetime($lastSyncedAt),
      s.syncVersion = 1,
      s.status = $status,
      s.error = $error,
      s.attemptCount = 0,
      s.createdAt = datetime(),
      s.updatedAt = datetime()
    ON MATCH SET
      s.notionPageId = $notionPageId,
      s.notionUrl = $notionUrl,
      s.neo4jId = $neo4jId,
      s.traceRef = $traceRef,
      s.lastSyncedAt = datetime($lastSyncedAt),
      s.syncVersion = s.syncVersion + 1,
      s.status = $status,
      s.error = $error,
      s.attemptCount = s.attemptCount + 1,
      s.updatedAt = datetime()
    RETURN s.entityId AS entityId
  `,

  /**
   * Update sync status
   */
  updateSyncStatus: `
    MATCH (s:SyncState {entityId: $entityId})
    SET s.status = $status,
        s.error = $error,
        s.updatedAt = datetime()
    RETURN s.entityId AS entityId
  `,

  /**
   * Delete sync state
   */
  deleteSyncState: `
    MATCH (s:SyncState {entityId: $entityId})
    DELETE s
    RETURN count(s) AS deleted
  `,

  /**
   * Get sync statistics
   */
  getSyncStatistics: `
    MATCH (s:SyncState)
    WITH 
      count(s) AS total,
      sum(CASE WHEN s.status = 'synced' THEN 1 ELSE 0 END) AS synced,
      sum(CASE WHEN s.status = 'pending' THEN 1 ELSE 0 END) AS pending,
      sum(CASE WHEN s.status = 'failed' THEN 1 ELSE 0 END) AS failed,
      sum(CASE WHEN s.status = 'stale' THEN 1 ELSE 0 END) AS stale,
      sum(CASE WHEN s.status = 'conflict' THEN 1 ELSE 0 END) AS conflict,
      max(s.lastSyncedAt) AS lastSyncAt,
      avg(duration.between(s.createdAt, s.lastSyncedAt).milliseconds) AS avgLatency
    RETURN 
      total, synced, pending, failed, stale, conflict, lastSyncAt, avgLatency
  `,

  /**
   * Get sync states by Notion page ID
   */
  getSyncStateByNotionId: `
    MATCH (s:SyncState {notionPageId: $notionPageId})
    RETURN 
      s.entityId AS entityId,
      s.entityType AS entityType,
      s.notionPageId AS notionPageId,
      s.notionUrl AS notionUrl,
      s.neo4jId AS neo4jId,
      s.traceRef AS traceRef,
      s.lastSyncedAt AS lastSyncedAt,
      s.syncVersion AS syncVersion,
      s.status AS status,
      s.error AS error,
      s.attemptCount AS attemptCount,
      s.createdAt AS createdAt,
      s.updatedAt AS updatedAt
    LIMIT 1
  `,

  /**
   * Get stale sync states (need re-sync)
   */
  getStaleSyncStates: `
    MATCH (s:SyncState)
    WHERE s.lastSyncedAt < datetime($threshold)
      AND s.status = 'synced'
    RETURN 
      s.entityId AS entityId,
      s.entityType AS entityType,
      s.notionPageId AS notionPageId,
      s.notionUrl AS notionUrl,
      s.neo4jId AS neo4jId,
      s.traceRef AS traceRef,
      s.lastSyncedAt AS lastSyncedAt,
      s.syncVersion AS syncVersion,
      s.status AS status,
      s.error AS error,
      s.attemptCount AS attemptCount,
      s.createdAt AS createdAt,
      s.updatedAt AS updatedAt
    ORDER BY s.lastSyncedAt ASC
    LIMIT $limit
  `,

  /**
   * Count sync states by type
   */
  countByType: `
    MATCH (s:SyncState)
    WHERE s.entityType = $entityType
    RETURN 
      count(s) AS total,
      sum(CASE WHEN s.status = 'synced' THEN 1 ELSE 0 END) AS synced,
      sum(CASE WHEN s.status = 'pending' THEN 1 ELSE 0 END) AS pending,
      sum(CASE WHEN s.status = 'failed' THEN 1 ELSE 0 END) AS failed,
      sum(CASE WHEN s.status = 'stale' THEN 1 ELSE 0 END) AS stale,
      sum(CASE WHEN s.status = 'conflict' THEN 1 ELSE 0 END) AS conflict
  `,
}

// =============================================================================
// Mock Neo4j Client
// =============================================================================

/**
 * Mock Neo4j client for testing
 */
export class MockNeo4jStateClient implements Neo4jStateClient {
  private states: Map<string, SyncState> = new Map()

  constructor(seedData: SyncState[] = []) {
    for (const state of seedData) {
      this.states.set(state.entityId, state)
    }
  }

  addState(state: SyncState): void {
    this.states.set(state.entityId, state)
  }

  async run(query: string, params?: Record<string, unknown>): Promise<{
    records: Array<{ keys: string[]; _fields: unknown[] }>
  }> {
    await this.simulateNetworkDelay()

    if (query.includes('MERGE (s:SyncState')) {
      const entityId = params?.entityId as string
      const existing = this.states.get(entityId)
      
      const state: SyncState = {
        entityId,
        entityType: (params?.entityType as EntityType) ?? 'Insight',
        notionPageId: params?.notionPageId as string,
        notionUrl: params?.notionUrl as string,
        neo4jId: params?.neo4jId as string,
        traceRef: params?.traceRef as string | undefined,
        lastSyncedAt: new Date(params?.lastSyncedAt as string),
        syncVersion: existing ? existing.syncVersion + 1 : 1,
        status: (params?.status as SyncStatus) ?? 'synced',
        error: params?.error as string | undefined,
        attemptCount: existing ? existing.attemptCount + 1 : 0,
        createdAt: existing?.createdAt ?? new Date(),
        updatedAt: new Date(),
      }
      
      this.states.set(entityId, state)
      
      return { records: [{ keys: ['entityId'], _fields: [entityId] }] }
    }

    if (query.includes('MATCH (s:SyncState {entityId:')) {
      const entityId = params?.entityId as string
      const state = this.states.get(entityId)
      
      if (!state) {
        return { records: [] }
      }
      
      return {
        records: [this.stateToRecord(state)],
      }
    }

    if (query.includes('MATCH (s:SyncState {notionPageId:')) {
      const notionPageId = params?.notionPageId as string
      
      const statesArray = Array.from(this.states.values())
      for (const state of statesArray) {
        if (state.notionPageId === notionPageId) {
          return { records: [this.stateToRecord(state)] }
        }
      }
      
      return { records: [] }
    }

    if (query.includes('DELETE s')) {
      const entityId = params?.entityId as string
      this.states.delete(entityId)
      return { records: [{ keys: ['deleted'], _fields: [1] }] }
    }

    if (query.includes('MATCH (s:SyncState)')) {
      const entityType = params?.entityType as EntityType | undefined
      const status = params?.status as SyncStatus | undefined
      const skip = (params?.skip as number) ?? 0
      const limit = (params?.limit as number) ?? 100

      let filtered = Array.from(this.states.values())
      
      if (entityType) {
        filtered = filtered.filter((s) => s.entityType === entityType)
      }
      
      if (status) {
        filtered = filtered.filter((s) => s.status === status)
      }
      
      filtered = filtered.slice(skip, skip + limit)
      
      return { records: filtered.map((s) => this.stateToRecord(s)) }
    }

    if (query.includes('count(s)')) {
      const entityType = params?.entityType as EntityType | undefined
      
      let filtered = Array.from(this.states.values())
      if (entityType) {
        filtered = filtered.filter((s) => s.entityType === entityType)
      }
      
      const total = filtered.length
      const synced = filtered.filter((s) => s.status === 'synced').length
      const pending = filtered.filter((s) => s.status === 'pending').length
      const failed = filtered.filter((s) => s.status === 'failed').length
      const stale = filtered.filter((s) => s.status === 'stale').length
      const conflict = filtered.filter((s) => s.status === 'conflict').length
      
      return {
        records: [{
          keys: ['total', 'synced', 'pending', 'failed', 'stale', 'conflict', 'lastSyncAt', 'avgLatency'],
          _fields: [total, synced, pending, failed, stale, conflict, null, 0],
        }],
      }
    }

    return { records: [] }
  }

  private stateToRecord(state: SyncState): { keys: string[]; _fields: unknown[] } {
    return {
      keys: ['entityId', 'entityType', 'notionPageId', 'notionUrl', 'neo4jId', 'traceRef', 'lastSyncedAt', 'syncVersion', 'status', 'error', 'attemptCount', 'createdAt', 'updatedAt'],
      _fields: [
        state.entityId,
        state.entityType,
        state.notionPageId,
        state.notionUrl,
        state.neo4jId,
        state.traceRef ?? null,
        state.lastSyncedAt.toISOString(),
        state.syncVersion,
        state.status,
        state.error ?? null,
        state.attemptCount,
        state.createdAt.toISOString(),
        state.updatedAt.toISOString(),
      ],
    }
  }

  private async simulateNetworkDelay(): Promise<void> {
    await new Promise((resolve) => setTimeout(resolve, Math.random() * 10 + 2))
  }
}

// =============================================================================
// Sync State Manager
// =============================================================================

/**
 * Sync State Manager
 * 
 * Manages sync state tracking for mirrored insights.
 * Stores Notion page URLs in Neo4j for drift detection.
 */
export class SyncStateManager {
  private client: Neo4jStateClient | null
  private config: Required<Omit<SyncStateConfig, 'neo4jClient'>>
  private cache: Map<string, { state: SyncState; expiresAt: number }> = new Map()

  constructor(config: SyncStateConfig = {}) {
    this.client = config.neo4jClient ?? null
    this.config = { ...DEFAULT_CONFIG, ...config } as Required<Omit<SyncStateConfig, 'neo4jClient'>>
  }

  /**
   * Get sync state by entity ID
   */
  async getSyncState(entityId: string): Promise<SyncState | null> {
    // Check cache first
    if (this.config.enableCache) {
      const cached = this.cache.get(entityId)
      if (cached && cached.expiresAt > Date.now()) {
        return cached.state
      }
    }

    if (this.client) {
      const result = await this.client.run(QUERIES.getSyncStateById, { entityId })
      
      if (result.records.length === 0) {
        return null
      }
      
      const state = this.recordToState(result.records[0])
      
      // Update cache
      if (this.config.enableCache) {
        this.cache.set(entityId, {
          state,
          expiresAt: Date.now() + this.config.cacheTtlSeconds * 1000,
        })
      }
      
      return state
    }
    
    return null
  }

  /**
   * Get sync state by Notion page ID
   */
  async getSyncStateByNotionId(notionPageId: string): Promise<SyncState | null> {
    if (this.client) {
      const result = await this.client.run(QUERIES.getSyncStateByNotionId, { notionPageId })
      
      if (result.records.length === 0) {
        return null
      }
      
      return this.recordToState(result.records[0])
    }
    
    return null
  }

  /**
   * Query sync states
   */
  async querySyncStates(query: SyncStateQuery = {}): Promise<SyncStateResult> {
    const startTime = Date.now()
    const limit = query.limit ?? this.config.batchSize
    const cursor = query.cursor ? parseInt(Buffer.from(query.cursor, 'base64').toString(), 10) : 0

    if (this.client) {
      const result = await this.client.run(QUERIES.getAllSyncStates, {
        entityType: query.entityType ?? null,
        status: query.status ?? null,
        skip: cursor,
        limit: limit + 1, // Fetch one extra to check hasMore
      })

      const states = result.records.slice(0, limit).map((r) => this.recordToState(r))
      const hasMore = result.records.length > limit
      const nextCursor = hasMore
        ? Buffer.from(String(cursor + limit)).toString('base64')
        : undefined

      return {
        states,
        total: states.length,
        hasMore,
        nextCursor,
        durationMs: Date.now() - startTime,
      }
    }

    // Return empty result if no client
    return {
      states: [],
      total: 0,
      hasMore: false,
      durationMs: Date.now() - startTime,
    }
  }

  /**
   * Create or update sync state
   */
  async upsertSyncState(state: Partial<SyncState>): Promise<SyncState> {
    const entityId = state.entityId ?? `sync-${Date.now()}`
    const now = new Date()

    const fullState: SyncState = {
      entityId,
      entityType: state.entityType ?? 'Insight',
      notionPageId: state.notionPageId ?? '',
      notionUrl: state.notionUrl ?? '',
      neo4jId: state.neo4jId ?? '',
      traceRef: state.traceRef,
      lastSyncedAt: state.lastSyncedAt ?? now,
      syncVersion: state.syncVersion ?? 1,
      status: state.status ?? 'synced',
      error: state.error,
      attemptCount: state.attemptCount ?? 0,
      createdAt: state.createdAt ?? now,
      updatedAt: now,
    }

    if (this.client) {
      await this.client.run(QUERIES.upsertSyncState, {
        entityId: fullState.entityId,
        entityType: fullState.entityType,
        notionPageId: fullState.notionPageId,
        notionUrl: fullState.notionUrl,
        neo4jId: fullState.neo4jId,
        traceRef: fullState.traceRef ?? null,
        lastSyncedAt: fullState.lastSyncedAt.toISOString(),
        status: fullState.status,
        error: fullState.error ?? null,
      })
    }

    // Update cache
    if (this.config.enableCache) {
      this.cache.set(fullState.entityId, {
        state: fullState,
        expiresAt: Date.now() + this.config.cacheTtlSeconds * 1000,
      })
    }

    return fullState
  }

  /**
   * Update sync status
   */
  async updateStatus(entityId: string, status: SyncStatus, error?: string): Promise<void> {
    if (this.client) {
      await this.client.run(QUERIES.updateSyncStatus, {
        entityId,
        status,
        error: error ?? null,
      })
    }

    // Invalidate cache
    this.cache.delete(entityId)
  }

  /**
   * Delete sync state
   */
  async deleteSyncState(entityId: string): Promise<void> {
    if (this.client) {
      await this.client.run(QUERIES.deleteSyncState, { entityId })
    }

    // Remove from cache
    this.cache.delete(entityId)
  }

  /**
   * Get stale sync states (need re-sync)
   */
  async getStaleSyncStates(thresholdMs?: number): Promise<SyncState[]> {
    const threshold = thresholdMs ?? this.config.staleThresholdMs
    const cutoff = new Date(Date.now() - threshold)

    if (this.client) {
      const result = await this.client.run(QUERIES.getStaleSyncStates, {
        threshold: cutoff.toISOString(),
        limit: this.config.batchSize,
      })

      return result.records.map((r) => this.recordToState(r))
    }

    return []
  }

  /**
   * Get sync statistics
   */
  async getStatistics(): Promise<SyncStatistics> {
    if (this.client) {
      const result = await this.client.run(QUERIES.getSyncStatistics)
      const record = result.records[0]

      if (!record) {
        return this.getEmptyStatistics()
      }

      const fields = record._fields

      return {
        totalSynced: (fields[1] as number) ?? 0,
        totalPending: (fields[2] as number) ?? 0,
        totalFailed: (fields[3] as number) ?? 0,
        totalStale: (fields[4] as number) ?? 0,
        totalConflicts: (fields[5] as number) ?? 0,
        byType: {} as Record<EntityType, { synced: number; pending: number; failed: number; stale: number; conflict: number }>,
        avgSyncLatencyMs: (fields[7] as number) ?? 0,
        lastSyncAt: fields[6] ? new Date(fields[6] as string) : undefined,
        driftCount: (fields[4] as number) ?? 0,
      }
    }

    return this.getEmptyStatistics()
  }

  /**
   * Detect drift between Neo4j and Notion
   */
  async detectDrift(entityId: string): Promise<SyncDriftResult | null> {
    const state = await this.getSyncState(entityId)

    if (!state) {
      // Entity exists in Neo4j but not in sync state (missing Notion)
      return {
        entityId,
        entityType: 'Insight',
        driftType: 'missing_notion',
        currentState: null,
        expectedState: { entityId },
        detectedAt: new Date(),
        severity: 70,
        recommendedAction: 'sync_to_notion',
      }
    }

    if (state.status === 'failed') {
      return {
        entityId,
        entityType: state.entityType,
        driftType: 'content_mismatch',
        currentState: state,
        expectedState: { status: 'synced' },
        detectedAt: new Date(),
        severity: 90,
        recommendedAction: 'manual_review',
      }
    }

    const staleThreshold = this.config.staleThresholdMs
    const timeSinceSync = Date.now() - state.lastSyncedAt.getTime()

    if (state.status === 'synced' && timeSinceSync > staleThreshold) {
      return {
        entityId,
        entityType: state.entityType,
        driftType: 'timestamp_mismatch',
        currentState: state,
        expectedState: { lastSyncedAt: new Date() },
        detectedAt: new Date(),
        severity: Math.min(100, Math.floor(timeSinceSync / staleThreshold) * 10),
        recommendedAction: 'sync_to_notion',
      }
    }

    return null
  }

  /**
   * Clear cache
   */
  clearCache(): void {
    this.cache.clear()
  }

  /**
   * Convert record to state
   */
  private recordToState(record: { keys: string[]; _fields: unknown[] }): SyncState {
    const fields = record._fields

    return {
      entityId: fields[0] as string,
      entityType: fields[1] as EntityType,
      notionPageId: fields[2] as string,
      notionUrl: fields[3] as string,
      neo4jId: fields[4] as string,
      traceRef: fields[5] as string | undefined,
      lastSyncedAt: new Date(fields[6] as string),
      syncVersion: fields[7] as number,
      status: fields[8] as SyncStatus,
      error: fields[9] as string | undefined,
      attemptCount: fields[10] as number,
      createdAt: new Date(fields[11] as string),
      updatedAt: new Date(fields[12] as string),
    }
  }

  /**
   * Get empty statistics
   */
  private getEmptyStatistics(): SyncStatistics {
    return {
      totalSynced: 0,
      totalPending: 0,
      totalFailed: 0,
      totalStale: 0,
      totalConflicts: 0,
      byType: {} as Record<EntityType, { synced: number; pending: number; failed: number; stale: number; conflict: number }>,
      avgSyncLatencyMs: 0,
      driftCount: 0,
    }
  }
}

// =============================================================================
// Factory Functions
// =============================================================================

/**
 * Create a sync state manager
 */
export function createSyncStateManager(config: SyncStateConfig = {}): SyncStateManager {
  return new SyncStateManager(config)
}

/**
 * Create a mock sync state manager for testing
 */
export function createMockSyncStateManager(seedData?: SyncState[]): {
  manager: SyncStateManager
  client: MockNeo4jStateClient
} {
  const client = new MockNeo4jStateClient(seedData)
  const manager = new SyncStateManager({ neo4jClient: client })

  return { manager, client }
}

// =============================================================================
// Default Export
// =============================================================================

export default SyncStateManager