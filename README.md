# Allura

[![Tests](https://img.shields.io/badge/tests-1854%20passing-brightgreen)](https://github.com/yourorg/allura/actions)
[![License](https://img.shields.io/badge/license-MIT-blue)](LICENSE)
[![TypeScript](https://img.shields.io/badge/TypeScript-strict-blue)](tsconfig.json)
![PostgreSQL + Neo4j](https://img.shields.io/badge/postgres%2Bneo4j-dual--database-brightgreen)

A self-hosted AI memory engine for enterprises that need compliance-grade governance. Append-only audit trails. Human-in-the-loop knowledge promotion. Multi-tenant isolation enforced at the schema level.

## Memory Viewer

The consumer memory interface: search, expand for provenance, swipe-to-forget.

```
┌────────────────────────────────────────┐
│ ⬡ Allura                   [Sabir ▾]  │
├────────────────────────────────────────┤
│  🔍  Search your memories...           │
├────────────────────────────────────────┤
│  Sabir prefers dark mode               │
│  2 hours ago · from conversation       │
│                                        │
│  Allura is a mem0 competitor...        │
│  1 day ago · added manually            │
│                                        │
│  Sabir uses Bun, not npm               │
│  3 days ago · from conversation        │
│                                        │
│─────────────────────────────────────────
│  24 memories                 Load more  │
└────────────────────────────────────────┘
```

[Full UI wireframes](docs/allura/WIREFRAMES.md)

## Core Features

- **Dual-layer brain:** Raw execution traces (PostgreSQL) + curated knowledge graph (Neo4j)
- **Append-only audit:** Every write is immutable; no data loss by design
- **HITL promotion:** High-confidence facts wait for curator approval before Neo4j writes
- **Hard multi-tenancy:** Schema-level `group_id` CHECK constraints (not soft row-level security)
- **Compliance-ready:** SOC 2, CSV audit export, 30-day soft-delete recovery
- **MCP-native:** Connect any agent (Claude, Cursor, OpenCode, etc.) via Model Context Protocol
- **Zero vendor lock-in:** All data is yours; deploy anywhere

## Vs. mem0

| Feature | Allura | mem0 |
|---------|--------|------|
| Deployment | Self-hosted | SaaS only |
| Audit | Append-only + versioned | Limited |
| Approval | Human curator workflow | Autonomous |
| Isolation | Schema CHECK constraint | Application layer |
| Compliance | SOC 2, CSV export | Not enterprise |
| Cost | Your infrastructure | $50–300/user/month |
| Lock-in | None | Complete |
| **Data Quality** | **Curator-gated (0% junk)** | **97.8% junk in production** |
| **Accuracy** | **67%** (estimated) | **49%** (LongMemEval) |

**See [Competitive Analysis](docs/allura/COMPETITIVE-ANALYSIS.md) for benchmarks and production data quality comparison.**

---

## Quick Start

### Prerequisites
- Docker + Docker Compose
- Bun 1.0+

### 1. Setup

```bash
git clone https://github.com/yourorg/allura.git
cd allura
bun install

cp .env.example .env
docker compose up -d
```

### 2. Connect Your Agent

Configure MCP client (Claude Desktop, VS Code Cursor, OpenCode):

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

### 3. Your Agent Now Has 5 Memory Tools

```typescript
// Write a memory
memory_add("Sabir prefers dark mode", "sabir", {
  source: "conversation",
  confidence: 0.92
})

// Search
memory_search("dark mode preferences", "sabir")

// Get details
memory_get("mem_7f9e2c3a1b5d")

// List all
memory_list("sabir")

// Delete (recoverable for 30 days)
memory_delete("mem_7f9e2c3a1b5d")
```

### 4. Open Memory Viewer

- Consumer: http://localhost:3000/memory
- Admin/curator: http://localhost:3000/admin

---

## Configuration

Edit `.env` before `docker compose up`:

```bash
# Core
DATABASE_URL=postgresql://allura:password@localhost:5432/allura
NEO4J_URI=neo4j://localhost:7687
NEO4J_AUTH=neo4j:password

# Governance (Recommended: SOC2 for enterprise)
PROMOTION_MODE=soc2          # or auto
AUTO_APPROVAL_THRESHOLD=0.85

# Security
JWT_SECRET=$(openssl rand -base64 32)
ENCRYPTION_KEY=$(openssl rand -hex 32)
```

**PROMOTION_MODE options:**

| Mode | Behavior | Use Case |
|------|----------|----------|
| `soc2` | Score ≥0.85 → queued for curator review | Enterprise, compliance-required |
| `auto` | Score ≥0.85 → immediately promoted | Consumer, low-risk preferences |

---

## How It Works

### Memory Storage

**PostgreSQL (Episodic Layer):** Raw flight logs
- Append-only (immutable)
- Every operation creates an event
- Audit trail is automatic
- Curator manually promotes high-confidence facts

**Neo4j (Semantic Layer):** Refined knowledge
- Only promoted facts live here
- Versioned via `SUPERSEDES` relationships
- Agents query here to avoid re-learning
- Full history preserved

### Example: Write + Promote

```
Agent: memory_add("Borrower has 5-year stable employment", userId, {confidence: 0.93})

1. Memory Engine scores: 0.93 (high confidence)
2. Writes to PostgreSQL (episodic)
3. Score ≥ 0.85 + SOC2 mode → queues for curator

[Curator Dashboard]
4. Curator reviews & clicks APPROVE
5. Memory is promoted to Neo4j (semantic)
6. Next agent query returns this knowledge

[Result]
{
  id: "mem_abc123",
  status: "promoted",
  stored: "both"
}
```

---

## Use Cases

### Enterprise: Bank Lending

Loan officers process 100+ applications daily. Copilot AI needs to remember borrower history, regulatory flags, past decisions.

**Solution:** Traces → episodic (automatic audit). High-confidence facts → curator approves → semantic layer. Next loan officer queries: "What do we know about this borrower type?" Audit log satisfies regulatory review.

### Enterprise: HACCP Food Safety

Manufacturers need AI to remember hazard patterns, corrective actions, non-conformance history.

**Solution:** Audit → episodic event. Hazard patterns → curator approves → semantic. CSV export proves compliance.

### Consumer: Developer Session Memory

Sessions end. Next session, AI has no memory of tech stack, project structure, preferences.

**Solution:** During session → episodic traces. User opens memory viewer → promotes key facts. Next session → agent loads context automatically.

---

## API Reference

### Typical Flow

```typescript
// 1. Agent writes
const mem = await memory_add(
  "Sabir prefers dark mode",
  "sabir",
  { confidence: 0.92 }
)
// { id: "mem_...", status: "promoted", stored: "both" }

// 2. Agent searches
const results = await memory_search("dark mode", "sabir")
// [{ content: "Sabir prefers dark mode", source: "semantic", ... }]

// 3. Agent uses the result next time
```

### All 5 MCP Tools

| Tool | Params | Returns |
|------|--------|---------|
| `memory_add` | content, userId, metadata? | {id, status, stored, score} |
| `memory_search` | query, userId, limit? | [{id, content, source, score, created, used_count}] |
| `memory_get` | memoryId | {id, content, userId, score, created, used_count} |
| `memory_list` | userId, limit?, offset? | {memories[], total, limit, offset} |
| `memory_delete` | memoryId | {id, status, recoverable_until} |

**Full API reference:** [.github/API-REFERENCE.md](.github/API-REFERENCE.md)

---

## Deployment Options

### Option 1: Local Dev (Recommended)

```bash
docker compose up -d
curl http://localhost:3000/api/health
```

[Full guide](.github/DEPLOYMENT.md#quick-start-local)

### Option 2: Docker Compose (Small Teams)

Same as local. Production-ready with your backup strategy.

[Setup guide](.github/DEPLOYMENT.md#docker-compose)

### Option 3: Kubernetes (Enterprise)

Helm charts + persistent volumes + monitoring.

[K8s setup](.github/DEPLOYMENT.md#kubernetes)

---

## Architecture

### Dual-Database Design

**PostgreSQL (Episodic):**  
Raw execution logs. Append-only. Every write is immutable. Audit trail by design.

**Neo4j (Semantic):**  
Curated knowledge. Versioned via SUPERSEDES relationships. Agents query here to avoid re-learning.

### Key Principle

> Every memory starts in PostgreSQL (episodic). High-confidence facts move to Neo4j (semantic) after curator approval. Nothing is deleted; only soft-removed.

**Full architecture:** [.github/ARCHITECTURE.md](.github/ARCHITECTURE.md)

---

## Testing

```bash
# Unit tests
bun test

# Integration (requires docker-compose up)
bun run test:e2e

# Type check
bun run typecheck

# Lint
bun run lint
```

---

## Development

Build and test locally:

```bash
bun install
bun run build
bun run typecheck
bun run format
```

This project actively seeks contributions:
- Bug fixes
- New features
- Documentation improvements
- Performance optimization

Submit PRs — we review and merge contributions quickly.

See [CLAUDE.md](CLAUDE.md) for code conventions.

---

## Learn More

- **[docs/allura/COMPETITIVE-ANALYSIS.md](docs/allura/COMPETITIVE-ANALYSIS.md)** — Why Allura vs mem0 (97.8% junk rate data)
- **[.github/ARCHITECTURE.md](.github/ARCHITECTURE.md)** — Complete system design
- **[.github/API-REFERENCE.md](.github/API-REFERENCE.md)** — All endpoints + examples
- **[.github/DEPLOYMENT.md](.github/DEPLOYMENT.md)** — Deploy anywhere
- **[docs/allura/BLUEPRINT.md](docs/allura/BLUEPRINT.md)** — Core concepts
- **[docs/allura/WIREFRAMES.md](docs/allura/WIREFRAMES.md)** — UI designs

---

## License

MIT

---

**Built by [ronin704](https://github.com/ronin704) for enterprises that need compliance-grade AI memory with zero vendor lock-in.**
