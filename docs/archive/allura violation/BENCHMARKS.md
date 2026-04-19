# Benchmarks — Allura v1 Canonical Interface

**Date**: 2026-04-10
**Status**: Ready for Testing
**Architect**: Frederick P. Brooks Jr.

---

## Overview

These benchmarks validate the canonical 5-operation interface against the architectural requirements defined in BLUEPRINT.md and DESIGN-ALLURA.md.

---

## Test Environment Setup

### Prerequisites

```bash
# Start databases
docker compose up -d

# Run migrations
docker exec -i knowledge-postgres psql -U ronin4life -d memory < docker/postgres-init/11-canonical-proposals.sql
docker exec -i knowledge-neo4j cypher-shell -u neo4j -p "$NEO4J_PASSWORD" < scripts/neo4j-memory-indexes.cypher

# Install dependencies
bun install

# Run typecheck
bun run typecheck
```

### Environment Variables

```bash
# Required
POSTGRES_HOST=localhost
POSTGRES_PORT=5432
POSTGRES_USER=ronin4life
POSTGRES_PASSWORD=your_password
POSTGRES_DB=memory
NEO4J_URI=bolt://localhost:7687
NEO4J_USER=neo4j
NEO4J_PASSWORD=your_password

# Optional (governance)
PROMOTION_MODE=soc2  # or 'auto'
AUTO_APPROVAL_THRESHOLD=0.85
```

---

## Benchmark Categories

### 1. Contract Validation

**Purpose**: Verify TypeScript contracts match implementation.

**Tests**:
- [ ] `memory_add` accepts valid `MemoryAddRequest`
- [ ] `memory_add` rejects invalid `group_id` (missing CHECK constraint)
- [ ] `memory_add` rejects invalid `content` (empty string)
- [ ] `memory_search` accepts valid `MemorySearchRequest`
- [ ] `memory_search` rejects invalid `limit` (negative)
- [ ] `memory_get` accepts valid `MemoryGetRequest`
- [ ] `memory_get` rejects invalid `id` (malformed UUID)
- [ ] `memory_list` accepts valid `MemoryListRequest`
- [ ] `memory_list` rejects invalid `group_id` (missing)
- [ ] `memory_delete` accepts valid `MemoryDeleteRequest`
- [ ] `memory_delete` rejects invalid `id` (not found)

**Command**:
```bash
bun test src/__tests__/canonical-contracts.test.ts
```

---

### 2. MCP Interface

**Purpose**: Verify MCP tools expose canonical operations.

**Tests**:
- [ ] `memory_add` tool exists and matches contract
- [ ] `memory_search` tool exists and matches contract
- [ ] `memory_get` tool exists and matches contract
- [ ] `memory_list` tool exists and matches contract
- [ ] `memory_delete` tool exists and matches contract
- [ ] No non-canonical tools exposed
- [ ] Error responses match contract format

**Command**:
```bash
bun test src/__tests__/canonical-mcp.test.ts
```

---

### 3. REST API

**Purpose**: Verify REST endpoints expose canonical operations.

**Tests**:
- [ ] `POST /api/memory` implements `memory_add`
- [ ] `GET /api/memory?query=...` implements `memory_search`
- [ ] `GET /api/memory` implements `memory_list`
- [ ] `GET /api/memory/[id]` implements `memory_get`
- [ ] `DELETE /api/memory/[id]` implements `memory_delete`
- [ ] Error responses use standard format
- [ ] `group_id` validation enforced

**Command**:
```bash
bun test src/__tests__/canonical-rest.test.ts
```

---

### 4. Storage Layer

**Purpose**: Verify PostgreSQL and Neo4j operations.

**Tests**:
- [ ] `memory_add` writes to PostgreSQL `events` table
- [ ] `memory_add` with high score promotes to Neo4j
- [ ] `memory_add` with low score queues in `canonical_proposals`
- [ ] `memory_search` queries both databases
- [ ] `memory_get` retrieves from correct storage
- [ ] `memory_list` returns paginated results
- [ ] `memory_delete` marks as deprecated (no deletion)
- [ ] `group_id` CHECK constraint enforced
- [ ] Append-only invariant holds (no UPDATE/DELETE on events)

**Command**:
```bash
bun test src/__tests__/canonical-storage.test.ts
```

---

### 5. Governance Flow

**Purpose**: Verify curator workflow.

**Tests**:
- [ ] Low confidence memory queues in `canonical_proposals`
- [ ] High confidence memory auto-promotes (if `PROMOTION_MODE=auto`)
- [ ] Curator can view pending proposals
- [ ] Curator can approve proposal (promotes to Neo4j)
- [ ] Curator can reject proposal (marks as rejected)
- [ ] Approval/rejection rationale is recorded
- [ ] Audit trail maintained in PostgreSQL

**Command**:
```bash
bun test src/__tests__/canonical-governance.test.ts
```

---

### 6. UI Components

**Purpose**: Verify UI matches intended roles.

**Tests**:
- [ ] `/memory` displays consumer viewer (no sidebar)
- [ ] `/memory` has search-dominant interface
- [ ] `/memory` shows memory provenance on expand
- [ ] `/memory` has usage indicator on expand
- [ ] `/memory` has swipe-to-delete gesture
- [ ] `/memory` has undo/recovery (30-day)
- [ ] `/curator` displays governance dashboard
- [ ] `/curator` has three tabs (Pending/Approved/Traces)
- [ ] `/curator` shows confidence badges
- [ ] `/curator` has approve/reject buttons

**Command**:
```bash
bun test src/__tests__/canonical-ui.test.ts
```

---

### 7. Performance Benchmarks

**Purpose**: Verify performance under load.

**Tests**:
- [ ] `memory_add` completes in < 100ms (episodic only)
- [ ] `memory_add` completes in < 500ms (with promotion)
- [ ] `memory_search` completes in < 200ms (100 results)
- [ ] `memory_get` completes in < 50ms
- [ ] `memory_list` completes in < 100ms (50 results)
- [ ] `memory_delete` completes in < 50ms
- [ ] Concurrent writes handled correctly (10 concurrent)
- [ ] No connection pool exhaustion under load

**Command**:
```bash
bun test src/__tests__/canonical-performance.test.ts
```

---

### 8. Integration Tests

**Purpose**: Verify end-to-end flows.

**Tests**:
- [ ] Full flow: add → search → get → delete
- [ ] Full flow: add → low score → curator approve → get
- [ ] Full flow: add → low score → curator reject → search (not found)
- [ ] Full flow: add → high score → auto-promote → get
- [ ] Deduplication: add same memory twice → only one Neo4j node
- [ ] Tenant isolation: different `group_id` values isolated
- [ ] Error recovery: database connection lost → graceful degradation

**Command**:
```bash
bun test src/__tests__/canonical-integration.test.ts
```

---

### 9. Security Tests

**Purpose**: Verify security invariants.

**Tests**:
- [ ] `group_id` validation prevents cross-tenant access
- [ ] SQL injection prevented in search queries
- [ ] Cypher injection prevented in Neo4j queries
- [ ] Input validation on all endpoints
- [ ] Error messages don't leak sensitive data
- [ ] Rate limiting enforced (if configured)

**Command**:
```bash
bun test src/__tests__/canonical-security.test.ts
```

---

### 10. Regression Tests

**Purpose**: Verify no drift from canonical interface.

**Tests**:
- [ ] No non-canonical operations exposed via MCP
- [ ] No non-canonical operations exposed via REST
- [ ] No non-canonical operations exposed via UI
- [ ] Legacy functions not imported by canonical implementation
- [ ] ADAS-era tools isolated (not imported)
- [ ] All tests pass after refactor

**Command**:
```bash
bun test src/__tests__/canonical-regression.test.ts
```

---

## Test Execution Order

Run tests in this order to validate dependencies:

1. **Contract Validation** — TypeScript contracts
2. **MCP Interface** — MCP tools
3. **REST API** — REST endpoints
4. **Storage Layer** — Database operations
5. **Governance Flow** — Curator workflow
6. **UI Components** — UI rendering
7. **Performance Benchmarks** — Load testing
8. **Integration Tests** — End-to-end flows
9. **Security Tests** — Security invariants
10. **Regression Tests** — No drift

---

## Success Criteria

All tests must pass for Allura v1 to be considered "done":

- [ ] Contract Validation: 11/11 tests pass
- [ ] MCP Interface: 7/7 tests pass
- [ ] REST API: 7/7 tests pass
- [ ] Storage Layer: 9/9 tests pass
- [ ] Governance Flow: 7/7 tests pass
- [ ] UI Components: 10/10 tests pass
- [ ] Performance Benchmarks: 8/8 tests pass
- [ ] Integration Tests: 7/7 tests pass
- [ ] Security Tests: 6/6 tests pass
- [ ] Regression Tests: 6/6 tests pass

**Total**: 78 tests

---

## Manual Validation

In addition to automated tests, perform these manual checks:

### 1. Database Verification

```sql
-- Verify canonical_proposals table exists
SELECT * FROM information_schema.tables 
WHERE table_name = 'canonical_proposals';

-- Verify CHECK constraint on group_id
SELECT conname, pg_get_constraintdef(oid) 
FROM pg_constraint 
WHERE conname = 'canonical_proposals_group_id_check';

-- Verify events table is append-only
SELECT * FROM pg_roles WHERE rolname = 'memory_writer';
```

### 2. Neo4j Verification

```cypher
// Verify indexes exist
SHOW INDEXES;

// Verify Memory nodes have required properties
MATCH (m:Memory) 
RETURN m.id, m.group_id, m.user_id, m.created_at 
LIMIT 5;

// Verify SUPERSEDES relationships
MATCH (v2:Memory)-[:SUPERSEDES]->(v1:Memory) 
RETURN v2.id, v1.id 
LIMIT 5;
```

### 3. MCP Server Verification

```bash
# Start canonical MCP server
bun run mcp:canonical

# In another terminal, test with MCP client
# (Use your MCP client to invoke memory_add, memory_search, etc.)
```

### 4. UI Verification

```bash
# Start Next.js dev server
bun run dev

# Open browser to:
# - http://localhost:3000/memory (consumer viewer)
# - http://localhost:3000/curator (governance dashboard)

# Verify:
# - No sidebar on /memory
# - Search is dominant
# - Swipe to delete works
# - Curator has three tabs
# - Confidence badges display correctly
```

---

## Continuous Integration

Add to CI pipeline:

```yaml
# .github/workflows/test.yml
name: Test
on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    services:
      postgres:
        image: postgres:16
        env:
          POSTGRES_USER: ronin4life
          POSTGRES_PASSWORD: test_password
          POSTGRES_DB: memory
        ports:
          - 5432:5432
      neo4j:
        image: neo4j:5.26
        env:
          NEO4J_AUTH: neo4j/test_password
        ports:
          - 7687:7687
          - 7474:7474

    steps:
      - uses: actions/checkout@v4
      - uses: oven-sh/setup-bun@v1
      - run: bun install
      - run: bun run typecheck
      - run: bun test
      - run: bun run lint
```

---

## Performance Targets

| Operation | Target | Notes |
|-----------|--------|-------|
| `memory_add` (episodic) | < 100ms | PostgreSQL write only |
| `memory_add` (promoted) | < 500ms | PostgreSQL + Neo4j write |
| `memory_search` | < 200ms | Full-text search + graph query |
| `memory_get` | < 50ms | Single lookup |
| `memory_list` | < 100ms | Paginated query |
| `memory_delete` | < 50ms | Mark deprecated |

---

## Failure Scenarios

Test these failure scenarios:

1. **PostgreSQL Down** — Graceful degradation, return cached data
2. **Neo4j Down** — Graceful degradation, search PostgreSQL only
3. **Both Down** — Return error, log incident
4. **Network Partition** — Retry with exponential backoff
5. **Rate Limit Exceeded** — Return 429, include retry-after header
6. **Invalid Input** — Return 400, include validation errors
7. **Unauthorized** — Return 401, include auth challenge

---

## 📝 Reflection

├─ Action Taken: Created comprehensive benchmarks for canonical interface validation
├─ Principle Applied: Plan to Throw One Away (test early, test often)
├─ Event Logged: None (documentation, not architectural decision)
├─ Neo4j Promoted: No (documentation, not reusable insight)
└─ Confidence: High

---

**End of Benchmarks**
