# Legacy README Details

This file contains information moved from the main README to keep it concise.

## Docker Volume Management

The project uses named volumes with the `memory_` prefix:

```bash
# List project volumes
docker volume ls | grep -E "(postgres|neo4j)"

# Clean up orphaned volumes
docker volume prune -f

# Reset databases (WARNING: destroys all data)
docker compose down -v
docker compose up -d
```

**Active volumes:**
- `memory_postgres_data`: PostgreSQL raw traces
- `neo4j_data`: Neo4j semantic insights

## OpenClaw Integration Details

This project exposes an MCP server at `src/mcp/memory-server.ts`.

### 1) Add Memory MCP to OpenClaw

Update `~/.openclaw/workspace/config/mcporter.json` with a `memory` entry:

```json
{
  "mcpServers": {
    "memory": {
      "command": "npx",
      "args": [
        "tsx",
        "/home/ronin704/dev/projects/memory/src/mcp/memory-server.ts"
      ],
      "cwd": "/home/ronin704/dev/projects/memory",
      "description": "Unified memory MCP server (PostgreSQL + Neo4j + ADR + Ralph tools)",
      "env": {
        "NEO4J_PASSWORD": "yourpassword",
        "POSTGRES_PASSWORD": "yourpassword",
        "NEO4J_URI": "bolt://localhost:7687",
        "NEO4J_USER": "neo4j",
        "POSTGRES_HOST": "localhost",
        "POSTGRES_PORT": "5432",
        "POSTGRES_DB": "memory",
        "POSTGRES_USER": "ronin4life"
      }
    }
  }
}
```

### 2) Verify MCP Tools

```bash
mcporter list memory
mcporter list memory --schema
mcporter call memory.search_events '{"query":"epic","group_id":"difference-driven","limit":5}'
```

## Project Structure

```
src/
├── app/                    # Next.js App Router pages and layouts
├── components/ui/          # shadcn/ui component library
├── curator/                # Knowledge promotion pipeline, HITL curation
├── integrations/           # External service clients
├── lib/
│   ├── adas/                # Automated Design of Agent Systems
│   ├── agents/              # Agent registry, lifecycle, lineage
│   ├── circuit-breaker/     # Cascade failure prevention
│   ├── notion/               # Notion sync and drift detection
│   ├── postgres/             # Raw memory (events, outcomes, traces)
│   ├── neo4j/                # Semantic memory (insights, knowledge graph)
│   ├── ralph/                # Self-correcting execution loops
│   ├── adr/                  # Agent Decision Records (5-layer audit)
│   ├── audit/                # Trace navigation, audit logs
│   ├── budget/               # Resource tracking, Kmax enforcement
│   ├── termination/          # Progress summaries, escalation
│   ├── policy/               # RBAC, allow/deny rules
│   ├── dedup/                # Entity deduplication
│   ├── lifecycle/            # Insight state machine
│   ├── import/               # ETL pipeline (extract → transform → load)
│   ├── sync/                 # Drift detection, Notion sync
│   ├── validation/           # Input validation, group governance
│   └── memory/               # Dual-context query engine
├── mcp/                      # MCP server (memory tools for OpenClaw)
├── server/                   # Next.js server actions
├── stores/                   # Zustand client state
├── hooks/                    # Custom React hooks
└── shared/                   # Shared types and utilities
```

## Lessons Learned

1. **Neo4j Integers**: Always use `.toNumber()` on Integer fields, use `neo4jInt()` for LIMIT/SKIP
2. **Ralph Loop Efficiency**: One story per iteration, clear completion promises
3. **Circuit Breaker States**: CLOSED, OPEN, HALF_OPEN state machine
4. **PostgreSQL Test Setup**: `initializeSchema()` in beforeAll, `closePool()` in afterAll
5. **Deduplication**: Embedding similarity and Levenshtein distance for entity matching
6. **Agent Lifecycle**: Draft, Testing, Active, Deprecated, Archived; state transitions must be explicit
7. **Notion Sync**: Tags property overloaded causes drift; use separate page property fields
8. **Agent Promotion**: Requires HITL approval; automatic promotion only after human sign-off
9. **Agent Creation**: File-first (no Docker); Docker only for sandboxed/untrusted code execution
