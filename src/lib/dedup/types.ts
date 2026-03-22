/**
 * Deduplication Types
 * 
 * Type definitions for the entity deduplication system.
 * Supports duplicate detection, similarity scoring, and merge operations.
 */

// =============================================================================
// Core Dedup Types
// =============================================================================

/**
 * Entity types that can be deduplicated
 */
export type EntityType = 'agent' | 'insight' | 'knowledge-item' | 'event' | 'outcome'

/**
 * Base entity for deduplication
 */
export interface DedupEntity {
  /** Unique identifier */
  id: string
  /** Entity type */
  type: EntityType
  /** Primary text for similarity (name, title, summary) */
  primaryText: string
  /** Secondary text for context */
  secondaryText?: string
  /** Additional properties for comparison */
  properties: Record<string, unknown>
  /** Creation timestamp */
  createdAt: Date
  /** Update timestamp */
  updatedAt?: Date
  /** Source of the entity */
  source?: string
}

/**
 * Similarity result between two entities
 */
export interface SimilarityResult {
  /** First entity ID */
  entityId1: string
  /** Second entity ID */
  entityId2: string
  /** Overall similarity score (0-1) */
  score: number
  /** Embedding cosine similarity (0-1) */
  embeddingSimilarity?: number
  /** Levenshtein-based text similarity (0-1) */
  textSimilarity?: number
  /** Whether this exceeds the duplicate threshold */
  isPotentialDuplicate: boolean
  /** Confidence level */
  confidence: 'high' | 'medium' | 'low'
  /** Reason for the similarity score */
  reason: string
}

/**
 * Duplicate pair detected by the system
 */
export interface DuplicatePair {
  /** ID of the first entity */
  entityId1: string
  /** ID of the second entity */
  entityId2: string
  /** Similarity score */
  similarity: number
  /** Similarity breakdown */
  breakdown: {
    embedding: number
    text: number
    combined: number
  }
  /** Recommended action */
  recommendation: 'merge' | 'review' | 'ignore'
  /** Detection timestamp */
  detectedAt: Date
  /** Detection method */
  detectionMethod: 'embedding' | 'text' | 'hybrid'
}

/**
 * Merge request
 */
export interface MergeRequest {
  /** ID of the entity to keep (canonical) */
  canonicalId: string
  /** IDs of entities to merge into canonical */
  duplicateIds: string[]
  /** Entity type */
  entityType: EntityType
  /** Merge strategy */
  strategy: MergeStrategy
  /** Who requested the merge */
  requestedBy?: string
  /** Reason for merge */
  reason?: string
  /** Whether to auto-approve */
  autoApprove?: boolean
}

/**
 * Merge strategy
 */
export interface MergeStrategy {
  /** How to select canonical entity */
  canonicalSelection: 'oldest' | 'newest' | 'most-connected' | 'manual'
  /** How to handle property conflicts */
  conflictResolution: 'canonical-wins' | 'newest-wins' | 'merge-all' | 'manual'
  /** Whether to preserve merged entity data */
  preserveData: boolean
  /** Whether to update relationships */
  updateRelationships: boolean
  /** Whether to create audit trail */
  createAuditTrail: boolean
}

/**
 * Merge result
 */
export interface MergeResult {
  /** Canonical entity ID */
  canonicalId: string
  /** Merged entity IDs */
  mergedIds: string[]
  /** Relationships updated */
  relationshipsUpdated: number
  /** Properties merged */
  propertiesMerged: string[]
  /** Merge timestamp */
  mergedAt: Date
  /** Audit trail ID */
  auditId: string
  /** Duration in ms */
  durationMs: number
}

/**
 * Audit trail entry for merge operations
 */
export interface MergeAuditEntry {
  /** Audit entry ID */
  id: string
  /** Timestamp */
  timestamp: Date
  /** Operation type */
  operation: 'merge' | 'undo' | 'review' | 'reject'
  /** Entity type */
  entityType: EntityType
  /** Canonical entity ID */
  canonicalId: string
  /** Merged entity IDs */
  mergedIds: string[]
  /** Who performed the operation */
  performedBy: string
  /** Reason for operation */
  reason: string
  /** Similarity score before merge */
  similarityScore: number
  /** Strategy used */
  strategy: MergeStrategy
  /** Entity data before merge (for undo) */
  beforeData?: Record<string, unknown>
  /** Entity data after merge */
  afterData?: Record<string, unknown>
  /** Additional metadata */
  metadata?: Record<string, unknown>
}

// =============================================================================
// Detector Types
// =============================================================================

/**
 * Detection configuration
 */
export interface DetectionConfig {
  /** Entity types to check */
  entityTypes: EntityType[]
  /** Embedding similarity threshold (0-1) */
  embeddingThreshold: number
  /** Text similarity threshold (0-1) */
  textThreshold: number
  /** Combined similarity threshold (0-1) */
  combinedThreshold: number
  /** Minimum confidence for auto-merge */
  autoMergeConfidence: 'high' | 'medium' | 'low'
  /** Maximum entities to compare per run */
  batchSize: number
  /** Whether to use caching */
  useCache: boolean
  /** Detection strategy */
  strategy: 'pairwise' | 'clustering' | 'hybrid'
}

/**
 * Detection result
 */
export interface DetectionResult {
  /** Duplicate pairs found */
  duplicates: DuplicatePair[]
  /** Total entities checked */
  entitiesChecked: number
  /** Total comparisons made */
  comparisonsMade: number
  /** Detection timestamp */
  detectedAt: Date
  /** Duration in ms */
  durationMs: number
  /** Cache hit rate */
  cacheHitRate?: number
}

// =============================================================================
// Embedding Types
// =============================================================================

/**
 * Embedding vector
 */
export type EmbeddingVector = number[]

/**
 * Cached embedding
 */
export interface CachedEmbedding {
  /** Entity ID */
  entityId: string
  /** Entity type */
  entityType: EntityType
  /** Primary text */
  primaryText: string
  /** Embedding vector */
  vector: EmbeddingVector
  /** Model used */
  model: string
  /** Creation timestamp */
  createdAt: Date
  /** Expiration timestamp */
  expiresAt?: Date
}

/**
 * Embedding generation options
 */
export interface EmbeddingOptions {
  /** Model to use */
  model?: string
  /** Whether to use cache */
  useCache?: boolean
  /** Cache TTL in seconds */
  cacheTtl?: number
}

// =============================================================================
// Text Similarity Types
// =============================================================================

/**
 * Text similarity options
 */
export interface TextSimilarityOptions {
  /** Algorithm to use */
  algorithm: 'levenshtein' | 'jaro-winkler' | 'hybrid'
  /** Whether to normalize strings */
  normalize: boolean
  /** Whether to handle abbreviations */
  handleAbbreviations: boolean
  /** Custom abbreviation map */
  abbreviations?: Record<string, string>
  /** Weight for primary text */
  primaryWeight?: number
  /** Weight for secondary text */
  secondaryWeight?: number
}

/**
 * Text similarity result
 */
export interface TextSimilarityResult {
  /** Similarity score (0-1) */
  score: number
  /** Levenshtein distance */
  distance: number
  /** Maximum possible distance */
  maxDistance: number
  /** Normalized strings used */
  normalized: {
    text1: string
    text2: string
  }
}

// =============================================================================
// Export all types
// =============================================================================