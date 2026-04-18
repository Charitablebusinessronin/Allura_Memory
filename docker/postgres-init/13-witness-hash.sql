-- Witness hash for SOC2 audit trail integrity
-- Every approval/rejection produces a tamper-evident hash
ALTER TABLE canonical_proposals 
  ADD COLUMN IF NOT EXISTS witness_hash TEXT;

-- Index for hash lookups
CREATE INDEX IF NOT EXISTS idx_canonical_proposals_witness_hash 
  ON canonical_proposals (witness_hash) 
  WHERE witness_hash IS NOT NULL;

COMMENT ON COLUMN canonical_proposals.witness_hash IS 'SHAKE-256 hash of proposal decision for tamper-evident audit trail. Format: shake256(id + group_id + content + score + tier + decision + decided_at + decided_by)';