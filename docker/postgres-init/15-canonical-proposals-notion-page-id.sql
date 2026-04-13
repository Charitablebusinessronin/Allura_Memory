-- Migration 15: Add notion_page_id to canonical_proposals
-- Fixes: queryApprovedInsights() crash — column did not exist in schema
ALTER TABLE canonical_proposals ADD COLUMN IF NOT EXISTS notion_page_id TEXT;
ALTER TABLE canonical_proposals ADD COLUMN IF NOT EXISTS notion_synced_at TIMESTAMPTZ;
CREATE INDEX IF NOT EXISTS idx_canonical_proposals_notion_page_id ON canonical_proposals(notion_page_id) WHERE notion_page_id IS NOT NULL;
