-- ============================================================================
-- Migration 21: Graph Adapter Tables (Slice C)
-- ============================================================================
--
-- Creates PostgreSQL tables that replace Neo4j's Memory nodes and SUPERSEDES
-- relationships. This is the "ruvector-graph" adapter storage layer.
--
-- ADR: AD-029 — Graph Adapter Pattern for Neo4j → RuVector Migration
--
-- Design rationale:
-- - Neo4j uses SUPERSEDES as a singly-linked list (no multi-hop traversals)
-- - All queries are single-node lookups or full-text search
-- - No path queries, no shortestPath, no relationship diversity
-- - Therefore: PG tables with adjacency list are equivalent and simpler
--
-- Tables:
--   1. graph_memories — Memory nodes (equivalent to Neo4j Memory label)
--   2. graph_supersedes — SUPERSEDES relationships (adjacency table)
--
-- Key constraints:
-- - group_id on every row (tenant isolation)
-- - Append-only: no UPDATE on graph_memories except for soft-delete flags
-- - SUPERSEDES is append-only (INSERT only, DELETE only on restore)
-- - content_tsv for full-text search (replaces Neo4j fulltext index)
-- ============================================================================

-- ============================================================================
-- 1. graph_memories table
-- ============================================================================
-- Stores canonical (promoted) memory nodes.
-- Equivalent to Neo4j's Memory label with all properties.
-- ============================================================================

CREATE TABLE IF NOT EXISTS graph_memories (
    id              TEXT        NOT NULL,
    group_id        TEXT        NOT NULL CHECK (group_id ~ '^allura-[a-z0-9-]+$'),
    user_id         TEXT,
    content         TEXT        NOT NULL,
    score           REAL        NOT NULL DEFAULT 0.5,
    provenance      TEXT        NOT NULL DEFAULT 'conversation'
        CHECK (provenance IN ('conversation', 'manual')),
    version         INTEGER     NOT NULL DEFAULT 1,
    tags            TEXT[]      DEFAULT '{}',
    deprecated      BOOLEAN     NOT NULL DEFAULT false,
    deleted_at      TIMESTAMPTZ,
    restored_at     TIMESTAMPTZ,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    -- Stored generated tsvector for full-text search
    -- Replaces Neo4j's memory_search_index fulltext index
    content_tsv     tsvector GENERATED ALWAYS AS (to_tsvector('english', content)) STORED,

    -- Primary key: id + group_id (id is UUID, unique within tenant)
    PRIMARY KEY (id, group_id)
);

-- ============================================================================
-- 2. Indexes for graph_memories
-- ============================================================================

-- GIN index for full-text search (replaces Neo4j fulltext index)
CREATE INDEX IF NOT EXISTS graph_mem_content_fts
    ON graph_memories USING gin(content_tsv);

-- Composite index for tenant+time queries (most common access pattern)
CREATE INDEX IF NOT EXISTS graph_mem_group_time
    ON graph_memories (group_id, created_at DESC)
    WHERE deprecated = false;

-- Index for user-scoped queries within a tenant
CREATE INDEX IF NOT EXISTS graph_mem_group_user
    ON graph_memories (group_id, user_id, created_at DESC)
    WHERE deprecated = false;

-- Partial index for active (non-deprecated, non-superseded) memories
-- This is the "canonical" set — what most queries target
CREATE INDEX IF NOT EXISTS graph_mem_active
    ON graph_memories (group_id, score DESC)
    WHERE deprecated = false;

-- Index for soft-deleted memories (for recovery window queries)
CREATE INDEX IF NOT EXISTS graph_mem_deleted
    ON graph_memories (group_id, deleted_at DESC)
    WHERE deprecated = true AND deleted_at IS NOT NULL;

-- ============================================================================
-- 3. graph_supersedes table
-- ============================================================================
-- Adjacency table for SUPERSEDES relationships.
-- Each row represents: (newer_id)-[:SUPERSEDES]->(superseded_id)
-- Equivalent to Neo4j's SUPERSEDES relationship type.
-- ============================================================================

CREATE TABLE IF NOT EXISTS graph_supersedes (
    newer_id        TEXT        NOT NULL,
    superseded_id   TEXT        NOT NULL,
    group_id        TEXT        NOT NULL CHECK (group_id ~ '^allura-[a-z0-9-]+$'),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    -- Composite primary key: one SUPERSEDES relationship per pair within tenant
    PRIMARY KEY (newer_id, superseded_id, group_id),

    -- FK to graph_memories (deferred to allow batch operations)
    FOREIGN KEY (newer_id, group_id) REFERENCES graph_memories(id, group_id) ON DELETE CASCADE,
    FOREIGN KEY (superseded_id, group_id) REFERENCES graph_memories(id, group_id) ON DELETE CASCADE
);

-- Index for "is this memory superseded?" queries (NOT EXISTS subquery)
CREATE INDEX IF NOT EXISTS graph_supersedes_target
    ON graph_supersedes (superseded_id, group_id);

-- Index for "what does this memory supersede?" queries (lineage)
CREATE INDEX IF NOT EXISTS graph_supersedes_source
    ON graph_supersedes (newer_id, group_id);

-- ============================================================================
-- 4. Comments for documentation
-- ============================================================================

COMMENT ON TABLE graph_memories IS
    'Canonical memory nodes replacing Neo4j Memory label. '
    'Slice C of the 2-Store RuVector Migration. '
    'group_id enforced to ^allura- via CHECK. '
    'content_tsv provides full-text search (replaces Neo4j fulltext index). '
    'deprecated=true marks soft-deleted or superseded nodes.';

COMMENT ON TABLE graph_supersedes IS
    'SUPERSEDES adjacency table replacing Neo4j SUPERSEDES relationships. '
    'Each row: (newer_id)-[:SUPERSEDES]->(superseded_id). '
    'Used for versioning: when a memory is updated, a new node is created '
    'and the old one is marked as superseded via this table.';

COMMENT ON COLUMN graph_memories.content_tsv IS
    'Stored generated tsvector for full-text search. '
    'Replaces Neo4j''s memory_search_index fulltext index. '
    'Automatically kept in sync with content column by PostgreSQL.';

COMMENT ON COLUMN graph_memories.deprecated IS
    'Soft-delete flag. true = deleted or superseded. '
    'Most queries filter to deprecated=false for canonical results.';

COMMENT ON COLUMN graph_supersedes.newer_id IS
    'The memory that supersedes the old one. '
    'Equivalent to the source node in Neo4j''s SUPERSEDES relationship.';

COMMENT ON COLUMN graph_supersedes.superseded_id IS
    'The memory that has been superseded. '
    'Equivalent to the target node in Neo4j''s SUPERSEDES relationship.';