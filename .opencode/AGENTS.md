# AGENTS Guide

> AI-Assisted Documentation — reviewed against source code and team consensus. When in doubt, defer to code and schemas.

## 1) Project Summary

Allura Memory — a **dual-database AI memory engine** exposed via MCP. Self-hosted, compliance-grade alternative to mem0.

- **Runtime**: Bun (never `npm`/`npx` — supply chain security policy)
- **Framework**: Next.js 16 + React 19 + TypeScript 5.9 (`strict: true`)
- **Data**: PostgreSQL 16 (append-only traces) + Neo4j 5.26+APOC (versioned knowledge graph, `SUPERSEDES`) + RuVector PG on port 5433 (768d embeddings, hybrid RRF search)
- **MCP Server**: `src/mcp/memory-server-canonical.ts`
- **Curator Pipeline**: HITL promotion — agents cannot autonomously write to Neo4j; route through `curator:approve`
- **Auth**: Clerk RBAC in production; `DevAuthProvider` fallback in dev. Role hierarchy: `admin > curator > viewer`
- **UI**: Zustand + shadcn/ui + Tailwind v4

## 2) Non-Negotiable Invariants

These are **runtime-enforced constraints**, not style preferences. Violations cause CHECK constraint failures or data corruption.

- **`group_id` on every DB read/write** — pattern `^allura-[a-z0-9-]+$`. Missing or malformed → rejected by DB.
- **PostgreSQL traces are append-only** — no UPDATE/DELETE on trace rows, ever.
- **Neo4j versioning via `SUPERSEDES`** — `(v2)-[:SUPERSEDES]->(v1:deprecated)`. Never edit existing nodes.
- **HITL required for promotion** — agents cannot autonomously promote to Neo4j/Notion. Use `curator:approve`.
- **`allura-*` tenant namespace** — `roninclaw-*` is deprecated; flag any occurrence as drift.
- **No secrets in source, docs, memory artifacts, or logs** — enforced by pre-commit hook.
- **DB operations via MCP_DOCKER tools only** — never `docker exec` into containers.

## 3) Commands

```bash
bun install                      # Install dependencies
bun run dev                      # Next.js dev (port $PAPERCLIP_PORT, default 3100)
bun run build                    # Production build (output: standalone)
bun run start                    # Production server

bun run typecheck                # tsc --noEmit (ALWAYS run before commits)
bun run lint                     # ALIAS for typecheck (not a separate linter)

bun test                         # Vitest unit tests
bun run test:watch               # Watch mode
bun run test:e2e                 # E2E (requires postgres + neo4j running)
bun run test:all                 # typecheck + lint + unit + e2e + mcp:browser
bun vitest run src/lib/postgres/connection.test.ts          # Single file
bun vitest run -t "should build connection config"           # Single test by name

bun run mcp                      # Canonical stdio MCP server
bun run mcp:dev                  # Watch mode
bun run mcp:http                  # HTTP gateway (port 3201)
bun run curator:run               # Score and queue proposals
bun run curator:approve           # Approve pending proposals
bun run curator:reject            # Reject pending proposals
bun run session:start             # Brooks session start (preferred)
bun run backfill:embeddings       # One-shot: embed NULL rows via Ollama
```

**Order matters:** `lint` → `test` → `test:e2e` (`lint` is typecheck here, not eslint).

### Pre-commit Hook

```bash
git config core.hooksPath .githooks   # One-time setup
```

Runs `bun run typecheck` and blocks `.env` files with real secrets. If typecheck fails, the commit is blocked — fix the errors, don't silence the canary.

## 4) Architecture at a Glance

```
L1: RuVix Kernel (proof-gated mutation) — src/kernel/
L2: PostgreSQL 16 (traces) + Neo4j 5.26 (insights) + RuVector PG (embeddings)
L3: Agent Runtime (OpenCode)
L4: Workflow / DAGs / A2A Bus
L5: Paperclip (Next.js UI) + OpenClaw (MCP gateway)
```

**Key entrypoints:**

| Path                                       | Purpose                                                      |
| ------------------------------------------ | ------------------------------------------------------------ |
| `src/mcp/memory-server-canonical.ts`       | MCP tool server (store/retrieve/delete/list/propose_insight) |
| `src/mcp/canonical-http-gateway.ts`        | HTTP wrapper for MCP server                                  |
| `src/curator/index.ts`                     | HITL promotion pipeline CLI                                  |
| `src/curator/embedding-backfill-worker.ts` | Ollama embed worker (batches of 10)                          |
| `src/lib/ruvector/bridge.ts`               | Hybrid search: RRF fusion of vector ANN + BM25               |
| `src/kernel/ruvix.ts`                      | Proof-gated mutation engine                                  |
| `src/middleware.ts`                        | Route protection + RBAC (Clerk or DevAuthProvider)           |
| `src/server/server-actions.ts`             | Server actions for persistence                               |
| `src/config/app-config.ts`                 | App metadata                                                 |
| `packages/sdk/`                            | Standalone SDK package (separate build)                      |

## 5) Directory Ownership

| Directory                             | What Lives Here                                             |
| ------------------------------------- | ----------------------------------------------------------- |
| `src/mcp/`                            | MCP servers (canonical + legacy)                            |
| `src/curator/`                        | HITL promotion pipeline + notion sync + embedding backfill  |
| `src/kernel/`                         | RuVix proof-gated mutation                                  |
| `src/lib/ruvector/`                   | Hybrid search bridge + embedding service                    |
| `src/lib/auth/`                       | Clerk RBAC + DevAuthProvider                                |
| `src/lib/budget/`, `circuit-breaker/` | Agent runaway prevention                                    |
| `src/lib/adr/`                        | 5-layer architectural decision records                      |
| `src/server/`                         | Server actions for persistence                              |
| `src/stores/`                         | Zustand client state                                        |
| `src/app/`                            | Next.js App Router (Server Components by default)           |
| `src/__tests__/`                      | Integration tests                                           |
| `tests/`                              | Fixture, load, MCP browser tests                            |
| `packages/sdk/`                       | Standalone SDK (separate tsconfig, build, tests)            |
| `.opencode/agent/`                    | Team RAM agent files (sole canonical source, flat 10 files) |
| `.opencode/skills/`                   | OpenCode skill definitions                                  |
| `_bmad-output/`                       | Retired — gitignored, do not re-add                         |
| `docs/allura/`                        | Human canon — canonical six only                            |

## 6) Conventions

**TypeScript:** `strict: true`, explicit return types on exports, `unknown` over `any`, `import type` for type-only imports. Double quotes, semicolons, trailing commas.

**Naming:** files `kebab-case`, components `PascalCase`, hooks `useCamelCase`, DB ids `snake_case`, constants `SCREAMING_SNAKE_CASE`, tests `should ... when ...`.

**Imports:** External packages first → `@/*` aliases → relative imports. Use `@/*` for cross-feature; relative for sibling modules.

**Server-only modules** must include:

```ts
if (typeof window !== "undefined") throw new Error("server-side only")
```

**Next.js:** Default Server Components. Add `"use client"` only where needed. Server actions in `src/server/`.

**Zod:** Validate env vars and user input at external boundaries only.

## 7) Testing Quirks

- Vitest with `environment: "node"` and `passWithNoTests: true`
- Co-locate unit tests with modules; integration tests in `src/__tests__/`
- E2E tests require running postgres + neo4j (gated by `RUN_E2E_TESTS=true`)
- MCP browser tests: `bun run test:mcp:browser`
- Test path aliases match production: `@mcp-docker/playwright` and `@mcp-docker/next-devtools` map to mocks in `tests/mcp/`
- For DB tests: set minimal env defaults and clean up pools after

## 8) RuVector / Hybrid Search Warning

`ruvector_hybrid_search()` and other learning/agent functions in the extension are **stubs** — they return fabricated data. Only vector math, graph DB, and RDF/SPARQL functions are real. Allura's own `retrieveMemories()` in `src/lib/ruvector/bridge.ts` implements RRF fusion directly (two-pass: vector ANN via `ruvector_cosine_distance()` + BM25 via `ts_rank` on stored `content_tsv` column). Three modes: `"hybrid"` (default), `"vector"`, `"text"`. Falls back to BM25 if vector search fails.

## 9) Docker / Infrastructure

```bash
docker compose up -d                    # postgres + neo4j + dozzle + mcp
docker compose -f docker-compose.yml -f docker-compose.enterprise.yml up -d  # + observability stack

# Health checks (use MCP_DOCKER tools, NOT docker exec, for DB operations)
curl -s http://localhost:7474 | jq .neo4j_version    # Neo4j health
```

- PostgreSQL: port 5432, container `knowledge-postgres`, db `memory`, user from `.env`
- Neo4j: ports 7474 (HTTP) + 7687 (Bolt), container `knowledge-neo4j`, APOC enabled
- RuVector PG: port 5433, container `knowledge-ruvector`
- MCP: container `allura-memory-mcp`, depends on postgres + neo4j health checks
- Dozzle: port 8088, container log viewer

## 10) Integration Tests

DB integration tests are skipped by default. To run:

```bash
RUN_DB_INTEGRATION=true bun test
```

Requires a live DB connection (postgres + neo4j via `docker compose up`). Tests use
isolated `group_id` values (`allura-test-*`) and clean up after themselves
via `afterEach`/`afterAll`. Do NOT run against production without verifying
`DATABASE_URL` target.

## 11) Session Start Protocol

Hydrate from Allura Brain (not flat files):

1. **Scout Recon** — Dispatch Scout subagent to search Brain for current context
2. **PostgreSQL** — Query recent events for blockers, decisions, last session activity
3. **Neo4j** — Search insights for architecture patterns and decisions
4. **Synthesize** — Scout returns: what's active, what's blocking, what was decided

Invoke skill `memory-client` at session start for Brain connectivity. Invoke `memory-client` skill at session end to write reflection to Neo4j knowledge graph.

## 11) Debugging Protocol

**Iron Law: NO FIXES WITHOUT ROOT CAUSE INVESTIGATION FIRST.**

Before proposing any fix, invoke the `systematic-debugging-memory` skill. If 3+ fixes fail, question the architecture (Phase 4.5).

## 12) Documentation Hierarchy

1. Notion — Allura Memory Control Center
2. `docs/allura/` — canonical six: BLUEPRINT, SOLUTION-ARCHITECTURE, DESIGN, REQUIREMENTS-MATRIX, RISKS-AND-DECISIONS, DATA-DICTIONARY
3. `docs/` — project-specific docs (one `PROJECT.md` per initiative)
4. `docs/archive/` — session context and historical reference

Do not create net-new files in `docs/allura/` beyond the canonical six. Keep requirement and decision IDs consistent (`B#`, `F#`, `AD-##`, `RK-##`).

## 13) Agent Directory

Canonical source: `.opencode/agent/` (flat, 10 files). `.claude/agents/` is a symlink to it — edit only in `.opencode/agent/`.

```
brooks.md    jobs.md     fowler.md   pike.md     scout.md
bellard.md   carmack.md  knuth.md    hightower.md woz.md
```

### Legacy Layout (removed)

The old subdirectory structure (`core/`, `subagents/code/`, `subagents/development/`) was removed. All agents now live flat in `.opencode/agent/`.

## Team RAM (Real Actual Masters)

| Display Name | Persona | Role |
|-------------|---------|------|
| Architect | Brooks | Orchestrator + Chief Architect |
| Gate | Jobs | Intent Gate + Scope Owner |
| Builder | Wozniak | Primary Builder |
| Performance | Carmack | Performance + Optimization |
| Diagnostics | Bellard | Deep Diagnostics + Measurement |
| Interface | Pike | Simplicity Gate |
| Refactor | Fowler | Maintainability Gate |
| Recon | Scout | Fast Discovery (read-only) |
| Data | Knuth | Data Architect + Schema Specialist |
| DevOps | Hightower | Infrastructure + Deployment |

Filename = agent name. YAML frontmatter must include `description` (required) and `mode` (`primary` or `subagent`).

### Agent Directory Rules

1. Edit agent definitions here.
2. Do not recreate `.opencode/agents/` as a second live source.
3. Ralph is a tool integration, not an agent file.
4. All agents use real-person names (Team RAM), not Greek mythology.
5. Every agent MUST have an INSTRUCTION BOUNDARY block after frontmatter.

## 14) Common Gotchas

- **`bun run lint` IS `bun run typecheck`** — there is no separate eslint. Both run `tsc --noEmit`.
- **Pre-commit hook must be manually set up** — `git config core.hooksPath .githooks`. Without it, typecheck is not enforced on commit.
- **E2E tests require both databases running** — set `RUN_E2E_TESTS=true` and ensure docker compose is up.
- **`_bmad-output/` is gitignored** — do not re-add it. It's retired.
- **RuVector learning/agent functions are stubs** — see §8.
- **`PAPERCLIP_PORT`** defaults to 3100, `ALLURA_MCP_HTTP_PORT` defaults to 3201.
- **`packages/sdk/`** has its own `tsconfig.json`, `vitest.config.ts`, and `tsup.config.ts` — it builds independently.
- **`src/config/app-config.ts`** references the root `package.json` for version — don't move it without updating the import.
- **Clerk is optional in dev** — if Clerk env vars are missing, `DevAuthProvider` kicks in with default admin role.
