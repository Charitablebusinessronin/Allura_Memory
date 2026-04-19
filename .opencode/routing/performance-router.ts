/**
 * Performance Router — Team RAM Static Routing
 *
 * Routes tasks to the correct Team RAM agent based on task type.
 * This is the static routing table; dynamic MCP_DOCKER-backed routing
 * can override when performance data is available.
 *
 * Canonical routing table source: .opencode/rules/agent-routing.md
 * Agent definitions: .opencode/agent/*.md
 *
 * Usage: Call selectAgent(taskType) to get the agent name for delegation.
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

/**
 * Select the best agent for a task type.
 * Falls back to the static Team RAM routing table.
 * For dynamic routing, use MCP_DOCKER performance data.
 */
export async function selectAgent(
  taskType: string,
  _config: RoutingConfig = DEFAULT_CONFIG,
): Promise<string> {
  return getDefaultAgent(taskType);
}

/**
 * Static Team RAM routing table.
 * Matches .opencode/rules/agent-routing.md Category Routing section.
 */
function getDefaultAgent(taskType: string): string {
  const routingTable: Record<string, string> = {
    // Tier 1: Decision-heavy roles → highest judgment
    architecture: "brooks-architect",
    planning: "brooks-architect",
    intent: "jobs-intent-gate",
    scope: "jobs-intent-gate",

    // Tier 2: Scout tiny tasks → cheapest
    discovery: "scout-recon",
    search: "scout-recon",
    recon: "scout-recon",

    // Tier 3: Code-producing tasks → coding specialist
    implementation: "woz-builder",
    codegen: "woz-builder",
    patch: "woz-builder",
    feature: "woz-builder",
    test_fix: "woz-builder",
    repo_surgery: "woz-builder",

    // Tier 4: Specialist roles
    "interface-review": "pike-interface-review",
    refactor: "fowler-refactor-gate",
    diagnostics: "bellard-diagnostics-perf",
    performance: "carmack-performance",
    optimization: "carmack-performance",
    schema: "knuth-data-architect",
    data: "knuth-data-architect",
    infra: "hightower-devops",
    deployment: "hightower-devops",

    // Validation
    validation: "pike-interface-review",
  };

  return routingTable[taskType] || "brooks-architect";
}

/**
 * Get the full static routing table.
 * Useful for displaying available agents and their task types.
 */
export function getDefaultRoutingTable(): Record<string, string> {
  return {
    // Tier 1: Decision-heavy
    architecture: "brooks-architect",
    planning: "brooks-architect",
    intent: "jobs-intent-gate",
    scope: "jobs-intent-gate",

    // Tier 2: Scout
    discovery: "scout-recon",
    search: "scout-recon",
    recon: "scout-recon",

    // Tier 3: Code-producing
    implementation: "woz-builder",
    codegen: "woz-builder",
    patch: "woz-builder",
    feature: "woz-builder",
    test_fix: "woz-builder",
    repo_surgery: "woz-builder",

    // Tier 4: Specialists
    "interface-review": "pike-interface-review",
    refactor: "fowler-refactor-gate",
    diagnostics: "bellard-diagnostics-perf",
    performance: "carmack-performance",
    optimization: "carmack-performance",
    schema: "knuth-data-architect",
    data: "knuth-data-architect",
    infra: "hightower-devops",
    deployment: "hightower-devops",

    // Validation
    validation: "pike-interface-review",
  };
}
    refactor: "fowler-refactor-gate",
    performance: "bellard-diagnostics-perf",
    validation: "opencoder",
  };
}
