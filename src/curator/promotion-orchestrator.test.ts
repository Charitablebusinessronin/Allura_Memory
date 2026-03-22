import { describe, expect, it } from 'vitest'

import {
  createNeo4jDuplicateReviewProvider,
  createPromotionOrchestrator,
  toReviewContextDisplay,
} from './promotion-orchestrator'
import type { DuplicateReviewResult, ExistingInsightCandidate } from '@/lib/dedup/insight-duplicate'
import type { Neo4jInsight } from './types'

describe('PromotionOrchestrator', () => {
  it('returns duplicate review metadata with latency and evaluator version', async () => {
    const candidates: ExistingInsightCandidate[] = [
      {
        id: 'insight-1',
        summary: 'Use semantic duplicate detection for insight promotion',
        confidence: 0.9,
        status: 'Approved',
      },
    ]

    const orchestrator = createPromotionOrchestrator(
      createNeo4jDuplicateReviewProvider(candidates),
      async (): Promise<DuplicateReviewResult> => ({
        decision: 'duplicate',
        threshold: 0.9,
        thresholds: { duplicate: 0.9, possibleSupersede: 0.8, relatedContext: 0.65 },
        topMatch: {
          id: 'insight-1',
          summary: 'Use semantic duplicate detection for insight promotion',
          confidence: 0.9,
          status: 'Approved',
          lexicalScore: 1,
          embeddingScore: 1,
          finalScore: 1,
          classification: 'duplicate',
        },
        matches: [],
        recommendation: 'Do not auto-promote - likely duplicate insight exists',
        evaluatorVersion: 'test-version',
      }),
    )

    const result = await orchestrator.reviewDuplicate({
      canonicalTag: 'difference-driven',
      summary: 'Use semantic duplicate detection for insight promotion',
    })

    expect(result.evaluatorVersion).toBe('test-version')
    expect(result.latencyMs).toBeGreaterThanOrEqual(0)
    expect(result.candidateCount).toBe(1)
    expect(result.measuredAt).toBeTruthy()
    expect(result.decision).toBe('duplicate')
  })

  it('maps orchestrator output into review context display', () => {
    const display = toReviewContextDisplay({
      decision: 'related_context',
      threshold: 0.9,
      thresholds: { duplicate: 0.9, possibleSupersede: 0.8, relatedContext: 0.65 },
      topMatch: null,
      matches: [],
      recommendation: 'Safe to promote with related context attached',
      evaluatorVersion: 'test-version',
      latencyMs: 12,
      candidateCount: 4,
      measuredAt: '2026-03-20T00:00:00.000Z',
    })

    expect(display.latencyMs).toBe(12)
    expect(display.candidateCount).toBe(4)
    expect(display.evaluatorVersion).toBe('test-version')
  })

  it('writes optional duplicate review properties only when schema supports them', () => {
    const orchestrator = createPromotionOrchestrator()
    const insight: Neo4jInsight = {
      id: 'insight-1',
      title: 'Embedding promotion',
      summary: 'Promote embedding-backed duplicate review',
      confidence: 0.88,
      canonicalTag: 'difference-driven',
      sourceProject: 'Difference Driven',
      status: 'Proposed',
    }

    const payload = orchestrator.buildPromotionPayload(
      insight,
      'Difference driven',
      {
        decision: 'possible_supersede',
        thresholds: { duplicate: 0.9, possibleSupersede: 0.8, relatedContext: 0.65 },
        recommendation: 'Queue for review - likely supersede or revision of existing insight',
        topMatch: {
          id: 'prior-1',
          summary: 'Earlier insight',
          confidence: 0.8,
          status: 'Approved',
          lexicalScore: 0.7,
          embeddingScore: 0.9,
          finalScore: 0.82,
          classification: 'possible_supersede',
        },
        matches: [],
        evaluatorVersion: 'test-version',
        latencyMs: 10,
        candidateCount: 3,
        measuredAt: '2026-03-20T00:00:00.000Z',
      },
      new Set([
        'Duplicate Of',
        'Rationale',
        'Duplicate Review Decision',
        'Duplicate Review Latency Ms',
      ]),
    )

    const properties = payload.properties as Record<string, unknown>
    expect(properties['Duplicate Of']).toBeDefined()
    expect(properties['Duplicate Review Decision']).toBeDefined()
    expect(properties['Duplicate Review Latency Ms']).toBeDefined()
    expect(properties['Duplicate Final Score']).toBeUndefined()
  })

  it('builds revoke payload that preserves history and disables AI access', () => {
    const orchestrator = createPromotionOrchestrator()
    const payload = orchestrator.buildRevokeUpdatePayload(
      'page-1',
      'Incorrect policy promotion',
      'Sabir',
      new Set(['Rationale', 'Revoked By', 'Revoked At'])
    )

    const properties = payload.properties as Record<string, any>
    expect(properties.Status.select.name).toBe('Revoked')
    expect(properties['Review Status'].select.name).toBe('Completed')
    expect(properties['AI Accessible'].checkbox).toBe(false)
    expect(properties.Rationale).toBeDefined()
    expect(properties['Revoked By']).toBeDefined()
    expect(properties['Revoked At']).toBeDefined()
  })

})
