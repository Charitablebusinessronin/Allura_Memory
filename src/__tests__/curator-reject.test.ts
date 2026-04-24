/**
 * Curator Reject — Unit + E2E Tests
 *
 * Unit:  pure logic tests, no DB required
 * E2E:   RUN_E2E_TESTS=true — postgres required
 *
 * Run unit only:  bun vitest run src/__tests__/curator-reject.test.ts
 * Run e2e:        RUN_E2E_TESTS=true bun vitest run src/__tests__/curator-reject.test.ts
 */

import { describe, it, expect, beforeAll, afterAll } from "vitest"
import { Pool } from "pg"
import { randomUUID } from "crypto"
import { config } from "dotenv"

config()

const shouldRunE2E = process.env.RUN_E2E_TESTS === "true"
const E2E_TIMEOUT = 30000

// ── Unit tests (no DB) ─────────────────────────────────────────────────────

describe("Curator Reject — validation logic", () => {
  it("returns 400 when proposal_id is missing", () => {
    const result = validateRejectInput({ group_id: "allura-test", curator_id: "tester" })
    expect(result.valid).toBe(false)
    expect(result.error).toContain("proposal_id")
  })

  it("returns 400 when group_id is missing", () => {
    const result = validateRejectInput({ proposal_id: "abc", curator_id: "tester" })
    expect(result.valid).toBe(false)
    expect(result.error).toContain("group_id")
  })

  it("returns 400 when curator_id is missing", () => {
    const result = validateRejectInput({ proposal_id: "abc", group_id: "allura-test" })
    expect(result.valid).toBe(false)
    expect(result.error).toContain("curator_id")
  })

  it("returns 400 when group_id does not match allura-* pattern", () => {
    const result = validateRejectInput({
      proposal_id: "abc",
      group_id: "bad-group",
      curator_id: "tester",
    })
    expect(result.valid).toBe(false)
    expect(result.error).toContain("group_id")
  })

  it("passes when all required fields are present and group_id is valid", () => {
    const result = validateRejectInput({
      proposal_id: "some-uuid",
      group_id: "allura-myproject",
      curator_id: "tester",
    })
    expect(result.valid).toBe(true)
  })
})

// ── E2E tests (postgres required) ─────────────────────────────────────────

describe.skipIf(!shouldRunE2E)("Curator Reject E2E — POST /api/curator/reject contract", () => {
  let pgPool: Pool
  const RUN_ID = randomUUID().slice(0, 8)
  const GROUP_ID = `allura-reject-e2e-${RUN_ID}`

  let pendingProposalId: string
  let alreadyRejectedId: string

  beforeAll(async () => {
    if (!process.env.POSTGRES_PASSWORD) {
      throw new Error("POSTGRES_PASSWORD is required")
    }

    const databaseUrl = process.env.DATABASE_URL || process.env.POSTGRES_URL
    pgPool = databaseUrl
      ? new Pool({ connectionString: databaseUrl })
      : new Pool({
          host: process.env.POSTGRES_HOST || "localhost",
          port: parseInt(process.env.POSTGRES_PORT || "5432", 10),
          database: process.env.POSTGRES_DB || "memory",
          user: process.env.POSTGRES_USER || "ronin4life",
          password: process.env.POSTGRES_PASSWORD,
          connectionTimeoutMillis: 10000,
          max: 10,
        })

    await pgPool.query("SELECT 1")

    pendingProposalId = randomUUID()
    alreadyRejectedId = randomUUID()

    await pgPool.query(
      `INSERT INTO canonical_proposals (id, group_id, content, score, reasoning, tier, status, created_at) VALUES
        ($1, $2, 'Proposal for reject test — maybe consider this', 0.55, 'Vague language', 'emerging', 'pending', NOW()),
        ($3, $2, 'Already rejected proposal', 0.50, 'Low signal', 'emerging', 'rejected', NOW())`,
      [pendingProposalId, GROUP_ID, alreadyRejectedId]
    )
  }, E2E_TIMEOUT)

  afterAll(async () => {
    await pgPool?.query("DELETE FROM canonical_proposals WHERE group_id = $1", [GROUP_ID])
    await pgPool?.query("DELETE FROM events WHERE group_id = $1", [GROUP_ID])
    await pgPool?.end()
  }, E2E_TIMEOUT)

  it(
    "sets status=rejected and records curator_id and decided_at",
    async () => {
      const result = await rejectProposal({
        proposal_id: pendingProposalId,
        group_id: GROUP_ID,
        curator_id: "test-curator",
        rationale: "Not specific enough",
        pool: pgPool,
      })

      expect(result.success).toBe(true)
      expect(result.status).toBe(200)

      const row = await pgPool.query(
        "SELECT status, decided_by, decided_at, rationale FROM canonical_proposals WHERE id = $1",
        [pendingProposalId]
      )
      expect(row.rows[0].status).toBe("rejected")
      expect(row.rows[0].decided_by).toBe("test-curator")
      expect(row.rows[0].decided_at).toBeDefined()
      expect(row.rows[0].rationale).toBe("Not specific enough")
    },
    E2E_TIMEOUT
  )

  it(
    "logs a proposal_rejected event",
    async () => {
      const events = await pgPool.query(
        `SELECT event_type, agent_id FROM events
         WHERE group_id = $1 AND event_type = 'proposal_rejected'
         ORDER BY created_at DESC LIMIT 1`,
        [GROUP_ID]
      )
      expect(events.rows.length).toBeGreaterThan(0)
      expect(events.rows[0].event_type).toBe("proposal_rejected")
    },
    E2E_TIMEOUT
  )

  it(
    "returns 400 when proposal is already rejected",
    async () => {
      const result = await rejectProposal({
        proposal_id: alreadyRejectedId,
        group_id: GROUP_ID,
        curator_id: "test-curator",
        pool: pgPool,
      })
      expect(result.success).toBe(false)
      expect(result.status).toBe(400)
      expect(result.message).toContain("already rejected")
    },
    E2E_TIMEOUT
  )

  it(
    "returns 404 when proposal does not exist",
    async () => {
      const result = await rejectProposal({
        proposal_id: randomUUID(),
        group_id: GROUP_ID,
        curator_id: "test-curator",
        pool: pgPool,
      })
      expect(result.success).toBe(false)
      expect(result.status).toBe(404)
    },
    E2E_TIMEOUT
  )
})

// ── Helpers ────────────────────────────────────────────────────────────────

function validateRejectInput(body: Record<string, string | undefined>): { valid: boolean; error?: string } {
  if (!body.proposal_id) return { valid: false, error: "proposal_id is required" }
  if (!body.group_id) return { valid: false, error: "group_id is required" }
  if (!body.curator_id) return { valid: false, error: "curator_id is required" }
  if (!body.group_id.startsWith("allura-")) return { valid: false, error: "Invalid group_id. Must match pattern: allura-*" }
  return { valid: true }
}

async function rejectProposal(params: {
  proposal_id: string
  group_id: string
  curator_id: string
  rationale?: string
  pool: Pool
}): Promise<{ success: boolean; status: number; message: string; decided_at?: string }> {
  const { proposal_id, group_id, curator_id, rationale, pool } = params

  const proposalResult = await pool.query(
    `SELECT id, group_id, content, score, tier, status FROM canonical_proposals
     WHERE id = $1 AND group_id = $2`,
    [proposal_id, group_id]
  )

  if (proposalResult.rows.length === 0) {
    return { success: false, status: 404, message: "Proposal not found" }
  }

  const proposal = proposalResult.rows[0]

  if (proposal.status !== "pending") {
    return { success: false, status: 400, message: `Proposal already ${proposal.status}` }
  }

  const decidedAt = new Date().toISOString()

  await pool.query(
    `UPDATE canonical_proposals
     SET status = 'rejected', decided_at = $1, decided_by = $2, rationale = $3
     WHERE id = $4`,
    [decidedAt, curator_id, rationale || null, proposal_id]
  )

  await pool.query(
    `INSERT INTO events (group_id, event_type, agent_id, status, metadata, created_at)
     VALUES ($1, $2, $3, $4, $5, $6)`,
    [
      group_id,
      "proposal_rejected",
      curator_id,
      "completed",
      JSON.stringify({ proposal_id, score: proposal.score, tier: proposal.tier, rationale }),
      decidedAt,
    ]
  )

  return { success: true, status: 200, message: "rejected", decided_at: decidedAt }
}
