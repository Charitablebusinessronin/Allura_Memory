-- Curator Configuration & Settings
-- Story: Curator Scoring System (BLUEPRINT B16-B22, F10-F19)
-- Epic: Human-in-the-Loop (HITL) Governance Interface
--
-- ARCH-001: All tables MUST have group_id with validation constraint

-- ============================================================================
-- CURATOR_CONFIG: Enterprise customization (per tenant)
-- ============================================================================
CREATE TABLE IF NOT EXISTS curator_config (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id VARCHAR(255) NOT NULL UNIQUE,

  -- Confidence tier thresholds (JSON array of 3 floats: emerging, adoption, mainstream)
  confidence_tiers JSONB NOT NULL DEFAULT '[0.60, 0.75, 0.85]'::jsonb,

  -- Auto-approval threshold (scores >= this are auto-promoted)
  auto_approval_threshold DECIMAL(3,2) NOT NULL DEFAULT 0.85,

  -- Branding & display customization
  branding JSONB DEFAULT '{
    "logo_url": null,
    "primary_color": null,
    "display_name": null
  }'::jsonb,

  -- Feature flags for curator behavior
  features JSONB DEFAULT '{
    "show_confidence_numbers": true,
    "show_reasoning": true,
    "show_usage_stats": true,
    "undo_retention_days": 30
  }'::jsonb,

  -- Audit fields
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_by VARCHAR(255),

  -- Enforce group_id and tenant isolation
  CONSTRAINT chk_curator_config_group_not_empty
    CHECK (LENGTH(TRIM(group_id)) > 0),
  CONSTRAINT chk_curator_config_group_prefix
    CHECK (group_id ~ '^allura-'),

  -- Validate confidence thresholds are in valid range
  CONSTRAINT chk_curator_config_tiers_valid
    CHECK (
      (confidence_tiers->0)::decimal BETWEEN 0 AND 1
      AND (confidence_tiers->1)::decimal BETWEEN 0 AND 1
      AND (confidence_tiers->2)::decimal BETWEEN 0 AND 1
      AND (confidence_tiers->0)::decimal < (confidence_tiers->1)::decimal
      AND (confidence_tiers->1)::decimal < (confidence_tiers->2)::decimal
    ),

  -- Validate auto-approval threshold
  CONSTRAINT chk_curator_config_approval_threshold
    CHECK (auto_approval_threshold BETWEEN 0 AND 1)
);

CREATE INDEX IF NOT EXISTS idx_curator_config_group_id
  ON curator_config(group_id);

-- ============================================================================
-- CURATOR_STATS: Usage metrics for dashboard
-- ============================================================================
CREATE TABLE IF NOT EXISTS curator_stats (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id VARCHAR(255) NOT NULL,

  -- Proposal statistics (weekly or monthly rollup)
  period_start DATE NOT NULL,
  period_end DATE NOT NULL,

  proposals_total BIGINT DEFAULT 0,
  proposals_approved BIGINT DEFAULT 0,
  proposals_rejected BIGINT DEFAULT 0,
  proposals_auto_promoted BIGINT DEFAULT 0,

  -- Time metrics
  avg_review_time_minutes DECIMAL(8,2),
  median_confidence_score DECIMAL(3,2),

  -- Curator workload
  unique_curators BIGINT DEFAULT 0,

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- Enforce group_id
  CONSTRAINT chk_curator_stats_group_not_empty
    CHECK (LENGTH(TRIM(group_id)) > 0),
  CONSTRAINT chk_curator_stats_group_prefix
    CHECK (group_id ~ '^allura-')
);

CREATE INDEX IF NOT EXISTS idx_curator_stats_group_period
  ON curator_stats(group_id, period_start DESC);

-- ============================================================================
-- TRIGGER: Update updated_at on curator_config changes
-- ============================================================================
CREATE OR REPLACE FUNCTION update_curator_config_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS curator_config_update_timestamp ON curator_config;
CREATE TRIGGER curator_config_update_timestamp
BEFORE UPDATE ON curator_config
FOR EACH ROW
EXECUTE FUNCTION update_curator_config_timestamp();
