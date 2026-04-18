-- Fix score/confidence precision: DECIMAL(3,2) truncates 1.0 → 0.99
-- DECIMAL(4,3) supports full 0.000–1.000 range without truncation.
-- Also corrects migration 13 comment: SHA-256 → SHAKE-256.

-- ============================================================================
-- 1. canonical_proposals.score: DECIMAL(3,2) → DECIMAL(4,3)
-- ============================================================================
ALTER TABLE canonical_proposals
  ALTER COLUMN score TYPE DECIMAL(4,3);

-- Update CHECK constraint (drop old, add new)
ALTER TABLE canonical_proposals
  DROP CONSTRAINT IF EXISTS canonical_proposals_score_check;
ALTER TABLE canonical_proposals
  ADD CONSTRAINT canonical_proposals_score_check CHECK (score >= 0.0 AND score <= 1.0);

-- Update column comment to reflect new precision
COMMENT ON COLUMN canonical_proposals.score IS 'Confidence score (0.000 to 1.000). Threshold: 0.85 for promotion.';

-- ============================================================================
-- 2. promotion_proposals.confidence_score: DECIMAL(3,2) → DECIMAL(4,3)
-- ============================================================================
ALTER TABLE promotion_proposals
  ALTER COLUMN confidence_score TYPE DECIMAL(4,3);

-- ============================================================================
-- 3. Patch migration 13 comment: SHA-256 → SHAKE-256
-- ============================================================================
COMMENT ON COLUMN canonical_proposals.witness_hash IS 'SHAKE-256 hash of proposal decision for tamper-evident audit trail. Format: shake256(id + group_id + content + score + tier + decision + decided_at + decided_by)';
