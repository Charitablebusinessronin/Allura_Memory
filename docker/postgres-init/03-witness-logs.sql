-- Migration: Create witness log table for deterministic replay
-- Phase 2.3 of RuVix Integration

CREATE TABLE IF NOT EXISTS witness_logs (
    witness_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_id BIGINT REFERENCES events(id) ON DELETE CASCADE,
    group_id VARCHAR(255) NOT NULL,
    
    -- Proof metadata
    proof_tier VARCHAR(20) NOT NULL CHECK (proof_tier IN ('reflex', 'standard', 'deep')),
    proof_hash VARCHAR(128) NOT NULL,
    proof_signature VARCHAR(512),
    proof_timestamp TIMESTAMPTZ NOT NULL,
    proof_nonce BIGINT NOT NULL,
    
    -- Witness log metadata
    recorded_at TIMESTAMPTZ DEFAULT NOW(),
    checkpoint_id VARCHAR(255),
    
    -- Raw data hash for verification
    data_hash VARCHAR(128) NOT NULL,
    
    -- Index for efficient queries
    CONSTRAINT valid_proof_tier CHECK (proof_tier IN ('reflex', 'standard', 'deep'))
);

-- Indexes for common queries
CREATE INDEX IF NOT EXISTS idx_witness_logs_group_id ON witness_logs(group_id);
CREATE INDEX IF NOT EXISTS idx_witness_logs_event_id ON witness_logs(event_id);
CREATE INDEX IF NOT EXISTS idx_witness_logs_checkpoint_id ON witness_logs(checkpoint_id);
CREATE INDEX IF NOT EXISTS idx_witness_logs_recorded_at ON witness_logs(recorded_at);

-- Comment for documentation
COMMENT ON TABLE witness_logs IS 'Tamper-evident witness logs for deterministic replay. Created as part of RuVix Phase 2 integration.';

-- Create checkpoint table
CREATE TABLE IF NOT EXISTS checkpoints (
    checkpoint_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    label VARCHAR(255),
    group_id VARCHAR(255) NOT NULL,
    
    -- State snapshot
    event_count BIGINT NOT NULL,
    last_event_id BIGINT,
    
    -- Metadata
    created_at TIMESTAMPTZ DEFAULT NOW(),
    created_by VARCHAR(255),
    
    -- Verification
    state_hash VARCHAR(128) NOT NULL,
    witness_log_count BIGINT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_checkpoints_group_id ON checkpoints(group_id);

COMMENT ON TABLE checkpoints IS 'System state checkpoints for deterministic replay. Created as part of RuVix Phase 2 integration.';
