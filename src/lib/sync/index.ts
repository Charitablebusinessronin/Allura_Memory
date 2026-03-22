/**
 * Sync Module Index
 * 
 * Exports for drift detection between Notion and Neo4j,
 * insight mirroring, and sync state tracking.
 */

// =============================================================================
// Types
// =============================================================================

export type {
  SyncKey,
  EntityType,
  DriftStatus,
  DriftType,
  NotionEntity,
  Neo4jEntity,
  DriftResult,
  DriftReport,
  DriftSummary,
  ReconciliationPriority,
  ReconciliationDirection,
  ReconciliationRecommendation,
  NotionExtractionOptions,
  NotionExtractionResult,
  Neo4jExtractionOptions,
  Neo4jExtractionResult,
  ExtractionError,
  DriftAnalyzerConfig,
  RateLimiterConfig,
} from './types'

export {
  ENTITY_TYPES,
  DEFAULT_ANALYZER_CONFIG,
  DEFAULT_NOTION_RATE_LIMITER,
} from './types'

// =============================================================================
// Notion Extractor
// =============================================================================

export {
  NotionExtractor,
  NotionRateLimiter,
  MockNotionClient,
  createNotionExtractor,
  createMockNotionExtractor,
} from './notion-extractor'

export type {
  NotionClient,
} from './notion-extractor'

// =============================================================================
// Neo4j Extractor
// =============================================================================

export {
  Neo4jExtractor,
  MockNeo4jClient,
  createNeo4jExtractor,
  createMockNeo4jExtractor,
} from './neo4j-extractor'

export type {
  Neo4jClient,
  Neo4jSession,
} from './neo4j-extractor'

// =============================================================================
// Drift Analyzer
// =============================================================================

export {
  DriftAnalyzer,
  createDriftAnalyzer,
} from './drift-analyzer'

// =============================================================================
// Insight Mirror (Story 4-6)
// =============================================================================

export {
  InsightMirror,
  MockNotionMirrorClient,
  MockNeo4jInsightClient,
  createInsightMirror,
  createMockInsightMirror,
} from './insight-mirror'

export type {
  InsightNode,
  InsightClaim,
  InsightEvidence,
  NotionPageContent,
  NotionBlock,
  MirrorConfig,
  MirrorResult,
  BatchMirrorResult,
  NotionMirrorClient,
  Neo4jInsightClient,
} from './insight-mirror'

// =============================================================================
// Sync State (Story 4-6)
// =============================================================================

export {
  SyncStateManager,
  MockNeo4jStateClient,
  createSyncStateManager,
  createMockSyncStateManager,
} from './sync-state'

export type {
  SyncState,
  SyncStatus,
  SyncStateQuery,
  SyncStateResult,
  SyncStatistics,
  SyncDriftResult,
  SyncStateConfig,
  Neo4jStateClient,
} from './sync-state'

// =============================================================================
// Default Export
// =============================================================================

// Re-export for convenience - no default export needed