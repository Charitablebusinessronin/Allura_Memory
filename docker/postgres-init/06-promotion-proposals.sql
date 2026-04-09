-- Promotion Proposals and Audit Trail
-- Story 3-2: Approval Workflow Implementation
-- Epic 3: Human-in-the-Loop (HITL) Governance Interface

-- ============================================================================
-- PROMOTION PROPOSALS: Proposals for knowledge promotion
-- ============================================================================
CREATE TABLE IF NOT EXISTS promotion_proposals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id VARCHAR(255) NOT NULL,
  entity_type VARCHAR(50) NOT NULL CHECK (entity_type IN ('agent', 'insight', 'design', 'knowledge')),
  entity_id VARCHAR(255) NOT NULL,
  status VARCHAR(50) NOT NULL DEFAULT 'draft' 
    CHECK (status IN ('draft', 'pending', 'approved', 'rejected', 'superseded', 'revoked')),
  confidence_score DECIMAL(3,2) NOT NULL,
  evidence_refs JSONB DEFAULT '[]'::jsonb,
  metadata JSONB DEFAULT '{}'::jsonb,
  proposed_by VARCHAR(255) NOT NULL,
  proposed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  reviewed_by VARCHAR(255),
  reviewed_at TIMESTAMPTZ,
  review_notes TEXT,
  rejection_reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  -- Enforce group_id
  CONSTRAINT chk_proposal_group_not_empty CHECK (LENGTH(TRIM(group_id)) > 0)
);

CREATE INDEX IF NOT EXISTS idx_proposal_group_status 
  ON promotion_proposals(group_id, status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_proposal_entity 
  ON promotion_proposals(entity_type, entity_id);

-- ============================================================================
-- APPROVAL TRANSITIONS: Append-only audit trail
-- ============================================================================
CREATE TABLE IF NOT EXISTS approval_transitions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id VARCHAR(255) NOT NULL,
  entity_type VARCHAR(50) NOT NULL,
  entity_id VARCHAR(255) NOT NULL,
  from_state VARCHAR(50),
  to_state VARCHAR(50) NOT NULL 
    CHECK (to_state IN ('draft', 'pending', 'approved', 'rejected', 'superseded', 'revoked')),
  actor_id VARCHAR(255) NOT NULL,
  actor_type VARCHAR(50) NOT NULL CHECK (actor_type IN ('human', 'agent', 'system')),
  reason TEXT,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  -- Enforce group_id
  CONSTRAINT chk_trans_group_not_empty CHECK (LENGTH(TRIM(group_id)) > 0)
);

CREATE INDEX IF NOT EXISTS idx_approval_trans_group_entity 
  ON approval_transitions(group_id, entity_type, entity_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_approval_trans_actor 
  ON approval_transitions(actor_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_approval_trans_state 
  ON approval_transitions(to_state, created_at DESC);

-- ============================================================================
-- NOTIFICATIONS: Track notification dispatch
-- ============================================================================
CREATE TABLE IF NOT EXISTS approval_notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id VARCHAR(255) NOT NULL,
  transition_id UUID REFERENCES approval_transitions(id) ON DELETE SET NULL,
  event_type VARCHAR(50) NOT NULL 
    CHECK (event_type IN ('proposal_created', 'proposal_approved', 'proposal_rejected', 'proposal_superseded', 'proposal_revoked')),
  entity_type VARCHAR(50) NOT NULL,
  entity_id VARCHAR(255) NOT NULL,
  channel VARCHAR(50) NOT NULL CHECK (channel IN ('in_app', 'email', 'slack', 'webhook')),
  recipient VARCHAR(255) NOT NULL,
  sent_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  success BOOLEAN NOT NULL DEFAULT true,
  error_message TEXT,
  payload JSONB DEFAULT '{}'::jsonb,
  
  -- Enforce group_id
  CONSTRAINT chk_notif_group_not_empty CHECK (LENGTH(TRIM(group_id)) > 0)
);

CREATE INDEX IF NOT EXISTS idx_approval_notifications_time 
  ON approval_notifications(group_id, sent_at DESC);

-- ============================================================================
-- TRIGGER: Automatic audit trail logging
-- ============================================================================
CREATE OR REPLACE FUNCTION log_proposal_transition()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO approval_transitions (
    group_id, entity_type, entity_id, from_state, to_state,
    actor_id, actor_type, reason, metadata
  ) VALUES (
    NEW.group_id, 
    'proposal', 
    NEW.id, 
    OLD.status, 
    NEW.status,
    COALESCE(NEW.reviewed_by, NEW.proposed_by, 'system'),
    CASE WHEN NEW.reviewed_by IS NOT NULL THEN 'human' ELSE 'system' END,
    COALESCE(NEW.rejection_reason, NEW.review_notes),
    jsonb_build_object('confidence_score', NEW.confidence_score)
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS proposal_transition_trigger ON promotion_proposals;
CREATE TRIGGER proposal_transition_trigger
AFTER UPDATE ON promotion_proposals
FOR EACH ROW
WHEN (OLD.status IS DISTINCT FROM NEW.status)
EXECUTE FUNCTION log_proposal_transition();