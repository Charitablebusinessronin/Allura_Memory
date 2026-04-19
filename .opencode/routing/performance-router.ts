/**
 * Performance Router
 *
 * Direct `mcp:allura-memory` routing has been retired.
 * Routing now falls back to the static Team RAM table unless
 * a higher-level orchestrator supplies MCP_DOCKER-backed data.
 */

interface RoutingConfig {
  epsilon: number;
  minTaskCount: number;
  explorationDecay: number;
}

const DEFAULT_CONFIG: RoutingConfig = {
  epsilon: 0.1,
  minTaskCount: 20,
  explorationDecay: 0.5,
};

export async function selectAgent(
  taskType: string,
  _config: RoutingConfig = DEFAULT_CONFIG,
): Promise<string> {
  console.warn("[Router] Direct allura-memory MCP routing retired; using static routing table.");
  return getDefaultAgent(taskType);
}

function getDefaultAgent(taskType: string): string {
  const routingTable: Record<string, string> = {
    discovery: "scout-recon",
    intent: "jobs-intent-gate",
    architecture: "brooks-architect",
    implementation: "woz-builder",
    "interface-review": "pike-interface-review",
    refactor: "fowler-refactor-gate",
    performance: "bellard-diagnostics-perf",
    validation: "opencoder",
  };

  return routingTable[taskType] || "openagent";
}

export function getDefaultRoutingTable(): Record<string, string> {
  return {
    discovery: "scout-recon",
    intent: "jobs-intent-gate",
    architecture: "brooks-architect",
    implementation: "woz-builder",
    "interface-review": "pike-interface-review",
    refactor: "fowler-refactor-gate",
    performance: "bellard-diagnostics-perf",
    validation: "opencoder",
  };
}
