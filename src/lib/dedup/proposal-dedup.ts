/**
 * Proposal Deduplication
 *
 * Checks canonical_proposals for near-duplicate content before queuing.
 * Uses text similarity (hybrid Levenshtein + Jaro-Winkler) to detect
 * semantically similar proposals within the same group_id.
 *
 * Architecture:
 *   - Queries pending+approved proposals from canonical_proposals by group_id
 *   - Compares new content against existing content using TextSimilarityManager
 *   - Returns matching proposal if similarity >= configurable threshold
 *   - Scoped per group_id (tenant isolation)
 *   - Threshold configurable via PROPOSAL_DEDUP_THRESHOLD env var (default 0.85)
 */

import { createTextManager, type TextSimilarityManager } from "./text-similarity";

export const DEFAULT_PROPOSAL_DEDUP_THRESHOLD = 0.85;

export interface ProposalCandidate {
  id: string;
  content: string;
  score: number;
  status: string;
  created_at: string;
}

export interface ProposalDedupResult {
  isDuplicate: boolean;
  existingProposal: ProposalCandidate | null;
  similarity: number;
  threshold: number;
}

export function getDedupThreshold(): number {
  return parseFloat(
    process.env.PROPOSAL_DEDUP_THRESHOLD ?? String(DEFAULT_PROPOSAL_DEDUP_THRESHOLD),
  );
}

export function createProposalDedupChecker(
  textManager?: TextSimilarityManager,
  threshold?: number,
): ProposalDedupChecker {
  return new ProposalDedupChecker(
    textManager ?? createTextManager({ algorithm: "hybrid", normalize: true, handleAbbreviations: true }),
    threshold ?? getDedupThreshold(),
  );
}

export class ProposalDedupChecker {
  private textManager: TextSimilarityManager;
  private threshold: number;

  constructor(textManager: TextSimilarityManager, threshold: number) {
    this.textManager = textManager;
    this.threshold = threshold;
  }

  /**
   * Check if a new proposal's content is similar to any existing proposals.
   *
   * @param newContent - The content of the new proposal
   * @param existingProposals - Proposals already in the queue for the same group_id
   * @returns Dedup result indicating whether to skip the insert
   */
  checkProposals(
    newContent: string,
    existingProposals: ProposalCandidate[],
  ): ProposalDedupResult {
    if (existingProposals.length === 0) {
      return {
        isDuplicate: false,
        existingProposal: null,
        similarity: 0,
        threshold: this.threshold,
      };
    }

    let bestMatch: ProposalCandidate | null = null;
    let bestSimilarity = 0;

    for (const proposal of existingProposals) {
      const result = this.textManager.computeSimilarity(newContent, proposal.content);
      if (result.score > bestSimilarity) {
        bestSimilarity = result.score;
        bestMatch = proposal;
      }
    }

    if (bestSimilarity >= this.threshold && bestMatch) {
      return {
        isDuplicate: true,
        existingProposal: bestMatch,
        similarity: bestSimilarity,
        threshold: this.threshold,
      };
    }

    return {
      isDuplicate: false,
      existingProposal: bestSimilarity >= 0.7 ? bestMatch : null,
      similarity: bestSimilarity,
      threshold: this.threshold,
    };
  }
}