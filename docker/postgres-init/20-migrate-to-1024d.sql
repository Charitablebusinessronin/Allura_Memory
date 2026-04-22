-- ============================================================================
-- Migration: 1024d Embedding Dimension Reduction (4096d → 1024d)
-- ============================================================================
--
-- ARCHITECTURE DECISION (AD-24):
-- pgvector 0.8.2 has a HNSW_MAX_DIM of 2000 (hardcoded in src/hnsw.h).
-- Both HNSW and IVFFlat indexes reject dimensions > 2000.
-- There is no pgvector 0.8.4 — 0.8.2 is the latest stable release.
--
-- Solution: Matryoshka Representation Learning (MRL)
-- qwen3-embedding:8b supports the OpenAI-compatible `dimensions` parameter.
-- We request 1024d embeddings via /v1/embeddings with dimensions=1024.
-- Quality retention at 1024/4096 ≈ 95%+ for cosine similarity.
--
-- This migration:
-- 1. Adds embedding_1024 column (vector(1024))
-- 2. Creates HNSW index on embedding_1024
-- 3. (Manual step) Re-embed all rows using scripts/re-embed-to-1024d.mjs
-- 4. (Manual step) Cutover using scripts/cutover-to-1024d.sql
--
-- IMPORTANT: Do NOT run cutover-to-1024d.sql until re-embedding is complete
-- and validated. The old 4096d column must be preserved until cutover.
-- ============================================================================

BEGIN;

-- Step 1: Add 1024d column (idempotent)
ALTER TABLE allura_memories ADD COLUMN IF NOT EXISTS embedding_1024 vector(1024);

-- Step 2: Create HNSW index on 1024d column
-- This will be empty until re-embedding populates it.
-- Idempotent: IF NOT EXISTS
CREATE INDEX IF NOT EXISTS allura_mem_hnsw
    ON allura_memories USING hnsw (embedding_1024 vector_cosine_ops)
    WITH (m = 16, ef_construction = 64)
    WHERE embedding_1024 IS NOT NULL AND deleted_at IS NULL;

-- Step 3: Drop the old invalid HNSW index on 4096d column (if it exists)
-- This was broken by the 768→4096 migration and never rebuilt
DROP INDEX IF EXISTS test_hnsw_idx;

COMMIT;

-- ============================================================================
-- POST-MIGRATION STEPS (manual):
--
-- 1. Re-embed all rows:
--    bun run scripts/re-embed-to-1024d.mjs
--
-- 2. Validate:
--    SELECT count(*) FROM allura_memories WHERE embedding_1024 IS NOT NULL;
--    -- Should match total rows with embedding IS NOT NULL
--
-- 3. Verify HNSW is populated:
--    SELECT pg_size_pretty(pg_relation_size('allura_mem_hnsw'));
--    -- Should be non-trivial (e.g., 1+ MB for 200+ rows)
--
-- 4. Cutover (drops old column, renames new column):
--    psql -f scripts/cutover-to-1024d.sql
--
-- 5. Update application code (already done in this changeset):
--    - src/lib/ruvector/embedding-service.ts: /v1/embeddings with dimensions: 1024
--    - src/lib/ruvector/bridge.ts: vector(1024) comment
--    - src/lib/ruvector/types.ts: vector(1024) references
--    - src/lib/dedup/embeddings.ts: dimensions: 1024
-- ============================================================================