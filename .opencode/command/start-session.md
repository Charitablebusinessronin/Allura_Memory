---
description: "Session initialization - prepare context, and use optional memory/infrastructure when configured"
allowed-tools: ["Bash", "mcp__MCP_DOCKER__mcp-find", "mcp__MCP_DOCKER__mcp-config-set", "mcp__MCP_DOCKER__mcp-add", "mcp__MCP_DOCKER__notion-fetch"]
---

# Session Start Protocol

Run at the start of every session. For Allura work, prefer Allura Brain context first. Local repo context is complementary, not a substitute for Brain hydration.

## Step 1: Establish Brain Context

- Confirm whether Allura Brain tools are available
- Query recent Brooks activity and blockers first when available
- If Brain is unavailable, report that explicitly before continuing

## Step 2: Establish Local Context

- Confirm the active repo and working area
- Read the task or user request carefully
- Identify whether this session needs only local repo context or also external context beyond Brain

## Step 3: Discover Optional MCP and Memory Setup

Use the available MCP discovery/config tools only to determine what is configured for this project.

- Check whether relevant MCP servers are present
- Report which optional services appear available
- If a configured service looks missing or unhealthy, warn the user before continuing
- If no memory or external service is configured, say so plainly and proceed

## Step 4: Load Local Context Files Only When They Actually Exist and Are Canonical

Use local files only as supplemental context. Do not treat stale `memory-bank/*` conventions as canonical for Allura startup.

## Step 5: Hand Off Cleanly

Summarize the starting state:

- Brain context loaded or unavailable
- local context loaded
- optional services discovered or absent
- blockers or warnings
- recommended next action

## Never Do This

- Assume local flat files are equivalent to Allura Brain
- Claim memory hydration or logging happened unless the needed tools are actually available
- Proceed past a clearly broken configured dependency without warning the user
