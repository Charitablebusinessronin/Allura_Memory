-- Migrate embeddings from 4096d to 1024d
-- Step 1: Add new 1024d column (if not already present)
-- Step 2: Re-embed all rows via the application (re-embed-to-1024d.ts)
-- Step 3: Create HNSW index on embedding_1024
-- Step 4: Cutover (separate script: cutover-to-1024d.sql)

-- Add embedding_1024 column if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'allura_memories' AND column_name = 'embedding_1024'
  ) THEN
    ALTER TABLE allura_memories ADD COLUMN embedding_1024 vector(1024);
  END IF;
END $$;

-- Create HNSW index on embedding_1024 (concurrent, non-blocking)
SET maintenance_work_mem = '256MB';
CREATE INDEX CONCURRENTLY IF NOT EXISTS allura_mem_hnsw 
  ON allura_memories USING hnsw (embedding_1024 vector_cosine_ops) 
  WITH (m=16, ef_construction=64) 
  WHERE embedding_1024 IS NOT NULL AND deleted_at IS NULL;