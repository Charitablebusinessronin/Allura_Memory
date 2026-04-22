# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Runtime & Package Manager

**Bun only. npm/npx are banned** (zero-trust supply chain policy).

```bash
bun install
```

## Commands

```bash
# Dev / build
bun run dev               # Next.js dev server (port $PAPERCLIP_PORT, default 3100)
bun run build
bun run start

# Type checking & lint (lint IS typecheck here)
bun run typecheck         # tsc --noEmit
bun run lint              # alias for typecheck

# Tests
bun test                          # all unit tests (vitest run)
bun run test:watch                # watch mode
bun run test:e2e                  # RUN_E2E_TESTS=true, postgres + neo4j required
bun run test:all                  # typecheck + lint + unit + e2e + mcp browser

# Single test
bun vitest run src/lib/postgres/connection.test.ts
bun vitest run -t "should build connection config"

# MCP server
bun run mcp               # MCP server (legacy only)
bun run mcp:dev           # watch mode (legacy only)
bun run mcp:http          # HTTP gateway (legacy only)

# Curator pipeline (HITL promotion)
bun run curator:run       # score and queue proposals
bun run curator:approve   # approve pending proposals
bun run curator:reject    # reject pending proposals
bun run curator:watchdog  # continuous watchdog

# Embedding backfill
bun run backfill:embeddings        # one-shot: embed all NULL rows via Ollama
bun run backfill:embeddings:watch  # continuous polling (30s interval)

# Session bootstrap
bun run session:start     # brooks-session-start.ts (preferred)
bun run session:bootstrap # full hydrate cycle
bun run session:hydrate   # hydrate from snapshot
bun run snapshot:build    # build snapshot from docs

# Brooks CLI
bun run brooks:start / brooks:status / brooks:end

# DB health — use MCP_DOCKER tools only, never docker exec (see .opencode/rules/mcp-integration.md)
```

## Session Start Protocol

At the start of each session, dispatch Scout to hydrate from Allura Brain:

1. **Scout Recon** — Search PostgreSQL events for recent activity (agent_id='brooks', ORDER BY created_at DESC LIMIT 5)
2. **Blocker Query** — Search events WHERE event_type IN ('BLOCKER', 'ARCHITECTURE_DECISION')
3. **Insight Search** — Query Neo4j for recent insights matching 'allura-roninmemory.\*'
4. **Synthesize** — Scout returns: what's active, what's blocking, what was decided last session

Use MCP_DOCKER tools for Brain connectivity and governed writes. Do not rely on a local allura-memory MCP server.

## Architecture

Allura is a **dual-database AI memory engine** exposed via MCP — a self-hosted, compliance-grade alternative to mem0.

### Data Layers

| Layer    | Store                                                 | Role                                                                                 |
| -------- | ----------------------------------------------------- | ------------------------------------------------------------------------------------ |
| Episodic | PostgreSQL 16 (`src/integrations/postgres.client.ts`) | Append-only raw execution traces. **Never mutate historical rows.**                  |
| Semantic | Neo4j 5.26 (`src/integrations/neo4j.client.ts`)       | Versioned knowledge graph. All updates use `SUPERSEDES` — never edit nodes.          |
| Vector   | RuVector PG (port 5433) (`src/lib/ruvector/`)         | 768d embeddings via Ollama (nomic-embed-text). Hybrid search: vector ANN + BM25 RRF. |

### Key Subsystems

- **Curator** (`src/curator/`): HITL promotion pipeline — scores traces, queues proposals, requires human approval before Neo4j writes.
- **Embedding Backfill** (`src/curator/embedding-backfill-worker.ts`): standalone worker that populates NULL embeddings via Ollama in batches of 10.
- **Kernel** (`src/kernel/`): RuVix proof-gated mutation layer.
- **Budget / Circuit Breaker** (`src/lib/budget/`, `src/lib/circuit-breaker/`): hard limits and automatic shutdown for agent runaway prevention.
- **ADR** (`src/lib/adr/`): 5-layer architectural decision records.
- **Auth** (`src/lib/auth/`, `src/middleware.ts`): Clerk RBAC in production; `DevAuthProvider` fallback in dev. Role hierarchy: `admin > curator > viewer`.

### MCP Tools (canonical)

Use `MCP_DOCKER` tools as the canonical MCP surface for database and graph operations.

### Hybrid Search (RuVector)

`retrieveMemories()` in `src/lib/ruvector/bridge.ts` runs two-pass RRF fusion:

- Vector pass: `ruvector_cosine_distance()` ANN
- Text pass: `ts_rank` on `content_tsv` generated column
- Fusion: `score = 1/(60+rank_v) + 1/(60+rank_t)`
- Modes: `"hybrid"` (default), `"vector"`, `"text"`

`ruvector_hybrid_search()` and other learning/agent functions in the extension are **stubs** — do not call them. See `docs/RUVECTOR_INTEGRATION.md` for the full audit.

## Non-Negotiable Invariants

- **`group_id` on every DB read/write** — pattern `^allura-[a-z0-9-]+$`. Missing it causes CHECK constraint failure.
- **PostgreSQL traces are append-only** — no UPDATE/DELETE on trace rows, ever.
- **Neo4j versioning via `SUPERSEDES`** — `(v2)-[:SUPERSEDES]->(v1:deprecated)`, never edit existing nodes.
- **HITL required for promotion** — agents cannot autonomously promote to Neo4j; route through `curator:approve`.
- **`allura-*` tenant namespace** — `roninclaw-*` group_ids are deprecated; flag any occurrence as drift.

## Code Conventions

**TypeScript:**

- `strict: true`; explicit return types on exported functions; `unknown` over `any`
- `import type` for type-only imports
- Zod validation at external boundaries (env vars, user input, API responses)
- Server-only modules must include: `if (typeof window !== "undefined") throw new Error("server-side only")`

**Import order:** external packages → `@/` aliases → relative imports. Use `@/*` for cross-feature; relative for siblings.

**Naming:** files `kebab-case` · React components `PascalCase` · hooks `useCamelCase` · DB identifiers `snake_case` · constants `SCREAMING_SNAKE_CASE`

**Next.js:** Default to Server Components; `"use client"` only when needed; server actions for persistence (`src/server/`).

## Debugging Protocol

**Before proposing any fix, invoke the `systematic-debugging-memory` skill.** Enforces 5-phase process: Memory Hydration → Root Cause → Pattern Analysis → Hypothesis → Implementation. If 3+ fixes have failed, question the architecture.

## Documentation Hierarchy (highest wins on conflict)

1. Notion — Allura Memory Control Center
2. `docs/allura/` — canonical six: BLUEPRINT, SOLUTION-ARCHITECTURE, DESIGN, REQUIREMENTS-MATRIX, RISKS-AND-DECISIONS, DATA-DICTIONARY
3. `docs/` — project-specific docs (one `PROJECT.md` per initiative)
4. `docs/archive/` — session context and historical reference

Do not create net-new files in `docs/allura/` beyond the canonical six. Route reports, benchmarks, and snapshots to `docs/archive/` or Allura Brain.

## Slash Commands (`.opencode/command/`)

| Command                  | Purpose                                     |
| ------------------------ | ------------------------------------------- |
| `/start-session`         | Health check + memory hydration             |
| `/end-session <summary>` | Persist session reflection to Neo4j         |
| `/validate-repo`         | Typecheck + lint + tests + invariant checks |
| `/commit`                | Conventional commit with emoji, auto-push   |
| `/define-goal <idea>`    | Turn idea into goal + success criteria      |
| `/debug <issue>`         | 5-phase systematic debugging                |
| `/orchestrate <task>`    | Brooks Architect persona — plan + delegate  |
| `/architect <task>`      | MemoryArchitect persona — design + ADR      |

## Team RAM — Agent Routing

| Agent         | Persona          | Use When                                |
| ------------- | ---------------- | --------------------------------------- |
| **Brooks**    | Frederick Brooks | Task planning, architecture, delegation |
| **Jobs**      | Steve Jobs       | Scope control, acceptance criteria      |
| **Woz**       | Steve Wozniak    | Autonomous implementation               |
| **Pike**      | Rob Pike         | Read-only architecture consultation     |
| **Scout**     | —                | Fast codebase search                    |
| **Bellard**   | Fabrice Bellard  | Performance, measurement                |
| **Fowler**    | Martin Fowler    | Refactoring, maintainability            |
| **Knuth**     | Donald Knuth     | Schema design, query optimization       |
| **Hightower** | Kelsey Hightower | CI/CD, infrastructure                   |

Full routing rules: `.opencode/rules/agent-routing.md`

## MCP Integration

**DB operations via MCP_DOCKER tools only** — never `docker exec`. See `.opencode/rules/mcp-integration.md`.
