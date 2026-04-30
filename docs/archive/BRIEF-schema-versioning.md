# BRIEF: Schema Versioning (FR-1, FR-2, NFR-3)

## Objective
Add explicit `schema_version` fields to all memory artifacts and retrieval payloads, with compatibility validation on read/write. This is the critical-path item from the Hardening PRD — without it, schema changes (like embedding dimension migrations) silently corrupt old data.

## Current State
- No `schema_version` field exists anywhere in the codebase
- The Qwen3 embedding upgrade already happened (768d→1024d) without version tracking — we got lucky
- Existing data: 241 rows in `allura_memories` (PG), 81 `:Memory`/`:Insight` nodes in Neo4j

## Architecture Decisions (from PRD)
1. Every write stores an explicit version field
2. Every read validates schema compatibility — reject or route through migration
3. New versions never overwrite old records in place — they create new versioned artifacts
4. Prior versions are preserved for audit and rollback
5. Backward compatibility is required (NFR-3)

## Implementation Plan

### Step 1: Define Schema Version Constants
- Create `src/lib/schema-version.ts` with:
  - `CURRENT_SCHEMA_VERSION = 1` (semver minor for compatible changes, major for breaking)
  - `MIN_SUPPORTED_VERSION = 1`
  - `SchemaVersion` type (number or semver string — recommend number for simplicity)
  - `isCompatibleVersion(version: number): boolean` — checks MIN_SUPPORTED_VERSION <= version <= CURRENT
  - `migratePayload(version: number, data: unknown): unknown` — placeholder migration router

### Step 2: Add `schema_version` to PostgreSQL Writes
- In `src/lib/postgres/queries/` — add `schema_version` column to `allura_memories` table
- Migration: `ALTER TABLE allura_memories ADD COLUMN IF NOT EXISTS schema_version INTEGER NOT NULL DEFAULT 1`
- Update all INSERT queries to include `schema_version = CURRENT_SCHEMA_VERSION`
- Update all SELECT queries to include `schema_version` in result rows

### Step 3: Add `schema_version` to Neo4j Nodes
- Add `schema_version` property to all `:Memory` and `:Insight` nodes on write
- Update `createMemory`, `createInsight`, and `promoteMemory` Cypher queries to SET `m.schema_version = $version`
- Backfill: `MATCH (m:Memory) WHERE m.schema_version IS NULL SET m.schema_version = 1` (same for :Insight)

### Step 4: Add `schema_version` to Retrieval Gateway
- Add `schema_version` to `SearchResponse` and `MemoryResult` types in `src/lib/retrieval/contract.ts`
- In `gateway.ts`, validate version on every read — if incompatible, return error or route through migration
- In `policy.ts`, add version compatibility check to policy enforcement

### Step 5: Add `schema_version` to Events Table
- Add `schema_version` column to `allura_events` table
- All event writes include current version
- This gives audit trail for schema changes

### Step 6: Backfill Migration
- Write `scripts/backfill-schema-version.ts`:
  - PG: `UPDATE allura_memories SET schema_version = 1 WHERE schema_version IS NULL`
  - Neo4j: `MATCH (m) WHERE m.schema_version IS NULL SET m.schema_version = 1` (both :Memory and :Insight)
  - Verify counts match expectations
- Make it idempotent and safe to re-run

### Step 7: Tests
- `src/__tests__/schema-versioning.test.ts`:
  - Write with version → stored correctly
  - Read with current version → passes validation
  - Read with future version → rejected or flagged
  - Read with too-old version → migration path or error
  - Backfill script sets version on all existing data

## Files to Touch
- `src/lib/schema-version.ts` (NEW)
- `src/lib/retrieval/contract.ts` — add schema_version to types
- `src/lib/retrieval/gateway.ts` — validate on read
- `src/lib/retrieval/policy.ts` — version compatibility policy
- `src/lib/graph-adapter/neo4j-adapter.ts` — add schema_version to Cypher queries
- `src/lib/postgres/queries/*.ts` — add schema_version to SQL queries
- `src/app/api/memory/search/route.ts` — include schema_version in response
- `src/app/api/memory/get/route.ts` — include schema_version in response
- `scripts/backfill-schema-version.ts` (NEW)
- `src/__tests__/schema-versioning.test.ts` (NEW)
- `vitest.config.ts` — include new test file

## Verification Steps
1. `npx tsc --noEmit` — zero type errors
2. `pnpm test` — all existing tests pass
3. `npx vitest run src/__tests__/schema-versioning.test.ts` — new tests pass
4. `bun run scripts/backfill-schema-version.ts` — idempotent, sets version=1 on all existing data
5. Verify PG: `SELECT schema_version, count(*) FROM allura_memories GROUP BY schema_version` — all rows = 1
6. Verify Neo4j: `MATCH (m) WHERE m:Memory OR m:Insight RETURN m.schema_version, count(*)` — all = 1

## Definition of Done
- Every memory write path includes explicit `schema_version`
- Every read path validates compatibility
- Backfill script successfully versions all existing data
- All tests pass with zero TypeScript errors
- Migration path exists for future schema changes