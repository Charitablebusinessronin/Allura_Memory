/**
 * Platform Library - Story 4.2
 * 
 * Cross-organization knowledge sharing with:
 * - Promoted insights from PostgreSQL traces
 * - Search across organizations
 * - Adoption metrics tracking
 * - Version control with SUPERSEDES pattern
 * 
 * RK-01: Tenant isolation enforced throughout
 */

import type { Pool } from "pg";
import { getPool } from "../postgres/connection";
import { validateTenantGroupId, TENANT_ERROR_CODE } from "../validation/tenant-group-id";
import { GroupIdValidationError } from "../validation/group-id";
import { randomUUID } from "crypto";

/**
 * Promoted insight from organization traces
 * Stored in platform_insights table for cross-organization sharing
 */
export interface PromotedInsight {
  id: string;
  original_insight_id: string;
  original_group_id: string; // Hashed/anonymized for privacy
  sanitized_data: Record<string, unknown>;
  promoted_at: Date;
  promoted_by: string;
  version: number;
  adoption_count: number;
  tags: string[];
}

/**
 * Adoption record for tracking usage
 */
export interface AdoptionRecord {
  id: string;
  insight_id: string;
  adopting_group_id: string;
  adopted_at: Date;
}

/**
 * Adoption metrics for analytics
 */
export interface AdoptionMetrics {
  total_adoptions: number;
  unique_adopters: number;
  top_insights: Array<{
    id: string;
    adoption_count: number;
    tags: string[];
  }>;
}

/**
 * Validation error for platform library operations
 * RK-01: Tenant Isolation Violation
 */
export class PlatformLibraryError extends Error {
  public readonly code: string = TENANT_ERROR_CODE;

  constructor(message: string) {
    super(message);
    this.name = "PlatformLibraryError";
  }
}

/**
 * Hash group_id for privacy
 * Uses simple hashing to anonymize the original organization
 * Format: allura-hash:{hash}
 */
function hashGroupId(group_id: string): string {
  const crypto = require("crypto");
  const hash = crypto
    .createHash("sha256")
    .update(group_id)
    .digest("hex")
    .substring(0, 16);
  return `allura-hash:${hash}`;
}

/**
 * Promote an insight to the platform library
 * 
 * Creates a promoted, sanitized version of an insight from an organization's
 * PostgreSQL traces. Handles privacy by hashing the original group_id.
 * 
 * RK-01: Enforces tenant isolation
 * 
 * @param params.insightId - Original insight ID
 * @param params.group_id - Source organization (will be hashed for privacy)
 * @param params.sanitizedData - Sanitized insight content
 * @param params.tags - Optional tags for filtering
 * @returns The promoted insight record
 * @throws PlatformLibraryError if validation fails (RK-01)
 */
export async function promoteInsight(params: {
  insightId: string;
  group_id: string;
  sanitizedData: Record<string, unknown>;
  tags?: string[];
}): Promise<PromotedInsight> {
  const { insightId, group_id, sanitizedData, tags = [] } = params;

  // RK-01: Validate group_id with tenant naming enforcement
  try {
    validateTenantGroupId(group_id);
  } catch (error) {
    if (error instanceof GroupIdValidationError) {
      throw new PlatformLibraryError(`RK-01: ${error.message}`);
    }
    throw error;
  }

  if (!insightId || insightId.trim().length === 0) {
    throw new PlatformLibraryError("RK-01: insightId is required");
  }

  const pool = getPool();

  // Hash the group_id for privacy
  const hashedGroupId = hashGroupId(group_id);
  const promotedBy = "system"; // Could be extended to track which agent promoted

  // Get current maximum version for this insight
  const versionResult = await pool.query<{ max_version: string | null }>(
    `
    SELECT MAX(version)::text as max_version
    FROM platform_insights
    WHERE original_insight_id = $1
    `,
    [insightId]
  );

  const nextVersion = versionResult.rows[0]?.max_version
    ? parseInt(versionResult.rows[0].max_version, 10) + 1
    : 1;

  // Insert new promoted insight
  const id = randomUUID();
  const insertResult = await pool.query<PromotedInsight>(
    `
    INSERT INTO platform_insights (
      id,
      original_insight_id,
      original_group_id,
      sanitized_data,
      promoted_at,
      promoted_by,
      version,
      adoption_count,
      tags
    ) VALUES ($1, $2, $3, $4, NOW(), $5, $6, 0, $7)
    RETURNING 
      id,
      original_insight_id,
      original_group_id,
      sanitized_data,
      promoted_at,
      promoted_by,
      version,
      adoption_count,
      tags
    `,
    [
      id,
      insightId,
      hashedGroupId,
      JSON.stringify(sanitizedData),
      promotedBy,
      nextVersion,
      tags,
    ]
  );

  return insertResult.rows[0];
}

/**
 * Search platform library across organizations
 * 
 * Full-text search on sanitized_data content, optionally filtered by tags.
 * Results are ordered by promotion date (most recent first).
 * 
 * RK-01: Enforces tenant isolation (returns only sanitized/hashed data)
 * 
 * @param params.query - Search query string
 * @param params.group_id - Requesting organization (for access control)
 * @param params.tags - Optional tags to filter by
 * @param params.limit - Maximum results to return (default: 10)
 * @returns Array of promoted insights matching the query
 * @throws PlatformLibraryError if validation fails (RK-01)
 */
export async function searchPlatformLibrary(params: {
  query: string;
  group_id: string;
  tags?: string[];
  limit?: number;
}): Promise<PromotedInsight[]> {
  const { query, group_id, tags, limit = 10 } = params;

  // RK-01: Validate group_id
  try {
    validateTenantGroupId(group_id);
  } catch (error) {
    if (error instanceof GroupIdValidationError) {
      throw new PlatformLibraryError(`RK-01: ${error.message}`);
    }
    throw error;
  }

  const pool = getPool();

  let result;

  if (tags && tags.length > 0) {
    // Search with tag filtering
    result = await pool.query<PromotedInsight>(
      `
      SELECT 
        id,
        original_insight_id,
        original_group_id,
        sanitized_data,
        promoted_at,
        promoted_by,
        version,
        adoption_count,
        tags
      FROM platform_insights
      WHERE 
        ($1::text = '' OR sanitized_data::text ILIKE '%' || $1 || '%')
        AND tags && $2::text[]
      ORDER BY promoted_at DESC
      LIMIT $3
      `,
      [query, tags, limit]
    );
  } else {
    // Search without tag filtering
    result = await pool.query<PromotedInsight>(
      `
      SELECT 
        id,
        original_insight_id,
        original_group_id,
        sanitized_data,
        promoted_at,
        promoted_by,
        version,
        adoption_count,
        tags
      FROM platform_insights
      WHERE $1::text = '' OR sanitized_data::text ILIKE '%' || $1 || '%'
      ORDER BY promoted_at DESC
      LIMIT $2
      `,
      [query, limit]
    );
  }

  return result.rows;
}

/**
 * Get a specific promoted insight by ID
 * 
 * Note: This query returns the insight regardless of which organization
 * is requesting it, since platform insights are shared. The group_id parameter
 * is only used for validation to ensure the requesting organization is valid.
 * 
 * RK-01: Enforces tenant isolation (validates requesting organization)
 * 
 * @param params.insightId - Promoted insight ID
 * @param params.group_id - Requesting organization (for validation)
 * @returns The promoted insight if found, null otherwise
 * @throws PlatformLibraryError if validation fails (RK-01)
 */
export async function getInsight(params: {
  insightId: string;
  group_id: string;
}): Promise<PromotedInsight | null> {
  const { insightId, group_id } = params;

  // RK-01: Validate group_id
  try {
    validateTenantGroupId(group_id);
  } catch (error) {
    if (error instanceof GroupIdValidationError) {
      throw new PlatformLibraryError(`RK-01: ${error.message}`);
    }
    throw error;
  }

  const pool = getPool();

  const result = await pool.query<PromotedInsight>(
    `
    SELECT 
      id,
      original_insight_id,
      original_group_id,
      sanitized_data,
      promoted_at,
      promoted_by,
      version,
      adoption_count,
      tags
    FROM platform_insights
    WHERE id = $1
    `,
    [insightId]
  );

  return result.rows[0] || null;
}

/**
 * Track adoption of a promoted insight
 * 
 * Records when an organization adopts a promoted insight. This creates
 * an entry in insight_adoptions and increments the adoption_count.
 * 
 * RK-01: Enforces tenant isolation for the adopting organization
 * 
 * @param params.insightId - Promoted insight ID
 * @param params.adopting_group_id - Organization adopting the insight
 * @throws PlatformLibraryError if validation fails (RK-01)
 */
export async function trackAdoption(params: {
  insightId: string;
  adopting_group_id: string;
}): Promise<void> {
  const { insightId, adopting_group_id } = params;

  // RK-01: Validate adopting_group_id
  try {
    validateTenantGroupId(adopting_group_id);
  } catch (error) {
    if (error instanceof GroupIdValidationError) {
      throw new PlatformLibraryError(`RK-01: ${error.message}`);
    }
    throw error;
  }

  const pool = getPool();

  // Check for duplicate adoption (idempotent)
  const existingAdoption = await pool.query(
    `
    SELECT id
    FROM insight_adoptions
    WHERE insight_id = $1 AND adopting_group_id = $2
    `,
    [insightId, adopting_group_id]
  );

  if (existingAdoption.rows.length > 0) {
    // Already adopted - idempotent operation
    return;
  }

  // Insert adoption record
  const adoptionId = randomUUID();
  await pool.query(
    `
    INSERT INTO insight_adoptions (
      id,
      insight_id,
      adopting_group_id,
      adopted_at
    ) VALUES ($1, $2, $3, NOW())
    `,
    [adoptionId, insightId, adopting_group_id]
  );

  // Increment adoption count
  await pool.query(
    `
    UPDATE platform_insights
    SET adoption_count = adoption_count + 1
    WHERE id = $1
    `,
    [insightId]
  );
}

/**
 * Get adoption metrics for an organization's promoted insights
 * 
 * Returns aggregate metrics about how insights from this organization
 * have been adopted by other organizations.
 * 
 * RK-01: Enforces tenant isolation
 * 
 * @param params.group_id - Organization to get metrics for
 * @param params.timeRange - Optional time range filter
 * @returns Adoption metrics including total adoptions, unique adopters, and top insights
 * @throws PlatformLibraryError if validation fails (RK-01)
 */
export async function getAdoptionMetrics(params: {
  group_id: string;
  timeRange?: { start: Date; end: Date };
}): Promise<AdoptionMetrics> {
  const { group_id, timeRange } = params;

  // RK-01: Validate group_id
  try {
    validateTenantGroupId(group_id);
  } catch (error) {
    if (error instanceof GroupIdValidationError) {
      throw new PlatformLibraryError(`RK-01: ${error.message}`);
    }
    throw error;
  }

  const pool = getPool();
  const hashedGroupId = hashGroupId(group_id);

  // Build time range filter
  const timeFilter = timeRange
    ? `AND ia.adopted_at >= $2 AND ia.adopted_at <= $3`
    : "";
  const timeParams = timeRange ? [timeRange.start, timeRange.end] : [];

  // Get total adoptions and unique adopters
  const statsResult = await pool.query<
    { total_adoptions: string; unique_adopters: string }
  >(
    `
    SELECT 
      COUNT(*)::text as total_adoptions,
      COUNT(DISTINCT ia.adopting_group_id)::text as unique_adopters
    FROM insight_adoptions ia
    JOIN platform_insights pi ON ia.insight_id = pi.id
    WHERE pi.original_group_id = $1
    ${timeFilter}
    `,
    [hashedGroupId, ...timeParams]
  );

  const { total_adoptions, unique_adopters } = statsResult.rows[0] || {
    total_adoptions: "0",
    unique_adopters: "0",
  };

  // Get top insights by adoption count
  const topInsightsResult = await pool.query<
    { id: string; adoption_count: string; tags: string[] }
  >(
    `
    SELECT 
      pi.id,
      pi.adoption_count::text,
      pi.tags
    FROM platform_insights pi
    WHERE pi.original_group_id = $1
    ORDER BY pi.adoption_count DESC
    LIMIT 10
    `,
    [hashedGroupId]
  );

  return {
    total_adoptions: parseInt(total_adoptions, 10),
    unique_adopters: parseInt(unique_adopters, 10),
    top_insights: topInsightsResult.rows.map((row) => ({
      id: row.id,
      adoption_count: parseInt(row.adoption_count, 10),
      tags: row.tags || [],
    })),
  };
}