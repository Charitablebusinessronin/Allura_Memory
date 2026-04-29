-- ============================================================================
-- Migration: Add schema_version column (FR-1, FR-2, NFR-3)
-- ============================================================================
--
-- Adds schema_version to:
--   1. allura_memories (RuVector PG) — for episodic memory compatibility
--   2. events (Main PG) — for event trace compatibility
--
-- Default value: 1 (current schema version)
-- Nullable: NO — every row MUST have a version
-- Backfill: SET schema_version = 1 WHERE schema_version IS NULL (idempotent)
--
-- This migration MUST be applied to both:
--   - Main PostgreSQL (port 5432, database: allura_memory) → events table
--   - RuVector PostgreSQL (port 5433, database: memory) → allura_memories table
-- ============================================================================

-- ============================================================================
-- 1. events table (Main PG) — add schema_version
-- ============================================================================

DO $$
BEGIN
  -- Add schema_version column if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'events'
      AND column_name = 'schema_version'
  ) THEN
    ALTER TABLE events ADD COLUMN schema_version INTEGER NOT NULL DEFAULT 1;
    COMMENT ON COLUMN events.schema_version IS
      'Schema version for compatibility checks (FR-1). '
      'Version 1 = initial schema. Increment on data model changes. '
      'Reads validate compatibility; writes always store CURRENT_SCHEMA_VERSION.';
  END IF;
END $$;

-- Backfill: set schema_version = 1 for all existing rows (idempotent)
UPDATE events SET schema_version = 1 WHERE schema_version = 1;
-- This is a no-op idempotent statement; actual backfill for NULL values
-- is handled by the DEFAULT 1 constraint above. For safety:
UPDATE events SET schema_version = 1 WHERE schema_version IS NULL;

-- ============================================================================
-- 2. allura_memories table (RuVector PG) — add schema_version
-- ============================================================================
-- NOTE: This section MUST be run on the RuVector PG instance separately.
-- The DO block guards against re-execution.

DO $$
BEGIN
  -- Check if allura_memories table exists (only on RuVector PG)
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_name = 'allura_memories'
  ) THEN
    -- Add schema_version column if it doesn't exist
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = 'allura_memories'
        AND column_name = 'schema_version'
    ) THEN
      ALTER TABLE allura_memories ADD COLUMN schema_version INTEGER NOT NULL DEFAULT 1;
      COMMENT ON COLUMN allura_memories.schema_version IS
        'Schema version for compatibility checks (FR-1). '
        'Version 1 = initial schema. Increment on data model changes.';
    END IF;

    -- Backfill: set schema_version = 1 for all existing rows (idempotent)
    UPDATE allura_memories SET schema_version = 1 WHERE schema_version IS NULL;
  END IF;
END $$;

-- ============================================================================
-- 3. Record this migration
-- ============================================================================

INSERT INTO schema_versions (version, description)
VALUES ('1.1.0-schema-version', 'Add schema_version column to events and allura_memories tables (FR-1, FR-2, NFR-3)')
ON CONFLICT (version) DO NOTHING;