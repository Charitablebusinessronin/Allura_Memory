/**
 * Task Complete Hook — Allura Brain Write-Back
 *
 * Logs task completion events to PostgreSQL via MCP_DOCKER tools.
 * Agents should use MCP_DOCKER__insert_data for event logging and
 * MCP_DOCKER__write_neo4j_cypher for architectural decisions.
 *
 * Neo4j promotion criteria (ALL three must be true):
 * 1. Decision is reusable across ≥2 projects
 * 2. Decision was validated — not just proposed
 * 3. No duplicate exists in Neo4j
 */

export interface TaskCompleteParams {
  agentId: string;
  task: string;
  result: unknown;
  group_id?: string;
  confidence?: number;
}

/**
 * Task complete — structural entry point for the OpenCode harness.
 * Agents should log their own events via MCP_DOCKER__insert_data
 * following the write-back contracts in _bootstrap.md.
 */
export async function onTaskComplete(params: TaskCompleteParams): Promise<void> {
  const { agentId, task, confidence } = params;
  console.info(
    `[Task Hook] Task complete for ${agentId}: ${task} (confidence: ${confidence ?? "N/A"}). Agent should log via MCP_DOCKER__insert_data per write-back contracts.`,
  );
}

/**
 * ADR creation — structural entry point for the OpenCode harness.
 * Agents should log ADRs via MCP_DOCKER__insert_data (PostgreSQL event)
 * and MCP_DOCKER__write_neo4j_cypher (Decision node) per _bootstrap.md.
 */
export async function onADRCreated(params: {
  agentId: string;
  decisionId: string;
  title: string;
  rationale: string;
  group_id?: string;
}): Promise<void> {
  const { agentId, decisionId, title } = params;
  console.info(
    `[ADR Hook] ADR created by ${agentId}: ${decisionId} (${title}). Agent should log via MCP_DOCKER tools per write-back contracts.`,
  );
}
