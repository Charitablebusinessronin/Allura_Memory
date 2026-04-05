-- Platform Library Schema - Story 4.2
-- 
-- Creates tables for cross-organization knowledge sharing:
-- - platform_insights: Store promoted insights from all organizations
-- - insight_adoptions: Track adoption metrics
-- 
-- RK-01: Privacy enforced via hashed/original_group_id

-- ============================================================================
-- Platform Insights Table
-- ============================================================================
-- Stores promoted insights from organization traces
-- Privacy: original_group_id is hashed (allura-hash:{hash})

CREATE TABLE IF NOT EXISTS platform_insights (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  original_insight_id TEXT NOT NULL,
  original_group_id TEXT NOT NULL, -- Hashed for privacy: allura-hash:{hash}
  sanitized_data JSONB NOT NULL,
  promoted_at TIMESTAMPTZ DEFAULT NOW(),
  promoted_by TEXT NOT NULL,
  version INT DEFAULT 1,
  adoption_count INT DEFAULT 0,
  tags TEXT[] DEFAULT '{}',
  
  -- Indexing for common queries
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_platform_insights_original_insight 
  ON platform_insights(original_insight_id);

CREATE INDEX IF NOT EXISTS idx_platform_insights_promoted_at 
  ON platform_insights(promoted_at DESC);

CREATE INDEX IF NOT EXISTS idx_platform_insights_tags 
  ON platform_insights USING GIN(tags);

CREATE INDEX IF NOT EXISTS idx_platform_insights_adoption_count 
  ON platform_insights(adoption_count DESC);

-- Full-text search index on sanitized_data
CREATE INDEX IF NOT EXISTS idx_platform_insights_content_search 
  ON platform_insights USING GIN(sanitized_data);

-- ============================================================================
-- Insight Adoptions Table
-- ============================================================================
-- Tracks which organizations have adopted which insights

CREATE TABLE IF NOT EXISTS insight_adoptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  insight_id UUID REFERENCES platform_insights(id) ON DELETE CASCADE,
  adopting_group_id TEXT NOT NULL, -- Uses allura-{org} format (not hashed)
  adopted_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- Prevent duplicate adoptions
  UNIQUE(insight_id, adopting_group_id)
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_insight_adoptions_insight 
  ON insight_adoptions(insight_id);

CREATE INDEX IF NOT EXISTS idx_insight_adoptions_adopting_group 
  ON insight_adoptions(adopting_group_id);

CREATE INDEX IF NOT EXISTS idx_insight_adoptions_adopted_at 
  ON insight_adoptions(adopted_at DESC);

-- Composite index for time-range queries
CREATE INDEX IF NOT EXISTS idx_insight_adoptions_insight_time 
  ON insight_adoptions(insight_id, adopted_at DESC);

-- ============================================================================
-- Comments for Documentation
-- ============================================================================

COMMENT ON TABLE platform_insights IS 
  'Story 4.2: Cross-organization knowledge sharing. Stores promoted insights with hashed group_id for privacy.';

COMMENT ON TABLE insight_adoptions IS 
  'Story 4.2: Tracks adoption metrics for promoted insights. Implements RK-01 tenant isolation.';

COMMENT ON COLUMN platform_insights.original_group_id IS 
  'Hashed organization ID for privacy: allura-hash:{sha256-hash-substring}';

COMMENT ON COLUMN platform_insights.adoption_count IS 
  'Denormalized count of adoptions for performance. Incremented via trackAdoption function.';

COMMENT ON COLUMN insight_adoptions.adopting_group_id IS 
  'Organization ID in allura-{org} format. Used for RK-01 tenant isolation enforcement.';