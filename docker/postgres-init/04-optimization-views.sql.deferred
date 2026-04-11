-- Allura Brain Database Optimization
-- Creates materialized views and indexes for faster queries

-- ============================================
-- Materialized Views for Common Queries
-- ============================================

-- View: Active Agents Summary
CREATE MATERIALIZED VIEW IF NOT EXISTS mv_active_agents AS
SELECT 
    agent_id,
    name,
    platform,
    status,
    confidence_score,
    module,
    created_at,
    updated_at,
    group_id
FROM agents
WHERE status = 'Active'
ORDER BY confidence_score DESC;

-- Index on materialized view
CREATE INDEX IF NOT EXISTS idx_mv_active_agents_agent_id 
ON mv_active_agents(agent_id);

-- View: Recent Events (last 24 hours)
CREATE MATERIALIZED VIEW IF NOT EXISTS mv_recent_events AS
SELECT 
    e.id,
    e.event_type,
    e.agent_id,
    e.metadata,
    e.outcome,
    e.status,
    e.created_at,
    e.group_id,
    a.name as agent_name
FROM events e
LEFT JOIN agents a ON e.agent_id = a.agent_id
WHERE e.created_at > NOW() - INTERVAL '24 hours'
ORDER BY e.created_at DESC;

-- Index on materialized view
CREATE INDEX IF NOT EXISTS idx_mv_recent_events_created_at 
ON mv_recent_events(created_at);

-- View: Agent Performance Metrics
CREATE MATERIALIZED VIEW IF NOT EXISTS mv_agent_metrics AS
SELECT 
    a.agent_id,
    a.name,
    a.confidence_score,
    COUNT(DISTINCT e.id) as event_count_24h,
    COUNT(DISTINCT s.id) as session_count_24h,
    MAX(e.created_at) as last_activity
FROM agents a
LEFT JOIN events e ON a.agent_id = e.agent_id 
    AND e.created_at > NOW() - INTERVAL '24 hours'
LEFT JOIN session_logs s ON a.agent_id = s.agent_id 
    AND s.created_at > NOW() - INTERVAL '24 hours'
WHERE a.status = 'Active'
GROUP BY a.agent_id, a.name, a.confidence_score;

-- ============================================
-- Performance Indexes
-- ============================================

-- Composite index for agent lookups
CREATE INDEX IF NOT EXISTS idx_agents_status_platform 
ON agents(status, platform, confidence_score DESC);

-- Index for event queries
CREATE INDEX IF NOT EXISTS idx_events_agent_time 
ON events(agent_id, created_at DESC);

-- Index for session logs
CREATE INDEX IF NOT EXISTS idx_session_logs_agent_time 
ON session_logs(agent_id, created_at DESC);

-- Index for curator queue
CREATE INDEX IF NOT EXISTS idx_curator_queue_pending 
ON curator_queue(neo4j_written, attempt_count) 
WHERE neo4j_written = false AND attempt_count < 5;

-- ============================================
-- Function to Refresh Materialized Views
-- ============================================

CREATE OR REPLACE FUNCTION refresh_allura_views()
RETURNS void AS $$
BEGIN
    REFRESH MATERIALIZED VIEW CONCURRENTLY mv_active_agents;
    REFRESH MATERIALIZED VIEW CONCURRENTLY mv_recent_events;
    REFRESH MATERIALIZED VIEW CONCURRENTLY mv_agent_metrics;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- Optimized Query Examples
-- ============================================

-- Fast agent lookup (uses materialized view)
-- SELECT * FROM mv_active_agents WHERE agent_id = 'memory-orchestrator';

-- Fast recent events (uses materialized view)
-- SELECT * FROM mv_recent_events LIMIT 10;

-- Fast agent metrics (uses materialized view)
-- SELECT * FROM mv_agent_metrics ORDER BY confidence_score DESC;

-- Refresh views (run periodically)
-- SELECT refresh_allura_views();
