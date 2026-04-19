/**
 * Task Complete Hook
 *
 * Legacy shim retained after local allura-memory MCP retirement.
 * Event logging should now happen in the MCP_DOCKER orchestration layer.
 */

export interface TaskCompleteParams {
  agentId: string;
  task: string;
  result: unknown;
  group_id?: string;
  confidence?: number;
}

export async function onTaskComplete(params: TaskCompleteParams): Promise<void> {
  const { agentId, task } = params;
  console.warn(`[Task Hook] Direct allura-memory MCP logging retired; skipped task log for ${agentId}: ${task}`);
}

export async function onADRCreated(params: {
  agentId: string;
  decisionId: string;
  title: string;
  rationale: string;
  group_id?: string;
}): Promise<void> {
  const { agentId, decisionId, title } = params;
  console.warn(`[ADR Hook] Direct allura-memory MCP logging retired; skipped ADR log for ${agentId}: ${decisionId} (${title})`);
}
