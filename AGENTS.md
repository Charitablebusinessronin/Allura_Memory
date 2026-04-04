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

1. `memory-bank/activeContext.md`
2. `memory-bank/progress.md`
3. `memory-bank/systemPatterns.md`
4. `memory-bank/techContext.md`
5. `_bmad-output/implementation-artifacts/` as needed

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

## 10) Next.js / React Patterns

- Default to Server Components in `src/app/`.
- Add `"use client"` only where needed.
- Use server actions for server-side persistence flows.
- Keep client components focused on interaction.
- Reuse existing UI primitives and `cn` patterns.

## 11) Documentation Rules

- New initiatives belong in `docs/<project-name>/PROJECT.md`.
- Keep requirement and decision IDs consistent (`B#`, `F#`, `AD-##`, `RK-##`).
- Use Mermaid fenced blocks for diagrams.
- Keep docs and schema/API changes in the same PR when coupled.
- Include AI-assistance disclosure blocks when required by `AI-GUIDELINES.md`.

## 12) Copilot / Memory Bank Rules

- Copilot instructions are mandatory: `.github/copilot-instructions.md`.
- Preserve Steel Frame versioning, `group_id` enforcement, and HITL promotion.
- Read/update memory bank files as work progresses.

## 13) Required OpenCode Skills

- `mcp-docker` for discovering/configuring MCP servers.
- `opencode-docs` for authoritative OpenCode references.
- `skill-creator` when editing or creating skills.

## 14) Quick Verification

```bash
docker exec knowledge-postgres pg_isready -U ronin4life -d memory
curl -s http://localhost:7474 | jq .neo4j_version
npm run typecheck
npm run lint
npm test
```
