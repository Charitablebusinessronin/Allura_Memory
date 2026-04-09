-- Migration: Add evidence_ref and confidence columns to events table
-- Story 1.1: Record Raw Execution Traces
-- Date: 2026-04-06

-- ============================================================================
-- Add evidence_ref column for linking traces to evidence sources
-- ============================================================================

ALTER TABLE events
ADD COLUMN IF NOT EXISTS evidence_ref VARCHAR(500);

COMMENT ON COLUMN events.evidence_ref IS
  'Reference to external evidence (file path, URL, document ID, etc.)';

-- Index for evidence-based queries
CREATE INDEX IF NOT EXISTS idx_events_evidence_ref ON events(evidence_ref) WHERE evidence_ref IS NOT NULL;

-- ============================================================================
-- Add confidence column for knowledge promotion decisions
-- ============================================================================

ALTER TABLE events
ADD COLUMN IF NOT EXISTS confidence DECIMAL(4, 3) CHECK (confidence >= 0 AND confidence <= 1);

COMMENT ON COLUMN events.confidence IS
  'Confidence score (0.0 to 1.0) for knowledge promotion decisions';

-- Index for confidence-based filtering
CREATE INDEX IF NOT EXISTS idx_events_confidence ON events(confidence, created_at DESC) WHERE confidence IS NOT NULL;

-- Composite index for promotion queries (high confidence events for curation)
CREATE INDEX IF NOT EXISTS idx_events_promotion ON events(group_id, confidence, created_at DESC)
  WHERE confidence >= 0.8;

-- ============================================================================
-- Migration complete
-- ============================================================================

DO $$
BEGIN
  RAISE NOTICE 'Migration 05-evidence-confidence.sql completed successfully';
END $$;
