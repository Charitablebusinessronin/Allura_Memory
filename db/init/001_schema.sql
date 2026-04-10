-- Episodic events (append-only, permanent)
CREATE TABLE IF NOT EXISTS events (
  id          BIGSERIAL PRIMARY KEY,
  group_id    VARCHAR(255) NOT NULL CHECK (group_id ~ '^allura-'),
  event_type  VARCHAR(100) NOT NULL,
  agent_id    VARCHAR(255),
  workflow_id VARCHAR(255),
  status      VARCHAR(50) DEFAULT 'completed',
  metadata    JSONB DEFAULT '{}',
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_events_group_id ON events(group_id);
CREATE INDEX IF NOT EXISTS idx_events_type     ON events(event_type);
CREATE INDEX IF NOT EXISTS idx_events_created  ON events(created_at DESC);

-- SOC2 promotion proposals (human HITL gate)
CREATE TABLE IF NOT EXISTS proposals (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id        VARCHAR(255) NOT NULL CHECK (group_id ~ '^allura-'),
  source_event_id BIGINT REFERENCES events(id),
  content         TEXT NOT NULL,
  score           FLOAT NOT NULL,
  status          VARCHAR(50) DEFAULT 'pending'
                    CHECK (status IN ('pending','approved','rejected')),
  witness_hash    TEXT,
  reviewed_by     VARCHAR(255),
  reviewed_at     TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_proposals_group_id ON proposals(group_id);
CREATE INDEX IF NOT EXISTS idx_proposals_status   ON proposals(status);
