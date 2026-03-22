# Story 1.1: record-raw-execution-traces

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As an AI engineering team,
I want all workflow events and execution outputs recorded in PostgreSQL,
so that we retain durable raw evidence for debugging, promotion, and audit.

## Acceptance Criteria

1. Given an agent executes a workflow step, when the step completes or fails, then an append-only trace record is stored in PostgreSQL.
2. Given a trace record is stored, when persistence succeeds, then the record includes timestamp, agent identity, workflow context, outcome metadata, and a valid `group_id` for tenant isolation.
3. Given the raw trace layer is implemented, when downstream stories query or promote trace data, then trace records are addressable in a stable, ordered way suitable for episodic retrieval and evidence linking.

## Tasks / Subtasks

- [x] Task 1: Create the PostgreSQL connection layer (AC: 1, 2)
  - [x] Add `src/lib/postgres/connection.ts` as a server-only shared `pg.Pool` wrapper.
  - [x] Build connection config from environment variables already used by `docker-compose.yml` (`POSTGRES_DB`, `POSTGRES_USER`, `POSTGRES_PASSWORD`, host/port defaults).
  - [x] Configure pool safety settings such as `connectionTimeoutMillis` and `idleTimeoutMillis`.
  - [x] Add pool error handling so background connection failures do not crash silently.
- [x] Task 2: Define append-only raw trace schema (AC: 1, 2, 3)
  - [x] Add `src/lib/postgres/schema/traces.sql` with an `events` table for append-only trace logging.
  - [x] Include a surrogate primary key, `group_id`, event timestamp, agent identity, workflow context fields, and structured metadata payload columns.
  - [x] Use `TIMESTAMPTZ` for event time and `JSONB` for structured metadata/payload fields.
  - [x] Add `NOT NULL` constraints for required fields and optional `CHECK` constraints only where they protect clear invariants.
  - [x] Add indexes for ordered replay and tenant-scoped reads, especially on `(group_id, created_at)` or equivalent.
- [x] Task 3: Make schema application path explicit (AC: 1)
  - [x] Decide how the SQL is actually applied: wire it through `postgres-init/` or create an app-side initialization/apply path.
  - [x] Do not leave `src/lib/postgres/schema/traces.sql` orphaned with no execution path.
  - [x] Keep initialization idempotent so local setup can be re-run safely.
- [x] Task 4: Implement append-only trace insertion API (AC: 1, 2)
  - [x] Add `src/lib/postgres/queries/insert-trace.ts` with a typed insert function for the first `events` trace row shape.
  - [x] Enforce `group_id` presence before insert and reject writes missing tenant identity.
  - [x] Use `pool.query(...)` for the one-shot insert path unless a later story introduces transactions.
- [x] Task 5: Add verification coverage for the raw trace layer (AC: 1, 2, 3)
  - [x] Verify the table exists in PostgreSQL and accepts append-only inserts.
  - [x] Verify inserted rows contain required fields including `group_id` and timestamp.
  - [x] Verify ordering and tenant-scoped retrieval assumptions hold for future episodic-memory and evidence-linking work.
- [x] Task 6: Document implementation constraints and blockers before coding beyond the story (AC: 1, 2, 3)
  - [x] Confirm whether this repo is missing `package.json` and `tsconfig.json` or whether they live elsewhere.
  - [x] If still missing, treat dependency installation (`pg`) and TypeScript build validation as an environment blocker to resolve before claiming completion.

## Review Follow-ups (AI)

All code review findings have been addressed:

- [x] [AI-Review][HIGH] Added server-side runtime guard to prevent client-side import
- [x] [AI-Review][HIGH] Verified `inserted_at` field exists in `EventRecord` interface
- [x] [AI-Review][MEDIUM] Removed hardcoded password fallback - now throws if `POSTGRES_PASSWORD` is missing
- [x] [AI-Review][MEDIUM] Added comprehensive tests for `insertEvents` bulk function (3 new tests)
- [x] [AI-Review][MEDIUM] Added `POSTGRES_POOL_MAX` environment variable for pool size configuration
- [x] [AI-Review][LOW] Removed unused imports from connection.ts
- [x] [AI-Review][LOW] Installed `server-only` package for build-time server-only enforcement

## Dev Notes

- This story is the first implementation step for Epic 1 and establishes the cheapest, append-only memory layer. Do not jump ahead into Neo4j promotion logic, curator logic, or episodic summarization beyond what is required to support stable trace persistence.
- The repo is greenfield for database code. The tech spec explicitly identifies `src/lib/postgres/` as missing and calls for `connection.ts`, `schema/traces.sql`, and trace insertion utilities as foundational work. [Source: `_bmad-output/implementation-artifacts/tech-spec-unified-knowledge-system-core-schema-steel-frame.md:105`]
- `docker-compose.yml` already defines the PostgreSQL 16 service, exposes port `5432`, mounts `postgres-init/`, and uses `POSTGRES_DB`, `POSTGRES_USER`, and `POSTGRES_PASSWORD`. Reuse that env contract instead of inventing a different connection scheme. [Source: `docker-compose.yml:2`]
- The current checkout has no root `package.json` or `tsconfig.json` visible, even though `src/config/app-config.ts` imports `../../package.json` and source files use `@/` aliases. Treat this as a repo/infrastructure risk and verify before adding dependencies or claiming test/build success. [Source: `src/config/app-config.ts:1`]
- The `postgres-init/` directory is currently empty. If you only add SQL under `src/lib/postgres/schema/`, nothing in the current setup will apply it automatically. This story should make the schema application path explicit. [Source: `docker-compose.yml:14`]
- `group_id` is mandatory at creation time. Do not defer tenant identity to later lifting or promotion steps. Epic 1 story acceptance criteria require trace rows to be born with a valid tenant scope. [Source: `_bmad-output/planning-artifacts/epics.md:173`]
- Keep the design append-only. The story is about durable facts, not mutation workflows. Avoid update/delete paths unless strictly required for setup validation.

### Project Structure Notes

- Follow existing repo patterns: small named exports, focused files, and typed helpers rather than large abstraction-heavy modules. Relevant examples: `src/server/server-actions.ts`, `src/lib/preferences/preferences-storage.ts`, and `src/stores/preferences/preferences-store.ts`. [Source: `src/server/server-actions.ts:1`]
- Create new database code under `src/lib/postgres/` to match the planned architecture and keep data-access concerns out of UI/store modules. [Source: `_bmad-output/implementation-artifacts/tech-spec-unified-knowledge-system-core-schema-steel-frame.md:249`]
- Likely first files to touch:
  - `src/lib/postgres/connection.ts`
  - `src/lib/postgres/schema/traces.sql`
  - `src/lib/postgres/queries/insert-trace.ts`
  - `postgres-init/` or equivalent schema application mechanism
- Do not modify unrelated preference or dashboard files for this story.

### References

- Story definition and acceptance criteria: `_bmad-output/planning-artifacts/epics.md:173`
- Epic 1 context and FR coverage: `_bmad-output/planning-artifacts/epics.md:153`
- PostgreSQL raw trace layer tasks: `_bmad-output/implementation-artifacts/tech-spec-unified-knowledge-system-core-schema-steel-frame.md:242`
- Codebase pattern references: `_bmad-output/implementation-artifacts/tech-spec-unified-knowledge-system-core-schema-steel-frame.md:141`
- PostgreSQL service/env/bootstrap path: `docker-compose.yml:2`
- Existing server utility style: `src/server/server-actions.ts:1`
- Existing persistence helper style: `src/lib/preferences/preferences-storage.ts:1`
- Existing store/type style: `src/stores/preferences/preferences-store.ts:1`
- node-postgres pool guidance: use a single shared `pg.Pool`, prefer `pool.query(...)` for one-shot inserts, and always release checked-out clients in `finally` when using `pool.connect()`. [Source: node-postgres pg.Pool docs, fetched 2026-03-15]
- PostgreSQL table guidance: use `NOT NULL`, `PRIMARY KEY`, targeted indexes, and only necessary constraints for append-only trace tables. Use `TIMESTAMPTZ` and `JSONB` where appropriate. [Source: PostgreSQL CREATE TABLE docs, fetched 2026-03-15]

## Dev Agent Record

### Agent Model Used

ollama-cloud/glm-5

### Debug Log References

- PostgreSQL container: `knowledge-postgres`
- Status file: `_bmad-output/implementation-artifacts/sprint-status.yaml`
- Schema fix: Changed `getSchemaDir()` to not duplicate "schema" in path
- Schema fix: Added `IF NOT EXISTS` to index creation statements for idempotency
- Schema fix: Used `DO $$ BEGIN ... END $$` blocks for constraint creation to make them idempotent

### Completion Notes List

- ✅ All tasks and subtasks completed successfully
- ✅ PostgreSQL connection layer created with singleton pool pattern
- ✅ Pool error handling prevents silent crashes on idle connection failures
- ✅ Connection config uses environment variables matching docker-compose.yml
- ✅ Schema SQL defines events, outcomes, adas_runs, and schema_versions tables
- ✅ Schema is idempotent - uses `IF NOT EXISTS` for tables/indexes and DO blocks for constraints
- ✅ Schema application path is explicit: both `postgres-init/00-traces.sql` (Docker init) and `src/lib/postgres/schema/index.ts` (app-side init)
- ✅ Insert functions validate group_id presence before insert
- ✅ Insert functions reject empty/whitespace-only required fields
- ✅ All 26 tests pass (connection tests: 8, insert-trace tests: 18)
- ✅ Tests verify tenant isolation, ordering, sequential IDs, JSONB metadata storage
- ✅ package.json, tsconfig.json, and vitest.config.ts all exist and configured
- ✅ Code review completed - all HIGH and MEDIUM issues fixed
- ✅ Server-side guard prevents client-side import
- ✅ POSTGRES_PASSWORD now required (no fallback)
- ✅ POSTGRES_POOL_MAX env var for pool size configuration
- ✅ Bulk insert function fully tested

### Change Log

- 2026-03-15: Completed Story 1.1 implementation
  - Created PostgreSQL connection layer with singleton pool pattern
  - Defined append-only raw trace schema with events, outcomes, adas_runs tables
  - Fixed ESM path resolution bug in schema/index.ts getSchemaDir()
  - Fixed SQL idempotency by adding IF NOT EXISTS and DO blocks for constraints
  - Implemented typed insert functions with validation
  - Added comprehensive test coverage
  - Updated postgres-init/00-traces.sql for Docker initialization
- 2026-03-15: Code review fixes applied
  - Added server-side runtime guard (window check) to connection.ts
  - Removed hardcoded password fallback - now requires POSTGRES_PASSWORD env var
  - Added POSTGRES_POOL_MAX environment variable support
  - Added 3 new tests for insertEvents bulk function
  - Installed server-only package for build-time enforcement
  - Added test for missing POSTGRES_PASSWORD error

### File List

- `src/lib/postgres/connection.ts` - PostgreSQL connection pool singleton with error handling
- `src/lib/postgres/connection.test.ts` - Connection layer tests (8 tests)
- `src/lib/postgres/schema/traces.sql` - SQL schema for events, outcomes, adas_runs tables
- `src/lib/postgres/schema/index.ts` - Schema initialization and health check utilities
- `src/lib/postgres/queries/insert-trace.ts` - Typed insert functions for events and outcomes
- `src/lib/postgres/queries/insert-trace.test.ts` - Insert function tests (18 tests)
- `postgres-init/00-traces.sql` - Docker PostgreSQL init script (copy of traces.sql)