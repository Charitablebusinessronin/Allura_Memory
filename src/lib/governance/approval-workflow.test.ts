/**
 * Approval Workflow Tests
 * Story 3.2: HITL Knowledge Promotion
 * 
 * Tests:
 * - Propose for promotion
 * - Get pending approvals
 * - Approve promotion
 * - Reject promotion
 * - group_id enforcement (RK-01)
 */

import { describe, expect, it, beforeEach, afterEach } from "vitest";
import {
  proposeForPromotion,
  getPendingApprovals,
  approvePromotion,
  rejectPromotion,
  getAllPromotionRequests,
  getPromotionRequestById,
  type PromotionRequest,
  PromotionValidationError,
  PromotionConflictError,
} from "./approval-workflow";
import { getPool } from "../postgres/connection";
import { closeDriver } from "../neo4j/connection";
import { GroupIdValidationError } from "../validation/group-id";

/**
 * Test utilities
 */
async function clearTestData(): Promise<void> {
  const pool = getPool();
  
  // Clean up PostgreSQL test data
  await pool.query("DELETE FROM promotion_requests WHERE group_id LIKE 'allura-test-%'");
  await pool.query("DELETE FROM events WHERE group_id LIKE 'allura-test-%'");
  
  // Clean up Neo4j test data
  // Note: We'll do this via the Neo4j driver if needed
}

async function setupTestSchema(): Promise<void> {
  const pool = getPool();
  
  // Check if promotion_requests table exists, create if not
  const tableCheck = await pool.query(`
    SELECT EXISTS (
      SELECT FROM information_schema.tables 
      WHERE table_schema = 'public'
      AND table_name = 'promotion_requests'
    );
  `);
  
  if (!tableCheck.rows[0].exists) {
    await pool.query(`
      CREATE TABLE promotion_requests (
        id UUID PRIMARY KEY,
        group_id TEXT NOT NULL,
        insight_id TEXT NOT NULL,
        proposed_by TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'pending',
        rationale TEXT,
        approved_by TEXT,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      );
    `);
  }
}

describe("Approval Workflow", () => {
  beforeEach(async () => {
    await setupTestSchema();
    await clearTestData();
  });

  afterEach(async () => {
    await clearTestData();
  });

  describe("proposeForPromotion", () => {
    it("should create a pending promotion request", async () => {
      const result = await proposeForPromotion({
        insightId: "test-insight-001",
        proposedBy: "agent.memory-architect",
        group_id: "allura-test-promotion",
        rationale: "This insight improves system accuracy by 15%",
      });

      expect(result).toBeDefined();
      expect(result.id).toBeDefined();
      expect(result.group_id).toBe("allura-test-promotion");
      expect(result.insight_id).toBe("test-insight-001");
      expect(result.proposed_by).toBe("agent.memory-architect");
      expect(result.status).toBe("pending");
      expect(result.rationale).toBe("This insight improves system accuracy by 15%");
      expect(result.approved_by).toBeNull();
      expect(result.created_at).toBeInstanceOf(Date);
      expect(result.updated_at).toBeInstanceOf(Date);
    });

    it("should log promotion_proposed event", async () => {
      await proposeForPromotion({
        insightId: "test-insight-002",
        proposedBy: "agent.memory-scout",
        group_id: "allura-test-promotion",
        rationale: "Critical pattern discovered in user behavior",
      });

      const pool = getPool();
      const events = await pool.query(`
        SELECT * FROM events
        WHERE group_id = 'allura-test-promotion'
          AND event_type = 'promotion_proposed'
        ORDER BY created_at DESC
        LIMIT 1
      `);

      expect(events.rows.length).toBeGreaterThan(0);
      const event = events.rows[0];
      expect(event.agent_id).toBe("agent.memory-scout");
      expect(event.metadata).toBeDefined();
    });

    it("should enforce group_id validation with RK-01 error code", async () => {
      // Should reject non-allura group_id
      await expect(
        proposeForPromotion({
          insightId: "test-insight-003",
          proposedBy: "agent.test",
          group_id: "invalid-group-id",
          rationale: "Test rationale",
        })
      ).rejects.toThrow(GroupIdValidationError);

      try {
        await proposeForPromotion({
          insightId: "test-insight-003",
          proposedBy: "agent.test",
          group_id: "invalid-group-id",
          rationale: "Test rationale",
        });
      } catch (error) {
        expect(error).toBeInstanceOf(GroupIdValidationError);
        expect((error as GroupIdValidationError).message).toContain("RK-01");
      }
    });

    it("should reject empty rationale", async () => {
      await expect(
        proposeForPromotion({
          insightId: "test-insight-004",
          proposedBy: "agent.test",
          group_id: "allura-test-promotion",
          rationale: "",
        })
      ).rejects.toThrow(PromotionValidationError);
    });

    it("should reject empty proposedBy", async () => {
      await expect(
        proposeForPromotion({
          insightId: "test-insight-005",
          proposedBy: "",
          group_id: "allura-test-promotion",
          rationale: "Test rationale",
        })
      ).rejects.toThrow(PromotionValidationError);
    });

    it("should reject empty insightId", async () => {
      await expect(
        proposeForPromotion({
          insightId: "",
          proposedBy: "agent.test",
          group_id: "allura-test-promotion",
          rationale: "Test rationale",
        })
      ).rejects.toThrow(PromotionValidationError);
    });
  });

  describe("getPendingApprovals", () => {
    it("should return pending promotion requests for a group", async () => {
      // Create test requests
      await proposeForPromotion({
        insightId: "test-insight-010",
        proposedBy: "agent.test",
        group_id: "allura-test-pending",
        rationale: "Pending insight 1",
      });

      await proposeForPromotion({
        insightId: "test-insight-011",
        proposedBy: "agent.test",
        group_id: "allura-test-pending",
        rationale: "Pending insight 2",
      });

      const result = await getPendingApprovals({
        group_id: "allura-test-pending",
      });

      expect(result.length).toBe(2);
      expect(result[0].status).toBe("pending");
      expect(result[1].status).toBe("pending");
    });

    it("should respect limit parameter", async () => {
      // Create multiple requests
      for (let i = 0; i < 10; i++) {
        await proposeForPromotion({
          insightId: `test-insight-limit-${i}`,
          proposedBy: "agent.test",
          group_id: "allura-test-limit",
          rationale: `Rationale ${i}`,
        });
      }

      const result = await getPendingApprovals({
        group_id: "allura-test-limit",
        limit: 5,
      });

      expect(result.length).toBe(5);
    });

    it("should not leak requests from other groups", async () => {
      // Create requests in different groups
      await proposeForPromotion({
        insightId: "test-insight-isolated-1",
        proposedBy: "agent.test",
        group_id: "allura-test-isolated-a",
        rationale: "Isolated from b",
      });

      await proposeForPromotion({
        insightId: "test-insight-isolated-2",
        proposedBy: "agent.test",
        group_id: "allura-test-isolated-b",
        rationale: "Isolated from a",
      });

      const result = await getPendingApprovals({
        group_id: "allura-test-isolated-a",
      });

      expect(result.length).toBe(1);
      expect(result[0].group_id).toBe("allura-test-isolated-a");
    });

    it("should enforce group_id validation with RK-01", async () => {
      await expect(
        getPendingApprovals({
          group_id: "invalid-group-id",
        })
      ).rejects.toThrow(GroupIdValidationError);
    });
  });

  describe("approvePromotion", () => {
    it("should approve a pending promotion request", async () => {
      // Create a request
      const request = await proposeForPromotion({
        insightId: "test-insight-approve-001",
        proposedBy: "agent.test",
        group_id: "allura-test-approve",
        rationale: "Approve this insight",
      });

      // Approve it
      const insight = await approvePromotion({
        requestId: request.id,
        approvedBy: "human.auditor",
        group_id: "allura-test-approve",
      });

      // Check Neo4j insight was created
      expect(insight).toBeDefined();
      expect(insight.insight_id).toBe("test-insight-approve-001");
      expect(insight.group_id).toBe("allura-test-approve");
      expect(insight.content).toBe("Approve this insight");
      expect(insight.source_type).toBe("promotion");
      expect(insight.status).toBe("active");

      // Check PostgreSQL status updated
      const pool = getPool();
      const updated = await pool.query<PromotionRequest>(
        "SELECT * FROM promotion_requests WHERE id = $1",
        [request.id]
      );

      expect(updated.rows[0].status).toBe("approved");
      expect(updated.rows[0].approved_by).toBe("human.auditor");
    });

    it("should log promotion_approved event", async () => {
      const request = await proposeForPromotion({
        insightId: "test-insight-approve-002",
        proposedBy: "agent.test",
        group_id: "allura-test-approve",
        rationale: "Approve insight 2",
      });

      await approvePromotion({
        requestId: request.id,
        approvedBy: "human.auditor",
        group_id: "allura-test-approve",
      });

      const pool = getPool();
      const events = await pool.query(`
        SELECT * FROM events
        WHERE group_id = 'allura-test-approve'
          AND event_type = 'promotion_approved'
      `);

      expect(events.rows.length).toBeGreaterThan(0);
      const event = events.rows[0];
      expect(event.agent_id).toBe("human.auditor");
    });

    it("should reject approval of non-existent request", async () => {
      await expect(
        approvePromotion({
          requestId: "non-existent-id",
          approvedBy: "human.auditor",
          group_id: "allura-test-approve",
        })
      ).rejects.toThrow(PromotionValidationError);
    });

    it("should reject approval of already-approved request", async () => {
      const request = await proposeForPromotion({
        insightId: "test-insight-approve-003",
        proposedBy: "agent.test",
        group_id: "allura-test-approve",
        rationale: "Approve insight 3",
      });

      // First approval
      await approvePromotion({
        requestId: request.id,
        approvedBy: "human.auditor",
        group_id: "allura-test-approve",
      });

      // Second approval attempt
      await expect(
        approvePromotion({
          requestId: request.id,
          approvedBy: "human.auditor-2",
          group_id: "allura-test-approve",
        })
      ).rejects.toThrow(PromotionConflictError);
    });

    it("should reject approval of rejected request", async () => {
      const request = await proposeForPromotion({
        insightId: "test-insight-approve-004",
        proposedBy: "agent.test",
        group_id: "allura-test-approve",
        rationale: "Approve insight 4",
      });

      // Reject it first
      await rejectPromotion({
        requestId: request.id,
        rejectedBy: "human.auditor",
        group_id: "allura-test-approve",
        reason: "Not ready for promotion",
      });

      // Try to approve
      await expect(
        approvePromotion({
          requestId: request.id,
          approvedBy: "human.auditor-2",
          group_id: "allura-test-approve",
        })
      ).rejects.toThrow(PromotionConflictError);
    });

    it("should enforce group_id validation with RK-01", async () => {
      const request = await proposeForPromotion({
        insightId: "test-insight-approve-005",
        proposedBy: "agent.test",
        group_id: "allura-test-approve",
        rationale: "Approve insight 5",
      });

      await expect(
        approvePromotion({
          requestId: request.id,
          approvedBy: "human.auditor",
          group_id: "invalid-group-id",
        })
      ).rejects.toThrow(GroupIdValidationError);
    });
  });

  describe("rejectPromotion", () => {
    it("should reject a pending promotion request", async () => {
      const request = await proposeForPromotion({
        insightId: "test-insight-reject-001",
        proposedBy: "agent.test",
        group_id: "allura-test-reject",
        rationale: "Reject this insight",
      });

      await rejectPromotion({
        requestId: request.id,
        rejectedBy: "human.auditor",
        group_id: "allura-test-reject",
        reason: "Insufficient evidence",
      });

      // Check PostgreSQL status updated
      const pool = getPool();
      const updated = await pool.query<PromotionRequest>(
        "SELECT * FROM promotion_requests WHERE id = $1",
        [request.id]
      );

      expect(updated.rows[0].status).toBe("rejected");
      expect(updated.rows[0].approved_by).toBe("human.auditor");
    });

    it("should log promotion_rejected event with reason", async () => {
      const request = await proposeForPromotion({
        insightId: "test-insight-reject-002",
        proposedBy: "agent.test",
        group_id: "allura-test-reject",
        rationale: "Reject insight 2",
      });

      await rejectPromotion({
        requestId: request.id,
        rejectedBy: "human.auditor",
        group_id: "allura-test-reject",
        reason: "Conflicts with existing knowledge",
      });

      const pool = getPool();
      const events = await pool.query(`
        SELECT * FROM events
        WHERE group_id = 'allura-test-reject'
          AND event_type = 'promotion_rejected'
      `);

      expect(events.rows.length).toBeGreaterThan(0);
      const event = events.rows[0];
      expect(event.metadata).toBeDefined();
      // Metadata should contain rejection_reason
    });

    it("should require rejection reason", async () => {
      const request = await proposeForPromotion({
        insightId: "test-insight-reject-003",
        proposedBy: "agent.test",
        group_id: "allura-test-reject",
        rationale: "Reject insight 3",
      });

      await expect(
        rejectPromotion({
          requestId: request.id,
          rejectedBy: "human.auditor",
          group_id: "allura-test-reject",
          reason: "",
        })
      ).rejects.toThrow(PromotionValidationError);
    });

    it("should reject rejection of non-existent request", async () => {
      await expect(
        rejectPromotion({
          requestId: "non-existent-id",
          rejectedBy: "human.auditor",
          group_id: "allura-test-reject",
          reason: "Testing",
        })
      ).rejects.toThrow(PromotionValidationError);
    });

    it("should reject rejection of already-rejected request", async () => {
      const request = await proposeForPromotion({
        insightId: "test-insight-reject-004",
        proposedBy: "agent.test",
        group_id: "allura-test-reject",
        rationale: "Reject insight 4",
      });

      // First rejection
      await rejectPromotion({
        requestId: request.id,
        rejectedBy: "human.auditor",
        group_id: "allura-test-reject",
        reason: "Not ready",
      });

      // Second rejection attempt
      await expect(
        rejectPromotion({
          requestId: request.id,
          rejectedBy: "human.auditor-2",
          group_id: "allura-test-reject",
          reason: "Still not ready",
        })
      ).rejects.toThrow(PromotionConflictError);
    });

    it("should enforce group_id validation with RK-01", async () => {
      const request = await proposeForPromotion({
        insightId: "test-insight-reject-005",
        proposedBy: "agent.test",
        group_id: "allura-test-reject",
        rationale: "Reject insight 5",
      });

      await expect(
        rejectPromotion({
          requestId: request.id,
          rejectedBy: "human.auditor",
          group_id: "invalid-group-id",
          reason: "Testing",
        })
      ).rejects.toThrow(GroupIdValidationError);
    });
  });

  describe("getAllPromotionRequests", () => {
    it("should return all promotion requests for a group", async () => {
      // Create requests with different statuses
      const req1 = await proposeForPromotion({
        insightId: "test-insight-all-001",
        proposedBy: "agent.test",
        group_id: "allura-test-all",
        rationale: "Pending request",
      });

      const req2 = await proposeForPromotion({
        insightId: "test-insight-all-002",
        proposedBy: "agent.test",
        group_id: "allura-test-all",
        rationale: "To be approved",
      });

      await approvePromotion({
        requestId: req2.id,
        approvedBy: "human.auditor",
        group_id: "allura-test-all",
      });

      const req3 = await proposeForPromotion({
        insightId: "test-insight-all-003",
        proposedBy: "agent.test",
        group_id: "allura-test-all",
        rationale: "To be rejected",
      });

      await rejectPromotion({
        requestId: req3.id,
        rejectedBy: "human.auditor",
        group_id: "allura-test-all",
        reason: "Not suitable",
      });

      const result = await getAllPromotionRequests({
        group_id: "allura-test-all",
      });

      expect(result.length).toBe(3);
      expect(result.map((r) => r.status)).toContain("pending");
      expect(result.map((r) => r.status)).toContain("approved");
      expect(result.map((r) => r.status)).toContain("rejected");
    });

    it("should filter by status", async () => {
      const req1 = await proposeForPromotion({
        insightId: "test-insight-status-001",
        proposedBy: "agent.test",
        group_id: "allura-test-status",
        rationale: "Pending",
      });

      const req2 = await proposeForPromotion({
        insightId: "test-insight-status-002",
        proposedBy: "agent.test",
        group_id: "allura-test-status",
        rationale: "Approved",
      });

      await approvePromotion({
        requestId: req2.id,
        approvedBy: "human.auditor",
        group_id: "allura-test-status",
      });

      const pending = await getAllPromotionRequests({
        group_id: "allura-test-status",
        status: "pending",
      });

      expect(pending.length).toBe(1);
      expect(pending[0].id).toBe(req1.id);

      const approved = await getAllPromotionRequests({
        group_id: "allura-test-status",
        status: "approved",
      });

      expect(approved.length).toBe(1);
      expect(approved[0].id).toBe(req2.id);
    });

    it("should enforce group_id isolation", async () => {
      await proposeForPromotion({
        insightId: "test-insight-isolated-001",
        proposedBy: "agent.test",
        group_id: "allura-test-isolation-a",
        rationale: "Group A",
      });

      await proposeForPromotion({
        insightId: "test-insight-isolated-002",
        proposedBy: "agent.test",
        group_id: "allura-test-isolation-b",
        rationale: "Group B",
      });

      const result = await getAllPromotionRequests({
        group_id: "allura-test-isolation-a",
      });

      expect(result.length).toBe(1);
      expect(result[0].group_id).toBe("allura-test-isolation-a");
    });

    it("should enforce group_id validation with RK-01", async () => {
      await expect(
        getAllPromotionRequests({
          group_id: "invalid-group-id",
        })
      ).rejects.toThrow(GroupIdValidationError);
    });
  });

  describe("getPromotionRequestById", () => {
    it("should return promotion request by ID", async () => {
      const request = await proposeForPromotion({
        insightId: "test-insight-byid-001",
        proposedBy: "agent.test",
        group_id: "allura-test-byid",
        rationale: "Find by ID",
      });

      const result = await getPromotionRequestById({
        requestId: request.id,
        group_id: "allura-test-byid",
      });

      expect(result).toBeDefined();
      expect(result?.id).toBe(request.id);
      expect(result?.insight_id).toBe("test-insight-byid-001");
    });

    it("should return null for non-existent ID", async () => {
      const result = await getPromotionRequestById({
        requestId: "non-existent-id",
        group_id: "allura-test-byid",
      });

      expect(result).toBeNull();
    });

    it("should enforce group_id isolation", async () => {
      const request = await proposeForPromotion({
        insightId: "test-insight-isolated-id-001",
        proposedBy: "agent.test",
        group_id: "allura-test-byid-a",
        rationale: "Isolated by ID",
      });

      // Try to fetch from wrong group
      const result = await getPromotionRequestById({
        requestId: request.id,
        group_id: "allura-test-byid-b",
      });

      expect(result).toBeNull();
    });

    it("should enforce group_id validation with RK-01", async () => {
      await expect(
        getPromotionRequestById({
          requestId: "test-id",
          group_id: "invalid-group-id",
        })
      ).rejects.toThrow(GroupIdValidationError);
    });
  });

  describe("group_id enforcement", () => {
    it("should enforce RK-01 error code for all operations", async () => {
      const invalidGroupId = "invalid-without-allura-prefix";

      // proposeForPromotion
      try {
        await proposeForPromotion({
          insightId: "test",
          proposedBy: "agent.test",
          group_id: invalidGroupId,
          rationale: "test",
        });
        expect.fail("Should have thrown GroupIdValidationError");
      } catch (error) {
        expect(error).toBeInstanceOf(GroupIdValidationError);
        expect((error as GroupIdValidationError).message).toContain("RK-01");
      }

      // getPendingApprovals
      try {
        await getPendingApprovals({ group_id: invalidGroupId });
        expect.fail("Should have thrown GroupIdValidationError");
      } catch (error) {
        expect(error).toBeInstanceOf(GroupIdValidationError);
        expect((error as GroupIdValidationError).message).toContain("RK-01");
      }

      // getAllPromotionRequests
      try {
        await getAllPromotionRequests({ group_id: invalidGroupId });
        expect.fail("Should have thrown GroupIdValidationError");
      } catch (error) {
        expect(error).toBeInstanceOf(GroupIdValidationError);
        expect((error as GroupIdValidationError).message).toContain("RK-01");
      }

      // getPromotionRequestById
      try {
        await getPromotionRequestById({
          requestId: "test-id",
          group_id: invalidGroupId,
        });
        expect.fail("Should have thrown GroupIdValidationError");
      } catch (error) {
        expect(error).toBeInstanceOf(GroupIdValidationError);
        expect((error as GroupIdValidationError).message).toContain("RK-01");
      }
    });

    it("should accept valid allura-{org} group_ids", async () => {
      const validGroupIds = [
        "allura-faith-meats",
        "allura-creative",
        "allura-personal",
        "allura-nonprofit",
        "allura-audits",
        "allura-haccp",
        "allura-default",
      ];

      for (const groupId of validGroupIds) {
        // Should not throw for any valid group_id pattern
        // But we use test-specific group_ids to avoid polluting real workspaces
        const testGroupId = groupId.replace("allura-", "allura-test-enforcement-");
        
        const request = await proposeForPromotion({
          insightId: `test-insight-enforcement-${groupId}`,
          proposedBy: "agent.test",
          group_id: testGroupId,
          rationale: `Test for ${groupId}`,
        });

        expect(request.group_id).toBe(testGroupId);
      }
    });
  });
});