import { describe, expect, it } from 'vitest'

import {
  DUPLICATE_THRESHOLD,
  POSSIBLE_SUPERSEDE_THRESHOLD,
  RELATED_CONTEXT_THRESHOLD,
  classifyInsightSimilarity,
  evaluateInsightDuplicates,
  getInsightDuplicateRecommendation,
  type ExistingInsightCandidate,
} from './insight-duplicate'
import type { EmbeddingManager } from './embeddings'
import type { TextSimilarityManager } from './text-similarity'
import type { EmbeddingVector } from './types'

class FakeEmbeddingManager {
  constructor(
    private readonly vectors: Record<string, EmbeddingVector>,
  ) {}

  async getEmbeddings(): Promise<Map<string, EmbeddingVector>> {
    return new Map(Object.entries(this.vectors))
  }

  cosineSimilarity(vec1: EmbeddingVector, vec2: EmbeddingVector): number {
    let dotProduct = 0
    let norm1 = 0
    let norm2 = 0

    for (let index = 0; index < vec1.length; index += 1) {
      dotProduct += vec1[index] * vec2[index]
      norm1 += vec1[index] * vec1[index]
      norm2 += vec2[index] * vec2[index]
    }

    return dotProduct / (Math.sqrt(norm1) * Math.sqrt(norm2))
  }
}

class FakeTextManager {
  constructor(
    private readonly scores: Record<string, number>,
  ) {}

  computeSimilarity(text1: string, text2: string): { score: number } {
    return {
      score: this.scores[`${text1}::${text2}`] ?? 0,
    }
  }
}

function createInsight(
  id: string,
  summary: string,
  confidence: number = 0.8,
  status: string = 'Approved',
): ExistingInsightCandidate {
  return { id, summary, confidence, status }
}

describe('classifyInsightSimilarity', () => {
  it('classifies duplicate threshold correctly', () => {
    expect(classifyInsightSimilarity(DUPLICATE_THRESHOLD)).toBe('duplicate')
    expect(classifyInsightSimilarity(0.95)).toBe('duplicate')
  })

  it('classifies possible supersede threshold correctly', () => {
    expect(classifyInsightSimilarity(POSSIBLE_SUPERSEDE_THRESHOLD)).toBe('possible_supersede')
    expect(classifyInsightSimilarity(0.85)).toBe('possible_supersede')
  })

  it('classifies related context threshold correctly', () => {
    expect(classifyInsightSimilarity(RELATED_CONTEXT_THRESHOLD)).toBe('related_context')
    expect(classifyInsightSimilarity(0.7)).toBe('related_context')
  })

  it('classifies low scores as safe to promote', () => {
    expect(classifyInsightSimilarity(0.5)).toBe('safe_to_promote')
  })
})

describe('getInsightDuplicateRecommendation', () => {
  it('returns recommendation for each class', () => {
    expect(getInsightDuplicateRecommendation('duplicate')).toContain('Do not auto-promote')
    expect(getInsightDuplicateRecommendation('possible_supersede')).toContain('Queue for review')
    expect(getInsightDuplicateRecommendation('related_context')).toContain('Safe to promote with related context')
    expect(getInsightDuplicateRecommendation('safe_to_promote')).toBe('Safe to promote')
  })
})

describe('evaluateInsightDuplicates', () => {
  const candidateSummary = 'Use qwen3 embedding model for semantic duplicate detection'
  const embeddings: Record<string, EmbeddingVector> = {
    'candidate-insight': [1, 0, 0],
    duplicate: [0.99, 0.01, 0],
    supersede: [0.86, 0.14, 0],
    related: [0.7, 0.3, 0],
    unrelated: [0, 1, 0],
  }

  const lexicalScores: Record<string, number> = {
    [`${candidateSummary}::Exact same semantic meaning phrased differently`]: 0.85,
    [`${candidateSummary}::Broader earlier version of the same idea`]: 0.74,
    [`${candidateSummary}::Related retrieval context for embeddings`]: 0.6,
    [`${candidateSummary}::Totally unrelated operational event`]: 0.05,
  }

  const embeddingManager = new FakeEmbeddingManager(embeddings) as unknown as EmbeddingManager
  const textManager = new FakeTextManager(lexicalScores) as unknown as TextSimilarityManager

  it('returns safe_to_promote when there are no existing insights', async () => {
    const result = await evaluateInsightDuplicates(candidateSummary, [], DUPLICATE_THRESHOLD, {
      embeddingManager,
      textManager,
    })

    expect(result.decision).toBe('safe_to_promote')
    expect(result.matches).toHaveLength(0)
    expect(result.topMatch).toBeNull()
  })

  it('returns duplicate for the highest semantic overlap', async () => {
    const result = await evaluateInsightDuplicates(
      candidateSummary,
      [createInsight('duplicate', 'Exact same semantic meaning phrased differently')],
      DUPLICATE_THRESHOLD,
      { embeddingManager, textManager },
    )

    expect(result.decision).toBe('duplicate')
    expect(result.topMatch?.id).toBe('duplicate')
    expect(result.topMatch?.classification).toBe('duplicate')
    expect(result.topMatch?.embeddingScore).toBeGreaterThan(0.98)
  })

  it('returns possible_supersede for medium-high overlap', async () => {
    const result = await evaluateInsightDuplicates(
      candidateSummary,
      [createInsight('supersede', 'Broader earlier version of the same idea')],
      DUPLICATE_THRESHOLD,
      { embeddingManager, textManager },
    )

    expect(result.decision).toBe('possible_supersede')
    expect(result.topMatch?.id).toBe('supersede')
  })

  it('returns related_context for semantically relevant but non-duplicate content', async () => {
    const result = await evaluateInsightDuplicates(
      candidateSummary,
      [createInsight('related', 'Related retrieval context for embeddings')],
      DUPLICATE_THRESHOLD,
      { embeddingManager, textManager },
    )

    expect(result.decision).toBe('related_context')
    expect(result.topMatch?.id).toBe('related')
  })


  it('honors threshold overrides when classifying results', async () => {
    const result = await evaluateInsightDuplicates(
      candidateSummary,
      [createInsight('supersede', 'Broader earlier version of the same idea')],
      0.95,
      { embeddingManager, textManager },
    )

    expect(result.thresholds.duplicate).toBe(0.95)
    expect(result.thresholds.possibleSupersede).toBe(0.85)
    expect(result.decision).toBe('possible_supersede')
  })

  it('sorts matches by descending final score', async () => {
    const result = await evaluateInsightDuplicates(
      candidateSummary,
      [
        createInsight('related', 'Related retrieval context for embeddings'),
        createInsight('duplicate', 'Exact same semantic meaning phrased differently'),
        createInsight('supersede', 'Broader earlier version of the same idea'),
        createInsight('unrelated', 'Totally unrelated operational event'),
      ],
      DUPLICATE_THRESHOLD,
      { embeddingManager, textManager },
    )

    expect(result.matches.map((match) => match.id)).toEqual([
      'duplicate',
      'supersede',
      'related',
    ])
  })
})
