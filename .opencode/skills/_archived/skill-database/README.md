# @allura/skill-database

MCP Docker skill for PostgreSQL operations over the raw trace layer of Allura Brain.

## Overview

This skill provides a focused interface for interacting with PostgreSQL for raw trace operations in **Allura**. It is the evidence layer for memory workflows: use it after memory recall when you need audit, provenance, or raw trace verification.

## Role in the Stack

Use this second, not first.

Escalation order:
1. `skill-neo4j-memory`
2. `skill-database`
3. `skill-cypher-query` only if graph inspection is still required

## Tools

### execute_sql

Execute SQL queries against PostgreSQL for raw trace operations (append-only).

**Input:**
- `query` (string, required): The SQL query to execute (read operations only)
- `parameters` (array, optional): Array of parameters for parameterized queries (default: `[]`)
- `readOnly` (boolean, optional): Whether to enforce read-only execution (default: `true`)

**Usage:**
```text
Example inputs for the exposed execute_sql tool:
- query: SELECT * FROM events WHERE group_id = $1 LIMIT 10
- parameters: ["allura-roninmemory"]

Parameterized example:
- query: SELECT * FROM events WHERE agent_id = $1 AND event_type = $2
- parameters: ["brooks", "ADR_CREATED"]
```

### insert_trace

Insert a new trace row into the events table (append-only, no UPDATE/DELETE).

**Input:**
- `tableName` (string, optional): Target table name (default: `events`)
- `columns` (string, required): Comma-separated column names
- `values` (string, required): Comma-separated values (parameterized)
- `groupId` (string, required): Group ID for tenant isolation
- `agentId` (string, optional): Agent ID that generated this trace
- `eventType` (string, optional): Type of event being traced
- `status` (string, optional): Status of the event (default: `completed`)
- `metadata` (object, optional): JSON metadata for the event (default: `{}`)

**Usage:**
```text
Example inputs for the exposed insert_trace tool:
- columns: event_type, group_id, agent_id, status, metadata
- values: 'ADR_CREATED', 'allura-roninmemory', 'brooks', 'completed', '{"decision_id": "adr_001"}'
- groupId: allura-roninmemory
- agentId: brooks
- eventType: ADR_CREATED
```

### query_traces

Query trace events with proper group_id filtering.

**Input:**
- `groupId` (string, required): Group ID to scope the search
- `agentId` (string, optional): Filter by agent ID
- `eventType` (string, optional): Filter by event type
- `status` (string, optional): Filter by status
- `limit` (number, optional): Maximum number of results (default: 100, max: 1000)
- `offset` (number, optional): Number of results to skip (default: 0)
- `orderBy` (string, optional): Order by field (default: `created_at DESC`)

**Usage:**
```text
Example inputs for the exposed query_traces tool:
- groupId: allura-roninmemory
- agentId: brooks
- eventType: ADR_CREATED
- limit: 20

Paginated example:
- groupId: allura-roninmemory
- limit: 10
- offset: 10
```

## Architecture

```
┌─────────────────────────────────────┐
│  skill-database (MCP Docker)       │
├─────────────────────────────────────┤
│  execute_sql                       │
│  insert_trace                      │
│  query_traces                      │
└──────────────┬──────────────────────┘
               │
               ▼
┌─────────────────────────────────────┐
│  PostgreSQL 16 (Raw Trace Store)  │
│  - Events                          │
│  - Traces                          │
│  - Sessions                        │
└─────────────────────────────────────┘
```

## Configuration

Use `MCP_DOCKER_mcp-find`, `MCP_DOCKER_mcp-config-set`, and `MCP_DOCKER_mcp-add` to discover, configure, and activate the skill:

```text
1. Discover: MCP_DOCKER_mcp-find query="skill database postgres traces"
2. Configure: MCP_DOCKER_mcp-config-set server="skill-database"
3. Activate: MCP_DOCKER_mcp-add name="skill-database"

Required config values:
- postgresHost: postgres
- postgresPort: 5432
- postgresDb: supplied at config time
- postgresUser: supplied at config time
- postgresPassword: supplied at config time
- ruvectorHost: postgres
- ruvectorPort: 5432
- ruvectorUser: supplied at config time
- ruvectorPassword: supplied at config time
- ruvectorDb: supplied at config time
```

## Development

### Build
```bash
cd .opencode/skills/skill-database
bun run build
```

### Run
```bash
bun run start
```

### Test
```bash
bun test
```

## Integration

This skill is designed to be used by the Team RAM orchestrator after memory recall when evidence is needed:

```typescript
// team-ram/orchestrator.ts
const memory = await subagent.call('skill-neo4j-memory', {
  query: 'recent architectural decisions'
});

const evidence = await subagent.call('skill-database', {
  query: 'SELECT * FROM events WHERE group_id = $1',
  parameters: ['allura-roninmemory']
});
```

## Notes

- **Append-only by policy** - This skill only appends to the trace store
- **Group-scoped** - All operations are scoped to an explicit `groupId`
- **Parameterized queries** - All queries should use parameterized syntax to prevent injection
- **Tenant isolation** - `groupId` is enforced on all operations
- **Evidence surface** - Use this for raw trace access after memory recall, not as the default memory interface
