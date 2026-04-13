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
bun next dev
bun next build
bun next start

# Type checking & lint
bun run typecheck    # tsc --noEmit
bun run lint         # next lint

# Tests
bun test                          # all unit tests (vitest run)
bun run test:watch                # watch mode
bun run test:e2e                  # RUN_E2E_TESTS=true, integration only

# Single test
bun vitest run src/lib/postgres/connection.test.ts
bun vitest run -t "should build connection config"

# MCP server
bun run mcp          # src/mcp/memory-server.ts
bun run mcp:dev      # watch mode

# Curator workflows (HITL promotion)
bun run curator:run
bun run curator:approve
bun run curator:reject

# Session bootstrapping
bun run session:bootstrap   # full hydrate cycle
bun run session:hydrate     # hydrate from snapshot
bun run snapshot:build      # build snapshot from docs

# DB health: use MCP_DOCKER tools only — never docker exec (see .opencode/MCP_RULE.md)
```

## Session Start Protocol

At the start of each session, read these files in order:

1. `memory-bank/activeContext.md` — current focus and blockers
2. `memory-bank/progress.md` — what has been done
3. `memory-bank/systemPatterns.md` — architecture decisions
4. `memory-bank/techContext.md` — tech stack details
5. `_bmad-output/planning-artifacts/source-of-truth.md` — document hierarchy

## Architecture

The system is a **dual-database AI memory engine** exposed via MCP:

- **PostgreSQL** (`src/integrations/postgres.client.ts`): append-only raw execution traces (episodic memory). Never mutate historical rows.
- **Neo4j** (`src/integrations/neo4j.client.ts`): versioned knowledge graph (semantic memory). All insights use `SUPERSEDES` relationships — never edit nodes.
- **MCP Server** (`src/mcp/memory-server.ts`): exposes memory tools to AI agents via Model Context Protocol.
- **Curator** (`src/curator/`): promotion pipeline — moves traces from Postgres to Neo4j. Requires human approval (HITL) before any promotion.
- **ADAS** (`src/lib/adas/`): Automated Design/Agent Search — self-improvement loop using Ollama + Docker.
- **ADR** (`src/lib/adr/`): 5-layer architectural decision records (action log, decision context, reasoning chain, alternatives, human oversight trail).
- **Budget/Circuit Breaker** (`src/lib/budget/`, `src/lib/circuit-breaker/`): hard limits and automatic shutdowns for agent runaway prevention.

### 5-Layer Allura Agent-OS

| Layer | Component |
|-------|-----------|
| L1 | RuVix Kernel (proof-gated mutation) |
| L2 | PostgreSQL 16 + Neo4j 5.26 |
| L3 | Agent Runtime (OpenCode) |
| L4 | Workflow / DAGs / A2A Bus |
| L5 | Paperclip + OpenClaw |

**Governance rule:** "Allura governs. Runtimes execute. Curators promote."

## Non-Negotiable Invariants

- **`group_id` on every DB read/write** — tenant isolation is enforced at schema level; missing it causes schema constraint failure.
- **PostgreSQL traces are append-only** — no UPDATE/DELETE on trace rows, ever.
- **Neo4j versioning via `SUPERSEDES`** — create a new node version linked with `(v2)-[:SUPERSEDES]->(v1:deprecated)`, never edit existing nodes.
- **HITL required for promotion** — agents cannot autonomously promote knowledge to Neo4j or Notion; always route through `curator:approve`.
- **Tag governance** — `canonical_tag` is the system slug used in Neo4j/Postgres/group_id; `display_tag` is the human Notion label. Derive display from canonical, never the reverse.
- **`allura-*` tenant namespace** — legacy `roninclaw-*` group_ids are deprecated; flag any occurrence as drift.

## Code Conventions

**TypeScript:**
- `strict: true`; explicit return types on exported functions; `unknown` over `any`
- `import type` for type-only imports
- Validate with Zod at external boundaries (env vars, user input, API responses)

**Import order:** external packages → `@/` aliases → relative imports. Use `@/*` for cross-feature imports; relative for sibling modules. Add a server guard to any DB/integration module:

```ts
if (typeof window !== "undefined") {
  throw new Error("This module can only be used server-side");
}
```

**Naming:**
- Files: `kebab-case`
- React components: `PascalCase`
- Hooks: `camelCase` with `use` prefix
- DB identifiers: `snake_case`
- Constants: `SCREAMING_SNAKE_CASE`

**Next.js:** Default to Server Components; `"use client"` only when needed; use server actions for persistence (`src/server/`).

## Debugging Protocol

**Before proposing any fix, invoke the `systematic-debugging-memory` skill.** The skill enforces a 5-phase process (Memory Hydration → Root Cause → Pattern Analysis → Hypothesis → Implementation). If 3+ fixes have failed, question the architecture rather than attempting another fix.

## Documentation

**Hierarchy (highest wins on conflict):**

1. Notion — Allura Memory Control Center
2. `_bmad-output/planning-artifacts/*` — planning canon (PRD, architecture, epics, ADRs)
3. `_bmad-output/implementation-artifacts/*` — implementation canon (specs, schemas, plugin docs)
4. `docs/_archive/*` — historical reference
5. `memory-bank/*` — session context

New projects/initiatives belong in `docs/<project-name>/PROJECT.md` using `templates/PROJECT.template.md`. AI-drafted documents require the disclosure notice block defined in `AI-GUIDELINES.md`. Requirement IDs (`B#`, `F#`), decision IDs (`AD-##`), and risk IDs (`RK-##`) must stay consistent throughout a project's docs.

**Course Correction (2026-04-05):** Agent primitives updated from Claude Code leak analysis. Session persistence, workflow state machine, and token budget enforcement are now P1 priorities. See `_bmad-output/planning-artifacts/course-correction-agent-primitives.md`.

## Slash Commands (`.claude/commands/`)

These mirror the `.opencode/command/` system and are invoked with `/command-name`:

| Command | Purpose | Equivalent OpenCode |
|---------|---------|---------------------|
| `/start-session` | Health check + memory hydration at session start | `/start-session` |
| `/end-session <summary>` | Persist session reflection to Neo4j | `/end-session` |
| `/validate-repo` | Typecheck + lint + tests + invariant checks | `/validate-repo` |
| `/commit` | Conventional commit with emoji, auto-push | `/commit` |
| `/define-goal <idea>` | Turn vague idea into goal + success criteria | `/define-goal` |
| `/optimize [path]` | Performance, security, and edge case analysis | `/optimize` |
| `/analyze-patterns [--pattern=X]` | Find recurring patterns and invariant violations | `/analyze-patterns` |
| `/context [operation]` | Harvest summaries, organize memory-bank files | `/context` |
| `/debug <issue>` | 5-phase systematic debugging protocol | — |
| `/orchestrate <task>` | MemoryOrchestrator persona — plan + delegate | `@memory-orchestrator` |
| `/architect <task>` | MemoryArchitect persona — design + ADR | `@memory-architect` |
| `/scribe <task>` | MemoryScribe persona — technical documentation | `@memory-scribe` |
| `/analyst <task>` | MemoryAnalyst persona — metrics and reporting | `@memory-analyst` |

### Agent Persona Commands vs OpenCode `@agent` Invocations

The `/orchestrate`, `/architect`, `/scribe`, and `/analyst` commands replicate the OpenCode `@agent-name` system. They adopt the agent's persona and use the `Agent` tool to spawn sub-agents for delegated work — the same pattern as OpenCode's agent routing, running inside Claude Code instead.

Standard workflow:
```
/start-session           → load memory and verify infra
/orchestrate <task>      → plan → approve → delegate
  ↳ [spawns Scout sub-agent for scout phase]
  ↳ [spawns general-purpose sub-agent for implementation]
  ↳ [spawns general-purpose sub-agent for tests]
/validate-repo           → typecheck + lint + tests
/end-session <summary>   → persist reflection to Neo4j
```

## MCP Integration

To connect Claude Desktop or OpenCode:

```json
{
  "mcpServers": {
    "memory": {
      "command": "bun",
      "args": ["run", "src/mcp/memory-server.ts"]
    }
  }
}
```

Prefer premade MCP servers from `MCP_DOCKER`; avoid custom wrappers when a catalog server already exists.
