import { describe, expect, it, vi } from 'vitest'

import * as duplicateModule from '@/lib/dedup/insight-duplicate'
import type { NotionInsightRecord, Neo4jInsight } from './types'
import { checkDuplicate } from './dedupe'

const baseInsight: Neo4jInsight = {
  id: 'insight-1',
  title: 'Embedding duplicate detection',
  summary: 'Use embedding similarity for duplicate detection in curator flow',
  confidence: 0.9,
  canonicalTag: 'difference-driven',
  sourceProject: 'Difference Driven',
  status: 'Proposed',
}

const baseRecord: NotionInsightRecord = {
  pageId: 'page-1',
  title: 'Existing idea',
  summary: 'Existing related insight summary',
  confidence: 0.8,
  canonicalTag: 'difference-driven',
  displayTags: ['Difference driven'],
  status: 'Approved',
  aiAccessible: true,
  sourceInsightId: 'existing-1',
  sourceProject: 'Difference Driven',
}

describe('checkDuplicate', () => {
  it('blocks hard duplicates and carries review context', async () => {
    vi.spyOn(duplicateModule, 'evaluateInsightDuplicates').mockResolvedValueOnce({
      decision: 'duplicate',
      threshold: 0.9,
      thresholds: { duplicate: 0.9, possibleSupersede: 0.8, relatedContext: 0.65 },
      topMatch: {
        id: 'existing-1',
        summary: 'Existing related insight summary',
        confidence: 0.8,
        status: 'Approved',
        lexicalScore: 0.8,
        embeddingScore: 0.95,
        finalScore: 0.89,
        classification: 'duplicate',
      },
      matches: [],
      recommendation: 'Do not auto-promote - likely duplicate insight exists',
      evaluatorVersion: duplicateModule.INSIGHT_DUPLICATE_EVALUATOR_VERSION,
    })

    const result = await checkDuplicate(baseInsight, [baseRecord])

    expect(result.isDuplicate).toBe(true)
    expect(result.shouldBlock).toBe(true)
    expect(result.existingPageId).toBe('page-1')
    expect(result.reviewContext?.decision).toBe('duplicate')
  })

  it('allows possible supersede through review flow with context', async () => {
    vi.spyOn(duplicateModule, 'evaluateInsightDuplicates').mockResolvedValueOnce({
      decision: 'possible_supersede',
      threshold: 0.9,
      thresholds: { duplicate: 0.9, possibleSupersede: 0.8, relatedContext: 0.65 },
      topMatch: {
        id: 'existing-1',
        summary: 'Existing related insight summary',
        confidence: 0.8,
        status: 'Approved',
        lexicalScore: 0.7,
        embeddingScore: 0.88,
        finalScore: 0.81,
        classification: 'possible_supersede',
      },
      matches: [],
      recommendation: 'Queue for review - likely supersede or revision of existing insight',
      evaluatorVersion: duplicateModule.INSIGHT_DUPLICATE_EVALUATOR_VERSION,
    })

    const result = await checkDuplicate(baseInsight, [baseRecord])

    expect(result.isDuplicate).toBe(false)
    expect(result.shouldBlock).toBe(false)
    expect(result.reviewContext?.decision).toBe('possible_supersede')
  })
})
