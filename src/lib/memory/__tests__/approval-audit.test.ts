/**
 * Approval Audit Logger — Unit Tests
 *
 * Tests the approval audit module that ensures NO Insight enters Neo4j
 * without an approval event logged to PostgreSQL.
 *
 * All database connections are mocked — no live DB required.
 *
 * Invariants verified:
 * - logApprovalEvent inserts correct event_type and metadata
 * - logApprovalEvent is idempotent (calling twice doesn't duplicate)
 * - requireApprovalBeforePromotion returns true when approval exists
 * - requireApprovalBeforePromotion throws when no approval exists
 * - group_id is always included in queries
 * - Parameterized queries used (no string interpolation)
 *
 * Reference: docs/allura/BLUEPRINT.md (F-003: Approval Audit Flow)
 */

import { describe, it, expect, vi, beforeEach } from "vitest"
import {
  logApprovalEvent,
  requireApprovalBeforePromotion,
  hasApprovalEvent,
  ApprovalRequiredError,
  type ApprovalAuditEvent,
} from "@/lib/memory/approval-audit"

// ── Mock Setup ────────────────────────────────────────────────────────────

// Mock the postgres connection module so we never hit a real DB
vi.mock("@/lib/postgres/connection", () => ({
  getPool: vi.fn(),
}))

// Mock the validation module — let valid group_ids pass through
vi.mock("@/lib/validation/group-id", () => ({
  validateGroupId: vi.fn((id: string) => {
    if (!id.startsWith("allura-")) {
      const err = new Error(`Invalid group_id: ${id}. Must match pattern: ^allura-[a-z0-9-]+$`)
      err.name = "GroupIdValidationError"
      throw err
    }
    return id
  }),
  GroupIdValidationError: class GroupIdValidationError extends Error {
    constructor(message: string) {
      super(message)
      this.name = "GroupIdValidationError"
    }
  },
}))

import { getPool } from "@/lib/postgres/connection"

// ── Test Fixtures ─────────────────────────────────────────────────────────

const VALID_GROUP_ID = "allura-test-tenant"
const VALID_APPROVAL_EVENT: ApprovalAuditEvent = {
  proposal_id: "prop-001",
  group_id: VALID_GROUP_ID,
  memory_id: "mem-001",
  curator_id: "curator-alice",
  decision: "approved",
  rationale: "High-confidence insight, meets promotion criteria",
  score: 0.92,
  tier: "mainstream",
  approved_at: "2026-04-19T12:00:00.000Z",
}

const VALID_REJECTION_EVENT: ApprovalAuditEvent = {
  ...VALID_APPROVAL_EVENT,
  proposal_id: "prop-002",
  decision: "rejected",
  rationale: "Insufficient specificity for knowledge graph",
  score: 0.45,
  tier: "emerging",
}

/**
 * Create a mock Pool with configurable query behavior.
 * Captures all query calls for assertion.
 */
function createMockPool(existingRows: Record<string, unknown[]> = {}) {
  const queryCalls: Array<{ text: string; params: unknown[] }> = []

  const mockQuery = vi.fn(async (text: string, params?: unknown[]) => {
    queryCalls.push({ text, params: params ?? [] })

    // Determine which query this is based on the SQL text
    if (text.includes("SELECT id") && text.includes("event_type")) {
      // Idempotency check query
      const eventType = params?.[1] as string
      const proposalId = params?.[2] as string
      const key = `${eventType}:${proposalId}`
      const rows = existingRows[key] ?? []
      return { rows, rowCount: rows.length }
    }

    if (text.includes("INSERT INTO events")) {
      return { rows: [{ id: 999 }], rowCount: 1 }
    }

    return { rows: [], rowCount: 0 }
  })

  const pool = { query: mockQuery } as unknown as import("pg").Pool

  return { pool, queryCalls, mockQuery }
}

// ── Tests ─────────────────────────────────────────────────────────────────

describe("Approval Audit Logger", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  // ── logApprovalEvent ──────────────────────────────────────────────────

  describe("logApprovalEvent", () => {
    it("should insert correct event_type and metadata for approval", async () => {
      const { pool, queryCalls } = createMockPool()
      vi.mocked(getPool).mockReturnValue(pool)

      await logApprovalEvent(VALID_APPROVAL_EVENT, pool)

      // Should have 2 queries: idempotency check + insert
      expect(queryCalls).toHaveLength(2)

      // First query: idempotency check
      const checkQuery = queryCalls[0]
      expect(checkQuery.text).toContain("SELECT id")
      expect(checkQuery.text).toContain("event_type = $2")
      expect(checkQuery.text).toContain("metadata->>'proposal_id' = $3")
      expect(checkQuery.params[0]).toBe(VALID_GROUP_ID) // group_id always first
      expect(checkQuery.params[1]).toBe("memory_promotion_approved")
      expect(checkQuery.params[2]).toBe("prop-001")

      // Second query: INSERT
      const insertQuery = queryCalls[1]
      expect(insertQuery.text).toContain("INSERT INTO events")
      expect(insertQuery.text).toContain("VALUES ($1, $2, $3, $4, $5, $6)")
      expect(insertQuery.params[0]).toBe(VALID_GROUP_ID) // group_id always first
      expect(insertQuery.params[1]).toBe("memory_promotion_approved")
      expect(insertQuery.params[2]).toBe("curator-alice") // agent_id = curator_id

      // Verify metadata JSON contains all required fields
      const metadata = JSON.parse(insertQuery.params[4] as string)
      expect(metadata.proposal_id).toBe("prop-001")
      expect(metadata.memory_id).toBe("mem-001")
      expect(metadata.curator_id).toBe("curator-alice")
      expect(metadata.decision).toBe("approved")
      expect(metadata.rationale).toBe("High-confidence insight, meets promotion criteria")
      expect(metadata.score).toBe(0.92)
      expect(metadata.tier).toBe("mainstream")
      expect(metadata.approved_at).toBe("2026-04-19T12:00:00.000Z")
    })

    it("should insert memory_promotion_rejected event_type for rejection", async () => {
      const { pool, queryCalls } = createMockPool()
      vi.mocked(getPool).mockReturnValue(pool)

      await logApprovalEvent(VALID_REJECTION_EVENT, pool)

      // Idempotency check should use rejected event type
      const checkQuery = queryCalls[0]
      expect(checkQuery.params[1]).toBe("memory_promotion_rejected")

      // Insert should use rejected event type
      const insertQuery = queryCalls[1]
      expect(insertQuery.params[1]).toBe("memory_promotion_rejected")

      const metadata = JSON.parse(insertQuery.params[4] as string)
      expect(metadata.decision).toBe("rejected")
      expect(metadata.score).toBe(0.45)
      expect(metadata.tier).toBe("emerging")
    })

    it("should be idempotent — calling twice does not duplicate the event", async () => {
      // Simulate that the event already exists (idempotency check returns a row)
      const { pool, queryCalls, mockQuery } = createMockPool({
        "memory_promotion_approved:prop-001": [{ id: 42 }],
      })
      vi.mocked(getPool).mockReturnValue(pool)

      await logApprovalEvent(VALID_APPROVAL_EVENT, pool)

      // Only 1 query: the idempotency check (no INSERT)
      expect(queryCalls).toHaveLength(1)
      expect(queryCalls[0].text).toContain("SELECT id")
      expect(mockQuery).toHaveBeenCalledTimes(1)
    })

    it("should always include group_id in queries", async () => {
      const { pool, queryCalls } = createMockPool()
      vi.mocked(getPool).mockReturnValue(pool)

      await logApprovalEvent(VALID_APPROVAL_EVENT, pool)

      for (const call of queryCalls) {
        // group_id is always the first parameter ($1)
        expect(call.params[0]).toBe(VALID_GROUP_ID)
        // The query text should reference $1 for group_id
        expect(call.text).toContain("$1")
      }
    })

    it("should use parameterized queries — no string interpolation", async () => {
      const { pool, queryCalls } = createMockPool()
      vi.mocked(getPool).mockReturnValue(pool)

      await logApprovalEvent(VALID_APPROVAL_EVENT, pool)

      for (const call of queryCalls) {
        // No single quotes around $N placeholders (would indicate string interpolation)
        // The SQL should use $1, $2, etc. — not string literals
        expect(call.text).not.toMatch(/'\$[0-9]+'/)
        // Should contain parameterized placeholders
        expect(call.text).toMatch(/\$[0-9]+/)
      }
    })

    it("should throw GroupIdValidationError for invalid group_id", async () => {
      const { pool } = createMockPool()
      vi.mocked(getPool).mockReturnValue(pool)

      const invalidEvent: ApprovalAuditEvent = {
        ...VALID_APPROVAL_EVENT,
        group_id: "invalid-group",
      }

      await expect(logApprovalEvent(invalidEvent, pool)).rejects.toThrow(
        "Invalid group_id"
      )
    })

    it("should handle missing optional rationale field", async () => {
      const { pool, queryCalls } = createMockPool()
      vi.mocked(getPool).mockReturnValue(pool)

      const eventNoRationale: ApprovalAuditEvent = {
        ...VALID_APPROVAL_EVENT,
        rationale: undefined,
      }

      await logApprovalEvent(eventNoRationale, pool)

      const insertQuery = queryCalls[1]
      const metadata = JSON.parse(insertQuery.params[4] as string)
      expect(metadata.rationale).toBeNull()
    })
  })

  // ── requireApprovalBeforePromotion ────────────────────────────────────

  describe("requireApprovalBeforePromotion", () => {
    it("should return true when approval event exists", async () => {
      const { pool } = createMockPool({
        "memory_promotion_approved:prop-001": [{ id: 42 }],
      })
      vi.mocked(getPool).mockReturnValue(pool)

      const result = await requireApprovalBeforePromotion(
        "prop-001",
        VALID_GROUP_ID,
        pool
      )

      expect(result).toBe(true)
    })

    it("should throw ApprovalRequiredError when no approval exists", async () => {
      const { pool } = createMockPool() // No existing rows
      vi.mocked(getPool).mockReturnValue(pool)

      await expect(
        requireApprovalBeforePromotion("prop-999", VALID_GROUP_ID, pool)
      ).rejects.toThrow(ApprovalRequiredError)

      try {
        await requireApprovalBeforePromotion("prop-999", VALID_GROUP_ID, pool)
      } catch (error) {
        expect(error).toBeInstanceOf(ApprovalRequiredError)
        const err = error as ApprovalRequiredError
        expect(err.proposalId).toBe("prop-999")
        expect(err.groupId).toBe(VALID_GROUP_ID)
      }
    })

    it("should throw ApprovalRequiredError with correct proposal and group info", async () => {
      const { pool } = createMockPool()
      vi.mocked(getPool).mockReturnValue(pool)

      try {
        await requireApprovalBeforePromotion("prop-missing", "allura-acme", pool)
        expect.unreachable("Should have thrown")
      } catch (error) {
        expect(error).toBeInstanceOf(ApprovalRequiredError)
        expect((error as ApprovalRequiredError).proposalId).toBe("prop-missing")
        expect((error as ApprovalRequiredError).groupId).toBe("allura-acme")
      }
    })

    it("should always include group_id in the query", async () => {
      const { pool, queryCalls } = createMockPool({
        "memory_promotion_approved:prop-001": [{ id: 42 }],
      })
      vi.mocked(getPool).mockReturnValue(pool)

      await requireApprovalBeforePromotion("prop-001", VALID_GROUP_ID, pool)

      expect(queryCalls).toHaveLength(1)
      expect(queryCalls[0].params[0]).toBe(VALID_GROUP_ID)
      expect(queryCalls[0].text).toContain("group_id = $1")
    })

    it("should throw GroupIdValidationError for invalid group_id", async () => {
      const { pool } = createMockPool()
      vi.mocked(getPool).mockReturnValue(pool)

      await expect(
        requireApprovalBeforePromotion("prop-001", "bad-group", pool)
      ).rejects.toThrow("Invalid group_id")
    })

    it("should not match rejection events as approvals", async () => {
      // Only a rejection event exists — should still throw
      const { pool } = createMockPool({
        "memory_promotion_rejected:prop-001": [{ id: 43 }],
      })
      vi.mocked(getPool).mockReturnValue(pool)

      await expect(
        requireApprovalBeforePromotion("prop-001", VALID_GROUP_ID, pool)
      ).rejects.toThrow(ApprovalRequiredError)
    })
  })

  // ── hasApprovalEvent ──────────────────────────────────────────────────

  describe("hasApprovalEvent", () => {
    it("should return true when approval exists", async () => {
      const { pool } = createMockPool({
        "memory_promotion_approved:prop-001": [{ id: 42 }],
      })
      vi.mocked(getPool).mockReturnValue(pool)

      const result = await hasApprovalEvent("prop-001", VALID_GROUP_ID, pool)
      expect(result).toBe(true)
    })

    it("should return false when no approval exists", async () => {
      const { pool } = createMockPool()
      vi.mocked(getPool).mockReturnValue(pool)

      const result = await hasApprovalEvent("prop-999", VALID_GROUP_ID, pool)
      expect(result).toBe(false)
    })

    it("should re-throw non-ApprovalRequiredError exceptions", async () => {
      const { pool, mockQuery } = createMockPool()
      vi.mocked(getPool).mockReturnValue(pool)

      // Simulate a database error
      mockQuery.mockRejectedValueOnce(new Error("Connection refused"))

      await expect(
        hasApprovalEvent("prop-001", VALID_GROUP_ID, pool)
      ).rejects.toThrow("Connection refused")
    })
  })
})