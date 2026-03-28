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
| **Superpowers Integration** | Agentic workflows with automatic memory logging |
| **OpenCode Skills** | Custom skill library for memory-first development |

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

### Memory snapshot workflow

Warm up long sessions by building a deterministic doc snapshot and using it to hydrate the MCP session loggers.

```bash
bun run snapshot:build \
  --source docs/roninmemory \
  --source docs/Carlos_plan_framework \
  --output memory-bank \
  --group-id roninmemory \
  --max-summary-chars 600
```

- Inputs: one or more `--source` directories (repeat per root). Output: `memory-bank/index.json` with entries plus `memory-bank/index.meta.json` summarizing hashes, run stats, and append-only ingestion metadata, plus a console summary line showing file count/byte totals.
- Incremental mode (default) reads the metadata file and skips unchanged hashes; use `--no-incremental` to force a rebuild or `--priority-override plan.md` (repeatable glob) to refresh specific docs despite matching hashes.
- Summaries truncate at `--max-summary-chars` characters; `--summary-length` is a backwards-compatible alias. Pair with `--group-id` to stamp tenant ownership and `--output` to target a different cache directory.

Hydrate sessions (PostgreSQL + Neo4j) from the generated snapshot:

```bash
GROUP_ID=roninmemory bun run session:hydrate \
  --snapshot memory-bank/index.json \
  --metadata memory-bank/index.meta.json \
  --concurrency 4 \
  --dry-run
```

- `GROUP_ID` env var is required so the script can enforce tenant isolation when creating session briefings.
- `--snapshot` is the JSON artifact path; `--metadata` defaults to the sibling `.meta.json` when omitted and is used to track append-only ingestion metadata in `memory-bank/ingestion.meta.json` (only new rows append; never mutate history).
- `--concurrency` controls parallel MCP writes; start at 4 and increase only if Neo4j/Postgres can keep up. `--dry-run` logs payloads without writing (ideal for QA or verifying priority overrides).

Troubleshooting:

- Missing snapshot file: ensure `memory-bank/index.json` exists (rerun `bun run snapshot:build`) and double-check your `--output` / `--snapshot` path; hydration exits early with an actionable error if the file is absent.
- Metadata mismatch (e.g., stale group or schema): delete only the generated `memory-bank/index.meta.json` and rerun the builder, or pass `--no-incremental` so hashes rewrite; for ingestion metadata, never edit manually—each hydration appends a new block so audit trails remain intact.

Common overrides:

| Flag | Purpose |
|------|---------|
| `--max-summary-chars` / `--summary-length` | Set/alias summary truncation limit for each document entry. |
| `--priority-override <pattern>` | Force rebuild of entries matching the pattern even if hashes match (repeat as needed). |
| `--concurrency <n>` | Control number of concurrent hydration workers. |
| `--dry-run` | Preview hydration payloads without touching databases. |

This workflow keeps doc ingestion deterministic and append-only so `memory-bank/ingestion.meta.json` always reflects the full history of session briefings.

---

### Superpowers Integration

This project integrates with [Superpowers](https://github.com/obra/superpowers) for agentic development workflows with automatic memory logging.

```bash
# Global Superpowers config at ~/.config/opencode/opencode.json
# Installed via: opencode plugins add superpowers

# Skills with memory integration:
# - brainstorming: Logs session start/end, design decisions
# - writing-plans: Logs plan creation, links to originating spec
# - executing-plans: Logs task execution with commit SHAs
# - subagent-driven-development: Logs subagent dispatches and review outcomes
```

Each skill automatically:
- **Hydrates context** at session start (searches previous work for group/workflow)
- **Logs events** at checkpoints (MCP_DOCKER_insert_data to PostgreSQL)
- **Creates insights** at session end (MCP_DOCKER_create_entities to Neo4j)
- **Verifies writes** before completing

See `.opencode/skills/superpowers-memory/SKILL.md` for complete patterns.

### OpenCode Agent Setup

This repository includes OpenCode agent configuration for memory-first development:

```bash
# Agent configuration
.opencode/agents/roninmemory-project.md    # Primary agent definition
.opencode/skills/                           # Custom skill library
  ├── skill-creator/SKILL.md              # Create new skills
  ├── memory-client/SKILL.md              # Memory system integration
  ├── mcp-docker/SKILL.md               # MCP server discovery
  ├── mcp-docker-memory-system/SKILL.md # Memory system operations
  ├── superpowers-memory/SKILL.md         # Superpowers integration
  └── superpowers-enhanced/*.md           # Enhanced Superpowers skills

# Available agents
opencode agents list                        # List configured agents
opencode agents run roninmemory-project     # Run with agent context
```

**Key skills:**
- `memory-client`: Search, log events, create insights via MCP
- `mcp-docker`: Discover and configure MCP servers dynamically
- `superpowers-memory`: Patterns for logging Superpowers workflows
- `skill-creator`: Standardized skill creation with templates

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
| superpowers/planning/** | Superpowers planning artifacts (load before major builds) |
| README.md | Repo overview + memory usage guide |

---

## Using the memory system

- **Automated session logging**: run `bunx tsx scripts/session-logger.ts --phase start --group <group_id> ...` at session start and again with `--phase end`. The script writes `log_event` entries with standardized metadata (task IDs, files touched, verification commands, notes). Use `--dry-run` to preview payloads.
- **Link events to tasks**: pass `--task <TASK-ID>`, `--files a,b`, and `--verify cmd1,cmd2` so each event references the work performed. This makes `memory_search` results self-explanatory.
- **Promote recurring insights**: after resolving a repeated bug/decision, call `create_insight` and `create_relation` (via MCP) so future sessions surface the knowledge automatically.
- **Group IDs**: use the project slug as `group_id` (for example, `roninmemory`, `openclaw`, or client-specific IDs). Never mix tenant data.
- **Traces vs. insights**: use `log_event` for raw traces (session start/end, verification commands, blockers) and `create_insight` + `create_relation` for curated takeaways worth reusing.
- **Periodic cleanup**: run `scripts/audit-memory-storage.sh` weekly to review raw events, promote important ones to insights, and archive noise. This keeps the graph healthy.

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
 5. Document significant events via MCP tools (`log_event`, `create_insight`, `create_relation`)

---

## License

MIT

---

## Author

Built by [ronin4life](https://github.com/Charitablebusinessronin) for AI agent memory persistence.
