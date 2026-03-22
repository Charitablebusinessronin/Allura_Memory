/**
 * Duplicate Detector
 * 
 * Detects potential duplicate entities using embedding and text similarity.
 * Supports pairwise comparison and clustering strategies.
 */

import type {
  EntityType,
  DedupEntity,
  DuplicatePair,
  DetectionConfig,
  DetectionResult,
  SimilarityResult,
} from './types'
import { EmbeddingManager, createMockEmbeddingManager } from './embeddings'
import { TextSimilarityManager, createTextManager } from './text-similarity'

// =============================================================================
// Default Configuration
// =============================================================================

const DEFAULT_CONFIG: DetectionConfig = {
  entityTypes: ['agent', 'insight', 'knowledge-item', 'event', 'outcome'],
  embeddingThreshold: 0.85,
  textThreshold: 0.80,
  combinedThreshold: 0.82,
  autoMergeConfidence: 'high',
  batchSize: 1000,
  useCache: true,
  strategy: 'hybrid',
}

// =============================================================================
// Duplicate Detector
// =============================================================================

/**
 * Duplicate Detector
 * 
 * Identifies potential duplicate entities using hybrid similarity scoring.
 */
export class DuplicateDetector {
  private config: DetectionConfig
  private embeddingManager: EmbeddingManager
  private textManager: TextSimilarityManager

  constructor(config: Partial<DetectionConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config }
    this.embeddingManager = createMockEmbeddingManager()
    this.textManager = createTextManager({
      algorithm: 'hybrid',
      normalize: true,
      handleAbbreviations: true,
    })
  }

  /**
   * Set embedding manager
   */
  setEmbeddingManager(manager: EmbeddingManager): void {
    this.embeddingManager = manager
  }

  /**
   * Set text manager
   */
  setTextManager(manager: TextSimilarityManager): void {
    this.textManager = manager
  }

  /**
   * Detect duplicates among entities
   */
  async detect(entities: DedupEntity[]): Promise<DetectionResult> {
    const startTime = Date.now()
    const duplicates: DuplicatePair[] = []

    // Filter entities by configured types
    const filteredEntities = entities.filter(
      (e) => this.config.entityTypes.includes(e.type)
    )

    if (filteredEntities.length < 2) {
      return {
        duplicates: [],
        entitiesChecked: filteredEntities.length,
        comparisonsMade: 0,
        detectedAt: new Date(),
        durationMs: Date.now() - startTime,
      }
    }

    // Choose detection strategy
    switch (this.config.strategy) {
      case 'clustering':
        duplicates.push(...(await this.detectByClustering(filteredEntities)))
        break
      case 'pairwise':
        duplicates.push(...(await this.detectPairwise(filteredEntities)))
        break
      case 'hybrid':
      default:
        duplicates.push(...(await this.detectHybrid(filteredEntities)))
        break
    }

    const durationMs = Date.now() - startTime

    return {
      duplicates,
      entitiesChecked: filteredEntities.length,
      comparisonsMade: this.getComparisonCount(filteredEntities.length),
      detectedAt: new Date(),
      durationMs,
    }
  }

  /**
   * Detect duplicates using pairwise comparison
   */
  private async detectPairwise(entities: DedupEntity[]): Promise<DuplicatePair[]> {
    const duplicates: DuplicatePair[] = []

    // Process in batches
    for (let i = 0; i < entities.length; i += this.config.batchSize) {
      const batch = entities.slice(i, i + this.config.batchSize)
      
      for (let j = 0; j < batch.length; j++) {
        for (let k = j + 1; k < batch.length; k++) {
          const pair = await this.compareEntities(batch[j], batch[k])
          if (pair) {
            duplicates.push(pair)
          }
        }
      }
    }

    // Also compare across batches if there are multiple
    const batchCount = Math.ceil(entities.length / this.config.batchSize)
    if (batchCount > 1) {
      for (let batch1 = 0; batch1 < batchCount; batch1++) {
        for (let batch2 = batch1 + 1; batch2 < batchCount; batch2++) {
          const start1 = batch1 * this.config.batchSize
          const end1 = Math.min(start1 + this.config.batchSize, entities.length)
          const start2 = batch2 * this.config.batchSize
          const end2 = Math.min(start2 + this.config.batchSize, entities.length)

          for (let i = start1; i < end1; i++) {
            for (let j = start2; j < end2; j++) {
              const pair = await this.compareEntities(entities[i], entities[j])
              if (pair) {
                duplicates.push(pair)
              }
            }
          }
        }
      }
    }

    return duplicates
  }

  /**
   * Detect duplicates using clustering
   */
  private async detectByClustering(entities: DedupEntity[]): Promise<DuplicatePair[]> {
    const duplicates: DuplicatePair[] = []
    
    // Group entities by type
    const entityGroups = this.groupByType(entities)
    const groupsArray = Array.from(entityGroups.values())

    for (const group of groupsArray) {
      // Compute all pairwise similarities
      const similarities = await this.computeAllSimilarities(group)

      // Build clusters
      const clusters = this.buildClusters(group, similarities)

      // Convert clusters to duplicate pairs
      for (const cluster of clusters) {
        if (cluster.length > 1) {
          for (let i = 0; i < cluster.length; i++) {
            for (let j = i + 1; j < cluster.length; j++) {
              const key = `${cluster[i]}:${cluster[j]}`
              const sim = similarities.get(key)
              if (sim) {
                duplicates.push(this.createDuplicatePair(
                  entities.find((e) => e.id === cluster[i])!,
                  entities.find((e) => e.id === cluster[j])!,
                  sim
                ))
              }
            }
          }
        }
      }
    }

    return duplicates
  }

  /**
   * Detect duplicates using hybrid approach (pairwise + clustering hints)
   */
  private async detectHybrid(entities: DedupEntity[]): Promise<DuplicatePair[]> {
    // First, do a quick text-based pass to find potential matches
    const potentialMatches = new Map<string, Set<string>>()

    // Quick text-only pass
    for (let i = 0; i < entities.length; i++) {
      for (let j = i + 1; j < entities.length; j++) {
        const textSim = this.textManager.computeEntitySimilarity(entities[i], entities[j])
        if (textSim.score >= this.config.textThreshold * 0.8) {
          // Lower threshold for potential match
          if (!potentialMatches.has(entities[i].id)) {
            potentialMatches.set(entities[i].id, new Set())
          }
          potentialMatches.get(entities[i].id)!.add(entities[j].id)
        }
      }
    }

    // Now do full comparison on potential matches
    const duplicates: DuplicatePair[] = []
    const matchesArray = Array.from(potentialMatches.entries())

    for (const [entityId1, candidateIds] of matchesArray) {
      const entity1 = entities.find((e) => e.id === entityId1)
      if (!entity1) continue

      const candidateArray = Array.from(candidateIds)
      for (const entityId2 of candidateArray) {
        const entity2 = entities.find((e) => e.id === entityId2)
        if (!entity2) continue

        const pair = await this.compareEntities(entity1, entity2)
        if (pair) {
          duplicates.push(pair)
        }
      }
    }

    return duplicates
  }

  /**
   * Compare two entities
   */
  private async compareEntities(
    entity1: DedupEntity,
    entity2: DedupEntity
  ): Promise<DuplicatePair | null> {
    // Compute embedding similarity
    const embSim = await this.embeddingManager.computeSimilarity(entity1, entity2, {
      useCache: this.config.useCache,
    })

    // Compute text similarity
    const textSim = this.textManager.computeEntitySimilarity(entity1, entity2)

    // Combine similarities (weighted average)
    const combinedScore = embSim.score * 0.6 + textSim.score * 0.4

    // Check if above threshold
    if (combinedScore < this.config.combinedThreshold) {
      return null
    }

    return this.createDuplicatePair(entity1, entity2, {
      embedding: embSim.score,
      text: textSim.score,
      combined: combinedScore,
    })
  }

  /**
   * Create a duplicate pair
   */
  private createDuplicatePair(
    entity1: DedupEntity,
    entity2: DedupEntity,
    scores: { embedding: number; text: number; combined: number }
  ): DuplicatePair {
    // Determine recommendation based on score and confidence
    let recommendation: 'merge' | 'review' | 'ignore'

    if (scores.combined >= 0.95 && this.config.autoMergeConfidence === 'high') {
      recommendation = 'merge'
    } else if (scores.combined >= 0.90) {
      recommendation = 'review'
    } else {
      recommendation = 'ignore'
    }

    // Determine detection method
    let detectionMethod: 'embedding' | 'text' | 'hybrid'
    if (scores.embedding >= this.config.embeddingThreshold && scores.text < this.config.textThreshold) {
      detectionMethod = 'embedding'
    } else if (scores.text >= this.config.textThreshold && scores.embedding < this.config.embeddingThreshold) {
      detectionMethod = 'text'
    } else {
      detectionMethod = 'hybrid'
    }

    return {
      entityId1: entity1.id,
      entityId2: entity2.id,
      similarity: scores.combined,
      breakdown: {
        embedding: scores.embedding,
        text: scores.text,
        combined: scores.combined,
      },
      recommendation,
      detectedAt: new Date(),
      detectionMethod,
    }
  }

  /**
   * Compute all pairwise similarities
   */
  private async computeAllSimilarities(
    entities: DedupEntity[]
  ): Promise<Map<string, { embedding: number; text: number; combined: number }>> {
    const similarities = new Map<string, { embedding: number; text: number; combined: number }>()

    // Get embeddings in batch
    const embeddingMap = await this.embeddingManager.getEmbeddings(entities)

    for (let i = 0; i < entities.length; i++) {
      for (let j = i + 1; j < entities.length; j++) {
        const entity1 = entities[i]
        const entity2 = entities[j]
        const key = `${entity1.id}:${entity2.id}`

        const vec1 = embeddingMap.get(entity1.id)!
        const vec2 = embeddingMap.get(entity2.id)!

        const embSim = this.embeddingManager.cosineSimilarity(vec1, vec2)
        const textSim = this.textManager.computeEntitySimilarity(entity1, entity2)
        const combined = embSim * 0.6 + textSim.score * 0.4

        similarities.set(key, {
          embedding: embSim,
          text: textSim.score,
          combined,
        })
      }
    }

    return similarities
  }

  /**
   * Build clusters from similarities
   */
  private buildClusters(
    entities: DedupEntity[],
    similarities: Map<string, { embedding: number; text: number; combined: number }>
  ): string[][] {
    const clusterMap = new Map<string, Set<string>>()

    // Initialize each entity in its own cluster
    for (const entity of entities) {
      clusterMap.set(entity.id, new Set([entity.id]))
    }

    // Merge clusters for similar entities
    const similaritiesArray = Array.from(similarities.entries())
    for (const [key, scores] of similaritiesArray) {
      if (scores.combined >= this.config.combinedThreshold) {
        const [id1, id2] = key.split(':')
        
        // Find clusters
        const cluster1 = clusterMap.get(id1)!
        const cluster2 = clusterMap.get(id2)!

        // Merge smaller into larger
        if (cluster1.size < cluster2.size) {
          const cluster2Array = Array.from(cluster1.values())
          for (const id of cluster2Array) {
            cluster2.add(id)
          }
          clusterMap.set(id1, cluster2)
        } else {
          const cluster1Array = Array.from(cluster2.values())
          for (const id of cluster1Array) {
            cluster1.add(id)
          }
          clusterMap.set(id2, cluster1)
        }
      }
    }

    // Deduplicate clusters
    const seen = new Set<string>()
    const clusters: string[][] = []
    const clusterMapArray = Array.from(clusterMap.entries())

    for (const [_, cluster] of clusterMapArray) {
      const sortedIds = Array.from(cluster).sort()
      const key = sortedIds.join(',')
      
      if (!seen.has(key)) {
        seen.add(key)
        clusters.push(sortedIds)
      }
    }

    return clusters
  }

  /**
   * Group entities by type
   */
  private groupByType(entities: DedupEntity[]): Map<EntityType, DedupEntity[]> {
    const groups = new Map<EntityType, DedupEntity[]>()

    for (const entity of entities) {
      const group = groups.get(entity.type) ?? []
      group.push(entity)
      groups.set(entity.type, group)
    }

    return groups
  }

  /**
   * Get comparison count for n entities
   */
  private getComparisonCount(n: number): number {
    return (n * (n - 1)) / 2
  }

  /**
   * Update configuration
   */
  updateConfig(config: Partial<DetectionConfig>): void {
    this.config = { ...this.config, ...config }
  }

  /**
   * Get current configuration
   */
  getConfig(): DetectionConfig {
    return { ...this.config }
  }
}

// =============================================================================
// Factory Functions
// =============================================================================

/**
 * Create a duplicate detector
 */
export function createDetector(config: Partial<DetectionConfig> = {}): DuplicateDetector {
  return new DuplicateDetector(config)
}

/**
 * Create a duplicate detector for specific entity types
 */
export function createDetectorForTypes(
  entityTypes: EntityType[],
  config: Omit<Partial<DetectionConfig>, 'entityTypes'> = {}
): DuplicateDetector {
  return new DuplicateDetector({
    ...config,
    entityTypes,
  })
}

// =============================================================================
// Default Export
// =============================================================================

export default DuplicateDetector