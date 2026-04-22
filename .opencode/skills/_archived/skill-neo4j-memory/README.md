# @allura/skill-neo4j-memory

MCP Docker skill for Neo4j-backed Allura Brain memory operations — recall and list approved Insights.

## Overview

This skill provides a focused interface for interacting with the Neo4j-backed semantic layer of **Allura**. It is the primary packaged MCP surface for approved-memory recall and listing operations; it is not a standalone agent and not the orchestrator.

## Role in the Stack

Use this first for normal memory recall.

Escalation order:
1. `skill-neo4j-memory`
2. `skill-database` when raw evidence is needed
3. `skill-cypher-query` only when targeted graph inspection is required

## Tools

### recall_insight

Recall an approved Insight from Neo4j memory by ID or query.

**Input:**
- `insightId` (string, optional): The ID of the insight to recall
- `query` (string, optional): Natural language query to search for insights
- `groupId` (string, optional): Group ID to scope the search (recommended: `allura-roninmemory`)

**Usage:**
```text
If this skill is activated through MCP_DOCKER, call its exposed recall tool with:
- insightId: adr_001
or
- query: recent architectural decisions
```

### list_insights

List approved Insights from Neo4j memory with optional filtering.

**Input:**
- `groupId` (string, optional): Group ID to scope the search (recommended: `allura-roninmemory`)
- `limit` (number, optional): Maximum number of insights to return (default: 10, max: 100)
- `offset` (number, optional): Number of insights to skip (default: 0)

**Usage:**
```text
Example inputs for the exposed list tool:
- groupId: allura-roninmemory
- limit: 20

Paginated example:
- groupId: allura-roninmemory
- limit: 10
- offset: 10
```

## Architecture

```
┌─────────────────────────────────────┐
│  skill-neo4j-memory (MCP Docker)   │
├─────────────────────────────────────┤
│  recall_insight                    │
│  list_insights                     │
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
1. Discover: MCP_DOCKER_mcp-find query="skill neo4j memory"
2. Configure: MCP_DOCKER_mcp-config-set server="skill-neo4j-memory"
3. Activate: MCP_DOCKER_mcp-add name="skill-neo4j-memory"

Required config values:
- neo4jUri: bolt://neo4j:7687
- neo4jUser: neo4j
- neo4jPassword: supplied at config time
- defaultGroupId: allura-roninmemory
```

## Development

### Build
```bash
cd .opencode/skills/skill-neo4j-memory
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

This skill is designed to be used by the Team RAM orchestrator as the first memory hop:

```typescript
// team-ram/orchestrator.ts
const context = await subagent.call('skill-neo4j-memory', {
  query: 'recent architectural decisions'
});
```

## Notes

- **Read-only by policy** - This skill only reads from Neo4j
- **Group-scoped** - All operations are scoped to an explicit `groupId`
- **Append-only** - Insights are never modified, only versioned with `SUPERSEDES`
- **Primary recall surface** - Use this before trace SQL or raw Cypher
