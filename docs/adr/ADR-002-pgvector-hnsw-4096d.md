# ADR-002: pgvector HNSW Index Strategy for 4096d Embeddings

**Date:** 2026-04-22  
**Status:** Proposed  
**Author:** Brooks (Architecture Review)

## Context

Allura Memory stores 4096-dimensional embeddings (`vector(4096)`) from `qwen3-embedding:8b`. The HNSW index was dropped because pgvector 0.8.2 has a hard limit of **2000 dimensions** for HNSW and IVFFlat indexes on `vector` type. Every `memory_search` currently performs a sequential scan, which will degrade linearly as the table grows.

**Current state:**
- PostgreSQL 16.13 with pgvector 0.8.2
- 241 rows in `allura_memories`, ~4.6 MB total
- No vector index exists — pure sequential scan
- Docker image: `pgvector/pgvector:pg16`

## Key Findings

### 1. There is no pgvector 0.8.4

pgvector 0.8.2 (released 2026-02-25) is the **latest release**. The Docker Hub tags only ship 0.8.2. The master branch source confirms `HNSW_MAX_DIM = 2000` — no upcoming change.

### 2. HNSW dimension limits in pgvector 0.8.2

| Type | HNSW Max Dims | IVFFlat Max Dims |
|------|--------------|-----------------|
| `vector` | 2000 | 2000 |
| `halfvec` | 4000 | 4000 |
| `sparsevec` | 2000 (max nnz) | — |

**4096 exceeds both `vector` (2000) and `halfvec` (4000) limits.**

### 3. `ALTER EXTENSION vector UPDATE` is in-place safe

pgvector supports in-place upgrades via `ALTER EXTENSION vector UPDATE;`. No new container needed for minor version bumps. However, since 0.8.2 is already the latest, this is moot.

### 4. The actual constraint

We cannot create an HNSW or IVFFlat index on `vector(4096)` in any released pgvector version. Period.

## Decision: Three-Option Architecture

### Option A: Dual-Column with `halfvec(2000)` Projections (RECOMMENDED)

Store the full `vector(4096)` for exact re-ranking, but add a generated `halfvec(2000)` column for HNSW indexing. Use truncated/projected embeddings for approximate search, then re-rank with the full vector.

```sql
-- Add halfvec column with truncated dimensions
ALTER TABLE allura_memories 
ADD COLUMN embedding_halfvec halfvec(2000)
GENERATED ALWAYS AS (embedding::halfvec(2000)) STORED;

-- HNSW index on the reduced-dimension column
CREATE INDEX allura_mem_hnsw_halfvec 
ON allura_memories USING hnsw (embedding_halfvec halfvec_cosine_ops)
WITH (m = 16, ef_construction = 64);
```

**Search pattern:**
1. Approximate search via HNSW on `halfvec(2000)` → get top-K candidates
2. Re-rank candidates using full `vector(4096)` cosine distance
3. Return final results

**Pros:** Fast HNSW search, exact re-ranking, no data loss
**Cons:** ~50% of discriminative information lost in truncation; requires app-level two-phase search; doubling storage per row

**Implementation cost:** Medium — requires code changes in search logic, migration to add column + index

### Option B: Reduce Embedding Dimensions

Switch the embedding model to output ≤2000 dimensions, or apply PCA/matryoshka reduction to produce ≤2000d vectors.

**Pros:** Clean, single-column HNSW, no app changes to search logic
**Cons:** Requires re-embedding all 241 rows; model change or dimensionality reduction pipeline; loss of information vs full 4096d

**Implementation cost:** High — re-embedding pipeline, model evaluation

### Option C: Accept Sequential Scan (Status Quo + Monitor)

At 241 rows and ~4.6 MB, sequential scan on vector cosine similarity takes <1ms. The linear degradation doesn't become painful until ~10K-50K rows depending on hardware.

**Pros:** Zero work, zero risk
**Cons:** Guaranteed degradation; technical debt; becomes urgent at scale

**Implementation cost:** Zero — do nothing

## Recommendation

**Start with Option C now, prepare Option A for when it's needed.**

Rationale:
- 241 rows → sequential scan is sub-millisecond. No pain yet.
- Option A requires code changes to the search pipeline (two-phase retrieval).
- Monitor query performance. When `memory_search` latency exceeds 50ms, activate Option A.
- This avoids premature optimization while having a clear plan.

## Upgrade Plan (When Activating Option A)

### Step 1: Add `halfvec` column + index (minimal downtime)

```sql
-- ~1-2 seconds for 241 rows
ALTER TABLE allura_memories 
ADD COLUMN embedding_hnsw halfvec(2000)
GENERATED ALWAYS AS (embedding::halfvec(2000)) STORED;

-- ~1-5 seconds for 241 rows  
CREATE INDEX allura_mem_hnsw_halfvec 
ON allura_memories USING hnsw (embedding_hnsw halfvec_cosine_ops)
WITH (m = 16, ef_construction = 64);
```

### Step 2: Modify search code to two-phase retrieval

1. Phase 1: HNSW search on `embedding_hnsw` → get 3× desired results
2. Phase 2: Re-rank with full `vector(4096)` cosine distance
3. Return top-K

### Step 3: Validate

```sql
-- Confirm index usage
EXPLAIN ANALYZE 
SELECT id, embedding_hnsw <=> halfvec '[...]'::halfvec(2000) AS distance
FROM allura_memories 
ORDER BY distance LIMIT 10;
```

### Rollback

```sql
DROP INDEX allura_mem_hnsw_halfvec;
ALTER TABLE allura_memories DROP COLUMN embedding_hnsw;
```

## Docker Image Strategy

**Keep `pgvector/pgvector:pg16`.** No image change needed — 0.8.2 is current and supports `halfvec` + HNSW up to 4000d. Pin in compose file with a comment:

```yaml
image: pgvector/pgvector:pg16  # pgvector 0.8.2; supports halfvec HNSW up to 4000d
```

## Monitoring Threshold

- **Yellow:** 1,000 rows — implement Option A
- **Red:** 5,000 rows — sequential scan latency becomes user-visible

---

*Architecture review complete. The 2000-dimension HNSW limit is a hard constraint in pgvector. No upgrade path exists to lift it for `vector(4096)`. The `halfvec` truncation strategy (Option A) is the pragmatic path forward when scale demands it.*