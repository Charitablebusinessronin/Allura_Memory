---
name: mcp-docker-memory-system
description: Use MCP_DOCKER to discover, configure, and operate memory-system tooling across Neo4j, PostgreSQL, and Notion-backed workflows. This skill should be used when an agent needs to bootstrap or execute memory operations through dynamically added MCP servers.
---

# MCP Docker Memory System

## Purpose

Use this skill to run memory workflows through MCP_DOCKER without hardcoding one fixed server setup.
Apply it to discover servers, configure credentials safely, connect tools, and execute memory queries/actions with tenant-safe defaults.

For this repo, prefer the first-party `allura-brain_*` tools when they are already available. Use MCP_DOCKER to add missing infrastructure capabilities or governed database access.

## When to Use

- Add memory capabilities to a session that does not yet have the needed MCP servers.
- Connect to Neo4j/PostgreSQL backing stores for memory retrieval, lineage checks, and event validation.
- Run memory-oriented diagnostics or read/write flows through MCP tools.
- Standardize memory operations around `group_id` and safe execution order.

## Required Safety Defaults

- Set and pass `group_id` for every memory operation unless the task is explicitly global.
- In this repository, the default tenant is `allura-roninmemory`.
- Prefer read operations first (`search`, `list`, schema checks) before any write operation.
- Keep credentials in config/env, not in markdown examples committed to source.
- Verify server identity and tool availability before execution.
- PostgreSQL events are append-only; Neo4j knowledge evolves via `SUPERSEDES`, never in-place mutation.

## Core Workflow

### 1) Discover candidate MCP servers

Run one or more catalog searches:

```text
MCP_DOCKER_mcp-find {"query":"memory neo4j postgres notion", "limit": 10}
MCP_DOCKER_mcp-find {"query":"neo4j cypher", "limit": 5}
MCP_DOCKER_mcp-find {"query":"postgres sql", "limit": 5}
```

### 2) Configure selected servers

Configure each server with least-privilege values:

```text
MCP_DOCKER_mcp-config-set {"server":"neo4j"}
MCP_DOCKER_mcp-config-set {"server":"postgres"}
```

Use environment-backed values for credentials, then validate with lightweight read calls.

### 3) Add and activate servers

```text
MCP_DOCKER_mcp-add {"name":"neo4j", "activate": true}
MCP_DOCKER_mcp-add {"name":"postgres", "activate": true}
```

### 4) Execute memory operations

Use server-native read tools for initial checks, then memory-specific tools as needed:

```text
allura-brain_memory_search {"query":"recent blockers", "group_id":"allura-roninmemory"}
MCP_DOCKER_read_neo4j_cypher {"query":"MATCH (n) RETURN count(n) AS node_count"}
MCP_DOCKER_execute_sql {"sql_query":"SELECT COUNT(*) FROM events WHERE group_id = 'allura-roninmemory'"}
```

### 5) Verify and document

- Confirm expected entities/rows were affected.
- Record operation context (group scope, tool, query purpose) in task notes.
- Remove unneeded servers if session context is crowded.

## Recommended Execution Order for Memory Tasks

1. Discover server (`mcp-find`)
2. Configure (`mcp-config-set`)
3. Add (`mcp-add`)
4. Inspect schema/health (read-only)
5. Run memory query/workflow
6. Verify outputs and scope (`group_id`)

## Common Playbooks

### Playbook A: Find historical insights for one tenant

1. Use `allura-brain_memory_search` first if available.
2. If deeper graph inspection is required, add Neo4j server via MCP_DOCKER workflow.
3. Run read query for insight/version nodes filtered by `group_id`.
4. Check version lineage (`SUPERSEDES`) before reporting latest state.

### Playbook B: Audit raw trace events in PostgreSQL

1. Use `allura-brain_memory_search` or `memory_list` first for a quick read.
2. Add PostgreSQL server when you need raw SQL or schema inspection.
3. List tables and describe event schema.
4. Query by `group_id` and time window.
5. Correlate with graph-side insight IDs.

### Playbook C: Hybrid memory triage

1. Read traces from PostgreSQL for incident window.
2. Read derived knowledge from Neo4j for same `group_id`.
3. Identify mismatch between raw evidence and promoted insight state.
4. If a reusable pattern emerges, log it through `allura-brain_memory_add` and request promotion separately.

## Troubleshooting

- No search results: broaden `mcp-find` query and raise `limit`.
- Config validation errors: inspect server schema and retry with required keys only.
- Tool missing after add: re-add with `activate: true` or check server name mismatch.
- Empty memory results: verify `group_id`, date window, and environment connectivity.

## References

- Load detailed mappings from `@references/memory-system-tool-map.md`.
