/**
 * Curator Governance
 *
 * Direct allura-memory MCP writes have been retired in favor of MCP_DOCKER orchestration.
 */

interface PromotionProposal {
  insight: string;
  rationale: string;
  confidence: number;
  agentId: string;
  group_id?: string;
}

export async function proposePromotion(params: PromotionProposal): Promise<void> {
  const { insight, confidence, agentId } = params;
  console.warn(
    `[Curator] Direct allura-memory MCP logging retired; skipped promotion proposal for ${agentId}: ${insight.substring(0, 50)}... (confidence: ${confidence})`,
  );
}

export async function approvePromotion(params: {
  proposalId: string;
  curatorId: string;
  group_id?: string;
}): Promise<void> {
  const { proposalId, curatorId } = params;
  console.warn(`[Curator] Direct allura-memory MCP logging retired; skipped approval log for ${curatorId}: ${proposalId}`);
}

export async function rejectPromotion(params: {
  proposalId: string;
  curatorId: string;
  reason: string;
  group_id?: string;
}): Promise<void> {
  const { proposalId, curatorId, reason } = params;
  console.warn(`[Curator] Direct allura-memory MCP logging retired; skipped rejection log for ${curatorId}: ${proposalId} (${reason})`);
}
