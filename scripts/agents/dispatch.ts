#!/usr/bin/env bun
/**
 * Agent Dispatch — Manifest-driven routing for GitHub webhook events.
 *
 * Replaces the static bash `case` statement in agent-hooks.yml.
 * Reads from AGENT_MANIFEST (src/lib/agents/agent-manifest.ts) to determine
 * which agent scripts to run for a given event.
 *
 * Usage: bun scripts/agents/dispatch.ts
 *
 * Environment variables (set by agent-hooks.yml):
 *   GITHUB_EVENT_NAME  - "pull_request", "push", or "issues"
 *   GITHUB_EVENT_ACTION - "opened", "synchronize", etc.
 *   GITHUB_PR_NUMBER   - Pull request number (for pull_request events)
 *   GITHUB_SHA         - Commit SHA (for push events)
 *   GITHUB_ISSUE_NUMBER - Issue number (for issues events)
 *
 * Agent: dispatch
 * Manifest ID: dispatch (utility, not in manifest)
 * See: src/lib/agents/agent-manifest.ts
 */

import { routeEvent, buildScriptArgument, formatRouteLog } from "../../src/lib/agents/dynamic-router";

const eventType = process.env.GITHUB_EVENT_NAME ?? "";
const eventAction = process.env.GITHUB_EVENT_ACTION ?? "";
const prNumber = process.env.GITHUB_PR_NUMBER;
const commitSha = process.env.GITHUB_SHA ?? "HEAD";
const issueNumber = process.env.GITHUB_ISSUE_NUMBER;

async function dispatch() {
  if (!eventType) {
    console.error("[dispatch] No GITHUB_EVENT_NAME set — nothing to route");
    process.exit(0);
  }

  const payload = {
    action: eventAction || undefined,
    number: prNumber ? parseInt(prNumber, 10) : undefined,
    sha: commitSha !== "HEAD" ? commitSha : undefined,
    pull_request: prNumber ? { number: parseInt(prNumber, 10) } : undefined,
    issue: issueNumber ? { number: parseInt(issueNumber, 10) } : undefined,
  };

  console.log(`[dispatch] Routing event: ${eventType} (${eventAction || "*"})`);

  const routes = await routeEvent(eventType, payload);
  const logMsg = formatRouteLog(eventType, routes);
  console.log(logMsg);

  if (routes.length === 0) {
    console.log("[dispatch] No agents matched — event skipped");
    process.exit(0);
  }

  for (const route of routes) {
    const arg = buildScriptArgument(route.agentId, eventType, payload);
    console.log(`[dispatch] → Running ${route.agentId}: bun ${route.scriptPath}${arg ? ` ${arg}` : ""}`);

    try {
      const proc = Bun.spawnSync([
        "bun",
        route.scriptPath,
        ...(arg ? [arg] : []),
      ], {
        stdout: "inherit",
        stderr: "inherit",
      });

      const exitCode = proc.exitCode ?? 1;
      if (exitCode !== 0) {
        console.error(`[dispatch] Agent ${route.agentId} exited with code ${exitCode}`);
        // Continue to other agents even if one fails
      }
    } catch (error) {
      console.error(`[dispatch] Failed to run ${route.agentId}:`, error);
      // Continue to other agents
    }
  }

  console.log("[dispatch] All agents dispatched");
}

dispatch();