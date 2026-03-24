# Story 6.3: Promote Agent Metadata to Neo4j

**Epic:** Epic 6 - Agent Persistence and Lifecycle Management
**Status:** in-progress
**Created:** 2026-03-17
**Dependencies:** Story 6.2 (COMPLETE)

## User Story

As an agent operator,
I want agent metadata searchable in Neo4j,
So that I can discover agents by capability, module, or platform.

## Acceptance Criteria

### Given an agent exists in PostgreSQL
When the promotion pipeline runs
Then it creates in Neo4j:
- `AIAgent` node with properties
- `HAS_CAPABILITY` relationships to tools
- `BELONGS_TO_MODULE` relationship
- `SUPPORTS_PLATFORM` relationships
- `SUPERSEDES` edges for version lineage

## Technical Specification

### Neo4j Node Schema

```cypher
// Agent Node
CREATE (a:AIAgent {
  agent_id: $agent_id,
  name: $name,
  description: $description,
  persona: $persona,
  module: $module,
  platform: $platform,
  version: $version,
  status: $status,
  confidence_score: $confidence_score,
  created_at: datetime($created_at),
  updated_at: datetime($updated_at)
})

// Module Node (singleton per module)
CREATE (m:Module {name: $module_name})

// Platform Node (singleton per platform)
CREATE (p:Platform {name: $platform_name})

// Capability Node
CREATE (c:Capability {name: $capability_name})

// Relationships
CREATE (a)-[:BELONGS_TO]->(m)
CREATE (a)-[:SUPPORTS]->(p)
CREATE (a)-[:HAS_CAPABILITY]->(c)
CREATE (a)-[:SUPERSEDES]->(old_agent)  // for version lineage
```

### TypeScript Client

```typescript
// src/lib/agents/neo4j-client.ts

export class AgentNeo4jClient {
  async promoteAgent(agentId: string): Promise<void>;
  async getAgent(agentId: string): Promise<AgentNode | null>;
  async searchAgents(query: AgentSearchQuery): Promise<AgentNode[]>;
  async createLineage(oldAgentId: string, newAgentId: string): Promise<void>;
  async getAgentCapabilities(agentId: string): Promise<string[]>;
  async getAgentsByModule(module: string): Promise<AgentNode[]>;
  async getAgentsByPlatform(platform: string): Promise<AgentNode[]>;
}
```

### Promotion Pipeline

```typescript
// src/lib/agents/promotion.ts

export async function promoteAgentToNeo4j(agentId: string): Promise<void> {
  // 1. Get agent from PostgreSQL
  const pgAgent = await pgClient.getAgent(agentId);
  
  // 2. Check if agent exists in Neo4j
  const existingAgent = await neo4jClient.getAgent(agentId);
  
  // 3. Create or update agent node
  if (existingAgent) {
    await neo4jClient.updateAgent(pgAgent);
  } else {
    await neo4jClient.createAgent(pgAgent);
  }
  
  // 4. Create module relationship
  await neo4jClient.linkToModule(agentId, pgAgent.module);
  
  // 5. Create platform relationship
  await neo4jClient.linkToPlatform(agentId, pgAgent.platform);
  
  // 6. Create capability relationships
  for (const cap of pgAgent.capabilities) {
    await neo4jClient.linkToCapability(agentId, cap);
  }
}
```

## Definition of Done

- [ ] Neo4j node schema documented
- [ ] AgentNeo4jClient implemented
- [ ] Promotion pipeline complete
- [ ] Integration with PostgreSQL client
- [ ] Tests pass: `npm test -- agent-neo4j`
- [ ] Code review approved
- [ ] Memory log updated

## Files to Create

| File | Purpose |
|------|---------|
| `src/lib/agents/neo4j-client.ts` | Neo4j client |
| `src/lib/agents/promotion.ts` | Promotion pipeline |
| `src/__tests__/agent-neo4j.test.ts` | Test suite |

## Estimated Effort
2-3 hours

---

*Story 6.3 - Promote Agent Metadata to Neo4j*
*Epic 6 - Agent Persistence and Lifecycle Management*