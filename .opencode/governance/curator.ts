/**
 * Curator Governance — OpenCode Harness Integration
 *
 * This module provides the governance interface for the OpenCode harness.
 * The actual curator implementation lives in src/curator/index.ts.
 *
 * For HITL promotion:
 * - CLI: `bun run curator:run` (score and queue proposals)
 * - CLI: `bun run curator:approve` (approve pending proposals)
 * - API: POST /api/curator/approve (approve/reject a proposal)
 * - API: GET /api/curator/proposals (list pending proposals)
 *
 * For MCP_DOCKER-based operations:
 * - Use MCP_DOCKER__execute_sql to query canonical_proposals
 * - Use MCP_DOCKER__insert_data to log governance events
 * - Use MCP_DOCKER__write_neo4j_cypher for insight promotion
 *
 * See docs/allura/DESIGN-MEMORY-SYSTEM.md §Insight Curation and Approval
 */

interface PromotionProposal {
  insight: string;
  rationale: string;
  confidence: number;
  agentId: string;
  group_id?: string;
}

/**
 * Propose a promotion — delegates to the real curator pipeline.
 * Use `bun run curator:run` or POST /api/curator/proposals instead.
 */
export async function proposePromotion(params: PromotionProposal): Promise<void> {
  const { insight, confidence, agentId } = params;
  console.info(
    `[Curator] Promotion proposal from ${agentId}: "${insight.substring(0, 50)}..." (confidence: ${confidence}). Use CLI or API for actual promotion.`,
  );
}

/**
 * Approve a promotion — delegates to POST /api/curator/approve.
 * Use `bun run curator:approve` or the API endpoint instead.
 */
export async function approvePromotion(params: {
  proposalId: string;
  curatorId: string;
  group_id?: string;
}): Promise<void> {
  const { proposalId, curatorId } = params;
  console.info(`[Curator] Approval requested by ${curatorId} for ${proposalId}. Use CLI or API for actual approval.`);
}

/**
 * Reject a promotion — delegates to POST /api/curator/approve with decision=reject.
 */
export async function rejectPromotion(params: {
  proposalId: string;
  curatorId: string;
  reason: string;
  group_id?: string;
}): Promise<void> {
  const { proposalId, curatorId, reason } = params;
  console.info(`[Curator] Rejection requested by ${curatorId} for ${proposalId}: ${reason}. Use API for actual rejection.`);
}
