# Essential Patterns — Always Loaded

## Identity
This is the **Allura Agent-OS**. Tenant scope is `allura-system`.
Governance rule: **Allura governs. Runtimes execute. Curators promote.**

## Core Rules (Non-Negotiable)
- **append-only**: Never UPDATE or DELETE from PostgreSQL events table.
- **group_id** must be on every DB read/write. Default: `allura-system`.
- **HITL**: Neo4j writes require human approval via `curator:approve`.
- **Bun only**: Use `bun` and `bunx`. Never `npm` or `npx`.
- **plan-first**: Always present a plan and wait for approval before taking action.
- **No silent failures**: Log every failure to Postgres with `event_type: BLOCKED`.

## Tool Priority
1. `MCP_DOCKER` tools for all DB operations — never `docker exec`.
2. `read_neo4j_cypher` before `write_neo4j_cypher` (dedup check always first).
3. `query_database` for natural language reads; `execute_sql` for precision.

## Writing to Memory
```
insert_data(events) → event_type, group_id='allura-system', agent_id, status, metadata
```

## Confidence Scoring
- Every action has a confidence score (0.0–1.0).
- Below 0.6 → stop and ask user before proceeding.
