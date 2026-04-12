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

## 14) Skill Triggers (Deterministic IF/THEN)

Skills are NOT optional suggestions. They are **mandatory routing rules** — the agent MUST invoke the specified skill when the trigger condition is met.

### Session Lifecycle (ALWAYS)

| Trigger | Skill | Action |
|---------|-------|--------|
| Session START | `allura-memory-context` | Load all context. Read `memory-bank/activeContext.md` and `memory-bank/progress.md`. |
| Session END | `memory-client` | Write session reflection to Neo4j knowledge graph. Verify read-back. Log what changed + why. |

### Bugs, Failures, and Unexpected Behavior

| Trigger | Skill | Action |
|---------|-------|--------|
| ANY bug, test failure, or unexpected output | `systematic-debugging-memory` | Run BEFORE proposing any fix. Phase 0 (check memory) → Phase 1 (root cause) → Phase 2 (pattern) → Phase 3 (hypothesis) → Phase 4 (implementation). If 3+ fixes fail → Phase 4.5 (question architecture). |

**Iron Law: NO FIXES WITHOUT ROOT CAUSE INVESTIGATION FIRST**

### Security and Proof Gate

| Trigger | Skill | Action |
|---------|-------|--------|
| Touching auth, secrets, permissions, proof gate, or anything security-shaped | `bun-security` | Load and follow security audit checklist BEFORE finalizing changes. |

### Research and Documentation

| Trigger | Skill | Action |
|---------|-------|--------|
| Need current library docs or API changes | `context7` | Use `resolve-library-id` → `get-library-docs`. Never guess at API signatures. |
| Complex research requiring multiple sources | `multi-search` | Coordinate Context7 (docs) + Tavily (web) + grep (code). |
| Creating README or AI memory documentation | `readme-memory` | Use structured templates for memory system docs. |
| Looking up OpenCode config, agents, plugins | `opencode-docs` | Use https://opencode.ai/docs/ as canonical reference. |

### Tool Discovery and Infrastructure

| Trigger | Skill | Action |
|---------|-------|--------|
| Need an MCP tool that's not already active | `mcp-docker` | Find → configure → add. Never write custom MCP wrappers when catalog exists. |
| Bootstrapping or operating memory system tooling | `mcp-docker-memory-system` | Discover, configure, and operate Neo4j/PostgreSQL/Notion-backed MCP workflows. |

### Skill Creation and Task Management

| Trigger | Skill | Action |
|---------|-------|--------|
| Creating or editing a skill | `skill-creator` | Use the structured template. Don't freehand skill files. |
| Tracking structured subtasks with status and dependencies | `task-management` | CLI-based task tracking with validation gates. |
| Creating structured tasks linked to Allura Brain | `task-creator` | Generate task files with metadata and memory links. |

### Parallel Execution

| Trigger | Skill | Action |
|---------|-------|--------|
| Need maximum throughput on independent subtasks | `party-mode` | Launch multiple agents in parallel. Surgical team works together. |

### Skills NOT Yet Wired (Keep, Don't Invoke Automatically)

These exist but have no deterministic trigger yet:

| Skill | Why It Exists | When to Wire |
|-------|---------------|--------------|
| `hitl-governance` | Human-in-the-loop promotion enforcement | When curator pipeline is active |
| `mcp-builder` | Building custom MCP servers | When we actually build one |
| `trailofbits-audit` | Security audit workflow | Before production release |
| `superpowers-memory` | Memory logging for superpowers skills | When superpowers skills are in use |

## 15) Session End Protocol (MANDATORY)

**Every session MUST end with a memory write and verification.**

```
1. Use MCP_DOCKER create_entities to write a Reflection entity
   - group_id: roninmemory
   - agent_id: your persona (e.g. brooks-architect)
   - event_type: session_complete
   - status: completed
   - Timestamp (ISO 8601)
   - Key insights (what changed and why)
   - Commits made
   - Open issues remaining

2. Use MCP_DOCKER search_nodes to verify the write (read-back)
   - Confirm the Reflection entity appears in search results

3. Use MCP_DOCKER add_observations to append to Memory Master entity
   - One-line summary with date and key outcomes

4. Link to your agent entity with create_relations if it exists
```

**No session is complete until the knowledge graph confirms the write.**

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

### Active tool stack (MCP Docker catalog)

All MCP tools are discovered and added via `mcp-find` → `mcp-add`. The `allura-memory-mcp` Docker container bundles several tools by default (Tavily, Exa, Notion, database-server). Additional tools are added via `mcp-add` and configured via `mcp-config-set`.

**✅ Connected and working (no API key needed — bundled in MCP Docker):**

| Category | Tool | When to use |
|----------|------|-------------|
| Web search | `tavily_search` | Fast current web search |
| Web research | `tavily_research` | Deep multi-source research |
| Web crawl | `tavily_crawl` | Crawl a site from root URL |
| Web extract | `tavily_extract` | Extract content from specific URL |
| Web map | `tavily_map` | Map a site's link structure |
| Neural search | `web_search_exa` | Embedding-based semantic search |
| Live docs | `resolve-library-id` | Look up library → get Context7 ID |
| Live docs | `get-library-docs` | Fetch live docs for any library/version |
| Database NL | `query_database` | Natural language SQL reads |
| Database SQL | `execute_sql` | Raw SQL (precise reads) |
| Database SQL | `execute_unsafe_sql` | CREATE, DELETE, INSERT, DROP operations |
| Database write | `insert_data` | Append events — NEVER UPDATE/DELETE |
| Database write | `update_data` | Update data in tables |
| Database write | `delete_data` | Delete data (use with extreme caution) |
| Database schema | `list_tables`, `describe_table`, `create_table` | Schema introspection |
| Neo4j read | `read_neo4j_cypher` | Cypher read queries |
| Neo4j write | `write_neo4j_cypher` | Cypher write queries (SUPERSEDES only) |
| Neo4j schema | `get_neo4j_schema` | Graph schema inspection |
| Notion read | `notion-fetch`, `notion-search` | Read pages, databases |
| Notion write | `notion-create-pages`, `notion-update-page` | Create/update pages |
| Notion DB | `notion-create-database`, `notion-update-data-source`, `notion-query-database-view` | Database operations |
| Notion comments | `notion-create-comment`, `notion-get-comments` | Discussion threads |
| Notion users | `notion-get-users`, `notion-get-teams` | Workspace user/team lookup |
| MCP discovery | `mcp-find`, `mcp-add`, `mcp-config-set`, `mcp-remove` | Discover and configure MCP servers |
| MCP compose | `code-mode` | Compose multiple MCP tool calls in JS |

**🔧 Connected via `mcp-config-set` (requires Docker network config):**

| Tool | Config | Status |
|------|--------|--------|
| `neo4j-cypher` | `bolt://172.18.0.2:7687` (Docker IP) | ✅ Working |
| `context7` | No config needed | ✅ Working |
| `database-server` | `postgresql+asyncpg://...` (container network) | ✅ Working |

**⚠️ Available in catalog but NOT connected (requires API keys):**

| Tool | Catalog name | Required secret | Use case |
|------|-------------|-----------------|----------|
| HyperBrowser | `hyperbrowser` | `HYPERBROWSER_API_KEY` | Browser automation, JS rendering |
| Tavily (standalone) | `tavily` | `TAVILY_API_KEY` | Standalone Tavily (bundled version works without key) |
| Exa (standalone) | `exa` | `EXA_API_KEY` | Standalone Exa (bundled version works without key) |
| GitHub | `github-official` | `GITHUB_PERSONAL_ACCESS_TOKEN` | GitHub API operations |
| Playwright | `playwright` | None (long-lived) | Browser automation |
| Firecrawl | `firecrawl` | `FIRECRAWL_API_KEY` | Web scraping |

**To add a new MCP tool:**
```bash
# Step 1 — Find it in the catalog
mcp-find("keyword")

# Step 2 — If no required_secrets, add immediately
mcp-add("context7")

# Step 3 — If has required_secrets, configure first
mcp-config-set("neo4j-cypher", { url: "bolt://172.18.0.2:7687", username: "neo4j", password: "..." })
mcp-add("neo4j-cypher")
```

### Tool selection guide

```
Need web info?
  quick answer        → tavily_search
  deep research       → tavily_research
  specific page       → tavily_extract
  site structure      → tavily_map
  neural/semantic     → web_search_exa (finds things keywords miss)
  official docs/config → web_search_exa (semantic match to API schemas)
  architecture patterns → web_search_exa (finds design docs, GitHub issues)
  full site crawl     → tavily_crawl
  JS-heavy page       → add hyperbrowser MCP server (requires API key)

Need library docs?
  → resolve-library-id → get-library-docs

Need DB?
  read                → query_database (NL) or execute_sql (SQL)
  write event         → insert_data (append-only, never mutate)
  knowledge graph     → read_neo4j_cypher / write_neo4j_cypher
  schema inspection   → get_neo4j_schema

Need Notion?
  read page/DB        → notion-fetch, notion-search
  create/update       → notion-create-pages, notion-update-page
  discussions          → notion-create-comment, notion-get-comments
  database ops        → notion-create-database, notion-update-data-source

Need a new MCP tool?
  discover            → mcp-find("keyword")
  add                 → mcp-add("server-name")
  configure            → mcp-config-set("server-name", { ... })
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

## 18) Agent Directory Structure

### Canonical Location (OpenCode)

OpenCode discovers agents by **scanning flat `.md` files** in `.opencode/agents/` (plural). The filename (minus `.md`) becomes the agent name. The `mode` field in YAML frontmatter (`primary` or `subagent`) determines the agent type.

**Do NOT use subdirectories** — OpenCode does not discover agents in subdirectories for project-local configs (confirmed in [Issue #2369](https://github.com/anomalyco/opencode/issues/2369)).

```
.opencode/agents/                    ← CANONICAL (plural, flat, auto-discovered)
├── brooks-architect.md              ← mode: primary
├── jobs-intent-gate.md              ← mode: primary
├── scout-recon.md                    ← mode: subagent
├── fowler-refactor-gate.md          ← mode: subagent
├── pike-interface-review.md          ← mode: subagent
├── ralph-loop.md                     ← mode: subagent
├── bellard-diagnostics-perf.md       ← mode: subagent
├── dijkstra-review.md                ← mode: subagent
├── knuth-analyze.md                  ← mode: subagent
└── woz-builder.md                    ← mode: subagent
```

### Registration

Agents are registered explicitly in `opencode.json` at project root with permissions, model overrides, and task routing.

### Claude Code (`.claude/agents/`)

The `.claude/agents/` directory uses a **flat** structure with simplified filenames:
```
.claude/agents/
├── brooks.md          ← mirrors brooks-architect.md
├── jobs.md            ← mirrors jobs-intent-gate.md
├── fowler.md          ← mirrors fowler-refactor-gate.md
├── pike.md            ← mirrors pike-interface-review.md
├── ralph.md           ← mirrors ralph-loop.md
├── scout.md           ← mirrors scout-recon.md
├── bellard.md         ← mirrors bellard-diagnostics-perf.md
├── dijkstra.md         ← mirrors dijkstra-review.md
├── knuth.md           ← mirrors knuth-analyze.md
└── woz.md             ← mirrors woz-builder.md
```

### DEPRECATED: `.opencode/agent/` (singular, nested)

The old `.opencode/agent/` directory with nested subdirectories (`core/`, `subagents/core/`, `subagents/code/`) is **deprecated**. It remains for reference only. Do not edit files there — edit the canonical copies in `.opencode/agents/` instead.

### Key OpenCode Agent Rules

1. **Flat files only** in `.opencode/agents/` — no subdirectories
2. **YAML frontmatter** must include `description` (required) and `mode` (`primary` or `subagent`)
3. **Filename = agent name** — `brooks-architect.md` creates agent `brooks-architect`
4. **`opencode.json`** at project root provides explicit registration, permissions, and model overrides
5. **`mode: subagent`** agents can be invoked by primary agents via the Task tool or `@mention`
6. **`mode: primary`** agents can be switched to via Tab key during sessions

## 19) Web Research Tools — Exa Usage Guide

### `web_search_exa` — Neural/Semantic Search

The `MCP_DOCKER_web_search_exa` tool provides **neural/semantic search** powered by Exa AI. Use it when you need real-time, relevance-ranked web results rather than keyword matching.

**When to use Exa vs other search tools:**

| Need | Best Tool | Why |
|------|-----------|-----|
| Quick fact, current event | `tavily_search` | Fast, keyword-based |
| Deep multi-source research | `tavily_research` | Comprehensive, multi-step |
| Specific URL content | `tavily_extract` | Extract from known URL |
| **Library/framework docs** | `context7` → `get-library-docs` | Canonical, versioned docs |
| **Neural/semantic search** | `web_search_exa` | Embedding-based relevance ranking |
| **Official tool configs** | `web_search_exa` | Finds actual API docs, config schemas |
| **Architecture patterns** | `web_search_exa` | Finds design docs, best practices |

**Exa parameters:**

```javascript
MCP_DOCKER_web_search_exa({
  query: "opencode agents subagent configuration",  // Natural language query
  numResults: 5      // Number of results (default: 5)
})
```

**Exa excels at:**
- Finding official documentation for tools and frameworks (e.g., OpenCode agent config, Next.js patterns)
- Semantic matching — "how to configure subagents" finds the right docs even without exact keywords
- Discovering canonical config schemas and examples
- Locating GitHub issues and discussions about specific features

**Example: Verifying OpenCode agent discovery**

When we needed to confirm whether OpenCode discovers agents in subdirectories, Exa found:
- The official OpenCode agents documentation (opencode.ai/docs/agents/)
- The opencodeguide.com agent configuration reference
- GitHub issue #2369 confirming subdirectory discovery is broken

This is exactly the kind of research where keyword search fails and neural search shines.

## 20) Quick Verification

```bash
docker exec knowledge-postgres pg_isready -U ronin4life -d memory
curl -s http://localhost:7474 | jq .neo4j_version
npm run typecheck
npm run lint
npm test
```
