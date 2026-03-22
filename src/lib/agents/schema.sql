-- Agent Persistence Schema
-- Epic 6, Story 6.2: Persist Agent Definitions to PostgreSQL

CREATE TABLE IF NOT EXISTS agents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  persona TEXT,
  module TEXT NOT NULL,
  platform TEXT NOT NULL,
  version TEXT NOT NULL DEFAULT '1.0.0',
  status TEXT NOT NULL DEFAULT 'Draft' CHECK (status IN ('Draft', 'Testing', 'Active', 'Deprecated', 'Archived')),
  confidence_score DECIMAL(3,2) DEFAULT 0.0 CHECK (confidence_score >= 0 AND confidence_score <= 1),
  source_files JSONB DEFAULT '[]',
  capabilities JSONB DEFAULT '[]',
  created_by TEXT DEFAULT 'system',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  group_id TEXT NOT NULL DEFAULT 'default'
);

-- Indexes for common queries
CREATE INDEX IF NOT EXISTS idx_agents_agent_id ON agents(agent_id);
CREATE INDEX IF NOT EXISTS idx_agents_status ON agents(status);
CREATE INDEX IF NOT EXISTS idx_agents_module ON agents(module);
CREATE INDEX IF NOT EXISTS idx_agents_platform ON agents(platform);
CREATE INDEX IF NOT EXISTS idx_agents_confidence ON agents(confidence_score);
CREATE INDEX IF NOT EXISTS idx_agents_created_at ON agents(created_at);

-- Version history tracking
CREATE TABLE IF NOT EXISTS agent_versions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id TEXT NOT NULL,
  version TEXT NOT NULL,
  status TEXT NOT NULL,
  confidence_score DECIMAL(3,2),
  source_files JSONB DEFAULT '[]',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  notes TEXT,
  FOREIGN KEY (agent_id) REFERENCES agents(agent_id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_agent_versions_agent_id ON agent_versions(agent_id);
CREATE INDEX IF NOT EXISTS idx_agent_versions_version ON agent_versions(version);

-- Usage tracking
CREATE TABLE IF NOT EXISTS agent_usage (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id TEXT NOT NULL,
  executed_at TIMESTAMPTZ DEFAULT NOW(),
  success BOOLEAN NOT NULL,
  duration_ms INTEGER,
  error_message TEXT,
  feedback_score INTEGER CHECK (feedback_score >= -1 AND feedback_score <= 1),
  FOREIGN KEY (agent_id) REFERENCES agents(agent_id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_agent_usage_agent_id ON agent_usage(agent_id);
CREATE INDEX IF NOT EXISTS idx_agent_usage_executed_at ON agent_usage(executed_at);

-- Function to update timestamp
CREATE OR REPLACE FUNCTION update_agent_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS agent_update_trigger ON agents;
CREATE TRIGGER agent_update_trigger
BEFORE UPDATE ON agents
FOR EACH ROW
EXECUTE FUNCTION update_agent_timestamp();

-- Function to record version on status change
CREATE OR REPLACE FUNCTION record_agent_version()
RETURNS TRIGGER AS $$
BEGIN
  IF OLD.status != NEW.status THEN
    INSERT INTO agent_versions (agent_id, version, status, confidence_score, source_files, notes)
    VALUES (NEW.agent_id, NEW.version, NEW.status, NEW.confidence_score, NEW.source_files, 
            'Status changed from ' || OLD.status || ' to ' || NEW.status);
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS agent_version_trigger ON agents;
CREATE TRIGGER agent_version_trigger
AFTER UPDATE ON agents
FOR EACH ROW
EXECUTE FUNCTION record_agent_version();