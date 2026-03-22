# Memory - Unified Knowledge System

A memory kernel for AI agents. It remembers what happened, learns from it, knows when to quit, and can explain itself.

## What It Does

| Layer | Purpose | Storage |
|-------|---------|---------|
| **Raw Memory** | Logs every event, action, mistake | PostgreSQL |
| **Semantic Memory** | Stores learned insights, versioned | Neo4j |
| **Control** | Self-correcting execution loops | Ralph Loops |
| **Discovery** | Tests new agent designs safely | ADAS Pipeline |
| **Governance** | Enforces rules, prevents crashes | Policy Gateway + Circuit Breakers |
| **Audit** | Explains every decision | ADR Layer |

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                      AI Agent                                │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                    Policy Gateway                            │
│              (RBAC, allow/deny rules)                        │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                    Ralph Loop                                │
│     (Perceive → Plan → Act → Check → Adapt)                 │
│                                                              │
│   ┌─────────────┐    ┌─────────────┐    ┌─────────────┐     │
│   │  Budget     │    │  Circuit    │    │   ADR       │     │
│   │  Enforcer   │    │  Breaker    │    │  Capture    │     │
│   └─────────────┘    └─────────────┘    └─────────────┘     │
└─────────────────────────────────────────────────────────────┘
                              │
            ┌─────────────────┴─────────────────┐
            ▼                                   ▼
   ┌─────────────────┐                ┌─────────────────┐
   │   PostgreSQL    │                │     Neo4j       │
   │   (Raw Logs)    │                │  (Insights)     │
   │                 │                │                 │
   │  • Events       │◄──trace_ref───►│  • Knowledge    │
   │  • Outcomes     │                │  • Agents       │
   │  • ADAS Runs     │                │  • Insights     │
   │  • Decisions    │                │  • Policies     │
   └─────────────────┘                └─────────────────┘
            │                                   │
            └─────────────────┬─────────────────┘
                              ▼
                   ┌─────────────────┐
                   │  ADAS Pipeline  │
                   │  (Discovery)    │
                   │                 │
                   │  Design → Eval  │
                   │    → Promote    │
                   └─────────────────┘
```

## Quick Start

### Prerequisites

- Node.js 24+
- Docker (for PostgreSQL and Neo4j)
- npm or pnpm

### Setup

```bash
# Clone and install
git clone <repo-url>
cd memory
npm install

# Start databases
docker-compose up -d

# Run tests
npm test

# Run behavioral stress tests (requires databases)
RUN_E2E_TESTS=true npm test
```

### Environment Variables

Create a `.env` file:

```env
POSTGRES_HOST=localhost
POSTGRES_PORT=5432
POSTGRES_DB=memory
POSTGRES_USER=ronin4life
POSTGRES_PASSWORD=yourpassword

NEO4J_URI=bolt://localhost:7687
NEO4J_USER=neo4j
NEO4J_PASSWORD=yourpassword
```

## OpenClaw Integration

This project exposes an MCP server at `src/mcp/memory-server.ts` so OpenClaw can use memory tools directly.

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
        "NEO4J_PASSWORD": "Kamina2025*",
        "POSTGRES_PASSWORD": "KaminaTHC*",
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

### 2) Start Local Dependencies

```bash
cd /home/ronin704/dev/projects/memory
docker-compose up -d
```

### 3) Verify MCP Tools

```bash
mcporter list memory
mcporter list memory --schema
mcporter call memory.search_events '{"query":"epic","group_id":"difference-driven","limit":5}'
```

### 4) Run Server Directly (Optional)

```bash
cd /home/ronin704/dev/projects/memory
npm run mcp
```

If `memory.search_events` works and returns PostgreSQL-backed traces, the integration is live.

## Core Concepts

### Raw Memory (PostgreSQL)

Every action gets logged with full context:

```typescript
{
  event_id: "evt_123",
  event_type: "agent_decision",
  agent_id: "code_assistant",
  group_id: "project_alpha",
  metadata: { decision: "chose_JWT", alternatives: ["OAuth2", "Session"] },
  timestamp: "2026-03-16T12:00:00Z"
}
```

### Semantic Memory (Neo4j)

High-confidence insights get promoted:

```cypher
(:Insight {
  insight_id: "ins_456",
  summary: "JWT auth preferred for stateless microservices",
  confidence: 0.85,
  trace_ref: "events:evt_123",  // Links back to evidence
  version: 1
})<-[:CURRENT_VERSION]-(:InsightHead)
```

### Ralph Loop

Self-correcting execution loop:

```
while (shouldContinue()) {
  perception = perceive()
  plan = plan(perception)
  output = act(plan)
  if (check(output)) break
  adapt()
}
```

**Bounded by:**
- Kmax: Maximum steps (prevents infinite loops)
- Budget: Token/tool call limits
- Circuit Breaker: Stops cascade failures

### ADAS (Automated Design of Agent Systems)

Tests new agent configurations in sandbox:

1. Generate candidate design
2. Evaluate in Docker sandbox
3. Score (accuracy, cost, latency)
4. Promote if confidence ≥ 0.7

### ADR (Agent Decision Records)

Five-layer audit trail:

1. **Action** — What was decided
2. **Context** — Why it mattered
3. **Reasoning** — How it was analyzed
4. **Counterfactuals** — What else was considered
5. **Oversight** — Who approved it

## Project Structure

```
src/
├── app/                    # Next.js App Router pages and layouts
├── components/ui/          # shadcn/ui component library
├── curator/                # Knowledge promotion pipeline, HITL curation
│   ├── approval-sync.service.ts   # Sync approvals to Notion
│   ├── curator.service.ts          # Promotion orchestrator
│   ├── deduplication.ts            # Entity deduplication (embedding + Levenshtein)
│   ├── lifecycle-validator.ts      # Insight state machine
│   └── notion-payloads.ts          # Notion page/metadata builders
├── integrations/           # External service clients
│   ├── notion.client.ts     # Notion workspace client
│   ├── neo4j.client.ts     # Neo4j driver management
│   ├── postgres.client.ts  # PostgreSQL pool management
│   └── mcp.client.ts       # MCP server client
├── lib/
│   ├── adas/                # Automated Design of Agent Systems
│   │   ├── evaluation-harness.ts  # Design evaluation in sandbox
│   │   ├── metrics.ts             # Accuracy, cost, latency scoring
│   │   └── types.ts               # Design, candidate, evaluation types
│   ├── agents/              # Agent registry, lifecycle, lineage
│   │   ├── lifecycle.ts           # State machine (Draft → Testing → Active)
│   │   ├── lineage.ts             # Version tracking with SUPERSEDES
│   │   ├── confidence.ts          # Usage-based confidence scoring
│   │   ├── discovery.ts           # Agent search and retrieval
│   │   ├── archive.ts             # Agent retirement and archival
│   │   └── mirror.ts              # Notion registry mirroring
│   ├── circuit-breaker/     # Cascade failure prevention
│   │   ├── breaker.ts              # State machine (CLOSED → OPEN → HALF_OPEN)
│   │   ├── alerting.ts             # Threshold-based alerts
│   │   └── manager.ts             # Multi-breaker orchestration
│   ├── notion/               # Notion sync and drift detection
│   │   ├── client.ts               # Notion API client
│   │   ├── templates.ts           # Page/database templates
│   │   ├── design-sync.ts         # Design → Notion sync
│   │   └── sync-monitor.ts        # Drift detection
│   ├── postgres/             # Raw memory (events, outcomes, traces)
│   │   ├── connection.ts           # Pool management, server-only check
│   │   └── queries/               # Event/outcome CRUD
│   ├── neo4j/                # Semantic memory (insights, knowledge graph)
│   │   └── queries.ts               # Insight versioning, SUPERSEDES edges
│   ├── ralph/                # Self-correcting execution loops
│   │   └── loop.ts                 # Perceive → Plan → Act → Check → Adapt
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
│   └── memory-server.ts      # MCP protocol server
├── server/                   # Next.js server actions
├── stores/                   # Zustand client state
├── hooks/                    # Custom React hooks
└── shared/                   # Shared types and utilities

postgres-init/
└── 01-sync-tables.sql       # PostgreSQL schema initialization

src/__tests__/
├── e2e-integration.test.ts        # Full system integration
└── behavioral-stress.test.ts     # Cognitive kernel validation

.agents/                     # BMAD agent definitions
.agents/skills/              # Agent skills (memory, notion integration)
.opencode/                    # OpenCode AI agent configuration
```

## Test Coverage

| Epic | Description | Tests | Status |
|------|-------------|-------|--------|
| 1 | Persistent Knowledge Capture | 255+ | ✅ Complete |
| 2 | ADAS Discovery Pipeline | 255+ | ✅ Complete |
| 3 | Governed Runtime | 520+ | ✅ Complete |
| 4 | Integration & Sync Pipeline | 700+ | ✅ Complete |
| 5 | Notion Integration Hardening | 100+ | ✅ Complete |
| 6 | Agent Persistence & Lifecycle | 83+ | ✅ Complete |

**Total: 1854 tests passing**

## Behavioral Tests

Beyond unit tests, these validate the cognitive kernel:

1. **Ralph Loop Self-Correction** — Fails first, retries, succeeds
2. **Raw-to-Semantic Promotion** — Noisy data → clean insights
3. **ADAS Discovery** — Sandbox evaluation, design promotion
4. **Auditability** — "Why did you choose X instead of Y?"
5. **Deduplication** — Merge duplicate entities intelligently
6. **Cross-Epic Integration** — Full pipeline traceability
7. **Agent Lifecycle** — Draft → Testing → Active → Deprecated → Archived state transitions
8. **Notion Sync Drift** — Detects and reports desynchronization

Run with: `RUN_E2E_TESTS=true npm test`

## API Examples

### Store an Event

```typescript
import { insertEvent } from './lib/postgres/queries';

await insertEvent({
  group_id: 'project_alpha',
  event_type: 'agent_action',
  agent_id: 'code_assistant',
  workflow_id: 'feature_build',
  metadata: { action: 'created_file', path: 'src/auth.ts' },
  status: 'completed'
});
```

### Create an Insight

```typescript
import { insertInsight } from './lib/neo4j/queries';

await insertInsight({
  insight_id: 'ins_789',
  group_id: 'project_alpha',
  summary: 'TypeScript strict mode catches 40% more bugs',
  confidence: 0.82,
  trace_ref: 'events:evt_123',
  entities: ['TypeScript', 'ESLint']
});
```

### Run a Ralph Loop

```typescript
import { RalphLoop } from './lib/ralph/loop';

const loop = new RalphLoop(sessionId, input, completionPromise, {
  maxIterations: 10,
  kmax: 15,
  enableSelfCorrection: true
}, {
  act: async (input, plan, iteration) => {
    // Your agent logic here
    return result;
  }
});

const result = await loop.execute();
```

## Key Design Decisions

| Decision | Rationale |
|----------|-----------|
| Dual Memory | Raw logs for debugging, insights for reuse |
| Versioned Insights | Never overwrite — new version supersedes old |
| Trace References | Every insight links back to evidence |
| Bounded Autonomy | Kmax + budget + circuit breakers = safety |
| Five-Layer ADR | Full audit trail for compliance |
| Docker Sandboxing | ADAS designs can't escape isolation |
| File-First Agents | Agent definitions created as files, not containers; Docker only for execution |
| HITL Agent Approval | Agents require human approval before activation |

## Lessons Learned

1. **Neo4j Integers** — Always use `.toNumber()` on Integer fields, use `neo4jInt()` for LIMIT/SKIP
2. **Ralph Loop Efficiency** — One story per iteration, clear completion promises
3. **Circuit Breaker States** — CLOSED → OPEN → HALF_OPEN state machine
4. **PostgreSQL Test Setup** — `initializeSchema()` in beforeAll, `closePool()` in afterAll
5. **Deduplication** — Embedding similarity + Levenshtein distance for entity matching
6. **Agent Lifecycle** — Draft → Testing → Active → Deprecated → Archived; state transitions must be explicit
7. **Notion Sync** — Tags property overloaded causes drift; use separate page property fields
8. **Agent Promotion** — Requires HITL approval; automatic promotion only after human sign-off
9. **Agent Creation** — File-first (no Docker); Docker only for sandboxed/untrusted code execution

## Contributing

1. Write tests first (TDD)
2. All code goes through Ralph Loop pattern
3. Every decision logged to ADR
4. PR must pass all 1854 tests

## License

MIT
