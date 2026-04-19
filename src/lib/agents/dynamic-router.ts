/**
 * Dynamic Router — Replaces the static bash `case` statement in agent-hooks.yml.
 *
 * Instead of a hardcoded shell script that maps events to agents, this module
 * uses the AGENT_MANIFEST data to dynamically determine which agent scripts
 * should run for a given GitHub webhook event.
 *
 * Usage:
 *   // In CI or programmatic context
 *   const agents = await routeEvent("pull_request", { action: "opened", number: 42 });
 *   // → [{ agentId: "pike", scriptPath: "scripts/agents/pike-interface-review.ts" }]
 *
 * @module dynamic-router
 */

import {
  AGENT_MANIFEST,
  type CiEventName,
  getAgentsForEvent,
} from "./agent-manifest";

// ── Types ────────────────────────────────────────────────────────────────

/** A resolved routing target: which agent to invoke and how. */
export interface RouteTarget {
  /** The agent's manifest ID (e.g. "carmack", "brooks"). */
  agentId: string;
  /** Path to the agent's executable script, relative to project root. */
  scriptPath: string;
  /** Human-readable description of what this agent will do. */
  description: string;
}

/** Minimal GitHub webhook payload shape for routing. */
export interface GitHubEventPayload {
  /** GitHub event action (e.g. "opened", "synchronize", "reopened"). */
  action?: string;
  /** Pull request number, if applicable. */
  number?: number;
  /** Commit SHA, if applicable. */
  sha?: string;
  /** Issue number, if applicable. */
  issue?: { number: number };
  /** Pull request details, if applicable. */
  pull_request?: { number: number };
  /** Ref name for push events. */
  ref?: string;
}

// ── Router ───────────────────────────────────────────────────────────────

/**
 * Determine which agent scripts should run for a given GitHub event.
 *
 * This replaces the static bash `case` statement in `.github/workflows/agent-hooks.yml`
 * with a data-driven lookup from AGENT_MANIFEST.
 *
 * @param eventType - GitHub webhook event type (e.g. "pull_request", "push", "issues")
 * @param payload   - The webhook payload (must include `action` for event filtering)
 * @returns Array of agents that should handle this event, with their script paths
 */
export async function routeEvent(
  eventType: string,
  payload: GitHubEventPayload
): Promise<Array<RouteTarget>> {
  const validEvents: ReadonlySet<string> = new Set(["pull_request", "push", "issues"]);

  if (!validEvents.has(eventType)) {
    return [];
  }

  const action = payload.action ?? "*";
  const matchingAgents = getAgentsForEvent(eventType as CiEventName, action);

  // Only return agents that have executable scripts
  const routes: Array<RouteTarget> = [];

  for (const agent of matchingAgents) {
    if (!agent.scriptPath) {
      continue;
    }

    routes.push({
      agentId: agent.id,
      scriptPath: agent.scriptPath,
      description: agent.description,
    });
  }

  return routes;
}

/**
 * Build the argument list for executing an agent script.
 *
 * Each agent script takes a different argument depending on the event type:
 *   - pull_request → PR number (from payload.pull_request.number or payload.number)
 *   - push         → commit SHA (from payload.sha)
 *   - issues       → issue number (from payload.issue.number or payload.number)
 *
 * @param agentId  - The agent's manifest ID
 * @param eventType - GitHub webhook event type
 * @param payload  - The webhook payload
 * @returns The argument string to pass to the agent script, or undefined if missing
 */
export function buildScriptArgument(
  agentId: string,
  eventType: string,
  payload: GitHubEventPayload
): string | undefined {
  const agent = AGENT_MANIFEST.get(agentId);
  if (!agent) {
    return undefined;
  }

  switch (eventType) {
    case "pull_request": {
      const prNumber = payload.pull_request?.number ?? payload.number;
      return prNumber !== undefined ? String(prNumber) : undefined;
    }
    case "push": {
      return payload.sha ?? "HEAD";
    }
    case "issues": {
      const issueNumber = payload.issue?.number ?? payload.number;
      return issueNumber !== undefined ? String(issueNumber) : undefined;
    }
    default:
      return undefined;
  }
}

/**
 * Format a routing decision for logging.
 *
 * @param eventType - GitHub webhook event type
 * @param routes   - Resolved route targets
 * @returns Human-readable log string
 */
export function formatRouteLog(
  eventType: string,
  routes: Array<RouteTarget>
): string {
  if (routes.length === 0) {
    return `Event "${eventType}" → no agents routed`;
  }

  const lines = routes.map(
    (r) => `  → ${r.agentId}: ${r.scriptPath} (${r.description})`
  );

  return `Event "${eventType}" → ${routes.length} agent(s):\n${lines.join("\n")}`;
}