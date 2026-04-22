-- Migration: 768d → 4096d embedding upgrade (nomic-embed-text → qwen3-embedding:8b)
-- Uses pgvector (vector type).
-- pgvector 0.8.2 has a 2000-dimension limit for HNSW/IVFFlat indexes.
-- For 4096d vectors, we skip vector indexes and rely on brute-force scan
-- (acceptable for <1000 rows). Upgrade to pgvector 0.8.4+ to enable
-- HNSW indexing for dimensions > 2000.

-- 1. Drop existing HNSW index (768d)
DROP INDEX IF EXISTS allura_mem_embedding_hnsw;

-- 2. Alter the embedding column from vector(768) to vector(4096)
--    Existing embeddings are incompatible (wrong dimension) → NULL them out.
--    They will be re-embedded by the embedding-backfill-worker.
ALTER TABLE allura_memories
  ALTER COLUMN embedding TYPE vector(4096)
  USING NULL;

-- NOTE: No vector index is created here. With <1000 rows, brute-force
-- cosine distance scan is fast enough. Once pgvector is upgraded to 0.8.4+,
-- add: CREATE INDEX allura_mem_embedding_hnsw ON allura_memories USING hnsw (embedding vector_cosine_ops);