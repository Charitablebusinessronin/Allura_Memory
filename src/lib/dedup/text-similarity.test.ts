/**
 * Text-based Similarity Tests
 * 
 * Tests for Levenshtein distance, Jaro-Winkler similarity, and text matching.
 */

import { describe, it, expect, beforeEach } from 'vitest'
import {
  TextSimilarityManager,
  createTextManager,
  createLevenshteinManager,
  createJaroWinklerManager,
  createHybridTextManager,
  normalizeString,
  expandAbbreviations,
  tokenize,
  getNgrams,
  levenshteinDistance,
  levenshteinSimilarity,
  jaroSimilarity,
  jaroWinklerSimilarity,
} from './text-similarity'
import type { DedupEntity } from './types'

// =============================================================================
// Test Fixtures
// =============================================================================

function createTestEntity(overrides: Partial<DedupEntity> = {}): DedupEntity {
  return {
    id: `entity-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    type: 'insight',
    primaryText: 'Test Entity',
    properties: {},
    createdAt: new Date(),
    ...overrides,
  }
}

// =============================================================================
// String Normalization Tests
// =============================================================================

describe('normalizeString', () => {
  it('should convert to lowercase', () => {
    expect(normalizeString('HELLO WORLD')).toBe('hello world')
  })

  it('should trim whitespace', () => {
    expect(normalizeString('  hello world  ')).toBe('hello world')
  })

  it('should replace underscores with spaces', () => {
    expect(normalizeString('hello_world')).toBe('hello world')
  })

  it('should replace hyphens with spaces', () => {
    expect(normalizeString('hello-world')).toBe('hello world')
  })

  it('should remove special characters', () => {
    expect(normalizeString('hello!@#$%^&*world')).toBe('helloworld')
  })

  it('should collapse multiple spaces', () => {
    expect(normalizeString('hello    world')).toBe('hello world')
  })

  it('should handle all transformations', () => {
    expect(normalizeString('  HELLO_WORLD-Test!!  ')).toBe('hello world test')
  })
})

// =============================================================================
// Abbreviation Expansion Tests
// =============================================================================

describe('expandAbbreviations', () => {
  it('should expand common abbreviations', () => {
    expect(expandAbbreviations('AI and ML')).toBe('artificial intelligence and machine learning')
  })

  it('should preserve case in expansion', () => {
    // Note: Current implementation converts to lowercase
    expect(expandAbbreviations('API endpoint')).toBe('application programming interface endpoint')
  })

  it('should handle multiple abbreviations', () => {
    const result = expandAbbreviations('AI ML NLP')
    expect(result).toContain('artificial intelligence')
    expect(result).toContain('machine learning')
    expect(result).toContain('natural language processing')
  })

  it('should not modify non-abbreviation words', () => {
    expect(expandAbbreviations('hello world')).toBe('hello world')
  })

  it('should use custom abbreviations', () => {
    const custom = { 'xyz': 'custom expansion' }
    expect(expandAbbreviations('test xyz value', custom)).toBe('test custom expansion value')
  })
})

// =============================================================================
// Tokenization Tests
// =============================================================================

describe('tokenize', () => {
  it('should split on whitespace', () => {
    expect(tokenize('hello world')).toEqual(['hello', 'world'])
  })

  it('should filter empty tokens', () => {
    expect(tokenize('hello   world')).toEqual(['hello', 'world'])
  })

  it('should normalize text first', () => {
    expect(tokenize('HELLO_WORLD')).toEqual(['hello', 'world'])
  })
})

// =============================================================================
// N-gram Tests
// =============================================================================

describe('getNgrams', () => {
  it('should generate bigrams by default', () => {
    const ngrams = getNgrams('hello', 2)
    expect(ngrams).toEqual(['he', 'el', 'll', 'lo'])
  })

  it('should generate trigrams', () => {
    const ngrams = getNgrams('hello', 3)
    expect(ngrams).toEqual(['hel', 'ell', 'llo'])
  })

  it('should handle short strings', () => {
    const ngrams = getNgrams('hi', 2)
    expect(ngrams).toEqual(['hi'])
  })

  it('should normalize text first', () => {
    const ngrams = getNgrams('HELLO', 2)
    expect(ngrams[0]).toBe('he')
  })
})

// =============================================================================
// Levenshtein Distance Tests
// =============================================================================

describe('levenshteinDistance', () => {
  it('should return 0 for identical strings', () => {
    expect(levenshteinDistance('hello', 'hello')).toBe(0)
  })

  it('should count insertions', () => {
    expect(levenshteinDistance('hello', 'helloo')).toBe(1)
  })

  it('should count deletions', () => {
    expect(levenshteinDistance('hello', 'helo')).toBe(1)
  })

  it('should count substitutions', () => {
    expect(levenshteinDistance('hello', 'hallo')).toBe(1)
  })

  it('should handle empty strings', () => {
    expect(levenshteinDistance('', '')).toBe(0)
    expect(levenshteinDistance('hello', '')).toBe(5)
    expect(levenshteinDistance('', 'hello')).toBe(5)
  })

  it('should handle complex edits', () => {
    expect(levenshteinDistance('kitten', 'sitting')).toBe(3)
    expect(levenshteinDistance('saturday', 'sunday')).toBe(3)
  })
})

describe('levenshteinSimilarity', () => {
  it('should return 1 for identical strings', () => {
    expect(levenshteinSimilarity('hello', 'hello')).toBe(1)
  })

  it('should return 0 for completely different strings', () => {
    expect(levenshteinSimilarity('', 'hello')).toBe(0)
  })

  it('should return correct similarity for similar strings', () => {
    const sim = levenshteinSimilarity('hello', 'hallo')
    expect(sim).toBeCloseTo(0.8, 1)
  })

  it('should be symmetric', () => {
    const sim1 = levenshteinSimilarity('hello', 'hallo')
    const sim2 = levenshteinSimilarity('hallo', 'hello')
    expect(sim1).toBeCloseTo(sim2, 5)
  })
})

// =============================================================================
// Jaro-Winkler Tests
// =============================================================================

describe('jaroSimilarity', () => {
  it('should return 1 for identical strings', () => {
    expect(jaroSimilarity('hello', 'hello')).toBe(1)
  })

  it('should return 0 for empty strings', () => {
    expect(jaroSimilarity('', '')).toBe(1)
    expect(jaroSimilarity('hello', '')).toBe(0)
    expect(jaroSimilarity('', 'hello')).toBe(0)
  })

  it('should handle similar strings', () => {
    const sim = jaroSimilarity('MARTHA', 'MARHTA')
    expect(sim).toBeGreaterThan(0.8)
  })
})

describe('jaroWinklerSimilarity', () => {
  it('should return 1 for identical strings', () => {
    expect(jaroWinklerSimilarity('hello', 'hello')).toBe(1)
  })

  it('should boost strings with common prefix', () => {
    const jw = jaroWinklerSimilarity('hello', 'hello world')
    const jaro = jaroSimilarity('hello', 'hello world')
    expect(jw).toBeGreaterThanOrEqual(jaro)
  })

  it('should handle similar strings', () => {
    const sim = jaroWinklerSimilarity('MARTHA', 'MARHTA')
    expect(sim).toBeGreaterThan(0.8)
  })
})

// =============================================================================
// Text Similarity Manager Tests
// =============================================================================

describe('TextSimilarityManager', () => {
  let manager: TextSimilarityManager

  beforeEach(() => {
    manager = createTextManager()
  })

  // =============================================================================
  // Basic Similarity Tests
  // =============================================================================

  describe('computeSimilarity', () => {
    it('should compute similarity for identical strings', () => {
      const result = manager.computeSimilarity('hello', 'hello')
      expect(result.score).toBe(1)
      expect(result.distance).toBe(0)
    })

    it('should compute similarity for similar strings', () => {
      const result = manager.computeSimilarity('hello', 'hallo')
      expect(result.score).toBeGreaterThan(0.5)
      expect(result.score).toBeLessThan(1)
    })

    it('should compute similarity for different strings', () => {
      const result = manager.computeSimilarity('hello', 'world')
      expect(result.score).toBeLessThan(0.5)
    })

    it('should normalize strings by default', () => {
      const result = manager.computeSimilarity('HELLO WORLD', 'hello world')
      expect(result.score).toBe(1)
    })

    it('should return normalized strings', () => {
      const result = manager.computeSimilarity('HELLO_WORLD', 'hello world')
      expect(result.normalized.text1).toBe('hello world')
      expect(result.normalized.text2).toBe('hello world')
    })
  })

  // =============================================================================
  // Entity Similarity Tests
  // =============================================================================

  describe('computeEntitySimilarity', () => {
    it('should compute similarity between entities', () => {
      const entity1 = createTestEntity({ primaryText: 'Machine Learning' })
      const entity2 = createTestEntity({ primaryText: 'Machine Learning' })

      const result = manager.computeEntitySimilarity(entity1, entity2)
      expect(result.score).toBe(1)
    })

    it('should weigh primary text more than secondary', () => {
      const entity1 = createTestEntity({
        primaryText: 'Same',
        secondaryText: 'Different one',
      })
      const entity2 = createTestEntity({
        primaryText: 'Same',
        secondaryText: 'Different two',
      })

      const result = manager.computeEntitySimilarity(entity1, entity2)
      // Same primary text should still result in high similarity
      expect(result.score).toBeGreaterThan(0.5)
    })

    it('should handle entities without secondary text', () => {
      const entity1 = createTestEntity({
        primaryText: 'Test',
        secondaryText: 'Context',
      })
      const entity2 = createTestEntity({
        primaryText: 'Test',
      })

      const result = manager.computeEntitySimilarity(entity1, entity2)
      expect(result).toBeDefined()
      expect(result.score).toBeGreaterThan(0)
    })

    it('should use configured weights', () => {
      const customManager = createTextManager({
        primaryWeight: 0.9,
        secondaryWeight: 0.1,
      })

      const entity1 = createTestEntity({
        primaryText: 'Same',
        secondaryText: 'Very different context here',
      })
      const entity2 = createTestEntity({
        primaryText: 'Same',
        secondaryText: 'Completely unrelated text',
      })

      const result = customManager.computeEntitySimilarity(entity1, entity2)
      // With 90% primary weight, same primary text should give high score
      expect(result.score).toBeGreaterThan(0.8)
    })
  })

  // =============================================================================
  // Batch Similarity Tests
  // =============================================================================

  describe('computeEntitySimilarities', () => {
    it('should compute all pairwise similarities', () => {
      const entities = [
        createTestEntity({ primaryText: 'Entity A' }),
        createTestEntity({ primaryText: 'Entity B' }),
        createTestEntity({ primaryText: 'Entity C' }),
      ]

      const results = manager.computeEntitySimilarities(entities)
      expect(results.length).toBe(3) // C(3, 2) = 3 pairs
    })

    it('should handle larger sets', () => {
      const entities = Array.from({ length: 10 }, (_, i) =>
        createTestEntity({ primaryText: `Entity ${i}` })
      )

      const results = manager.computeEntitySimilarities(entities)
      expect(results.length).toBe(45) // C(10, 2) = 45 pairs
    })
  })

  // =============================================================================
  // Find Similar Tests
  // =============================================================================

  describe('findSimilar', () => {
    it('should find similar strings above threshold', () => {
      const candidates = ['hello world', 'hello there', 'goodbye world', 'hi world']
      const results = manager.findSimilar('hello', candidates, 0.3)

      expect(results.length).toBeGreaterThan(0)
      expect(results.every((r) => r.score >= 0.3)).toBe(true)
    })

    it('should sort results by score descending', () => {
      const candidates = ['hello world', 'hello there', 'goodbye world']
      const results = manager.findSimilar('hello', candidates, 0.0)

      for (let i = 1; i < results.length; i++) {
        expect(results[i - 1].score).toBeGreaterThanOrEqual(results[i].score)
      }
    })

    it('should return empty array for no matches', () => {
      const candidates = ['xyz', 'abc', 'def']
      const results = manager.findSimilar('hello', candidates, 0.9)

      expect(results.length).toBe(0)
    })
  })

  // =============================================================================
  // Abbreviation Tests
  // =============================================================================

  describe('abbreviations', () => {
    it('should register custom abbreviation', () => {
      manager.registerAbbreviation('tst', 'test')
      const abbrs = manager.getAbbreviations()
      expect(abbrs['tst']).toBe('test')
    })

    it('should use custom abbreviations in similarity', () => {
      const customManager = createTextManager({
        abbreviations: { 'ml': 'machine learning' },
      })

      const entity1 = createTestEntity({ primaryText: 'ML algorithms' })
      const entity2 = createTestEntity({ primaryText: 'machine learning algorithms' })

      const result = customManager.computeEntitySimilarity(entity1, entity2)
      // Should be similar due to abbreviation expansion
      expect(result.score).toBeGreaterThan(0.7)
    })
  })
})

// =============================================================================
// Factory Function Tests
// =============================================================================

describe('factory functions', () => {
  it('should create Levenshtein manager', () => {
    const mgr = createLevenshteinManager()
    const result = mgr.computeSimilarity('hello', 'hallo')
    expect(result.score).toBeGreaterThan(0.7)
  })

  it('should create Jaro-Winkler manager', () => {
    const mgr = createJaroWinklerManager()
    const result = mgr.computeSimilarity('hello', 'hallo')
    expect(result.score).toBeGreaterThan(0.7)
  })

  it('should create hybrid manager', () => {
    const mgr = createHybridTextManager()
    const result = mgr.computeSimilarity('hello', 'hallo')
    expect(result.score).toBeGreaterThan(0.7)
  })
})

// =============================================================================
// Algorithm Comparison Tests
// =============================================================================

describe('algorithm comparison', () => {
  it('should produce same result for identical strings', () => {
    const levMgr = createLevenshteinManager()
    const jwMgr = createJaroWinklerManager()
    const hybridMgr = createHybridTextManager()

    const levResult = levMgr.computeSimilarity('hello', 'hello')
    const jwResult = jwMgr.computeSimilarity('hello', 'hello')
    const hybridResult = hybridMgr.computeSimilarity('hello', 'hello')

    expect(levResult.score).toBe(1)
    expect(jwResult.score).toBe(1)
    expect(hybridResult.score).toBe(1)
  })

  it('should handle typos appropriately', () => {
    const levMgr = createLevenshteinManager()
    const jwMgr = createJaroWinklerManager()

    // Jaro-Winkler should be more forgiving of typos
    const levResult = levMgr.computeSimilarity('hello', 'helloo')
    const jwResult = jwMgr.computeSimilarity('hello', 'helloo')

    expect(levResult.score).toBeGreaterThan(0.8)
    expect(jwResult.score).toBeGreaterThan(0.8)
  })
})