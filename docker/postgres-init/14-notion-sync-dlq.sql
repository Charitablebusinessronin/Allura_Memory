-- Notion Sync Dead Letter Queue (DLQ)
-- Story: Notion Sync Resilience — Zero Event Drop Rate
--
-- When notion_sync_pending events fail to create Notion pages,
-- they are routed here with exponential backoff retry scheduling.
-- After MAX_RETRIES (5) failed attempts, entries are marked
-- permanently_failed for manual intervention.
--
-- Flow:
-- 1. notion_sync_pending event fails → insert into notion_sync_dlq
-- 2. DLQ worker retries with backoff: 1m, 5m, 15m, 1h, 6h
-- 3. On success → mark completed, update original event
-- 4. After 5 failures → mark permanently_failed, alert

-- ============================================================================
-- NOTION SYNC DLQ: Dead letter queue for Notion sync failures
-- ============================================================================
CREATE TABLE IF NOT EXISTS notion_sync_dlq (
  -- Surrogate primary key
  id BIGSERIAL PRIMARY KEY,

  -- Mandatory tenant isolation (ARCH-001: allura-* naming)
  group_id VARCHAR(255) NOT NULL CHECK (group_id ~ '^allura-'),

  -- Reference to the original event that failed
  original_event_id BIGINT REFERENCES events(id) ON DELETE SET NULL,

  -- Reference to the canonical proposal
  proposal_id UUID REFERENCES canonical_proposals(id) ON DELETE SET NULL,

  -- Original event data (preserved for retry)
  original_event_type VARCHAR(100) NOT NULL DEFAULT 'notion_sync_pending',
  original_metadata JSONB NOT NULL DEFAULT '{}'::jsonb,

  -- Error tracking
  error_message TEXT NOT NULL,
  error_code VARCHAR(50),

  -- Retry scheduling with exponential backoff
  retry_count INTEGER NOT NULL DEFAULT 0,
  max_retries INTEGER NOT NULL DEFAULT 5,
  next_retry_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_retry_at TIMESTAMPTZ,

  -- Status: pending_retry | retrying | completed | permanently_failed
  status VARCHAR(50) NOT NULL DEFAULT 'pending_retry'
    CHECK (status IN ('pending_retry', 'retrying', 'completed', 'permanently_failed')),

  -- Backoff schedule (in seconds): 60, 300, 900, 3600, 21600
  -- 1min, 5min, 15min, 1hr, 6hr
  backoff_schedule INTEGER[] NOT NULL DEFAULT ARRAY[60, 300, 900, 3600, 21600],

  -- Notion page info (filled on successful retry)
  notion_page_id VARCHAR(255),
  notion_page_url TEXT,

  -- Audit
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- Ensure group_id is not empty
  CONSTRAINT chk_dlq_group_not_empty CHECK (LENGTH(TRIM(group_id)) > 0),
  -- Ensure retry_count doesn't exceed max_retries
  CONSTRAINT chk_dlq_retry_bounds CHECK (retry_count >= 0 AND retry_count <= max_retries)
);

-- ============================================================================
-- INDEXES: Performance optimization
-- ============================================================================

-- Primary query: find entries ready for retry (tenant-scoped)
CREATE INDEX IF NOT EXISTS idx_dlq_retry_ready
  ON notion_sync_dlq(group_id, status, next_retry_at)
  WHERE status IN ('pending_retry', 'retrying');

-- Find permanently failed entries for alerting
CREATE INDEX IF NOT EXISTS idx_dlq_permanently_failed
  ON notion_sync_dlq(group_id, status, created_at DESC)
  WHERE status = 'permanently_failed';

-- Trace back to original event
CREATE INDEX IF NOT EXISTS idx_dlq_original_event
  ON notion_sync_dlq(original_event_id)
  WHERE original_event_id IS NOT NULL;

-- Trace back to proposal
CREATE INDEX IF NOT EXISTS idx_dlq_proposal
  ON notion_sync_dlq(proposal_id)
  WHERE proposal_id IS NOT NULL;

-- ============================================================================
-- HELPER: Calculate next retry time based on attempt count
-- ============================================================================
-- This function computes the next_retry_at timestamp using exponential backoff.
-- The backoff schedule is: 1min, 5min, 15min, 1hr, 6hr
-- After the 5th attempt, the entry is marked permanently_failed.

CREATE OR REPLACE FUNCTION dlq_next_retry_at(attempt_count INTEGER)
RETURNS TIMESTAMPTZ AS $$
DECLARE
  schedule INTEGER[] := ARRAY[60, 300, 900, 3600, 21600];
  delay_seconds INTEGER;
BEGIN
  -- Clamp to last schedule entry if beyond array bounds
  IF attempt_count > array_length(schedule, 1) THEN
    delay_seconds := schedule[array_length(schedule, 1)];
  ELSE
    delay_seconds := schedule[LEAST(attempt_count, array_length(schedule, 1))];
  END IF;

  RETURN NOW() + (delay_seconds || ' seconds')::INTERVAL;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- ============================================================================
-- SCHEMA VERSION TRACKING
-- ============================================================================
INSERT INTO schema_versions (version, applied_at, description)
VALUES (
  '014',
  NOW(),
  'Notion Sync DLQ — dead letter queue for Notion sync failures with exponential backoff'
) ON CONFLICT (version) DO NOTHING;