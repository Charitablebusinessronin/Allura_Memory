-- RuVector Memory Fallback Table — RuVector PG Sync
--
-- MIGRATION: 17-ruvector-fallback-sync.sql
-- DATE:      2026-04-13
-- AUTHOR:    knuth (Data Architect)
--
-- PROBLEM:
--   The `ruvector_memory_fallback` table was originally created by
--   `12-ruvector-fallback.sql`, which runs ONLY on the main PostgreSQL
--   instance (port 5432) via Docker init scripts. However, the application
--   code in `src/lib/memory/store.ts` writes fallback rows via
--   `getRuVectorPool()`, which connects to the RuVector PostgreSQL instance
--   (port 5433). The table did NOT exist on RuVector PG, causing silent
--   write failures when Neo4j was down — the exact scenario the fallback
--   is supposed to handle.
--
-- FIX:
--   This migration contains the EXACT same DDL as `12-ruvector-fallback.sql`
--   so that the table is created on BOTH PostgreSQL instances. The table
--   was manually created on the running RuVector instance as an immediate
--   fix. This file ensures idempotent creation on future container rebuilds.
--
-- INVARIANT:
--   The `ruvector_memory_fallback` table MUST exist on BOTH:
--     - Main PG:    port 5432 (created by 12-ruvector-fallback.sql)
--     - RuVector PG: port 5433 (created by this file)
--
--   Any future schema changes to this table MUST be applied to both
--   migration files (12 and 17) to maintain parity.

CREATE TABLE IF NOT EXISTS ruvector_memory_fallback (
  id                TEXT        NOT NULL,
  group_id          TEXT        NOT NULL CHECK (group_id ~ '^allura-[a-z0-9-]+$'),
  topic_key         TEXT        NOT NULL,
  content           TEXT        NOT NULL,
  summary           TEXT,
  confidence        FLOAT       NOT NULL DEFAULT 0.5,
  status            TEXT        NOT NULL DEFAULT 'draft',
  version           INTEGER     NOT NULL DEFAULT 1,
  tags              JSONB       NOT NULL DEFAULT '[]'::jsonb,
  metadata          JSONB       NOT NULL DEFAULT '{}'::jsonb,
  trace_ref         TEXT,
  replayed_to_neo4j BOOLEAN     NOT NULL DEFAULT FALSE,
  replayed_at       TIMESTAMPTZ,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  PRIMARY KEY (id),
  UNIQUE (topic_key, group_id)
);

CREATE INDEX IF NOT EXISTS idx_ruvector_fallback_group
  ON ruvector_memory_fallback (group_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_ruvector_fallback_pending
  ON ruvector_memory_fallback (replayed_to_neo4j, created_at)
  WHERE replayed_to_neo4j = FALSE;

COMMENT ON TABLE ruvector_memory_fallback IS
  'Fallback store for memory writes when Neo4j is degraded. '
  'Rows are replayed to Neo4j once it recovers. Never mutate — append only. '
  'This table is replicated on BOTH main PG (5432) and RuVector PG (5433).';