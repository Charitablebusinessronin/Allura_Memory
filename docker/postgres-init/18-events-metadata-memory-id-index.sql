-- ============================================================================
-- Migration 18: Expression index on events.metadata->>'memory_id'
-- ============================================================================
--
-- Adds a partial expression index for the common query pattern:
--   WHERE metadata->>'memory_id' = $1
--
-- This optimizes memory-trace lookups where the events table stores
-- a JSONB metadata payload and callers filter by memory_id.
--
-- CONCURRENCY NOTE:
-- CREATE INDEX CONCURRENTLY cannot run inside a transaction, and Docker
-- init scripts execute within transactions. We use a DO $$ block with
-- pg_indexes check instead, which is safe inside a transaction and
-- idempotent across re-executions.
--
-- COMPOSITE INDEX NOTE:
-- The allura_memories table already has allura_mem_group_time on
-- (group_id, created_at DESC) from migration 16. A second index with a
-- different name but the same columns would be redundant, so that index
-- is intentionally omitted here.
-- ============================================================================

DO $$
BEGIN
  -- Expression index on the memory_id key inside metadata JSONB
  -- Partial: only index rows where memory_id is actually set
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE indexname = 'idx_events_metadata_memory_id'
  ) THEN
    CREATE INDEX idx_events_metadata_memory_id
      ON events ((metadata->>'memory_id'))
      WHERE metadata->>'memory_id' IS NOT NULL;
  END IF;
END
$$;