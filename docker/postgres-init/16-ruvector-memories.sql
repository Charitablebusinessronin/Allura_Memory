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
-- - bge-small-en-v1.5 produces 384-dimensional embeddings
-- - group_id enforced to ^allura- via CHECK constraint
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
--   embedding       - bge-small-en-v1.5 vector, 384 dims, NULL until populated
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
    embedding       ruvector(384),  -- bge-small-en-v1.5; NULL until embedding service populates
    metadata        JSONB       NOT NULL DEFAULT '{}'::jsonb,
    trajectory_id   TEXT,       -- for SONA feedback correlation
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    relevance       REAL        NOT NULL DEFAULT 0.0,

    -- Tenant isolation: group_id must match Allura convention
    group_id        TEXT        NOT NULL CHECK (group_id ~ '^allura-[a-z0-9-]+$'),

    -- Soft delete support
    deleted_at      TIMESTAMPTZ
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
-- 3. BM25/GIN index for full-text search
-- ============================================================================
-- Enables keyword scoring for ruvector_hybrid_search() fusion.
-- Matches English text content against ts_vector representations.
-- ============================================================================

CREATE INDEX IF NOT EXISTS allura_mem_content_fts
    ON allura_memories USING gin(to_tsvector('english', content));

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
    'Embeddings use ruvector(384) (bge-small-en-v1.5, 384 dims). '
    'HNSW index enables fast ANN search via ruvector_cosine_ops. '
    'ruvector_hybrid_search() combines BM25 + ANN for fusion retrieval. '
    'group_id enforced to ^allura- via CHECK. '
    'SONA feedback loop uses trajectory_id for correlation.';

COMMENT ON COLUMN allura_memories.embedding IS
    'Vector embedding as ruvector(384). bge-small-en-v1.5 produces 384-dim vectors. '
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
-- After the table has data, register it for hybrid search:
--
--   SELECT ruvector_register_hybrid(
--     'allura_memories',   -- collection (table name)
--     'embedding',          -- vector_column
--     'content',            -- fts_column (ts_vector for BM25)
--     'content'             -- text_column (raw text for keyword scoring)
--   );
--
-- Then query with:
--   SELECT ruvector_hybrid_search(
--     'allura_memories',        -- collection
--     'search terms',           -- query_text
--     ARRAY[0.1, 0.2, ...]::real[],  -- query_vector (384 dims)
--     10,                       -- k (number of results)
--     'rrf',                    -- fusion method (optional: 'rrf', 'linear')
--     0.7                       -- alpha (optional: vector weight, 0.0-1.0)
--   );
--
-- SONA feedback loop:
--   SELECT ruvector_record_feedback(
--     'allura_memories',
--     ARRAY[0.1, 0.2, ...]::real[],  -- query_vector
--     ARRAY[1, 3, 7]::bigint[],       -- relevant_ids
--     ARRAY[2, 5]::bigint[]            -- irrelevant_ids
--   );
--   SELECT ruvector_sona_learn('allura_memories', trajectory_json::jsonb);
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