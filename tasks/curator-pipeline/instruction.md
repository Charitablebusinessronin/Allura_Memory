# Task: Curator Pipeline

You are an agent with access to a Neo4j database and PostgreSQL trace store.
You must exercise the full curator flow: propose an insight, approve it, and verify the versioning chain.

## Your task

### Step 1: Create an initial Insight node (pending approval)

```cypher
MERGE (i1:Insight {
  insight_id: 'bench-insight-v1',
  group_id: 'allura-test',
  content: 'PostgreSQL is preferred for append-only traces',
  source: 'benchmark',
  status: 'pending_approval',
  version: 1
})
RETURN i1.insight_id as id, i1.status as status
```

### Step 2: Approve the insight (simulate HITL approval)

```cypher
MATCH (i1:Insight {insight_id: 'bench-insight-v1', group_id: 'allura-test'})
SET i1.status = 'active',
    i1.approved_by = 'benchmark-curator',
    i1.approved_at = datetime()
RETURN i1.insight_id as id, i1.status as status, i1.approved_by as approved_by
```

### Step 3: Version the insight with SUPERSEDES (never edit existing nodes)

Create v2 and link it, deprecating v1:

```cypher
MERGE (i2:Insight {
  insight_id: 'bench-insight-v2',
  group_id: 'allura-test',
  content: 'PostgreSQL is preferred for append-only traces — confirmed by benchmark',
  source: 'benchmark',
  status: 'active',
  version: 2
})
MATCH (i1:Insight {insight_id: 'bench-insight-v1', group_id: 'allura-test'})
SET i1.status = 'deprecated'
MERGE (i2)-[:SUPERSEDES]->(i1)
RETURN i2.insight_id as new_version, i1.insight_id as deprecated_version
```

### Step 4: Traverse and verify

Query and confirm:
1. `bench-insight-v1` has `status: deprecated` and `approved_by` is set
2. `bench-insight-v2` has `status: active`
3. `(v2)-[:SUPERSEDES]->(v1)` relationship exists
4. Both nodes have `group_id: allura-test`

## Rules

- Never edit existing insight nodes — always create new versions with SUPERSEDES
- Every node must have `group_id: allura-test`
- `approved_by` must be set before an insight is considered approved
- Use the `NEO4J_URI` environment variable to connect (bolt://localhost:7687)

## Output

Print the result as JSON:

```json
{
  "insight_proposed": true,
  "insight_approved": true,
  "supersedes_chain": true,
  "audit_trail_complete": true
}
```
