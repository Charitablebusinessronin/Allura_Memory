/**
 * Session Start Hook
 *
 * Legacy shim retained after local allura-memory MCP retirement.
 * Session logging and health checks now belong in the MCP_DOCKER orchestration layer.
 */

export interface SessionStartParams {
  agentId: string;
  task: string;
  group_id?: string;
}

export interface MemoryStackHealth {
  postgres: "healthy" | "degraded" | "unreachable";
  neo4j: "healthy" | "degraded" | "unreachable";
  overall: "healthy" | "degraded" | "unreachable";
}

export async function onSessionStart(params: SessionStartParams): Promise<MemoryStackHealth> {
  const { agentId, task, group_id = "allura-system" } = params;
  console.warn(
    `[Session Hook] Direct allura-memory MCP logging retired; skipped session log for ${agentId}: ${task} (${group_id}).`,
  );

  return {
    postgres: "degraded",
    neo4j: "degraded",
    overall: "degraded",
  };
}

export async function scoutPreTaskQuery(agentId: string, task: string): Promise<unknown[]> {
  console.warn(`[Scout Hook] Direct allura-memory MCP query retired; no pre-task context loaded for ${agentId}: ${task}`);
  return [];
}
