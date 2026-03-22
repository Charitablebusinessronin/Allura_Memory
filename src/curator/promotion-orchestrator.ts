import {
  DUPLICATE_THRESHOLD,
  INSIGHT_DUPLICATE_EVALUATOR_VERSION,
  evaluateInsightDuplicates,
  type DuplicateReviewResult,
  type ExistingInsightCandidate,
} from '@/lib/dedup/insight-duplicate'
import type { Neo4jInsight, NotionInsightRecord, ReviewContextDisplay } from './types'
import { INSIGHTS_DATABASE_ID } from './config'

const OPTIONAL_DUPLICATE_REVIEW_PROPERTIES = {
  duplicateOf: 'Duplicate Of',
  rationale: 'Rationale',
  decision: 'Duplicate Review Decision',
  evaluatorVersion: 'Duplicate Evaluator Version',
  finalScore: 'Duplicate Final Score',
  embeddingScore: 'Duplicate Embedding Score',
  lexicalScore: 'Duplicate Lexical Score',
  latencyMs: 'Duplicate Review Latency Ms',
  candidateCount: 'Duplicate Candidate Count',
} as const

export interface DuplicateReviewProvider {
  getCandidates(input: {
    canonicalTag: string
    summary: string
    threshold: number
  }): Promise<ExistingInsightCandidate[]>
}

export interface PromotionDuplicateReviewResult extends DuplicateReviewResult {
  latencyMs: number
  candidateCount: number
  measuredAt: string
}

export type DuplicateReviewEvaluator = (input: {
  summary: string
  candidates: ExistingInsightCandidate[]
  threshold: number
}) => Promise<DuplicateReviewResult>

export interface PromotionOrchestrator {
  reviewDuplicate(input: {
    canonicalTag: string
    summary: string
    threshold?: number
  }): Promise<PromotionDuplicateReviewResult>
  buildPromotionPayload(
    insight: Neo4jInsight,
    displayTag: string,
    review?: ReviewContextDisplay,
    supportedProperties?: Set<string>,
  ): Record<string, unknown>
  buildApprovalUpdatePayload(
    pageId: string,
    approvedBy: string,
    supportedProperties?: Set<string>,
  ): Record<string, unknown>
  buildRejectionUpdatePayload(
    pageId: string,
    reason: string,
    supportedProperties?: Set<string>,
  ): Record<string, unknown>
  buildSupersedeUpdatePayload(
    pageId: string,
    replacementReference: string,
    reason: string,
    supportedProperties?: Set<string>,
  ): Record<string, unknown>
  buildRevokeUpdatePayload(
    pageId: string,
    reason: string,
    revokedBy?: string,
    supportedProperties?: Set<string>,
  ): Record<string, unknown>
}

class ProviderBackedPromotionOrchestrator implements PromotionOrchestrator {
  constructor(
    private readonly provider?: DuplicateReviewProvider,
    private readonly evaluator: DuplicateReviewEvaluator = async ({ summary, candidates, threshold }) =>
      evaluateInsightDuplicates(summary, candidates, threshold),
  ) {}

  async reviewDuplicate(input: {
    canonicalTag: string
    summary: string
    threshold?: number
  }): Promise<PromotionDuplicateReviewResult> {
    if (!this.provider) {
      throw new Error('Duplicate review provider is required for reviewDuplicate')
    }

    const threshold = input.threshold ?? DUPLICATE_THRESHOLD
    const startedAt = performance.now()

    const candidates = await this.provider.getCandidates({
      canonicalTag: input.canonicalTag,
      summary: input.summary,
      threshold,
    })

    const evaluation = await this.evaluator({
      summary: input.summary,
      candidates,
      threshold,
    })

    const latencyMs = performance.now() - startedAt

    return {
      ...evaluation,
      evaluatorVersion: evaluation.evaluatorVersion || INSIGHT_DUPLICATE_EVALUATOR_VERSION,
      latencyMs,
      candidateCount: candidates.length,
      measuredAt: new Date().toISOString(),
    }
  }

  buildPromotionPayload(
    insight: Neo4jInsight,
    displayTag: string,
    review?: ReviewContextDisplay,
    supportedProperties?: Set<string>,
  ): Record<string, unknown> {
    const properties: Record<string, unknown> = {
      Name: {
        title: [{ text: { content: insight.title } }],
      },
      'Canonical Tag': {
        rich_text: [{ text: { content: insight.canonicalTag } }],
      },
      'Display Tags': {
        multi_select: [{ name: displayTag }],
      },
      'Source Project': {
        rich_text: [{ text: { content: insight.sourceProject } }],
      },
      'Source Insight ID': {
        rich_text: [{ text: { content: insight.id } }],
      },
      Confidence: {
        number: insight.confidence,
      },
      Status: {
        select: { name: 'Pending Review' },
      },
      'Review Status': {
        select: { name: 'Pending' },
      },
      'AI Accessible': {
        checkbox: false,
      },
      'Promoted At': {
        date: { start: new Date().toISOString() },
      },
    }

    this.applyDuplicateReviewProperties(properties, review, supportedProperties)

    return {
      parent: { database_id: process.env.NOTION_INSIGHTS_DATABASE_ID ?? INSIGHTS_DATABASE_ID },
      properties,
      content: buildPromotionContent(insight, displayTag, review),
    }
  }

  buildApprovalUpdatePayload(
    pageId: string,
    approvedBy: string,
    supportedProperties?: Set<string>,
  ): Record<string, unknown> {
    const properties: Record<string, unknown> = {
      Status: { select: { name: 'Approved' } },
      'Review Status': { select: { name: 'Completed' } },
      'AI Accessible': { checkbox: true },
    }

    if (!supportedProperties || supportedProperties.has('Approved By')) {
      properties['Approved By'] = { rich_text: [{ text: { content: approvedBy } }] }
    }
    if (!supportedProperties || supportedProperties.has('Approved At')) {
      properties['Approved At'] = { date: { start: new Date().toISOString() } }
    }

    return {
      page_id: pageId,
      properties,
      content: `\n\n## Approval\n**Approved by:** ${approvedBy}\n**Date:** ${new Date().toISOString()}`,
    }
  }

  buildRejectionUpdatePayload(
    pageId: string,
    reason: string,
    supportedProperties?: Set<string>,
  ): Record<string, unknown> {
    const properties: Record<string, unknown> = {
      Status: { select: { name: 'Rejected' } },
      'Review Status': { select: { name: 'Completed' } },
      'AI Accessible': { checkbox: false },
    }

    if (!supportedProperties || supportedProperties.has(OPTIONAL_DUPLICATE_REVIEW_PROPERTIES.rationale)) {
      properties.Rationale = { rich_text: [{ text: { content: `Rejected: ${reason}` } }] }
    }

    return {
      page_id: pageId,
      properties,
      content: `\n\n## Rejection\n**Reason:** ${reason}\n\nRejected on ${new Date().toISOString()}`,
    }
  }

  buildSupersedeUpdatePayload(
    pageId: string,
    replacementReference: string,
    reason: string,
    supportedProperties?: Set<string>,
  ): Record<string, unknown> {
    const properties: Record<string, unknown> = {
      Status: { select: { name: 'Superseded' } },
      'Review Status': { select: { name: 'Completed' } },
      'AI Accessible': { checkbox: false },
    }

    if (!supportedProperties || supportedProperties.has(OPTIONAL_DUPLICATE_REVIEW_PROPERTIES.duplicateOf)) {
      properties['Duplicate Of'] = {
        rich_text: [{ text: { content: replacementReference } }],
      }
    }
    if (!supportedProperties || supportedProperties.has(OPTIONAL_DUPLICATE_REVIEW_PROPERTIES.rationale)) {
      properties.Rationale = {
        rich_text: [{ text: { content: `Superseded: ${reason}` } }],
      }
    }

    return {
      page_id: pageId,
      properties,
      content: `\n\n## Superseded\n**Replacement:** ${replacementReference}\n**Reason:** ${reason}`,
    }
  }

  buildRevokeUpdatePayload(
    pageId: string,
    reason: string,
    revokedBy?: string,
    supportedProperties?: Set<string>,
  ): Record<string, unknown> {
    const properties: Record<string, unknown> = {
      Status: { select: { name: 'Revoked' } },
      'Review Status': { select: { name: 'Completed' } },
      'AI Accessible': { checkbox: false },
    }

    if (!supportedProperties || supportedProperties.has(OPTIONAL_DUPLICATE_REVIEW_PROPERTIES.rationale)) {
      properties.Rationale = {
        rich_text: [{ text: { content: `Revoked: ${reason}` } }],
      }
    }
    if (revokedBy && (!supportedProperties || supportedProperties.has('Revoked By'))) {
      properties['Revoked By'] = { rich_text: [{ text: { content: revokedBy } }] }
    }
    if (!supportedProperties || supportedProperties.has('Revoked At')) {
      properties['Revoked At'] = { date: { start: new Date().toISOString() } }
    }

    return {
      page_id: pageId,
      properties,
      content: `\n\n## Revoked\n**Reason:** ${reason}${revokedBy ? `\n**Revoked by:** ${revokedBy}` : ''}\n\nRevoked on ${new Date().toISOString()}`,
    }
  }

  private applyDuplicateReviewProperties(
    properties: Record<string, unknown>,
    review?: ReviewContextDisplay,
    supportedProperties?: Set<string>,
  ): void {
    if (!review) {
      return
    }

    const supports = (name: string): boolean => !supportedProperties || supportedProperties.has(name)

    if (review.topMatch && supports(OPTIONAL_DUPLICATE_REVIEW_PROPERTIES.duplicateOf)) {
      properties['Duplicate Of'] = {
        rich_text: [{ text: { content: review.topMatch.id } }],
      }
    }

    if (supports(OPTIONAL_DUPLICATE_REVIEW_PROPERTIES.rationale)) {
      const summary = review.topMatch
        ? `${review.decision}|${review.recommendation}|final=${review.topMatch.finalScore.toFixed(2)}|embedding=${review.topMatch.embeddingScore.toFixed(2)}|lexical=${review.topMatch.lexicalScore.toFixed(2)}|latency_ms=${review.latencyMs.toFixed(2)}|candidate_count=${review.candidateCount}`
        : `${review.decision}|${review.recommendation}|latency_ms=${review.latencyMs.toFixed(2)}|candidate_count=${review.candidateCount}`
      properties.Rationale = {
        rich_text: [{ text: { content: summary } }],
      }
    }

    if (supports(OPTIONAL_DUPLICATE_REVIEW_PROPERTIES.decision)) {
      properties['Duplicate Review Decision'] = {
        rich_text: [{ text: { content: review.decision } }],
      }
    }
    if (supports(OPTIONAL_DUPLICATE_REVIEW_PROPERTIES.evaluatorVersion)) {
      properties['Duplicate Evaluator Version'] = {
        rich_text: [{ text: { content: review.evaluatorVersion } }],
      }
    }
    if (review.topMatch && supports(OPTIONAL_DUPLICATE_REVIEW_PROPERTIES.finalScore)) {
      properties['Duplicate Final Score'] = { number: review.topMatch.finalScore }
    }
    if (review.topMatch && supports(OPTIONAL_DUPLICATE_REVIEW_PROPERTIES.embeddingScore)) {
      properties['Duplicate Embedding Score'] = { number: review.topMatch.embeddingScore }
    }
    if (review.topMatch && supports(OPTIONAL_DUPLICATE_REVIEW_PROPERTIES.lexicalScore)) {
      properties['Duplicate Lexical Score'] = { number: review.topMatch.lexicalScore }
    }
    if (supports(OPTIONAL_DUPLICATE_REVIEW_PROPERTIES.latencyMs)) {
      properties['Duplicate Review Latency Ms'] = { number: review.latencyMs }
    }
    if (supports(OPTIONAL_DUPLICATE_REVIEW_PROPERTIES.candidateCount)) {
      properties['Duplicate Candidate Count'] = { number: review.candidateCount }
    }
  }
}

export function createPromotionOrchestrator(
  provider?: DuplicateReviewProvider,
  evaluator?: DuplicateReviewEvaluator,
): PromotionOrchestrator {
  return new ProviderBackedPromotionOrchestrator(provider, evaluator)
}

export function createNotionDuplicateReviewProvider(
  records: NotionInsightRecord[],
): DuplicateReviewProvider {
  return {
    async getCandidates({ canonicalTag }) {
      return records
        .filter((record) => record.canonicalTag === canonicalTag)
        .filter((record) => record.status === 'Approved' || record.status === 'Pending Review')
        .map((record) => ({
          id: record.sourceInsightId || record.pageId,
          summary: record.summary,
          confidence: record.confidence,
          status: record.status,
        }))
        .filter((record) => record.summary.trim().length > 0)
    },
  }
}

export function createNeo4jDuplicateReviewProvider(
  candidates: ExistingInsightCandidate[],
): DuplicateReviewProvider {
  return {
    async getCandidates() {
      return candidates.filter((candidate) => candidate.summary.trim().length > 0)
    },
  }
}

export function toReviewContextDisplay(
  review: PromotionDuplicateReviewResult,
): ReviewContextDisplay {
  return {
    decision: review.decision,
    thresholds: review.thresholds,
    recommendation: review.recommendation,
    topMatch: review.topMatch,
    matches: review.matches,
    evaluatorVersion: review.evaluatorVersion,
    latencyMs: review.latencyMs,
    candidateCount: review.candidateCount,
    measuredAt: review.measuredAt,
  }
}

export function shouldBlockForDuplicateReview(
  review: PromotionDuplicateReviewResult,
): boolean {
  return review.decision === 'duplicate'
}

export function getDuplicateReason(
  review: PromotionDuplicateReviewResult,
): string {
  if (review.topMatch) {
    return `${review.recommendation} (top match ${review.topMatch.id}, score ${review.topMatch.finalScore.toFixed(2)})`
  }

  return review.recommendation
}

export function buildInsightDuplicateReviewInput(
  insight: Neo4jInsight,
  threshold?: number,
): {
  canonicalTag: string
  summary: string
  threshold?: number
} {
  return {
    canonicalTag: insight.canonicalTag,
    summary: insight.summary,
    threshold,
  }
}

function buildPromotionContent(
  insight: Neo4jInsight,
  displayTag: string,
  review?: ReviewContextDisplay,
): string {
  const sections = [
    `## Summary`,
    insight.summary,
    ``,
    `## Metadata`,
    `| Property | Value |`,
    `|----------|-------|`,
    `| Canonical Tag | ${insight.canonicalTag} |`,
    `| Display Tag | ${displayTag} |`,
    `| Source Project | ${insight.sourceProject} |`,
    `| Source Insight ID | ${insight.id} |`,
    `| Confidence | ${insight.confidence} |`,
    `| Status | Pending Review |`,
    `| Review Status | Pending |`,
    `| AI Accessible | false |`,
  ]

  if (review?.topMatch) {
    sections.push(
      ``,
      `## Duplicate Review Context`,
      `| Property | Value |`,
      `|----------|-------|`,
      `| Decision | ${review.decision} |`,
      `| Recommendation | ${review.recommendation} |`,
      `| Evaluator Version | ${review.evaluatorVersion} |`,
      `| Duplicate Review Latency Ms | ${review.latencyMs.toFixed(2)} |`,
      `| Duplicate Candidate Count | ${review.candidateCount} |`,
      `| Prior Insight ID | ${review.topMatch.id} |`,
      `| Prior Insight Status | ${review.topMatch.status} |`,
      `| Prior Insight Confidence | ${review.topMatch.confidence} |`,
      `| Lexical Score | ${review.topMatch.lexicalScore.toFixed(2)} |`,
      `| Embedding Score | ${review.topMatch.embeddingScore.toFixed(2)} |`,
      `| Final Score | ${review.topMatch.finalScore.toFixed(2)} |`,
      ``,
      `### Top Match Summary`,
      review.topMatch.summary,
    )
  }

  sections.push(
    ``,
    `## Rationale`,
    review
      ? `This insight was promoted with duplicate review decision ${review.decision}. ${review.recommendation}`
      : `This insight was automatically promoted from Neo4j with confidence ${insight.confidence}.`,
    ``,
    `---`,
    `*Promoted by Curator Pipeline on ${new Date().toISOString()}*`,
  )

  return sections.join('\n')
}
