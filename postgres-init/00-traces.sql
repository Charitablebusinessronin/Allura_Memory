-- Raw Trace Schema for Unified Knowledge System
-- Story: 1.1 - Record Raw Execution Traces
-- Design: Append-only tables for durable evidence storage

-- ============================================================================
-- Events Table: Core trace records for workflow and agent events
-- ============================================================================
-- Purpose: Store append-only records of agent and workflow execution
-- Tenant Isolation: group_id is mandatory for all inserts
-- Ordering: created_at index supports chronological replay
-- ============================================================================

CREATE TABLE IF NOT EXISTS events (
  -- Surrogate primary key for stable addressing
  id BIGSERIAL PRIMARY KEY,

  -- Mandatory tenant isolation (never null)
  group_id VARCHAR(255) NOT NULL,

  -- Event identification
  event_type VARCHAR(100) NOT NULL,

  -- Timestamp with timezone for proper ordering
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- Agent/workflow identity
  agent_id VARCHAR(255) NOT NULL,
  workflow_id VARCHAR(255),
  step_id VARCHAR(255),

  -- Workflow context
  parent_event_id BIGINT REFERENCES events(id),

  -- Structured metadata payload (flexible JSON)
  metadata JSONB DEFAULT '{}'::jsonb,

  -- Outcome payload (what actually happened)
  outcome JSONB DEFAULT '{}'::jsonb,

  -- Status tracking
  status VARCHAR(50) NOT NULL DEFAULT 'pending',
    -- Possible values: pending, completed, failed, cancelled

  -- Error information (only populated on failure)
  error_message TEXT,
  error_code VARCHAR(50),

  -- Audit fields
  inserted_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================================
-- Indexes for query patterns
-- ============================================================================

-- Primary query pattern: tenant-scoped ordered replay
CREATE INDEX IF NOT EXISTS idx_events_group_created ON events(group_id, created_at DESC);

-- Secondary query pattern: agent-scoped queries
CREATE INDEX IF NOT EXISTS idx_events_agent ON events(agent_id, created_at DESC);

-- Workflow execution tracing
CREATE INDEX IF NOT EXISTS idx_events_workflow ON events(workflow_id, created_at DESC) WHERE workflow_id IS NOT NULL;

-- Event type filtering
CREATE INDEX IF NOT EXISTS idx_events_type ON events(event_type, created_at DESC);

-- Parent-child linking for execution chains
CREATE INDEX IF NOT EXISTS idx_events_parent ON events(parent_event_id) WHERE parent_event_id IS NOT NULL;

-- ============================================================================
-- Constraints
-- ============================================================================

-- Ensure group_id is always present (defensive)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_events_group_not_empty') THEN
    ALTER TABLE events ADD CONSTRAINT chk_events_group_not_empty
      CHECK (LENGTH(TRIM(group_id)) > 0);
  END IF;
END $$;

-- Ensure agent_id is always present
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_events_agent_not_empty') THEN
    ALTER TABLE events ADD CONSTRAINT chk_events_agent_not_empty
      CHECK (LENGTH(TRIM(agent_id)) > 0);
  END IF;
END $$;

-- Ensure event_type is always present
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_events_type_not_empty') THEN
    ALTER TABLE events ADD CONSTRAINT chk_events_type_not_empty
      CHECK (LENGTH(TRIM(event_type)) > 0);
  END IF;
END $$;

-- Valid status values
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_events_valid_status') THEN
    ALTER TABLE events ADD CONSTRAINT chk_events_valid_status
      CHECK (status IN ('pending', 'completed', 'failed', 'cancelled'));
  END IF;
END $$;

-- ============================================================================
-- Outcomes Table: Structured outcomes linked to events
-- ============================================================================
-- Purpose: Separate high-value outcomes from raw event traces
-- This allows efficient outcome queries without scanning all events
-- ============================================================================

CREATE TABLE IF NOT EXISTS outcomes (
  id BIGSERIAL PRIMARY KEY,

  -- Tenant isolation (matches parent event)
  group_id VARCHAR(255) NOT NULL,

  -- Link to source event
  event_id BIGINT NOT NULL REFERENCES events(id),

  -- Outcome classification
  outcome_type VARCHAR(100) NOT NULL,

  -- Confidence score (0.0 to 1.0)
  confidence DECIMAL(4, 3) CHECK (confidence >= 0 AND confidence <= 1),

  -- Structured outcome data
  data JSONB DEFAULT '{}'::jsonb,

  -- Creation timestamp
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes for outcomes
CREATE INDEX IF NOT EXISTS idx_outcomes_group_created ON outcomes(group_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_outcomes_event ON outcomes(event_id);
CREATE INDEX IF NOT EXISTS idx_outcomes_type ON outcomes(outcome_type, created_at DESC);

-- Constraints
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_outcomes_group_not_empty') THEN
    ALTER TABLE outcomes ADD CONSTRAINT chk_outcomes_group_not_empty
      CHECK (LENGTH(TRIM(group_id)) > 0);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_outcomes_type_not_empty') THEN
    ALTER TABLE outcomes ADD CONSTRAINT chk_outcomes_type_not_empty
      CHECK (LENGTH(TRIM(outcome_type)) > 0);
  END IF;
END $$;

-- ============================================================================
-- ADAS Runs Table: Specialized tracking for agent design evolution
-- ============================================================================
-- Purpose: Track Automated Design of Agent Systems (ADAS) execution cycles
-- ============================================================================

CREATE TABLE IF NOT EXISTS adas_runs (
  id BIGSERIAL PRIMARY KEY,

  -- Tenant isolation
  group_id VARCHAR(255) NOT NULL,

  -- Run identification
  run_id VARCHAR(255) NOT NULL UNIQUE,

  -- Configuration
  domain VARCHAR(255) NOT NULL,
  config JSONB DEFAULT '{}'::jsonb,

  -- Status
  status VARCHAR(50) NOT NULL DEFAULT 'running',
    -- Possible values: running, completed, failed, cancelled

  -- Results
  best_design_id VARCHAR(255),
  best_score DECIMAL(10, 6),

  -- Timestamps
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMPTZ,

  -- Audit
  inserted_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes for ADAS runs
CREATE INDEX IF NOT EXISTS idx_adas_runs_group ON adas_runs(group_id, started_at DESC);
CREATE INDEX IF NOT EXISTS idx_adas_runs_status ON adas_runs(status, started_at DESC) WHERE status = 'running';

-- Constraints
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_adas_group_not_empty') THEN
    ALTER TABLE adas_runs ADD CONSTRAINT chk_adas_group_not_empty
      CHECK (LENGTH(TRIM(group_id)) > 0);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_adas_valid_status') THEN
    ALTER TABLE adas_runs ADD CONSTRAINT chk_adas_valid_status
      CHECK (status IN ('running', 'completed', 'failed', 'cancelled'));
  END IF;
END $$;

-- ============================================================================
-- Schema Version Tracking
-- ============================================================================
-- Purpose: Enable safe migrations and version awareness
-- ============================================================================

CREATE TABLE IF NOT EXISTS schema_versions (
  version VARCHAR(50) PRIMARY KEY,
  applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  description TEXT
);

-- Record this schema application
INSERT INTO schema_versions (version, description)
VALUES ('1.0.0-traces', 'Initial raw trace layer schema for events, outcomes, and adas_runs')
ON CONFLICT (version) DO NOTHING;