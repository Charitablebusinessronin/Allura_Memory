# AGENTS Guide

> [!NOTE]
> **AI-Assisted Documentation**
> Portions of this document were drafted with the assistance of an AI language model.
> Content has been reviewed against the repository guidance files and should be kept in sync with source-of-truth docs.
> When in doubt, defer to code, schemas, and team consensus.

This file is the operating handbook for agentic coding assistants in `roninmemory`.
It should be concise, actionable, and kept in sync with repo conventions.

## 1) Project Summary

- Next.js 16 + React 19 app with TypeScript 5.9 (`strict: true`)
- Bun is the primary runtime for scripts and tests
- PostgreSQL stores raw append-only traces
- Neo4j stores curated/versioned knowledge with `SUPERSEDES`
- Validation uses Zod at external boundaries
- UI stack: Zustand + shadcn/ui + Tailwind v4

## 2) Read First When Starting a Session

**USE SKILL: `allura-memory-context`** — Invoke this skill at session start to load all context.

Then read in order:
1. `memory-bank/activeContext.md` — Current focus and blockers
2. `memory-bank/progress.md` — What's been done
3. `memory-bank/systemPatterns.md` — Architecture patterns
4. `memory-bank/techContext.md` — Tech stack details
5. `_bmad-output/planning-artifacts/source-of-truth.md` — Document hierarchy (CRITICAL)

Also review `.github/copilot-instructions.md` at least once per session.
No Cursor rules were found (`.cursorrules` and `.cursor/rules/` are absent).

## 3) Build / Lint / Test Commands

```bash
# Install
bun install

# Dev / build / run
npm run dev
npm run build
npm run start

# Checks
npm run typecheck
npm run lint

# Tests
npm test
npm run test:watch
npm run test:e2e
RUN_E2E_TESTS=true npm test

# MCP / curator workflows
npm run mcp
npm run mcp:dev
npm run curator:run
npm run curator:approve
npm run curator:reject
```

> **Security Note:** Use `bun` and `bunx` for all package operations. Never use `npm` or `npx` — this avoids supply chain risks.

### Single-test commands

```bash
# Single file
bun vitest run src/lib/postgres/connection.test.ts

# Single test by name
bun vitest run -t "should build connection config"

# Integration test file
bun vitest run src/__tests__/agent-lifecycle-confidence.test.ts
```

## 4) TypeScript / Formatting Rules

- Use explicit return types on exported functions.
- Prefer `unknown` over `any`; narrow before use.
- Use `import type` for type-only imports.
- Keep double quotes, semicolons, and trailing commas.
- Prefer `const` and narrow interfaces over broad object shapes.
- Validate env-derived and user-controlled input with Zod.

## 5) Import / Module Conventions

- Import order: external packages → `@/` aliases → relative imports.
- Use `@/*` for cross-feature imports under `src/`.
- Use relative imports for nearby sibling modules.
- Do not import server-only DB modules into client components.
- Add server guards to DB/integration modules:

```ts
if (typeof window !== "undefined") {
  throw new Error("This module can only be used server-side");
}
```

## 6) Naming Conventions

- Files: `kebab-case`
- React components: `PascalCase`
- Hooks: `camelCase` with `use` prefix
- Types/interfaces/classes: `PascalCase`
- Constants: `SCREAMING_SNAKE_CASE`
- DB identifiers: `snake_case`
- Tests: behavior phrasing (`should ... when ...`)

## 7) Error Handling / Reliability

- Fail fast on missing required env vars with explicit messages.
- Throw typed domain errors for validation/conflict cases when useful.
- Preserve causal info when wrapping errors.
- Log errors with module context and identifiers.
- Use retry/backoff only for retryable failures (5xx, 429, transient network).
- Avoid silent failures unless the fallback is documented.

## 8) Testing Standards

- Use Vitest (`environment: node`).
- Co-locate unit tests with modules when practical.
- Keep integration tests in `src/__tests__/`.
- Prefer deterministic unit tests and mocked I/O.
- For DB tests, set minimal env defaults and clean up pools.
- Add regression tests for bug fixes and state transitions.

## 9) Architecture Guardrails

- PostgreSQL traces are append-only; never mutate historical rows.
- Enforce `group_id` on every DB read/write path.
- Neo4j insight versioning must use explicit lineage (`SUPERSEDES`).
- Query dual context when required: project scope + global scope.
- Human approval (HITL) is required before behavior-changing promotion flows.
- No secrets in source, docs, memory artifacts, or logs.
- Use MCP Neo4j memory tools instead of raw Cypher for basic memory operations.
- Prefer premade MCP servers from `MCP_DOCKER`; avoid custom MCP wrappers when a catalog server already exists.

## 10) Debugging Protocol

**When encountering bugs, test failures, or unexpected behavior:**

**ALWAYS invoke `systematic-debugging-memory` skill first.**

The skill enforces a 5-phase process:

| Phase | Name | Purpose |
|-------|------|---------|
| 0 | Memory Hydration | Check previous debugging sessions |
| 1 | Root Cause Investigation | Gather evidence, understand WHY |
| 2 | Pattern Analysis | Find working examples, compare |
| 3 | Hypothesis and Testing | Test one hypothesis at a time |
| 4 | Implementation | Create failing test, then fix |
| 5 | Persistence | Log to memory for future sessions |

**Red Flags that mean STOP:**
- "Quick fix for now, investigate later"
- "Just try changing X and see if it works"
- "I see the problem, let me fix it" (without investigation)
- "One more fix attempt" (after 2+ failures)

**If 3+ fixes failed:** Question the architecture, don't fix again.

## 11) Next.js / React Patterns

- Default to Server Components in `src/app/`.
- Add `"use client"` only where needed.
- Use server actions for server-side persistence flows.
- Keep client components focused on interaction.
- Reuse existing UI primitives and `cn` patterns.

## 12) Documentation Rules

- New initiatives belong in `docs/<project-name>/PROJECT.md`.
- Keep requirement and decision IDs consistent (`B#`, `F#`, `AD-##`, `RK-##`).
- Use Mermaid fenced blocks for diagrams.
- Keep docs and schema/API changes in the same PR when coupled.
- Include AI-assistance disclosure blocks when required by `AI-GUIDELINES.md`.
- **IMPORTANT:** Documentation canon is `_bmad-output/planning-artifacts/`. When conflict, defer to `_bmad-output/planning-artifacts/*` over `_bmad-output/planning-artifacts/*`.
- **Tenant naming:** Always use `allura-*` convention. Legacy `roninclaw-*` is deprecated.

## 13) Copilot / Memory Bank Rules

- Copilot instructions are mandatory: `.github/copilot-instructions.md`.
- Preserve Steel Frame versioning, `group_id` enforcement, and HITL promotion.
- Read/update memory bank files as work progresses.

## 14) Required Skills

**Run at session start:**
- **`allura-memory-context`** — Loads all context (documentation hierarchy, architecture, naming conventions)

**Run when encountering issues:**
- **`systematic-debugging-memory`** — Use before ANY bug fix or code change for unexpected behavior

**Run for specific workflows:**
- `mcp-docker` for discovering/configuring MCP servers.
- `opencode-docs` for authoritative OpenCode references.
- `skill-creator` when editing or creating skills.

## 15) Skill Workflow

### Starting a Session

```
1. Invoke allura-memory-context skill
2. Read memory-bank/activeContext.md
3. Read memory-bank/progress.md
4. Check for critical blockers
```

### Encountering a Bug or Issue

**BEFORE proposing any fix:**

```
1. Invoke systematic-debugging-memory skill
2. Complete Phase 0: Check memory for previous debugging sessions
3. Complete Phase 1: Root Cause Investigation
   - Read error messages carefully
   - Reproduce consistently
   - Check recent changes
   - Gather evidence
4. Complete Phase 2: Pattern Analysis
5. Complete Phase 3: Hypothesis and Testing
6. Only then proceed to Phase 4: Implementation
```

**Iron Law: NO FIXES WITHOUT ROOT CAUSE INVESTIGATION FIRST**

If 3+ fixes failed → Question architecture (Phase 4.5)

### Creating Stories / PRDs

```
1. Use bmad-create-prd, bmad-create-architecture, etc.
2. BMad reads from _bmad-output/planning-artifacts/ (canon)
3. BMad writes to _bmad-output/planning-artifacts/
```

### Building Features

```
1. Use bmad-dev-story or bmad-quick-dev
2. Follow Steel Frame versioning
3. Enforce group_id on all operations
4. Write tests first (test-driven-development skill)
```

## 16) Architecture Model

**5-Layer Allura Agent-OS:**

| Layer | Component |
|-------|-----------|
| L1 | RuVix Kernel (proof-gated mutation) |
| L2 | PostgreSQL 16 + Neo4j 5.26 |
| L3 | Agent Runtime (OpenCode) |
| L4 | Workflow / DAGs / A2A Bus |
| L5 | Paperclip + OpenClaw |

**Governance Rule:** "Allura governs. Runtimes execute. Curators promote."

## 17) MCP Docker Toolkit — Tool Discovery & Usage

**NEVER use `docker exec` for database operations. ALWAYS use MCP_DOCKER tools.**

### How to discover and add tools

```
# Step 1 — search the Docker MCP catalog (300+ servers)
mcp-find("keyword")      → returns: name, description, required_secrets

# Step 2 — add it (pulls image, registers tools in session immediately)
mcp-add("server-name")   → tools surface as mcp__MCP_DOCKER__<tool_name>

# No required_secrets → add immediately
# Has required_secrets → ensure env vars are set first, then add
```

### Active tool stack (already added — use directly)

**Web research:**
| Tool | When to use |
|------|-------------|
| `mcp__MCP_DOCKER__tavily_search` | Fast current web search |
| `mcp__MCP_DOCKER__tavily_research` | Deep multi-source research |
| `mcp__MCP_DOCKER__tavily_crawl` | Crawl a site from root URL |
| `mcp__MCP_DOCKER__tavily_extract` | Extract content from specific URL |
| `mcp__MCP_DOCKER__web_search_exa` | Neural/semantic search |

**Browser automation (HyperBrowser):**
| Tool | When to use |
|------|-------------|
| `mcp__MCP_DOCKER__scrape_webpage` | Single page → markdown/html/links/screenshot |
| `mcp__MCP_DOCKER__crawl_webpages` | Multi-page site crawl |
| `mcp__MCP_DOCKER__extract_structured_data` | Structured JSON from page via schema |
| `mcp__MCP_DOCKER__browser_use_agent` | Fast explicit browser tasks (cheapest) |
| `mcp__MCP_DOCKER__claude_computer_use_agent` | Complex reasoning in cloud browser |
| `mcp__MCP_DOCKER__openai_computer_use_agent` | General browser tasks via GPT |
| `mcp__MCP_DOCKER__search_with_bing` | Bing search via real browser |

**Live docs (Context7):**
| Tool | When to use |
|------|-------------|
| `mcp__MCP_DOCKER__resolve-library-id` | Look up library → get Context7 ID |
| `mcp__MCP_DOCKER__get-library-docs` | Fetch live docs for any library/version |

**Database (Allura Brain):**
| Tool | When to use |
|------|-------------|
| `mcp__MCP_DOCKER__query_database` | Natural language SQL (fast reads) |
| `mcp__MCP_DOCKER__execute_sql` | Raw SQL (precise reads) |
| `mcp__MCP_DOCKER__insert_data` | Append events — NEVER UPDATE/DELETE |
| `mcp__MCP_DOCKER__read_neo4j_cypher` | Neo4j reads |
| `mcp__MCP_DOCKER__write_neo4j_cypher` | Neo4j writes (SUPERSEDES pattern only) |

### Tool selection guide

```
Need web info?
  quick answer        → tavily_search
  deep research       → tavily_research
  specific page       → tavily_extract or scrape_webpage
  neural/semantic     → web_search_exa
  JS-heavy site       → scrape_webpage (HyperBrowser renders JS)
  automate browser    → browser_use_agent (cheap) or claude_computer_use_agent (smart)

Need library docs?
  → resolve-library-id → get-library-docs

Need DB?
  read                → query_database (NL) or execute_sql (SQL)
  write event         → insert_data (append-only, never mutate)
  knowledge graph     → read/write_neo4j_cypher
```

## 18) Quick Verification

```bash
docker exec knowledge-postgres pg_isready -U ronin4life -d memory
curl -s http://localhost:7474 | jq .neo4j_version
npm run typecheck
npm run lint
npm test
```
