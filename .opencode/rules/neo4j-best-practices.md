---
description: Neo4j knowledge graph best practices
globs: ["src/lib/neo4j/**", "scripts/**"]
---

# Neo4j Best Practices

## Node Structure

- Every node MUST have `group_id` property
- Use `SUPERSEDES` relationships for versioning
- Never edit existing nodes - create new versions
- Agent nodes track: confidence, contributions, learning

## Query Patterns

- Use parameterized queries
- Always filter by `group_id`
- Use `MERGE` for idempotent operations
- Create constraints for unique identifiers

## Example

```typescript
// Good - Versioning with SUPERSEDES
await session.run(`
  MATCH (v1:Insight {insight_id: $id})
  CREATE (v2:Insight {
    insight_id: 'ins_' + randomUUID(),
    summary: $newSummary,
    group_id: $groupId
  })
  CREATE (v2)-[:SUPERSEDES]->(v1)
  SET v1:deprecated
`, { id, newSummary, groupId: '<group_id>' });
```

## Invariants

- ✅ group_id on every node
- ✅ SUPERSEDES for versioning
- ✅ Never mutate historical nodes
