-- Promotion Requests Schema for HITL Knowledge Promotion
-- Story 3.2: Approve Workflow Implementation
-- Design: Curator proposes, Auditor approves/rejects

-- ============================================================================
-- Promotion Requests Table: Track pending knowledge promotions
-- ============================================================================
-- Purpose: Store pending promotion requests before they reach Neo4j
-- Tenant Isolation: group_id is mandatory for all inserts
-- Workflow: pending -> approved|rejected
-- ============================================================================

CREATE TABLE IF NOT EXISTS promotion_requests (
  -- Primary key (UUID)
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Mandatory tenant isolation (never null)
  group_id VARCHAR(255) NOT NULL,

  -- The insight being proposed for promotion
  insight_id VARCHAR(255) NOT NULL,

  -- The agent proposing the insight
  proposed_by VARCHAR(255) NOT NULL,

  -- Status: pending, approved, rejected
  status VARCHAR(50) NOT NULL DEFAULT 'pending',
    -- Possible values: pending, approved, rejected

  -- Rationale for promotion
  rationale TEXT NOT NULL,

  -- Who approved/rejected (human auditor)
  approved_by VARCHAR(255),

  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================================
-- Indexes for query patterns
-- ============================================================================

-- Primary query pattern: tenant-scoped pending requests
CREATE INDEX IF NOT EXISTS idx_promotion_requests_group_status
  ON promotion_requests(group_id, status, created_at ASC);

-- Secondary query pattern: insight lookup
CREATE INDEX IF NOT EXISTS idx_promotion_requests_insight
  ON promotion_requests(insight_id, group_id);

-- Status filtering
CREATE INDEX IF NOT EXISTS idx_promotion_requests_status
  ON promotion_requests(status, created_at ASC);

-- ============================================================================
-- Constraints
-- ============================================================================

-- Ensure group_id is always present (defensive)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_promotion_group_not_empty') THEN
    ALTER TABLE promotion_requests ADD CONSTRAINT chk_promotion_group_not_empty
      CHECK (LENGTH(TRIM(group_id)) > 0);
  END IF;
END $$;

-- Ensure proposed_by is always present
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_promotion_proposed_not_empty') THEN
    ALTER TABLE promotion_requests ADD CONSTRAINT chk_promotion_proposed_not_empty
      CHECK (LENGTH(TRIM(proposed_by)) > 0);
  END IF;
END $$;

-- Ensure insight_id is always present
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_promotion_insight_not_empty') THEN
    ALTER TABLE promotion_requests ADD CONSTRAINT chk_promotion_insight_not_empty
      CHECK (LENGTH(TRIM(insight_id)) > 0);
  END IF;
END $$;

-- Ensure rationale is always present
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_promotion_rationale_not_empty') THEN
    ALTER TABLE promotion_requests ADD CONSTRAINT chk_promotion_rationale_not_empty
      CHECK (LENGTH(TRIM(rationale)) > 0);
  END IF;
END $$;

-- Valid status values
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_promotion_valid_status') THEN
    ALTER TABLE promotion_requests ADD CONSTRAINT chk_promotion_valid_status
      CHECK (status IN ('pending', 'approved', 'rejected'));
  END IF;
END $$;

-- ============================================================================
-- Update timestamp trigger
-- ============================================================================

CREATE OR REPLACE FUNCTION update_promotion_requests_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trigger_promotion_requests_updated_at') THEN
    CREATE TRIGGER trigger_promotion_requests_updated_at
      BEFORE UPDATE ON promotion_requests
      FOR EACH ROW
      EXECUTE FUNCTION update_promotion_requests_updated_at();
  END IF;
END $$;

-- ============================================================================
-- Schema Version Tracking
-- ============================================================================

-- Record this schema application
INSERT INTO schema_versions (version, description)
VALUES ('1.0.1-promotion-requests', 'Approval workflow table for HITL knowledge promotion')
ON CONFLICT (version) DO NOTHING;