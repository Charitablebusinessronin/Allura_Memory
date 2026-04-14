# RuVector Integration Guide

> RuVector is already running in `docker-compose.yml` on port `5433`.  
> This doc covers **which functions to use**, **what to skip**, and **how to wire the SONA feedback loop**.

---

## What's Running

The `ruvector` service in `docker-compose.yml` uses `ruvnet/ruvector-postgres:latest` — a drop-in pgvector replacement with 143 SQL functions including local embeddings, self-learning (SONA), hybrid search, and self-healing indexes.

```
Host:     localhost
Port:     5433   (5432 inside Docker network)
User:     $POSTGRES_USER   (default: ruvector)
Password: $POSTGRES_PASSWORD (default: ruvector)
DB:       $POSTGRES_DB      (default: ruvector_test)
```

**Connect:**
```bash
PGPASSWORD=ruvector psql -h localhost -p 5433 -U ruvector -d ruvector_test
```

---

## Priority 1: Extension Setup

```sql
-- Run once on first connect
CREATE EXTENSION IF NOT EXISTS ruvector;

-- Verify
SELECT ruvector_version();
SELECT COUNT(*) FROM pg_proc WHERE proname LIKE 'ruvector%'; -- should be ~143
```

---

## Priority 2: Memory Table Schema

```sql
CREATE TABLE allura_memories (
    id          SERIAL PRIMARY KEY,
    session_id  TEXT NOT NULL,
    user_id     TEXT NOT NULL,
    content     TEXT NOT NULL,
    memory_type TEXT DEFAULT 'episodic',   -- episodic | semantic | procedural
    embedding   ruvector(384),             -- bge-small-en-v1.5 dimensions
    created_at  TIMESTAMPTZ DEFAULT now(),
    relevance   FLOAT DEFAULT 0.0          -- updated by SONA feedback loop
);

-- HNSW index for fast ANN search
CREATE INDEX allura_mem_hnsw ON allura_memories
    USING ruhnsw (embedding ruvector_cosine_ops)
    WITH (m = 16, ef_construction = 64);

-- Text index for BM25 hybrid
CREATE INDEX allura_mem_content ON allura_memories USING gin(to_tsvector('english', content));
```

---

## Priority 3: Local Embeddings (No API Key)

Use `bge-small-en-v1.5` — 384 dimensions, MTEB #1 for English, runs entirely inside Postgres.

```sql
-- Preload model on startup (do this once)
SELECT ruvector_preload_model('bge-small-en-v1.5');

-- Insert memory with auto-embedding
INSERT INTO allura_memories (session_id, user_id, content, embedding)
VALUES (
    'sess_abc123',
    'user_xyz',
    'User prefers concise technical answers over prose',
    ruvector_embed('User prefers concise technical answers over prose', 'bge-small-en-v1.5')
);

-- Batch insert (efficient for bulk memory writes)
SELECT ruvector_embed_batch(ARRAY['memory 1', 'memory 2', 'memory 3']);
```

---

## Priority 4: Hybrid Search (Vector + BM25)

Pure cosine similarity misses keyword-anchored memories. Always use hybrid.

```sql
-- Hybrid search: 70% vector, 30% BM25
SELECT
    id,
    content,
    memory_type,
    0.7 * (1.0 - (embedding <=> ruvector_embed($1, 'bge-small-en-v1.5'))) +
    0.3 * ts_rank(to_tsvector('english', content), plainto_tsquery('english', $1)) AS score
FROM allura_memories
WHERE user_id = $2
ORDER BY score DESC
LIMIT 10;

-- Or use built-in hybrid function
SELECT ruvector_hybrid_search(
    query_text      := $1,
    query_embedding := ruvector_embed($1, 'bge-small-en-v1.5'),
    table_name      := 'allura_memories',
    text_column     := 'content',
    vector_column   := 'embedding',
    limit_k         := 10
);
```

---

## Priority 5: SONA Self-Learning Feedback Loop

This is the killer feature. **Every time a retrieved memory influences a response, post feedback.**  
SONA uses micro-LoRA + EWC++ to tune search parameters over time — search quality improves automatically.

```sql
-- 1. When storing a memory, record the trajectory
SELECT ruvector_record_trajectory(
    input   := $embedding,
    output  := $retrieved_embedding,
    success := true,
    context := '{"session": "sess_abc123", "memory_type": "episodic"}'::jsonb
) AS trajectory_id;

-- 2. After the LLM uses the memory in its response, post feedback
--    relevance_scores: array of floats 0.0-1.0 for each retrieved memory
SELECT ruvector_learning_feedback(
    search_id        := $trajectory_id,
    relevance_scores := ARRAY[0.9, 0.7, 0.4]::float[]
);

-- 3. Let SONA optimize params for this query type
SELECT ruvector_optimize_search_params(
    query_type      := 'semantic_recall',
    historical_data := (SELECT array_agg(row_to_json(t)) FROM allura_memories t WHERE user_id = $1)
);

-- Check learning status
SELECT ruvector_sona_stats('allura_memories');
SELECT ruvector_sona_ewc_status('allura_memories');
```

---

## Priority 6: Multi-Tenancy (Per-User Isolation)

If Allura serves multiple users, use built-in RLS instead of manual WHERE clauses.

```sql
-- Set tenant context at connection/session level
SELECT ruvector_set_tenant($user_id);

-- All subsequent queries auto-filtered to this tenant
SELECT content FROM allura_memories
WHERE embedding <=> $query < 0.3;  -- no WHERE user_id needed

-- Admin stats
SELECT ruvector_tenant_stats($user_id);
```

---

## TypeScript MCP Bridge Pattern

```typescript
import { Pool } from 'pg';

const ruvector = new Pool({
  host: process.env.RUVECTOR_HOST || 'ruvector', // Docker service name
  port: 5432,                                     // Internal Docker port
  user: process.env.POSTGRES_USER,
  password: process.env.POSTGRES_PASSWORD,
  database: process.env.POSTGRES_DB,
});

// Store memory with auto-embedding
export async function storeMemory(userId: string, sessionId: string, content: string) {
  await ruvector.query(
    `INSERT INTO allura_memories (user_id, session_id, content, embedding)
     VALUES ($1, $2, $3, ruvector_embed($3, 'bge-small-en-v1.5'))`,
    [userId, sessionId, content]
  );
}

// Retrieve relevant memories
export async function retrieveMemories(userId: string, query: string, limit = 10) {
  const { rows } = await ruvector.query(
    `SELECT id, content, memory_type,
            0.7 * (1.0 - (embedding <=> ruvector_embed($1, 'bge-small-en-v1.5'))) +
            0.3 * ts_rank(to_tsvector('english', content), plainto_tsquery('english', $1)) AS score
     FROM allura_memories
     WHERE user_id = $2
     ORDER BY score DESC
     LIMIT $3`,
    [query, userId, limit]
  );
  return rows;
}

// Post feedback after LLM response (wire this into your response pipeline)
export async function postFeedback(trajectoryId: number, relevanceScores: number[]) {
  await ruvector.query(
    `SELECT ruvector_learning_feedback($1, $2::float[])`,
    [trajectoryId, relevanceScores]
  );
}
```

---

## What to Skip (for Now)

| Feature Group | Reason |
|---|---|
| Gated Transformers (13 fns) | Allura's LLM handles inference |
| SPARQL / RDF (14 fns) | Neo4j already handles graph queries |
| Topological Data Analysis (7 fns) | Research-grade, no current use case |
| Neural DAG / QuDAG (59 fns) | Query plan optimization — premature |
| GNN Layers (5 fns) | Only needed if memory becomes a graph |
| Hyperbolic Geometry (8 fns) | Only needed for taxonomy hierarchies |

---

## Health Checks

```sql
-- Extension working
SELECT ruvector_version();

-- Index health
SELECT ruvector_index_health('allura_mem_hnsw');

-- Self-healing status
SELECT ruvector_healing_status();

-- Learning progress
SELECT ruvector_sona_stats('allura_memories');
SELECT rudag_get_statistics();
```

---

## References

- [RuVector Repo](https://github.com/Charitablebusinessronin/RuVector)
- [ruvector-postgres README](https://github.com/Charitablebusinessronin/RuVector/blob/main/crates/ruvector-postgres/README.md)
- [Docker Hub: ruvnet/ruvector-postgres](https://hub.docker.com/r/ruvnet/ruvector-postgres)
