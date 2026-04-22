# @allura/skill-cypher-query

MCP Docker skill for raw Cypher query execution with result shaping against the Neo4j-backed layer of Allura Brain.

## Overview

This skill provides a focused interface for executing Cypher queries against Neo4j. It is the expert fallback surface for targeted graph inspection; it is not an agent, not the orchestrator, and not the default memory interface.

## Role in the Stack

Use this last.

Escalation order:
1. `skill-neo4j-memory`
2. `skill-database` if evidence is needed
3. `skill-cypher-query` only when targeted graph traversal, schema inspection, or explicit Cypher is required

## Tools

### execute_cypher

Execute a read-only Cypher query against Neo4j and return shaped results.

**Input:**
- `cypher` (string, required): The Cypher query to execute (read-only operations only)
- `parameters` (object, optional): Parameters to bind to the Cypher query (default: `{}`)
- `readOnly` (boolean, optional): Whether to enforce read-only execution (default: `true`)

**Usage:**
```text
Use only after memory recall is insufficient.

Example inputs for the exposed execute_cypher tool:
- cypher: MATCH (d:Decision) RETURN d LIMIT 10

Parameterized example:
- cypher: MATCH (d:Decision {decision_id: $id}) RETURN d
- parameters: { id: "adr_001" }
```

### get_schema_info

Get information about the Neo4j schema (node labels, relationship types, property keys).

**Input:**
- `groupId` (string, optional): Group ID to scope the search (recommended: `allura-roninmemory`)

**Usage:**
```text
Example input for the exposed get_schema_info tool:
- groupId: allura-roninmemory
```

## Architecture

```
┌─────────────────────────────────────┐
│  skill-cypher-query (MCP Docker)   │
├─────────────────────────────────────┤
│  execute_cypher                    │
│  get_schema_info                   │
└──────────────┬──────────────────────┘
               │
               ▼
┌─────────────────────────────────────┐
│  Neo4j 5.26.0 (Knowledge Graph)   │
│  - Insights                        │
│  - ADRs                            │
│  - Patterns                        │
└─────────────────────────────────────┘
```

## Configuration

Use `MCP_DOCKER_mcp-find`, `MCP_DOCKER_mcp-config-set`, and `MCP_DOCKER_mcp-add` to discover, configure, and activate the skill:

```text
1. Discover: MCP_DOCKER_mcp-find query="skill cypher query"
2. Configure: MCP_DOCKER_mcp-config-set server="skill-cypher-query"
3. Activate: MCP_DOCKER_mcp-add name="skill-cypher-query"

Required config values:
- neo4jUri: bolt://neo4j:7687
- neo4jUser: neo4j
- neo4jPassword: supplied at config time
```

## Development

### Build
```bash
cd .opencode/skills/skill-cypher-query
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

This skill is designed to be used by the Team RAM orchestrator only as a fallback after memory-first routing:

```typescript
// team-ram/orchestrator.ts
const context = await subagent.call('skill-neo4j-memory', {
  query: 'recent architectural decisions'
});

const graphDetail = await subagent.call('skill-cypher-query', {
  cypher: 'MATCH (d:Decision) WHERE d.group_id = $groupId RETURN d LIMIT 10',
  parameters: { groupId: 'allura-roninmemory' }
});
```

## Notes

- **Read-only by policy** - This skill only executes read-only queries
- **Parameterized queries** - All queries should use parameterized syntax to prevent injection
- **Result shaping** - Results are automatically shaped for consistent consumption
- **Group-scoped** - All operations are scoped to an explicit `groupId`
- **Fallback-only surface** - Use this for read-only graph inspection after memory recall and, if needed, trace evidence lookup
