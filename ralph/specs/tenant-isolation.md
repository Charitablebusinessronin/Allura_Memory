# Tenant Isolation — group_id Enforcement

**Source**: Requirements Matrix B2/F6/F10, ARCH-001

## What

Tenant isolation at both schema level (PostgreSQL CHECK constraint) and engine level (application-layer enforcer):

1. **Schema-level** — `group_id` CHECK constraint on `events` table: `group_id ~ '^allura-[a-z0-9-]+$'`. Rejects invalid group_id at DB layer.
2. **Application-level** — `groupIdEnforcer.ts` validates `group_id` format before any DB call. Rejects early, before query execution.
3. **Query-level** — Every SELECT/INSERT must include `WHERE group_id = ?`. No cross-tenant queries possible.
4. **Neo4j-level** — All Cypher queries include `group_id` in MATCH/CREATE clauses. Knowledge graph nodes are tenant-scoped.

## Acceptance Criteria

- `groupIdEnforcer.ts` rejects invalid `group_id` at application layer (BUG: ARCH-001 — current enforcer has a bug, must fix)
- Postgres CHECK constraint on `events.group_id` column
- No query path exists that can read/write across tenants
- Every DB operation (Postgres + Neo4j) includes `group_id` in its WHERE clause
- Test suite verifies isolation: inserting with group_id=A cannot be read by querying with group_id=B
- `bun run typecheck && bun test` passes

## Current Blocker

**ARCH-001**: `groupIdEnforcer.ts` has a known bug. This is a hard gate — unblocks everything else (Curator, Docker migration, memory viewer).

## Key Files

- `src/lib/security/groupIdEnforcer.ts` — Application-layer enforcer
- `docker/postgres-init/001_schema.sql` — Schema with CHECK constraint
- `src/lib/postgres/connection.ts` — Postgres connection pool
- `src/lib/memory/writer.ts` — memory() wrapper (must route through enforcer)

## Constraints

- group_id format: `^allura-[a-z0-9-]+$`
- group_id required on EVERY DB operation — no exceptions
- No cross-tenant leakage — this is a security invariant
- Fix ARCH-001 before any other work proceeds