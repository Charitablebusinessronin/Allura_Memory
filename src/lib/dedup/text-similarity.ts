/**
 * Text-based Similarity
 * 
 * Computes text similarity using Levenshtein distance and fuzzy matching.
 * Handles abbreviations and normalizes strings for comparison.
 */

import type { DedupEntity, TextSimilarityOptions, TextSimilarityResult, SimilarityResult } from './types'

// =============================================================================
// Configuration
// =============================================================================

const DEFAULT_OPTIONS: TextSimilarityOptions = {
  algorithm: 'levenshtein',
  normalize: true,
  handleAbbreviations: true,
  primaryWeight: 0.7,
  secondaryWeight: 0.3,
}

const COMMON_ABBREVIATIONS: Record<string, string> = {
  'ai': 'artificial intelligence',
  'ml': 'machine learning',
  'nlp': 'natural language processing',
  'api': 'application programming interface',
  'ui': 'user interface',
  'ux': 'user experience',
  'db': 'database',
  'cfg': 'configuration',
  'impl': 'implementation',
  'info': 'information',
  'doc': 'document',
  'docs': 'documents',
  'msg': 'message',
  'req': 'request',
  'resp': 'response',
  'err': 'error',
  'ex': 'exception',
  'tmp': 'temporary',
  'lib': 'library',
  'util': 'utility',
  'func': 'function',
  'obj': 'object',
  'arr': 'array',
  'val': 'value',
  'str': 'string',
  'num': 'number',
  'bool': 'boolean',
  'int': 'integer',
  'conn': 'connection',
  'ctx': 'context',
  'proc': 'process',
  'exec': 'execute',
  'perf': 'performance',
  'env': 'environment',
  'sys': 'system',
  'pkg': 'package',
  'mod': 'module',
  'comp': 'component',
  'svc': 'service',
  'mgr': 'manager',
  'ctrl': 'controller',
  'repo': 'repository',
  'proj': 'project',
  'feat': 'feature',
  'bug': 'bug',
  'fix': 'fix',
  'ref': 'reference',
  'desc': 'description',
  'spec': 'specification',
  'ver': 'version',
  'rev': 'revision',
  'upd': 'update',
  'del': 'delete',
  'ins': 'insert',
  'sel': 'select',
  'get': 'get',
  'set': 'set',
  'add': 'add',
  'rem': 'remove',
  'cre': 'create',
  'init': 'initialize',
  'dest': 'destroy',
  'cln': 'clean',
  'cpy': 'copy',
  'mov': 'move',
  'ren': 'rename',
  'srch': 'search',
  'flt': 'filter',
  'srt': 'sort',
  'grp': 'group',
  'agg': 'aggregate',
  'join': 'join',
  'split': 'split',
  'merge': 'merge',
  'valid': 'validate',
  'parse': 'parse',
  'fmt': 'format',
  'enc': 'encode',
  'dec': 'decode',
  'compress': 'compress',
  'decomp': 'decompress',
  'encr': 'encrypt',
  'decr': 'decrypt',
  'hash': 'hash',
  'sign': 'sign',
  'verify': 'verify',
  'auth': 'authenticate',
  'authz': 'authorize',
  'perm': 'permission',
  'role': 'role',
  'user': 'user',
  'team': 'team',
  'org': 'organization',
}

// =============================================================================
// String Normalization
// =============================================================================

/**
 * Normalize a string for comparison
 */
export function normalizeString(str: string): string {
  return str
    .toLowerCase()
    .trim()
    .replace(/[_\-\s]+/g, ' ')
    .replace(/[^\w\s]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
}

/**
 * Expand abbreviations in text
 */
export function expandAbbreviations(
  text: string,
  abbreviations: Record<string, string> = COMMON_ABBREVIATIONS
): string {
  const words = text.split(/\s+/)
  return words
    .map((word) => {
      const lower = word.toLowerCase()
      return abbreviations[lower] ?? word
    })
    .join(' ')
}

/**
 * Tokenize text into words
 */
export function tokenize(text: string): string[] {
  return normalizeString(text).split(/\s+/).filter(Boolean)
}

/**
 * Get n-grams from text
 */
export function getNgrams(text: string, n: number = 2): string[] {
  const normalized = normalizeString(text)
  const ngrams: string[] = []
  
  for (let i = 0; i <= normalized.length - n; i++) {
    ngrams.push(normalized.slice(i, i + n))
  }
  
  return ngrams
}

// =============================================================================
// Levenshtein Distance
// =============================================================================

/**
 * Compute Levenshtein distance between two strings
 */
export function levenshteinDistance(str1: string, str2: string): number {
  const m = str1.length
  const n = str2.length

  // Create distance matrix
  const dp: number[][] = Array.from({ length: m + 1 }, () => 
    Array.from({ length: n + 1 }, () => 0)
  )

  // Initialize first row and column
  for (let i = 0; i <= m; i++) dp[i][0] = i
  for (let j = 0; j <= n; j++) dp[0][j] = j

  // Fill in the rest
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      const cost = str1[i - 1] === str2[j - 1] ? 0 : 1
      dp[i][j] = Math.min(
        dp[i - 1][j] + 1,      // deletion
        dp[i][j - 1] + 1,      // insertion
        dp[i - 1][j - 1] + cost // substitution
      )
    }
  }

  return dp[m][n]
}

/**
 * Compute Levenshtein similarity (0-1)
 */
export function levenshteinSimilarity(str1: string, str2: string): number {
  if (str1.length === 0 && str2.length === 0) return 1
  if (str1.length === 0 || str2.length === 0) return 0

  const distance = levenshteinDistance(str1, str2)
  const maxLength = Math.max(str1.length, str2.length)
  
  return 1 - distance / maxLength
}

// =============================================================================
// Jaro-Winkler Distance
// =============================================================================

/**
 * Compute Jaro similarity between two strings
 */
export function jaroSimilarity(str1: string, str2: string): number {
  if (str1 === str2) return 1
  if (str1.length === 0 || str2.length === 0) return 0

  const matchWindow = Math.floor(Math.max(str1.length, str2.length) / 2) - 1
  
  const str1Matches = new Array(str1.length).fill(false)
  const str2Matches = new Array(str2.length).fill(false)

  let matches = 0
  let transpositions = 0

  // Find matches
  for (let i = 0; i < str1.length; i++) {
    const start = Math.max(0, i - matchWindow)
    const end = Math.min(i + matchWindow + 1, str2.length)

    for (let j = start; j < end; j++) {
      if (str2Matches[j] || str1[i] !== str2[j]) continue
      str1Matches[i] = true
      str2Matches[j] = true
      matches++
      break
    }
  }

  if (matches === 0) return 0

  // Count transpositions
  let k = 0
  for (let i = 0; i < str1.length; i++) {
    if (!str1Matches[i]) continue
    while (!str2Matches[k]) k++
    if (str1[i] !== str2[k]) transpositions++
    k++
  }

  return (
    (matches / str1.length + matches / str2.length + (matches - transpositions / 2) / matches) / 3
  )
}

/**
 * Compute Jaro-Winkler similarity (0-1)
 */
export function jaroWinklerSimilarity(str1: string, str2: string, scalingFactor: number = 0.1): number {
  const jaro = jaroSimilarity(str1, str2)

  // Find common prefix length (max 4)
  let prefixLength = 0
  for (let i = 0; i < Math.min(str1.length, str2.length, 4); i++) {
    if (str1[i] === str2[i]) prefixLength++
    else break
  }

  return jaro + prefixLength * scalingFactor * (1 - jaro)
}

// =============================================================================
// Text Similarity Manager
// =============================================================================

/**
 * Text Similarity Manager
 * 
 * Computes text similarity using various algorithms.
 */
export class TextSimilarityManager {
  private options: TextSimilarityOptions
  private abbreviations: Record<string, string>

  constructor(options: Partial<TextSimilarityOptions> = {}) {
    this.options = { ...DEFAULT_OPTIONS, ...options }
    this.abbreviations = {
      ...COMMON_ABBREVIATIONS,
      ...options.abbreviations,
    }
  }

  /**
   * Compute similarity between two texts
   */
  computeSimilarity(str1: string, str2: string): TextSimilarityResult {
    let text1 = str1
    let text2 = str2

    // Normalize if enabled
    if (this.options.normalize) {
      text1 = normalizeString(text1)
      text2 = normalizeString(text2)
    }

    // Expand abbreviations if enabled
    if (this.options.handleAbbreviations) {
      text1 = expandAbbreviations(text1, this.abbreviations)
      text2 = expandAbbreviations(text2, this.abbreviations)
    }

    // Calculate similarity based on algorithm
    let score: number
    let distance: number
    let maxDistance: number

    switch (this.options.algorithm) {
      case 'jaro-winkler':
        score = jaroWinklerSimilarity(text1, text2)
        distance = Math.round((1 - score) * Math.max(text1.length, text2.length))
        maxDistance = Math.max(text1.length, text2.length)
        break
      
      case 'hybrid':
        // Combine Levenshtein and Jaro-Winkler
        const levSim = levenshteinSimilarity(text1, text2)
        const jwSim = jaroWinklerSimilarity(text1, text2)
        score = (levSim + jwSim) / 2
        distance = levenshteinDistance(text1, text2)
        maxDistance = Math.max(text1.length, text2.length)
        break
      
      case 'levenshtein':
      default:
        distance = levenshteinDistance(text1, text2)
        maxDistance = Math.max(text1.length, text2.length)
        score = maxDistance > 0 ? 1 - distance / maxDistance : 1
        break
    }

    return {
      score,
      distance,
      maxDistance,
      normalized: {
        text1,
        text2,
      },
    }
  }

  /**
   * Compute similarity between two entities
   */
  computeEntitySimilarity(
    entity1: DedupEntity,
    entity2: DedupEntity,
    options: Partial<TextSimilarityOptions> = {}
  ): SimilarityResult {
    const mergedOptions = { ...this.options, ...options }
    const primaryWeight = mergedOptions.primaryWeight ?? 0.7
    const secondaryWeight = mergedOptions.secondaryWeight ?? 0.3

    // Compute primary text similarity
    const primaryResult = this.computeSimilarity(entity1.primaryText, entity2.primaryText)
    
    // Compute secondary text similarity if present
    let secondaryScore = 1
    if (entity1.secondaryText && entity2.secondaryText) {
      const secondaryResult = this.computeSimilarity(
        entity1.secondaryText,
        entity2.secondaryText
      )
      secondaryScore = secondaryResult.score
    } else if (entity1.secondaryText || entity2.secondaryText) {
      // If one has secondary text and the other doesn't, reduce similarity
      secondaryScore = 0.5
    }

    // Combine scores
    const combinedScore = primaryResult.score * primaryWeight + secondaryScore * secondaryWeight

    return {
      entityId1: entity1.id,
      entityId2: entity2.id,
      score: combinedScore,
      textSimilarity: primaryResult.score,
      isPotentialDuplicate: combinedScore >= 0.8,
      confidence: this.getConfidence(combinedScore),
      reason: `Text similarity: ${combinedScore.toFixed(4)} (primary: ${primaryResult.score.toFixed(4)}, secondary: ${secondaryScore.toFixed(4)})`,
    }
  }

  /**
   * Batch compute similarities
   */
  computeEntitySimilarities(
    entities: DedupEntity[],
    options: Partial<TextSimilarityOptions> = {}
  ): SimilarityResult[] {
    const results: SimilarityResult[] = []

    for (let i = 0; i < entities.length; i++) {
      for (let j = i + 1; j < entities.length; j++) {
        results.push(this.computeEntitySimilarity(entities[i], entities[j], options))
      }
    }

    return results
  }

  /**
   * Find similar strings in a list
   */
  findSimilar(
    query: string,
    candidates: string[],
    threshold: number = 0.8
  ): Array<{ text: string; score: number; distance: number }> {
    const results: Array<{ text: string; score: number; distance: number }> = []

    for (const candidate of candidates) {
      const result = this.computeSimilarity(query, candidate)
      if (result.score >= threshold) {
        results.push({
          text: candidate,
          score: result.score,
          distance: result.distance,
        })
      }
    }

    return results.sort((a, b) => b.score - a.score)
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
   * Register custom abbreviation
   */
  registerAbbreviation(abbr: string, expansion: string): void {
    this.abbreviations[abbr.toLowerCase()] = expansion.toLowerCase()
  }

  /**
   * Get registered abbreviations
   */
  getAbbreviations(): Record<string, string> {
    return { ...this.abbreviations }
  }
}

// =============================================================================
// Factory Functions
// =============================================================================

/**
 * Create a text similarity manager with Levenshtein algorithm
 */
export function createLevenshteinManager(options: Partial<TextSimilarityOptions> = {}): TextSimilarityManager {
  return new TextSimilarityManager({
    ...options,
    algorithm: 'levenshtein',
  })
}

/**
 * Create a text similarity manager with Jaro-Winkler algorithm
 */
export function createJaroWinklerManager(options: Partial<TextSimilarityOptions> = {}): TextSimilarityManager {
  return new TextSimilarityManager({
    ...options,
    algorithm: 'jaro-winkler',
  })
}

/**
 * Create a text similarity manager with hybrid algorithm
 */
export function createHybridTextManager(options: Partial<TextSimilarityOptions> = {}): TextSimilarityManager {
  return new TextSimilarityManager({
    ...options,
    algorithm: 'hybrid',
  })
}

/**
 * Create a text similarity manager
 */
export function createTextManager(options: Partial<TextSimilarityOptions> = {}): TextSimilarityManager {
  return new TextSimilarityManager(options)
}

// =============================================================================
// Default Export
// =============================================================================

export default TextSimilarityManager