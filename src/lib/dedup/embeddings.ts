/**
 * Embedding-based Similarity
 * 
 * Generates embeddings for entities and computes cosine similarity.
 * Supports caching for performance optimization.
 */

import type {
  EntityType,
  DedupEntity,
  EmbeddingVector,
  CachedEmbedding,
  EmbeddingOptions,
  SimilarityResult,
} from './types'

// =============================================================================
// Configuration
// =============================================================================

const DEFAULT_MODEL = 'text-embedding-3-small'
const DEFAULT_CACHE_TTL = 60 * 60 * 24 * 7 // 7 days in seconds
const DEFAULT_DIMENSIONS = 1536

// =============================================================================
// Embedding Cache
// =============================================================================

/**
 * In-memory embedding cache
 */
class EmbeddingCache {
  private cache: Map<string, CachedEmbedding> = new Map()
  private maxSize: number
  private defaultTtl: number

  constructor(maxSize: number = 10000, defaultTtl: number = DEFAULT_CACHE_TTL) {
    this.maxSize = maxSize
    this.defaultTtl = defaultTtl
  }

  /**
   * Generate cache key
   */
  private getKey(entityId: string, model: string): string {
    return `${entityId}:${model}`
  }

  /**
   * Get cached embedding
   */
  get(entityId: string, model: string = DEFAULT_MODEL): CachedEmbedding | null {
    const key = this.getKey(entityId, model)
    const cached = this.cache.get(key)

    if (!cached) {
      return null
    }

    // Check expiration
    if (cached.expiresAt && cached.expiresAt < new Date()) {
      this.cache.delete(key)
      return null
    }

    return cached
  }

  /**
   * Set cached embedding
   */
  set(
    entityId: string,
    entityType: EntityType,
    primaryText: string,
    vector: EmbeddingVector,
    model: string = DEFAULT_MODEL,
    ttl?: number
  ): void {
    // Evict old entries if at capacity
    if (this.cache.size >= this.maxSize) {
      const oldestKey = this.cache.keys().next().value
      if (oldestKey) {
        this.cache.delete(oldestKey)
      }
    }

    const key = this.getKey(entityId, model)
    const now = new Date()
    const expiresAt = new Date(now.getTime() + (ttl ?? this.defaultTtl) * 1000)

    this.cache.set(key, {
      entityId,
      entityType,
      primaryText,
      vector,
      model,
      createdAt: now,
      expiresAt,
    })
  }

  /**
   * Check if cache has entry
   */
  has(entityId: string, model: string = DEFAULT_MODEL): boolean {
    return this.get(entityId, model) !== null
  }

  /**
   * Delete cached embedding
   */
  delete(entityId: string, model: string = DEFAULT_MODEL): boolean {
    const key = this.getKey(entityId, model)
    return this.cache.delete(key)
  }

  /**
   * Clear all cached embeddings
   */
  clear(): void {
    this.cache.clear()
  }

  /**
   * Get cache size
   */
  size(): number {
    return this.cache.size
  }

  /**
   * Get cache statistics
   */
  stats(): {
    size: number
    maxSize: number
    hitRate: number
    hits: number
    misses: number
  } {
    return {
      size: this.cache.size,
      maxSize: this.maxSize,
      hitRate: 0, // Would need to track hits/misses
      hits: 0,
      misses: 0,
    }
  }
}

// =============================================================================
// Embedding Generator
// =============================================================================

/**
 * Embedding generator interface
 */
export interface EmbeddingGenerator {
  generate(text: string): Promise<EmbeddingVector>
  generateBatch(texts: string[]): Promise<EmbeddingVector[]>
  getDimensions(): number
}

/**
 * Mock embedding generator for testing
 */
class MockEmbeddingGenerator implements EmbeddingGenerator {
  private dimensions: number

  constructor(dimensions: number = DEFAULT_DIMENSIONS) {
    this.dimensions = dimensions
  }

  async generate(text: string): Promise<EmbeddingVector> {
    // Generate deterministic mock embedding based on text hash
    const hash = this.hashString(text)
    const vector: EmbeddingVector = []
    
    for (let i = 0; i < this.dimensions; i++) {
      // Pseudo-random but deterministic
      vector.push(Math.sin(hash + i) * 0.5 + 0.5)
    }

    // Normalize the vector
    return this.normalizeVector(vector)
  }

  async generateBatch(texts: string[]): Promise<EmbeddingVector[]> {
    return Promise.all(texts.map((text) => this.generate(text)))
  }

  getDimensions(): number {
    return this.dimensions
  }

  private hashString(str: string): number {
    let hash = 0
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i)
      hash = ((hash << 5) - hash) + char
      hash = hash & hash // Convert to 32bit integer
    }
    return Math.abs(hash)
  }

  private normalizeVector(vector: EmbeddingVector): EmbeddingVector {
    const magnitude = Math.sqrt(vector.reduce((sum, val) => sum + val * val, 0))
    if (magnitude === 0) return vector
    return vector.map((val) => val / magnitude)
  }
}

/**
 * OpenAI embedding generator
 */
class OpenAIEmbeddingGenerator implements EmbeddingGenerator {
  private apiKey: string | undefined
  private model: string
  private dimensions: number

  constructor(apiKey?: string, model: string = DEFAULT_MODEL) {
    this.apiKey = apiKey ?? process.env.OPENAI_API_KEY
    this.model = model
    this.dimensions = DEFAULT_DIMENSIONS
  }

  async generate(text: string): Promise<EmbeddingVector> {
    if (!this.apiKey) {
      throw new Error('OpenAI API key not configured')
    }

    const response = await fetch('https://api.openai.com/v1/embeddings', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: this.model,
        input: text,
      }),
    })

    if (!response.ok) {
      const error = await response.text()
      throw new Error(`OpenAI API error: ${error}`)
    }

    const data = await response.json()
    return data.data[0].embedding
  }

  async generateBatch(texts: string[]): Promise<EmbeddingVector[]> {
    if (!this.apiKey) {
      throw new Error('OpenAI API key not configured')
    }

    const response = await fetch('https://api.openai.com/v1/embeddings', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: this.model,
        input: texts,
      }),
    })

    if (!response.ok) {
      const error = await response.text()
      throw new Error(`OpenAI API error: ${error}`)
    }

    const data = await response.json()
    return data.data.map((item: { embedding: EmbeddingVector }) => item.embedding)
  }

  getDimensions(): number {
    return this.dimensions
  }
}

/**
 * Ollama embedding generator
 * 
 * Uses Ollama's OpenAI-compatible API for local embeddings.
 * Default model is qwen3-embedding:8b with Matryoshka dimension reduction to 1024d.
 */
class OllamaEmbeddingGenerator implements EmbeddingGenerator {
  private baseUrl: string
  private model: string
  private dimensions: number

  constructor(config: {
    baseUrl?: string
    model?: string
    dimensions?: number
  } = {}) {
    this.baseUrl = config.baseUrl ?? process.env.OLLAMA_BASE_URL ?? 'http://localhost:11434/v1'
    this.model = config.model ?? process.env.OLLAMA_EMBEDDING_MODEL ?? 'qwen3-embedding:8b'
    this.dimensions = config.dimensions ?? 1024 // Qwen3-Embedding-8b MRL 1024d (HNSW-compatible)
  }

  async generate(text: string): Promise<EmbeddingVector> {
    const response = await fetch(`${this.baseUrl}/embeddings`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: this.model,
        input: text,
        dimensions: this.dimensions,
      }),
    })

    if (!response.ok) {
      const error = await response.text()
      throw new Error(`Ollama API error: ${error}`)
    }

    const data = await response.json()
    return data.data[0].embedding
  }

  async generateBatch(texts: string[]): Promise<EmbeddingVector[]> {
    const response = await fetch(`${this.baseUrl}/embeddings`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: this.model,
        input: texts,
        dimensions: this.dimensions,
      }),
    })

    if (!response.ok) {
      const error = await response.text()
      throw new Error(`Ollama API error: ${error}`)
    }

    const data = await response.json()
    return data.data.map((item: { embedding: EmbeddingVector }) => item.embedding)
  }

  getDimensions(): number {
    return this.dimensions
  }
}

// =============================================================================
// Embedding Manager
// =============================================================================

/**
 * Embedding Manager
 * 
 * Manages embedding generation, caching, and similarity computation.
 */
export class EmbeddingManager {
  private generator: EmbeddingGenerator
  private cache: EmbeddingCache
  private model: string

  constructor(config: {
    generator?: EmbeddingGenerator
    cacheMaxSize?: number
    cacheTtl?: number
    model?: string
  } = {}) {
    this.generator = config.generator ?? new MockEmbeddingGenerator()
    this.cache = new EmbeddingCache(config.cacheMaxSize, config.cacheTtl)
    this.model = config.model ?? DEFAULT_MODEL
  }

  /**
   * Get embedding for an entity
   */
  async getEmbedding(entity: DedupEntity, options: EmbeddingOptions = {}): Promise<EmbeddingVector> {
    const useCache = options.useCache ?? true
    const model = options.model ?? this.model

    // Check cache first
    if (useCache) {
      const cached = this.cache.get(entity.id, model)
      if (cached && cached.primaryText === entity.primaryText) {
        return cached.vector
      }
    }

    // Generate new embedding
    const text = this.buildEmbeddingText(entity)
    const vector = await this.generator.generate(text)

    // Cache the result
    if (useCache) {
      this.cache.set(
        entity.id,
        entity.type,
        entity.primaryText,
        vector,
        model,
        options.cacheTtl
      )
    }

    return vector
  }

  /**
   * Get embeddings for multiple entities
   */
  async getEmbeddings(entities: DedupEntity[], options: EmbeddingOptions = {}): Promise<Map<string, EmbeddingVector>> {
    const results = new Map<string, EmbeddingVector>()
    const toGenerate: { entity: DedupEntity; index: number }[] = []

    // Check cache for each entity
    for (let i = 0; i < entities.length; i++) {
      const entity = entities[i]
      const model = options.model ?? this.model

      if (options.useCache ?? true) {
        const cached = this.cache.get(entity.id, model)
        if (cached && cached.primaryText === entity.primaryText) {
          results.set(entity.id, cached.vector)
          continue
        }
      }

      toGenerate.push({ entity, index: i })
    }

    // Generate missing embeddings in batch
    if (toGenerate.length > 0) {
      const texts = toGenerate.map(({ entity }) => this.buildEmbeddingText(entity))
      const vectors = await this.generator.generateBatch(texts)

      for (let i = 0; i < toGenerate.length; i++) {
        const { entity } = toGenerate[i]
        const vector = vectors[i]
        const model = options.model ?? this.model

        results.set(entity.id, vector)

        // Cache the result
        if (options.useCache ?? true) {
          this.cache.set(
            entity.id,
            entity.type,
            entity.primaryText,
            vector,
            model,
            options.cacheTtl
          )
        }
      }
    }

    return results
  }

  /**
   * Compute cosine similarity between two vectors
   */
  cosineSimilarity(vec1: EmbeddingVector, vec2: EmbeddingVector): number {
    if (vec1.length !== vec2.length) {
      throw new Error('Vectors must have the same dimension')
    }

    let dotProduct = 0
    let norm1 = 0
    let norm2 = 0

    for (let i = 0; i < vec1.length; i++) {
      dotProduct += vec1[i] * vec2[i]
      norm1 += vec1[i] * vec1[i]
      norm2 += vec2[i] * vec2[i]
    }

    const magnitude = Math.sqrt(norm1) * Math.sqrt(norm2)
    if (magnitude === 0) return 0

    return dotProduct / magnitude
  }

  /**
   * Compute similarity between two entities
   */
  async computeSimilarity(
    entity1: DedupEntity,
    entity2: DedupEntity,
    options: EmbeddingOptions = {}
  ): Promise<SimilarityResult> {
    const [vec1, vec2] = await Promise.all([
      this.getEmbedding(entity1, options),
      this.getEmbedding(entity2, options),
    ])

    const embeddingSimilarity = this.cosineSimilarity(vec1, vec2)
    const threshold = (options as { threshold?: number }).threshold ?? 0.8

    return {
      entityId1: entity1.id,
      entityId2: entity2.id,
      score: embeddingSimilarity,
      embeddingSimilarity,
      isPotentialDuplicate: embeddingSimilarity >= threshold,
      confidence: this.getConfidence(embeddingSimilarity),
      reason: `Embedding similarity: ${embeddingSimilarity.toFixed(4)}`,
    }
  }

  /**
   * Batch compute similarities
   */
  async computeSimilarities(
    entities: DedupEntity[],
    options: EmbeddingOptions = {}
  ): Promise<SimilarityResult[]> {
    const embeddings = await this.getEmbeddings(entities, options)
    const results: SimilarityResult[] = []
    const threshold = (options as { threshold?: number }).threshold ?? 0.8

    for (let i = 0; i < entities.length; i++) {
      for (let j = i + 1; j < entities.length; j++) {
        const entity1 = entities[i]
        const entity2 = entities[j]
        const vec1 = embeddings.get(entity1.id)!
        const vec2 = embeddings.get(entity2.id)!

        const similarity = this.cosineSimilarity(vec1, vec2)

        results.push({
          entityId1: entity1.id,
          entityId2: entity2.id,
          score: similarity,
          embeddingSimilarity: similarity,
          isPotentialDuplicate: similarity >= threshold,
          confidence: this.getConfidence(similarity),
          reason: `Embedding similarity: ${similarity.toFixed(4)}`,
        })
      }
    }

    return results
  }

  /**
   * Build text for embedding
   */
  private buildEmbeddingText(entity: DedupEntity): string {
    const parts = [entity.primaryText]

    if (entity.secondaryText) {
      parts.push(entity.secondaryText)
    }

    // Add type for context
    parts.push(`Type: ${entity.type}`)

    return parts.join(' | ')
  }

  /**
   * Get confidence level based on similarity score
   */
  private getConfidence(similarity: number): 'high' | 'medium' | 'low' {
    if (similarity >= 0.95) return 'high'
    if (similarity >= 0.85) return 'medium'
    return 'low'
  }

  /**
   * Clear cache
   */
  clearCache(): void {
    this.cache.clear()
  }

  /**
   * Get cache statistics
   */
  getCacheStats(): { size: number; maxSize: number } {
    return {
      size: this.cache.size(),
      maxSize: (this.cache as unknown as { maxSize: number }).maxSize,
    }
  }
}

// =============================================================================
// Factory Functions
// =============================================================================

/**
 * Create an embedding manager with mock generator (for testing)
 */
export function createMockEmbeddingManager(config: {
  cacheMaxSize?: number
  cacheTtl?: number
  dimensions?: number
} = {}): EmbeddingManager {
  return new EmbeddingManager({
    generator: new MockEmbeddingGenerator(config.dimensions),
    cacheMaxSize: config.cacheMaxSize,
    cacheTtl: config.cacheTtl,
  })
}

/**
 * Create an embedding manager with OpenAI generator
 */
export function createOpenAIEmbeddingManager(config: {
  apiKey?: string
  model?: string
  cacheMaxSize?: number
  cacheTtl?: number
} = {}): EmbeddingManager {
  return new EmbeddingManager({
    generator: new OpenAIEmbeddingGenerator(config.apiKey, config.model),
    cacheMaxSize: config.cacheMaxSize,
    cacheTtl: config.cacheTtl,
    model: config.model,
  })
}

/**
 * Create an embedding manager with Ollama generator (local, no API key required)
 * 
 * Default model: qwen3-embedding:8b (1024 dimensions via MRL)
 * Default base URL: http://localhost:11434/v1 (Ollama OpenAI-compatible endpoint)
 * 
 * Set OLLAMA_BASE_URL and OLLAMA_EMBEDDING_MODEL env vars to override defaults.
 */
export function createOllamaEmbeddingManager(config: {
  baseUrl?: string
  model?: string
  dimensions?: number
  cacheMaxSize?: number
  cacheTtl?: number
} = {}): EmbeddingManager {
  return new EmbeddingManager({
    generator: new OllamaEmbeddingGenerator(config),
    cacheMaxSize: config.cacheMaxSize,
    cacheTtl: config.cacheTtl,
  })
}

/**
 * Create an embedding manager with custom generator
 */
export function createEmbeddingManager(config: {
  generator?: EmbeddingGenerator
  cacheMaxSize?: number
  cacheTtl?: number
  model?: string
} = {}): EmbeddingManager {
  return new EmbeddingManager(config)
}

/**
 * Create the default embedding manager
 * 
 * Defaults to Ollama (local embeddings) for zero-cost operation.
 * Falls back to OpenAI if OLLAMA_BASE_URL is not set and OPENAI_API_KEY is available.
 */
export function createDefaultEmbeddingManager(config: {
  cacheMaxSize?: number
  cacheTtl?: number
} = {}): EmbeddingManager {
  // Prefer Ollama (local, free) when available
  const ollamaBaseUrl = process.env.OLLAMA_BASE_URL
  const openaiApiKey = process.env.OPENAI_API_KEY
  
  // If OLLAMA_BASE_URL is explicitly set or Ollama is likely available, use it
  if (ollamaBaseUrl || !openaiApiKey) {
    return createOllamaEmbeddingManager({
      baseUrl: ollamaBaseUrl,
      cacheMaxSize: config.cacheMaxSize,
      cacheTtl: config.cacheTtl,
    })
  }
  
  // Fall back to OpenAI if API key is available but Ollama isn't configured
  if (openaiApiKey) {
    return createOpenAIEmbeddingManager({
      apiKey: openaiApiKey,
      cacheMaxSize: config.cacheMaxSize,
      cacheTtl: config.cacheTtl,
    })
  }
  
  // No configuration available, use mock for testing
  return createMockEmbeddingManager(config)
}

// =============================================================================
// Default Export
// =============================================================================

export default EmbeddingManager