-- ============================================================================
-- Migration 16: RuVector Memory Table and Indexes
-- ============================================================================
--
-- Creates the allura_memories table for hybrid vector+BM25 search.
--
-- CRITICAL: This DDL must be executed on the RuVector PostgreSQL instance
-- (port 5433, database: memory). The main PostgreSQL instance (port 5432)
-- gets a reference-only copy for schema tracking.
--
-- RuVector v0.3.0 uses the `ruvector` type for vector columns (not real[]).
-- - HNSW indexes require ruvector_cosine_ops on ruvector(N) columns
-- - ruvector_hybrid_search() accepts real[] for query_vector internally
-- - nomic-embed-text produces 768-dimensional embeddings
-- - group_id enforced to ^allura- via CHECK constraint
--
-- ARCHITECTURE DECISION: Changed from bge-small-en-v1.5 (384d) to nomic-embed-text (768d).
-- Reason: bge-small-en-v1.5 not available in Ollama catalog. nomic-embed-text is already
-- running locally, produces 768d vectors, and is well-tested. The ruvector column and
-- HNSW index have been updated to match. ALTER TABLE was applied to the running instance.
-- ============================================================================
--
-- KNOWN BUG (documented, not fixed here):
--   docker/postgres-init/12-ruvector-fallback.sql creates
--   ruvector_memory_fallback on MAIN PG (5432), but src/lib/memory/store.ts
--   writes to it via getRuVectorPool() which connects to RuVector PG (5433).
--   The table does NOT exist on RuVector PG. Result: fallback writes SILENTLY
--   FAIL when Neo4j is down. This migration comments the issue but does not
--   modify 12-ruvector-fallback.sql. Fix requires either:
--     (a) Running 12-ruvector-fallback.sql on RuVector PG too, or
--     (b) Changing store.ts to use the main PG pool for fallback writes.
-- ============================================================================

-- ============================================================================
-- 1. Create the memories table
-- ============================================================================
-- Columns:
--   id              - Surrogate key (BIGSERIAL for large-scale append)
--   session_id      - Session correlation (maps to agent session)
--   user_id         - User who triggered this memory
--   content         - Raw text content (indexed for BM25 via GIN)
--   memory_type     - Semantic taxonomy: episodic | semantic | procedural
--   embedding       - nomic-embed-text vector, 768 dims, NULL until populated
--   metadata        - Flexible JSONB for extensible attributes
--   trajectory_id   - SONA feedback correlation key
--   created_at      - Immutable insertion timestamp
--   relevance       - SONA-adjusted relevance score (0.0 = no feedback)
--   group_id        - Tenant isolation, enforced to ^allura- pattern
--   deleted_at      - Soft-delete support (NULL = active)
-- ============================================================================

CREATE TABLE IF NOT EXISTS allura_memories (
    id              BIGSERIAL PRIMARY KEY,
    session_id      TEXT        NOT NULL,
    user_id         TEXT        NOT NULL,
    content         TEXT        NOT NULL,
    memory_type     TEXT        NOT NULL DEFAULT 'episodic'
        CHECK (memory_type IN ('episodic', 'semantic', 'procedural')),
    embedding       ruvector(768),  -- nomic-embed-text; NULL until embedding service populates
    metadata        JSONB       NOT NULL DEFAULT '{}'::jsonb,
    trajectory_id   TEXT,       -- for SONA feedback correlation
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    relevance       REAL        NOT NULL DEFAULT 0.0,

    -- Tenant isolation: group_id must match Allura convention
    group_id        TEXT        NOT NULL CHECK (group_id ~ '^allura-[a-z0-9-]+$'),

    -- Soft delete support
    deleted_at      TIMESTAMPTZ,

    -- Stored generated tsvector column for RuVector hybrid search FTS
    -- Required by ruvector_register_hybrid() as the fts_column parameter.
    -- Automatically kept in sync with content column by PostgreSQL.
    content_tsv    tsvector GENERATED ALWAYS AS (to_tsvector('english', content)) STORED
);

-- ============================================================================
-- 2. HNSW index for fast ANN vector search
-- ============================================================================
-- RuVector v0.3.0 provides the `hnsw` access method with `ruvector_cosine_ops`.
-- This is the primary index for approximate nearest-neighbor vector search.
-- For hybrid search, use ruvector_hybrid_search() which combines BM25 + HNSW.
-- ============================================================================

CREATE INDEX IF NOT EXISTS allura_mem_embedding_hnsw
    ON allura_memories USING hnsw (embedding ruvector_cosine_ops);

-- ============================================================================
-- 3. GIN index for full-text search on stored tsvector
-- ============================================================================
-- The content_tsv column is a stored generated tsvector. This GIN index
-- enables fast BM25-style keyword search for hybrid retrieval.
-- ============================================================================

CREATE INDEX IF NOT EXISTS allura_mem_content_fts
    ON allura_memories USING gin(content_tsv);

-- ============================================================================
-- 4. Composite index for tenant+time queries
-- ============================================================================
-- Primary access pattern: tenant-scoped chronological queries.
-- Most dashboards and list views filter by group_id and ORDER BY created_at DESC.
-- ============================================================================

CREATE INDEX IF NOT EXISTS allura_mem_group_time
    ON allura_memories (group_id, created_at DESC);

-- ============================================================================
-- 5. Index for filtering by memory type within a tenant
-- ============================================================================
-- Supports queries like: WHERE group_id = $1 AND memory_type = $2
-- ============================================================================

CREATE INDEX IF NOT EXISTS allura_mem_group_type
    ON allura_memories (group_id, memory_type);

-- ============================================================================
-- 6. Index for feedback correlation (trajectory_id lookups)
-- ============================================================================
-- SONA feedback loop uses trajectory_id to correlate retrieval with feedback.
-- Partial index saves space — only rows with trajectory_id set are indexed.
-- ============================================================================

CREATE INDEX IF NOT EXISTS allura_mem_trajectory
    ON allura_memories (trajectory_id) WHERE trajectory_id IS NOT NULL;

-- ============================================================================
-- 7. Partial index for active (non-deleted) memories
-- ============================================================================
-- Most queries exclude soft-deleted rows. This index covers the common case:
-- WHERE group_id = $1 AND deleted_at IS NULL ORDER BY relevance DESC
-- ============================================================================

CREATE INDEX IF NOT EXISTS allura_mem_active
    ON allura_memories (group_id, relevance DESC)
    WHERE deleted_at IS NULL;

-- ============================================================================
-- 8. Session-scoped index for session replay patterns
-- ============================================================================
-- Supports: WHERE session_id = $1 AND deleted_at IS NULL ORDER BY created_at
-- ============================================================================

CREATE INDEX IF NOT EXISTS allura_mem_session
    ON allura_memories (session_id, created_at DESC)
    WHERE deleted_at IS NULL;

-- ============================================================================
-- Comments for documentation
-- ============================================================================

COMMENT ON TABLE allura_memories IS
    'Hybrid vector+BM25 memory store for Allura. '
    'Embeddings use ruvector(768) (nomic-embed-text, 768 dims). '
    'HNSW index enables fast ANN search via ruvector_cosine_ops. '
    'ruvector_hybrid_search() combines BM25 + ANN for fusion retrieval. '
    'group_id enforced to ^allura- via CHECK. '
    'SONA feedback loop uses trajectory_id for correlation.';

COMMENT ON COLUMN allura_memories.embedding IS
    'Vector embedding as ruvector(768). nomic-embed-text produces 768-dim vectors. '
    'NULL until embedding service populates it. '
    'HNSW index uses ruvector_cosine_ops for approximate nearest-neighbor search.';

COMMENT ON COLUMN allura_memories.trajectory_id IS
    'Correlation ID for SONA feedback. Set during retrieval, '
    'used by ruvector_record_feedback() for relevance adjustment.';

COMMENT ON COLUMN allura_memories.relevance IS
    'Relevance score updated by SONA feedback loop. 0.0 = no feedback yet. '
    'Use ruvector_sona_learn() for trajectory-based learning adjustments.';

COMMENT ON COLUMN allura_memories.deleted_at IS
    'Soft-delete timestamp. NULL = active memory. '
    'Set to NOW() on deletion; excluded from queries via partial indexes.';

COMMENT ON COLUMN allura_memories.memory_type IS
    'Semantic taxonomy of memory. '
    'episodic: specific event recollection. '
    'semantic: generalized knowledge. '
    'procedural: skill/process memory.';

-- ============================================================================
-- POST-MIGRATION: Hybrid search registration
-- ============================================================================
-- ruvector_register_hybrid() is SESSION-SCOPED in v0.3.0 (not persistent).
-- It must be called in the same database session as hybrid queries.
-- This is a KNOWN LIMITATION — the registration does not survive reconnection.
--
-- For this reason, Allura implements its own hybrid search using:
--   - ruvector_cosine_distance() for vector ANN (REAL, verified)
--   - ts_rank() for BM25 (PostgreSQL native)
--   - Reciprocal Rank Fusion (RRF) to merge the two result sets
--
-- See src/lib/ruvector/bridge.ts retrieveMemories() for implementation.
--
-- SONA FUNCTIONS ARE STUBS in v0.3.0:
--   - ruvector_record_feedback() → no-op (requires enable_learning, which doesn't persist)
--   - ruvector_sona_learn() → returns hard-coded {steps:0, final_reward:0.5}
--   - ruvector_enable_learning() → session-scoped, lost on reconnect
--
-- Allura records feedback in allura_feedback table and may call
-- ruvector_sona_learn() best-effort. See bridge.ts postFeedback().
-- ============================================================================

-- ============================================================================
-- BUG DOCUMENTATION: ruvector_memory_fallback table mismatch
-- ============================================================================
-- The file docker/postgres-init/12-ruvector-fallback.sql creates
-- ruvector_memory_fallback on MAIN PostgreSQL (5432). However,
-- src/lib/memory/store.ts writes to it via getRuVectorPool() which
-- connects to RuVector PostgreSQL (5433). The table does NOT exist on
-- RuVector PG, causing SILENT FAILURE of fallback writes when Neo4j is down.
--
-- This bug is NOT fixed by this migration. It is documented here for tracking.
-- Fix requires one of:
--   (a) Run 12-ruvector-fallback.sql DDL on the RuVector PG instance too
--   (b) Change store.ts to use the main PG pool for fallback writes
--   (c) Create ruvector_memory_fallback on both PG instances
--
-- Recommended: Option (c) — add ruvector_memory_fallback to BOTH instances.
-- ============================================================================