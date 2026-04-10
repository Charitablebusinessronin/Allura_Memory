-- Canonical Memory Proposals
-- Allura v1 Unification: SOC2 governance workflow
-- Reference: docs/allura/BLUEPRINT.md (Requirements F10-F19)

-- ============================================================================
-- CANONICAL PROPOSALS: Memory promotion queue for SOC2 mode
-- ============================================================================
-- This table stores high-confidence memories awaiting human approval
-- before promotion to Neo4j knowledge graph.
--
-- Flow:
-- 1. memory_add() scores content
-- 2. If score >= threshold AND PROMOTION_MODE=soc2:
--    - Insert into proposals table
--    - Return { stored: "episodic", pending_review: true }
-- 3. Curator reviews via /curator dashboard
-- 4. Approve → promote to Neo4j, log to events
-- 5. Reject → archive to 7-day undo, log to events

CREATE TABLE IF NOT EXISTS canonical_proposals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Tenant isolation (enforced by CHECK constraint)
  group_id VARCHAR(255) NOT NULL CHECK (group_id ~ '^allura-'),
  
  -- Memory content
  content TEXT NOT NULL,
  
  -- Confidence scoring (0.00 to 1.00)
  score DECIMAL(3,2) NOT NULL CHECK (score >= 0.0 AND score <= 1.0),
  
  -- Reasoning for score (one-sentence explanation)
  reasoning TEXT,
  
  -- Tier classification
  tier VARCHAR(20) NOT NULL CHECK (tier IN ('emerging', 'adoption', 'established')),
  
  -- Status
  status VARCHAR(20) NOT NULL DEFAULT 'pending' 
    CHECK (status IN ('pending', 'approved', 'rejected')),
  
  -- Reference to PostgreSQL event (traceability)
  trace_ref UUID REFERENCES events(id) ON DELETE SET NULL,
  
  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  -- Curator decision (if approved/rejected)
  decided_at TIMESTAMPTZ,
  decided_by VARCHAR(255),
  rationale TEXT,
  
  -- Indexing
  CONSTRAINT canonical_proposals_group_id_not_empty CHECK (LENGTH(TRIM(group_id)) > 0)
);

-- ============================================================================
-- INDEXES: Performance optimization
-- ============================================================================

-- Query: Get pending proposals for a group (sorted by score)
CREATE INDEX IF NOT EXISTS idx_canonical_proposals_pending 
  ON canonical_proposals(group_id, status, score DESC)
  WHERE status = 'pending';

-- Query: Get all proposals for a group (sorted by date)
CREATE INDEX IF NOT EXISTS idx_canonical_proposals_group_date 
  ON canonical_proposals(group_id, created_at DESC);

-- Query: Get proposals by status
CREATE INDEX IF NOT EXISTS idx_canonical_proposals_status 
  ON canonical_proposals(status, created_at DESC);

-- Query: Get proposals by tier
CREATE INDEX IF NOT EXISTS idx_canonical_proposals_tier 
  ON canonical_proposals(tier, score DESC);

-- ============================================================================
-- AUDIT TRAIL: Log all curator decisions
-- ============================================================================

-- Insert into events table when proposal is created
CREATE OR REPLACE FUNCTION log_proposal_created()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO events (
    id, group_id, event_type, agent_id, status, metadata, created_at
  ) VALUES (
    gen_random_uuid(),
    NEW.group_id,
    'proposal_created',
    'system',
    'completed',
    jsonb_build_object(
      'proposal_id', NEW.id,
      'score', NEW.score,
      'tier', NEW.tier,
      'content_preview', LEFT(NEW.content, 100)
    ),
    NEW.created_at
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_proposal_created
  AFTER INSERT ON canonical_proposals
  FOR EACH ROW
  EXECUTE FUNCTION log_proposal_created();

-- Insert into events table when proposal is decided
CREATE OR REPLACE FUNCTION log_proposal_decided()
RETURNS TRIGGER AS $$
BEGIN
  -- Only log when status changes to approved or rejected
  IF OLD.status = 'pending' AND NEW.status IN ('approved', 'rejected') THEN
    INSERT INTO events (
      id, group_id, event_type, agent_id, status, metadata, created_at
    ) VALUES (
      gen_random_uuid(),
      NEW.group_id,
      CASE NEW.status 
        WHEN 'approved' THEN 'proposal_approved'
        WHEN 'rejected' THEN 'proposal_rejected'
      END,
      NEW.decided_by,
      'completed',
      jsonb_build_object(
        'proposal_id', NEW.id,
        'decision', NEW.status,
        'rationale', NEW.rationale,
        'score', NEW.score
      ),
      NEW.decided_at
    );
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_proposal_decided
  AFTER UPDATE ON canonical_proposals
  FOR EACH ROW
  EXECUTE FUNCTION log_proposal_decided();

-- ============================================================================
-- COMMENTS: Documentation
-- ============================================================================

COMMENT ON TABLE canonical_proposals IS 'Memory promotion queue for SOC2 governance. High-confidence memories await human approval before promotion to Neo4j.';
COMMENT ON COLUMN canonical_proposals.group_id IS 'Tenant namespace (format: allura-*)';
COMMENT ON COLUMN canonical_proposals.score IS 'Confidence score (0.00 to 1.00). Threshold: 0.85 for promotion.';
COMMENT ON COLUMN canonical_proposals.tier IS 'Classification: emerging (<70%), adoption (70-84%), established (85%+)';
COMMENT ON COLUMN canonical_proposals.trace_ref IS 'Reference to PostgreSQL event for traceability';
COMMENT ON COLUMN canonical_proposals.status IS 'pending: awaiting review, approved: promoted to Neo4j, rejected: archived';