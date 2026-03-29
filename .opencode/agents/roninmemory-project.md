# AGENTS Guide

This file is the operating handbook for agentic coding agents working in `roninmemory`.
It captures runnable commands, code style expectations, architecture constraints, and AI workflow rules.

## 1) Build, Lint, Test Commands

```bash
# Install dependencies
bun install

# Local development
npm run dev                 # Next.js dev server via Bun
npm run build               # Production build
npm run start               # Run built app

# Static checks
npm run typecheck           # tsc --noEmit (strict)
npm run lint                # next lint

# Tests
npm test                    # run all tests once (bun vitest run)
npm run test:watch          # watch mode

# Single test file (preferred)
bun vitest run src/lib/postgres/connection.test.ts

# Single test by name pattern
bun vitest run -t "should build connection config"

# E2E/system test path
npm run test:e2e            # runs src/__tests__/e2e-integration.test.ts
RUN_E2E_TESTS=true npm test # enables behavioral stress tests

# MCP server
npm run mcp
npm run mcp:dev

# Curator workflows
npm run curator:run
npm run curator:approve
npm run curator:reject
```

## 2) Tech Baseline

- Framework: Next.js 16 + React 19
- Language: TypeScript 5.9, `strict: true`, `noEmit: true`, target `ES2022`
- Runtime/tooling: Bun for scripts/tests, npm script entrypoints
- Data stores: PostgreSQL (raw append-only traces) + Neo4j (versioned knowledge graph)
- Validation: Zod for runtime boundary checks
- State/UI: Zustand + shadcn/ui + Tailwind v4

## 3) TypeScript and Formatting Rules

- Use explicit function return types on exported functions.
- Prefer `unknown` over `any`; narrow before use.
- Use `import type` for type-only imports.
- Keep current repository style: double quotes, semicolons, trailing commas.
- Prefer immutable constants (`const`) and narrow interfaces over broad object types.
- Validate external/unsafe inputs with Zod (API payloads, env-derived config, DB boundary data).

## 4) Import and Module Conventions

- Import order: external packages -> internal alias imports (`@/`) -> relative imports.
- Use `@/*` alias for cross-feature imports under `src/`.
- Use relative imports for tightly local module siblings.
- Never import server-only DB modules into client components.
- DB/integration modules should include server guards:

```ts
if (typeof window !== "undefined") {
  throw new Error("This module can only be used server-side");
}
```

## 5) Naming Conventions

- Files: `kebab-case` (`promotion-orchestrator.ts`, `group-id.test.ts`)
- React components: `PascalCase`
- Hooks: `camelCase` with `use` prefix
- Types/interfaces/classes: `PascalCase`
- Constants: `SCREAMING_SNAKE_CASE`
- Database identifiers: `snake_case` (`group_id`, `created_at`)
- Test names: use clear behavior phrasing (`should ... when ...`)

## 6) Error Handling and Reliability

- Fail fast on missing required env vars with explicit messages.
- Throw typed domain errors for validation/conflict cases when useful.
- Log DB/client errors with context (module prefix and key identifiers).
- Preserve causal information when wrapping errors.
- Use retry/backoff only for retryable failures (5xx, 429, transient network).
- Avoid silent failures; if swallowing errors, do it intentionally with documented fallback behavior.

## 7) Testing Standards

- Test runner: Vitest (`environment: node`, include `src/**/*.{test,spec}.{ts,tsx}`).
- Co-locate tests with modules (`*.test.ts`) unless integration-level in `src/__tests__/`.
- Prefer deterministic unit tests; isolate I/O with stubs/mocks when possible.
- For DB-related tests, set minimal env defaults in test setup and clean up pooled connections.
- Add regression tests with bug fixes and state transition changes.

## 8) Architecture Guardrails (Do Not Violate)

- PostgreSQL raw traces are append-only: do not mutate historical trace rows.
- Enforce tenant isolation with `group_id` in every DB read/write path.
- Neo4j insight versioning must use explicit lineage (`SUPERSEDES` flow), not in-place edits.
- Query dual context where required: project scope + global scope.
- Human approval (HITL gate) is required before behavior-changing promotion flows.
- No secrets in source, docs, memory artifacts, or logs; use environment variables.

## 9) Next.js/React Patterns

- Default to Server Components in `src/app/`; add `"use client"` only where necessary.
- Use server actions for server-side state persistence flows.
- Keep client components focused on interaction; move side-effectful data logic server-side.
- Reuse existing UI primitives and `cn` utility patterns instead of ad hoc styling systems.

## 10) Documentation Rules (from `AI-GUIDELINES.md`)

- For new initiatives, document in `docs/<project-name>/PROJECT.md` using `templates/PROJECT.template.md`.
- Keep requirement and decision identifiers consistent (`B#`, `F#`, `AD-##`, `RK-##`).
- Use Mermaid fenced blocks for diagrams.
- Keep docs and schema/API changes in the same PR when they are coupled.
- Include AI-assistance disclosure blocks where required by `AI-GUIDELINES.md`.

## 11) Copilot/Cursor Rule Integration

- Copilot rules exist and are mandatory: see `.github/copilot-instructions.md`.
- At session start, read memory bank in order:
  1. `memory-bank/activeContext.md`
  2. `memory-bank/progress.md`
  3. `memory-bank/systemPatterns.md`
  4. `memory-bank/techContext.md`
  5. `_bmad-output/implementation-artifacts/` as needed
- Preserve Copilot-defined patterns: Steel Frame versioning, `group_id` enforcement, HITL promotion.
- Cursor rules check: no `.cursorrules` or `.cursor/rules/` files were found in this repository at the time this guide was generated.

## 12) Required OpenCode Skills

For agentic work in this repository, load and use these skills when applicable:

- `memory-client`: `/home/ronin704/Projects/roninmemory/.opencode/skills/memory-client`
  - Use for memory persistence, knowledge search, event logging, and context retrieval.
  - Prefer `group_id`-scoped memory operations for all project work.
- `mcp-docker`: `/home/ronin704/Projects/roninmemory/.opencode/skills/mcp-docker`
  - Use for discovering/configuring MCP servers and enabling additional tools on demand.
  - Follow the workflow: `mcp-find` -> `mcp-config-set` -> `mcp-add` -> execute tool.
- `opencode-docs`: `/home/ronin704/Projects/roninmemory/.opencode/skills/opencode-docs`
  - Use `https://opencode.ai/docs/` as the authoritative reference for OpenCode config, agents, plugins, and workflows.
- `skill-creator`: `/home/ronin704/Projects/roninmemory/.opencode/skills/skill-creator`
  - Use when creating or updating skills so reusable assets, references, and MCP discovery steps are consistent.

Apply these skills before ad hoc approaches when the task involves memory operations or MCP server/tool expansion.

## 13) Quick Verification Commands

```bash
# Database health
docker exec knowledge-postgres pg_isready -U ronin4life -d memory
curl -s http://localhost:7474 | jq .neo4j_version

# Quality gate
npm run typecheck
npm run lint
npm test
```
