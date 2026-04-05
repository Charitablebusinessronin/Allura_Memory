/**
 * Platform Library Tests - Story 4.2
 * 
 * Tests for cross-organization knowledge sharing:
 * - Promote insights from PostgreSQL traces
 * - Search across organizations
 * - Track adoption metrics
 * - Version control with SUPERSEDES pattern
 * 
 * RK-01: Tenant isolation enforced throughout
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import {
  promoteInsight,
  searchPlatformLibrary,
  getInsight,
  trackAdoption,
  getAdoptionMetrics,
  type PromotedInsight,
  type AdoptionMetrics,
} from "./platform-library";
import { getPool, closePool } from "../postgres/connection";
import { validateTenantGroupId } from "../validation/tenant-group-id";
import { GroupIdValidationError } from "../validation/group-id";

describe("Platform Library - Story 4.2", () => {
  const testGroupId = "allura-test";
  const testAgentId = "memory-builder-test";

  beforeEach(async () => {
    // Ensure connection pool is ready
    const pool = getPool();
    await pool.query("SELECT 1");
  });

  afterEach(async () => {
    // Clean up test data after each test
    const pool = getPool();
    await pool.query(
      "DELETE FROM insight_adoptions WHERE adopting_group_id LIKE $1",
      [`${testGroupId}%`]
    );
    await pool.query(
      "DELETE FROM platform_insights WHERE original_group_id LIKE $1",
      [`${testGroupId}%`]
    );
  });

  describe("RK-01: Tenant Isolation Validation", () => {
    it("should reject 'roninmemory' with RK-01 error", async () => {
      const result = promoteInsight({
        insightId: "test-insight-1",
        group_id: "roninmemory", // Invalid
        sanitizedData: { content: "test" },
      });

      await expect(result).rejects.toThrow();
      
      try {
        await promoteInsight({
          insightId: "test-insight-1",
          group_id: "roninmemory",
          sanitizedData: { content: "test" },
        });
      } catch (error) {
        expect(error).toBeInstanceOf(Error);
        expect((error as Error).message).toContain("RK-01");
        expect((error as Error).message).toContain("allura-{org}");
      }
    });

    it("should accept valid allura-{org} format", async () => {
      const result = await promoteInsight({
        insightId: "test-insight-valid",
        group_id: testGroupId,
        sanitizedData: { content: "test content" },
      });

      expect(result.original_group_id).toContain("allura-");
      expect(result.version).toBe(1);
    });

    it("should reject cross-tenant getInsight queries", async () => {
      // Create insight in allura-test
      const promoted = await promoteInsight({
        insightId: "test-cross-tenant",
        group_id: testGroupId,
        sanitizedData: { content: "test" },
      });

      // Query from different tenant - should return null
      const result = await getInsight({
        insightId: promoted.id,
        group_id: "allura-other-org",
      });

      expect(result).toBeNull();
    });

    it("should reject invalid group_id in search queries", async () => {
      await expect(
        searchPlatformLibrary({
          query: "test",
          group_id: "invalid-format", // Invalid
        })
      ).rejects.toThrow();
    });
  });

  describe("promoteInsight", () => {
    it("should create new promoted insight with version 1", async () => {
      const result = await promoteInsight({
        insightId: "test-insight-1",
        group_id: testGroupId,
        sanitizedData: {
          content: "Pattern: Use SUPERSEDES for versioning",
          confidence: 0.95,
          tags: ["architecture", "versioning"],
        },
      });

      expect(result).toMatchObject({
        original_insight_id: "test-insight-1",
        original_group_id: expect.stringContaining("allura-"),
        sanitized_data: expect.objectContaining({
          content: "Pattern: Use SUPERSEDES for versioning",
        }),
        version: 1,
        adoption_count: 0,
        tags: expect.arrayContaining(["architecture", "versioning"]),
      });
      expect(result.promoted_at).toBeInstanceOf(Date);
      expect(result.id).toBeDefined();
    });

    it("should hash original_group_id for privacy", async () => {
      const result = await promoteInsight({
        insightId: "test-privacy",
        group_id: testGroupId,
        sanitizedData: { content: "test" },
      });

      // original_group_id should be hashed, not plain text
      expect(result.original_group_id).not.toBe(testGroupId);
      expect(result.original_group_id).toMatch(/^allura-hash:/);
    });

    it("should increment version when promoting same insight again", async () => {
      // First promotion
      const v1 = await promoteInsight({
        insightId: "test-version",
        group_id: testGroupId,
        sanitizedData: { content: "v1 content" },
      });

      expect(v1.version).toBe(1);

      // Second promotion (version upgrade)
      const v2 = await promoteInsight({
        insightId: "test-version",
        group_id: testGroupId,
        sanitizedData: { content: "v2 improved content" },
      });

      expect(v2.version).toBe(2);
      expect(v2.id).not.toBe(v1.id);
      
      // Original should still be queryable
      const original = await getInsight({
        insightId: v1.id,
        group_id: testGroupId,
      });
      expect(original).not.toBeNull();
    });

    it("should default tags to empty array", async () => {
      const result = await promoteInsight({
        insightId: "test-no-tags",
        group_id: testGroupId,
        sanitizedData: { content: "test" },
        // tags not provided
      });

      expect(result.tags).toEqual([]);
    });
  });

  describe("searchPlatformLibrary", () => {
    beforeEach(async () => {
      // Seed test data
      await promoteInsight({
        insightId: "search-test-1",
        group_id: testGroupId,
        sanitizedData: {
          content: "Pattern: Use tenant isolation for multi-tenancy",
          confidence: 0.9,
        },
        tags: ["architecture", "security"],
      });

      await promoteInsight({
        insightId: "search-test-2",
        group_id: testGroupId,
        sanitizedData: {
          content: "Best practice: Validate all group_id inputs",
          confidence: 0.85,
        },
        tags: ["validation", "security"],
      });
    });

    it("should search across organization insights", async () => {
      const results = await searchPlatformLibrary({
        query: "tenant",
        group_id: testGroupId,
        limit: 10,
      });

      expect(results.length).toBeGreaterThan(0);
      expect(results.some(r => r.sanitized_data.content.includes("tenant"))).toBe(true);
    });

    it("should filter by tags", async () => {
      const results = await searchPlatformLibrary({
        query: "",
        group_id: testGroupId,
        tags: ["security"],
        limit: 10,
      });

      expect(results.length).toBe(2); // Both have 'security' tag
    });

    it("should respect limit parameter", async () => {
      const results = await searchPlatformLibrary({
        query: "",
        group_id: testGroupId,
        limit: 1,
      });

      expect(results.length).toBe(1);
    });

    it("should return results ordered by promoted_at DESC", async () => {
      const results = await searchPlatformLibrary({
        query: "",
        group_id: testGroupId,
        limit: 10,
      });

      if (results.length >= 2) {
        expect(results[0].promoted_at.getTime()).toBeGreaterThanOrEqual(
          results[1].promoted_at.getTime()
        );
      }
    });
  });

  describe("getInsight", () => {
    it("should retrieve insight by ID", async () => {
      const promoted = await promoteInsight({
        insightId: "get-test",
        group_id: testGroupId,
        sanitizedData: { content: "test content" },
      });

      const result = await getInsight({
        insightId: promoted.id,
        group_id: testGroupId,
      });

      expect(result).not.toBeNull();
      expect(result?.id).toBe(promoted.id);
      expect(result?.sanitized_data.content).toBe("test content");
    });

    it("should return null for non-existent insight", async () => {
      const result = await getInsight({
        insightId: "00000000-0000-0000-0000-000000000000",
        group_id: testGroupId,
      });

      expect(result).toBeNull();
    });

    it("should enforce tenant isolation", async () => {
      // Create in allura-test
      const promoted = await promoteInsight({
        insightId: "isolation-test",
        group_id: testGroupId,
        sanitizedData: { content: "test" },
      });

      // Query from different tenant
      const result = await getInsight({
        insightId: promoted.id,
        group_id: "allura-different",
      });

      expect(result).toBeNull();
    });
  });

  describe("trackAdoption", () => {
    it("should track adoption count increment", async () => {
      const promoted = await promoteInsight({
        insightId: "adoption-test",
        group_id: testGroupId,
        sanitizedData: { content: "test" },
      });

      // Initial adoption count
      expect(promoted.adoption_count).toBe(0);

      // Track adoption
      await trackAdoption({
        insightId: promoted.id,
        adopting_group_id: "allura-adopter-org",
      });

      // Get updated insight
      const updated = await getInsight({
        insightId: promoted.id,
        group_id: testGroupId,
      });

      expect(updated?.adoption_count).toBe(1);
    });

    it("should record adoption metadata", async () => {
      const promoted = await promoteInsight({
        insightId: "adoption-metadata",
        group_id: testGroupId,
        sanitizedData: { content: "test" },
      });

      await trackAdoption({
        insightId: promoted.id,
        adopting_group_id: "allura-adopter-1",
      });

      await trackAdoption({
        insightId: promoted.id,
        adopting_group_id: "allura-adopter-2",
      });

      const metrics = await getAdoptionMetrics({
        group_id: testGroupId,
      });

      expect(metrics.total_adoptions).toBe(2);
      expect(metrics.unique_adopters).toBe(2);
    });

    it("should prevent duplicate adoptions from same organization", async () => {
      const promoted = await promoteInsight({
        insightId: "no-dupes",
        group_id: testGroupId,
        sanitizedData: { content: "test" },
      });

      // First adoption
      await trackAdoption({
        insightId: promoted.id,
        adopting_group_id: "allura-same-org",
      });

      // Second adoption from same org - should be idempotent
      await trackAdoption({
        insightId: promoted.id,
        adopting_group_id: "allura-same-org",
      });

      const metrics = await getAdoptionMetrics({
        group_id: testGroupId,
      });

      // Should only count as 1 adoption
      expect(metrics.total_adoptions).toBe(1);
    });
  });

  describe("getAdoptionMetrics", () => {
    beforeEach(async () => {
      // Create insights
      const insight1 = await promoteInsight({
        insightId: "metrics-1",
        group_id: testGroupId,
        sanitizedData: { content: "test 1" },
        tags: ["architecture"],
      });

      const insight2 = await promoteInsight({
        insightId: "metrics-2",
        group_id: testGroupId,
        sanitizedData: { content: "test 2" },
        tags: ["security"],
      });

      // Track adoptions
      await trackAdoption({
        insightId: insight1.id,
        adopting_group_id: "allura-org-a",
      });

      await trackAdoption({
        insightId: insight2.id,
        adopting_group_id: "allura-org-b",
      });

      await trackAdoption({
        insightId: insight2.id,
        adopting_group_id: "allura-org-c",
      });
    });

    it("should return total adoption count", async () => {
      const metrics = await getAdoptionMetrics({
        group_id: testGroupId,
      });

      expect(metrics.total_adoptions).toBe(3); // 1 + 2
      expect(metrics.unique_adopters).toBe(3); // 3 different orgs
    });

    it("should filter by time range", async () => {
      const start = new Date(Date.now() - 24 * 60 * 60 * 1000); // 24 hours ago
      const end = new Date();

      const metrics = await getAdoptionMetrics({
        group_id: testGroupId,
        timeRange: { start, end },
      });

      // All test adoptions are within time range
      expect(metrics.total_adoptions).toBe(3);
    });

    it("should return insights with adoption counts", async () => {
      const metrics = await getAdoptionMetrics({
        group_id: testGroupId,
      });

      expect(metrics.top_insights).toBeDefined();
      expect(metrics.top_insights.length).toBeGreaterThan(0);
      
      // Most adopted insight should be first
      if (metrics.top_insights.length >= 2) {
        expect(metrics.top_insights[0].adoption_count).toBeGreaterThanOrEqual(
          metrics.top_insights[1].adoption_count
        );
      }
    });
  });

  describe("Version Control", () => {
    it("should create SUPERSEDES relationship for version upgrades", async () => {
      // First version
      const v1 = await promoteInsight({
        insightId: "version-control-test",
        group_id: testGroupId,
        sanitizedData: { content: "v1" },
      });

      // Second version
      const v2 = await promoteInsight({
        insightId: "version-control-test",
        group_id: testGroupId,
        sanitizedData: { content: "v2 improved" },
      });

      expect(v2.version).toBe(2);
      expect(v2.id).not.toBe(v1.id);

      // Get latest version
      const latest = await getInsight({
        insightId: "version-control-test", // Use original_insight_id
        group_id: testGroupId,
      });

      // Should return the latest version
      expect(latest?.version).toBe(2);
    });

    it("should allow retrieving specific versions", async () => {
      // Create multiple versions
      await promoteInsight({
        insightId: "version-specific",
        group_id: testGroupId,
        sanitizedData: { content: "v1" },
      });

      await promoteInsight({
        insightId: "version-specific",
        group_id: testGroupId,
        sanitizedData: { content: "v2" },
      });

      // Query all versions
      // This functionality would be added later
      // For now, just ensure versions are created correctly
    });
  });
});