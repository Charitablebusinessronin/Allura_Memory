-- Story 1.2: NOTION_SYNC Workflow
-- PostgreSQL schema for tracking Notion sync status
-- Tracks trace → Notion promotion workflow states

CREATE TABLE IF NOT EXISTS notion_sync_log (
  -- Primary key
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Tenant isolation - REQUIRED (RK-01: must match allura-{org} pattern)
  group_id TEXT NOT NULL,
  
  -- PostgreSQL trace reference
  trace_id TEXT NOT NULL,
  
  -- Notion page reference
  notion_page_id TEXT NOT NULL,
  
  -- Status: 'draft' (synced, awaiting review), 'reviewed' (approved), 'promoted' (promoted to Neo4j)
  status TEXT NOT NULL DEFAULT 'draft',
  
  -- Sync timestamp
  synced_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  -- Review metadata
  reviewed_by TEXT,
  reviewed_at TIMESTAMPTZ,
  
  -- Promotion flag
  promoted BOOLEAN NOT NULL DEFAULT FALSE,
  
  -- Audit trail
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  -- Constraints
  CONSTRAINT valid_status CHECK (status IN ('draft', 'reviewed', 'promoted', 'rejected')),
  CONSTRAINT valid_group_id CHECK (group_id ~ '^allura-[a-z0-9-]+$')
);

-- Indexes for common queries
CREATE INDEX IF NOT EXISTS idx_notion_sync_log_group_id ON notion_sync_log(group_id);
CREATE INDEX IF NOT EXISTS idx_notion_sync_log_trace_id ON notion_sync_log(trace_id);
CREATE INDEX IF NOT EXISTS idx_notion_sync_log_notion_page_id ON notion_sync_log(notion_page_id);
CREATE INDEX IF NOT EXISTS idx_notion_sync_log_status ON notion_sync_log(status);
CREATE INDEX IF NOT EXISTS idx_notion_sync_log_synced_at ON notion_sync_log(synced_at DESC);

-- Comment for documentation
COMMENT ON TABLE notion_sync_log IS 'Story 1.2: Tracks PostgreSQL trace → Notion Knowledge Hub sync workflow';
COMMENT ON COLUMN notion_sync_log.group_id IS 'Tenant isolation - must match allura-{org} pattern (RK-01)';
COMMENT ON COLUMN notion_sync_log.trace_id IS 'PostgreSQL events.id reference';
COMMENT ON COLUMN notion_sync_log.notion_page_id IS 'Notion page ID for human review';
COMMENT ON COLUMN notion_sync_log.status IS 'Workflow status: draft (synced), reviewed (approved), promoted (to Neo4j), rejected';