-- ============================================================
-- Epic 4: Integration & Sync Pipeline - Schema
-- Creates tables for design synchronization state
-- ============================================================

-- Design Sync Status Table
-- Tracks synchronization state between Neo4j and Notion
CREATE TABLE IF NOT EXISTS design_sync_status (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    design_id VARCHAR(255) NOT NULL,
    group_id VARCHAR(255) NOT NULL,
    notion_page_id VARCHAR(255),
    notion_page_url TEXT,
    neo4j_id VARCHAR(255),
    version INTEGER DEFAULT 1,
    synced_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    neo4j_updated_at TIMESTAMP WITH TIME ZONE,
    status VARCHAR(50) DEFAULT 'pending',
    error_message TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    CONSTRAINT uk_design_sync_design_group UNIQUE (design_id, group_id)
);

-- Index for efficient lookups
CREATE INDEX IF NOT EXISTS idx_design_sync_group ON design_sync_status(group_id);
CREATE INDEX IF NOT EXISTS idx_design_sync_status ON design_sync_status(status);
CREATE INDEX IF NOT EXISTS idx_design_sync_synced_at ON design_sync_status(synced_at);

-- Drift Detection Log Table
-- Records detected drift between systems
CREATE TABLE IF NOT EXISTS sync_drift_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    design_id VARCHAR(255) NOT NULL,
    group_id VARCHAR(255) NOT NULL,
    drift_type VARCHAR(50) NOT NULL,
    neo4j_updated_at TIMESTAMP WITH TIME ZONE,
    notion_updated_at TIMESTAMP WITH TIME ZONE,
    drift_seconds BIGINT,
    resolution_status VARCHAR(50) DEFAULT 'pending',
    resolution_action VARCHAR(255),
    resolved_at TIMESTAMP WITH TIME ZONE,
    resolved_by VARCHAR(255),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    CONSTRAINT fk_drift_design FOREIGN KEY (design_id, group_id)
        REFERENCES design_sync_status(design_id, group_id)
        ON DELETE CASCADE
);

-- Index for drift queries
CREATE INDEX IF NOT EXISTS idx_drift_design ON sync_drift_log(design_id, group_id);
CREATE INDEX IF NOT EXISTS idx_drift_status ON sync_drift_log(resolution_status);
CREATE INDEX IF NOT EXISTS idx_drift_created ON sync_drift_log(created_at);

-- Schema version tracking
INSERT INTO schema_versions (version, applied_at, description)
VALUES (
    '004',
    NOW(),
    'Epic 4: Integration & Sync Pipeline - design_sync_status and sync_drift_log tables'
) ON CONFLICT (version) DO NOTHING;