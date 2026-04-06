/**
 * Platform Library - Cross-Organization Knowledge Sharing
 * Story 4-2: Platform Library
 * Epic 4: Cross-Organization Knowledge Sharing
 */

import type { Pool } from 'pg';
import { getPool } from '../postgres/connection';
import type {
  PlatformInsight,
  PlatformSearchParams,
  PlatformSearchResult,
  SearchResult,
  AdoptionMetrics,
  VersionHistory,
  InsightVersion,
  PublishInsightParams,
  TrackAdoptionParams,
  CreateVersionParams,
  PromotionProposal,
  SubmitPromotionParams,
  ReviewPromotionParams,
  InsightCategory,
} from './types';
import { validateGroupId } from '@/lib/validation/group-id';

/**
 * Platform Library constant group ID
 * All platform insights use this group_id
 */
export const PLATFORM_GROUP_ID = 'allura-platform';

/**
 * Platform Library Error
 */
export class PlatformLibraryError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'PlatformLibraryError';
  }
}

/**
 * Validate search parameters
 */
function validateSearchParams(params: PlatformSearchParams): void {
  if (params.min_confidence !== undefined && (params.min_confidence < 0 || params.min_confidence > 1)) {
    throw new PlatformLibraryError('min_confidence must be between 0 and 1');
  }

  if (params.min_adoption !== undefined && params.min_adoption < 0) {
    throw new PlatformLibraryError('min_adoption must be non-negative');
  }

  if (params.limit !== undefined && params.limit < 1) {
    throw new PlatformLibraryError('limit must be positive');
  }

  if (params.offset !== undefined && params.offset < 0) {
    throw new PlatformLibraryError('offset must be non-negative');
  }
}

/**
 * Build search WHERE clause
 */
function buildSearchWhereClause(
  params: PlatformSearchParams
): { clause: string; values: unknown[] } {
  const conditions: string[] = ['group_id = $1'];
  const values: unknown[] = [PLATFORM_GROUP_ID];
  let paramIdx = 2;

  if (params.category) {
    conditions.push(`category = $${paramIdx}`);
    values.push(params.category);
    paramIdx++;
  }

  if (params.min_confidence !== undefined) {
    conditions.push(`confidence_score >= $${paramIdx}`);
    values.push(params.min_confidence);
    paramIdx++;
  }

  if (params.min_adoption !== undefined) {
    conditions.push(`adoption_count >= $${paramIdx}`);
    values.push(params.min_adoption);
    paramIdx++;
  }

  if (params.tags && params.tags.length > 0) {
    conditions.push(`tags @> $${paramIdx}`);
    values.push(JSON.stringify(params.tags));
    paramIdx++;
  }

  return { clause: conditions.join(' AND '), values };
}

/**
 * Build ORDER BY clause
 */
function buildOrderByClause(sortBy: string): string {
  switch (sortBy) {
    case 'adoption':
      return 'ORDER BY adoption_count DESC, created_at DESC';
    case 'confidence':
      return 'ORDER BY confidence_score DESC NULLS LAST, created_at DESC';
    case 'recent':
    default:
      return 'ORDER BY created_at DESC';
  }
}

/**
 * Calculate match rank for search results
 */
function calculateMatchRank(
  insight: PlatformInsight,
  query: string | undefined
): { rank: number; reason: string } {
  if (!query) {
    return {
      rank: insight.adoption_count * 10 + (insight.confidence_score ?? 0) * 100,
      reason: 'Sorted by popularity'
    };
  }

  const queryLower = query.toLowerCase();
  const titleMatch = insight.title.toLowerCase().includes(queryLower);
  const contentMatch = insight.content.toLowerCase().includes(queryLower);
  const tagMatch = insight.tags.some(tag => tag.toLowerCase().includes(queryLower));

  let rank = 0;
  const reasons: string[] = [];

  if (titleMatch) {
    rank += 50;
    reasons.push('title match');
  }

  if (contentMatch) {
    rank += 30;
    reasons.push('content match');
  }

  if (tagMatch) {
    rank += 20;
    reasons.push('tag match');
  }

  // Boost by adoption and confidence
  rank += insight.adoption_count * 10;
  rank += (insight.confidence_score ?? 0) * 100;

  return {
    rank,
    reason: reasons.length > 0 ? reasons.join(', ') : 'sorted by popularity'
  };
}

/**
 * Platform Library class
 * Manages cross-organization knowledge sharing
 */
export class PlatformLibrary {
  private pool: Pool;

  constructor() {
    this.pool = getPool();
  }

  /**
   * Publish a new insight to the platform library
   * Note: Insights should be approved via HITL before calling this
   */
  async publishInsight(params: PublishInsightParams): Promise<PlatformInsight> {
    const {
      title,
      content,
      category,
      tags = [],
      source_org,
      confidence_score,
      created_by,
      supersedes_id,
    } = params;

    // Calculate version
    let version = 1;
    if (supersedes_id) {
      const existingResult = await this.pool.query<{ version: number }>(
        'SELECT version FROM platform_insights WHERE id = $1 AND group_id = $2',
        [supersedes_id, PLATFORM_GROUP_ID]
      );

      if (existingResult.rows.length === 0) {
        throw new PlatformLibraryError(`Insight ${supersedes_id} not found for supersession`);
      }

      version = existingResult.rows[0].version + 1;
    }

    const result = await this.pool.query<PlatformInsight>(
      `INSERT INTO platform_insights (
        group_id, title, content, category, tags, source_org, 
        confidence_score, version, supersedes_id, created_by
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
      RETURNING *`,
      [
        PLATFORM_GROUP_ID,
        title,
        content,
        category,
        JSON.stringify(tags),
        source_org ?? null,
        confidence_score ?? null,
        version,
        supersedes_id ?? null,
        created_by,
      ]
    );

    const insight = result.rows[0];
    insight.tags = typeof insight.tags === 'string' ? JSON.parse(insight.tags as unknown as string) : insight.tags;

    return insight;
  }

  /**
   * Search platform library for insights
   */
  async search(params: PlatformSearchParams): Promise<PlatformSearchResult> {
    validateSearchParams(params);

    const { clause, values } = buildSearchWhereClause(params);
    const sortBy = params.sort_by ?? 'recent';
    const limit = params.limit ?? 20;
    const offset = params.offset ?? 0;

    // Get total count
    const countResult = await this.pool.query<{ count: number }>(
      `SELECT COUNT(*) as count FROM platform_insights WHERE ${clause}`,
      values
    );
    const totalCount = countResult.rows[0].count;

    // Get results with text search
    let searchClause = clause;
    const searchValues = [...values];
    if (params.query) {
      const queryParam = searchValues.length + 1;
      searchClause += ` AND (title ILIKE $${queryParam} OR content ILIKE $${queryParam} OR $${queryParam} = ANY(tags))`;
      searchValues.push(`%${params.query}%`);
    }

    const orderBy = buildOrderByClause(sortBy);
    const limitParam = searchValues.length + 1;
    const offsetParam = searchValues.length + 2;

    const result = await this.pool.query<PlatformInsight>(
      `SELECT * FROM platform_insights 
       WHERE ${searchClause}
       ${orderBy}
       LIMIT $${limitParam} OFFSET $${offsetParam}`,
      [...searchValues, limit, offset]
    );

    const results: SearchResult[] = result.rows.map((row) => {
      const insight = {
        ...row,
        tags: typeof row.tags === 'string' ? JSON.parse(row.tags as unknown as string) : row.tags,
      };
      const { rank, reason } = calculateMatchRank(insight, params.query);

      return {
        insight,
        rank,
        match_reason: reason,
      };
    });

    return {
      results,
      total_count: totalCount,
      page: Math.floor(offset / limit) + 1,
      page_size: limit,
      has_more: offset + limit < totalCount,
    };
  }

  /**
   * Get adoption metrics for an insight
   */
  async getAdoptionMetrics(insightId: string): Promise<AdoptionMetrics> {
    // Verify insight exists
    const insightResult = await this.pool.query<PlatformInsight>(
      'SELECT id, adoption_count FROM platform_insights WHERE id = $1 AND group_id = $2',
      [insightId, PLATFORM_GROUP_ID]
    );

    if (insightResult.rows.length === 0) {
      throw new PlatformLibraryError(`Insight ${insightId} not found`);
    }

    const insight = insightResult.rows[0];

    // Get adoption details
    const adoptionsResult = await this.pool.query<{
      adopted_by_org: string;
      adopted_at: Date;
      outcome: string | null;
    }>(
      `SELECT adopted_by_org, adopted_at, outcome 
       FROM insight_adoptions 
       WHERE insight_id = $1 
       ORDER BY adopted_at DESC`,
      [insightId]
    );

    // Calculate outcome stats
    const outcomes = {
      success: 0,
      partial: 0,
      failed: 0,
      unknown: 0,
    };

    for (const adoption of adoptionsResult.rows) {
      if (adoption.outcome === 'success') outcomes.success++;
      else if (adoption.outcome === 'partial') outcomes.partial++;
      else if (adoption.outcome === 'failed') outcomes.failed++;
      else outcomes.unknown++;
    }

    return {
      insight_id: insightId,
      total_adoptions: insight.adoption_count,
      adoption_by_org: adoptionsResult.rows.map((row) => ({
        org: row.adopted_by_org,
        adopted_at: row.adopted_at,
        outcome: row.outcome,
      })),
      outcomes,
    };
  }

  /**
   * Track adoption of an insight by an organization
   */
  async trackAdoption(params: TrackAdoptionParams): Promise<void> {
    const {
      insight_id,
      adopted_by_org,
      adopted_by_agent,
      context,
      outcome,
      metadata = {},
    } = params;

    // Verify insight exists
    const insightResult = await this.pool.query(
      'SELECT id FROM platform_insights WHERE id = $1 AND group_id = $2',
      [insight_id, PLATFORM_GROUP_ID]
    );

    if (insightResult.rows.length === 0) {
      throw new PlatformLibraryError(`Insight ${insight_id} not found`);
    }

    // Validate group_id format for adopting org
    validateGroupId(adopted_by_org);

    // Insert adoption (adoption_count auto-incremented via trigger)
    await this.pool.query(
      `INSERT INTO insight_adoptions (
        insight_id, adopted_by_org, adopted_by_agent, context, outcome, metadata
      ) VALUES ($1, $2, $3, $4, $5, $6)
      ON CONFLICT (insight_id, adopted_by_org) DO UPDATE SET
        adopted_at = NOW(),
        adopted_by_agent = EXCLUDED.adopted_by_agent,
        context = EXCLUDED.context,
        outcome = EXCLUDED.outcome,
        metadata = EXCLUDED.metadata`,
      [
        insight_id,
        adopted_by_org,
        adopted_by_agent ?? null,
        context ?? null,
        outcome ?? null,
        JSON.stringify(metadata),
      ]
    );
  }

  /**
   * Get version history for an insight
   */
  async getVersionHistory(insightId: string): Promise<VersionHistory> {
    // Get current insight
    const currentResult = await this.pool.query<PlatformInsight>(
      'SELECT id, version, title, created_at, supersedes_id FROM platform_insights WHERE id = $1',
      [insightId]
    );

    if (currentResult.rows.length === 0) {
      throw new PlatformLibraryError(`Insight ${insightId} not found`);
    }

    const current = currentResult.rows[0];
    const lineage: InsightVersion[] = [];

    // Walk back through supersessions
    let currentVersion = current;
    while (currentVersion) {
      lineage.unshift({
        id: currentVersion.id,
        version: currentVersion.version,
        title: currentVersion.title,
        created_at: currentVersion.created_at,
        supersedes_id: currentVersion.supersedes_id,
        supersedes_version: null,
      });

      if (!currentVersion.supersedes_id) break;

      const prevResult = await this.pool.query<PlatformInsight>(
        'SELECT id, version, title, created_at, supersedes_id FROM platform_insights WHERE id = $1',
        [currentVersion.supersedes_id]
      );

      if (prevResult.rows.length === 0) break;
      currentVersion = prevResult.rows[0];
    }

    return {
      current_id: current.id,
      current_version: current.version,
      lineage,
    };
  }

  /**
   * Create a new version of an existing insight
   * Implements Steel Frame versioning (SUPERSEDES pattern)
   */
  async createNewVersion(params: CreateVersionParams): Promise<PlatformInsight> {
    const {
      existing_insight_id,
      new_title,
      new_content,
      new_tags,
      new_confidence_score,
      updated_by,
    } = params;

    // Get existing insight
    const existingResult = await this.pool.query<PlatformInsight>(
      'SELECT * FROM platform_insights WHERE id = $1 AND group_id = $2',
      [existing_insight_id, PLATFORM_GROUP_ID]
    );

    if (existingResult.rows.length === 0) {
      throw new PlatformLibraryError(`Insight ${existing_insight_id} not found`);
    }

    const existing = existingResult.rows[0];

    // Create new version
    return this.publishInsight({
      title: new_title ?? existing.title,
      content: new_content,
      category: existing.category as InsightCategory,
      tags: new_tags ?? (typeof existing.tags === 'string' ? JSON.parse(existing.tags as unknown as string) : existing.tags),
      source_org: existing.source_org ?? undefined,
      confidence_score: new_confidence_score ?? existing.confidence_score ?? undefined,
      created_by: updated_by,
      supersedes_id: existing.id,
    });
  }

  /**
   * Get promotion proposals (HITL queue)
   */
  async getPromotionProposals(
    status?: 'pending' | 'approved' | 'rejected' | 'published'
  ): Promise<PromotionProposal[]> {
    const whereClause = status ? 'WHERE status = $1' : '';
    const values = status ? [status] : [];

    const result = await this.pool.query<PromotionProposal>(
      `SELECT * FROM platform_promotion_queue 
       ${whereClause}
       ORDER BY submitted_at DESC`,
      values
    );

    return result.rows.map((row) => ({
      ...row,
      tags: typeof row.tags === 'string' ? JSON.parse(row.tags as unknown as string) : row.tags,
    }));
  }

  /**
   * Submit insight for platform promotion
   */
  async submitForPromotion(params: SubmitPromotionParams): Promise<PromotionProposal> {
    validateGroupId(params.source_group_id);

    const result = await this.pool.query<PromotionProposal>(
      `INSERT INTO platform_promotion_queue (
        source_group_id, source_org, insight_id, title, content, 
        category, tags, confidence_score, submitted_by
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      RETURNING *`,
      [
        params.source_group_id,
        params.source_org,
        params.insight_id,
        params.title,
        params.content,
        params.category,
        JSON.stringify(params.tags ?? []),
        params.confidence_score ?? null,
        params.submitted_by,
      ]
    );

    const proposal = result.rows[0];
    proposal.tags = typeof proposal.tags === 'string' ? JSON.parse(proposal.tags as unknown as string) : proposal.tags;

    return proposal;
  }

  /**
   * Review promotion proposal (HITL approval)
   */
  async reviewPromotion(params: ReviewPromotionParams): Promise<PromotionProposal> {
    const { proposal_id, reviewed_by, approve, review_notes, rejection_reason } = params;

    const result = await this.pool.query<PromotionProposal>(
      `UPDATE platform_promotion_queue 
       SET status = $1, reviewed_by = $2, reviewed_at = NOW(), 
           review_notes = $3, rejection_reason = $4
       WHERE id = $5
       RETURNING *`,
      [
        approve ? 'approved' : 'rejected',
        reviewed_by,
        review_notes ?? null,
        rejection_reason ?? null,
        proposal_id,
      ]
    );

    if (result.rows.length === 0) {
      throw new PlatformLibraryError(`Proposal ${proposal_id} not found`);
    }

    const proposal = result.rows[0];
    proposal.tags = typeof proposal.tags === 'string' ? JSON.parse(proposal.tags as unknown as string) : proposal.tags;

    return proposal;
  }

  /**
   * Publish approved promotion proposal to platform library
   */
  async publishApprovedProposal(proposalId: string): Promise<PlatformInsight> {
    const result = await this.pool.query<{
      title: string;
      content: string;
      category: InsightCategory;
      tags: unknown;
      source_org: string;
      confidence_score: number | null;
      submitted_by: string;
    }>(
      `SELECT title, content, category, tags, source_org, confidence_score, submitted_by
       FROM platform_promotion_queue
       WHERE id = $1 AND status = 'approved'`,
      [proposalId]
    );

    if (result.rows.length === 0) {
      throw new PlatformLibraryError(`Approved proposal ${proposalId} not found`);
    }

    const proposal = result.rows[0];

    // Publish to platform library
    const insight = await this.publishInsight({
      title: proposal.title,
      content: proposal.content,
      category: proposal.category,
      tags: typeof proposal.tags === 'string' ? JSON.parse(proposal.tags as string) : proposal.tags as string[],
      source_org: proposal.source_org ?? undefined,
      confidence_score: proposal.confidence_score ?? undefined,
      created_by: proposal.submitted_by,
    });

    // Update proposal with published insight ID
    await this.pool.query(
      `UPDATE platform_promotion_queue 
       SET status = 'published', published_insight_id = $1
       WHERE id = $2`,
      [insight.id, proposalId]
    );

    return insight;
  }
}

/**
 * Singleton instance
 */
let instance: PlatformLibrary | null = null;

/**
 * Get Platform Library instance
 */
export function getPlatformLibrary(): PlatformLibrary {
  if (!instance) {
    instance = new PlatformLibrary();
  }
  return instance;
}