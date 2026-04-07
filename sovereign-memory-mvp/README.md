# Sovereign Memory MVP

> **Self-hosted, Docker-native memory layer for AI agents with HITL governance.**

---

## What Is This?

**Sovereign Memory MVP** is a competitor to [mem0](https://mem0.ai) with three key differentiators:

1. **HITL Governance** — Human approval required for knowledge promotion
2. **Immutable Audit Trail** — Append-only PostgreSQL + SUPERSEDES Neo4j
3. **Cloud-Optional** — Run anywhere: bare metal, cloud, hybrid

---

## Quick Start

### Prerequisites

- Docker Desktop or Docker Engine 20.10+
- 4GB RAM minimum
- Ports 3000, 3001, 5432, 7474, 7687 available

### One-Command Deploy

```bash
# Clone and start
git clone https://github.com/your-org/sovereign-memory.git
cd sovereign-memory
docker compose -f sovereign-memory-mvp/docker-compose.yml up -d

# Check health
curl http://localhost:3000/health

# Open Paperclip dashboard
open http://localhost:3001
```

### Environment Variables

Create `.env` in project root:

```env
# PostgreSQL
POSTGRES_USER=sovereign
POSTGRES_PASSWORD=change-me-in-production
POSTGRES_DB=memory

# Neo4j
NEO4J_PASSWORD=change-me-in-production

# MCP Server
MCP_PORT=3000

# Paperclip Dashboard
NEXTAUTH_URL=http://localhost:3001
NEXTAUTH_SECRET=generate-with-openssl-rand-base64-32
```

---

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    SOVEREIGN MEMORY MVP                      │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  ┌──────────────┐     ┌──────────────┐     ┌──────────────┐ │
│  │   Raw Trace  │────▶│  Promotion   │────▶│   Knowledge  │ │
│  │  (PostgreSQL)│     │     Gate     │     │   (Neo4j)    │ │
│  │              │     │   (HITL)     │     │              │ │
│  │  Append-only │     │              │     │  SUPERSEDES  │ │
│  │  Episodic    │     │  Curator     │     │  Immutable   │ │
│  └──────────────┘     └──────────────┘     └──────────────┘ │
│         │                    │                    │         │
│         │                    ▼                    │         │
│         │           ┌──────────────┐             │         │
│         │           │   Paperclip  │             │         │
│         │           │  Dashboard   │             │         │
│         │           │  (Approval)  │             │         │
│         │           └──────────────┘             │         │
│         │                                         │         │
│         ▼                                         ▼         │
│  ┌──────────────────────────────────────────────────────┐  │
│  │                    MCP Server                         │  │
│  │              (Model Context Protocol)                 │  │
│  │                                                       │  │
│  │  Tools: add_trace, search_knowledge, promote, audit  │  │
│  └──────────────────────────────────────────────────────┘  │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

---

## MCP Tools

### `add_trace`

Add a raw event to PostgreSQL.

```typescript
await mcp.call('add_trace', {
  group_id: 'allura-faith-meats',
  event_type: 'skill:brainstorming:start',
  payload: { topic: 'HACCP compliance' }
});
```

### `search_knowledge`

Search curated knowledge in Neo4j.

```typescript
const results = await mcp.call('search_knowledge', {
  group_id: 'allura-faith-meats',
  query: 'workflow preferences'
});
```

### `propose_insight`

Propose a trace for promotion to knowledge.

```typescript
await mcp.call('propose_insight', {
  trace_id: 'uuid-of-trace',
  insight_type: 'pattern',
  content: { summary: 'User prefers structured workflows' }
});
```

### `approve_proposal`

Approve a proposal (HITL gate).

```typescript
await mcp.call('approve_proposal', {
  proposal_id: 'uuid-of-proposal',
  reviewed_by: 'human-operator'
});
```

### `reject_proposal`

Reject a proposal.

```typescript
await mcp.call('reject_proposal', {
  proposal_id: 'uuid-of-proposal',
  reviewed_by: 'human-operator',
  reason: 'Insufficient evidence'
});
```

### `get_audit_trail`

Get audit trail for a tenant.

```typescript
const trail = await mcp.call('get_audit_trail', {
  group_id: 'allura-faith-meats',
  limit: 100
});
```

### `list_pending_proposals`

List proposals awaiting review.

```typescript
const proposals = await mcp.call('list_pending_proposals', {
  group_id: 'allura-faith-meats'
});
```

---

## Comparison to mem0

| Feature | Sovereign Memory MVP | mem0 |
|---------|---------------------|------|
| **Deployment** | Docker-native, self-hosted | Cloud-first |
| **Versioning** | SUPERSEDES lineage | In-place updates |
| **Governance** | HITL required | Auto-add |
| **Audit Trail** | Append-only PostgreSQL | Timestamps only |
| **Tenant Isolation** | Schema-level CHECK | Application-level |
| **Protocol** | MCP (standard) | Custom API |
| **Cloud-Optional** | ✅ Yes | ❌ No |

---

## Development

### Local Setup

```bash
# Install dependencies
bun install

# Start databases
docker compose -f sovereign-memory-mvp/docker-compose.yml up -d postgres neo4j

# Run MCP server locally
bun run dev:mcp

# Run Paperclip locally
bun run dev:paperclip
```

### Testing

```bash
# Run all tests
bun test

# Run specific test
bun test src/mcp/memory-server.test.ts
```

---

## License

MIT

---

## Support

- **Issues:** [GitHub Issues](https://github.com/your-org/sovereign-memory/issues)
- **Docs:** [Full Documentation](./docs/sovereign-memory-mvp/PROJECT.md)
- **Community:** [Discussions](https://github.com/your-org/sovereign-memory/discussions)