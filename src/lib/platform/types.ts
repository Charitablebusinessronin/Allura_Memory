/**
 * Platform Library Types
 * Story 4-2: Platform Library
 * Epic 4: Cross-Organization Knowledge Sharing
 */

/**
 * Platform insight categories
 */
export type InsightCategory =
  | 'architecture'
  | 'pattern'
  | 'best-practice'
  | 'lesson-learned'
  | 'anti-pattern'
  | 'technique'
  | 'configuration'
  | 'integration';

/**
 * Platform insight record from database
 */
export interface PlatformInsight {
  id: string;
  group_id: string; // Always 'allura-platform'
  title: string;
  content: string;
  category: InsightCategory;
  tags: string[];
  source_org: string | null;
  confidence_score: number | null;
  adoption_count: number;
  version: number;
  supersedes_id: string | null;
  created_by: string;
  created_at: Date;
  updated_at: Date;
}

/**
 * Insight version with lineage
 */
export interface InsightVersion {
  id: string;
  version: number;
  title: string;
  created_at: Date;
  supersedes_id: string | null;
  supersedes_version: number | null;
}

/**
 * Version history chain (oldest to newest)
 */
export interface VersionHistory {
  current_id: string;
  current_version: number;
  lineage: InsightVersion[];
}

/**
 * Adoption metrics for an insight
 */
export interface AdoptionMetrics {
  insight_id: string;
  total_adoptions: number;
  adoption_by_org: Array<{
    org: string;
    adopted_at: Date;
    outcome: string | null;
  }>;
  outcomes: {
    success: number;
    partial: number;
    failed: number;
    unknown: number;
  };
}

/**
 * Adoption record
 */
export interface InsightAdoption {
  id: string;
  insight_id: string;
  adopted_by_org: string;
  adopted_by_agent: string | null;
  adopted_at: Date;
  context: string | null;
  outcome: 'success' | 'partial' | 'failed' | null;
  metadata: Record<string, unknown>;
}

/**
 * Search parameters for platform library
 */
export interface PlatformSearchParams {
  query?: string;
  category?: InsightCategory;
  tags?: string[];
  min_confidence?: number;
  min_adoption?: number;
  sort_by?: 'adoption' | 'confidence' | 'recent';
  limit?: number;
  offset?: number;
}

/**
 * Search result with ranking
 */
export interface SearchResult {
  insight: PlatformInsight;
  rank: number;
  match_reason: string;
}

/**
 * Platform library search result
 */
export interface PlatformSearchResult {
  results: SearchResult[];
  total_count: number;
  page: number;
  page_size: number;
  has_more: boolean;
}

/**
 * Promotion proposal for platform library
 */
export interface PromotionProposal {
  id: string;
  source_group_id: string;
  source_org: string;
  insight_id: string;
  title: string;
  content: string;
  category: InsightCategory;
  tags: string[];
  confidence_score: number | null;
  submitted_by: string;
  submitted_at: Date;
  status: 'pending' | 'approved' | 'rejected' | 'published';
  reviewed_by: string | null;
  reviewed_at: Date | null;
  review_notes: string | null;
  rejection_reason: string | null;
  published_insight_id: string | null;
}

/**
 * Publish parameters for new insight
 */
export interface PublishInsightParams {
  title: string;
  content: string;
  category: InsightCategory;
  tags?: string[];
  source_org?: string;
  confidence_score?: number;
  created_by: string;
  supersedes_id?: string;
}

/**
 * Track adoption parameters
 */
export interface TrackAdoptionParams {
  insight_id: string;
  adopted_by_org: string;
  adopted_by_agent?: string;
  context?: string;
  outcome?: 'success' | 'partial' | 'failed';
  metadata?: Record<string, unknown>;
}

/**
 * Create new version parameters
 */
export interface CreateVersionParams {
  existing_insight_id: string;
  new_title?: string;
  new_content: string;
  new_tags?: string[];
  new_confidence_score?: number;
  updated_by: string;
}

/**
 * Promotion submission parameters
 */
export interface SubmitPromotionParams {
  source_group_id: string;
  source_org: string;
  insight_id: string;
  title: string;
  content: string;
  category: InsightCategory;
  tags?: string[];
  confidence_score?: number;
  submitted_by: string;
}

/**
 * Promotion review parameters
 */
export interface ReviewPromotionParams {
  proposal_id: string;
  reviewed_by: string;
  approve: boolean;
  review_notes?: string;
  rejection_reason?: string;
}