# Allura Memory

[![License](https://img.shields.io/badge/license-MIT-blue)](LICENSE)
[![TypeScript](https://img.shields.io/badge/TypeScript-strict-blue)](tsconfig.json)
[![Self-Hosted](https://img.shields.io/badge/deployment-self--hosted-1C232B)](#deployment-options)

**Memory That Shows Its Work**

Allura Memory is a self-hosted AI memory system for teams that want memory they can inspect, review, and manage.

It is built around a simple promise: memory should be **traceable**, **structured**, and **governed** — and the experience of using it should feel considered rather than opaque.

<p align="center">
  <img src="./public/readme/readme-hero.png" alt="Allura Memory hero" width="100%" />
</p>

> Allura is designed for teams that care about visibility, control, and auditability today — and for organizations that may aspire to stricter regulatory or enterprise standards in the future. It does **not** claim current SOC 2 certification, banking approval, or any unverified compliance status.

---

## Brand Direction

For AI builders and technical teams who want memory they can inspect and manage, **Allura is AI memory that draws you in and shows its work** — magnetically inspectable, gracefully structured, and governed by clear operational boundaries.

- **Inspectable** — you can trace what was recorded and why it matters
- **Structured** — memory is organized, not merely accumulated
- **Governed** — review and operator judgment remain central
- **Inviting** — the system is designed to reward a closer look

---

## Visual Direction

Allura’s v2 direction is warmer, softer, and more magnetic than a typical infrastructure product while still grounded in clarity and control.

<p align="center">
  <img src="./public/readme/readme-homepage-options.png" alt="Allura homepage direction options" width="100%" />
</p>

This is not “magic AI.” It is a more legible memory system with a more considered interface.

<p align="center">
  <img src="./public/readme/readme-brand-system.png" alt="Allura brand system direction" width="100%" />
</p>

---

## What Allura Brain Means

Inside the project, “**Allura Brain**” refers to the memory architecture itself:

### Episodic Layer — PostgreSQL
- append-only event history
- high-volume trace capture
- audit trail by design
- raw activity stays reconstructable

### Semantic Layer — Neo4j
- curated knowledge
- version history via `SUPERSEDES`
- promotion gate before durable knowledge writes
- lower-volume, higher-confidence memory

### Core Principle
Every memory starts in the episodic layer. Promoted knowledge moves into the semantic layer **after review**, not before.

This keeps Allura grounded in inspectability rather than black-box automation.

---

## Core Features

- **Dual-layer memory architecture** — PostgreSQL for append-only traces, Neo4j for curated knowledge
- **Append-only audit trail** — memory events remain reconstructable over time
- **Human-in-the-loop promotion** — review can sit between capture and long-term knowledge
- **Multi-tenant boundaries** — `group_id`-based isolation is built into the model
- **Self-hosted deployment** — run it on your own infrastructure
- **MCP-native integration** — connect agents and tools through Model Context Protocol
- **Plugin Harness** — explicit MCP discovery, approval, and routing flow
- **Event logging** — operations are written to PostgreSQL as part of the append-only system trail
- **Portable data posture** — designed to reduce dependence on closed memory silos

---

## What We Claim — And What We Don’t

### We do claim
- Allura is designed around inspectability, structure, and governance
- It uses a dual-layer memory model
- It supports append-only event logging
- It can be self-hosted
- It uses a curator / approval pattern for promoted knowledge flows

### We do **not** claim
- current SOC 2 certification
- banking-grade approval
- zero hallucinations
- flawless accuracy
- autonomous truth without review
- benchmark superiority unless specifically verified

Where the product is directional or still evolving, the project should be described as:
- **designed to**
- **built to support**
- **positioned to help**
- **intended for teams that need**

---

## Directional Positioning vs mem0

Allura is being developed as a more governed, more inspectable alternative in the AI memory space.

Directional differentiation today:

| Dimension | Allura Direction | mem0 Reference Frame |
|-----------|------------------|----------------------|
| Memory posture | inspectable + governed | autonomous memory emphasis |
| Review model | approval-friendly | more automation-oriented |
| Auditability | append-only system trail | less central to positioning |
| Deployment | self-hosted path | commonly seen as managed/SaaS reference |

This is **positioning**, not an absolute superiority claim.

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

Configure MCP client (Claude Desktop, Cursor, OpenCode, etc.):

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

### 3. Memory Tools

```typescript
memory_add("Sabir prefers dark mode", "sabir", {
  source: "conversation",
  confidence: 0.92
})

memory_search("dark mode preferences", "sabir")
memory_get("mem_7f9e2c3a1b5d")
memory_list("sabir")
memory_delete("mem_7f9e2c3a1b5d")
```

### 4. Open the Interfaces

- Memory viewer: `http://localhost:3000/memory`
- Admin / curator: `http://localhost:3000/admin`

---

## Configuration

Edit `.env` before `docker compose up`:

```bash
# Core
DATABASE_URL=postgresql://allura:password@localhost:5432/allura
NEO4J_URI=neo4j://localhost:7687
NEO4J_AUTH=neo4j:password

# Governance
PROMOTION_MODE=soc2
AUTO_APPROVAL_THRESHOLD=0.85

# Security
JWT_SECRET=$(openssl rand -base64 32)
ENCRYPTION_KEY=$(openssl rand -hex 32)
```

### Important note on `PROMOTION_MODE=soc2`

In this codebase, `soc2` is an **internal workflow label** for a stricter review path.

It means:
- higher-confidence items are queued for review
- promotion is gated more conservatively
- the flow is aimed at audit-conscious environments

It does **not** mean the project is currently SOC 2 certified.

### Promotion Modes

| Mode | Behavior | Typical Use |
|------|----------|-------------|
| `soc2` | score ≥ threshold queues for curator review | stricter review workflow |
| `auto` | score ≥ threshold promotes automatically | lower-risk or experimental environments |

---

## How It Works

### Memory Flow

1. An agent writes a memory event
2. The event is stored in PostgreSQL
3. High-confidence items can enter a review queue
4. Approved knowledge is promoted into Neo4j
5. Future queries benefit from the promoted semantic layer

### Example

```text
Agent writes memory
  ↓
PostgreSQL stores append-only event
  ↓
Score + promotion mode evaluated
  ↓
Curator reviews if required
  ↓
Approved knowledge promoted to Neo4j
```

This keeps the system explainable. The goal is not to hide memory work — it is to show it.

---

## Plugin Harness

The Plugin Harness orchestrates MCP servers and skill delegation with **explicit approval**.

### Principles
- no auto-loading
- no silent discovery
- explicit approval before activation
- append-only event logging
- specialist routing over generic execution

### Typical Commands

```bash
/mcp-discover database
/mcp-approve postgresql-mcp
/mcp-load postgresql-mcp
/skill-propose code-review
/skill-load code-review --executor pike-interface-review
```

See:
- `.opencode/PLUGIN-ARCHITECTURE.md`
- `.opencode/HARNESS-TO-CLAUDE-CODE.md`
- `.opencode/HARNESS-QUICKSTART.md`

---

## Use Cases

### 1. Developer Session Memory
When sessions end, useful working context often disappears. Allura helps preserve structured memory that can be reviewed and reused later.

### 2. Internal Team Knowledge Flows
Teams running agents across projects need clearer boundaries, provenance, and continuity across sessions and operators.

### 3. Audit-Conscious Workflows
Organizations that care about traceability today — and may aspire to stricter enterprise or regulated operating standards in the future — can use Allura’s review-oriented model as a more conservative memory workflow.

---

## Deployment Options

### Local Dev

```bash
docker compose up -d
curl http://localhost:3000/api/health
```

### Docker Compose
Suitable for individuals and small teams running self-hosted infrastructure.

### Kubernetes
Available for teams that want to operationalize the stack in a more managed environment.

See: `.github/DEPLOYMENT.md`

---

## Architecture

### PostgreSQL (Episodic)
Raw execution logs and append-only events.

### Neo4j (Semantic)
Curated knowledge with version history via `SUPERSEDES`.

### Key Rule

> Every memory starts in PostgreSQL. Higher-confidence facts may move to Neo4j after review. History is preserved.

See: `.github/ARCHITECTURE.md`

---

## Testing

```bash
# Unit tests
bun test

# E2E / integration
bun run test:e2e

# Type check
bun run typecheck

# Lint
bun run lint
```

Harness-specific references:
- `.opencode/HARNESS-TEST-COMMAND.txt`
- `.opencode/harness/test-e2e.ts`

---

## Development

```bash
bun install
bun run build
bun run typecheck
bun run format
```

Contributions welcome:
- bug fixes
- feature work
- docs improvements
- performance optimization

See `CLAUDE.md` for conventions.

---

## Learn More

### Core Docs
- `.github/ARCHITECTURE.md`
- `.github/API-REFERENCE.md`
- `.github/DEPLOYMENT.md`
- `docs/allura/BLUEPRINT.md`
- `docs/allura/WIREFRAMES.md`

### Harness Docs
- `.opencode/PLUGIN-ARCHITECTURE.md`
- `.opencode/HARNESS-LOGGING-INTEGRATION.md`
- `.opencode/HARNESS-TO-CLAUDE-CODE.md`
- `.opencode/HARNESS-QUICKSTART.md`

### Internal Memory System Context
- `.claude/README.md`

---

## Design Principles

Allura follows a Brooksian approach:

1. **Conceptual integrity**
2. **Explicit approval**
3. **Surgical team specialization**
4. **Separation of concerns**
5. **Append-only audit**
6. **No silver bullet**

**Governance posture:** Allura governs. Runtimes execute. Curators promote.

---

## License

MIT

---

Built by [ronin704](https://github.com/ronin704). Allura is presented as a self-hosted, governance-oriented memory system with a warmer, more magnetic product direction — without making unverified compliance or banking claims.
