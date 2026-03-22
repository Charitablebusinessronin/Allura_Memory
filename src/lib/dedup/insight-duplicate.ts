import { createDefaultEmbeddingManager, type EmbeddingManager } from './embeddings'
import { createTextManager, type TextSimilarityManager } from './text-similarity'
import type { DedupEntity } from './types'

export const INSIGHT_DUPLICATE_EVALUATOR_VERSION = '2026-03-20.hybrid-v1'

export const DUPLICATE_THRESHOLD = 0.9
export const POSSIBLE_SUPERSEDE_THRESHOLD = 0.8
export const RELATED_CONTEXT_THRESHOLD = 0.65

export type InsightDuplicateDecision =
  | 'duplicate'
  | 'possible_supersede'
  | 'related_context'
  | 'safe_to_promote'

export interface ExistingInsightCandidate {
  id: string
  summary: string
  confidence: number
  status: string
}

export interface InsightDuplicateMatch extends ExistingInsightCandidate {
  lexicalScore: number
  embeddingScore: number
  finalScore: number
  classification: Exclude<InsightDuplicateDecision, 'safe_to_promote'>
}

export interface DuplicateReviewResult {
  decision: InsightDuplicateDecision
  threshold: number
  thresholds: {
    duplicate: number
    possibleSupersede: number
    relatedContext: number
  }
  topMatch: InsightDuplicateMatch | null
  matches: InsightDuplicateMatch[]
  recommendation: string
  evaluatorVersion: string
}

interface SimilarityDependencies {
  embeddingManager?: EmbeddingManager
  textManager?: TextSimilarityManager
}

let sharedEmbeddingManager: EmbeddingManager | null = null

function clampSimilarity(value: number): number {
  if (Number.isNaN(value)) {
    return 0
  }

  if (value < 0) {
    return 0
  }

  if (value > 1) {
    return 1
  }

  return value
}

function createInsightEntity(id: string, summary: string): DedupEntity {
  return {
    id,
    type: 'insight',
    primaryText: summary,
    properties: {},
    createdAt: new Date(0),
  }
}

function buildThresholds(duplicateThreshold: number): {
  duplicate: number
  possibleSupersede: number
  relatedContext: number
} {
  const duplicate = clampSimilarity(duplicateThreshold)
  const possibleSupersede = clampSimilarity(Math.max(RELATED_CONTEXT_THRESHOLD, duplicate - 0.1))
  const relatedContext = clampSimilarity(Math.max(0, duplicate - 0.25))

  return {
    duplicate,
    possibleSupersede,
    relatedContext,
  }
}

function getSharedEmbeddingManager(): EmbeddingManager {
  const hasOllamaConfig = Boolean(process.env.OLLAMA_BASE_URL || process.env.OLLAMA_EMBEDDING_MODEL)
  const hasOpenAiConfig = Boolean(process.env.OPENAI_API_KEY)

  if (!hasOllamaConfig && !hasOpenAiConfig) {
    throw new Error(
      'Embedding provider is not configured for duplicate detection. Set OLLAMA_BASE_URL/OLLAMA_EMBEDDING_MODEL or OPENAI_API_KEY.',
    )
  }

  if (!sharedEmbeddingManager) {
    sharedEmbeddingManager = createDefaultEmbeddingManager()
  }

  return sharedEmbeddingManager
}

export function classifyInsightSimilarity(
  score: number,
  thresholds: { duplicate: number; possibleSupersede: number; relatedContext: number } = {
    duplicate: DUPLICATE_THRESHOLD,
    possibleSupersede: POSSIBLE_SUPERSEDE_THRESHOLD,
    relatedContext: RELATED_CONTEXT_THRESHOLD,
  },
): InsightDuplicateDecision {
  if (score >= thresholds.duplicate) {
    return 'duplicate'
  }

  if (score >= thresholds.possibleSupersede) {
    return 'possible_supersede'
  }

  if (score >= thresholds.relatedContext) {
    return 'related_context'
  }

  return 'safe_to_promote'
}

export function getInsightDuplicateRecommendation(
  decision: InsightDuplicateDecision,
): string {
  switch (decision) {
    case 'duplicate':
      return 'Do not auto-promote - likely duplicate insight exists'
    case 'possible_supersede':
      return 'Queue for review - likely supersede or revision of existing insight'
    case 'related_context':
      return 'Safe to promote with related context attached'
    case 'safe_to_promote':
    default:
      return 'Safe to promote'
  }
}

export type InsightDuplicateEvaluation = DuplicateReviewResult

export async function evaluateInsightDuplicates(
  summary: string,
  existingInsights: ExistingInsightCandidate[],
  threshold: number = DUPLICATE_THRESHOLD,
  dependencies: SimilarityDependencies = {},
): Promise<InsightDuplicateEvaluation> {
  const thresholds = buildThresholds(threshold)

  if (existingInsights.length === 0) {
    return {
      decision: 'safe_to_promote',
      threshold,
      thresholds,
      topMatch: null,
      matches: [],
      recommendation: getInsightDuplicateRecommendation('safe_to_promote'),
      evaluatorVersion: INSIGHT_DUPLICATE_EVALUATOR_VERSION,
    }
  }

  const embeddingManager = dependencies.embeddingManager ?? getSharedEmbeddingManager()
  const textManager = dependencies.textManager ?? createTextManager({ algorithm: 'hybrid' })

  const candidateEntity = createInsightEntity('candidate-insight', summary)
  const existingEntities = existingInsights.map((insight) =>
    createInsightEntity(insight.id, insight.summary),
  )

  const embeddings = await embeddingManager.getEmbeddings([
    candidateEntity,
    ...existingEntities,
  ])

  const candidateVector = embeddings.get(candidateEntity.id)

  if (!candidateVector) {
    throw new Error('Failed to generate embedding for candidate insight')
  }

  const matches: InsightDuplicateMatch[] = existingInsights
    .map((insight) => {
      const existingVector = embeddings.get(insight.id)

      if (!existingVector) {
        throw new Error(`Failed to generate embedding for existing insight ${insight.id}`)
      }

      const lexicalScore = textManager.computeSimilarity(summary, insight.summary).score
      const embeddingScore = clampSimilarity(
        embeddingManager.cosineSimilarity(candidateVector, existingVector),
      )
      const finalScore = clampSimilarity(embeddingScore * 0.6 + lexicalScore * 0.4)
      const classification = classifyInsightSimilarity(finalScore, thresholds)

      if (classification === 'safe_to_promote') {
        return null
      }

      return {
        ...insight,
        lexicalScore,
        embeddingScore,
        finalScore,
        classification,
      }
    })
    .filter((match): match is InsightDuplicateMatch => match !== null)
    .sort((left, right) => right.finalScore - left.finalScore)

  const topMatch = matches[0] ?? null
  const decision = topMatch?.classification ?? 'safe_to_promote'

  return {
    decision,
    threshold,
    thresholds,
    topMatch,
    matches,
    recommendation: getInsightDuplicateRecommendation(decision),
    evaluatorVersion: INSIGHT_DUPLICATE_EVALUATOR_VERSION,
  }
}
