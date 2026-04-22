-- Migration: Restore 4096d HNSW index after pgvector upgrade to >= 0.8.4
--
-- Why this exists:
-- - Migration 22 intentionally stopped at vector(4096) because pgvector 0.8.2
--   could not build HNSW/IVFFlat indexes above 2000 dimensions.
-- - Once the PostgreSQL image is upgraded to pgvector 0.8.4+ on PG16, the
--   allura_memories.embedding column can again use an HNSW index for 4096d
--   qwen3-embedding:8b vectors.
--
-- Safety:
-- - This migration is idempotent.
-- - It no-ops when the vector extension is missing, the table is absent, or
--   the installed pgvector extension version is below 0.8.4.

DO $$
DECLARE
  vector_ext_version text;
  version_parts int[];
BEGIN
  IF to_regclass('public.allura_memories') IS NULL THEN
    RAISE NOTICE 'Skipping HNSW creation — allura_memories table does not exist';
    RETURN;
  END IF;

  SELECT extversion INTO vector_ext_version
  FROM pg_extension
  WHERE extname = 'vector';

  IF vector_ext_version IS NULL THEN
    RAISE NOTICE 'Skipping HNSW creation — vector extension is not installed';
    RETURN;
  END IF;

  version_parts := string_to_array(vector_ext_version, '.')::int[];

  IF version_parts < ARRAY[0, 8, 4] THEN
    RAISE NOTICE 'Skipping HNSW creation — pgvector version % is below 0.8.4', vector_ext_version;
    RETURN;
  END IF;

  EXECUTE '
    CREATE INDEX IF NOT EXISTS allura_mem_embedding_hnsw
      ON allura_memories USING hnsw (embedding vector_cosine_ops)
  ';

  COMMENT ON INDEX allura_mem_embedding_hnsw IS
    'HNSW ANN index for qwen3-embedding:8b vector(4096) retrieval. Requires pgvector >= 0.8.4.';
END $$;
