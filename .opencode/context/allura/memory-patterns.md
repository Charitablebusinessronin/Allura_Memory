# Allura Memory System Patterns

## Neo4j Hygiene
- **Search before write**: Always `read_neo4j_cypher` first to dedup.
- **SUPERSEDES**: New versions must link: `(v2)-[:SUPERSEDES]->(v1:deprecated)`.
- **Max 1 Neo4j write** per completed task/decision.
- **Batch bursts** into a single "session checkpoint" insight.

## Postgres Event Schema
```typescript
interface Event {
  event_type: string; // ADR_CREATED | TASK_COMPLETE | BLOCKED | LESSON_LEARNED
  group_id: string;   // 'allura-system'
  agent_id: string;   // 'brooks' | 'knuth' | etc.
  status: string;     // 'completed' | 'failed' | 'pending'
  metadata: object;   // JSON summary
}
```

## Promotion Criteria (ALL 3 required for Neo4j)
1. Decision is reusable across ≥2 projects.
2. Decision was validated — not just proposed.
3. No duplicate exists in Neo4j (check first).

## Steel Frame Versioning
- Insights are immutable — create new with `SUPERSEDES`.
- `group_id` is the tenant isolation boundary.
- Legacy `roninclaw-*` is deprecated → use `allura-*`.
