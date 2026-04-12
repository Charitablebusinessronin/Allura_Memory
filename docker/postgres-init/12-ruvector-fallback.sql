-- RuVector Memory Fallback Table
--
-- Used when Neo4j is unavailable. Stores memory writes that would have gone
-- to the Neo4j knowledge graph so they can be replayed once Neo4j recovers.
-- group_id enforced to ^allura- via constraint inherited from schema policy.

CREATE TABLE IF NOT EXISTS ruvector_memory_fallback (
  id                TEXT        NOT NULL,
  group_id          TEXT        NOT NULL CHECK (group_id ~ '^allura-[a-z0-9-]+$'),
  topic_key         TEXT        NOT NULL,
  content           TEXT        NOT NULL,
  summary           TEXT,
  confidence        FLOAT       NOT NULL DEFAULT 0.5,
  status            TEXT        NOT NULL DEFAULT 'draft',
  version           INTEGER     NOT NULL DEFAULT 1,
  tags              JSONB       NOT NULL DEFAULT '[]'::jsonb,
  metadata          JSONB       NOT NULL DEFAULT '{}'::jsonb,
  trace_ref         TEXT,
  replayed_to_neo4j BOOLEAN     NOT NULL DEFAULT FALSE,
  replayed_at       TIMESTAMPTZ,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  PRIMARY KEY (id),
  UNIQUE (topic_key, group_id)
);

CREATE INDEX IF NOT EXISTS idx_ruvector_fallback_group
  ON ruvector_memory_fallback (group_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_ruvector_fallback_pending
  ON ruvector_memory_fallback (replayed_to_neo4j, created_at)
  WHERE replayed_to_neo4j = FALSE;

COMMENT ON TABLE ruvector_memory_fallback IS
  'Fallback store for memory writes when Neo4j is degraded. '
  'Rows are replayed to Neo4j once it recovers. Never mutate — append only.';
