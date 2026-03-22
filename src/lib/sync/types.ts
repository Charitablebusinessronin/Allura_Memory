/**
 * Sync Drift Types
 * 
 * Type definitions for detecting and reporting drift between Notion and Neo4j.
 * Ensures the human-managed source of truth stays aligned with agent memory.
 */

// =============================================================================
// Sync Keys & Identifiers
// =============================================================================

/**
 * Sync key - unique identifier linking Notion and Neo4j entities
 * 
 * Uses stable identifiers that exist in both systems:
 * - For AgentDesign pages: Notion page ID
 * - For Task nodes: Notion page ID or custom UUID
 * - For Knowledge entries: Neo4j node UUID stored in Notion
 */
export interface SyncKey {
  /** Notion page ID */
  notionId: string
  
  /** Neo4j node ID (may be derived from notionId or custom) */
  neo4jId: string
  
  /** Type of entity being synced */
  entityType: EntityType
  
  /** Source of the sync key */
  source: 'notion_generated' | 'neo4j_generated' | 'custom'
}

/**
 * Entity types that can be synced
 */
export type EntityType = 
  | 'AgentDesign'
  | 'Task'
  | 'Knowledge'
  | 'Insight'
  | 'Memory'
  | 'Workflow'
  | 'Resource'

/**
 * All entity types as array for iteration
 */
export const ENTITY_TYPES: EntityType[] = [
  'AgentDesign',
  'Task',
  'Knowledge',
  'Insight',
  'Memory',
  'Workflow',
  'Resource',
]

// =============================================================================
// Drift Types
// =============================================================================

/**
 * Drift status for an entity
 */
export type DriftStatus = 
  | 'in_sync'       // Both systems match
  | 'missing_notion' // Entity exists in Neo4j but not in Notion
  | 'missing_neo4j'  // Entity exists in Notion but not in Neo4j
  | 'stale'          // Timestamps don't match (one is newer)
  | 'conflicting'    // Both exist but have conflicting data

/**
 * Drift types classification
 */
export type DriftType = 
  | 'missing'
  | 'stale'
  | 'conflict'

// =============================================================================
// Entity Snapshots
// =============================================================================

/**
 * Notion entity snapshot for comparison
 */
export interface NotionEntity {
  /** Notion page ID */
  notionId: string
  
  /** Title or name */
  title: string
  
  /** Entity type */
  entityType: EntityType
  
  /** Last edited time in Notion */
  lastEditedTime: Date
  
  /** Created time in Notion */
  createdTime: Date
  
  /** Properties from Notion page */
  properties: Record<string, unknown>
  
  /** Version token (Notion's last_edited_time equivalent) */
  versionToken: string
  
  /** Sync metadata if exists */
  syncMetadata?: {
    neo4jId?: string
    lastSyncTime?: Date
    syncVersion?: number
  }
}

/**
 * Neo4j entity snapshot for comparison
 */
export interface Neo4jEntity {
  /** Neo4j node ID */
  neo4jId: string
  
  /** Title or name */
  title: string
  
  /** Entity type (Neo4j label) */
  entityType: EntityType
  
  /** Last updated timestamp in Neo4j */
  updatedAt: Date
  
  /** Created timestamp in Neo4j */
  createdAt: Date
  
  /** Properties from Neo4j node */
  properties: Record<string, unknown>
  
  /** Version number (for optimistic locking) */
  version: number
  
  /** Sync metadata if exists */
  syncMetadata?: {
    notionId?: string
    lastSyncTime?: Date
    syncVersion?: string
  }
}

// =============================================================================
// Drift Detection
// =============================================================================

/**
 * Drift detection result for a single entity
 */
export interface DriftResult {
  /** Sync key for this entity */
  syncKey: SyncKey
  
  /** Drift status */
  status: DriftStatus
  
  /** Drift type classification */
  driftType: DriftType | null
  
  /** Notion entity (if exists) */
  notionEntity: NotionEntity | null
  
  /** Neo4j entity (if exists) */
  neo4jEntity: Neo4jEntity | null
  
  /** Timestamp comparison details */
  timestampComparison: {
    notionTime: Date | null
    neo4jTime: Date | null
    newerSystem: 'notion' | 'neo4j' | 'equal' | 'none'
    timeDifferenceMs: number | null
  }
  
  /** Drift severity (0-100, higher = more severe) */
  severity: number
  
  /** Human-readable description */
  description: string
  
  /** Detection timestamp */
  detectedAt: Date
}

/**
 * Drift detection report
 */
export interface DriftReport {
  /** Report ID */
  id: string
  
  /** Report generation timestamp */
  generatedAt: Date
  
  /** Total entities checked */
  totalEntities: number
  
  /** Entities in sync */
  inSyncCount: number
  
  /** Entities with drift */
  driftCount: number
  
  /** Missing from Notion count */
  missingNotionCount: number
  
  /** Missing from Neo4j count */
  missingNeo4jCount: number
  
  /** Stale entities count */
  staleCount: number
  
  /** Conflicting entities count */
  conflictCount: number
  
  /** Individual drift results */
  results: DriftResult[]
  
  /** Reconciliation recommendations */
  recommendations: ReconciliationRecommendation[]
  
  /** Report summary */
  summary: DriftSummary
  
  /** Duration of detection (ms) */
  durationMs: number
}

/**
 * Drift summary statistics
 */
export interface DriftSummary {
  /** Percentage of entities in sync */
  syncPercentage: number
  
  /** Percentage of entities with drift */
  driftPercentage: number
  
  /** Average severity across all drifts */
  avgSeverity: number
  
  /** Entity types with most drift */
  topDriftTypes: Array<{
    entityType: EntityType
    count: number
    percentage: number
  }>
  
  /** Drift by status */
  driftByStatus: Record<DriftStatus, number>
  
  /** Recommendations by priority */
  recommendationsByPriority: {
    critical: number
    high: number
    medium: number
    low: number
  }
}

// =============================================================================
// Reconciliation Recommendations
// =============================================================================

/**
 * Reconciliation priority levels
 */
export type ReconciliationPriority = 'critical' | 'high' | 'medium' | 'low'

/**
 * Reconciliation direction
 */
export type ReconciliationDirection = 
  | 'notion_to_neo4j'  // Update Neo4j from Notion
  | 'neo4j_to_notion'  // Update Notion from Neo4j
  | 'manual_review'    // Needs human review
  | 'delete_notion'    // Delete from Notion
  | 'delete_neo4j'     // Delete from Neo4j

/**
 * Reconciliation recommendation for a drift
 */
export interface ReconciliationRecommendation {
  /** Recommendation ID */
  id: string
  
  /** Related sync key */
  syncKey: SyncKey
  
  /** Priority level */
  priority: ReconciliationPriority
  
  /** Recommended direction */
  direction: ReconciliationDirection
  
  /** Reason for this recommendation */
  reason: string
  
  /** Estimated impact (0-100) */
  impact: number
  
  /** Estimated effort (0-100) */
  effort: number
  
  /** Affected entity */
  entityType: EntityType
  
  /** Human-readable action */
  action: string
  
  /** Detailed steps */
  steps: string[]
  
  /** Auto-reconcilable flag */
  autoReconcilable: boolean
  
  /** Risk assessment */
  risks: string[]
}

// =============================================================================
// Extraction Types
// =============================================================================

/**
 * Notion extraction options
 */
export interface NotionExtractionOptions {
  /** Database ID to extract from */
  databaseId?: string
  
  /** Filter by entity type */
  entityType?: EntityType
  
  /** Only extract after this timestamp (incremental) */
  since?: Date
  
  /** Maximum pages to extract */
  limit?: number
  
  /** Include pages without sync keys */
  includeUnkeyed?: boolean
  
  /** Cursor for pagination */
  startCursor?: string
}

/**
 * Notion extraction result
 */
export interface NotionExtractionResult {
  /** Extracted entities */
  entities: NotionEntity[]
  
  /** Total entities found */
  totalFound: number
  
  /** Number of entities in this batch */
  batchSize: number
  
  /** Next cursor for pagination */
  nextCursor?: string
  
  /** Whether more results exist */
  hasMore: boolean
  
  /** Extraction duration (ms) */
  durationMs: number
  
  /** Errors encountered */
  errors: ExtractionError[]
}

/**
 * Neo4j extraction options
 */
export interface Neo4jExtractionOptions {
  /** Filter by entity type (label) */
  entityType?: EntityType
  
  /** Only extract after this timestamp (incremental) */
  since?: Date
  
  /** Maximum nodes to extract */
  limit?: number
  
  /** Include nodes without sync keys */
  includeUnkeyed?: boolean
  
  /** Filter by property */
  propertyFilter?: Record<string, unknown>
}

/**
 * Neo4j extraction result
 */
export interface Neo4jExtractionResult {
  /** Extracted entities */
  entities: Neo4jEntity[]
  
  /** Total entities found */
  totalFound: number
  
  /** Number of entities in this batch */
  batchSize: number
  
  /** Extraction duration (ms) */
  durationMs: number
  
  /** Errors encountered */
  errors: ExtractionError[]
}

/**
 * Extraction error
 */
export interface ExtractionError {
  /** Error ID */
  id?: string
  
  /** Entity ID if applicable */
  entityId?: string
  
  /** Error message */
  message: string
  
  /** Error code */
  code: string
  
  /** Additional details */
  details?: Record<string, unknown>
}

// =============================================================================
// Drift Analyzer Types
// =============================================================================

/**
 * Drift analyzer configuration
 */
export interface DriftAnalyzerConfig {
  /** Consider entities stale if time difference exceeds this (ms) */
  staleThresholdMs: number
  
  /** Consider drift critical if severity exceeds this (0-100) */
  criticalSeverityThreshold: number
  
  /** Consider drift high priority if severity exceeds this (0-100) */
  highSeverityThreshold: number
  
  /** Maximum entities to compare in one batch */
  batchSize: number
  
  /** Enable auto-reconciliation for safe operations */
  enableAutoReconciliation: boolean
  
  /** Entity types to check (default: all) */
  entityTypes?: EntityType[]
}

/**
 * Default analyzer configuration
 */
export const DEFAULT_ANALYZER_CONFIG: DriftAnalyzerConfig = {
  staleThresholdMs: 3600000, // 1 hour
  criticalSeverityThreshold: 80,
  highSeverityThreshold: 60,
  batchSize: 100,
  enableAutoReconciliation: false,
}

// =============================================================================
// Rate Limiting Types
// =============================================================================

/**
 * Rate limiter configuration
 * Notion API has 3 requests per second limit
 */
export interface RateLimiterConfig {
  /** Maximum requests per interval */
  maxRequests: number
  
  /** Interval in milliseconds */
  intervalMs: number
  
  /** Enable exponential backoff */
  enableBackoff: boolean
  
  /** Maximum backoff delay (ms) */
  maxBackoffMs: number
  
  /** Initial backoff delay (ms) */
  initialBackoffMs: number
}

/**
 * Default rate limiter config for Notion (3 req/sec)
 */
export const DEFAULT_NOTION_RATE_LIMITER: RateLimiterConfig = {
  maxRequests: 3,
  intervalMs: 1000,
  enableBackoff: true,
  maxBackoffMs: 60000,
  initialBackoffMs: 1000,
}