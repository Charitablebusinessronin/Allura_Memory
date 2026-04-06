# Task: Neo4j Graph Traversal

You are an agent with access to a Neo4j database containing the Allura knowledge graph.

## Your task

### Step 1: Create initial nodes

Create an Agent node and a Decision node:

```cypher
MERGE (a:Agent {
  name: 'benchmark-agent',
  group_id: 'allura-test',
  role: 'tester'
})

MERGE (d1:Decision {
  decision_id: 'bench-decision-v1',
  group_id: 'allura-test',
  choice: 'use-postgres-for-traces',
  reasoning: 'append-only traces need Postgres',
  status: 'active'
})
```

### Step 2: Create CONTRIBUTED relationship

```cypher
MATCH (a:Agent {name: 'benchmark-agent', group_id: 'allura-test'})
MATCH (d1:Decision {decision_id: 'bench-decision-v1', group_id: 'allura-test'})
MERGE (a)-[:CONTRIBUTED {on: date()}]->(d1)
```

### Step 3: Version the decision with SUPERSEDES (never edit existing nodes)

Create a new version and link with SUPERSEDES:

```cypher
MERGE (d2:Decision {
  decision_id: 'bench-decision-v2',
  group_id: 'allura-test',
  choice: 'use-postgres-for-traces',
  reasoning: 'append-only traces need Postgres — confirmed by benchmark',
  status: 'active'
})
MERGE (d1:Decision {decision_id: 'bench-decision-v1', group_id: 'allura-test'})
SET d1.status = 'deprecated'
MERGE (d2)-[:SUPERSEDES]->(d1)
```

### Step 4: Traverse the graph

Query and confirm:
1. The Agent contributed to `bench-decision-v1`
2. `bench-decision-v2` supersedes `bench-decision-v1`
3. Only `bench-decision-v2` has `status: active`
4. Both nodes have `group_id: allura-test`

## Rules
- Never edit existing nodes — always create new versions with SUPERSEDES
- Every node must have `group_id: allura-test`
- Use the NEO4J_URI environment variable to connect (bolt://localhost:7687)

## Output

Print the traversal result as JSON:
```json
{
  "agent_contributed": true,
  "supersedes_chain": true,
  "active_version": "bench-decision-v2",
  "group_id_on_all": true
}
```
