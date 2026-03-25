# Technical Context: Allura's Memory

## Technology Stack

| Layer | Technology | Version | Purpose |
|-------|------------|---------|---------|
| AI Reasoning | OpenClaw | - | Goal-directed control loops |
| Execution | OpenCode | - | Worker agent execution environments |
| Raw Trace | PostgreSQL | 16 | Append-only durable storage |
| Knowledge Graph | Neo4j | 5.26 + APOC | Versioned insights, entity relationships |
| Human Workspace | Notion | MCP | Approval workflows, curated documentation |
| Runtime | Docker | Ubuntu containers | Isolated execution |
| Framework | Next.js | 16 | Application framework |
| UI Components | shadcn/ui | - | Component library |
| Styling | Tailwind CSS | v4 | CSS framework |
| State Management | Zustand | - | Client state |
| Validation | Zod | - | Schema validation |
| Language | TypeScript | - | Type safety |
| Runtime | Node.js | 20-alpine | Server runtime |

## Infrastructure Status

**Running Services (verified 2026-03-15):**

| Container | Image | Status | URL |
|-----------|-------|--------|-----|
| `knowledge-postgres` | PostgreSQL 16 | ✅ Healthy | `localhost:5432` |
| `knowledge-neo4j` | Neo4j 5.26 + APOC | ✅ Healthy | Browser: `http://localhost:7474`<br>Bolt: `bolt://localhost:7687` |

**Credentials:**
- PostgreSQL: `POSTGRES_USER=ronin4life`, `POSTGRES_PASSWORD=KaminaTHC*`, `POSTGRES_DB=memory`
- Neo4j: `NEO4J_USER=neo4j`, `NEO4J_PASSWORD=KaminaTHC*`

## Project Structure

```
memory/
├── _bmad/                    # BMAD framework files
│   ├── _memory/              # Memory sidecars
│   │   └── unified-memory-anchor.md
│   ├── bmm/                  # Build-Measure-Master agents
│   ├── cis/                  # Creative Innovation Suite agents
│   └── tea/                  # Test Engineering Architecture
├── _bmad-output/             # Generated artifacts
│   ├── planning-artifacts/
│   │   └── epics.md          # Epic and story definitions
│   └── implementation-artifacts/
│       ├── sprint-status.yaml
│       ├── tech-spec-*.md    # Technical specifications
│       └── 1-1-*.md          # Story files
├── memory-bank/              # ← NEW: Memory bank files
├── docker-compose.yml        # Container definitions
├── postgres-init/            # PostgreSQL init scripts
├── neo4j-import/             # Neo4j import scripts
├── src/                      # Application source
│   ├── lib/
│   │   ├── postgres/        # PostgreSQL client (TO CREATE)
│   │   ├── neo4j/           # Neo4j client (TO CREATE)
│   │   ├── knowledge/       # Knowledge utilities (TO CREATE)
│   │   └── mcp/             # MCP tools (TO CREATE)
│   ├── stores/               # Zustand stores
│   └── server/               # Server actions
└── .env                      # Environment variables
```

## Dependencies

### Required (verified in package.json location TBD)
- `pg` - PostgreSQL client for Node.js
- `neo4j-driver` - Official Neo4j driver
- `zod` - Runtime type validation (available)
- `@modelcontextprotocol/sdk` - MCP server implementation

### Infrastructure Dependencies
- Docker Compose - Container orchestration
- Ubuntu Docker images - Sandboxed execution

## Environment Variables

```env
# PostgreSQL
POSTGRES_USER=ronin4life
POSTGRES_PASSWORD=KaminaTHC*
POSTGRES_DB=memory
POSTGRES_HOST=knowledge-postgres
POSTGRES_PORT=5432

# Neo4j
NEO4J_USER=neo4j
NEO4J_PASSWORD=KaminaTHC*
NEO4J_URI=bolt://localhost:7687

# Notion (integration MCP)
NOTION_API_KEY=secret_...
NOTION_DATABASE_ID=...
```

## Key File Patterns

### Connection Pattern (PostgreSQL)
```typescript
// src/lib/postgres/connection.ts
import { Pool } from 'pg';

const pool = new Pool({
  connectionString: process.env.POSTGRES_URL,
  // pool config...
});

export { pool };
```

### Connection Pattern (Neo4j)
```typescript
// src/lib/neo4j/connection.ts
import neo4j from 'neo4j-driver';

const driver = neo4j.driver(
  process.env.NEO4J_URI,
  neo4j.auth.basic(process.env.NEO4J_USER, process.env.NEO4J_PASSWORD)
);

export { driver };
```

### Zustand Store Pattern
```typescript
// src/stores/preferences/preferences-store.ts pattern
import { create } from 'zustand';

interface PreferencesStore {
  // state...
}

export const usePreferencesStore = create<PreferencesStore>((set) => ({
  // actions...
}));
```

## Known Constraints

### P0 Blockers (Must Complete First)
1. **No PostgreSQL TypeScript client** - Need `src/lib/postgres/connection.ts`
2. **No Neo4j TypeScript client** - Need `src/lib/neo4j/connection.ts`
3. **No MCP Integration** - Need Notion MCP tools
4. **No Neo4j Schema** - Need constraints, indexes, Steel Frame setup
5. **No group_id Constraint** - Need schema enforcement for tenant isolation
6. **No ADR Framework** - Need 5-layer audit structure

### Infrastructure Gaps
- `postgres-init/` is currently empty - schema application path needed
- Notion MCP integration not configured
- Test framework not set up (Vitest + Playwright needed)

## Verification Commands

```bash
# PostgreSQL status
docker exec knowledge-postgres pg_isready -U ronin4life -d memory
# Output: /var/run/postgresql:5432 - accepting connections

# Neo4j status
curl -s http://localhost:7474 | jq .neo4j_version
# Output: "5.26.22"

# Neo4j Cypher Shell
docker exec knowledge-neo4j cypher-shell -u neo4j -p 'KaminaTHC*' "RETURN 1 AS test"
# Output: test\n1
```

## API Patterns

### MCP Tool Pattern
```typescript
// src/lib/mcp/neo4j-tools.ts
export const neo4jTools = {
  search_memories: {
    description: 'Search for insights and knowledge items',
    parameters: z.object({
      query: z.string(),
      group_id: z.string(),
      limit: z.number().optional()
    }),
    handler: async (params) => { /* ... */ }
  },
  create_entities: {
    description: 'Create nodes with deduplication',
    // ...
  }
};
```

### Query Pattern (PostgreSQL Traces)
```sql
-- Append-only insert
INSERT INTO events (group_id, agent_id, workflow, outcome, metadata, created_at)
VALUES ($1, $2, $3, $4, $5, NOW());

-- Episodic retrieval
SELECT * FROM events
WHERE group_id = $1
  AND created_at > $2
ORDER BY created_at DESC
LIMIT 100;
```

### Query Pattern (Neo4j Knowledge)
```cypher
// Current truth query
MATCH (i:Insight)
WHERE i.topic_key = $topic_key
  AND (i.group_id = $group_id OR i.group_id = 'global')
  AND NOT (()-[:SUPERSEDES]->(i))
RETURN i
ORDER BY i.confidence DESC, i.timestamp DESC

// Dual-context query
MATCH (i:Insight)
WHERE i.group_id = $project_id OR i.group_id = 'global'
RETURN i
ORDER BY i.confidence DESC, i.timestamp DESC
```

## Testing Strategy

1. **Unit Tests** - Neo4j Cypher query validation
2. **Integration Tests** - MCP tool round-trip tests
3. **Schema Tests** - Constraint/index verification
4. **Version Tests** - Insight supersession chain tests
5. **Deduplication Tests** - Entity resolution edge cases
6. **ADAS Tests** - Candidate promotion workflow validation
7. **ADR Tests** - 5-layer reconstruction
8. **Agent Loop Tests** - BuildContext, PlanStep, ExecuteTool, UpdateState steps
9. **Layer Separation Tests** - Verify group_id isolation
10. **HITL Governance Tests** - Promotion gates, restricted tools, human oversight