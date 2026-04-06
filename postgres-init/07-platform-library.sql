-- Platform Library: Cross-Organization Knowledge Sharing
-- Story 4-2: Platform Library
-- Epic 4: Cross-Organization Knowledge Sharing

-- ============================================================================
-- PLATFORM_INSIGHTS: Curated, sanitized knowledge shared across organizations
-- ============================================================================
CREATE TABLE IF NOT EXISTS platform_insights (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id VARCHAR(255) NOT NULL DEFAULT 'allura-platform',
  title VARCHAR(255) NOT NULL,
  content TEXT NOT NULL,
  category VARCHAR(50) NOT NULL,
  tags JSONB DEFAULT '[]'::jsonb,
  source_org VARCHAR(255), -- Anonymized organization identifier
  confidence_score DECIMAL(3,2),
  adoption_count INTEGER DEFAULT 0,
  version INTEGER DEFAULT 1,
  supersedes_id UUID REFERENCES platform_insights(id) ON DELETE SET NULL,
  created_by VARCHAR(255) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  -- Enforce platform group_id
  CONSTRAINT chk_platform_group CHECK (group_id = 'allura-platform'),
  
  -- Enforce confidence_score range
  CONSTRAINT chk_confidence_range CHECK (confidence_score IS NULL OR (confidence_score >= 0 AND confidence_score <= 1)),
  
  -- Enforce adoption_count non-negative
  CONSTRAINT chk_adoption_nonneg CHECK (adoption_count >= 0),
  
  -- Enforce version positive
  CONSTRAINT chk_version_positive CHECK (version >= 1)
);

-- Indexes for common query patterns
CREATE INDEX IF NOT EXISTS idx_platform_insights_category 
  ON platform_insights(category, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_platform_insights_tags 
  ON platform_insights USING GIN(tags);

CREATE INDEX IF NOT EXISTS idx_platform_insights_adoption 
  ON platform_insights(adoption_count DESC, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_platform_insights_version 
  ON platform_insights(supersedes_id, version);

CREATE INDEX IF NOT EXISTS idx_platform_insights_created_by 
  ON platform_insights(created_by, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_platform_insights_source_org 
  ON platform_insights(source_org) WHERE source_org IS NOT NULL;

-- ============================================================================
-- INSIGHT_ADOPTIONS: Track insight usage across organizations
-- ============================================================================
CREATE TABLE IF NOT EXISTS insight_adoptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  insight_id UUID NOT NULL REFERENCES platform_insights(id) ON DELETE CASCADE,
  adopted_by_org VARCHAR(255) NOT NULL,
  adopted_by_agent VARCHAR(255),
  adopted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  context TEXT, -- How the insight was used
  outcome VARCHAR(50), -- 'success', 'partial', 'failed', null
  metadata JSONB DEFAULT '{}'::jsonb,
  
  -- Ensure unique adoption per org per insight
  CONSTRAINT uq_insight_adoption UNIQUE (insight_id, adopted_by_org)
);

CREATE INDEX IF NOT EXISTS idx_adoption_insight 
  ON insight_adoptions(insight_id, adopted_at DESC);

CREATE INDEX IF NOT EXISTS idx_adoption_org 
  ON insight_adoptions(adopted_by_org, adopted_at DESC);

-- ============================================================================
-- PROMOTION_QUEUE: Queue insights for platform promotion
-- ============================================================================
CREATE TABLE IF NOT EXISTS platform_promotion_queue (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_group_id VARCHAR(255) NOT NULL,
  source_org VARCHAR(255) NOT NULL,
  insight_id VARCHAR(255) NOT NULL, -- Reference to organization's insight
  title VARCHAR(255) NOT NULL,
  content TEXT NOT NULL,
  category VARCHAR(50) NOT NULL,
  tags JSONB DEFAULT '[]'::jsonb,
  confidence_score DECIMAL(3,2),
  submitted_by VARCHAR(255) NOT NULL,
  submitted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  status VARCHAR(50) NOT NULL DEFAULT 'pending' 
    CHECK (status IN ('pending', 'approved', 'rejected', 'published')),
  reviewed_by VARCHAR(255),
  reviewed_at TIMESTAMPTZ,
  review_notes TEXT,
  rejection_reason TEXT,
  published_insight_id UUID REFERENCES platform_insights(id),
  
  -- Enforce group_id not empty
  CONSTRAINT chk_promo_group_not_empty CHECK (LENGTH(TRIM(source_group_id)) > 0),
  
  -- Enforce confidence range
  CONSTRAINT chk_promo_confidence_range CHECK (confidence_score IS NULL OR (confidence_score >= 0 AND confidence_score <= 1))
);

CREATE INDEX IF NOT EXISTS idx_promo_status 
  ON platform_promotion_queue(status, submitted_at DESC);

CREATE INDEX IF NOT EXISTS idx_promo_source 
  ON platform_promotion_queue(source_group_id, source_org);

-- ============================================================================
-- TRIGGER: Automatic adoption count increment
-- ============================================================================
CREATE OR REPLACE FUNCTION increment_adoption_count()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE platform_insights 
  SET adoption_count = adoption_count + 1,
      updated_at = NOW()
  WHERE id = NEW.insight_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS adoption_increment_trigger ON insight_adoptions;
CREATE TRIGGER adoption_increment_trigger
AFTER INSERT ON insight_adoptions
FOR EACH ROW
EXECUTE FUNCTION increment_adoption_count();

-- ============================================================================
-- TRIGGER: Update timestamp on platform_insights
-- ============================================================================
CREATE OR REPLACE FUNCTION update_platform_insight_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS platform_insight_timestamp_trigger ON platform_insights;
CREATE TRIGGER platform_insight_timestamp_trigger
BEFORE UPDATE ON platform_insights
FOR EACH ROW
EXECUTE FUNCTION update_platform_insight_timestamp();

-- ============================================================================
-- COMMENTS: Documentation
-- ============================================================================
COMMENT ON TABLE platform_insights IS 'Curated, sanitized knowledge shared across organizations';
COMMENT ON TABLE insight_adoptions IS 'Track which organizations have adopted platform insights';
COMMENT ON TABLE platform_promotion_queue IS 'Queue of insights proposed for platform-wide sharing';

COMMENT ON COLUMN platform_insights.group_id IS 'Always ALLURA-PLATFORM for platform insights';
COMMENT ON COLUMN platform_insights.source_org IS 'Anonymized organization identifier (not tenant ID)';
COMMENT ON COLUMN platform_insights.adoption_count IS 'Number of times this insight has been adopted';
COMMENT ON COLUMN platform_insights.version IS 'Version number for this insight (1, 2, 3...)';
COMMENT ON COLUMN platform_insights.supersedes_id IS 'Reference to previous version (Steel Frame versioning)';

COMMENT ON COLUMN insight_adoptions.adopted_by_org IS 'Organization that adopted this insight';
COMMENT ON COLUMN insight_adoptions.outcome IS 'Result of using this insight: success, partial, failed';