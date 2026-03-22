/**
 * Insight Curator Types
 * 
 * Defines the type system for the insight promotion pipeline.
 */

import type {
  DuplicateReviewResult,
  InsightDuplicateMatch,
} from "@/lib/dedup/insight-duplicate";

export type InsightStatus =
  | "Proposed"
  | "Pending Review"
  | "Approved"
  | "Rejected"
  | "Superseded"
  | "Revoked";

export interface Neo4jInsight {
  id: string;
  title: string;
  summary: string;
  confidence: number;
  canonicalTag: string;
  displayTag?: string;
  sourceProject: string;
  status: InsightStatus;
  promotedToNotion?: boolean;
  notionPageId?: string | null;
  promotedAt?: string | null;
  approvedBy?: string | null;
  approvedAt?: string | null;
  rejectionReason?: string | null;
  createdAt?: string | null;
  updatedAt?: string | null;
}

export interface NotionDisplayTagMap {
  [canonicalTag: string]: string;
}

export interface NotionInsightRecord {
  pageId: string;
  title: string;
  summary: string;
  confidence: number;
  canonicalTag: string;
  displayTags: string[];
  status: InsightStatus;
  reviewStatus?: string;
  aiAccessible: boolean;
  sourceInsightId: string;
  sourceProject: string;
  promotedAt?: string;
  approvedAt?: string;
  approvedBy?: string;
}

export interface ReviewContextDisplay {
  decision: DuplicateReviewResult["decision"];
  thresholds: DuplicateReviewResult["thresholds"];
  recommendation: string;
  topMatch: InsightDuplicateMatch | null;
  matches: InsightDuplicateMatch[];
  evaluatorVersion: string;
  latencyMs: number;
  candidateCount: number;
  measuredAt: string;
}

export interface CuratorDecision {
  insightId: string;
  action: "promoted" | "skipped" | "duplicate" | "blocked" | "error";
  reason: string;
  notionPageId?: string;
  groupId?: string;
  timestamp: string;
  duplicateReview?: ReviewContextDisplay;
}

export interface PromotionCandidate {
  insight: Neo4jInsight;
  displayTag: string;
}

export interface DedupeResult {
  isDuplicate: boolean;
  shouldBlock: boolean;
  existingPageId?: string;
  reason?: string;
  similarity?: number;
  reviewContext?: ReviewContextDisplay;
}

export interface CuratorConfig {
  confidenceThreshold: number;
  minSummaryLength: number;
  dedupeThreshold: number;
  batchSize: number;
}

export const DEFAULT_CURATOR_CONFIG: CuratorConfig = {
  confidenceThreshold: 0.7,
  minSummaryLength: 40,
  dedupeThreshold: 0.9,
  batchSize: 50
};
