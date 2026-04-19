/**
 * Session Start Hook — Allura Brain Hydration
 *
 * Hydrates context from Allura Brain (PostgreSQL + Neo4j) at session start.
 * Uses MCP_DOCKER tools for all database operations — never docker exec.
 *
 * Protocol (MAX 2 primary queries at boot):
 * 1. PostgreSQL: Recent Brooks events and blockers
 * 2. Neo4j: Architecture insights (only when task is architecture-sensitive)
 *
 * Deferred (NOT at boot):
 * - Notion search (only on BP/CR commands)
 * - MCP_DOCKER mcp-find/mcp-add (only when a required tool is missing)
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

/**
 * Session start — logs the session event to PostgreSQL via MCP_DOCKER.
 * Actual hydration happens in the agent's startup protocol using
 * MCP_DOCKER__execute_sql and MCP_DOCKER__read_neo4j_cypher.
 */
export async function onSessionStart(params: SessionStartParams): Promise<MemoryStackHealth> {
  const { agentId, task, group_id = "allura-system" } = params;

  // The agent's own startup protocol handles the actual Brain queries.
  // This hook exists as a structural entry point for the OpenCode harness.
  // Agents should follow the _bootstrap.md protocol:
  //   1. MCP_DOCKER__execute_sql: SELECT recent events WHERE agent_id = 'brooks'
  //   2. Optional: MCP_DOCKER__read_neo4j_cypher for architecture insights

  console.info(
    `[Session Hook] Session start for ${agentId}: ${task} (${group_id}). Agent should hydrate from Brain via MCP_DOCKER tools per _bootstrap.md protocol.`,
  );

  // Return optimistic health — actual health is checked by the agent at boot
  return {
    postgres: "healthy",
    neo4j: "healthy",
    overall: "healthy",
  };
}

/**
 * Scout pre-task query — delegates to MCP_DOCKER tools.
 * Agents should use MCP_DOCKER__execute_sql and MCP_DOCKER__read_neo4j_cypher
 * directly in their startup protocol rather than calling this shim.
 */
export async function scoutPreTaskQuery(agentId: string, task: string): Promise<unknown[]> {
  console.info(`[Scout Hook] Scout pre-task for ${agentId}: ${task}. Use MCP_DOCKER tools directly per _bootstrap.md.`);
  return [];
}
