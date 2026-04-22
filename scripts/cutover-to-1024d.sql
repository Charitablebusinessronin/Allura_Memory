-- Final cutover: switch from 4096d to 1024d
-- ONLY run after all rows have been re-embedded and validated!

-- 1. Drop old 4096d embedding column
ALTER TABLE allura_memories DROP COLUMN embedding;

-- 2. Rename embedding_1024 to embedding
ALTER TABLE allura_memories RENAME COLUMN embedding_1024 TO embedding;

-- 3. Drop the old HNSW index (it was on embedding_1024, now invalid)
DROP INDEX IF EXISTS allura_mem_hnsw;

-- 4. Create final HNSW index on the renamed embedding column
SET maintenance_work_mem = '256MB';
CREATE INDEX CONCURRENTLY IF NOT EXISTS allura_mem_hnsw 
  ON allura_memories USING hnsw (embedding vector_cosine_ops) 
  WITH (m=16, ef_construction=64) 
  WHERE embedding IS NOT NULL AND deleted_at IS NULL;

-- Note: Application code must be updated to use vector(1024) column type
-- before running this cutover.