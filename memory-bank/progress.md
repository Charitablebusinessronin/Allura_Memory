## 2026-04-22: Session Complete

- Project: allura-roninmemory
- Agent: brooks
- Summary: Started with Brain hydration and repo verification, then analyzed and partially advanced the pgvector/HNSW rollout for 4096d embeddings.
- Key changes:
  - Added guarded migration `docker/postgres-init/23-enable-4096d-hnsw.sql`
  - Updated `docker-compose.yml` Postgres image path after discovering `pgvector/pgvector:0.8.4-pg16` does not exist upstream
  - Updated `docker/postgres-init/16-ruvector-memories.sql` comments to match the staged HNSW strategy
  - Validated targeted RuVector tests passed
- Why:
  - To restore an indexed vector retrieval path for 4096-dimensional qwen3 embeddings without assuming unsupported pgvector image tags
- Final state:
  - Live Postgres was recreated on `pgvector/pgvector:pg16` and is healthy
  - HNSW restoration is not yet proven on the live DB
  - Allura Brain was unavailable at session end, so this file is the durable fallback record
- Important lesson:
  - Verify actual `vector` extension version before rollout and never assume new init scripts apply to an existing external volume

## 2026-04-22: Session Complete

- Project: allura-roninmemory
- Agent: brooks
- Summary: Completed documentation and orchestrator alignment for the new Team RAM memory model.
- Key changes:
  - Updated canonical architecture docs to remove the custom monolithic MCP runtime model
  - Updated primary and auxiliary skill docs to align on Brooks/Team RAM orchestration and packaged MCP server usage
  - Pruned noisy temporary summary files from `.opencode/skills/`
  - Updated `src/team-ram/orchestrator.ts` to enforce true staged execution
  - Added/updated orchestrator tests to verify memory-first execution order
- Why:
  - To establish one coherent runtime contract: `neo4j-memory` first, `database-server` second, and `neo4j-cypher` only when needed
- Final state:
  - Canonical docs, core skill docs, and auxiliary skill docs are aligned on the new architecture
  - Team RAM orchestrator now executes in staged order rather than parallel fan-out for mixed memory tasks
  - Remaining follow-up work is focused on legacy runtime/config drift and tightening routing intent inference
- Important lesson:
  - Plan order is not execution order; architecture only becomes real when the runtime contract enforces it
