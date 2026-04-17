-- ============================================================================
-- Migration 19: group_id CHECK Constraints — Full Coverage
-- ============================================================================
-- PURPOSE:
--   Add CHECK (group_id ~ '^allura-[a-z0-9]([a-z0-9-]*[a-z0-9])?$') to ALL
--   tenant-scoped tables that have a group_id column. This pattern exactly
--   matches the application-level validation in src/lib/validation/group-id.ts
--   (GROUP_ID_RULES.PATTERN = /^allura-[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/).
--
-- PROBLEM:
--   Migration 02 added loose '^allura-' constraints to events and
--   design_sync_status. Other tables either have inline loose constraints
--   or no group_id format constraint at all. The loose pattern allows
--   trailing hyphens and other invalid formats (e.g., 'allura-') that
--   the application rejects.
--
-- STRATEGY:
--   - Drop any existing loose '^allura-' constraint, add the strict one
--   - For tables with NO group_id format constraint, add the strict one
--   - Tables already using '^allura-[a-z0-9-]+$' (ruvector_memory_fallback,
--     allura_memories) are left alone — they're strict enough for data
--     integrity, though technically allow trailing hyphens
--   - platform_insights uses group_id = 'allura-platform' (exact match)
--     which is stricter than regex — left alone
--   - All operations are idempotent (IF NOT EXISTS / IF EXISTS guards)
--   - Safe against tables that don't exist yet (IF EXISTS on table check)
--   - Safe against existing data: all current group_id values in production
--     match the strict pattern (they come through validateGroupId())
--
-- CONSTRAINT NAMES:
--   All constraints use the naming convention: chk_{table}_group_id_format
--   This replaces inconsistently named constraints from earlier migrations.
--
-- TABLES COVERED (17 tables + 1 source_group_id):
--   1.  adas_runs             — was only LENGTH>0
--   2.  approval_notifications — was only LENGTH>0
--   3.  approval_transitions   — was only LENGTH>0
--   4.  audit_analyses         — was loose '^allura-' (inline valid_group_id)
--   5.  audit_documents        — was loose '^allura-' (inline valid_group_id)
--   6.  canonical_proposals    — was loose '^allura-' (inline unnamed)
--   7.  checkpoints            — had NO group_id constraint
--   8.  curator_config         — was loose '^allura-' (chk_curator_config_group_prefix)
--   9.  curator_stats          — was loose '^allura-' (chk_curator_stats_group_prefix)
--  10.  design_sync_status     — was loose '^allura-' (chk_design_sync_group_format via 02)
--  11.  events                 — was loose '^allura-' (chk_events_group_id_format via 02)
--  12.  notion_sync_dlq        — was loose '^allura-' (inline unnamed)
--  13.  outcomes               — was only LENGTH>0
--  14.  promotion_proposals    — was only LENGTH>0
--  15.  suspicious_decisions   — was loose '^allura-' (inline valid_group_id)
--  16.  sync_drift_log         — had NO group_id constraint
--  17.  witness_logs           — had NO group_id constraint
--  18.  platform_promotion_queue (source_group_id) — was only LENGTH>0
--
-- EXCLUDED (already strict or special-cased):
--   - allura_memories: '^allura-[a-z0-9-]+$' — strict enough (migration 16)
--   - ruvector_memory_fallback: '^allura-[a-z0-9-]+$' — strict enough (migrations 12, 17)
--   - platform_insights: exact match group_id = 'allura-platform' — stricter than regex
-- ============================================================================

-- ============================================================================
-- 1. adas_runs
-- ============================================================================
-- Old: chk_adas_group_not_empty (LENGTH>0 only) — kept, no conflict
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'adas_runs') THEN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_adas_runs_group_id_format') THEN
      ALTER TABLE adas_runs ADD CONSTRAINT chk_adas_runs_group_id_format
        CHECK (group_id ~ '^allura-[a-z0-9]([a-z0-9-]*[a-z0-9])?$');
    END IF;
  END IF;
END $$;

-- ============================================================================
-- 2. approval_notifications
-- ============================================================================
-- Old: chk_notif_group_not_empty (LENGTH>0 only) — kept, no conflict
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'approval_notifications') THEN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_approval_notifications_group_id_format') THEN
      ALTER TABLE approval_notifications ADD CONSTRAINT chk_approval_notifications_group_id_format
        CHECK (group_id ~ '^allura-[a-z0-9]([a-z0-9-]*[a-z0-9])?$');
    END IF;
  END IF;
END $$;

-- ============================================================================
-- 3. approval_transitions
-- ============================================================================
-- Old: chk_trans_group_not_empty (LENGTH>0 only) — kept, no conflict
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'approval_transitions') THEN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_approval_transitions_group_id_format') THEN
      ALTER TABLE approval_transitions ADD CONSTRAINT chk_approval_transitions_group_id_format
        CHECK (group_id ~ '^allura-[a-z0-9]([a-z0-9-]*[a-z0-9])?$');
    END IF;
  END IF;
END $$;

-- ============================================================================
-- 4. audit_analyses
-- ============================================================================
-- Old: valid_group_id (loose '^allura-') — DROP and replace
DO $$
DECLARE
  v_old_name TEXT;
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'audit_analyses') THEN
    -- Find and drop the loose constraint named 'valid_group_id'
    SELECT conname INTO v_old_name FROM pg_constraint
    WHERE conrelid = 'audit_analyses'::regclass AND conname = 'valid_group_id';
    IF v_old_name IS NOT NULL THEN
      ALTER TABLE audit_analyses DROP CONSTRAINT valid_group_id;
    END IF;

    -- Add strict constraint
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_audit_analyses_group_id_format'
                   AND conrelid = 'audit_analyses'::regclass) THEN
      ALTER TABLE audit_analyses ADD CONSTRAINT chk_audit_analyses_group_id_format
        CHECK (group_id ~ '^allura-[a-z0-9]([a-z0-9-]*[a-z0-9])?$');
    END IF;
  END IF;
END $$;

-- ============================================================================
-- 5. audit_documents
-- ============================================================================
-- Old: valid_group_id (loose '^allura-') — DROP and replace
DO $$
DECLARE
  v_old_name TEXT;
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'audit_documents') THEN
    SELECT conname INTO v_old_name FROM pg_constraint
    WHERE conrelid = 'audit_documents'::regclass AND conname = 'valid_group_id';
    IF v_old_name IS NOT NULL THEN
      ALTER TABLE audit_documents DROP CONSTRAINT valid_group_id;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_audit_documents_group_id_format'
                   AND conrelid = 'audit_documents'::regclass) THEN
      ALTER TABLE audit_documents ADD CONSTRAINT chk_audit_documents_group_id_format
        CHECK (group_id ~ '^allura-[a-z0-9]([a-z0-9-]*[a-z0-9])?$');
    END IF;
  END IF;
END $$;

-- ============================================================================
-- 6. canonical_proposals
-- ============================================================================
-- Old: auto-generated inline CHECK (group_id ~ '^allura-') from migration 11
-- The inline constraint has a PostgreSQL-generated name like
-- "canonical_proposals_group_id_check". Find by pattern and drop.
DO $$
DECLARE
  v_old_name TEXT;
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'canonical_proposals') THEN
    -- Find the auto-generated inline group_id format constraint
    -- (not the not_empty one, not our new one)
    SELECT c.conname INTO v_old_name
    FROM pg_constraint c
    JOIN pg_class cls ON cls.oid = c.conrelid
    JOIN pg_attribute a ON a.attrelid = c.conrelid AND a.attnum = ANY(c.conkey)
    WHERE cls.relname = 'canonical_proposals'
      AND c.contype = 'c'
      AND a.attname = 'group_id'
      AND c.conname NOT IN (
        'canonical_proposals_group_id_not_empty',
        'chk_canonical_proposals_group_id_format'
      )
      -- Match constraints that contain '^allura-' in their definition
      AND pg_get_constraintdef(c.oid) LIKE '%allura-%';

    IF v_old_name IS NOT NULL THEN
      EXECUTE format('ALTER TABLE canonical_proposals DROP CONSTRAINT %I', v_old_name);
    END IF;

    -- Add strict constraint
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_canonical_proposals_group_id_format'
                   AND conrelid = 'canonical_proposals'::regclass) THEN
      ALTER TABLE canonical_proposals ADD CONSTRAINT chk_canonical_proposals_group_id_format
        CHECK (group_id ~ '^allura-[a-z0-9]([a-z0-9-]*[a-z0-9])?$');
    END IF;
  END IF;
END $$;

-- ============================================================================
-- 7. checkpoints
-- ============================================================================
-- No group_id format constraint at all
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'checkpoints') THEN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_checkpoints_group_id_format'
                   AND conrelid = 'checkpoints'::regclass) THEN
      ALTER TABLE checkpoints ADD CONSTRAINT chk_checkpoints_group_id_format
        CHECK (group_id ~ '^allura-[a-z0-9]([a-z0-9-]*[a-z0-9])?$');
    END IF;
  END IF;
END $$;

-- ============================================================================
-- 8. curator_config
-- ============================================================================
-- Old: chk_curator_config_group_prefix (loose '^allura-') — DROP and replace
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'curator_config') THEN
    -- Drop old loose constraint
    IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_curator_config_group_prefix'
               AND conrelid = 'curator_config'::regclass) THEN
      ALTER TABLE curator_config DROP CONSTRAINT chk_curator_config_group_prefix;
    END IF;

    -- Add strict constraint
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_curator_config_group_id_format'
                   AND conrelid = 'curator_config'::regclass) THEN
      ALTER TABLE curator_config ADD CONSTRAINT chk_curator_config_group_id_format
        CHECK (group_id ~ '^allura-[a-z0-9]([a-z0-9-]*[a-z0-9])?$');
    END IF;
  END IF;
END $$;

-- ============================================================================
-- 9. curator_stats
-- ============================================================================
-- Old: chk_curator_stats_group_prefix (loose '^allura-') — DROP and replace
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'curator_stats') THEN
    IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_curator_stats_group_prefix'
               AND conrelid = 'curator_stats'::regclass) THEN
      ALTER TABLE curator_stats DROP CONSTRAINT chk_curator_stats_group_prefix;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_curator_stats_group_id_format'
                   AND conrelid = 'curator_stats'::regclass) THEN
      ALTER TABLE curator_stats ADD CONSTRAINT chk_curator_stats_group_id_format
        CHECK (group_id ~ '^allura-[a-z0-9]([a-z0-9-]*[a-z0-9])?$');
    END IF;
  END IF;
END $$;

-- ============================================================================
-- 10. design_sync_status
-- ============================================================================
-- Old: chk_design_sync_group_format (loose '^allura-' from migration 02) — DROP and replace
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'design_sync_status') THEN
    IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_design_sync_group_format'
               AND conrelid = 'design_sync_status'::regclass) THEN
      ALTER TABLE design_sync_status DROP CONSTRAINT chk_design_sync_group_format;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_design_sync_status_group_id_format'
                   AND conrelid = 'design_sync_status'::regclass) THEN
      ALTER TABLE design_sync_status ADD CONSTRAINT chk_design_sync_status_group_id_format
        CHECK (group_id ~ '^allura-[a-z0-9]([a-z0-9-]*[a-z0-9])?$');
    END IF;
  END IF;
END $$;

-- ============================================================================
-- 11. events
-- ============================================================================
-- Old: chk_events_group_id_format (loose '^allura-' from migration 02) — DROP and replace
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'events') THEN
    IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_events_group_id_format'
               AND conrelid = 'events'::regclass) THEN
      ALTER TABLE events DROP CONSTRAINT chk_events_group_id_format;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_events_group_id_strict_format'
                   AND conrelid = 'events'::regclass) THEN
      ALTER TABLE events ADD CONSTRAINT chk_events_group_id_strict_format
        CHECK (group_id ~ '^allura-[a-z0-9]([a-z0-9-]*[a-z0-9])?$');
    END IF;
  END IF;
END $$;

-- ============================================================================
-- 12. notion_sync_dlq
-- ============================================================================
-- Old: auto-generated inline CHECK (group_id ~ '^allura-') from migration 14
DO $$
DECLARE
  v_old_name TEXT;
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'notion_sync_dlq') THEN
    -- Find auto-generated inline constraint on group_id
    SELECT c.conname INTO v_old_name
    FROM pg_constraint c
    JOIN pg_class cls ON cls.oid = c.conrelid
    JOIN pg_attribute a ON a.attrelid = c.conrelid AND a.attnum = ANY(c.conkey)
    WHERE cls.relname = 'notion_sync_dlq'
      AND c.contype = 'c'
      AND a.attname = 'group_id'
      AND c.conname NOT IN (
        'chk_dlq_group_not_empty',
        'chk_notion_sync_dlq_group_id_format'
      )
      AND pg_get_constraintdef(c.oid) LIKE '%allura-%';

    IF v_old_name IS NOT NULL THEN
      EXECUTE format('ALTER TABLE notion_sync_dlq DROP CONSTRAINT %I', v_old_name);
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_notion_sync_dlq_group_id_format'
                   AND conrelid = 'notion_sync_dlq'::regclass) THEN
      ALTER TABLE notion_sync_dlq ADD CONSTRAINT chk_notion_sync_dlq_group_id_format
        CHECK (group_id ~ '^allura-[a-z0-9]([a-z0-9-]*[a-z0-9])?$');
    END IF;
  END IF;
END $$;

-- ============================================================================
-- 13. outcomes
-- ============================================================================
-- Old: chk_outcomes_group_not_empty (LENGTH>0 only) — kept, no conflict
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'outcomes') THEN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_outcomes_group_id_format'
                   AND conrelid = 'outcomes'::regclass) THEN
      ALTER TABLE outcomes ADD CONSTRAINT chk_outcomes_group_id_format
        CHECK (group_id ~ '^allura-[a-z0-9]([a-z0-9-]*[a-z0-9])?$');
    END IF;
  END IF;
END $$;

-- ============================================================================
-- 14. promotion_proposals
-- ============================================================================
-- Old: chk_proposal_group_not_empty (LENGTH>0 only) — kept, no conflict
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'promotion_proposals') THEN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_promotion_proposals_group_id_format'
                   AND conrelid = 'promotion_proposals'::regclass) THEN
      ALTER TABLE promotion_proposals ADD CONSTRAINT chk_promotion_proposals_group_id_format
        CHECK (group_id ~ '^allura-[a-z0-9]([a-z0-9-]*[a-z0-9])?$');
    END IF;
  END IF;
END $$;

-- ============================================================================
-- 15. suspicious_decisions
-- ============================================================================
-- Old: valid_group_id (loose '^allura-') — DROP and replace
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'suspicious_decisions') THEN
    IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'valid_group_id'
               AND conrelid = 'suspicious_decisions'::regclass) THEN
      ALTER TABLE suspicious_decisions DROP CONSTRAINT valid_group_id;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_suspicious_decisions_group_id_format'
                   AND conrelid = 'suspicious_decisions'::regclass) THEN
      ALTER TABLE suspicious_decisions ADD CONSTRAINT chk_suspicious_decisions_group_id_format
        CHECK (group_id ~ '^allura-[a-z0-9]([a-z0-9-]*[a-z0-9])?$');
    END IF;
  END IF;
END $$;

-- ============================================================================
-- 16. sync_drift_log
-- ============================================================================
-- No group_id format constraint at all
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'sync_drift_log') THEN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_sync_drift_log_group_id_format'
                   AND conrelid = 'sync_drift_log'::regclass) THEN
      ALTER TABLE sync_drift_log ADD CONSTRAINT chk_sync_drift_log_group_id_format
        CHECK (group_id ~ '^allura-[a-z0-9]([a-z0-9-]*[a-z0-9])?$');
    END IF;
  END IF;
END $$;

-- ============================================================================
-- 17. witness_logs
-- ============================================================================
-- No group_id format constraint at all
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'witness_logs') THEN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_witness_logs_group_id_format'
                   AND conrelid = 'witness_logs'::regclass) THEN
      ALTER TABLE witness_logs ADD CONSTRAINT chk_witness_logs_group_id_format
        CHECK (group_id ~ '^allura-[a-z0-9]([a-z0-9-]*[a-z0-9])?$');
    END IF;
  END IF;
END $$;

-- ============================================================================
-- 18. platform_promotion_queue (source_group_id column)
-- ============================================================================
-- Old: chk_promo_group_not_empty (LENGTH>0 only on source_group_id) — kept, no conflict
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'platform_promotion_queue') THEN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_promo_queue_source_group_id_format'
                   AND conrelid = 'platform_promotion_queue'::regclass) THEN
      ALTER TABLE platform_promotion_queue ADD CONSTRAINT chk_promo_queue_source_group_id_format
        CHECK (source_group_id ~ '^allura-[a-z0-9]([a-z0-9-]*[a-z0-9])?$');
    END IF;
  END IF;
END $$;

-- ============================================================================
-- Schema version tracking
-- ============================================================================
INSERT INTO schema_versions (version, applied_at, description)
VALUES (
    '019',
    NOW(),
    'Group ID strict CHECK constraints on all 17 tenant-scoped tables + source_group_id — aligns DB with src/lib/validation/group-id.ts'
) ON CONFLICT (version) DO NOTHING;