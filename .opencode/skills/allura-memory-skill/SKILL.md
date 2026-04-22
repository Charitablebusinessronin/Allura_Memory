---
name: allura-memory-skill
description: Use when working with persistent memory in Allura Brain, especially when storing, retrieving, curating, promoting, superseding, deprecating, exporting, or troubleshooting memory behavior via native MCP_DOCKER servers. Trigger this whenever the user asks to remember something, search prior memory, recover context, promote insights, inspect memory lineage, or debug the memory system.
allowed-tools: ["Read", "Grep", "Bash", "mcp__MCP_DOCKER__*"]
---

# Allura Memory Skill

This skill teaches an agent how to use the **Allura memory system** correctly via native MCP_DOCKER servers.

## Two-Layer Architecture

### Layer 1: Runtime Packaging (Native MCP_DOCKER Servers)

Memory operations run via dynamically discovered, configured, and activated MCP servers:
- `neo4j-memory` — approved insight recall via MCP-packaged server
- `database-server` — raw trace lookup via PostgreSQL
- `neo4j-cypher` — explicit graph inspection only when graph-specific work is needed

### Layer 2: Behavior Contract (Skill)

The skill enforces:
- **group_id required** on every operation (format: `allura-*`)
- **PostgreSQL traces append-only** — never UPDATE/DELETE on trace rows
- **Neo4j versioning via SUPERSEDES** — never edit existing nodes in place
- **MCP_DOCKER workflow** — discover → configure → activate before use

## Use This Skill When

- The user wants the system to remember important facts across sessions.
- The workflow needs semantic retrieval over prior events, decisions, outcomes, entities, or insights.
- The agent must store a new memory after completing a task.
- The agent should retrieve project or user context before acting.
- The task must distinguish raw traces from curated knowledge.
- The agent needs to promote, supersede, deprecate, revoke, restore, or export memory.
- The memory system needs setup, verification, or troubleshooting.

## Core Contract

- **Brooks / Team RAM is the orchestrator** — they delegate to specialized agents and route memory first to MCP-packaged servers.
- **Skills define behavior** — this skill teaches how to use MCP-packaged memory servers correctly.
- **MCP_DOCKER servers come first** — discovery → configuration → activation.
- **group_id is required** on every operation. In this repo, default to `allura-roninmemory`.
- PostgreSQL traces are append-only.
- Neo4j knowledge evolves via `SUPERSEDES`, never silently overwritten.

## Memory Operating Model

Treat memory as layers:

1. **Raw trace**
   - Store session events, observations, evidence, and operational breadcrumbs.
   - Append-only.
   - Never treat raw trace as final truth.

2. **Curated insight**
   - Promote only after evidence and policy checks.
   - Prefer versioning and lineage over in-place mutation.
   - Use `SUPERSEDES`, deprecation, or restoration semantics.

3. **Retrieval context**
   - Load the smallest useful context window.
   - Prefer project-local memory first, then broaden only if it helps.

## workflow

### 1. Identify intent

Decide whether the task is to:

- store a new memory
- search memory
- summarize memory state
- promote raw trace into insight
- deprecate or revoke memory
- restore deleted memory
- export memory
- troubleshoot memory behavior

### 2. Retrieve before writing

Search first.

- Avoid duplicate inserts.
- Check whether the memory already exists in similar form.
- Compare candidate facts against recent and canonical memory.

### 3. Classify the memory

Classify before you write:

- raw event
- outcome
- insight
- entity fact
- decision / ADR
- relationship between entities

### 4. Apply write discipline

- Raw traces may be appended.
- Insights should be versioned, not silently overwritten.
- If a prior truth must change, create a new version and preserve lineage.
- Do not promote unsupported claims as durable truth.

### 5. Store evidence with memory

Capture:

- source
- timestamp
- task context
- confidence
- relevant IDs or references

### 6. Use retrieval discipline

- Fetch project-local memory first when scope is narrow.
- Add global memory only when it improves reasoning.
- Return concise relevant context, not a dump.

### 7. Handle conflicts safely

- Preserve lineage when memories disagree.
- Prefer explicit status/version semantics over deletion.
- Mark disputed, superseded, deprecated, or restored states clearly.

### 8. Troubleshoot systematically

- Check MCP server availability via `mcp__MCP_DOCKER__listTools`.
- Verify environment variables against `NEO4J_*` and `POSTGRES_*` config.
- Use `MCP_DOCKER_mcp-find` to discover servers before activation.
- Run `MCP_DOCKER_mcp-config-set` with env-based configuration.
- Activate servers with `MCP_DOCKER_mcp-add`.
- Diagnose via native `mcp__MCP_DOCKER__*` tools only.

## Tool Selection

### MCP_DOCKER Server Activation Sequence

Use this exact sequence:

1. **Discovery**
   ```bash
   MCP_DOCKER_mcp-find("neo4j-memory")
   MCP_DOCKER_mcp-find("database-server")
   MCP_DOCKER_mcp-find("neo4j-cypher")
   ```
2. **Configuration** — map env vars to config fields:
   - `NEO4J_URL` → `url`
   - `NEO4J_USERNAME` or `NEO4J_USER` → `username`
   - `NEO4J_PASSWORD` → `password`
   - `NEO4J_DATABASE` → `database` (value should be `neo4j` or explicit db name)
   - `POSTGRES_HOST` → `host`
   - `POSTGRES_PORT` → `port`
   - `POSTGRES_DB` → `database`
   - `POSTGRES_USER` → `username`
   - `POSTGRES_PASSWORD` → `password`
3. **Activation**
   ```bash
   MCP_DOCKER_mcp-add("neo4j-memory")
   MCP_DOCKER_mcp-add("database-server")
   MCP_DOCKER_mcp-add("neo4j-cypher")  # only if needed
   ```

### Canonical Server Order for This Repo

1. First: `neo4j-memory` — approved insight recall via MCP
2. Second: `database-server` — raw evidence via PostgreSQL
3. Last resort: `neo4j-cypher` — explicit graph inspection

Use `MCP_DOCKER_mcp-find` discovery before assuming servers are activated.

## Guardrails

- Do not confuse raw logs with validated knowledge.
- Do not mutate canonical insights in place.
- Do not promote memories without evidence or policy support.
- Do not create duplicate insight nodes when a superseding relationship is more appropriate.
- Do not return stale memory without checking timestamps, status, and lineage.
- Do not start with explicit Cypher when `neo4j-memory` can answer via MCP-packaged server.
- Do not use docs, comments, or local notes as memory authority when the memory system is available.
- Do not assume local memory servers exist — discover and configure via `MCP_DOCKER` first.

## Recommended References

- `/docs/allura/BLUEPRINT.md` — canonical Allura memory specification
- `/docs/allura/SOLUTION-ARCHITECTURE.md` — memory topology and integration points
- `/docs/allura/DATA-DICTIONARY.md` — canonical field and enum definitions
- `/docs/archive/allura/memory-system-tools.md` — tool integration details

## Suggested Scripts

- `/scripts/validation/memory-stack-ready.sh` — stack health check
- `/scripts/validation/memory-telemetry.sh` — telemetry verification

Use those scripts when the task is operational, repetitive, or needs deterministic verification.
