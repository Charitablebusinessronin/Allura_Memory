-- SQL Migration File: 02_group_id_enforcement.sql
-- Purpose: Enforce group_id format constraint for tenant isolation
-- Design: All group_id values must match ^allura- pattern

-- ============================================================================
-- Add CHECK constraint for group_id format
-- ============================================================================

-- Enforce group_id format: must start with 'allura-'
-- This provides schema-level tenant isolation enforcement
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_events_group_id_format') THEN
    ALTER TABLE events ADD CONSTRAINT chk_events_group_id_format
      CHECK (group_id ~ '^allura-');
  END IF;
END $$;

-- ============================================================================
-- Add group_id format constraint to design_sync_status if it exists
-- ============================================================================

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'design_sync_status') THEN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_design_sync_group_format') THEN
      ALTER TABLE design_sync_status ADD CONSTRAINT chk_design_sync_group_format
        CHECK (group_id ~ '^allura-');
    END IF;
  END IF;
END $$;

-- ============================================================================
-- Schema version tracking
-- ============================================================================

INSERT INTO schema_versions (version, applied_at, description)
VALUES (
    '002',
    NOW(),
    'Group ID format enforcement - CHECK constraint for ^allura- pattern'
) ON CONFLICT (version) DO NOTHING;