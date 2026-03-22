/**
 * Deduplication Logic
 * 
 * Checks for similar existing insights before promotion.
 * Uses the shared promotion orchestrator so curator and MCP
 * agree on duplicate semantics and latency measurement.
 */

import { DUPLICATE_THRESHOLD } from "@/lib/dedup/insight-duplicate";
import {
  buildInsightDuplicateReviewInput,
  createNotionDuplicateReviewProvider,
  createPromotionOrchestrator,
  getDuplicateReason,
  shouldBlockForDuplicateReview,
  toReviewContextDisplay,
} from "./promotion-orchestrator";
import { DedupeResult, Neo4jInsight, NotionInsightRecord } from "./types";
import { CONFIDENCE_THRESHOLD } from "./config";

export async function checkDuplicate(
  insight: Neo4jInsight,
  existingRecords: NotionInsightRecord[],
  threshold: number = DUPLICATE_THRESHOLD,
): Promise<DedupeResult> {
  const orchestrator = createPromotionOrchestrator(
    createNotionDuplicateReviewProvider(existingRecords),
  )
  const review = await orchestrator.reviewDuplicate(
    buildInsightDuplicateReviewInput(insight, threshold),
  )

  const reviewContext = toReviewContextDisplay(review)
  const topMatch = review.topMatch
  const matchedRecord = topMatch
    ? existingRecords.find(
        (record) =>
          record.canonicalTag === insight.canonicalTag &&
          (record.sourceInsightId === topMatch.id || record.pageId === topMatch.id),
      )
    : undefined

  if (shouldBlockForDuplicateReview(review)) {
    return {
      isDuplicate: true,
      shouldBlock: true,
      existingPageId: matchedRecord?.pageId,
      reason: getDuplicateReason(review),
      similarity: topMatch?.finalScore,
      reviewContext,
    }
  }

  if (review.decision === "possible_supersede" || review.decision === "related_context") {
    return {
      isDuplicate: false,
      shouldBlock: false,
      existingPageId: matchedRecord?.pageId,
      reason: getDuplicateReason(review),
      similarity: topMatch?.finalScore,
      reviewContext,
    }
  }

  return {
    isDuplicate: false,
    shouldBlock: false,
    reviewContext,
  }
}

export function canPromoteInsight(insight: Neo4jInsight): { canPromote: boolean; reason?: string } {
  if (insight.confidence < CONFIDENCE_THRESHOLD) {
    return {
      canPromote: false,
      reason: `Confidence ${insight.confidence.toFixed(2)} below threshold ${CONFIDENCE_THRESHOLD}`
    };
  }

  if (insight.status !== "Proposed") {
    return {
      canPromote: false,
      reason: `Status "${insight.status}" is not "Proposed"`
    };
  }

  if (!insight.summary || insight.summary.trim().length < 40) {
    return {
      canPromote: false,
      reason: "Summary is missing or too short (minimum 40 characters)"
    };
  }

  if (!insight.canonicalTag) {
    return {
      canPromote: false,
      reason: "Missing canonical_tag - promotion blocked"
    };
  }

  if (insight.promotedToNotion) {
    return {
      canPromote: false,
      reason: "Already promoted to Notion"
    };
  }

  return { canPromote: true };
}

export async function checkPromotable(
  insight: Neo4jInsight,
  existingRecords: NotionInsightRecord[]
): Promise<{ promotable: boolean; reason?: string; dedupeResult?: DedupeResult }> {
  const promotionCheck = canPromoteInsight(insight);
  if (!promotionCheck.canPromote) {
    return { promotable: false, reason: promotionCheck.reason };
  }

  const dedupeResult = await checkDuplicate(insight, existingRecords);
  if (dedupeResult.shouldBlock) {
    return {
      promotable: false,
      reason: dedupeResult.reason,
      dedupeResult
    };
  }

  return { promotable: true, dedupeResult };
}
