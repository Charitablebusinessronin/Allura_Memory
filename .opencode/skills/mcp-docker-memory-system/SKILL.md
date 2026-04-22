---
name: mcp-docker-memory-system
description: Use MCP_DOCKER to discover, configure, and operate memory-system tools via ranked MCP-packaged servers (neo4j-memory first, database-server second, neo4j-cypher only if needed). This skill should be used when an agent needs to bootstrap or execute memory operations through dynamically added MCP servers.
---

# MCP Docker Memory System

## Purpose

Use this skill to run memory workflows through MCP_DOCKER without hardcoding one fixed server setup.
Apply it to discover packaged memory servers, configure credentials safely via environment variables, connect tools, and execute memory queries/actions with tenant-safe defaults.

For this repo, prefer the packaged memory server set in this order:
1. `neo4j-memory`
2. `database-server`
3. `neo4j-cypher` only if needed

## When to Use

- Add memory capabilities to a session that does not yet have the needed MCP servers.
- Connect to Neo4j/PostgreSQL backing stores for memory retrieval, lineage checks, and event validation.
- Run memory-oriented diagnostics or focused read/write flows through packaged MCP tools.
- Standardize memory operations around `group_id` and safe execution order.

## Required Safety Defaults

- Set and pass `group_id` for every memory operation unless the task is explicitly global.
- In this repository, the default tenant is `allura-roninmemory`.
- Prefer memory recall first, then evidence, then Cypher fallback.
- Prefer read operations first (`search`, `list`, schema checks) before any write operation.
- Keep credentials in env vars (not in code or markdown examples committed to source).
- Verify server identity and tool availability before execution.
- PostgreSQL events are append-only; Neo4j knowledge evolves via `SUPERSEDES`, never in-place mutation.

## Core Workflow

### 1) Discover candidate MCP servers

Run one or more catalog searches:

```text
MCP_DOCKER_mcp-find {"query":"neo4j memory", "limit": 5}
MCP_DOCKER_mcp-find {"query":"database postgres sql", "limit": 5}
MCP_DOCKER_mcp-find {"query":"neo4j cypher", "limit": 5}
```

### 2) Configure selected servers using environment variables

Configure each server with environment-backed values (no hardcoded secrets):

**Environment Variable Mappings:**

| Server | Environment Variable | Purpose |
|--------|---------------------|---------|
| `neo4j-memory` | `NEO4J_MEMORY_URL` | Connection URL (e.g., `bolt://host.docker.internal:7687`) |
| `neo4j-memory` | `NEO4J_MEMORY_USERNAME` | Neo4j username |
| `neo4j-memory` | `NEO4J_MEMORY_PASSWORD` | Neo4j password |
| `database-server` | `DATABASE_SERVER_DATABASE_URL` | PostgreSQL connection URL (format: `postgresql://user:pass@host.docker.internal:5432/db`) |
| `neo4j-cypher` | `NEO4J_CYPER_URL` | Connection URL (e.g., `bolt://host.docker.internal:7687`) |
| `neo4j-cypher` | `NEO4J_CYPER_USERNAME` | Neo4j username |
| `neo4j-cypher` | `NEO4J_CYPER_PASSWORD` | Neo4j password |

**Configuration commands:**

```text
MCP_DOCKER_mcp-config-set {"server":"neo4j-memory"}
MCP_DOCKER_mcp-config-set {"server":"database-server"}
MCP_DOCKER_mcp-config-set {"server":"neo4j-cypher"}
```

Use environment variables for credentials; never commit or paste actual secrets.

### 3) Add and activate servers

```text
MCP_DOCKER_mcp-add {"name":"neo4j-memory", "activate": true}
MCP_DOCKER_mcp-add {"name":"database-server", "activate": true}
MCP_DOCKER_mcp-add {"name":"neo4j-cypher", "activate": true}
```

### 4) Execute memory operations

Use packaged server tools in the-memory-first order:

```text
1. `neo4j-memory` for approved-memory recall
2. `database-server` for raw evidence and trace checks
3. `neo4j-cypher` only for targeted graph inspection or explicit Cypher requests
```

### 5) Verify and document

- Confirm expected entities/rows were affected.
- Record operation context (group scope, tool, query purpose) in task notes.
- Remove unneeded servers if session context is crowded.

## Recommended Execution Order for Memory Tasks

1. Discover `neo4j-memory`
2. Configure and add `neo4j-memory`
3. Attempt approved-memory recall first
4. Add `database-server` only if evidence or raw traces are needed
5. Add `neo4j-cypher` only if graph inspection is still required
6. Verify outputs and scope (`group_id`)

## Common Playbooks

### Playbook A: Find historical insights for one tenant

1. Use `neo4j-memory` first.
2. If deeper graph inspection is required, add `neo4j-cypher` via MCP_DOCKER.
3. Run read query for insight/version nodes filtered by `group_id`.
4. Check version lineage (`SUPERSEDES`) before reporting latest state.

### Playbook B: Audit raw trace events in PostgreSQL

1. Use `neo4j-memory` first for current approved context.
2. Add `database-server` when you need raw SQL or trace inspection.
3. List tables and describe event schema.
4. Query by `group_id` and time window.
5. Correlate with graph-side insight IDs.

### Playbook C: Hybrid memory triage

1. Read approved memory from `neo4j-memory`.
2. Read traces from `database-server` for the incident window.
3. Identify mismatch between raw evidence and promoted insight state.
4. If graph traversal is still unclear, add `neo4j-cypher`.

## Troubleshooting

- No search results: broaden `mcp-find` query and raise `limit`.
- Config validation errors: inspect server schema and retry with required keys only.
- Tool missing after add: re-add with `activate: true` or check server name mismatch.
- Empty memory results: verify `group_id`, date window, and environment connectivity.
- Connection refused: ensure Docker containers expose ports and use `host.docker.internal` for host-side access.

## References

- Load detailed mappings from `@references/memory-system-tool-map.md`.
