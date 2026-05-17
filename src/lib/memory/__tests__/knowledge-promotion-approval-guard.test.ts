/**
 * Knowledge promotion approval guard tests.
 *
 * These tests prove that Neo4j promotion cannot proceed unless a matching
 * PostgreSQL approval audit event exists first.
 */

import { beforeEach, describe, expect, it, vi } from "vitest"

vi.mock("../approval-audit", () => ({
  requireApprovalBeforePromotion: vi.fn(async () => true),
}))

vi.mock("../../neo4j/queries/insert-insight", () => ({
  createInsight: vi.fn(async () => ({
    id: "neo4j-insight-001",
    insight_id: "prop-001",
    version: 1,
    status: "active",
  })),
  createInsightVersion: vi.fn(async () => ({
    id: "neo4j-insight-version-001",
    insight_id: "prop-001",
    version: 2,
    status: "active",
  })),
}))

import { requireApprovalBeforePromotion } from "../approval-audit"
import { createInsight } from "../../neo4j/queries/insert-insight"
import { promoteToNeo4j, type KnowledgeInsight } from "../knowledge-promotion"

const mockRequireApprovalBeforePromotion =
  requireApprovalBeforePromotion as unknown as ReturnType<typeof vi.fn>
const mockCreateInsight = createInsight as unknown as ReturnType<typeof vi.fn>

const APPROVED_INSIGHT: KnowledgeInsight = {
  id: "trace-001",
  proposal_id: "prop-001",
  topic: "Approval Guard",
  category: "Decision",
  content: "Neo4j promotions require a prior approval audit event.",
  source: "brooks-architect",
  confidence: 0.92,
  group_id: "allura-system",
  notion_page_id: "notion-page-001",
  postgres_trace_id: "trace-001",
}

describe("promoteToNeo4j approval guard", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockRequireApprovalBeforePromotion.mockResolvedValue(true)
    mockCreateInsight.mockResolvedValue({
      id: "neo4j-insight-001",
      insight_id: "prop-001",
      version: 1,
      status: "active",
    })
  })

  it("requires approval before creating a Neo4j insight", async () => {
    await promoteToNeo4j(APPROVED_INSIGHT)

    expect(mockRequireApprovalBeforePromotion).toHaveBeenCalledWith(
      "prop-001",
      "allura-system"
    )
    expect(mockRequireApprovalBeforePromotion.mock.invocationCallOrder[0]).toBeLessThan(
      mockCreateInsight.mock.invocationCallOrder[0]
    )
  })

  it("does not create a Neo4j insight when approval is missing", async () => {
    mockRequireApprovalBeforePromotion.mockRejectedValueOnce(
      new Error("Approval required before promotion")
    )

    await expect(promoteToNeo4j(APPROVED_INSIGHT)).rejects.toThrow(
      "Approval required before promotion"
    )

    expect(mockCreateInsight).not.toHaveBeenCalled()
  })

  it("requires an explicit proposal_id instead of falling back to insight id", async () => {
    const missingProposalId = {
      ...APPROVED_INSIGHT,
      proposal_id: undefined,
    } as unknown as KnowledgeInsight

    await expect(promoteToNeo4j(missingProposalId)).rejects.toThrow(
      "Proposal ID is required for promotion approval"
    )

    expect(mockRequireApprovalBeforePromotion).not.toHaveBeenCalled()
    expect(mockCreateInsight).not.toHaveBeenCalled()
  })
})
