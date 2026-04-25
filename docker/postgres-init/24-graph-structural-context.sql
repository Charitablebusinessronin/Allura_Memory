-- ============================================================================
-- Migration 24: Structural Context Tables (Slice C)
-- ============================================================================
--
-- Creates PostgreSQL tables for structural context nodes and edges that replace
-- Neo4j's labeled nodes (Agent, Project, Task, Decision, etc.) and their
-- relationships when GRAPH_BACKEND=ruvector.
--
-- These tables store the non-Memory labeled nodes that memory/writer.ts creates.
-- Memory-labeled nodes use graph_memories (migration 21) via IGraphAdapter.
--
-- ADR: AD-029 — Graph Adapter Pattern for Neo4j → RuVector Migration
--
-- Design:
--   - graph_structural_nodes: stores arbitrary-labeled nodes as JSONB
--   - graph_structural_edges: stores directed relationships between nodes
--   - Uses JSONB @> containment operator for property matching (replaces Cypher MATCH)
--   - Upsert semantics (ON CONFLICT) for idempotent writes
-- ============================================================================

-- ============================================================================
-- 1. graph_structural_nodes
-- ============================================================================

CREATE TABLE IF NOT EXISTS graph_structural_nodes (
    node_id     TEXT        NOT NULL,
    label       TEXT        NOT NULL,
    group_id    TEXT        NOT NULL CHECK (group_id ~ '^allura-[a-z0-9-]+$'),
    props       JSONB       NOT NULL DEFAULT '{}',
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at  TIMESTAMPTZ,

    PRIMARY KEY (node_id, group_id)
);

-- Index for label+group queries (most common access pattern)
CREATE INDEX IF NOT EXISTS graph_struct_nodes_label_group
    ON graph_structural_nodes (label, group_id, created_at DESC);

-- GIN index for JSONB containment queries (props @> '{}')
CREATE INDEX IF NOT EXISTS graph_struct_nodes_props_gin
    ON graph_structural_nodes USING gin (props);

-- ============================================================================
-- 2. graph_structural_edges
-- ============================================================================

CREATE TABLE IF NOT EXISTS graph_structural_edges (
    from_id     TEXT        NOT NULL,
    to_id       TEXT        NOT NULL,
    rel_type    TEXT        NOT NULL,
    group_id    TEXT        NOT NULL CHECK (group_id ~ '^allura-[a-z0-9-]+$'),
    props       JSONB,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    PRIMARY KEY (from_id, to_id, rel_type, group_id)
);

-- Index for "outgoing edges from node" queries
CREATE INDEX IF NOT EXISTS graph_struct_edges_from
    ON graph_structural_edges (from_id, group_id);

-- Index for "incoming edges to node" queries
CREATE INDEX IF NOT EXISTS graph_struct_edges_to
    ON graph_structural_edges (to_id, group_id);

-- Index for relationship type queries
CREATE INDEX IF NOT EXISTS graph_struct_edges_type
    ON graph_structural_edges (rel_type, group_id);

-- ============================================================================
-- 3. Comments
-- ============================================================================

COMMENT ON TABLE graph_structural_nodes IS
    'Structural context nodes replacing Neo4j labeled nodes (Agent, Project, Task, etc.). '
    'Stores arbitrary-labeled nodes as JSONB. '
    'Slice C of the 2-Store RuVector Migration. '
    'Used by memory/writer.ts when GRAPH_BACKEND=ruvector.';

COMMENT ON TABLE graph_structural_edges IS
    'Structural context edges replacing Neo4j relationships (CONTRIBUTED, LEARNED, etc.). '
    'Stores directed relationships between structural nodes. '
    'Each row: (from_id)-[:rel_type]->(to_id).';