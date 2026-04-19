<!-- Context: development/data | Priority: critical | Version: 2.0 | Updated: 2026-04-19 -->

# Data Layer Navigation

**Purpose**: Database patterns for Allura's dual-database memory system

**Status**: ✅ Active - Core to Allura Brain architecture

---

## Allura Data Stores

| Store | Technology | Purpose | Location |
|-------|------------|---------|----------|
| **Episodic** | PostgreSQL 16 | Append-only execution traces | `src/lib/postgres/` |
| **Semantic** | Neo4j 5.26 | Versioned knowledge graph | `src/lib/neo4j/` |
| **Vector** | RuVector PG | 768d embeddings (port 5433) | `src/lib/ruvector/` |

---

## Critical Patterns

### PostgreSQL (Episodic)
- **Append-only**: Never UPDATE/DELETE trace rows
- **Parameterized queries**: `$1, $2` syntax only
- **group_id**: Required on every query for tenant isolation
- **Connection**: `src/lib/postgres/connection.ts`

### Neo4j (Semantic)
- **SUPERSEDES**: Versioning via relationships, never edit nodes
- **group_id**: Every node must have this property
- **Cypher**: Parameterized queries only
- **Client**: `src/integrations/neo4j.client.ts`

### RuVector (Hybrid Search)
- **Embeddings**: Ollama nomic-embed-text (768d)
- **RRF Fusion**: Vector ANN + BM25 text search
- **Modes**: `hybrid` (default), `vector`, `text`

---

## Quick Routes

| Task | Path |
|------|------|
| **PostgreSQL connection** | `src/lib/postgres/connection.ts` |
| **Neo4j client** | `src/integrations/neo4j.client.ts` |
| **Hybrid search** | `src/lib/ruvector/bridge.ts` |
| **Schema validation** | `src/lib/validation/` |

---

## Related Context

- **Backend** → `../backend/navigation.md`
- **Integration** → `../integration/navigation.md`
- **Core Standards** → `../../core/standards/code-quality.md`
