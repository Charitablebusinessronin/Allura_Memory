# Allura: Enterprise AI Governance + Consumer Memory

![Tests](https://img.shields.io/badge/tests-1854%20passing-brightgreen)
![License](https://img.shields.io/badge/license-MIT-blue)
![TypeScript](https://img.shields.io/badge/TypeScript-strict-blue)
![Architecture](https://img.shields.io/badge/postgres%2Bneo4j-dual--database-brightgreen)

**Allura is a sovereign, self-hosted AI memory and governance engine.** It's the mem0 alternative for organizations that need compliance-grade audit trails, human-in-the-loop promotion workflows, and multi-tenant isolation enforced at the schema level — not application code.

---

## Table of Contents

- [Why Allura?](#why-allura)
- [How It Works](#how-it-works)
- [Quick Start](#quick-start)
- [Use Cases](#use-cases)
- [API Reference](#api-reference)
- [Architecture](#architecture)
- [Deployment](#deployment)
- [Governance](#governance)
- [Contributing](#contributing)

---

## Why Allura?

| Feature | Allura | mem0 |
|---------|--------|------|
| **Deployment** | Self-hosted, docker-compose | Cloud SaaS only |
| **Tenant Isolation** | Schema-level CHECK constraints (hard boundary) | Application-layer soft tenancy |
| **Audit Trail** | Append-only PostgreSQL + versioned Neo4j | Limited SaaS audit |
| **Human Approval** | HITL curator workflow for promotion | Autonomous agent writes everywhere |
| **Compliance** | SOC 2 ready, CSV audit export, redaction rules | Not enterprise-grade |
| **Dual-Use** | Enterprise governance + consumer growth | Single use case |
| **Cost** | Self-hosted (your infra) | ~$50-300/user/month |
| **Lock-In** | None (data is yours) | Complete vendor lock-in |

---

## How It Works

Allura separates **what happened** (episodic) from **what we learned** (semantic):

```
AI Agent (Claude, Cursor, OpenClaw, etc.)
        ↓ (MCP Protocol)
┌─────────────────────────────────────┐
│      Memory Engine                  │
│  - Score content                    │
│  - Route to storage                 │
│  - Deduplicate                      │
└──────────┬──────────────────────────┘
           ↓
      ┌────┴─────┐
      ↓          ↓
  PostgreSQL   Neo4j
  (Raw Logs)   (Knowledge Graph)
  Append-only  Versioned w/ SUPERSEDES
  Immutable    Curator-gated promotion
```

**PostgreSQL (Episodic):** Every memory operation creates an immutable row. No UPDATE/DELETE. Audit trail is automatic. Curator manually reviews high-confidence traces and promotes them.

**Neo4j (Semantic):** Only promoted, verified knowledge. All updates create new nodes with `(v2)-[:SUPERSEDES]->(v1)`. Agents query here to avoid re-learning.

---

## Quick Start

### Prerequisites
- Docker + Docker Compose
- Bun (zero-trust Node.js runtime, no npm)
- PostgreSQL 16 + Neo4j 5.26 (included in docker-compose)

### 1. Setup

```bash
git clone https://github.com/yourorg/allura.git
cd allura

# Install dependencies (Bun only)
bun install

# Copy environment template
cp .env.example .env
# Edit .env with your settings
```

### 2. Start Infrastructure

```bash
docker compose up -d
```

Starts:
- **PostgreSQL** on 5432
- **Neo4j** on 7687 (Bolt)
- **MCP Server** (listening for agent connections)

### 3. Health Check

```bash
curl http://localhost:3000/api/health
# { "status": "ok", "postgres": "connected", "neo4j": "connected" }
```

### 4. Connect Your Agent

Configure your MCP client (Claude Desktop, VS Code Cursor, or OpenCode):

```json
{
  "mcpServers": {
    "allura": {
      "command": "bun",
      "args": ["run", "src/mcp/memory-server.ts"]
    }
  }
}
```

Now your agent has 5 memory tools:
- `memory_add(content, userId, metadata?)` — Write
- `memory_search(query, userId)` — Semantic search
- `memory_get(memoryId)` — Fetch by ID
- `memory_list(userId)` — All memories for user
- `memory_delete(memoryId)` — Soft-delete (recoverable)

### 5. Open Memory Viewer

Consumer view: `http://localhost:3000/memory`  
Enterprise admin: `http://localhost:3000/admin`

---

## Use Cases

### 1. Enterprise: Bank Lending

**Problem:** Loan officers process 100+ applications daily. Need to remember borrower financial history, regulatory flags, and past decisions.

**Allura:**
- Conversation → episodic trace (append-only)
- High-confidence facts → curator reviews → Neo4j
- Next loan officer queries: "What do we know about this borrower type?"
- Audit log proves regulatory compliance

### 2. Enterprise: HACCP Food Safety

**Problem:** Manufacturers need AI to remember hazard patterns, corrective actions, and non-conformance history.

**Allura:**
- HACCP audit → episodic event
- Hazard patterns → curator approves → semantic knowledge
- Next audit: "Have we seen this risk? What mitigated it?"
- CSV export proves traceability

### 3. Consumer: OpenClaw Session Memory

**Problem:** Sessions end. Next session, AI has no memory of tech stack, preferences, or project structure.

**Allura:**
- During session: traces stored episodically
- User opens memory viewer: "What should I remember?"
- User (or curator) promotes facts to semantic layer
- Next session: Agent loads context automatically

---

## API Reference

### MCP Tools (Agent Interface)

#### `memory_add` — Write a memory

```typescript
// Request
{
  "content": "Sabir prefers dark mode and uses Bun instead of npm",
  "userId": "sabir",
  "metadata": {
    "source": "conversation",
    "context": "IDE setup discussion",
    "confidence": 0.92
  }
}

// Response (SOC2 mode)
{
  "id": "mem_7f9e2c3a1b5d",
  "status": "pending_review",
  "stored": "episodic",
  "message": "High-confidence memory queued for curator approval"
}

// Response (auto mode)
{
  "id": "mem_7f9e2c3a1b5d",
  "status": "promoted",
  "stored": "both",
  "message": "Memory stored in PostgreSQL and Neo4j"
}
```

#### `memory_search` — Federated search

```typescript
// Request
{
  "query": "dark mode preferences",
  "userId": "sabir",
  "limit": 10
}

// Response
[
  {
    "id": "mem_7f9e2c3a1b5d",
    "content": "Sabir prefers dark mode",
    "source": "semantic",
    "score": 0.96,
    "created": "2 hours ago",
    "used_count": 3
  },
  {
    "id": "evt_a1b2c3d4e5f6",
    "content": "IDE theme set to dark (VS Code)",
    "source": "episodic",
    "score": 0.87,
    "created": "2 weeks ago"
  }
]
```

#### `memory_get` — Fetch by ID

```typescript
// Request
{ "memoryId": "mem_7f9e2c3a1b5d" }

// Response
{
  "id": "mem_7f9e2c3a1b5d",
  "content": "Sabir prefers dark mode",
  "score": 0.92,
  "created": "2026-04-07T06:30:00Z",
  "source": "conversation",
  "context": "IDE setup discussion",
  "used_count": 3
}
```

#### `memory_list` — All memories for a user

```typescript
// Request
{ "userId": "sabir", "limit": 25, "offset": 0 }

// Response
{
  "memories": [ ... ],
  "total": 247,
  "limit": 25,
  "offset": 0
}
```

#### `memory_delete` — Soft-delete (recoverable for 30 days)

```typescript
// Request
{ "memoryId": "mem_7f9e2c3a1b5d" }

// Response
{
  "id": "mem_7f9e2c3a1b5d",
  "status": "deleted",
  "recoverable_until": "2026-05-08T06:30:00Z"
}
```

---

## Architecture

### Data Model

**PostgreSQL `events` table (append-only):**

```sql
CREATE TABLE events (
  id BIGSERIAL PRIMARY KEY,
  group_id VARCHAR(255) NOT NULL CHECK (group_id ~ '^allura-'),
  event_type VARCHAR(100) NOT NULL,
  agent_id VARCHAR(255) NOT NULL,
  status VARCHAR(50) DEFAULT 'completed',
  metadata JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

**Neo4j `Memory` node (versioned):**

```cypher
(m:Memory {
  id: "mem_7f9e2c3a1b5d",
  group_id: "allura-myproject",
  content: "Sabir prefers dark mode",
  score: 0.92,
  deprecated: false,
  created_at: 2026-04-07T06:30:00Z
})

(m2:Memory)-[:SUPERSEDES]->(m1:Memory)  -- versioning
```

### Core Components

| Component | Responsibility |
|-----------|--------------|
| **MCP Server** | Exposes 5 memory tools to agents |
| **Memory Engine** | Score, route, deduplicate writes |
| **Curator** | HITL approval for promotion |
| **PostgreSQL** | Episodic memory (immutable) |
| **Neo4j** | Semantic memory (versioned) |
| **Dashboard** | Consumer + admin views |

Full architecture details: [docs/allura/BLUEPRINT.md](docs/allura/BLUEPRINT.md)

---

## Deployment

### Docker Compose (Local & Production)

```bash
docker compose up -d
```

### Kubernetes (Enterprise)

See [.github/DEPLOYMENT.md](.github/DEPLOYMENT.md) for Helm charts and persistent volume setup.

### Environment Variables

```bash
# Core
DATABASE_URL=postgresql://postgres:password@localhost:5432/allura
NEO4J_URI=neo4j://localhost:7687
NEO4J_AUTH=neo4j:password

# Governance
PROMOTION_MODE=soc2          # or auto
AUTO_APPROVAL_THRESHOLD=0.85
SOFT_DELETE_RETENTION_DAYS=30

# Security
JWT_SECRET=your-secret-key
ENCRYPTION_KEY=your-encryption-key  # for BYOK

# Optional: Slack notifications for curator
SLACK_WEBHOOK_URL=https://hooks.slack.com/services/...
```

---

## Governance

### Promotion Modes

**SOC2 Mode (Default):**
- Score ≥ 0.85 → queued for curator review
- Requires human approval before Neo4j write
- Zero autonomous agent writes to semantic layer

**Auto Mode (Consumer):**
- Score ≥ 0.85 → immediately promoted to Neo4j
- Suitable for low-stakes preferences (theme, language, etc.)
- All writes still audited to PostgreSQL

### Multi-Tenancy

Hard-enforced isolation via `group_id`:

```sql
-- Missing or invalid group_id causes schema error
ALTER TABLE events
ADD CONSTRAINT group_id_format
CHECK (group_id ~ '^allura-');
```

---

## Documentation

| Doc | Purpose |
|-----|---------|
| **[docs/allura/BLUEPRINT.md](docs/allura/BLUEPRINT.md)** | Core concepts, requirements, execution rules |
| **[docs/allura/SOLUTION-ARCHITECTURE.md](docs/allura/SOLUTION-ARCHITECTURE.md)** | System topologies, interfaces, risk mapping |
| **[docs/allura/DATA-DICTIONARY.md](docs/allura/DATA-DICTIONARY.md)** | Field-level reference |
| **[docs/allura/WIREFRAMES.md](docs/allura/WIREFRAMES.md)** | UI/UX design |
| **[docs/allura/RISKS-AND-DECISIONS.md](docs/allura/RISKS-AND-DECISIONS.md)** | Architectural decisions + known risks |
| **[AI-GUIDELINES.md](AI-GUIDELINES.md)** | Documentation standards |

---

## Testing

```bash
# Unit tests
bun test

# Integration tests (requires docker-compose up)
bun run test:e2e

# Type check
bun run typecheck

# Lint
bun run lint
```

---

## Contributing

We welcome contributions. Before submitting:

1. Read [AI-GUIDELINES.md](AI-GUIDELINES.md)
2. Pass all checks: `bun run typecheck && bun run lint && bun test`
3. Follow [CLAUDE.md](CLAUDE.md) code conventions
4. Include unit tests for any new functionality

---

## License

MIT

---

Built for organizations that need compliance-grade AI memory with zero vendor lock-in.
