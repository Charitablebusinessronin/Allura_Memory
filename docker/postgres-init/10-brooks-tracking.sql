-- ============================================================================
-- Brooks Agent Tracking — Unified Cross-Platform Architecture Performance
-- ============================================================================
-- Enables tracking Frederick P. Brooks Jr. architect persona across:
-- - Claude Code (this session)
-- - Copilot (GitHub integrations)
-- - OpenClaw (AI agent orchestration)
-- - OpenCode (main orchestrator)
--
-- Single source of truth: Postgres events table with runtime + session_id
-- ============================================================================

-- Add columns for runtime tracking (idempotent)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'events' AND column_name = 'runtime'
  ) THEN
    ALTER TABLE events ADD COLUMN runtime VARCHAR(50) DEFAULT 'unknown';
    CREATE INDEX idx_events_runtime ON events(runtime);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'events' AND column_name = 'session_id'
  ) THEN
    ALTER TABLE events ADD COLUMN session_id VARCHAR(255);
    CREATE INDEX idx_events_session_id ON events(session_id);
  END IF;
END $$;

-- ============================================================================
-- Brooks Agent View — All decisions across platforms
-- ============================================================================
CREATE OR REPLACE VIEW brooks_decisions AS
SELECT
  id,
  event_type,
  runtime,
  session_id,
  agent_id,
  confidence,
  status,
  created_at,
  metadata,
  outcome
FROM events
WHERE agent_id = 'brooks'
  AND event_type IN ('ADR_CREATED', 'INTERFACE_DEFINED', 'TECH_STACK_DECISION', 'ARCHITECTURAL_DECISION')
ORDER BY created_at DESC;

-- ============================================================================
-- Brooks Metrics View — Performance across all runtimes
-- ============================================================================
CREATE OR REPLACE VIEW brooks_metrics AS
SELECT
  runtime,
  COUNT(*) as total_decisions,
  COUNT(CASE WHEN status = 'completed' THEN 1 END) as completed,
  COUNT(CASE WHEN status = 'blocked' THEN 1 END) as blocked,
  AVG(confidence)::NUMERIC(3,2) as avg_confidence,
  MIN(created_at) as first_decision,
  MAX(created_at) as last_decision
FROM events
WHERE agent_id = 'brooks'
GROUP BY runtime
ORDER BY last_decision DESC;

-- ============================================================================
-- Brooks Session Timeline — Decisions within a session
-- ============================================================================
CREATE OR REPLACE VIEW brooks_session_timeline AS
SELECT
  session_id,
  runtime,
  COUNT(*) as decision_count,
  COUNT(CASE WHEN status = 'completed' THEN 1 END) as completed,
  AVG(confidence)::NUMERIC(3,2) as avg_confidence,
  MIN(created_at) as session_start,
  MAX(created_at) as session_end,
  EXTRACT(EPOCH FROM (MAX(created_at) - MIN(created_at)))::INT as duration_seconds,
  STRING_AGG(DISTINCT event_type, ', ' ORDER BY event_type) as event_types
FROM events
WHERE agent_id = 'brooks'
  AND session_id IS NOT NULL
GROUP BY session_id, runtime
ORDER BY session_end DESC;

-- ============================================================================
-- Brooks Confidence Distribution — Quality of decisions
-- ============================================================================
CREATE OR REPLACE VIEW brooks_confidence_distribution AS
SELECT
  runtime,
  CASE
    WHEN confidence >= 0.9 THEN 'High (0.9-1.0)'
    WHEN confidence >= 0.75 THEN 'Medium (0.75-0.89)'
    WHEN confidence >= 0.5 THEN 'Low (0.5-0.74)'
    ELSE 'Very Low (<0.5)'
  END as confidence_band,
  COUNT(*) as count,
  ROUND(100.0 * COUNT(*) / SUM(COUNT(*)) OVER (PARTITION BY runtime), 1)::NUMERIC as percentage
FROM events
WHERE agent_id = 'brooks'
  AND event_type IN ('ADR_CREATED', 'INTERFACE_DEFINED', 'TECH_STACK_DECISION')
GROUP BY runtime, confidence_band
ORDER BY runtime, confidence_band DESC;

-- ============================================================================
-- Brooks Principle Tracking — Which Brooksian principles are applied
-- ============================================================================
CREATE OR REPLACE VIEW brooks_principles_applied AS
SELECT
  session_id,
  runtime,
  (metadata->>'principle') as principle_applied,
  COUNT(*) as usage_count,
  AVG(confidence)::NUMERIC(3,2) as avg_confidence_for_principle
FROM events
WHERE agent_id = 'brooks'
  AND metadata->>'principle' IS NOT NULL
GROUP BY session_id, runtime, principle_applied
ORDER BY usage_count DESC;

-- ============================================================================
-- Indexes for performance
-- ============================================================================
CREATE INDEX IF NOT EXISTS idx_events_brooks_agent ON events(agent_id) WHERE agent_id = 'brooks';
CREATE INDEX IF NOT EXISTS idx_events_brooks_type ON events(event_type, agent_id, created_at) WHERE agent_id = 'brooks';
CREATE INDEX IF NOT EXISTS idx_events_brooks_confidence ON events(confidence, agent_id) WHERE agent_id = 'brooks';

-- ============================================================================
-- Constraint: Enforce Brooks identity is consistent
-- ============================================================================
ALTER TABLE events ADD CONSTRAINT check_brooks_consistency
  CHECK (
    agent_id != 'brooks' OR (runtime IS NOT NULL)
  );

-- ============================================================================
-- Comment for documentation
-- ============================================================================
COMMENT ON TABLE events IS 'Append-only event log. Brooks decisions tracked via: agent_id, runtime, session_id, confidence, metadata->principle';
COMMENT ON COLUMN events.runtime IS 'Runtime platform: claude-code, copilot, openclaw, opencode';
COMMENT ON COLUMN events.session_id IS 'Session identifier for grouping cross-platform work';
COMMENT ON VIEW brooks_decisions IS 'All Brooks architectural decisions across all runtimes';
COMMENT ON VIEW brooks_metrics IS 'Performance metrics: decision count, confidence, status by runtime';
COMMENT ON VIEW brooks_session_timeline IS 'Timeline of Brooks decisions within each session';
COMMENT ON VIEW brooks_confidence_distribution IS 'Quality distribution of Brooks decisions by confidence band';
COMMENT ON VIEW brooks_principles_applied IS 'Brooksian principles applied in each session';
