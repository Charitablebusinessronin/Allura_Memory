# roninmemory

> **Persistent memory infrastructure for the Allura AI ecosystem.**  
> The shared data layer — Neo4j knowledge graphs, PostgreSQL structured memory, and MCP tool access — that powers every agent in [roninclaw](https://github.com/Charitablebusinessronin/roninclaw).

---

## What This Is

`roninmemory` is the **memory backbone** of the Allura agent system. It is not an agent itself — it is the infrastructure that agents read from and write to. Every autonomous agent in the Allura ecosystem (Paperclip, OpenClaw, AgentBreeder, and the Ronin Coordinator) depends on the services this repo provides to persist context, recall prior decisions, and grow smarter over time.

The stack is an opinionated assembly of proven open-source tools — Neo4j, PostgreSQL, the Neo4j MCP server, and a custom Next.js research frontend. The orchestration, configuration, naming conventions, agent memory schema, and overall integration design are the work of **Sabir Asheed**.

---

## Memory Architecture

```
┌──────────────────────────────────────────────────────────────┐
│                    ALLURA MEMORY LAYER                       │
│                     (roninmemory)                            │
├───────────────────────┬──────────────────────────────────────┤
│   GRAPH MEMORY        │   STRUCTURED MEMORY                  │
│                       │                                      │
│  Neo4j (port 7687)    │  PostgreSQL (port 5432)              │
│  ─────────────────    │  ──────────────────────              │
│  • Entity nodes       │  • Conversation logs                 │
│  • Relationship edges │  • Task history                      │
│  • Project context    │  • Agent state snapshots             │
│  • Skill knowledge    │  • Structured metadata               │
│  • Agent memories     │                                      │
│                       │  pgvector extension for              │
│  Neo4j Browser        │  semantic embedding search           │
│  (port 7474)          │                                      │
├───────────────────────┴──────────────────────────────────────┤
│                    MCP ACCESS LAYER                          │
│                                                              │
│  Neo4j MCP Server (port 3001)                                │
│  Exposes graph read/write as MCP tools to any agent          │
│  Compatible with Claude, OpenCode, Agent Zero, and any       │
│  MCP-capable client                                          │
├──────────────────────────────────────────────────────────────┤
│                    OBSERVABILITY                              │
│                                                              │
│  Dozzle (port 9999) — real-time Docker log viewer            │
└──────────────────────────────────────────────────────────────┘
```

---

## Services

| Service | Port(s) | Description |
|---|---|---|
| **Neo4j** | `7687` (Bolt), `7474` (Browser) | Graph database — primary knowledge store |
| **PostgreSQL** | `5432` | Relational memory + pgvector embeddings |
| **Neo4j MCP Server** | `3001` | Exposes Neo4j as MCP tools for AI agents |
| **Dozzle** | `9999` | Docker log viewer for observability |
| **Research Frontend** | `3000` (dev) | Next.js app for memory inspection and query |

---

## Repository Structure

```
roninmemory/
├── src/                    # Next.js application (research frontend)
├── agent/                  # Agent prompts and memory instructions
├── config/                 # Service configuration files
├── docker/                 # Docker-specific configs per service
├── docs/                   # Architecture docs and guides
├── memory-bank/            # Markdown-based agent memory bank
├── postgres-init/          # PostgreSQL initialization SQL
├── scripts/                # Dev and ops helper scripts
├── templates/              # Memory prompt templates
├── tests/                  # Test suite (Vitest)
├── workflow/               # Workflow definitions
├── archive/                # Archived experiments
├── backups/                # Backup artifacts
├── docker-compose.yml      # Primary service orchestration
├── Dockerfile              # Research frontend image
├── Dockerfile.mcp          # Neo4j MCP server image
├── Dockerfile.researcher   # Researcher agent image
├── package.json            # Node/Bun project manifest
├── AGENTS.md               # AI agent instructions for this repo
├── AI-GUIDELINES.md        # AI coding guidelines
└── opencode.json           # OpenCode AI tool config
```

---

## Prerequisites

- **Docker** and **Docker Compose** (v2+)
- **Node.js 20+** or **Bun** (for the frontend)
- Ports `7474`, `7687`, `5432`, `3001`, `9999` available on your machine

---

## Getting Started

### 1. Clone the repo

```bash
git clone https://github.com/Charitablebusinessronin/roninmemory.git
cd roninmemory
```

### 2. Configure environment

```bash
cp .env.example .env
# Edit .env — set passwords for Neo4j and PostgreSQL
```

### 3. Start infrastructure

```bash
docker compose up -d
```

This brings up Neo4j, PostgreSQL, the MCP server, and Dozzle.

### 4. Verify services

| Check | URL |
|---|---|
| Neo4j Browser | http://localhost:7474 |
| Dozzle (logs) | http://localhost:9999 |
| MCP Server health | http://localhost:3001 |

### 5. Start the research frontend

```bash
npm install   # or: bun install
npm run dev   # or: bun dev
```

Frontend runs at http://localhost:3000.

---

## Integration with roninclaw

`roninmemory` is a **required dependency** of [roninclaw](https://github.com/Charitablebusinessronin/roninclaw). Always start roninmemory first.

```bash
# In roninmemory/ — start memory layer first
docker compose up -d

# Then in roninclaw/ — start the agent layer
docker compose up -d
```

Agents in roninclaw connect to:
- **Neo4j Bolt**: `bolt://localhost:7687`
- **PostgreSQL**: `postgresql://localhost:5432`
- **MCP Server**: `http://localhost:3001`

---

## Memory Schema

Neo4j stores agent memory as a knowledge graph. Core node types:

| Node Label | Purpose |
|---|---|
| `Project` | Top-level project context |
| `Task` | Individual tasks within a project |
| `Decision` | Recorded architectural/design decisions |
| `Skill` | Agent capabilities and learned behaviors |
| `Entity` | People, systems, and concepts |
| `Memory` | Episodic agent memories with timestamps |

Relationships connect these nodes to form a navigable graph of context that agents can query with Cypher.

---

## AI Agent Guidelines

See [`AGENTS.md`](./AGENTS.md) for instructions for AI coding agents working in this repo, and [`AI-GUIDELINES.md`](./AI-GUIDELINES.md) for the broader coding standards and conventions that apply.

---

## Tech Stack

| Layer | Technology |
|---|---|
| Graph database | Neo4j 5 |
| Relational + vector | PostgreSQL 16 + pgvector |
| MCP server | `@neo4j/neo4j-mcp-server` |
| Research frontend | Next.js 14, TypeScript |
| Runtime | Bun / Node.js |
| Container orchestration | Docker Compose |
| Log observability | Dozzle |
| Testing | Vitest |

---

## Acknowledgements

This project is an integration layer built on top of exceptional open-source software:

- [**Neo4j**](https://neo4j.com/) — graph database engine
- [**PostgreSQL**](https://www.postgresql.org/) — relational database
- [**pgvector**](https://github.com/pgvector/pgvector) — vector similarity search for Postgres
- [**neo4j-mcp-server**](https://github.com/neo4j-contrib/neo4j-mcp) — MCP protocol adapter for Neo4j
- [**Next.js**](https://nextjs.org/) — React framework for the research frontend
- [**Dozzle**](https://dozzle.dev/) — Docker log viewer
- [**Bun**](https://bun.sh/) — JavaScript runtime and package manager
- [**Vitest**](https://vitest.dev/) — unit testing framework
- [**Model Context Protocol (MCP)**](https://modelcontextprotocol.io/) — Anthropic's open standard for tool-use in AI systems

The **orchestration, agent memory schema, integration design, and Allura ecosystem context** were created by **Sabir Asheed**.

---

## License

MIT — see [LICENSE](./LICENSE).

Copyright © 2025 Sabir Asheed. The integration, configuration, and original work in this repository are licensed under MIT. Bundled open-source components retain their own licenses.
