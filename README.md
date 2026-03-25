# Allura's Memory

![Tests](https://img.shields.io/badge/tests-1854%20passing-brightgreen)
![License](https://img.shields.io/badge/license-MIT-blue)
![TypeScript](https://img.shields.io/badge/TypeScript-strict-blue)

**A persistent memory system for AI agents** — separates raw execution traces (PostgreSQL) from curated insights (Neo4j) with human-in-the-loop governance.

**The Problem:** AI agents start every session from zero. They can't remember past decisions, learn from mistakes, or build institutional knowledge.

**The Solution:** A 6-layer memory system that persists agent knowledge with production-grade governance, audit trails, and multi-tenant isolation.

---

## Table of Contents

- [Quick Start](#quick-start)
- [Features](#features)
- [Architecture](#architecture)
- [Installation](#installation)
- [Usage](#usage)
- [API Reference](#api-reference)
- [Testing](#testing)
- [Documentation](#documentation)
- [Contributing](#contributing)
- [License](#license)

---

## Quick Start

```bash
# Clone and install
git clone https://github.com/Charitablebusinessronin/roninmemory.git
cd roninmemory
npm install

# Start databases
docker compose up -d

# Run tests
npm test

# Start MCP server
npm run mcp
```

---

## Features

### Core Capabilities

| Feature | Description |
|---------|-------------|
| **Dual-Layer Persistence** | Raw events in PostgreSQL, curated knowledge in Neo4j |
| **Versioned Insights** | Immutable knowledge with SUPERSEDES relationships |
| **Human-in-the-Loop** | Critical changes require approval before activation |
| **Multi-Tenant Isolation** | group_id prevents cross-project contamination |
| **Audit Trail** | 5-layer Agent Decision Records (ADR) for compliance |
| **MCP Protocol** | Works with Claude Desktop, OpenClaw, MCP-compatible agents |

### Governance Features

- **HITL Approval Gates** - Promote, deprecate, supersede with human review
- **Circuit Breakers** - Halt execution when error rates spike
- **Bounded Autonomy** - Kmax limits, token budgets, time constraints
- **Steel Frame Versioning** - Knowledge lineage with immutable history

---

## Architecture

The system operates across six layers:

    Agent (OpenClaw)
         |
         v
    6. Audit (ADR Layer) - 5-layer decision records
         |
         v
    5. Governance - Policy Gateway, Circuit Breakers, HITL
         |
         v
    4. Discovery (ADAS) - Automated agent design with Ollama + Docker
         |
         v
    3. Control (Ralph Loops) - Perceive/Plan/Act/Check/Adapt
         |
         v
    2. Semantic Memory (Neo4j) <---> 1. Raw Memory (PostgreSQL)
        Versioned Insights                Immutable Traces

---

## Installation

### Prerequisites

- Node.js 18+ or Bun
- Docker (for PostgreSQL + Neo4j)
- 4GB RAM minimum

### Setup

```bash
# Clone
git clone https://github.com/Charitablebusinessronin/roninmemory.git
cd roninmemory

# Install
npm install

# Start databases
docker compose up -d

# Run tests
npm test
```

### Environment

```bash
POSTGRES_PASSWORD=your_password
NEO4J_PASSWORD=your_password
NOTION_API_KEY=optional
```

---

## Usage

### MCP Server (Claude Desktop / OpenClaw)

```json
{
  "mcpServers": {
    "memory": {
      "command": "npx",
      "args": ["tsx", "src/mcp/memory-server.ts"]
    }
  }
}
```

### Library

```typescript
import { storeMemory, searchMemories } from '@/lib/memory';

await storeMemory({
  type: "Insight",
  topic_key: "project.auth.jwt-pattern",
  content: "Use 15-minute token expiration for mobile apps",
  group_id: "myproject",
  confidence: 0.92
});

const results = await searchMemories({
  query: "authentication",
  group_id: "myproject"
});
```

---

## API Reference

### Core Tools

| Tool | Purpose |
|------|---------|
| store_memory | Create versioned knowledge node |
| search_memories | Full-text semantic search |
| get_memory | Retrieve by topic key |
| promote_memory | Draft to Active (HITL) |
| deprecate_memory | Mark deprecated |
| archive_memory | Mark archived |

### Governance Tools

| Tool | Purpose |
|------|---------|
| log_decision | Record ADR with counterfactuals |
| approve_insight | Human approval gate |
| reject_insight | Reject proposed insight |
| supersede_insight | Replace with newer version |

Full API: .skills/memory-management/resources/tool-reference.md

---

## Testing

```bash
# Unit tests
npm test

# E2E integration tests
RUN_E2E_TESTS=true npm test

# Behavioral stress tests
npm run test:e2e
```

Coverage: 1,854+ tests across 6 epics

---

## Documentation

| Document | Purpose |
|----------|---------|
| AGENTS.md | Coding standards, patterns, TypeScript |
| docs/PROJECT.md | Architecture, hiring profile |
| docs/RESUME_SNIPPET.md | Resume summary |
| .skills/ | Skill package for agents |
| memory-bank/ | Persistent context |

---

## Tech Stack

| Layer | Technology |
|-------|-------------|
| Language | TypeScript (strict, ES2022) |
| Runtime | Bun / Node.js |
| Databases | PostgreSQL 16, Neo4j 5.26 + APOC |
| Protocol | Model Context Protocol (MCP) |
| Testing | Vitest |
| CI/CD | GitHub Actions |

---

## Project Structure

```
memory/
  src/
    lib/memory/       # Core operations
    lib/postgres/     # Raw storage
    lib/neo4j/        # Knowledge graph
    lib/ralph/        # Self-correcting loops
    mcp/              # 30+ MCP tools
    curator/          # Promotion pipeline
  .skills/            # Skill package
  memory-bank/        # Context files
  docs/               # Documentation
```

---

## Contributing

1. All code must pass `npm run typecheck`
2. All changes require tests
3. Follow patterns in AGENTS.md
4. Use `group_id` for tenant isolation

---

## License

MIT

---

## Author

Built by [ronin4life](https://github.com/Charitablebusinessronin) for AI agent memory persistence.
