# RuVix Vector/Graph Skill

## Overview
Use RuVix kernel's native vector and graph stores for OpenClaw agent memory operations. Provides HNSW vector search and Neo4j-like graph semantics with SUPERSEDES versioning.

## When to Use
- Agent needs semantic memory search (similar events, patterns)
- Building knowledge graphs from agent decisions
- Storing agent embeddings for retrieval
- Versioning insights with SUPERSEDES pattern
- Cross-tenant vector/graph isolation

## Commands

### Vector Store Operations
```bash
# Create vector store
ruvix-vector-graph vector-store create --store-id <id> --dimensions 384 --capacity 10000 --group-id <gid>

# Put vector
ruvix-vector-graph vector put --store-id <id> --key <n> --data <embedding> --metadata <json>

# Search vectors
ruvix-vector-graph vector search --store-id <id> --query <embedding> --limit 10

# Delete vector store
ruvix-vector-graph vector-store delete --store-id <id>
```

### Graph Store Operations
```bash
# Create graph store
ruvix-vector-graph graph-store create --store-id <id> --max-nodes 50000 --max-edges 200000 --group-id <gid>

# Create node
ruvix-vector-graph node create --store-id <id> --node-id <id> --labels <labels> --properties <json>

# Create edge
ruvix-vector-graph edge create --store-id <id> --edge-id <id> --source <src> --target <tgt> --relation-type <type>

# Query graph
ruvix-vector-graph graph query --store-id <id> --labels <labels> --limit 100

# Delete graph store
ruvix-vector-graph graph-store delete --store-id <id>
```

## Integration with OpenClaw

### 1. Event Vector Indexing
```typescript
// OpenClaw agent indexing events
import { indexEventVector, searchSimilarEvents } from "@/lib/ruvix/integration";

async function agentMemory(agentId: string, groupId: string) {
  // Index current event
  await indexEventVector({
    eventId: `evt-${Date.now()}`,
    eventType: "agent_action",
    agentId,
    groupId,
    timestamp: new Date().toISOString(),
    metadataHash: JSON.stringify({ action: "decision" }),
  });
  
  // Search similar past events
  const similar = await searchSimilarEvents(
    groupId,
    { eventType: "agent_action", agentId },
    10
  );
  
  return similar;
}
```

### 2. Knowledge Graph Creation
```typescript
// OpenClaw curator building knowledge graph
import { createInsightGraph, queryKnowledgeGraph } from "@/lib/ruvix/integration";

async function buildKnowledgeGraph(insightId: string, groupId: string) {
  await createInsightGraph({
    insightId,
    groupId,
    summary: "Agent optimization pattern",
    entities: ["Agent", "Memory", "Optimization"],
    traceRef: "trace-789",
  });
  
  // Query graph for related insights
  const graph = await queryKnowledgeGraph(groupId, ["Insight"], 100);
  
  return graph;
}
```

### 3. Sync from Existing DBs
```typescript
// Sync Postgres events → Vector store
import { syncPostgresToVector, syncNeo4jToGraph } from "@/lib/ruvix/integration";

async function migrateMemory(groupId: string) {
  // Migrate existing Postgres events to vector store
  await syncPostgresToVector();
  
  // Migrate existing Neo4j insights to graph store
  await syncNeo4jToGraph();
}
```

## Workflow Integration

### OpenClaw Agent Memory Flow
```
1. Agent receives task
   └─ Search vector store for similar past tasks
   
2. Agent makes decision
   └─ Create graph node (Decision)
   └─ Create edges to related entities
   
3. Agent completes task
   └─ Index task embedding in vector store
   └─ Link decision graph nodes
   
4. Agent retrospective
   └─ Query graph for decision chain
   └─ Analyze similar past decisions via vector search
```

### Example: Agent Pattern Discovery
```typescript
import { vectorSearch, graphQuery } from "@/lib/ruvix/vector-graph";

async function discoverAgentPatterns(groupId: string) {
  // Vector search: Find similar agent behaviors
  const queryEmbedding = await generateAgentEmbedding("optimization");
  const similarBehaviors = await vectorSearch(
    `events-${groupId}`,
    queryEmbedding,
    20
  );
  
  // Graph query: Find decision patterns
  const decisionGraph = await graphQuery(
    `knowledge-${groupId}`,
    ["Decision", "Pattern"],
    50
  );
  
  // Correlate vectors + graph
  const patterns = correlateBehaviors(similarBehaviors, decisionGraph);
  
  return patterns;
}
```

### Example: SUPERSEDES Insight Versioning
```typescript
import { createNode, createEdge } from "@/lib/ruvix/vector-graph";

async function versionInsight(oldInsightId: string, newInsight: Insight) {
  const storeId = `knowledge-${newInsight.groupId}`;
  
  // Create new version
  await createNode(
    storeId,
    newInsight.id,
    ["Insight", "Version"],
    {
      summary: newInsight.summary,
      version: 2,
      supersedes: oldInsightId,
    },
    newInsight.groupId
  );
  
  // Create SUPERSEDES edge
  await createEdge(
    storeId,
    `edge-supersedes-${newInsight.id}`,
    newInsight.id,
    oldInsightId,
    "SUPERSEDES",
    { timestamp: Date.now() },
    newInsight.groupId
  );
}
```

## Configuration

### `.opencode/config.json`
```json
{
  "skills": {
    "ruvix-vector-graph": {
      "enabled": true,
      "sidecarUrl": "http://127.0.0.1:9001",
      "vectorStores": {
        "events": { dimensions: 384, capacity: 10000 },
        "insights": { dimensions: 768, capacity: 5000 }
      },
      "graphStores": {
        "knowledge": { maxNodes: 50000, maxEdges: 200000 }
      },
      "autoSync": true
    }
  }
}
```

## Best Practices

1. **Group-aware stores** - Create separate stores per tenant
2. **Embedding consistency** - Use same embedding model for search
3. **SUPERSEDES versioning** - Never UPDATE, always CREATE + SUPERSEDES edge
4. **Sync periodically** - Keep vector/graph in sync with Postgres/Neo4j
5. **Query with limits** - Prevent unbounded graph queries

## Troubleshooting

### Store Not Found
```
Error: Store not found
Solution: Create store first via create-vector-store or create-graph-store
```

### Dimension Mismatch
```
Error: Vector dimension mismatch
Solution: Ensure embeddings match store dimensions (384 or 768)
```

### Capacity Exceeded
```
Error: Vector store at capacity
Solution: Increase capacity or create new store
```

### Node Not Found
```
Error: Source/target node not found
Solution: Create nodes before creating edges
```

## Related Skills
- `ruvix-proof` - Proof generation/verification
- `ruvix-capability` - Token-based permissions
- `ruvix-checkpoint` - State snapshots
