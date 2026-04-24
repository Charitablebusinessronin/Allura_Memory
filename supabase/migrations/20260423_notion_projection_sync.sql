-- Notion Projection Sync Log
-- Sprint 8 P3: Live Event → Notion Sync
-- Reference: docs/allura/SPRINT-PLAN.md

BEGIN;

-- Notion sync log: idempotent, append-only record of every sync attempt
-- sync_key is SHAKE-256(event_id | target_type) — deduplicates re-syncs
CREATE TABLE IF NOT EXISTS notion_sync_log (
  id BIGSERIAL PRIMARY KEY,
  sync_key TEXT NOT NULL UNIQUE,  -- idempotent key: SHAKE-256(event_id|target_type)
  event_id BIGINT NOT NULL REFERENCES events(id),
  target_type TEXT NOT NULL CHECK (target_type IN ('proposal', 'insight', 'tool_approval', 'execution_event')),
  group_id VARCHAR(255) NOT NULL CHECK (group_id ~ '^allura-'),
  status TEXT NOT NULL CHECK (status IN ('completed', 'failed')),
  notion_page_id TEXT,  -- Notion page ID if successful
  error_message TEXT,    -- Error details if failed
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index for fast dedup lookups
CREATE INDEX IF NOT EXISTS idx_notion_sync_log_key ON notion_sync_log(sync_key);
CREATE INDEX IF NOT EXISTS idx_notion_sync_log_event ON notion_sync_log(event_id);
CREATE INDEX IF NOT EXISTS idx_notion_sync_log_status ON notion_sync_log(status);

-- Extend notion_sync_dlq to support new target types
-- (existing DLQ already handles notion_sync_pending events)
-- Add projection_type column for tracking which projection failed
ALTER TABLE notion_sync_dlq ADD COLUMN IF NOT EXISTS projection_type TEXT
  CHECK (projection_type IN ('proposal', 'insight', 'tool_approval', 'execution_event'));

COMMIT;