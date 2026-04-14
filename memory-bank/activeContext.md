# Active Context — Brooks Architect Persona

**Session**: 2026-04-14 (RuVector Hybrid Search + Stub Audit)
**Status**: ✅ RUVECTOR INTEGRATION COMPLETE (13/13) | HYBRID SEARCH SELF-IMPLEMENTED

## Current Focus

**RuVector hybrid search is live. Self-implemented RRF fusion replaces stub extension functions. Embedding backfill worker built. Documentation updated with stub audit findings.**

### What Changed (Session 2026-04-14)

1. **RuVector v0.3.0 Stub Audit** — Comprehensive audit of 154 SQL functions revealed that hybrid search, learning, agent routing, and healing subsystems are ALL stubs. Only vector math, graph DB, and RDF/SPARQL are real.
2. **Self-implemented Hybrid Search** — `retrieveMemories()` now does two-pass query (vector ANN via `ruvector_cosine_distance()` + BM25 via `ts_rank`) with Reciprocal Rank Fusion (RRF, k=60). Three modes: `"hybrid"` (default), `"vector"`, `"text"`.
3. **Embedding Backfill Worker** — `src/curator/embedding-backfill-worker.ts` follows notion-sync-worker pattern. Polls for NULL embeddings, generates via Ollama in batches of 10, updates with `::ruvector` cast. CLI flags: `--once`, `--dry-run`, `--interval`, `--group-id`.
4. **Migration DDL Updated** — Added `content_tsv tsvector GENERATED ALWAYS AS (to_tsvector('english', content)) STORED` column. Updated GIN index to use stored column instead of expression. Documented `ruvector_register_hybrid` as session-scoped stub.
5. **Documentation Updated** — `docs/RUVECTOR_INTEGRATION.md` rewritten with stub audit findings, self-implemented search docs, and backfill worker section.

### Key Architectural Decision

**Self-implemented RRF over `ruvector_hybrid_search()` stub**

| Aspect | RuVector Stub | Allura Self-Implemented |
|--------|--------------|--------------------------|
| Returns real data | ❌ Fabricated | ✅ Actual table rows |
| Persistence | ❌ Session-scoped | ✅ No registration needed |
| Fusion method | N/A (no real search) | RRF with k=60 |
| Graceful degradation | N/A | Falls back to BM25 if vector fails |
| Search modes | N/A | hybrid/vector/text |

### Parallel Dispatch Results (3 agents)

| Agent | Result |
|-------|--------|
| **Woz** (hybrid search) | Implemented RRF fusion in bridge.ts, updated types.ts, 78 tests pass (was 67) |
| **Woz** (backfill worker) | Built embedding-backfill-worker.ts + 31 tests, package.json scripts added |
| **Scout** (stub audit) | Full audit of 154 functions. 30+ REAL, 35+ STUB. Report delivered |

## Issues on the Board

| Issue | Severity | Description | Status |
|-------|----------|-------------|--------|
| #7 | MEDIUM | Legacy tools missing `^allura-` validation | **FIXED** |
| #12 | HIGH | Kernel proof gate returns errors as data | **FIXED** |
| #13 | HIGH | Neo4j I/O modules lack try/catch | **FIXED** |
| #14 | HIGH | `memory_list` swallows PostgreSQL errors | **FIXED** |
| #15 | HIGH | E2E test fixtures violate `^allura-` group_id | **FIXED** |
| #16 | HIGH | SQL tier CHECK uses 'established' instead of 'mainstream' | **FIXED** |
| #17 | MEDIUM | approvePromotions() dual-path risk | **HARD-BLOCKED** |
| ARCH-001 | HIGH | groupIdEnforcer inconsistent enforcement | **FIXED** |
| RUV-001 | HIGH | ruvector_hybrid_search is stub | **FIXED** (self-implemented) |
| RUV-002 | MEDIUM | ruvector_sona_learn is stub | **DOCUMENTED** (feedback in allura_feedback table) |

## Key Invariants Verified

- ✅ 1336 tests passing, 1 pre-existing failure (auth-middleware)
- ✅ Typecheck clean
- ✅ `content_tsv` stored generated column added to allura_memories
- ✅ GIN index on `content_tsv` replaces expression-based index
- ✅ RRF fusion: vector ANN + BM25 with k=60
- ✅ Graceful degradation: embedding failure → text-only fallback
- ✅ Evidence-gated feedback: usedMemoryIds.length > 0 required
- ✅ `^allura-[a-z0-9-]+$` enforced on all DB paths

## System Health

| Component | Status | Notes |
|-----------|--------|-------|
| Postgres (5432) | ✅ READY | Main PG, 23+ hours uptime |
| Neo4j | ✅ READY | SUPERSEDES versioning |
| RuVector PG (5433) | ✅ READY | 2 memories, 1 with embedding, content_tsv populated |
| Ollama | ✅ READY | nomic-embed-text, localhost:11434 |
| MCP server | ✅ HEALTHY | Port 3201 |
| Unit tests | ✅ 109 passed | bridge 49 + adapter 13 + embedding 16 + backfill 31 |
| Canonical tests | ✅ 20 passed | memory-search-ruvector integration |
| Full suite | ✅ 1336 passed | 1 pre-existing auth-middleware failure |

## RuVector Integration Checklist

| # | Item | Status | Evidence |
|---|------|--------|----------|
| 1 | RuVector PG reachable | ✅ | TCP connect, port 5433 |
| 2 | Extension loaded | ✅ | ruvector v0.3.0, 154 functions |
| 3 | `allura_memories` table | ✅ | ruvector(768), content_tsv, 8 indexes, 2 CHECK constraints |
| 4 | `allura_feedback` table | ✅ | 3 indexes, 1 CHECK constraint |
| 5 | 3 bridge functions | ✅ | storeMemory, retrieveMemories, postFeedback |
| 6 | Evidence-gated feedback | ✅ | usedMemoryIds.length === 0 → skip |
| 7 | Fallback table on both PG | ✅ | 5432 and 5433 |
| 8 | 9 RUVECTOR_* env vars | ✅ | All configured |
| 9 | canonical-tools.ts wired | ✅ | Conditional third search source |
| 10 | E2E test with live PG | ✅ | 7 tests gated by RUN_E2E_TESTS=true |
| 11 | Embedding service (Ollama) | ✅ | nomic-embed-text 768d |
| 12 | Docs updated to real API | ✅ | Replaced fictitious functions |
| 13 | **Hybrid search** | ✅ | Self-implemented RRF (vector + BM25) |

---

**Phase 4-9: CLOSED ✅**
**RuVector Integration: COMPLETE ✅** (13/13)

**Next Session**:
1. Run backfill worker to populate embeddings for existing memories
2. Test hybrid search end-to-end with real 768d embeddings
3. Process any remaining pending proposals through curator pipeline
4. Investigate `ruvector_cypher` property serialization bug (returns None)